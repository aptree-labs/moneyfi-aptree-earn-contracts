# Response 01
Author: Don Duke
Role: Lead Developer, APTree
---
This document responds to [Findings Report 01](./report-01.md).

## Scope of what was audited

The audit reviewed the mainnet deployment published in transaction
[`0x6251f9d6745c3b777e43adf223b6f3c1754374cfcf941fbadc335f7966fcdb9c`](https://explorer.aptoslabs.com/txn/0x6251f9d6745c3b777e43adf223b6f3c1754374cfcf941fbadc335f7966fcdb9c?network=mainnet).

- **Sender / publisher:** `0x951a31b39db54a4e32af927dce9fae7aa1ad14a1bb73318405ccf6cd5d66b3be`
- **Payload:** `0x1::code::publish_package_txn`
- **Package:** `bridge` (upgrade #8, compatible upgrade policy)
- **Modules published:** `moneyfi_adapter`, `bridge`
- **Dependencies:** `AptosFramework`, `AptosStdlib`, `MoveStdlib`,
  `moneyfi` (`0x97c9ffc7143c5585090f9ade67d19ac95f3b3e7008ed86c73c947637e2862f56`)
- **Ledger version:** 4837814834
- **Result:** success

The commit of the repo at the time of that deployment was `1e81600`
(`patch: share price calculation fix`). This is the exact build the auditor
reviewed for the `bridge` and `moneyfi_adapter` modules, plus the
`contracts/locking` package that was present in the repo at that commit.
The `GuaranteedYieldLocking` package was also live in the repo at that
commit and is in scope for the response below.

## Scope of the fixes

All remediation described in this document lives on the `audit-01` branch
at commit `d7f34d9` (`fix: audit responses`) and
has not yet been deployed to mainnet. The fixes will land in a follow-up
`publish_package_txn` for the `bridge` package.

## Preamble

The findings in this report were valid against the snapshot the audit team
reviewed. Two factors shaped our response:

1. The `contracts/locking` package had been internally superseded by
   `contracts/guaranteed-yield` (`GuaranteedYieldLocking`) but was still present
   in the repo when the audit was performed. We accept that having dead-but-
   deployable code in the audit scope was our mistake, not the auditor's.
2. `GuaranteedYieldLocking` was designed against a different threat model
   (contract-custodied AET, two-phase withdrawals, instant-cashback yield) that
   already addresses several of the report's findings by construction.

The actions taken on the `audit-01` branch are:

- **Deleted** `contracts/locking/` in its entirety (package, sources, tests).
- **Deleted** `rfcs/RFC-002-TIME-LOCKED-DEPOSITS.md` and `rfcs/TEST-CASES-LOCKING.md`,
  since they reference the abandoned design.
- **Hardened** `contracts/bridge/sources/bridge.move` to disable the
  `request_and_withdraw` entry point.
- **Hardened** `contracts/bridge/sources/moneyfi_adapter.move` with a non-zero
  AET mint guard and graceful degradation in `get_share_price`.

All hardening listed below has been verified to compile (`aptos move compile`)
against both the `bridge` and `guaranteed-yield` packages.

## Addressing Findings

### H-01 — Locking module did not custody AET

**Status: Fixed by removal + GuaranteedYield design.**

The vulnerable `locking.move` has been deleted from the repo. The replacement
contract, `GuaranteedYieldLocking`, takes custody of AET at deposit time by
calling `MoneyFiBridge::deposit` with the **contract's resource account signer**
rather than the user's signer:

```move
// contracts/guaranteed-yield/sources/GuaranteedYieldLocking.move:430-433
let controller_signer =
    account::create_signer_with_capability(&config.signer_cap);
MoneyFiBridge::deposit(&controller_signer, amount);
```

Because `moneyfi_adapter::deposit_fungible` mints AET to `address_of(user)`
(its own caller), all AET for guaranteed-yield positions is held by the
controller resource account, not the end user. End users have no AET to burn,
which structurally prevents the H-01 bypass.

As an additional defense-in-depth measure, `bridge::request_and_withdraw` —
the single-transaction bypass entry point cited by the auditor — has been
disabled in `contracts/bridge/sources/bridge.move`:

```move
public entry fun request_and_withdraw(
    _user: &signer,
    _amount: u64,
    _min_share_price: u128
) {
    abort(EOPERATION_NOT_PERMITTED)
}
```

The function signature is preserved for ABI compatibility but always aborts.
This guarantees that even if a future contract were to mint AET to a user
wallet, the same-transaction round-trip path is closed.

---

### H-02 — Forfeited-yield AET not handled on emergency unlock

**Status: Acknowledged — design intentionally retains forfeited AET in the
controller; cash-out path tracked as follow-up.**

In `GuaranteedYieldLocking`, AET is held by the controller resource account
for the entire lifetime of a position. On emergency unlock
(`request_emergency_unlock_guaranteed`,
`GuaranteedYieldLocking.move:683-760`), only `base_payout` worth of AET is
burned via `MoneyFiBridge::request`:

```move
let base_payout =
    if (current_value < principal) { current_value } else { principal };
// ...
MoneyFiBridge::request(&controller_signer, base_payout, share_price);
```

The AET corresponding to the forfeited yield (the difference between
`current_value` and `base_payout`) remains in the controller's wallet.

This is a deliberate design decision rather than RFC-002 §8.4 Option A (burn).
We chose to retain the AET as protocol equity instead of burning, because:

- The principal corresponding to the residual AET stays in the MoneyFi vault
  and continues earning yield.
- It can be drawn down deliberately by an admin function that converts it
  back to underlying via the same two-phase flow used by user positions.
- It gives the protocol explicit accounting of the cashback risk it has
  absorbed across all positions.

**Open follow-up:** the `audit-01` branch does not yet expose an admin entry
point that withdraws this controller-owned AET. We are tracking this as a
separate PR. Until that lands, the residual AET is locked but **not at risk** —
no user can claim it (they have no signer authority over the resource
account), and the underlying value continues compounding inside MoneyFi.

---

### H-03 — Share price hard-aborts when vault is underwater

**Status: Acknowledged — kept as a centralized hard abort, with the underwater
condition handled explicitly.**

We accept the auditor's underlying point: the original
`assert!(total_value >= withdrawed_amount, ...)` was an implicit check that
made the failure mode hard to reason about. We considered the
graceful-degradation approach (return `0` when underwater) but rejected it
because returning a `0` share price creates worse failure modes downstream:

- `deposit_fungible` would div-by-zero before its own `share_price > 0` guard
  catches it (the guard runs first, but the resulting error is still a
  generic `ELPMINT_FAILED` rather than the actual root cause).
- `request_emergency_unlock_guaranteed` in `GuaranteedYieldLocking` (L710)
  would compute `current_value = aet_amount * 0 = 0`, skip the
  `MoneyFiBridge::request` call entirely, store a zero-payout `PendingUnlock`,
  and **remove the user's position with no withdrawal**. This is silent fund
  loss — strictly worse than a deadlock.

Instead, we kept the abort but moved it to the bottom of `get_share_price`
so the underwater branch is computed explicitly and the abort fires on the
true invariant (`price > 0`) rather than a proxy:

```move
// contracts/bridge/sources/moneyfi_adapter.move
let withdrawed_amount = (requested_amount as u128);

let remaining_amount = if (total_value >= withdrawed_amount) {
    total_value - withdrawed_amount
} else { 0 };

let price = (remaining_amount * AET_SCALE) / current_supply;

// Centralized guard: every dependant of share price aborts cleanly when
// the vault is underwater. This blocks deposits and withdrawal requests
// through the bridge AND every contract that calls `get_lp_price()`,
// including `GuaranteedYieldLocking`. Settling already-pending
// withdrawals via `withdraw_fungible` is unaffected (it doesn't read
// share price), so funds in flight can still complete.
assert!(price > 0, EINSUFFICIENT_AMOUNTS_TO_WITHDRAW);

price
```

Behavioral notes:

- When the vault is solvent, behavior is unchanged.
- When the vault is underwater, every share-price-dependent path aborts
  cleanly with `EINSUFFICIENT_AMOUNTS_TO_WITHDRAW` from a single, audited
  call site. New deposits are blocked, new withdrawal requests are blocked,
  and `GuaranteedYieldLocking`'s deposit / unlock / emergency-unlock paths
  inherit the same abort by virtue of calling `get_lp_price()`.
- Already-pending withdrawals can still settle through `withdraw_fungible`,
  which never reads share price, so funds already in flight complete
  normally.
- The "deadlock during a loss event" tradeoff is accepted as the lesser
  evil compared to silent fund loss. If MoneyFi's vault enters a sustained
  underwater state, the recovery path is operational (vault rebases or
  admin intervention on the MoneyFi side), not in-protocol.

We retained `vault::estimate_total_fund_value` rather than switching to AEWT
supply (the auditor's preferred fix from RFC-001 §4.1). The reason: AEWT
supply alone does not capture vault-side rebases or losses, and the
total-fund-value path is the source of truth that MoneyFi's audited
contracts publish for this purpose.

---

### H-04 — Two-phase withdrawal collapsed into single transaction

**Status: Fixed by removal + GuaranteedYield design.**

The vulnerable `locking.move` has been deleted. `GuaranteedYieldLocking`
implements the two-phase withdrawal pattern correctly across all exit paths:

| Exit type | Phase 1 (request) | Phase 2 (withdraw) |
|-----------|-------------------|--------------------|
| Matured unlock | `request_unlock_guaranteed` (L500) | `withdraw_guaranteed` (L574) |
| Emergency unlock | `request_emergency_unlock_guaranteed` (L683) | `withdraw_emergency_guaranteed` (L765) |

Both pairs are separate `public entry fun`s, with a `PendingUnlock` struct
(L180-191) persisted between calls so the off-chain confirmation step can
run before phase 2 executes. The `MoneyFiBridge::request` call in phase 1
and the `MoneyFiBridge::withdraw` call in phase 2 are in separate
transactions, matching RFC-001 §4.3.

---

### L-01 — Zero-AET minting can create irrecoverable positions

**Status: Fixed at the bridge layer; not reachable in `GuaranteedYieldLocking`.**

A non-zero AET guard has been added to
`moneyfi_adapter::deposit_fungible`, which is the single source of AET
minting for any consumer of the bridge:

```move
// contracts/bridge/sources/moneyfi_adapter.move:160-161
let lp_amount = (((amount as u128) * AET_SCALE) / share_price) as u64;
assert!(lp_amount > 0, ELPMINT_FAILED);
```

This blocks the dust-deposit path at the bridge level, which means any
present or future contract that deposits via `MoneyFiBridge::deposit`
inherits the protection — including `GuaranteedYieldLocking`.

In addition, `GuaranteedYieldLocking` already enforces RFC-002 §12.4's
recommended mitigation independently:

- `min_deposit_amount: u64` field on `GuaranteedYieldConfig`
  (`GuaranteedYieldLocking.move:141`)
- `DEFAULT_MIN_DEPOSIT = 1_000_000` (1 USDT at 6 decimals,
  `GuaranteedYieldLocking.move:51`)
- Enforced at `deposit_guaranteed` L367:
  `assert!(amount >= config.min_deposit_amount, EBELOW_MINIMUM_DEPOSIT)`
- Adjustable via `set_min_deposit` admin entry (L995)

The combination of these guards makes the dust path unreachable via the
intended deposit flow and aborted at the lowest layer if attempted via any
other path.

## Lessons Learnt

- Abandoned code paths must be removed from the audit scope, not merely
  marked as deprecated. We will keep the repo's deployable surface area
  in lockstep with the contracts we actually intend to ship.
- "Trust the upstream" is not a substitute for graceful failure modes when
  the upstream's outputs feed into protocol-critical assertions. We will
  audit other call sites that follow the same `assert!`-on-external-data
  pattern in a follow-up sweep.
- Defensive guards belong at the lowest layer where the invariant is
  meaningful. The L-01 mint guard sits in `moneyfi_adapter`, not in each
  consumer, so future contracts inherit the protection by default.
