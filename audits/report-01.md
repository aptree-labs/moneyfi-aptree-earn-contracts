# Report 01
Author: KannAudits
Website: https://kannaudits.com/
---

## [H-01] Locking module does not custody AET tokens, allowing users to bypass time-locks and extract yield meant for remaining pool participants

### Links to root cause

- `locking.move:225` — `deposit_locked` delegates to `MoneyFiBridge::deposit(user, amount)` which mints AET directly to the user's wallet with no subsequent custody transfer
- `moneyfi_adapter.move:170-173` — AET minted to `address_of(user)`, not to a locking controller
- `bridge.move:45-52` — `request_and_withdraw` is `public entry fun` with no lock-awareness check, enabling direct withdrawal bypassing all lock constraints
- `moneyfi_adapter.move:307-312` / `moneyfi_adapter.move:314-318` — `request` and `withdraw` are independently callable `public entry fun` with no lock validation

### Vulnerability details

## Finding description and impact

The locking module (`locking.move`) implements a time-locked deposit system with three tiers (Bronze/Silver/Gold) that restrict early withdrawals and enforce yield forfeiture on emergency exits. However, the module is purely a bookkeeping overlay — it records lock positions in [`UserLockPositions`](locking.move:77-82) but **never takes custody of the underlying AET tokens**.

During [`deposit_locked`](locking.move:201-263), the function calls [`MoneyFiBridge::deposit(user, amount)`](locking.move:225), which routes to [`moneyfi_adapter::deposit_fungible`](moneyfi_adapter.move:155-191). Inside `deposit_fungible`, AET is minted directly to the **user's own wallet**:

```move
// moneyfi_adapter.move:170-173
let to_wallet = primary_fungible_store::ensure_primary_store_exists(address_of(user), asset);
let fa = fungible_asset::mint(&reserve_state.mint_ref, lp_amount);
fungible_asset::deposit_with_ref(&reserve_state.transfer_ref, to_wallet, fa);
```

Since the user retains full control of their AET, they can bypass the locking module entirely by calling [`bridge::request_and_withdraw`](bridge.move:45-52) directly — a `public entry fun` that performs same-transaction request and withdrawal with no check for active lock positions:

```move
// bridge.move:45-52
public entry fun request_and_withdraw(
    user: &signer,
    amount: u64,
    min_share_price: u128
) {
    moneyfi_adapter::request(user, amount, min_share_price);
    moneyfi_adapter::withdraw(user, amount)
}
```

This breaks the core economic invariant described in RFC-002 Section 8.1: when a user emergency-unlocks, they should receive only their principal (`MIN(principal, current_value)`), and the forfeited yield should remain in the pool to benefit remaining users. By bypassing the lock, the user extracts their **full position value including yield**.

**Concrete example:**
- User deposits 1,000 USDT into a GOLD lock (365 days). At share price 1.0, they receive 1,000 AET — held in their own wallet.
- After time passes, share price rises to 1.1. The 1,000 AET is now worth 1,100 USDT.
- **Intended path** (`emergency_unlock`): user receives 1,000 USDT (principal); 100 USDT stays in pool for other users.
- **Bypass path** (`request_and_withdraw`): user receives 1,100 USDT; pool retains nothing.
- **Net harm to pool**: 100 USDT of yield that remaining participants were entitled to is extracted.

Additionally, the bypassed user's `LockPosition` persists as a ghost entry with a stale `aet_amount` — subsequent calls to `withdraw_unlocked` or `emergency_unlock` through the locking module will revert when attempting to burn AET the user no longer holds.

The impact extends beyond individual yield theft:
- The tier-based early withdrawal caps (2%/3%/5%) are entirely unenforceable
- The protocol's liquidity predictability assumption (RFC-002 Section 1.1) is broken since locked funds can be withdrawn at any time
- The solvency model predicated on `early_withdrawal_limit < expected_yield` (RFC-002 Section 1.3) is undermined

## Recommended mitigation steps

Transfer AET custody to the locking module's resource account during `deposit_locked`, and release it only through the locking module's withdrawal functions:

1. **Custody on deposit** — after `MoneyFiBridge::deposit` mints AET to the user, immediately transfer it to the locking controller:

```move
// In deposit_locked, after MoneyFiBridge::deposit(user, amount):
let config = borrow_global<LockConfig>(get_config_address());
let controller_signer = account::create_signer_with_capability(&config.signer_cap);
let aet_metadata = MoneyFiBridge::get_aet_metadata();
primary_fungible_store::transfer(user, aet_metadata, address_of(&controller_signer), aet_amount);
```

2. **Release on withdrawal** — in `withdraw_early`, `withdraw_unlocked`, and `emergency_unlock`, transfer the required AET back to the user before calling `MoneyFiBridge::request`/`withdraw`:

```move
// Transfer AET from locking controller to user for bridge withdrawal
let controller_signer = account::create_signer_with_capability(&config.signer_cap);
let aet_metadata = MoneyFiBridge::get_aet_metadata();
primary_fungible_store::transfer(
    &controller_signer, aet_metadata, user_addr, aet_to_burn
);
// Then proceed with MoneyFiBridge::request / withdraw as before
```

This ensures users cannot interact with the bridge directly while their position is locked, enforcing the time-lock, early withdrawal caps, and yield forfeiture mechanics on-chain.

---

## [H-02] Emergency Unlock Does Not Burn Forfeited-Yield AET, Allowing Full Recovery of "Forfeited" Yield

**Severity**: High — Theft of unclaimed funds (yield)

### Links to root cause

- `contracts/locking/sources/locking.move#L496-L499` — withdrawal issued for `payout` only; no handling of excess AET
- `contracts/bridge/sources/moneyfi_adapter.move#L217-L228` — bridge burns AET proportional to withdrawal amount, not full position

### Vulnerability details

#### Finding description and impact

Per [RFC-002 §8.1](rfcs/RFC-002-TIME-LOCKED-DEPOSITS.md), `emergency_unlock` is designed so that users who break a lock early forfeit all accrued yield — receiving only their original principal while the forfeited yield remains in the pool to benefit other AET holders. The RFC §8.3 Step 6 explicitly requires handling the forfeited AET (burn, treasury, or leave in pool), with §8.4 recommending Option A (burn).

The implementation skips Step 6 entirely. When `emergency_unlock` executes, it computes `payout = min(current_value, principal)` and passes only `payout` to `MoneyFiBridge::request()`:

```move
// locking.move L496-499
MoneyFiBridge::request(user, payout, share_price);
MoneyFiBridge::withdraw(user, payout);
```

Inside `request_withdrawal`, the bridge burns AET proportional to the withdrawal amount — not the full position:

```move
// moneyfi_adapter.move L217
let share_token_amount = (((amount as u128) * AET_SCALE) / share_price) as u64;
// L226-228
fungible_asset::burn_from(&reserve_state.burn_ref, from_wallet, share_token_amount);
```

Since AET tokens are minted directly to the user's wallet on deposit (`deposit_fungible` L170-173) and the locking contract never escrows them, the excess AET representing the forfeited yield remains in the user's wallet after the position is deleted. The user then calls `moneyfi_adapter::request()` and `withdraw()` directly — both `public entry fun` with no access control — to redeem the leftover AET and recover the yield in full.

Additionally, the `EmergencyUnlock` event at L507 reports `aet_burned: aet_amount` (full position AET) when only a fraction was actually burned, making the issue undetectable via event monitoring.

**Impact**:
- Users recover 100% of yield that the protocol allocates to remaining pool participants upon emergency unlock
- Other AET holders are denied the share-price increase that forfeited yield should produce
- Misleading event emission conceals the accounting discrepancy from off-chain monitoring

#### Recommended mitigation steps

Burn the **full** `position.aet_amount` from the user's wallet rather than only the portion corresponding to `payout`. This requires adding a burn-only function to `moneyfi_adapter` that destroys AET without initiating a vault withdrawal — the underlying value stays in the vault, increasing the share price for remaining holders as intended by RFC-002 §8.4 Option A:

```move
// New function in moneyfi_adapter
public entry fun burn_aet(user: &signer, amount: u64) acquires ReserveState {
    let reserve_address = account::create_resource_address(&@aptree, RESERVE);
    let reserve_state = borrow_global<ReserveState>(reserve_address);
    let metadata = get_metadata(reserve_address);
    let from_wallet = primary_fungible_store::primary_store(address_of(user), metadata);
    fungible_asset::burn_from(&reserve_state.burn_ref, from_wallet, amount);
}
```

Then in `emergency_unlock`, burn the forfeited AET before processing the payout withdrawal:

```move
// Burn forfeited AET (yield portion) — value stays in pool
let aet_for_payout = ((payout as u128) * AET_SCALE / share_price) as u64;
let forfeited_aet = aet_amount - aet_for_payout;
MoneyFiBridge::burn_aet(user, forfeited_aet);

// Withdraw only the principal
MoneyFiBridge::request(user, payout, share_price);
MoneyFiBridge::withdraw(user, payout);
```

---

## [H-03] Share price computation uses external data source instead of AEWT supply, causing protocol-wide freeze on vault loss

**Severity**: High — Temporary freezing of funds

### Links to root cause

- `moneyfi_adapter.move:346-348` — `get_share_price` reads `requested_amount` from `wallet_account::get_withdrawal_state()` instead of using AEWT token supply as specified in RFC-001 §4.1
- `moneyfi_adapter.move:350` — hard `assert!(total_value >= withdrawed_amount, 108)` aborts when vault value drops below pending withdrawals
- `moneyfi_adapter.move:158, 202` — `deposit_fungible` and `request_withdrawal` both call `get_share_price`, blocking all new deposits and withdrawal requests
- `locking.move:215, 278, 348, 409, 462, 586, 617, 658` — 8 locking functions call `get_lp_price()`
- `GuaranteedYieldLocking.move:403, 527, 710, 1157` — 4 guaranteed-yield functions call `get_lp_price()`

### Vulnerability details

#### Finding description and impact

RFC-001 §4.1 defines the share price formula as:

```
share_price = (total_vault_value - pending_withdrawals) * AET_SCALE / current_aet_supply
```

Where `pending_withdrawals` is defined as the **total supply of AEWT tokens** — an on-chain value minted and burned by the bridge itself, fully under the protocol's control.

However, `get_share_price` ([moneyfi_adapter.move:335-358](contracts/bridge/sources/moneyfi_adapter.move#L335-L358)) deviates from the spec by reading `requested_amount` from the external MoneyFi `wallet_account` module instead:

```move
// moneyfi_adapter.move L346-348 — reads from external MoneyFi module
let (requested_amount, _available_amount, _is_successful) =
    wallet_account::get_withdrawal_state(wallet_id, asset);
let withdrawed_amount = (requested_amount as u128);

// L350 — hard abort if vault is underwater
assert!(total_value >= withdrawed_amount, EINSUFFICIENT_AMOUNTS_TO_WITHDRAW);
```

The spec-compliant approach would use AEWT supply, which is available on-chain via `get_withdrawal_metadata()` + `fungible_asset::supply()`.

This spec deviation creates two problems:

1. **Unnecessary trust dependency**: The share price — the protocol's core pricing function — depends on an external module's bookkeeping (`wallet_account`) rather than the protocol's own token supply. If AEWT supply and `requested_amount` ever diverge (different mint/burn timing, rounding, or a vault-side bug), the share price is wrong.

2. **Protocol-wide freeze on vault loss**: When the vault experiences a loss (strategy underperformance, market conditions) that pushes `estimate_total_fund_value()` below the pending `requested_amount`, the `assert!` at L350 hard-aborts. This cascades into **every function** that calls `get_share_price` / `get_lp_price` — 14 call sites across 3 contracts:
   - `deposit_fungible` (L158) — new deposits blocked
   - `request_withdrawal` (L202) — new withdrawal requests blocked
   - 8 functions in `locking.move` — all locking operations blocked
   - 4 functions in `GuaranteedYieldLocking.move` — all guaranteed-yield operations blocked

**The freeze is a deadlock with no on-chain recovery path:**

- `withdraw_fungible` (L257) does NOT call `get_share_price`, so pending withdrawals can still settle. However, settlement reduces **both** `requested_amount` and `total_value` (funds leave the vault), so it does not unblock `get_share_price`.
- Full settlement is impossible when the vault is underwater (owes more than it has).
- New deposits are blocked (call `get_share_price`), so the vault cannot recapitalize through normal operations.
- No admin recovery function exists in the contract.

Remaining LP holders' AET tokens represent real value in the vault, but every conversion path goes through `get_share_price`. Their funds are frozen until the vault value recovers externally — which is not guaranteed and has no timeline.

#### Recommended mitigation steps

Follow the RFC-001 §4.1 specification — use AEWT token supply instead of `wallet_account::get_withdrawal_state()`:

```move
fun get_share_price(asset: Object<Metadata>): u128 {
    let reserve_address = account::create_resource_address(&@aptree, RESERVE);
    let total_value = (vault::estimate_total_fund_value(reserve_address, asset) as u128);
    let metadata = get_metadata(reserve_address);
    let current_supply = *fungible_asset::supply(metadata).borrow();

    if (current_supply == 0) return AET_SCALE;

    // Use AEWT supply (in-scope, deterministic) per RFC-001 §4.1
    let withdrawal_metadata = get_withdrawal_metadata(reserve_address);
    let pending_withdrawals = (*fungible_asset::supply(withdrawal_metadata).borrow() as u128);

    // Graceful degradation instead of hard abort
    let remaining_amount = if (total_value >= pending_withdrawals) {
        total_value - pending_withdrawals
    } else {
        0 // Underwater: remaining LP holders' share price is zero until recovery
    };

    (remaining_amount * AET_SCALE) / current_supply
}
```

This fix:
1. Eliminates the external dependency on `wallet_account` for price computation
2. Replaces the hard abort with graceful degradation — share price returns 0 when underwater instead of bricking the protocol
3. Allows deposits to continue (recapitalizing the vault) even during loss events
4. Preserves correct accounting: remaining value is distributed to remaining LP holders

---

## [H-04] Locking exit functions collapse two-phase withdrawal into single transaction, causing temporary fund freeze under async vault conditions

**Severity**: High — Temporary freezing of funds

### Links to root cause

- `locking.move:387-388` — `withdraw_early` calls `MoneyFiBridge::request` then `MoneyFiBridge::withdraw` in the same transaction
- `locking.move:439-440` — `withdraw_unlocked` calls `MoneyFiBridge::request` then `MoneyFiBridge::withdraw` in the same transaction
- `locking.move:498-499` — `emergency_unlock` calls `MoneyFiBridge::request` then `MoneyFiBridge::withdraw` in the same transaction
- `moneyfi_adapter.move:242` — `request_withdrawal` calls `vault::request_withdraw` (queues withdrawal)
- `moneyfi_adapter.move:276` — `withdraw_fungible` calls `vault::withdraw_requested_amount` (requires funds to be available)
- `moneyfi_adapter.move:278-283` — transfers from reserve to user, aborts if vault has not released funds to reserve

### Vulnerability details

#### Finding description and impact

RFC-001 §4.3 defines a **two-phase withdrawal flow**: Phase 1 (`request`) queues the withdrawal and burns AET for AEWT, Phase 2 (`withdraw`) completes the withdrawal after funds become available. RFC-001 §9.2 states: *"Two-phase withdrawal prevents flash loan manipulation."* The two-phase design exists because the MoneyFi vault processes withdrawals asynchronously — funds are deployed in yield strategies and may not be immediately available.

The guaranteed-yield module correctly implements this two-phase pattern with separate entry functions:

```move
// GuaranteedYieldLocking.move — CORRECT: two separate transactions
// Step 1 (L500-569): request_unlock_guaranteed
MoneyFiBridge::request(&controller_signer, current_value, share_price); // L533
// Creates PendingUnlock struct, returns. Off-chain confirmation required (L498-499).

// Step 2 (L574-648): withdraw_guaranteed — SEPARATE TRANSACTION
MoneyFiBridge::withdraw(&controller_signer, pending.withdrawal_amount); // L594
```

The locking module collapses both phases into a single transaction across all three exit paths:

```move
// locking.move — INCORRECT: same transaction
// withdraw_early (L387-388):
MoneyFiBridge::request(user, amount, share_price);
MoneyFiBridge::withdraw(user, amount);

// withdraw_unlocked (L439-440):
MoneyFiBridge::request(user, total_value, share_price);
MoneyFiBridge::withdraw(user, total_value);

// emergency_unlock (L498-499):
MoneyFiBridge::request(user, payout, share_price);
MoneyFiBridge::withdraw(user, payout);
```

When `MoneyFiBridge::request` executes, the adapter calls `vault::request_withdraw` ([moneyfi_adapter.move:242](contracts/bridge/sources/moneyfi_adapter.move#L242)) which queues the withdrawal in MoneyFi. When `MoneyFiBridge::withdraw` immediately follows in the same transaction, the adapter calls `vault::withdraw_requested_amount` ([moneyfi_adapter.move:276](contracts/bridge/sources/moneyfi_adapter.move#L276)), which attempts to transfer the requested amount from the vault to the reserve. If the vault has not yet processed the request (funds still deployed in yield strategies), zero tokens are released to the reserve. The subsequent `primary_fungible_store::transfer(&reserve_signer, token, address_of(user), amount)` at [moneyfi_adapter.move:278-283](contracts/bridge/sources/moneyfi_adapter.move#L278-L283) then aborts due to insufficient balance.

Because Move transactions are atomic, the abort rolls back everything — AET is not burned, AEWT is not minted, and the locking position is not removed. The user's state is unchanged, but they have no way to exit through the locking module.

The locking module exposes no separate `request_*` / `withdraw_*` functions — all three exit paths use the same atomic request+withdraw pattern. Unlike the bridge module which offers both `request` ([bridge.move:31-33](contracts/bridge/sources/bridge.move#L31-L33)) and `withdraw` ([bridge.move:36-43](contracts/bridge/sources/bridge.move#L36-L43)) independently, the locking module has no fallback path.

**Impact**: When the MoneyFi vault cannot process withdrawals synchronously, all locked positions become temporarily frozen through the intended module. The only alternative exit is the custody bypass described in H-01 (calling bridge functions directly), which is itself a vulnerability. If H-01 is remediated (AET custody transferred to locking controller), this issue escalates to a complete freeze with no on-chain recovery path until the vault has sufficient idle liquidity.

#### Recommended mitigation steps

Mirror the guaranteed-yield module's two-phase pattern. Introduce a `PendingLockWithdrawal` struct and split each exit into request and withdraw functions:

```move
struct PendingLockWithdrawal has store, drop, copy {
    position_id: u64,
    withdrawal_amount: u64,
    withdrawal_type: u8, // 1=early, 2=unlocked, 3=emergency
    // Snapshot of position state at request time for accounting
    aet_to_burn: u64,
    principal_reduction: u64,
}

struct UserPendingLockWithdrawals has key {
    pending: vector<PendingLockWithdrawal>,
}
```

Split each exit function into request and withdraw:

```move
// Step 1: Request — burns AET, mints AEWT, queues vault withdrawal
public entry fun request_withdraw_unlocked(user: &signer, position_id: u64)
    acquires UserLockPositions, UserPendingLockWithdrawals {
    // ... validate position expired, calculate total_value ...
    MoneyFiBridge::request(user, total_value, share_price);
    // Store PendingLockWithdrawal, remove position
}

// Step 2: Withdraw — called after off-chain confirmation
public entry fun complete_withdraw_unlocked(user: &signer, position_id: u64)
    acquires UserPendingLockWithdrawals {
    // ... find pending withdrawal ...
    MoneyFiBridge::withdraw(user, pending.withdrawal_amount);
    // Remove pending entry, emit event
}
```

Apply the same split to `withdraw_early` and `emergency_unlock`.

---

## [L-01] Zero-AET minting creates permanently irrecoverable locking positions

**Severity**: Low — Permanent dust-level fund lock, missing spec-mandated mitigation

### Links to root cause

- `moneyfi_adapter.move:160` — `lp_amount = (amount * AET_SCALE) / share_price` truncates to 0 when `amount * AET_SCALE < share_price`
- `moneyfi_adapter.move:172` — `fungible_asset::mint(0)` succeeds (Aptos framework allows zero-amount mint)
- `moneyfi_adapter.move:176,180` — underlying transfer and `vault::deposit` execute unconditionally regardless of `lp_amount`
- `locking.move:207` — only checks `amount > 0`, not `aet_amount > 0`
- `locking.move:218` — `aet_amount` computed with same truncating formula, stored in position
- `locking.move:240-249` — `LockPosition` created with `principal > 0` and `aet_amount = 0`

### Vulnerability details

#### Finding description and impact

When a user deposits an amount smaller than `share_price / AET_SCALE` into the locking module, integer floor division truncates `aet_amount` to zero:

```move
// locking.move L218
let aet_amount = (((amount as u128) * AET_SCALE) / share_price) as u64;
```

The locking module checks `amount > 0` ([L207](locking.move#L207)) but never validates that `aet_amount > 0`. The deposit proceeds through `MoneyFiBridge::deposit` ([L225](locking.move#L225)), which executes `deposit_fungible` — transferring the underlying to the reserve ([moneyfi_adapter.move:176](moneyfi_adapter.move#L176)) and depositing into the vault ([moneyfi_adapter.move:180](moneyfi_adapter.move#L180)), while minting 0 AET ([moneyfi_adapter.move:172](moneyfi_adapter.move#L172)). The Aptos framework's `fungible_asset::mint` allows zero-amount minting (`increase_supply` [returns early on 0](contracts/mock-moneyfi/build/MockMoneyFi/sources/dependencies/AptosFramework/fungible_asset.move#L1330)).

The resulting `LockPosition` has `principal > 0` and `aet_amount = 0`. All three exit paths are permanently blocked:

| Exit path | Failure point | Reason |
|-----------|--------------|--------|
| `withdraw_unlocked` (L403) | `vault::withdraw_requested_amount` aborts at [vault.move:157](contracts/mock-moneyfi/build/MockMoneyFi/sources/vault.move#L157) | `total_value = (0 * share_price) / AET_SCALE = 0` → L439: `request(0)` succeeds (adds 0 to `pending_withdrawal`) → L440: `withdraw(0)` calls `withdraw_requested_amount` → reads `pending_withdrawal = 0` → `assert!(amount > 0)` **ABORTS** → entire tx reverts including position removal at L436 |
| `emergency_unlock` (L456) | Same abort path via L498-499 | `payout = min(0, principal) = 0` → L498: `request(0)` succeeds → L499: `withdraw(0)` → `withdraw_requested_amount` aborts on `pending_withdrawal = 0` → tx reverts including position removal at L494 |
| `withdraw_early` (L339) | `assert!(available > 0)` at L364 | `current_value = 0` → `accrued_yield = 0` → `available = 0` → assertion fails |

The key mechanism: `withdraw_unlocked` and `emergency_unlock` both perform a two-step withdrawal in a single atomic transaction — `MoneyFiBridge::request` (L439/L498) followed by `MoneyFiBridge::withdraw` (L440/L499). While `request(0)` succeeds (no zero guard in `request_withdrawal`), the subsequent `withdraw(0)` calls `vault::withdraw_requested_amount` which reads `pending_withdrawal = 0` and aborts at `assert!(amount > 0)`. Since Move transactions are atomic, the abort reverts the entire transaction including the position removal (`vector::swap_remove` at L436/L494). The position persists in `UserLockPositions` with no on-chain path to remove it.

The same rounding issue exists in the direct bridge deposit path (`moneyfi_adapter::deposit_fungible`), which also lacks an `lp_amount > 0` check.

**Missing RFC-002 §12.4 mitigation**: RFC-002 §12.4 explicitly identifies dust positions as a risk and prescribes "Minimum deposit amount per position" as the mitigation. However, `LockConfig` ([RFC-002 L141-153](rfcs/RFC-002-TIME-LOCKED-DEPOSITS.md#L141-L153)) never includes a `min_deposit_amount` field, and `deposit_locked` has no minimum deposit check — the mitigation was documented in the spec but never carried into the data structures or function signatures. The sibling contract (GuaranteedYieldLocking, built from RFC-003) correctly implements both mitigations:
1. Minimum deposit: `DEFAULT_MIN_DEPOSIT = 1_000000` ([GuaranteedYieldLocking.move:51](GuaranteedYieldLocking.move#L51)), enforced at [L367](GuaranteedYieldLocking.move#L367)
2. Slippage protection: `min_aet_received` parameter ([L357](GuaranteedYieldLocking.move#L357)), checked at [L408-410](GuaranteedYieldLocking.move#L408-L410)

**Severity rationale**: The permanently frozen amount is constrained by the formula to `amount < share_price / AET_SCALE`. At 1.5× share price, only deposits of 1 micro-unit (0.000001 USDT) trigger zero-AET minting. The issue is self-inflicted (user initiates the deposit) with no external attacker profit, keeping economic impact at dust-level.

#### Recommended mitigation steps

Add an `aet_amount > 0` assertion in `deposit_fungible` and `deposit_locked`, and implement the minimum deposit guard prescribed by RFC-002 §12.4:

```move
// moneyfi_adapter.move — after L160
let lp_amount = (((amount as u128) * AET_SCALE) / share_price) as u64;
assert!(lp_amount > 0, ELP_AMOUNT_DOES_NOT_EXIST); // error 107 already defined

// locking.move — after L218
let aet_amount = (((amount as u128) * AET_SCALE) / share_price) as u64;
assert!(aet_amount > 0, EZERO_AMOUNT);
```

Additionally, add a configurable minimum deposit amount to `LockConfig` (mirroring `GuaranteedYieldConfig.min_deposit_amount`) and a `min_aet_received` slippage parameter to `deposit_locked` (mirroring `deposit_guaranteed`).
