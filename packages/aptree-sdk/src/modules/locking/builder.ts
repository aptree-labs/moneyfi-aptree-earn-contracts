import { AccountAddressInput, SimpleTransaction } from "@aptos-labs/ts-sdk";
import { BaseModule } from "../base-module";
import type {
  DepositLockedArgs,
  AddToPositionArgs,
  WithdrawEarlyArgs,
  WithdrawUnlockedArgs,
  EmergencyUnlockArgs,
  SetTierLimitArgs,
  SetLocksEnabledArgs,
} from "../../types/locking";

/**
 * Transaction builders for the `aptree::locking` entry functions.
 *
 * Each method returns a {@link SimpleTransaction} ready for signing and submission.
 *
 * @example
 * ```typescript
 * const txn = await client.locking.builder.depositLocked(sender, {
 *   amount: 100_000_000,
 *   tier: LockingTier.Gold,
 * });
 * ```
 */
export class LockingBuilder extends BaseModule {
  // ── User entry functions ─────────────────────────────────────────────────

  /**
   * Build a `locking::deposit_locked` transaction.
   *
   * Creates a new time-locked deposit position. The user's tokens are deposited
   * through the bridge and locked for the tier's duration. AET share tokens are
   * minted and held in the lock position.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link DepositLockedArgs}
   * @returns A built transaction ready for signing.
   */
  async depositLocked(
    sender: AccountAddressInput,
    args: DepositLockedArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::locking::deposit_locked`,
      [args.amount, args.tier],
    );
  }

  /**
   * Build a `locking::add_to_position` transaction.
   *
   * Adds additional tokens to an existing lock position. The unlock timestamp
   * does not change — only the principal and AET amounts increase. The entry
   * share price is recalculated as a weighted average.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link AddToPositionArgs}
   * @returns A built transaction ready for signing.
   */
  async addToPosition(
    sender: AccountAddressInput,
    args: AddToPositionArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::locking::add_to_position`,
      [args.positionId, args.amount],
    );
  }

  /**
   * Build a `locking::withdraw_early` transaction.
   *
   * Withdraws tokens from a locked position before the unlock date. The
   * withdrawal is limited by the tier's early withdrawal BPS limit, applied
   * to the position's principal.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link WithdrawEarlyArgs}
   * @returns A built transaction ready for signing.
   */
  async withdrawEarly(
    sender: AccountAddressInput,
    args: WithdrawEarlyArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::locking::withdraw_early`,
      [args.positionId, args.amount],
    );
  }

  /**
   * Build a `locking::withdraw_unlocked` transaction.
   *
   * Withdraws all tokens from a position that has passed its unlock date.
   * The full AET amount is redeemed through the bridge at the current share price.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link WithdrawUnlockedArgs}
   * @returns A built transaction ready for signing.
   */
  async withdrawUnlocked(
    sender: AccountAddressInput,
    args: WithdrawUnlockedArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::locking::withdraw_unlocked`,
      [args.positionId],
    );
  }

  /**
   * Build a `locking::emergency_unlock` transaction.
   *
   * Immediately unlocks a position, forfeiting any accrued yield. The user
   * receives their principal minus any yield portion. Use
   * {@link LockingModule.getEmergencyUnlockPreview | getEmergencyUnlockPreview}
   * to see the expected payout before calling this.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link EmergencyUnlockArgs}
   * @returns A built transaction ready for signing.
   */
  async emergencyUnlock(
    sender: AccountAddressInput,
    args: EmergencyUnlockArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::locking::emergency_unlock`,
      [args.positionId],
    );
  }

  // ── Admin entry functions ────────────────────────────────────────────────

  /**
   * Build a `locking::set_tier_limit` transaction.
   *
   * Updates the early withdrawal BPS limit for a given tier.
   *
   * @remarks Admin only — the sender must be the contract admin.
   *
   * @param sender - The admin account address.
   * @param args - {@link SetTierLimitArgs}
   * @returns A built transaction ready for signing.
   */
  async setTierLimit(
    sender: AccountAddressInput,
    args: SetTierLimitArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::locking::set_tier_limit`,
      [args.tier, args.newLimitBps],
    );
  }

  /**
   * Build a `locking::set_locks_enabled` transaction.
   *
   * Enables or disables new lock deposits. Existing positions are not affected.
   *
   * @remarks Admin only — the sender must be the contract admin.
   *
   * @param sender - The admin account address.
   * @param args - {@link SetLocksEnabledArgs}
   * @returns A built transaction ready for signing.
   */
  async setLocksEnabled(
    sender: AccountAddressInput,
    args: SetLocksEnabledArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::locking::set_locks_enabled`,
      [args.enabled],
    );
  }
}
