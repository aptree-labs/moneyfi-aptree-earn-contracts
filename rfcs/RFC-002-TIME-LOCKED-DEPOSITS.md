# RFC-002: Time-Locked Deposit System Design

| Field | Value |
|-------|-------|
| **Status** | Approved |
| **Created** | 2026-02-03 |
| **Updated** | 2026-02-04 |
| **Authors** | APTree Labs |
| **Depends On** | RFC-001 |

---

## 1. Motivation

### 1.1 Problem

The current APTree Earn system allows users to deposit and withdraw freely. While this provides maximum flexibility, it creates challenges:

1. **Liquidity Unpredictability**: Sudden withdrawals can strain vault liquidity
2. **Yield Strategy Constraints**: Short-term deposits limit viable yield strategies
3. **User Behavior**: Users may panic-sell during market volatility, locking in losses

### 1.2 Goal

Implement a time-locked deposit system where:
- Users commit funds for a fixed period (3, 6, or 12 months)
- Early withdrawal is limited to a small percentage of principal (varies by tier)
- The yield generated during the lock period should cover this early withdrawal allowance
- Users can have multiple lock positions
- Additional deposits extend locks proportionally

### 1.3 Key Insight

If the vault generates X% APY over the lock period, and users can only withdraw Y% early (where Y < X), the protocol remains solvent and profitable.

---

## 2. Finalized Design Decisions

| Decision | Choice |
|----------|--------|
| Early withdrawal % | Varies by lock duration |
| Multiple locks per user | Yes |
| Lock tiers | 3, 6, 12 months |
| Additional deposits during lock | Extend lock proportionally |
| Yield boost for locking | No (may add later) |

---

## 3. Lock Tiers

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LOCK TIERS                                  │
├──────────────┬──────────────┬───────────────────┬───────────────────┤
│    Tier      │   Duration   │  Early Withdraw   │  Expected Yield   │
│              │              │      Limit        │   (Covers + X%)   │
├──────────────┼──────────────┼───────────────────┼───────────────────┤
│   BRONZE     │   3 months   │       2%          │   ~3% (3mo)       │
├──────────────┼──────────────┼───────────────────┼───────────────────┤
│   SILVER     │   6 months   │       3%          │   ~6% (6mo)       │
├──────────────┼──────────────┼───────────────────┼───────────────────┤
│   GOLD       │   12 months  │       5%          │   ~12% (12mo)     │
└──────────────┴──────────────┴───────────────────┴───────────────────┘

Note: Early withdrawal limits are suggestions. Adjust based on expected APY.
Longer locks accrue more yield, so they allow higher early withdrawal limits.
```

### 3.1 Tier Configuration

```move
/// Lock tier enumeration
const TIER_BRONZE: u8 = 1;   // 3 months
const TIER_SILVER: u8 = 2;   // 6 months
const TIER_GOLD: u8 = 3;     // 12 months

/// Duration in seconds
const DURATION_BRONZE: u64 = 7_776_000;   // 90 days
const DURATION_SILVER: u64 = 15_552_000;  // 180 days
const DURATION_GOLD: u64 = 31_536_000;    // 365 days

/// Early withdrawal limits in basis points (1 bps = 0.01%)
/// Longer locks = more yield accrued = higher early withdrawal limit
const EARLY_LIMIT_BRONZE_BPS: u64 = 200;  // 2%
const EARLY_LIMIT_SILVER_BPS: u64 = 300;  // 3%
const EARLY_LIMIT_GOLD_BPS: u64 = 500;    // 5%
```

---

## 4. Multi-Position Architecture

Users can hold multiple lock positions simultaneously. Each position is independent with its own:
- Principal amount
- Lock tier and duration
- Entry share price
- Unlock timestamp
- Early withdrawal allowance

### 4.1 State Structure

```move
/// Individual lock position
struct LockPosition has store, drop, copy {
    /// Unique position identifier
    position_id: u64,

    /// Lock tier (BRONZE=1, SILVER=2, GOLD=3)
    tier: u8,

    /// Original principal deposited (in underlying token)
    principal: u64,

    /// AET tokens held for this position
    aet_amount: u64,

    /// Share price at time of deposit (for yield calculation)
    entry_share_price: u128,

    /// Timestamp when position was created
    created_at: u64,

    /// Timestamp when position unlocks
    unlock_at: u64,

    /// Amount already withdrawn early (in underlying token value)
    early_withdrawal_used: u64,
}

/// User's collection of lock positions
struct UserLockPositions has key {
    /// All positions for this user
    positions: vector<LockPosition>,

    /// Counter for generating position IDs
    next_position_id: u64,
}

/// Global lock configuration (admin controlled)
struct LockConfig has key {
    /// Early withdrawal caps per tier (in basis points)
    tier_limits_bps: vector<u64>,  // [0, bronze, silver, gold]

    /// Tier durations in seconds
    tier_durations: vector<u64>,   // [0, bronze, silver, gold]

    /// Whether new locks are enabled
    locks_enabled: bool,

    /// Admin address for configuration changes
    admin: address,
}
```

### 4.2 Position Management

```
┌─────────────────────────────────────────────────────────────────────┐
│                    USER: 0x1234...                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Position #1 (SILVER)           Position #2 (GOLD)                  │
│  ┌─────────────────────┐        ┌─────────────────────┐            │
│  │ Principal: 1000 USDT│        │ Principal: 500 USDT │            │
│  │ AET: 909.09         │        │ AET: 450.00         │            │
│  │ Entry Price: 1.1    │        │ Entry Price: 1.11   │            │
│  │ Unlocks: Aug 2026   │        │ Unlocks: Feb 2027   │            │
│  │ Early Used: 0       │        │ Early Used: 5 USDT  │            │
│  │ Early Limit: 3%     │        │ Early Limit: 5%     │            │
│  └─────────────────────┘        └─────────────────────┘            │
│                                                                     │
│  Position #3 (BRONZE)                                               │
│  ┌─────────────────────┐                                           │
│  │ Principal: 200 USDT │                                           │
│  │ AET: 180.00         │                                           │
│  │ Entry Price: 1.11   │                                           │
│  │ Unlocks: May 2026   │                                           │
│  │ Early Used: 0       │                                           │
│  │ Early Limit: 2%     │                                           │
│  └─────────────────────┘                                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Proportional Lock Extension

When a user adds funds to an existing position, the lock is extended proportionally based on the weighted average of remaining time.

### 5.1 Extension Formula

```
new_unlock_time = now + weighted_average_remaining_time

where:
  old_remaining = unlock_at - now
  new_lock_duration = tier_duration (full duration for new deposit)

  weighted_remaining = (old_principal * old_remaining + new_deposit * new_lock_duration)
                       / (old_principal + new_deposit)

  new_unlock_at = now + weighted_remaining
```

### 5.2 Extension Example

```
Scenario:
- User has Position #1: 1000 USDT, SILVER tier, 3 months remaining
- User wants to add 500 USDT to Position #1

Calculation:
  old_principal = 1000
  old_remaining = 90 days (3 months)
  new_deposit = 500
  new_lock_duration = 180 days (full SILVER duration)

  weighted_remaining = (1000 * 90 + 500 * 180) / (1000 + 500)
                     = (90,000 + 90,000) / 1500
                     = 180,000 / 1500
                     = 120 days

Result:
- New principal: 1500 USDT
- New unlock: now + 120 days (extended from 90 to 120 days)
- Early limit recalculated on new principal
```

### 5.3 Extension Visualization

```
Before:                              After:
├────────────────────┤               ├──────────────────────────────┤
│  1000 USDT         │               │     1500 USDT                │
│  90 days remaining │               │     120 days remaining       │
├────────────────────┤               ├──────────────────────────────┤
      NOW        UNLOCK                   NOW                  UNLOCK

                   +500 USDT
                   (180 day term)
                   ─────────────►
```

### 5.4 Extension Rules

1. **Same tier only**: Can only add to positions of the same tier
2. **Entry price update**: New weighted average entry price
3. **Early withdrawal recalculated**: Based on new total principal
4. **Cannot shorten lock**: Extension always increases or maintains unlock time

```move
/// Calculate new weighted entry share price
fun calculate_weighted_entry_price(
    old_principal: u64,
    old_entry_price: u128,
    new_deposit: u64,
    current_price: u128
): u128 {
    let old_weight = (old_principal as u128) * old_entry_price;
    let new_weight = (new_deposit as u128) * current_price;
    let total_principal = (old_principal + new_deposit) as u128;

    (old_weight + new_weight) / total_principal
}
```

---

## 6. Early Withdrawal Mechanism

### 6.1 Available Amount Calculation

```move
fun calculate_early_withdrawal_available(
    position: &LockPosition,
    current_share_price: u128
): u64 {
    // Position must not be expired
    assert!(timestamp::now_seconds() < position.unlock_at, ELOCK_EXPIRED);

    // Calculate current value of position
    let current_value = (
        (position.aet_amount as u128) * current_share_price / AET_SCALE
    ) as u64;

    // Calculate accrued yield
    let accrued_yield = if (current_value > position.principal) {
        current_value - position.principal
    } else {
        0  // No yield or negative yield = no early withdrawal
    };

    // Get cap based on tier
    let cap_bps = get_tier_early_limit_bps(position.tier);
    let principal_cap = position.principal * cap_bps / 10000;

    // Available = min(yield, cap) - already used
    let limit = math::min(accrued_yield, principal_cap);

    if (limit > position.early_withdrawal_used) {
        limit - position.early_withdrawal_used
    } else {
        0
    }
}
```

### 6.2 Early Withdrawal Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    withdraw_early(position_id, amount)              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Validate position exists and is not expired                     │
│                                                                     │
│  2. Calculate available early withdrawal:                           │
│     available = MIN(accrued_yield, tier_cap%) - already_used        │
│                                                                     │
│  3. Validate: amount <= available                                   │
│                                                                     │
│  4. Calculate AET to burn:                                          │
│     aet_to_burn = amount * AET_SCALE / current_share_price          │
│                                                                     │
│  5. Update position:                                                │
│     - Reduce aet_amount by aet_to_burn                              │
│     - Increase early_withdrawal_used by amount                      │
│     - Reduce principal proportionally                               │
│                                                                     │
│  6. Execute withdrawal through existing flow                        │
│                                                                     │
│  7. Emit EarlyWithdrawal event                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.3 Principal Adjustment on Early Withdrawal

When a user withdraws early, we need to adjust the principal to maintain accurate yield calculations:

```move
// After early withdrawal of `amount`:
let withdrawal_ratio = (amount as u128) * PRECISION / (current_value as u128);
let principal_reduction = ((position.principal as u128) * withdrawal_ratio / PRECISION) as u64;

position.principal = position.principal - principal_reduction;
position.aet_amount = position.aet_amount - aet_to_burn;
position.early_withdrawal_used = position.early_withdrawal_used + amount;
```

---

## 7. Full Withdrawal (After Unlock)

### 7.1 Unlocked Withdrawal Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    withdraw_unlocked(position_id)                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Validate position exists                                        │
│                                                                     │
│  2. Validate: current_time >= unlock_at                             │
│                                                                     │
│  3. Calculate total value:                                          │
│     total = position.aet_amount * current_share_price / AET_SCALE   │
│                                                                     │
│  4. Burn all position's AET tokens                                  │
│                                                                     │
│  5. Execute withdrawal through existing request/withdraw flow       │
│                                                                     │
│  6. Delete position from user's positions vector                    │
│                                                                     │
│  7. Emit UnlockedWithdrawal event                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 8. Emergency Unlock (Early Full Withdrawal)

Users can fully unlock their position at any time, but with a trade-off to ensure the protocol doesn't lose money.

### 8.1 Principle: Forfeit Yield, Keep Principal

```
┌─────────────────────────────────────────────────────────────────────┐
│                    EMERGENCY UNLOCK RULES                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  IF vault is UP (positive yield):                                   │
│    → User receives: original principal only                         │
│    → Forfeited yield stays in pool (benefits remaining users)       │
│                                                                     │
│  IF vault is DOWN (negative yield):                                 │
│    → User receives: current value (less than principal)             │
│    → User absorbs the loss (protocol doesn't subsidize)             │
│                                                                     │
│  FORMULA:                                                           │
│    user_receives = MIN(principal, current_value)                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 Emergency Unlock Examples

**Example 1: Vault is Up**
```
Position:
  principal = 1000 USDT
  current_value = 1100 USDT (10% yield)

Emergency Unlock:
  user_receives = MIN(1000, 1100) = 1000 USDT
  forfeited_yield = 100 USDT (stays in pool)
```

**Example 2: Vault is Down**
```
Position:
  principal = 1000 USDT
  current_value = 950 USDT (-5% loss)

Emergency Unlock:
  user_receives = MIN(1000, 950) = 950 USDT
  user_loss = 50 USDT (absorbed by user, not protocol)
```

### 8.3 Emergency Unlock Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                emergency_unlock(position_id)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Validate position exists and is NOT expired                     │
│     (if expired, use withdraw_unlocked instead)                     │
│                                                                     │
│  2. Calculate current value:                                        │
│     current_value = aet_amount * share_price / AET_SCALE            │
│                                                                     │
│  3. Calculate user payout:                                          │
│     payout = MIN(position.principal, current_value)                 │
│                                                                     │
│  4. Calculate forfeited amount (if any):                            │
│     forfeited = current_value - payout  (0 if vault down)           │
│                                                                     │
│  5. Calculate AET to burn for payout:                               │
│     aet_to_burn = payout * AET_SCALE / share_price                  │
│                                                                     │
│  6. Handle forfeited AET (if vault up):                             │
│     - Option A: Burn (deflationary, benefits all AET holders)       │
│     - Option B: Transfer to protocol treasury                       │
│     - Option C: Leave in pool (increases share price for others)    │
│                                                                     │
│  7. Execute withdrawal for payout amount                            │
│                                                                     │
│  8. Delete position                                                 │
│                                                                     │
│  9. Emit EmergencyUnlock event                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.4 Forfeited Yield Handling Options

| Option | Mechanism | Effect |
|--------|-----------|--------|
| **A: Burn AET** | Burn the excess AET tokens | Deflationary; all remaining users benefit proportionally |
| **B: Treasury** | Transfer excess to protocol | Protocol revenue; can fund operations |
| **C: Leave in Pool** | Don't burn, just leave value | Same as A effectively (share price increases) |

**Recommendation**: Option A (Burn) - simplest and fairest to remaining users.

### 8.5 Implementation

```move
/// Emergency unlock - withdraw principal, forfeit yield
public entry fun emergency_unlock(
    user: &signer,
    position_id: u64
)

/// View function to preview emergency unlock payout
#[view]
public fun get_emergency_unlock_amount(
    user: address,
    position_id: u64
): (u64, u64)  // (payout, forfeited_yield)
```

```move
fun calculate_emergency_unlock(
    position: &LockPosition,
    current_share_price: u128
): (u64, u64, u64) {  // (payout, forfeited, aet_to_burn_for_payout)

    // Current value of position
    let current_value = (
        (position.aet_amount as u128) * current_share_price / AET_SCALE
    ) as u64;

    // User gets minimum of principal or current value
    let payout = math::min(position.principal, current_value);

    // Forfeited yield (0 if vault is down)
    let forfeited = if (current_value > payout) {
        current_value - payout
    } else {
        0
    };

    // AET to burn for payout
    let aet_for_payout = (
        (payout as u128) * AET_SCALE / current_share_price
    ) as u64;

    (payout, forfeited, aet_for_payout)
}
```

### 8.6 Interaction with Early Withdrawal

If user has already used some early withdrawal allowance:

```
Position after partial early withdrawal:
  original_principal = 1000 USDT
  early_withdrawn = 20 USDT
  adjusted_principal = 980 USDT (reduced proportionally)
  current_aet = reduced amount

Emergency unlock:
  payout = MIN(adjusted_principal, current_value)
```

The `principal` field is already reduced when early withdrawals happen, so emergency unlock naturally accounts for this.

---

## 9. Public Interface

### 8.1 Entry Functions

```move
/// Create a new locked deposit position
public entry fun deposit_locked(
    user: &signer,
    amount: u64,
    tier: u8  // 1=Bronze, 2=Silver, 3=Gold
)

/// Add funds to existing position (extends lock proportionally)
public entry fun add_to_position(
    user: &signer,
    position_id: u64,
    amount: u64
)

/// Withdraw early from a specific position (limited amount)
public entry fun withdraw_early(
    user: &signer,
    position_id: u64,
    amount: u64
)

/// Withdraw full amount after lock expires
public entry fun withdraw_unlocked(
    user: &signer,
    position_id: u64
)

/// Emergency unlock - get principal back, forfeit yield (anytime)
public entry fun emergency_unlock(
    user: &signer,
    position_id: u64
)
```

### 8.2 View Functions

```move
/// Get all positions for a user
#[view]
public fun get_user_positions(user: address): vector<LockPosition>

/// Get a specific position
#[view]
public fun get_position(user: address, position_id: u64): LockPosition

/// Get available early withdrawal for a position
#[view]
public fun get_early_withdrawal_available(
    user: address,
    position_id: u64
): u64

/// Check if a position is unlocked
#[view]
public fun is_position_unlocked(user: address, position_id: u64): bool

/// Get total locked value for a user (across all positions)
#[view]
public fun get_user_total_locked_value(user: address): u64

/// Get tier configuration
#[view]
public fun get_tier_config(tier: u8): (u64, u64)  // (duration, early_limit_bps)

/// Preview emergency unlock payout and forfeited yield
#[view]
public fun get_emergency_unlock_preview(
    user: address,
    position_id: u64
): (u64, u64)  // (payout, forfeited_yield)
```

### 8.3 Admin Functions

```move
/// Update tier early withdrawal limits (admin only)
public entry fun set_tier_limit(
    admin: &signer,
    tier: u8,
    new_limit_bps: u64
)

/// Enable/disable new lock creation (admin only)
public entry fun set_locks_enabled(
    admin: &signer,
    enabled: bool
)
```

---

## 9. Events

```move
#[event]
struct LockedDeposit has drop, store {
    user: address,
    position_id: u64,
    tier: u8,
    principal: u64,
    aet_received: u64,
    entry_share_price: u128,
    unlock_timestamp: u64,
    timestamp: u64,
}

#[event]
struct PositionExtended has drop, store {
    user: address,
    position_id: u64,
    added_principal: u64,
    added_aet: u64,
    new_total_principal: u64,
    new_total_aet: u64,
    old_unlock_timestamp: u64,
    new_unlock_timestamp: u64,
    new_entry_share_price: u128,
    timestamp: u64,
}

#[event]
struct EarlyWithdrawal has drop, store {
    user: address,
    position_id: u64,
    amount_withdrawn: u64,
    aet_burned: u64,
    remaining_early_allowance: u64,
    remaining_principal: u64,
    remaining_aet: u64,
    timestamp: u64,
}

#[event]
struct UnlockedWithdrawal has drop, store {
    user: address,
    position_id: u64,
    total_withdrawn: u64,
    total_aet_burned: u64,
    original_principal: u64,
    profit_or_loss: i128,  // Can be negative
    lock_duration_actual: u64,
    timestamp: u64,
}

#[event]
struct EmergencyUnlock has drop, store {
    user: address,
    position_id: u64,
    principal_returned: u64,       // Amount user receives
    yield_forfeited: u64,          // Yield left behind (0 if vault down)
    loss_absorbed: u64,            // Loss taken by user (0 if vault up)
    aet_burned: u64,               // Total AET burned from position
    time_remaining_seconds: u64,   // How much lock time was left
    timestamp: u64,
}
```

---

## 10. Complete User Journey

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER JOURNEY                                │
└─────────────────────────────────────────────────────────────────────┘

Day 0: Initial Deposit
────────────────────────────────────────────────────────────────────
User deposits 1000 USDT with SILVER tier (6 month lock)

  deposit_locked(1000, TIER_SILVER)

  → Position #1 created:
    - principal: 1000 USDT
    - aet_amount: 909.09 AET (at price 1.1)
    - entry_share_price: 1.1
    - unlock_at: Day 180
    - early_limit: 3% = 30 USDT max


Day 30: Add More Funds
────────────────────────────────────────────────────────────────────
User adds 500 USDT to Position #1

  add_to_position(position_id=1, amount=500)

  Calculation:
    old_remaining = 150 days
    new_duration = 180 days
    weighted = (1000*150 + 500*180) / 1500 = 160 days

  → Position #1 updated:
    - principal: 1500 USDT
    - aet_amount: 1363.64 AET
    - entry_share_price: 1.1 (weighted)
    - unlock_at: Day 190 (now + 160 days)
    - early_limit: 3% = 45 USDT max


Day 60: Create Second Position
────────────────────────────────────────────────────────────────────
User deposits 500 USDT with GOLD tier (12 month lock)

  deposit_locked(500, TIER_GOLD)

  → Position #2 created:
    - principal: 500 USDT
    - unlock_at: Day 425
    - early_limit: 5% = 25 USDT max


Day 90: Early Withdrawal
────────────────────────────────────────────────────────────────────
User needs emergency funds, withdraws early from Position #1

  Current share price: 1.15
  Position #1 current value: 1363.64 * 1.15 / 1.0 = 1568.19 USDT
  Accrued yield: 1568.19 - 1500 = 68.19 USDT
  Early limit: MIN(68.19, 45) = 45 USDT available

  withdraw_early(position_id=1, amount=30)

  → Position #1 updated:
    - 30 USDT withdrawn
    - early_withdrawal_used: 30
    - remaining early allowance: 15 USDT
    - AET burned: ~26 AET
    - principal reduced proportionally


Day 190: Full Withdrawal
────────────────────────────────────────────────────────────────────
Position #1 unlocks, user withdraws everything

  withdraw_unlocked(position_id=1)

  → User receives full current value
  → Position #1 deleted
  → Position #2 still active (unlocks Day 425)


Day 200: Emergency Unlock (Alternative Scenario)
────────────────────────────────────────────────────────────────────
User needs all funds from Position #2 immediately (300+ days remaining)

  Current share price: 1.18
  Position #2 value: 450 * 1.18 = 531 USDT
  Position #2 principal: 500 USDT

  Scenario A - Vault is up:
    If current_value (531) > principal (500):
    emergency_unlock(position_id=2)
    → User receives: 500 USDT (principal only)
    → Forfeited yield: 31 USDT (stays in pool)
    → Position #2 deleted

  Scenario B - Vault is down:
    If current_value (475) < principal (500):
    emergency_unlock(position_id=2)
    → User receives: 475 USDT (current value)
    → Loss absorbed: 25 USDT (user takes the loss)
    → Position #2 deleted
```

---

## 11. Edge Cases

### 11.1 Negative Yield
If share price drops below entry price:
- `accrued_yield = 0`
- `early_withdrawal_available = 0` (no partial early withdrawal)
- User can still `emergency_unlock` but will receive less than principal
- Or wait until unlock/yield becomes positive

### 11.2 Position Fully Depleted via Early Withdrawal
If user withdraws max early amount:
- Position remains with reduced principal
- No more early withdrawal available
- Can still `emergency_unlock` (forfeit remaining yield)
- Or wait for unlock for full remaining value

### 11.3 Expired Position Not Claimed
- Position remains indefinitely
- User can claim anytime after unlock
- No penalty for late claim
- Value continues to fluctuate with share price

### 11.4 Zero Amount Checks
- Deposits must be > 0
- Withdrawals must be > 0
- Cannot create position with 0 amount

### 11.5 Emergency Unlock After Partial Early Withdrawal
- Principal has been reduced proportionally
- Emergency unlock uses adjusted principal
- User gets MIN(adjusted_principal, current_value)

---

## 12. Security Considerations

### 12.1 Share Price Manipulation
**Risk**: Attacker manipulates share price before withdrawal.

**Mitigation Options**:
- Use time-weighted average price (TWAP)
- Minimum hold time before early withdrawal (e.g., 7 days)
- Maximum early withdrawal per time period

### 12.2 Position ID Enumeration
**Risk**: Attacker tries to access other users' positions.

**Mitigation**: All position operations require signer verification.

### 12.3 Integer Overflow
**Risk**: Large values cause overflow in calculations.

**Mitigation**: Use u128 for intermediate calculations, validate bounds.

### 12.4 Dust Positions
**Risk**: Users create many tiny positions to spam storage.

**Mitigation**: Minimum deposit amount per position.

---

## 13. Gas Optimization

1. **Vector vs Table**: Using `vector<LockPosition>` for positions
   - Pro: Simple iteration for view functions
   - Con: O(n) lookup
   - Acceptable for typical user with <10 positions

2. **Position Deletion**: When position is withdrawn, swap-remove from vector to avoid shifting

3. **Batch Operations**: Consider adding batch withdraw for multiple expired positions

---

## 14. Implementation Checklist

- [ ] Add `LockPosition` struct
- [ ] Add `UserLockPositions` resource
- [ ] Add `LockConfig` resource
- [ ] Implement `deposit_locked()`
- [ ] Implement `add_to_position()` with proportional extension
- [ ] Implement `withdraw_early()`
- [ ] Implement `withdraw_unlocked()`
- [ ] Implement `emergency_unlock()`
- [ ] Add all view functions (including `get_emergency_unlock_preview`)
- [ ] Add admin functions for tier configuration
- [ ] Add all events (including `EmergencyUnlock`)
- [ ] Write unit tests for each function
- [ ] Write integration tests for complete user journeys
- [ ] Security review

---

## 15. Open Items for Future

1. **Yield Boost**: May add bonus yield for longer locks
2. **NFT Positions**: Represent positions as transferable NFTs
3. **Partial Unlock**: Allow unlocking portion of position
4. **Auto-Compound**: Option to auto-compound early withdrawal back
5. **Referral Bonus**: Bonus for referring locked depositors

---

## Appendix A: Tier Constants Reference

| Tier | Duration (seconds) | Duration (days) | Early Limit (bps) | Early Limit (%) |
|------|-------------------|-----------------|-------------------|-----------------|
| BRONZE (1) | 7,776,000 | 90 | 200 | 2% |
| SILVER (2) | 15,552,000 | 180 | 300 | 3% |
| GOLD (3) | 31,536,000 | 365 | 500 | 5% |

---

## Appendix B: Calculation Examples

### B.1 Early Withdrawal Available

```
Given:
  position.principal = 1000 USDT
  position.aet_amount = 909.09 AET
  position.entry_share_price = 1.1
  position.early_withdrawal_used = 0
  position.tier = SILVER (3% limit)
  current_share_price = 1.15

Calculate:
  current_value = 909.09 * 1.15 = 1045.45 USDT
  accrued_yield = 1045.45 - 1000 = 45.45 USDT
  tier_cap = 1000 * 0.03 = 30 USDT
  available = MIN(45.45, 30) - 0 = 30 USDT
```

### B.2 Proportional Lock Extension

```
Given:
  position.principal = 1000 USDT
  position.unlock_at = now + 90 days (3 months remaining)
  tier = SILVER (180 day full duration)
  new_deposit = 500 USDT

Calculate:
  old_remaining = 90 days
  new_duration = 180 days

  weighted = (1000 * 90 + 500 * 180) / 1500
           = (90000 + 90000) / 1500
           = 120 days

  new_unlock_at = now + 120 days
```
