# RFC-001: APTree Earn Protocol Specification

| Field | Value |
|-------|-------|
| **Status** | Living Document |
| **Created** | 2026-02-03 |
| **Last updated** | 2026-04-11 (post audit-01) |
| **Authors** | APTree Labs |
| **Platform** | Aptos Move |
| **Audit** | [KannAudits Report 01](../audits/report-01.md) → [Response 01](../audits/response-01.md) |

---

## Abstract

APTree Earn is a yield aggregation protocol built on Aptos that enables users to deposit assets (currently USDT) into an earning vault through a bridge mechanism. The protocol issues LP tokens (AET) representing proportional ownership of the underlying vault, which generates yield through integration with MoneyFi's yield strategies.

> **Note:** RFC-002 (Time-Locked Deposits) was superseded by [RFC-003](./RFC-003-GUARANTEED-YIELD-LOCKING.md) and removed from the repo during the `audit-01` remediation. Any reference to "locking module" in this document refers to the guaranteed-yield product described in RFC-003.

---

## 1. Overview

### 1.1 Problem Statement

Users seeking yield on their assets face fragmented DeFi protocols with varying interfaces, risk profiles, and complexities. There's a need for a unified, user-friendly interface to access yield strategies while maintaining transparent accounting of user positions.

### 1.2 Solution

APTree Earn provides:
- A single entry point for yield generation
- LP tokens (AET) that track vault share value
- A two-phase withdrawal system for orderly liquidity management
- Extensible architecture for future yield provider integrations

---

## 2. Architecture

### 2.1 Module Structure

The on-chain layout uses two Move modules in the `bridge` package, plus the
`GuaranteedYieldLocking` package that consumes the bridge.

```
┌─────────────────────────────────────────────────────────────┐
│                 aptree::bridge  (bridge.move)               │
│              (User-Facing Entry Point / Router)             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  deposit()              ──►  moneyfi_adapter::deposit()     │
│  request()              ──►  moneyfi_adapter::request()     │
│  withdraw()             ──►  moneyfi_adapter::withdraw()    │
│  request_and_withdraw() ──►  abort(EOPERATION_NOT_PERMITTED)│
│                              (disabled post audit-01)       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│        aptree::moneyfi_adapter  (moneyfi_adapter.move)      │
│            (Core Bridge & Vault Interaction Logic)          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    ┌────────────────────────┐            │
│  │ BridgeState  │    │    ReserveState        │            │
│  │ - controller │    │    - mint_ref (AET)    │            │
│  │ - reserve    │    │    - burn_ref (AET)    │            │
│  └──────────────┘    │    - transfer_ref      │            │
│                      │    - token_address     │            │
│                      └────────────────────────┘            │
│                                                             │
│  ┌────────────────────────────────────────────┐            │
│  │    BridgeWithdrawalTokenState              │            │
│  │    - mint_ref (AEWT)                       │            │
│  │    - burn_ref (AEWT)                       │            │
│  │    - transfer_ref                          │            │
│  │    - token_address                         │            │
│  └────────────────────────────────────────────┘            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   MoneyFi Vault (External)                  │
│                   (Yield Generation Layer)                  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Resource Accounts

| Account | Seed | Purpose |
|---------|------|---------|
| Controller | `b"MoneyFiBridgeController"` | Stores `BridgeState`, manages protocol control |
| Reserve | `b"MoneyFiBridgeReserve"` | Stores token states, holds assets during transit |

---

## 3. Token System

### 3.1 APTree Earn Token (AET)

| Property | Value |
|----------|-------|
| Name | APTree Earn Token |
| Symbol | AET |
| Decimals | 6 |
| Purpose | LP token representing vault share ownership |

**Minting**: When a caller deposits, AET tokens are minted proportional to their
deposit relative to the current share price. AET is minted to
`address_of(user)` inside `deposit_fungible`, where `user` is the signer that
`moneyfi_adapter::deposit` was called with. For direct bridge users this is
the end user; for `GuaranteedYieldLocking` this is the contract's controller
resource account, so AET for locked positions is custodied by the contract.

**Burning**: When users (or the controller, for locked positions) request
withdrawal, AET tokens are burned from that caller's wallet.

**Dust guard (post audit-01, L-01)**: `deposit_fungible` aborts with
`ELPMINT_FAILED` if `lp_amount == 0` after integer-division rounding, so
dust deposits that would otherwise create unrecoverable zero-AET positions
are rejected at the lowest layer and every consumer inherits the
protection.

### 3.2 APTree Earn Withdrawal Token (AEWT)

| Property | Value |
|----------|-------|
| Name | APTree Earn Withdrawal Token |
| Symbol | AEWT |
| Decimals | 6 |
| Purpose | Represents pending withdrawal claims |

**Minting**: When a caller requests withdrawal, AEWT is minted to them for
the withdrawal amount.

**Burning**: When a caller completes withdrawal, AEWT is burned from them.

---

## 4. Core Mechanisms

### 4.1 Share Price Calculation

The share price determines how many AET tokens a caller receives per unit of
deposited asset.

```
remaining = max(0, total_vault_value - pending_withdrawals)
share_price = remaining * AET_SCALE / current_aet_supply
```

Where:
- `total_vault_value` = `vault::estimate_total_fund_value(reserve_address, asset)`
- `pending_withdrawals` = `wallet_account::get_withdrawal_state(wallet_id, asset).requested_amount`
  (sourced from MoneyFi's own withdrawal bookkeeping, not AEWT supply — AEWT
  supply is not authoritative because the MoneyFi vault state can diverge
  from the bridge's own mint/burn timing)
- `AET_SCALE` = 1,000,000,000 (10^9) for precision
- `current_aet_supply` = total supply of AET tokens

**Edge Case**: If `current_aet_supply == 0`, returns `AET_SCALE` (1:1 ratio
for first depositor).

**Underwater guard (post audit-01, H-03)**: After computing `price`,
`get_share_price` aborts with `EINSUFFICIENT_AMOUNTS_TO_WITHDRAW` if
`price == 0`. This is a single centralized guard that cleanly blocks every
share-price-dependent path when the vault is underwater:

- `deposit_fungible` aborts (no new deposits while underwater)
- `request_withdrawal` aborts (no new withdrawal requests while underwater)
- Every `GuaranteedYieldLocking` entry point that calls `get_lp_price()`
  inherits the same abort (deposits, matured unlocks, emergency unlocks)

Already-pending withdrawals can still settle through `withdraw_fungible`,
which does not read the share price, so funds already in flight complete
normally. The alternative (graceful degradation via returning `0`) was
rejected because a zero share price would cause
`request_emergency_unlock_guaranteed` to silently remove a position with
zero payout — strictly worse than a temporary deadlock. See
[Response 01 §H-03](../audits/response-01.md) for the full rationale.

### 4.2 Deposit Flow

```
Caller                 bridge              moneyfi_adapter           MoneyFi Vault
  │                      │                       │                         │
  │── deposit(amount) ──►│                       │                         │
  │                      │── deposit() ─────────►│                         │
  │                      │                       │── get_share_price() ───►│
  │                      │                       │◄─────── price ──────────│
  │                      │                       │                         │
  │                      │                       │── assert price > 0      │
  │                      │                       │── calculate lp_amount   │
  │                      │                       │── assert lp_amount > 0  │
  │                      │                       │                         │
  │                      │                       │── mint AET to caller    │
  │                      │                       │                         │
  │                      │                       │── transfer USDT ───────►│
  │                      │                       │   to reserve            │
  │                      │                       │                         │
  │                      │                       │── vault::deposit() ────►│
  │                      │                       │                         │
  │◄───────────────── AET tokens ────────────────│                         │
```

**LP Amount Calculation**:
```
lp_amount = (deposit_amount * AET_SCALE) / share_price
assert!(lp_amount > 0, ELPMINT_FAILED) // post audit-01 (L-01)
```

**Caller identity**: `moneyfi_adapter::deposit_fungible` mints AET to
`address_of(user)` where `user` is whichever `&signer` was passed in. For
direct bridge callers the AET lands in the end user's wallet; for
`GuaranteedYieldLocking` the caller is the controller resource account, so
the AET stays custodied by the contract for the lifetime of the locked
position.

### 4.3 Withdrawal Flow (Two-Phase)

#### Phase 1: Request Withdrawal

```
Caller                 bridge              moneyfi_adapter           MoneyFi Vault
  │                      │                       │                         │
  │── request(amount, ──►│                       │                         │
  │   min_share_price)   │                       │                         │
  │                      │── request() ─────────►│                         │
  │                      │                       │── get_share_price()     │
  │                      │                       │   (aborts if underwater)│
  │                      │                       │── verify share_price    │
  │                      │                       │   >= min_share_price    │
  │                      │                       │                         │
  │                      │                       │── calculate share_tokens│
  │                      │                       │── verify caller balance │
  │                      │                       │                         │
  │                      │                       │── burn caller's AET     │
  │                      │                       │── mint AEWT to caller   │
  │                      │                       │                         │
  │                      │                       │── vault::request_withdraw() ─►│
  │                      │                       │                         │
  │◄────────────────── AEWT tokens ──────────────│                         │
```

**Share Token Calculation**:
```
share_token_amount = (withdrawal_amount * AET_SCALE) / share_price
```

**Slippage Protection**: The `min_share_price` parameter protects users from unfavorable price movements.

#### Phase 2: Complete Withdrawal

```
Caller                 bridge              moneyfi_adapter           MoneyFi Vault
  │                      │                       │                         │
  │── withdraw(amount) ─►│                       │                         │
  │                      │── withdraw() ────────►│                         │
  │                      │                       │── burn caller's AEWT    │
  │                      │                       │                         │
  │                      │                       │── vault::withdraw_      │
  │                      │                       │   requested_amount() ──►│
  │                      │                       │◄───── USDT ─────────────│
  │                      │                       │                         │
  │                      │                       │── transfer USDT to      │
  │                      │                       │   caller                │
  │◄─────────────────── USDT tokens ─────────────│                         │
```

**Phase 2 does not read `get_share_price`**, which is what lets already-pending
withdrawals settle even while the vault is underwater and every other path
is blocked by the H-03 abort.

---

## 5. State Definitions

### 5.1 BridgeState

```move
struct BridgeState has key, store {
    controller: address,                     // Controller resource account address
    controller_capability: SignerCapability, // Signer capability for controller
    reserve: address,                        // Reserve resource account address
    reserve_capability: SignerCapability     // Signer capability for reserve
}
```

**Location**: Stored at controller resource account address.

### 5.2 ReserveState

```move
struct ReserveState has key, store {
    mint_ref: MintRef,        // AET minting capability
    burn_ref: BurnRef,        // AET burning capability
    transfer_ref: TransferRef, // AET transfer capability
    token_address: address     // AET token object address
}
```

**Location**: Stored at reserve resource account address.

### 5.3 BridgeWithdrawalTokenState

```move
struct BridgeWithdrawalTokenState has key, store {
    mint_ref: MintRef,        // AEWT minting capability
    burn_ref: BurnRef,        // AEWT burning capability
    transfer_ref: TransferRef, // AEWT transfer capability
    token_address: address     // AEWT token object address
}
```

**Location**: Stored at reserve resource account address.

---

## 6. Events

### 6.1 Deposit Event

```move
struct Deposit has drop, store {
    user: address,       // Depositor address
    amount: u64,         // Amount deposited
    token: address,      // Token address (USDT)
    share_price: u128,   // Share price at time of deposit
    timestamp: u64       // Block timestamp (microseconds)
}
```

### 6.2 RequestWithdrawal Event

```move
struct RequestWithdrawal has drop, store {
    user: address,           // User requesting withdrawal
    amount: u64,             // Withdrawal amount requested
    share_tokens_burnt: u64, // AET tokens burned
    share_price: u128,       // Share price at time of request
    token: address,          // Token address (USDT)
    timestamp: u64           // Block timestamp (microseconds)
}
```

### 6.3 Withdraw Event

```move
struct Withdraw has drop, store {
    user: address,    // User completing withdrawal
    amount: u64,      // Amount withdrawn
    token: address,   // Token address (USDT)
    timestamp: u64    // Block timestamp (microseconds)
}
```

---

## 7. Error Codes

### 7.1 `moneyfi_adapter`

| Code | Constant | Description |
|------|----------|-------------|
| 101 | `ECLAIMS_DO_NOT_EXIST` | No withdrawal claims exist |
| 102 | `ECLAIMS_ARE_LESS` | Withdrawal claims insufficient |
| 103 | `ELPMINT_FAILED` | LP token minting failed (share price 0 on deposit, or `lp_amount == 0` after rounding — post audit-01 L-01 guard) |
| 104 | `ELP_WITHDRAWL_FAILED` | LP withdrawal failed (share price = 0) |
| 105 | `ELP_AMOUNT_INSUFFICIENT` | Caller has insufficient AET balance |
| 106 | `ESLIPPAGE_TOO_HIGH` | Share price below minimum specified |
| 107 | `ELP_AMOUNT_DOES_NOT_EXIST` | LP amount is zero |
| 108 | `EINSUFFICIENT_AMOUNTS_TO_WITHDRAW` | Vault underwater — `get_share_price` would return 0 (post audit-01 H-03 centralized guard) |

### 7.2 `bridge`

| Code | Constant | Description |
|------|----------|-------------|
| 001 | `EUNSUPPORTED_PROVIDER` | Provider not supported (reserved for future use) |
| 002 | `EOPERATION_NOT_PERMITTED` | Entry point is disabled (e.g. `request_and_withdraw` post audit-01 H-01) |

---

## 8. Public Interface

### 8.1 Entry Functions

#### `aptree::bridge` module

```move
public entry fun deposit(user: &signer, amount: u64, _provider: u64)
```
Deposits `amount` of USDT. `_provider` parameter reserved for future
multi-provider support.

```move
public entry fun request(user: &signer, amount: u64, min_amount: u128)
```
Requests withdrawal of `amount` with slippage protection via `min_amount`.

```move
public entry fun withdraw(user: &signer, amount: u64, _provider: u64)
```
Completes withdrawal of `amount`. `_provider` parameter reserved for future
multi-provider support.

```move
public entry fun request_and_withdraw(
    _user: &signer,
    _amount: u64,
    _min_share_price: u128
)
```
**Disabled post audit-01 (H-01).** Always aborts with
`EOPERATION_NOT_PERMITTED`. The signature is preserved for ABI compatibility,
but the call is not executable. Callers should use the separate two-phase
`request` + `withdraw` flow.

#### `aptree::moneyfi_adapter` module

```move
public entry fun deposit(user: &signer, amount: u64)
public entry fun request(user: &signer, amount: u64, min_share_price: u128)
public entry fun withdraw(user: &signer, amount: u64)
```

### 8.2 View Functions

```move
#[view]
public fun get_supported_token(): address
```
Returns the supported token address (USDT).

```move
#[view]
public fun get_lp_price(): u128
```
Returns current AET share price.

```move
#[view]
public fun get_pool_estimated_value(): u64
```
Returns total estimated value in the vault.

---

## 9. Security Considerations

### 9.1 Access Control
- Module initialization restricted to admin deployer
- Resource accounts use `SignerCapability` for controlled access
- No admin functions exposed on the bridge itself post-deployment
  (`GuaranteedYieldLocking` has its own admin surface)

### 9.2 Economic Security
- Slippage protection via `min_share_price` parameter
- Share price calculation accounts for pending withdrawals
- Two-phase withdrawal prevents flash loan manipulation
- `request_and_withdraw` is disabled, so no caller can collapse the
  two-phase flow into a single transaction (post audit-01, H-01)
- Zero-AET mint guard in `deposit_fungible` rejects dust deposits that
  would otherwise create unrecoverable positions (post audit-01, L-01)

### 9.3 Trust Assumptions
- MoneyFi vault integration is trusted
- `vault::estimate_total_fund_value()` provides accurate valuations
- `wallet_account::get_withdrawal_state()` accurately reports pending
  withdrawal state
- USDT token contract operates correctly

### 9.4 Known Failure Modes
- **Underwater vault**: if `total_value < pending_withdrawals`,
  `get_share_price` aborts with `EINSUFFICIENT_AMOUNTS_TO_WITHDRAW` and
  every share-price-dependent path (deposits, withdrawal requests, all
  `GuaranteedYieldLocking` entry points) becomes temporarily unavailable.
  Already-pending withdrawals can still settle via `withdraw_fungible`.
  Recovery is operational (vault rebase or MoneyFi-side action), not
  in-protocol. This is an accepted tradeoff per audit-01 H-03 — see
  [Response 01](../audits/response-01.md) for the full rationale.

### 9.5 Audit
The `bridge` package has been audited by KannAudits. See:
- [audits/report-01.md](../audits/report-01.md) — findings report
- [audits/response-01.md](../audits/response-01.md) — per-finding response
  and remediation

The `audit-01` branch contains the full remediation set (locking module
removed, `request_and_withdraw` disabled, `lp_amount > 0` guard,
centralized underwater guard in `get_share_price`).

---

## 10. Configuration

### 10.1 Addresses (Move.toml)

```toml
[addresses]
aptree = "0x951a31b39db54a4e32af927dce9fae7aa1ad14a1bb73318405ccf6cd5d66b3be"
moneyfi_bridge_asset = "0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b"
```

The `aptree` named address is the publisher of the `bridge` package on
mainnet. The most recent mainnet publish of the pre-audit build was
[`0x6251f9...fcdb9c`](https://explorer.aptoslabs.com/txn/0x6251f9d6745c3b777e43adf223b6f3c1754374cfcf941fbadc335f7966fcdb9c?network=mainnet)
(package upgrade #8). The post-audit build on branch `audit-01` has not
yet been published.

### 10.2 Dependencies

| Dependency | Source |
|------------|--------|
| AptosFramework | `aptos-labs/aptos-framework` (mainnet) |
| MoneyFi | `MoneyFi-fund/moneyFi-smart-contract-integration` (main) — publisher `0x97c9ffc7143c5585090f9ade67d19ac95f3b3e7008ed86c73c947637e2862f56` |

---

## 11. Future Enhancements (TODO)

1. **Multi-Provider Support**: Extend beyond MoneyFi to support additional yield providers
2. **Fee Mechanism**: Implement protocol fees on deposits
3. **Zap Functions**: Enable deposits with any Aptos asset via swaps
4. **Token Icons**: Set up proper token metadata icons

---

## Appendix A: Constants

```move
const SEED: vector<u8> = b"MoneyFiBridgeController";
const RESERVE: vector<u8> = b"MoneyFiBridgeReserve";
const BRIDGE_TOKEN_NAME: vector<u8> = b"APTree Earn Token";
const BRIDGE_TOKEN_SYMBOL: vector<u8> = b"AET";
const BRIDGE_WITHDRAWAL_TOKEN_NAME: vector<u8> = b"APTree Earn Withdrawal Token";
const BRIDGE_WITHDRAWAL_TOKEN_SYMBOL: vector<u8> = b"AEWT";
const AET_SCALE: u128 = 1_000_000_000;
```

---

## Appendix B: Example Calculations

### Deposit Example

**Scenario**: User deposits 1000 USDT when share price is 1.1 × 10^9

```
share_price = 1_100_000_000
deposit_amount = 1000_00000000 (1000 USDT with 8 decimals)

lp_amount = (1000_00000000 * 1_000_000_000) / 1_100_000_000
          = 909_09090909 AET (≈ 909.09 AET)
```

### Withdrawal Request Example

**Scenario**: User requests 500 USDT when share price is 1.2 × 10^9

```
share_price = 1_200_000_000
withdrawal_amount = 500_00000000 (500 USDT with 8 decimals)

share_tokens_to_burn = (500_00000000 * 1_000_000_000) / 1_200_000_000
                     = 416_66666666 AET (≈ 416.67 AET)
```

User receives 500 AEWT and has 416.67 AET burned.
