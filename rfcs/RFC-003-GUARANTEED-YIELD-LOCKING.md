# RFC-003: Guaranteed Yield Locking System

| Field | Value |
|-------|-------|
| **Status** | Implementation |
| **Created** | 2026-02-04 |
| **Authors** | APTree Labs |
| **Depends On** | RFC-001 |

---

## 1. Overview

### 1.1 Concept

GuaranteedYieldLocking is a fixed-rate yield product where users receive their guaranteed yield **upfront** as instant cashback when they deposit, rather than waiting until maturity.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    GUARANTEED YIELD FLOW                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  USER DEPOSITS 1000 USDT (6-month lock, 2.5% guaranteed)            │
│                                                                     │
│  INSTANTLY:                                                         │
│    → User receives 25 USDT cashback (2.5% of 1000)                 │
│    → Cashback comes from prefunded Protocol Vault                   │
│                                                                     │
│  BEHIND THE SCENES:                                                 │
│    → Contract deposits 1000 USDT into MoneyFi                       │
│    → Contract receives AET tokens                                   │
│    → Contract holds AET tokens                                      │
│                                                                     │
│  AFTER 6 MONTHS (user unlocks):                                     │
│    → User receives 1000 USDT (principal only)                       │
│    → Contract redeems AET from MoneyFi                              │
│    → Actual yield (e.g., 60 USDT if 6% actual) → Protocol Treasury │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Value Proposition

**For Users**:
- Guaranteed fixed yield (no market risk)
- Yield received INSTANTLY (immediate gratification)
- Principal guaranteed at maturity

**For Protocol**:
- Captures spread between actual MoneyFi yield and guaranteed rate
- If MoneyFi yields 12% and guaranteed is 5%, protocol keeps 7%
- Builds TVL and user trust

### 1.3 Risk Model

| Scenario | Actual Yield | Guaranteed | Protocol P/L |
|----------|--------------|------------|--------------|
| Bull market | 15% | 5% | +10% profit |
| Normal | 10% | 5% | +5% profit |
| Break-even | 5% | 5% | 0 |
| Bear market | 2% | 5% | -3% loss |
| Crash | -10% | 5% | -15% loss |

Protocol takes all the risk; users are protected.

---

## 2. Lock Tiers

```
┌─────────────────────────────────────────────────────────────────────┐
│                      GUARANTEED YIELD TIERS                         │
├──────────────┬──────────────┬───────────────────────────────────────┤
│    Tier      │   Duration   │   Guaranteed Yield (APY equivalent)   │
├──────────────┼──────────────┼───────────────────────────────────────┤
│   STARTER    │   1 month    │       0.4%                            │
├──────────────┼──────────────┼───────────────────────────────────────┤
│   BRONZE     │   3 months   │       1.25%                           │
├──────────────┼──────────────┼───────────────────────────────────────┤
│   SILVER     │   6 months   │       2.5%                            │
├──────────────┼──────────────┼───────────────────────────────────────┤
│   GOLD       │   12 months  │       5.0%                            │
└──────────────┴──────────────┴───────────────────────────────────────┘

Note: Yields are updatable by admin for new deposits.
```

### 2.1 Tier Configuration

```move
/// Lock tier enumeration
const TIER_STARTER: u8 = 1;  // 1 month
const TIER_BRONZE: u8 = 2;   // 3 months
const TIER_SILVER: u8 = 3;   // 6 months
const TIER_GOLD: u8 = 4;     // 12 months

/// Duration in seconds
const DURATION_STARTER: u64 = 2_592_000;   // 30 days
const DURATION_BRONZE: u64 = 7_776_000;    // 90 days
const DURATION_SILVER: u64 = 15_552_000;   // 180 days
const DURATION_GOLD: u64 = 31_536_000;     // 365 days

/// Guaranteed yield in basis points (updatable)
/// 40 bps = 0.4%, 125 bps = 1.25%, 250 bps = 2.5%, 500 bps = 5%
const DEFAULT_YIELD_STARTER_BPS: u64 = 40;
const DEFAULT_YIELD_BRONZE_BPS: u64 = 125;
const DEFAULT_YIELD_SILVER_BPS: u64 = 250;
const DEFAULT_YIELD_GOLD_BPS: u64 = 500;
```

---

## 3. Architecture

### 3.1 Accounts & Roles

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ACCOUNT STRUCTURE                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    PROTOCOL VAULT                             │  │
│  │  (Prefunded with USDT for instant cashback)                   │  │
│  │                                                               │  │
│  │  - Holds USDT for cashback payments                          │  │
│  │  - Must be topped up by protocol team                        │  │
│  │  - Emits warning when balance low                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    CONTRACT VAULT                             │  │
│  │  (Holds AET tokens from MoneyFi deposits)                     │  │
│  │                                                               │  │
│  │  - Receives user deposits                                     │  │
│  │  - Deposits to MoneyFi, holds AET                            │  │
│  │  - Redeems AET when users unlock                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   TREASURY WALLET                             │  │
│  │  (Receives actual yield profit)                               │  │
│  │                                                               │  │
│  │  - Configurable address                                       │  │
│  │  - Receives: actual_yield - guaranteed_yield                 │  │
│  │  - Can be multisig or DAO controlled                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 State Structures

```move
/// Configuration for the guaranteed yield system
struct GuaranteedYieldConfig has key {
    /// Signer capability for contract operations
    signer_cap: SignerCapability,

    /// Address of the prefunded vault (for cashback)
    cashback_vault: address,

    /// Address of the treasury (receives actual yield)
    treasury: address,

    /// Admin address
    admin: address,

    /// Guaranteed yields per tier in basis points
    /// Index: [0=unused, 1=starter, 2=bronze, 3=silver, 4=gold]
    tier_yields_bps: vector<u64>,

    /// Tier durations in seconds
    tier_durations: vector<u64>,

    /// Whether new deposits are enabled
    deposits_enabled: bool,

    /// Total principal locked across all users
    total_locked_principal: u64,

    /// Total AET tokens held by contract
    total_aet_held: u64,

    /// Total cashback paid out
    total_cashback_paid: u64,

    /// Total yield sent to treasury
    total_yield_to_treasury: u64,

    /// Pending admin for two-step transfer
    pending_admin: Option<address>,

    /// Maximum total locked principal (0 = unlimited, circuit breaker)
    max_total_locked_principal: u64,

    /// Minimum deposit amount
    min_deposit_amount: u64,
}

/// Individual lock position
struct GuaranteedLockPosition has store, drop, copy {
    /// Unique position identifier
    position_id: u64,

    /// Lock tier
    tier: u8,

    /// Principal amount locked (what user deposited)
    principal: u64,

    /// AET tokens held for this position
    aet_amount: u64,

    /// Cashback amount that was paid to user
    cashback_paid: u64,

    /// Guaranteed yield rate at time of deposit (in bps)
    guaranteed_yield_bps: u64,

    /// Timestamp when position was created
    created_at: u64,

    /// Timestamp when position unlocks
    unlock_at: u64,
}

/// User's collection of guaranteed yield positions
struct UserGuaranteedPositions has key {
    positions: vector<GuaranteedLockPosition>,
    next_position_id: u64,
}
```

---

## 4. User Flow

### 4.1 Deposit Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│         deposit_guaranteed(amount, tier, min_aet_received)          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Validate amount > 0, tier is valid, amount >= min_deposit       │
│                                                                     │
│  2. Circuit breaker: check total_locked + amount <= max_total       │
│                                                                     │
│  3. Calculate cashback (u128 intermediate to prevent overflow):     │
│     cashback = u128(amount) * u128(tier_yield_bps) / 10000          │
│                                                                     │
│  4. Verify cashback vault has sufficient balance                    │
│                                                                     │
│  5. Calculate expected AET, slippage check if min_aet > 0           │
│                                                                     │
│  6. Verify user balance >= amount                                   │
│                                                                     │
│  7. Transfer principal (amount) from user to contract               │
│                                                                     │
│  8. Transfer cashback from cashback_vault to user                   │
│     (INSTANT YIELD PAYMENT)                                         │
│                                                                     │
│  9. Contract deposits amount into MoneyFi                           │
│     → Receives AET tokens                                           │
│                                                                     │
│  10. Check max_positions_per_user (50), create position:            │
│      - principal = amount, aet_amount, cashback_paid, unlock_at     │
│                                                                     │
│  11. Emit GuaranteedDeposit event                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Unlock Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│              unlock_guaranteed(position_id)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Validate position exists and is owned by caller                 │
│                                                                     │
│  2. Validate current_time >= unlock_at                              │
│                                                                     │
│  3. Redeem AET from MoneyFi:                                        │
│     → Request withdrawal for current value                          │
│     → Complete withdrawal                                           │
│     → Receive USDT (principal + actual_yield)                       │
│                                                                     │
│  4. Calculate actual yield:                                         │
│     actual_yield = withdrawn_amount - principal                     │
│                                                                     │
│  5. Send principal to user                                          │
│                                                                     │
│  6. Send actual_yield to treasury                                   │
│     (Protocol keeps all actual yield since user got guaranteed)     │
│                                                                     │
│  7. Delete position                                                 │
│                                                                     │
│  8. Emit GuaranteedUnlock event                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3 Emergency Unlock Flow (with Cashback Clawback)

```
┌─────────────────────────────────────────────────────────────────────┐
│         emergency_unlock_guaranteed(position_id)                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Validate position exists and is NOT expired                     │
│     (if expired, use unlock_guaranteed instead)                     │
│                                                                     │
│  2. Calculate current AET value at share price                      │
│                                                                     │
│  3. base_payout = MIN(principal, current_value)                     │
│     - Caps at principal (protocol keeps all yield above principal)  │
│                                                                     │
│  4. Clawback cashback: payout = MAX(0, base_payout - cashback_paid) │
│     - Protocol deducts the upfront cashback from user's payout      │
│     - If base_payout < cashback: user gets 0, protocol recovers    │
│       only what's available                                         │
│                                                                     │
│  5. Withdraw base_payout from MoneyFi                               │
│     (forfeited yield above principal stays in pool)                 │
│                                                                     │
│  6. Transfer payout to user                                         │
│  7. Transfer (base_payout - payout) to treasury (cashback recovery) │
│                                                                     │
│  8. Delete position, update global stats                            │
│                                                                     │
│  9. Emit GuaranteedEmergencyUnlock event                            │
│                                                                     │
│  EXAMPLES:                                                          │
│   cv=1200, p=1000, cb=50: payout=950, treasury=50, yield stays=200  │
│   cv=1000, p=1000, cb=50: payout=950, treasury=50                   │
│   cv=900,  p=1000, cb=50: payout=850, treasury=50                   │
│   cv=30,   p=1000, cb=50: payout=0,   treasury=30 (partial)         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.4 Example Walkthrough

```
USER ACTION: Deposit 1000 USDT with SILVER tier (6 months, 2.5%)

INSTANT:
  ├─ User sends: 1000 USDT
  ├─ User receives: 25 USDT cashback (2.5% of 1000)
  ├─ Net user position: -975 USDT (1000 deposited - 25 received)
  └─ User has guaranteed 2.5% return

BEHIND SCENES:
  ├─ Contract deposits 1000 USDT to MoneyFi
  ├─ Contract receives ~909 AET (at price 1.1)
  └─ Position created with unlock in 6 months

AFTER 6 MONTHS (assuming MoneyFi earned 6%):
  ├─ Position value: 1060 USDT (1000 + 6% yield)
  ├─ Contract redeems AET from MoneyFi
  ├─ User receives: 1000 USDT (principal)
  ├─ Treasury receives: 60 USDT (actual yield)
  └─ Protocol profit: 60 - 25 = 35 USDT (3.5%)

USER'S PERSPECTIVE:
  ├─ Deposited: 1000 USDT
  ├─ Received cashback: 25 USDT (instant)
  ├─ Received at unlock: 1000 USDT
  └─ Total received: 1025 USDT = 2.5% guaranteed return ✓
```

---

## 5. Edge Cases

### 5.1 MoneyFi Underperforms (Actual < Guaranteed)

```
Scenario: User deposits 1000, guaranteed 5%, MoneyFi returns 2%

DEPOSIT:
  User receives: 50 USDT cashback (5%)

UNLOCK:
  MoneyFi returns: 1020 USDT (2% actual yield)
  User receives: 1000 USDT (principal)
  Treasury receives: 20 USDT (actual yield)

PROTOCOL LOSS: 50 (cashback paid) - 20 (actual yield) = 30 USDT loss

This is the risk the protocol takes.
```

### 5.2 MoneyFi Has Negative Yield

```
Scenario: User deposits 1000, guaranteed 5%, MoneyFi returns -10%

DEPOSIT:
  User receives: 50 USDT cashback (5%)

UNLOCK:
  MoneyFi returns: 900 USDT (-10% loss)
  User receives: 900 USDT (only what's available)
  Treasury receives: 0 USDT

USER LOSS: Principal is NOT guaranteed in catastrophic scenarios
PROTOCOL LOSS: 50 USDT (cashback paid) + reputation

NOTE: May want to add principal protection from a reserve fund.
```

### 5.3 Cashback Vault Insufficient

```
If cashback_vault doesn't have enough USDT:
  → Transaction reverts
  → User cannot deposit
  → Admin must refill vault

Mitigation:
  → Emit warning events when vault balance < threshold
  → Admin dashboard monitoring
```

---

## 6. Security Considerations

### 6.1 Cashback Vault Draining

**Risk**: Malicious deposits to drain the cashback vault.

**Mitigation**:
- Per-user deposit limits (optional)
- Per-tier total limits (optional)
- Circuit breaker if vault drops below threshold

### 6.2 Rate Manipulation

**Risk**: Admin changes rates maliciously.

**Mitigation**:
- Rate changes only affect NEW deposits
- Existing positions locked at their original rate
- Consider timelock for rate changes

### 6.3 Principal Loss Scenario

**Risk**: MoneyFi has significant losses, user can't get principal.

**Mitigation Options**:
- Insurance fund (reserve some protocol profits)
- Cap total deposits relative to protocol reserves
- Clear disclosure to users

---

## 7. Admin Functions

```move
/// Update guaranteed yield for a tier (only affects new deposits)
public entry fun set_tier_yield(admin: &signer, tier: u8, new_yield_bps: u64)

/// Update treasury address (rejects zero address)
public entry fun set_treasury(admin: &signer, new_treasury: address)

/// Enable/disable new deposits
public entry fun set_deposits_enabled(admin: &signer, enabled: bool)

/// Withdraw from cashback vault (admin emergency)
public entry fun admin_withdraw_cashback_vault(admin: &signer, amount: u64)

/// Deposit to cashback vault (anyone can top up)
public entry fun fund_cashback_vault(funder: &signer, amount: u64)

/// Propose a new admin (two-step transfer, replaces set_admin)
public entry fun propose_admin(admin: &signer, new_admin: address)

/// Accept admin role (must be called by proposed admin)
public entry fun accept_admin(new_admin: &signer)

/// Set maximum total locked principal (circuit breaker, 0 = unlimited)
public entry fun set_max_total_locked(admin: &signer, new_max: u64)

/// Set minimum deposit amount
public entry fun set_min_deposit(admin: &signer, new_min: u64)
```

---

## 8. Events

```move
#[event]
struct GuaranteedDeposit has drop, store {
    user: address,
    position_id: u64,
    tier: u8,
    principal: u64,
    cashback_paid: u64,
    guaranteed_yield_bps: u64,
    aet_received: u64,
    unlock_timestamp: u64,
    timestamp: u64,
}

#[event]
struct GuaranteedUnlock has drop, store {
    user: address,
    position_id: u64,
    principal_returned: u64,
    actual_yield_generated: u64,
    yield_to_treasury: u64,
    original_cashback_paid: u64,
    protocol_profit_or_loss: u64,  // |actual_yield - cashback_paid|
    is_profit: bool,               // true if actual >= cashback
    timestamp: u64,
}

#[event]
struct CashbackVaultFunded has drop, store {
    funder: address,
    amount: u64,
    new_balance: u64,
    timestamp: u64,
}

#[event]
struct CashbackVaultLow has drop, store {
    current_balance: u64,
    threshold: u64,
    timestamp: u64,
}

#[event]
struct TierYieldUpdated has drop, store {
    tier: u8,
    old_yield_bps: u64,
    new_yield_bps: u64,
    timestamp: u64,
}

#[event]
struct GuaranteedEmergencyUnlock has drop, store {
    user: address,
    position_id: u64,
    principal_returned: u64,     // After cashback clawback
    yield_forfeited: u64,        // Yield above principal (stays in pool)
    loss_absorbed: u64,          // Loss below principal
    original_cashback_paid: u64, // Cashback paid at deposit
    cashback_clawed_back: u64,   // Amount of cashback recovered
    to_treasury: u64,            // Total sent to treasury
    aet_burned: u64,
    time_remaining_seconds: u64,
    timestamp: u64,
}

#[event]
struct ConfigValueUpdated has drop, store {
    field: u8,        // 1 = max_total_locked, 2 = min_deposit
    old_value: u64,
    new_value: u64,
    timestamp: u64,
}

#[event]
struct AdminProposed has drop, store {
    current_admin: address,
    proposed_admin: address,
    timestamp: u64,
}

#[event]
struct AdminTransferred has drop, store {
    old_admin: address,
    new_admin: address,
    timestamp: u64,
}

#[event]
struct TreasuryUpdated has drop, store {
    old_treasury: address,
    new_treasury: address,
    timestamp: u64,
}

#[event]
struct DepositsToggled has drop, store {
    enabled: bool,
    timestamp: u64,
}
```

---

## 9. View Functions

```move
#[view]
public fun get_user_guaranteed_positions(user: address): vector<GuaranteedLockPosition>

#[view]
public fun get_guaranteed_position(user: address, position_id: u64): GuaranteedLockPosition

#[view]
public fun get_tier_guaranteed_yield(tier: u8): u64  // Returns bps

#[view]
public fun get_tier_duration(tier: u8): u64  // Returns seconds

#[view]
public fun calculate_cashback(amount: u64, tier: u8): u64

#[view]
public fun get_cashback_vault_balance(): u64

#[view]
public fun get_protocol_stats(): (u64, u64, u64, u64)
// (total_locked, total_aet, total_cashback_paid, total_yield_to_treasury)

#[view]
public fun is_position_unlockable(user: address, position_id: u64): bool

#[view]
public fun get_emergency_unlock_preview(user: address, position_id: u64): (u64, u64, u64)
// (user_payout, yield_forfeited, cashback_clawback)

#[view]
public fun get_max_total_locked(): u64  // 0 = unlimited

#[view]
public fun get_min_deposit(): u64
```

---

## 10. Public Interface Summary

### Entry Functions

| Function | Description |
|----------|-------------|
| `deposit_guaranteed(amount, tier, min_aet)` | Lock funds, receive instant cashback (min_aet=0 to skip slippage check) |
| `unlock_guaranteed(position_id)` | Unlock after maturity, receive principal |
| `emergency_unlock_guaranteed(position_id)` | Emergency early exit, cashback clawed back, yield forfeited |
| `fund_cashback_vault(amount)` | Top up the cashback vault |

### Admin Functions

| Function | Description |
|----------|-------------|
| `set_tier_yield(tier, bps)` | Update guaranteed yield for tier |
| `set_treasury(address)` | Update treasury address (rejects 0x0) |
| `set_deposits_enabled(bool)` | Enable/disable deposits |
| `admin_withdraw_cashback_vault(amount)` | Emergency withdraw from vault |
| `propose_admin(address)` | Propose new admin (two-step) |
| `accept_admin()` | Accept admin role (by proposed admin) |
| `set_max_total_locked(amount)` | Set circuit breaker cap (0 = unlimited) |
| `set_min_deposit(amount)` | Set minimum deposit amount |

---

## 11. Comparison with RFC-002 Locking

| Feature | RFC-002 (Time-Lock) | RFC-003 (Guaranteed Yield) |
|---------|---------------------|---------------------------|
| When user gets yield | At unlock (variable) | Instantly (fixed) |
| Yield amount | Based on actual MoneyFi | Guaranteed rate |
| Early withdrawal | Limited % allowed | Not allowed |
| Emergency unlock | Yes (forfeit yield) | Yes (forfeit yield, cashback clawed back) |
| Risk bearer | User | Protocol |
| User receives AET | Yes | No |
| Admin transfer | Single-step | Two-step (propose + accept) |
| Circuit breaker | Deposit toggle | Deposit toggle + TVL cap |
| Complexity | Higher | Lower |

---

## 12. Implementation Checklist

- [x] Add `GuaranteedYieldConfig` struct (with pending_admin, max_total_locked, min_deposit)
- [x] Add `GuaranteedLockPosition` struct
- [x] Add `UserGuaranteedPositions` resource
- [x] Implement `deposit_guaranteed()` (with circuit breaker, min deposit, max positions, slippage protection)
- [x] Implement `unlock_guaranteed()`
- [x] Implement `emergency_unlock_guaranteed()` (with cashback clawback)
- [x] Implement `fund_cashback_vault()`
- [x] Add admin functions (two-step admin transfer, set_max_total_locked, set_min_deposit)
- [x] Add view functions (including emergency_unlock_preview with clawback)
- [x] Add all events (including admin events + ConfigValueUpdated)
- [x] Treasury address validation (rejects zero address)
- [x] Arithmetic overflow protection (u128 intermediate for cashback)
- [x] Balance check before transfer (EINSUFFICIENT_BALANCE)
- [x] Slippage protection on deposit (min_aet_received param)
- [x] Write unit tests (43 tests passing)
- [x] MockVault/MoneyFi switching documentation in Move.toml
- [ ] Write integration tests (deposit → unlock end-to-end)
- [ ] External security audit
- [ ] Switch from MockMoneyFiVault to real MoneyFi integration (address TBD)

---

## Appendix A: Yield Calculation Examples

### A.1 Cashback Calculation

```
amount = 1000 USDT
tier = SILVER (2.5% = 250 bps)

cashback = amount * tier_yield_bps / 10000
         = 1000 * 250 / 10000
         = 25 USDT
```

### A.2 Protocol P/L Calculation

```
Given:
  principal = 1000 USDT
  cashback_paid = 25 USDT (2.5%)
  actual_moneyfi_return = 1080 USDT (8% over 6 months)

actual_yield = 1080 - 1000 = 80 USDT
protocol_profit = actual_yield - cashback_paid
                = 80 - 25
                = 55 USDT profit
```

### A.3 Break-Even Analysis

```
For protocol to break even:
  actual_yield must equal cashback_paid

For GOLD tier (5% guaranteed, 12 months):
  MoneyFi must return at least 5% over 12 months

Current expected MoneyFi APY: ~12%
Expected 12-month return: ~12%
Protocol expected profit: 12% - 5% = 7%
```
