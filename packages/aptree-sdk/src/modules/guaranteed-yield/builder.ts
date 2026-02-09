import {
  AccountAddressInput,
  InputEntryFunctionData,
  SimpleTransaction,
} from "@aptos-labs/ts-sdk";
import { BaseModule } from "../base-module";
import type {
  DepositGuaranteedArgs,
  RequestUnlockGuaranteedArgs,
  WithdrawGuaranteedArgs,
  FundCashbackVaultArgs,
  RequestEmergencyUnlockGuaranteedArgs,
  WithdrawEmergencyGuaranteedArgs,
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
 *   amount: 100_000_000,
 *   tier: GuaranteedYieldTier.Gold,
 *   minAetReceived: 0,
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
   * Build a `GuaranteedYieldLocking::request_unlock_guaranteed` transaction.
   *
   * **Step 1 of 2** for unlocking a matured guaranteed-yield position.
   *
   * Initiates the unlock by requesting a withdrawal from MoneyFi. This is an
   * async operation — the withdrawal must be confirmed off-chain before calling
   * {@link withdrawGuaranteed} to complete the process.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link RequestUnlockGuaranteedArgs}
   * @returns A built transaction ready for signing.
   */
  async requestUnlockGuaranteed(
    sender: AccountAddressInput,
    args: RequestUnlockGuaranteedArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::request_unlock_guaranteed`,
      [args.positionId],
    );
  }

  /**
   * Build a `GuaranteedYieldLocking::withdraw_guaranteed` transaction.
   *
   * **Step 2 of 2** for unlocking a matured guaranteed-yield position.
   *
   * Completes the unlock after the off-chain withdrawal confirmation. The user
   * receives their principal. Any yield above the guaranteed amount is sent to
   * the treasury.
   *
   * Must be called after {@link requestUnlockGuaranteed} and off-chain confirmation.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link WithdrawGuaranteedArgs}
   * @returns A built transaction ready for signing.
   */
  async withdrawGuaranteed(
    sender: AccountAddressInput,
    args: WithdrawGuaranteedArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::withdraw_guaranteed`,
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
   * Build a `GuaranteedYieldLocking::request_emergency_unlock_guaranteed` transaction.
   *
   * **Step 1 of 2** for emergency-unlocking a position before maturity.
   *
   * Initiates the emergency unlock by requesting a withdrawal from MoneyFi.
   * The withdrawal must be confirmed off-chain before calling
   * {@link withdrawEmergencyGuaranteed} to complete the process.
   *
   * Use {@link GuaranteedYieldModule.getEmergencyUnlockPreview | getEmergencyUnlockPreview}
   * to preview the expected payout, forfeited yield, and cashback clawback.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link RequestEmergencyUnlockGuaranteedArgs}
   * @returns A built transaction ready for signing.
   */
  async requestEmergencyUnlockGuaranteed(
    sender: AccountAddressInput,
    args: RequestEmergencyUnlockGuaranteedArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::request_emergency_unlock_guaranteed`,
      [args.positionId],
    );
  }

  /**
   * Build a `GuaranteedYieldLocking::withdraw_emergency_guaranteed` transaction.
   *
   * **Step 2 of 2** for emergency-unlocking a position before maturity.
   *
   * Completes the emergency unlock after off-chain withdrawal confirmation.
   * The user forfeits yield and the cashback is clawed back.
   *
   * Must be called after {@link requestEmergencyUnlockGuaranteed} and off-chain confirmation.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link WithdrawEmergencyGuaranteedArgs}
   * @returns A built transaction ready for signing.
   */
  async withdrawEmergencyGuaranteed(
    sender: AccountAddressInput,
    args: WithdrawEmergencyGuaranteedArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::withdraw_emergency_guaranteed`,
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

  // ── Wallet adapter payload methods ─────────────────────────────────────

  /** Payload for `GuaranteedYieldLocking::deposit_guaranteed`. @see {@link depositGuaranteed} */
  depositGuaranteedPayload(args: DepositGuaranteedArgs): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::GuaranteedYieldLocking::deposit_guaranteed`,
      [args.amount, args.tier, args.minAetReceived],
    );
  }

  /** Payload for `GuaranteedYieldLocking::request_unlock_guaranteed`. @see {@link requestUnlockGuaranteed} */
  requestUnlockGuaranteedPayload(args: RequestUnlockGuaranteedArgs): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::GuaranteedYieldLocking::request_unlock_guaranteed`,
      [args.positionId],
    );
  }

  /** Payload for `GuaranteedYieldLocking::withdraw_guaranteed`. @see {@link withdrawGuaranteed} */
  withdrawGuaranteedPayload(args: WithdrawGuaranteedArgs): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::GuaranteedYieldLocking::withdraw_guaranteed`,
      [args.positionId],
    );
  }

  /** Payload for `GuaranteedYieldLocking::fund_cashback_vault`. @see {@link fundCashbackVault} */
  fundCashbackVaultPayload(args: FundCashbackVaultArgs): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::GuaranteedYieldLocking::fund_cashback_vault`,
      [args.amount],
    );
  }

  /** Payload for `GuaranteedYieldLocking::request_emergency_unlock_guaranteed`. @see {@link requestEmergencyUnlockGuaranteed} */
  requestEmergencyUnlockGuaranteedPayload(args: RequestEmergencyUnlockGuaranteedArgs): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::GuaranteedYieldLocking::request_emergency_unlock_guaranteed`,
      [args.positionId],
    );
  }

  /** Payload for `GuaranteedYieldLocking::withdraw_emergency_guaranteed`. @see {@link withdrawEmergencyGuaranteed} */
  withdrawEmergencyGuaranteedPayload(args: WithdrawEmergencyGuaranteedArgs): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::GuaranteedYieldLocking::withdraw_emergency_guaranteed`,
      [args.positionId],
    );
  }

  /** Payload for `GuaranteedYieldLocking::set_tier_yield`. @see {@link setTierYield} */
  setTierYieldPayload(args: SetTierYieldArgs): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::GuaranteedYieldLocking::set_tier_yield`,
      [args.tier, args.newYieldBps],
    );
  }

  /** Payload for `GuaranteedYieldLocking::set_treasury`. @see {@link setTreasury} */
  setTreasuryPayload(args: SetTreasuryArgs): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::GuaranteedYieldLocking::set_treasury`,
      [args.newTreasury],
    );
  }

  /** Payload for `GuaranteedYieldLocking::set_deposits_enabled`. @see {@link setDepositsEnabled} */
  setDepositsEnabledPayload(args: SetDepositsEnabledArgs): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::GuaranteedYieldLocking::set_deposits_enabled`,
      [args.enabled],
    );
  }

  /** Payload for `GuaranteedYieldLocking::admin_withdraw_cashback_vault`. @see {@link adminWithdrawCashbackVault} */
  adminWithdrawCashbackVaultPayload(args: AdminWithdrawCashbackVaultArgs): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::GuaranteedYieldLocking::admin_withdraw_cashback_vault`,
      [args.amount],
    );
  }

  /** Payload for `GuaranteedYieldLocking::propose_admin`. @see {@link proposeAdmin} */
  proposeAdminPayload(args: ProposeAdminArgs): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::GuaranteedYieldLocking::propose_admin`,
      [args.newAdmin],
    );
  }

  /** Payload for `GuaranteedYieldLocking::accept_admin`. @see {@link acceptAdmin} */
  acceptAdminPayload(): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::GuaranteedYieldLocking::accept_admin`,
      [],
    );
  }

  /** Payload for `GuaranteedYieldLocking::set_max_total_locked`. @see {@link setMaxTotalLocked} */
  setMaxTotalLockedPayload(args: SetMaxTotalLockedArgs): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::GuaranteedYieldLocking::set_max_total_locked`,
      [args.newMax],
    );
  }

  /** Payload for `GuaranteedYieldLocking::set_min_deposit`. @see {@link setMinDeposit} */
  setMinDepositPayload(args: SetMinDepositArgs): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::GuaranteedYieldLocking::set_min_deposit`,
      [args.newMin],
    );
  }
}
