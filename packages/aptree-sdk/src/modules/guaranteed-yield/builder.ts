import { AccountAddressInput, SimpleTransaction } from "@aptos-labs/ts-sdk";
import { BaseModule } from "../base-module";
import type {
  DepositGuaranteedArgs,
  UnlockGuaranteedArgs,
  FundCashbackVaultArgs,
  EmergencyUnlockGuaranteedArgs,
  SetTierYieldArgs,
  SetTreasuryArgs,
  SetDepositsEnabledArgs,
  AdminWithdrawCashbackVaultArgs,
  ProposeAdminArgs,
  SetMaxTotalLockedArgs,
  SetMinDepositArgs,
} from "../../types/guaranteed-yield";

/**
 * Transaction builders for the `aptree::GuaranteedYieldLocking` entry functions.
 *
 * @example
 * ```typescript
 * const txn = await client.guaranteedYield.builder.depositGuaranteed(sender, {
 *   amount: 100_000_000n,
 *   tier: GuaranteedYieldTier.Gold,
 *   minAetReceived: 0n,
 * });
 * ```
 */
export class GuaranteedYieldBuilder extends BaseModule {
  // ── User entry functions ─────────────────────────────────────────────────

  /**
   * Build a `GuaranteedYieldLocking::deposit_guaranteed` transaction.
   *
   * Creates a guaranteed-yield lock position. The user deposits tokens, receives
   * AET share tokens (locked for the tier duration), and immediately receives
   * a cashback payment representing the guaranteed yield.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link DepositGuaranteedArgs}
   * @returns A built transaction ready for signing.
   */
  async depositGuaranteed(
    sender: AccountAddressInput,
    args: DepositGuaranteedArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::deposit_guaranteed`,
      [args.amount, args.tier, args.minAetReceived],
    );
  }

  /**
   * Build a `GuaranteedYieldLocking::unlock_guaranteed` transaction.
   *
   * Unlocks a guaranteed-yield position after its lock period has ended.
   * The user receives the AET share tokens, which can then be redeemed through
   * the bridge. Any yield above the guaranteed amount is sent to the treasury.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link UnlockGuaranteedArgs}
   * @returns A built transaction ready for signing.
   */
  async unlockGuaranteed(
    sender: AccountAddressInput,
    args: UnlockGuaranteedArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::unlock_guaranteed`,
      [args.positionId],
    );
  }

  /**
   * Build a `GuaranteedYieldLocking::fund_cashback_vault` transaction.
   *
   * Funds the cashback vault with underlying tokens. The vault is used to pay
   * instant cashback to users when they create guaranteed-yield positions.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link FundCashbackVaultArgs}
   * @returns A built transaction ready for signing.
   */
  async fundCashbackVault(
    sender: AccountAddressInput,
    args: FundCashbackVaultArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::fund_cashback_vault`,
      [args.amount],
    );
  }

  /**
   * Build a `GuaranteedYieldLocking::emergency_unlock_guaranteed` transaction.
   *
   * Immediately unlocks a guaranteed-yield position before its lock period ends.
   * The user forfeits any yield and the cashback is clawed back from their balance.
   * Use {@link GuaranteedYieldModule.getEmergencyUnlockPreview | getEmergencyUnlockPreview}
   * to preview the outcome.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link EmergencyUnlockGuaranteedArgs}
   * @returns A built transaction ready for signing.
   */
  async emergencyUnlockGuaranteed(
    sender: AccountAddressInput,
    args: EmergencyUnlockGuaranteedArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::emergency_unlock_guaranteed`,
      [args.positionId],
    );
  }

  // ── Admin entry functions ────────────────────────────────────────────────

  /**
   * Build a `GuaranteedYieldLocking::set_tier_yield` transaction.
   *
   * Updates the guaranteed yield BPS for a given tier. Only affects new positions.
   *
   * @remarks Admin only.
   * @param sender - The admin account address.
   * @param args - {@link SetTierYieldArgs}
   */
  async setTierYield(
    sender: AccountAddressInput,
    args: SetTierYieldArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::set_tier_yield`,
      [args.tier, args.newYieldBps],
    );
  }

  /**
   * Build a `GuaranteedYieldLocking::set_treasury` transaction.
   *
   * Updates the treasury address that receives excess yield above the guaranteed rate.
   *
   * @remarks Admin only.
   * @param sender - The admin account address.
   * @param args - {@link SetTreasuryArgs}
   */
  async setTreasury(
    sender: AccountAddressInput,
    args: SetTreasuryArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::set_treasury`,
      [args.newTreasury],
    );
  }

  /**
   * Build a `GuaranteedYieldLocking::set_deposits_enabled` transaction.
   *
   * Enables or disables new guaranteed-yield deposits.
   *
   * @remarks Admin only.
   * @param sender - The admin account address.
   * @param args - {@link SetDepositsEnabledArgs}
   */
  async setDepositsEnabled(
    sender: AccountAddressInput,
    args: SetDepositsEnabledArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::set_deposits_enabled`,
      [args.enabled],
    );
  }

  /**
   * Build a `GuaranteedYieldLocking::admin_withdraw_cashback_vault` transaction.
   *
   * Withdraws tokens from the cashback vault to the admin.
   *
   * @remarks Admin only.
   * @param sender - The admin account address.
   * @param args - {@link AdminWithdrawCashbackVaultArgs}
   */
  async adminWithdrawCashbackVault(
    sender: AccountAddressInput,
    args: AdminWithdrawCashbackVaultArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::admin_withdraw_cashback_vault`,
      [args.amount],
    );
  }

  /**
   * Build a `GuaranteedYieldLocking::propose_admin` transaction.
   *
   * Proposes a new admin address. The new admin must call {@link acceptAdmin}
   * to complete the transfer.
   *
   * @remarks Admin only.
   * @param sender - The current admin account address.
   * @param args - {@link ProposeAdminArgs}
   */
  async proposeAdmin(
    sender: AccountAddressInput,
    args: ProposeAdminArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::propose_admin`,
      [args.newAdmin],
    );
  }

  /**
   * Build a `GuaranteedYieldLocking::accept_admin` transaction.
   *
   * Accepts the admin role after being proposed via {@link proposeAdmin}.
   *
   * @param sender - The proposed new admin account address.
   * @returns A built transaction ready for signing.
   */
  async acceptAdmin(
    sender: AccountAddressInput,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::accept_admin`,
      [],
    );
  }

  /**
   * Build a `GuaranteedYieldLocking::set_max_total_locked` transaction.
   *
   * Sets the maximum total principal that can be locked across all positions.
   *
   * @remarks Admin only.
   * @param sender - The admin account address.
   * @param args - {@link SetMaxTotalLockedArgs}
   */
  async setMaxTotalLocked(
    sender: AccountAddressInput,
    args: SetMaxTotalLockedArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::set_max_total_locked`,
      [args.newMax],
    );
  }

  /**
   * Build a `GuaranteedYieldLocking::set_min_deposit` transaction.
   *
   * Sets the minimum deposit amount for new positions.
   *
   * @remarks Admin only.
   * @param sender - The admin account address.
   * @param args - {@link SetMinDepositArgs}
   */
  async setMinDeposit(
    sender: AccountAddressInput,
    args: SetMinDepositArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::set_min_deposit`,
      [args.newMin],
    );
  }
}
