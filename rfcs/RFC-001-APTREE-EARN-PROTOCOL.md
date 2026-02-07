# RFC-001: APTree Earn Protocol Specification

| Field | Value |
|-------|-------|
| **Status** | Living Document |
| **Created** | 2026-02-03 |
| **Authors** | APTree Labs |
| **Platform** | Aptos Move |

---

## Abstract

APTree Earn is a yield aggregation protocol built on Aptos that enables users to deposit assets (currently USDT) into an earning vault through a bridge mechanism. The protocol issues LP tokens (AET) representing proportional ownership of the underlying vault, which generates yield through integration with MoneyFi's yield strategies.

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

```
┌─────────────────────────────────────────────────────────────┐
│                      APTreeEarn.move                        │
│              (User-Facing Entry Point / Router)             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  deposit() ──────►  MoneyFiBridge::deposit()               │
│  request() ──────►  MoneyFiBridge::request()               │
│  withdraw() ─────►  MoneyFiBridge::withdraw()              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    MoneyFiBridge.move                       │
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
| Decimals | 8 |
| Purpose | LP token representing vault share ownership |

**Minting**: When users deposit, AET tokens are minted proportional to their deposit relative to the current share price.

**Burning**: When users request withdrawal, their AET tokens are burned.

### 3.2 APTree Earn Withdrawal Token (AEWT)

| Property | Value |
|----------|-------|
| Name | APTree Earn Withdrawal Token |
| Symbol | AEWT |
| Decimals | 8 |
| Purpose | Represents pending withdrawal claims |

**Minting**: When users request withdrawal, AEWT is minted for the withdrawal amount.

**Burning**: When users complete withdrawal, AEWT is burned.

---

## 4. Core Mechanisms

### 4.1 Share Price Calculation

The share price determines how many AET tokens a user receives per unit of deposited asset.

```
share_price = (total_vault_value - pending_withdrawals) * AET_SCALE / current_aet_supply
```

Where:
- `total_vault_value` = `vault::estimate_total_fund_value()`
- `pending_withdrawals` = total supply of AEWT tokens
- `AET_SCALE` = 1,000,000,000 (10^9) for precision
- `current_aet_supply` = total supply of AET tokens

**Edge Case**: If `current_aet_supply == 0`, returns `AET_SCALE` (1:1 ratio for first depositor).

### 4.2 Deposit Flow

```
User                    APTreeEarn           MoneyFiBridge              MoneyFi Vault
  │                         │                      │                          │
  │── deposit(amount) ─────►│                      │                          │
  │                         │── deposit() ────────►│                          │
  │                         │                      │── get_share_price() ────►│
  │                         │                      │◄─────── price ───────────│
  │                         │                      │                          │
  │                         │                      │── calculate lp_amount    │
  │                         │                      │                          │
  │                         │                      │── mint AET to user       │
  │                         │                      │                          │
  │                         │                      │── transfer USDT ────────►│
  │                         │                      │   to reserve             │
  │                         │                      │                          │
  │                         │                      │── vault::deposit() ─────►│
  │                         │                      │                          │
  │◄──────────────────── AET tokens ───────────────│                          │
```

**LP Amount Calculation**:
```
lp_amount = (deposit_amount * AET_SCALE) / share_price
```

### 4.3 Withdrawal Flow (Two-Phase)

#### Phase 1: Request Withdrawal

```
User                    APTreeEarn           MoneyFiBridge              MoneyFi Vault
  │                         │                      │                          │
  │── request(amount, ─────►│                      │                          │
  │   min_share_price)      │                      │                          │
  │                         │── request() ────────►│                          │
  │                         │                      │── verify share_price     │
  │                         │                      │   >= min_share_price     │
  │                         │                      │                          │
  │                         │                      │── calculate share_tokens │
  │                         │                      │── verify user balance    │
  │                         │                      │                          │
  │                         │                      │── burn user's AET        │
  │                         │                      │── mint AEWT to user      │
  │                         │                      │                          │
  │                         │                      │── vault::request_withdraw()─►│
  │                         │                      │                          │
  │◄───────────────────── AEWT tokens ─────────────│                          │
```

**Share Token Calculation**:
```
share_token_amount = (withdrawal_amount * AET_SCALE) / share_price
```

**Slippage Protection**: The `min_share_price` parameter protects users from unfavorable price movements.

#### Phase 2: Complete Withdrawal

```
User                    APTreeEarn           MoneyFiBridge              MoneyFi Vault
  │                         │                      │                          │
  │── withdraw(amount) ────►│                      │                          │
  │                         │── withdraw() ───────►│                          │
  │                         │                      │── burn user's AEWT       │
  │                         │                      │                          │
  │                         │                      │── vault::withdraw_       │
  │                         │                      │   requested_amount() ───►│
  │                         │                      │◄───── USDT ──────────────│
  │                         │                      │                          │
  │                         │                      │── transfer USDT to user  │
  │◄──────────────────── USDT tokens ──────────────│                          │
```

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

| Code | Constant | Description |
|------|----------|-------------|
| 101 | `ECLAIMS_DO_NOT_EXIST` | No withdrawal claims exist |
| 102 | `ECLAIMS_ARE_LESS` | Withdrawal claims insufficient |
| 103 | `ELPMINT_FAILED` | LP token minting failed (share price = 0) |
| 104 | `ELP_WITHDRAWL_FAILED` | LP withdrawal failed (share price = 0) |
| 105 | `ELP_AMOUNT_INSUFFICIENT` | User has insufficient AET balance |
| 106 | `ESLIPPAGE_TOO_HIGH` | Share price below minimum specified |
| 107 | `ELP_AMOUNT_DOES_NOT_EXIST` | LP amount is zero |
| 108 | `EINSUFFICIENT_AMOUNTS_TO_WITHDRAW` | Vault value less than pending withdrawals |

---

## 8. Public Interface

### 8.1 Entry Functions

#### APTreeEarn Module

```move
public entry fun deposit(user: &signer, amount: u64, provider: u64)
```
Deposits `amount` of USDT. Provider parameter reserved for future use.

```move
public entry fun request(user: &signer, amount: u64, min_amount: u128)
```
Requests withdrawal of `amount` with slippage protection via `min_amount`.

```move
public entry fun withdraw(user: &signer, amount: u64, provider: u64)
```
Completes withdrawal of `amount`. Provider parameter reserved for future use.

#### MoneyFiBridge Module

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
- No admin functions exposed post-deployment

### 9.2 Economic Security
- Slippage protection via `min_share_price` parameter
- Share price calculation accounts for pending withdrawals
- Two-phase withdrawal prevents flash loan manipulation

### 9.3 Trust Assumptions
- MoneyFi vault integration is trusted
- `estimate_total_fund_value()` provides accurate valuations
- USDT token contract operates correctly

---

## 10. Configuration

### 10.1 Addresses (Move.toml)

```toml
[addresses]
controller = "03fffffc221e847715514efcd829f9d312f0408427d0ae9b91a99b167a9f5891"
moneyfi_bridge_asset = "0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b"
```

### 10.2 Dependencies

| Dependency | Source |
|------------|--------|
| AptosFramework | `aptos-labs/aptos-framework` (mainnet) |
| MoneyFi | `MoneyFi-fund/moneyFi-smart-contract-integration` (main) |

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
