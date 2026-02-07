# Test Cases: Time-Locked Deposit System

This document outlines all test scenarios for RFC-002 implementation.

---

## 1. Deposit Locked Tests

### 1.1 Basic Deposit

| Test | Input | Expected Result |
|------|-------|-----------------|
| `test_deposit_locked_bronze` | 1000 USDT, TIER_BRONZE | Position created, 90-day lock, 2% early limit |
| `test_deposit_locked_silver` | 1000 USDT, TIER_SILVER | Position created, 180-day lock, 3% early limit |
| `test_deposit_locked_gold` | 1000 USDT, TIER_GOLD | Position created, 365-day lock, 5% early limit |

### 1.2 Position State Verification

| Test | Verification |
|------|--------------|
| `test_deposit_records_principal` | `position.principal == deposit_amount` |
| `test_deposit_records_entry_price` | `position.entry_share_price == current_share_price` |
| `test_deposit_records_aet_amount` | `position.aet_amount == calculated_aet` |
| `test_deposit_sets_unlock_time` | `position.unlock_at == now + tier_duration` |
| `test_deposit_initializes_early_withdrawal` | `position.early_withdrawal_used == 0` |

### 1.3 Multiple Positions

| Test | Scenario | Expected Result |
|------|----------|-----------------|
| `test_multiple_positions_same_tier` | Create 2 SILVER positions | Both exist independently |
| `test_multiple_positions_different_tiers` | Create BRONZE, SILVER, GOLD | All 3 exist with correct configs |
| `test_position_ids_increment` | Create 3 positions | IDs are 1, 2, 3 |

### 1.4 Edge Cases & Errors

| Test | Input | Expected Error |
|------|-------|----------------|
| `test_deposit_zero_amount` | 0 USDT | `EZERO_AMOUNT` |
| `test_deposit_invalid_tier` | tier = 0 | `EINVALID_TIER` |
| `test_deposit_invalid_tier_high` | tier = 4 | `EINVALID_TIER` |
| `test_deposit_insufficient_balance` | More than user has | `EINSUFFICIENT_BALANCE` |

### 1.5 Events

| Test | Verification |
|------|--------------|
| `test_deposit_emits_event` | `LockedDeposit` event emitted with correct fields |

---

## 2. Add to Position Tests

### 2.1 Basic Extension

| Test | Scenario | Expected Result |
|------|----------|-----------------|
| `test_add_to_position_basic` | Add 500 to 1000 position | Principal = 1500 |
| `test_add_extends_lock_proportionally` | 1000 USDT, 90 days left, add 500 | ~120 days new remaining |

### 2.2 Proportional Extension Calculations

| Test | Setup | Add | Expected New Remaining |
|------|-------|-----|------------------------|
| `test_extension_half_remaining` | 1000, 90 days left, SILVER | 1000 | (1000*90 + 1000*180) / 2000 = 135 days |
| `test_extension_full_remaining` | 1000, 180 days left, SILVER | 500 | (1000*180 + 500*180) / 1500 = 180 days |
| `test_extension_small_add` | 1000, 30 days left, SILVER | 100 | (1000*30 + 100*180) / 1100 = ~43 days |

### 2.3 Entry Price Update

| Test | Scenario | Verification |
|------|----------|--------------|
| `test_add_updates_entry_price` | Add when price changed | Weighted average entry price |
| `test_add_same_price` | Add when price unchanged | Entry price stays same |

### 2.4 AET Amount Update

| Test | Verification |
|------|--------------|
| `test_add_increases_aet` | New AET minted and added to position |
| `test_add_aet_calculation` | `new_aet = amount * AET_SCALE / current_price` |

### 2.5 Edge Cases & Errors

| Test | Input | Expected Error |
|------|-------|----------------|
| `test_add_zero_amount` | Add 0 | `EZERO_AMOUNT` |
| `test_add_nonexistent_position` | Invalid position_id | `EPOSITION_NOT_FOUND` |
| `test_add_expired_position` | Position already unlocked | `EPOSITION_EXPIRED` |
| `test_add_other_users_position` | Different user's position | `ENOT_POSITION_OWNER` |

### 2.6 Events

| Test | Verification |
|------|--------------|
| `test_add_emits_event` | `PositionExtended` event with old/new unlock times |

---

## 3. Early Withdrawal Tests

### 3.1 Basic Early Withdrawal

| Test | Scenario | Expected Result |
|------|----------|-----------------|
| `test_early_withdraw_basic` | Withdraw 10 from available 30 | 10 USDT received |
| `test_early_withdraw_full_allowance` | Withdraw full available | Full tier% received |

### 3.2 Yield-Based Calculation

| Test | Setup | Expected Available |
|------|-------|-------------------|
| `test_early_available_positive_yield` | 1000 principal, 1100 value, SILVER | MIN(100, 30) = 30 |
| `test_early_available_high_yield` | 1000 principal, 1500 value, SILVER | MIN(500, 30) = 30 |
| `test_early_available_low_yield` | 1000 principal, 1010 value, SILVER | MIN(10, 30) = 10 |
| `test_early_available_zero_yield` | 1000 principal, 1000 value | 0 |
| `test_early_available_negative_yield` | 1000 principal, 900 value | 0 |

### 3.3 Tier Limits

| Test | Tier | Principal | Max Early |
|------|------|-----------|-----------|
| `test_early_limit_bronze` | BRONZE | 1000 | 20 (2%) |
| `test_early_limit_silver` | SILVER | 1000 | 30 (3%) |
| `test_early_limit_gold` | GOLD | 1000 | 50 (5%) |

### 3.4 Partial Withdrawals

| Test | Scenario | Expected Result |
|------|----------|-----------------|
| `test_early_partial_first` | Withdraw 10 of 30 available | 20 remaining |
| `test_early_partial_second` | Withdraw 15 more | 5 remaining |
| `test_early_partial_exhaust` | Withdraw final 5 | 0 remaining |

### 3.5 Position Updates After Early Withdrawal

| Test | Verification |
|------|--------------|
| `test_early_reduces_aet` | AET burned proportionally |
| `test_early_reduces_principal` | Principal reduced proportionally |
| `test_early_updates_used_amount` | `early_withdrawal_used` increased |

### 3.6 Edge Cases & Errors

| Test | Input | Expected Error |
|------|-------|----------------|
| `test_early_zero_amount` | Withdraw 0 | `EZERO_AMOUNT` |
| `test_early_exceeds_available` | Withdraw more than available | `EINSUFFICIENT_EARLY_ALLOWANCE` |
| `test_early_expired_position` | Position already unlocked | `EPOSITION_EXPIRED` |
| `test_early_no_yield` | Vault is flat/down | `ENO_YIELD_AVAILABLE` |
| `test_early_nonexistent_position` | Invalid position_id | `EPOSITION_NOT_FOUND` |

### 3.7 Events

| Test | Verification |
|------|--------------|
| `test_early_emits_event` | `EarlyWithdrawal` event with correct amounts |

---

## 4. Withdraw Unlocked Tests

### 4.1 Basic Unlocked Withdrawal

| Test | Scenario | Expected Result |
|------|----------|-----------------|
| `test_withdraw_unlocked_basic` | Position expired, withdraw | Full value received |
| `test_withdraw_unlocked_with_profit` | 10% yield | Principal + yield received |
| `test_withdraw_unlocked_with_loss` | -5% loss | Reduced amount received |

### 4.2 Position Cleanup

| Test | Verification |
|------|--------------|
| `test_withdraw_unlocked_deletes_position` | Position removed from vector |
| `test_withdraw_unlocked_burns_all_aet` | All position AET burned |

### 4.3 After Early Withdrawal

| Test | Scenario | Expected Result |
|------|----------|-----------------|
| `test_unlock_after_partial_early` | Used some early allowance | Remaining value received |
| `test_unlock_after_max_early` | Used full early allowance | Remaining principal + new yield |

### 4.4 Edge Cases & Errors

| Test | Input | Expected Error |
|------|-------|----------------|
| `test_unlock_not_expired` | Position still locked | `EPOSITION_NOT_EXPIRED` |
| `test_unlock_nonexistent` | Invalid position_id | `EPOSITION_NOT_FOUND` |
| `test_unlock_other_user` | Different user's position | `ENOT_POSITION_OWNER` |

### 4.5 Events

| Test | Verification |
|------|--------------|
| `test_unlock_emits_event` | `UnlockedWithdrawal` event with profit/loss |

---

## 5. Emergency Unlock Tests

### 5.1 Basic Emergency Unlock

| Test | Scenario | Expected Result |
|------|----------|-----------------|
| `test_emergency_unlock_vault_up` | 1000 principal, 1100 value | Receive 1000, forfeit 100 |
| `test_emergency_unlock_vault_down` | 1000 principal, 950 value | Receive 950, absorb 50 loss |
| `test_emergency_unlock_vault_flat` | 1000 principal, 1000 value | Receive 1000, forfeit 0 |

### 5.2 Payout Calculation

| Test | Principal | Current Value | Expected Payout |
|------|-----------|---------------|-----------------|
| `test_emergency_payout_10pct_up` | 1000 | 1100 | 1000 |
| `test_emergency_payout_50pct_up` | 1000 | 1500 | 1000 |
| `test_emergency_payout_5pct_down` | 1000 | 950 | 950 |
| `test_emergency_payout_20pct_down` | 1000 | 800 | 800 |

### 5.3 Forfeited Yield Handling

| Test | Verification |
|------|--------------|
| `test_emergency_forfeited_aet_burned` | Excess AET is burned |
| `test_emergency_no_forfeit_when_down` | No AET burned beyond payout when vault down |

### 5.4 After Early Withdrawal

| Test | Scenario | Expected Payout |
|------|----------|-----------------|
| `test_emergency_after_partial_early` | Principal reduced to 980 | MIN(980, current_value) |
| `test_emergency_after_max_early` | Principal reduced to 970 | MIN(970, current_value) |

### 5.5 Position Cleanup

| Test | Verification |
|------|--------------|
| `test_emergency_deletes_position` | Position removed |
| `test_emergency_burns_payout_aet` | AET for payout amount burned |

### 5.6 Edge Cases & Errors

| Test | Input | Expected Error |
|------|-------|----------------|
| `test_emergency_expired_position` | Position already unlocked | `EUSE_WITHDRAW_UNLOCKED` |
| `test_emergency_nonexistent` | Invalid position_id | `EPOSITION_NOT_FOUND` |
| `test_emergency_other_user` | Different user's position | `ENOT_POSITION_OWNER` |

### 5.7 Events

| Test | Verification |
|------|--------------|
| `test_emergency_emits_event` | `EmergencyUnlock` event with forfeit/loss amounts |

---

## 6. View Function Tests

### 6.1 get_user_positions

| Test | Scenario | Expected Result |
|------|----------|-----------------|
| `test_view_positions_empty` | No positions | Empty vector |
| `test_view_positions_single` | One position | Vector with 1 element |
| `test_view_positions_multiple` | Three positions | Vector with 3 elements |

### 6.2 get_position

| Test | Scenario | Expected Result |
|------|----------|-----------------|
| `test_view_position_exists` | Valid position_id | Position data |
| `test_view_position_not_found` | Invalid position_id | Error or empty |

### 6.3 get_early_withdrawal_available

| Test | Scenario | Expected Result |
|------|----------|-----------------|
| `test_view_early_available_positive` | Yield exists | Correct amount |
| `test_view_early_available_zero` | No yield | 0 |
| `test_view_early_available_used` | Partially used | Remaining amount |

### 6.4 is_position_unlocked

| Test | Scenario | Expected Result |
|------|----------|-----------------|
| `test_view_is_unlocked_false` | Not yet expired | false |
| `test_view_is_unlocked_true` | Expired | true |
| `test_view_is_unlocked_exact` | Exactly at unlock time | true |

### 6.5 get_user_total_locked_value

| Test | Scenario | Expected Result |
|------|----------|-----------------|
| `test_view_total_value_single` | One position | Position value |
| `test_view_total_value_multiple` | Multiple positions | Sum of all values |

### 6.6 get_emergency_unlock_preview

| Test | Scenario | Expected Result |
|------|----------|-----------------|
| `test_view_emergency_preview_up` | Vault up | (principal, yield) |
| `test_view_emergency_preview_down` | Vault down | (current_value, 0) |

### 6.7 get_tier_config

| Test | Tier | Expected Result |
|------|------|-----------------|
| `test_view_tier_config_bronze` | 1 | (7776000, 200) |
| `test_view_tier_config_silver` | 2 | (15552000, 300) |
| `test_view_tier_config_gold` | 3 | (31536000, 500) |

---

## 7. Integration Tests

### 7.1 Complete User Journey

```
test_full_journey_happy_path:
  1. User deposits 1000 USDT SILVER
  2. Wait 30 days, add 500 USDT
  3. Wait 30 days, early withdraw 20 USDT
  4. Wait until unlock
  5. Withdraw unlocked
  → Verify all intermediate states and final payout
```

### 7.2 Multiple Users

```
test_multiple_users_independent:
  1. User A deposits 1000 SILVER
  2. User B deposits 500 GOLD
  3. User A early withdraws
  4. User B emergency unlocks
  → Verify positions are independent
```

### 7.3 Share Price Changes

```
test_share_price_increases:
  1. Deposit at price 1.0
  2. Simulate price increase to 1.1
  3. Verify early withdrawal available
  4. Verify emergency unlock amounts

test_share_price_decreases:
  1. Deposit at price 1.0
  2. Simulate price decrease to 0.9
  3. Verify early withdrawal = 0
  4. Verify emergency unlock returns less than principal
```

### 7.4 Position Lifecycle

```
test_position_lifecycle_early_withdraw:
  1. Create position
  2. Early withdraw partial
  3. Early withdraw more
  4. Wait for unlock
  5. Withdraw unlocked
  → Track principal/AET changes throughout

test_position_lifecycle_emergency:
  1. Create position
  2. Early withdraw partial
  3. Emergency unlock
  → Verify adjusted principal used
```

---

## 8. Edge Cases & Boundary Tests

### 8.1 Time Boundaries

| Test | Scenario |
|------|----------|
| `test_exactly_at_unlock_time` | Withdraw at exact unlock timestamp |
| `test_one_second_before_unlock` | Operations 1 second before unlock |
| `test_one_second_after_unlock` | Operations 1 second after unlock |

### 8.2 Amount Boundaries

| Test | Scenario |
|------|----------|
| `test_minimum_deposit` | Smallest valid deposit amount |
| `test_maximum_deposit` | Very large deposit (u64 limits) |
| `test_dust_amounts` | Very small withdrawal amounts |

### 8.3 Share Price Boundaries

| Test | Scenario |
|------|----------|
| `test_share_price_very_high` | Price >> initial |
| `test_share_price_very_low` | Price << initial |
| `test_share_price_unchanged` | Price exactly same |

### 8.4 Multiple Operations Same Block

| Test | Scenario |
|------|----------|
| `test_deposit_and_add_same_block` | Deposit then add immediately |
| `test_multiple_early_withdrawals_same_block` | Multiple early withdraws |

---

## 9. Security Tests

### 9.1 Access Control

| Test | Scenario | Expected |
|------|----------|----------|
| `test_cannot_access_other_user_position` | User A tries User B's position | Error |
| `test_cannot_withdraw_other_user` | User A tries to withdraw from User B | Error |

### 9.2 Reentrancy

| Test | Scenario |
|------|----------|
| `test_no_reentrancy_early_withdraw` | State updated before external call |
| `test_no_reentrancy_emergency_unlock` | State updated before external call |

### 9.3 Integer Overflow

| Test | Scenario |
|------|----------|
| `test_large_amounts_no_overflow` | Very large principal and yield |
| `test_extension_calculation_no_overflow` | Large weighted average calc |

---

## 10. Admin Function Tests

### 10.1 set_tier_limit

| Test | Scenario | Expected |
|------|----------|----------|
| `test_admin_set_tier_limit` | Admin updates limit | New limit applied |
| `test_non_admin_cannot_set_limit` | Non-admin tries | Error |
| `test_set_limit_affects_new_positions` | Change limit, create position | New limit used |

### 10.2 set_locks_enabled

| Test | Scenario | Expected |
|------|----------|----------|
| `test_disable_locks` | Disable, try deposit | Error |
| `test_enable_locks` | Re-enable, deposit | Success |
| `test_existing_positions_unaffected` | Disable locks | Existing positions work |

---

## Test Utilities Needed

```move
// Test helper functions
fun setup_test_account(): signer
fun mint_test_tokens(account: &signer, amount: u64)
fun advance_time(seconds: u64)
fun set_share_price(price: u128)
fun get_position_value(user: address, position_id: u64): u64
```

---

## Test Coverage Matrix

| Function | Happy Path | Edge Cases | Errors | Events |
|----------|------------|------------|--------|--------|
| deposit_locked | ✓ | ✓ | ✓ | ✓ |
| add_to_position | ✓ | ✓ | ✓ | ✓ |
| withdraw_early | ✓ | ✓ | ✓ | ✓ |
| withdraw_unlocked | ✓ | ✓ | ✓ | ✓ |
| emergency_unlock | ✓ | ✓ | ✓ | ✓ |
| get_user_positions | ✓ | ✓ | - | - |
| get_position | ✓ | ✓ | ✓ | - |
| get_early_withdrawal_available | ✓ | ✓ | - | - |
| is_position_unlocked | ✓ | ✓ | - | - |
| get_user_total_locked_value | ✓ | ✓ | - | - |
| get_emergency_unlock_preview | ✓ | ✓ | - | - |
| get_tier_config | ✓ | - | ✓ | - |
| set_tier_limit | ✓ | - | ✓ | - |
| set_locks_enabled | ✓ | - | ✓ | - |
