import { Aptos, AccountAddressInput } from "@aptos-labs/ts-sdk";
import { AptreeAddresses } from "../../config";
import { BaseModule } from "../base-module";
import { GuaranteedYieldBuilder } from "./builder";
import { GuaranteedYieldResources } from "./resources";
import type {
  GuaranteedLockPosition,
  ProtocolStats,
  GuaranteedTierConfig,
  GuaranteedEmergencyUnlockPreview,
} from "../../types/guaranteed-yield";

/**
 * Module for interacting with the `aptree::GuaranteedYieldLocking` contract.
 *
 * Provides:
 * - {@link GuaranteedYieldModule.builder | builder} — Transaction builders for all entry functions.
 * - {@link GuaranteedYieldModule.resources | resources} — Typed readers for on-chain resources.
 * - View functions as direct methods (e.g. {@link GuaranteedYieldModule.getProtocolStats | getProtocolStats}).
 *
 * @example
 * ```typescript
 * // Deposit with guaranteed yield
 * const txn = await client.guaranteedYield.builder.depositGuaranteed(sender, {
 *   amount: 100_000_000n,
 *   tier: GuaranteedYieldTier.Silver,
 *   minAetReceived: 0n,
 * });
 *
 * // Check cashback for a given amount and tier
 * const cashback = await client.guaranteedYield.calculateCashback(100_000_000n, 3);
 *
 * // Get protocol-wide stats
 * const stats = await client.guaranteedYield.getProtocolStats();
 * ```
 */
export class GuaranteedYieldModule extends BaseModule {
  /** Transaction builders for guaranteed-yield entry functions. */
  readonly builder: GuaranteedYieldBuilder;
  /** Typed readers for guaranteed-yield on-chain resources. */
  readonly resources: GuaranteedYieldResources;

  constructor(aptos: Aptos, addresses: AptreeAddresses) {
    super(aptos, addresses);
    this.builder = new GuaranteedYieldBuilder(aptos, addresses);
    this.resources = new GuaranteedYieldResources(aptos, addresses);
  }

  // ── View Functions ─────────────────────────────────────────────────────

  /**
   * Get all guaranteed-yield positions for a user.
   *
   * Calls `GuaranteedYieldLocking::get_user_guaranteed_positions`.
   *
   * @param user - The user's account address.
   * @returns Array of {@link GuaranteedLockPosition} structs.
   */
  async getUserGuaranteedPositions(
    user: AccountAddressInput,
  ): Promise<GuaranteedLockPosition[]> {
    const [result] = await this.view<[GuaranteedLockPosition[]]>(
      `${this.addresses.aptree}::GuaranteedYieldLocking::get_user_guaranteed_positions`,
      [user],
    );
    return result;
  }

  /**
   * Get a specific guaranteed-yield position.
   *
   * Calls `GuaranteedYieldLocking::get_guaranteed_position`.
   *
   * @param user - The user's account address.
   * @param positionId - The position ID.
   * @returns The {@link GuaranteedLockPosition} struct.
   */
  async getGuaranteedPosition(
    user: AccountAddressInput,
    positionId: bigint,
  ): Promise<GuaranteedLockPosition> {
    const [result] = await this.view<[GuaranteedLockPosition]>(
      `${this.addresses.aptree}::GuaranteedYieldLocking::get_guaranteed_position`,
      [user, positionId],
    );
    return result;
  }

  /**
   * Get the guaranteed yield rate (in BPS) for a tier.
   *
   * Calls `GuaranteedYieldLocking::get_tier_guaranteed_yield`.
   *
   * @param tier - The tier number (1=Starter, 2=Bronze, 3=Silver, 4=Gold).
   * @returns The yield in basis points (e.g. 500 = 5%).
   */
  async getTierGuaranteedYield(tier: number): Promise<bigint> {
    const [result] = await this.view<[string]>(
      `${this.addresses.aptree}::GuaranteedYieldLocking::get_tier_guaranteed_yield`,
      [tier],
    );
    return BigInt(result);
  }

  /**
   * Get the lock duration (in seconds) for a tier.
   *
   * Calls `GuaranteedYieldLocking::get_tier_duration`.
   *
   * @param tier - The tier number (1=Starter, 2=Bronze, 3=Silver, 4=Gold).
   * @returns The lock duration in seconds.
   */
  async getTierDuration(tier: number): Promise<bigint> {
    const [result] = await this.view<[string]>(
      `${this.addresses.aptree}::GuaranteedYieldLocking::get_tier_duration`,
      [tier],
    );
    return BigInt(result);
  }

  /**
   * Calculate the cashback amount for a given deposit amount and tier.
   *
   * Calls `GuaranteedYieldLocking::calculate_cashback`.
   *
   * @param amount - The deposit amount.
   * @param tier - The tier number.
   * @returns The cashback amount in the underlying token.
   */
  async calculateCashback(amount: bigint, tier: number): Promise<bigint> {
    const [result] = await this.view<[string]>(
      `${this.addresses.aptree}::GuaranteedYieldLocking::calculate_cashback`,
      [amount, tier],
    );
    return BigInt(result);
  }

  /**
   * Get the current balance of the cashback vault.
   *
   * Calls `GuaranteedYieldLocking::get_cashback_vault_balance`.
   *
   * @returns The vault balance in the underlying token.
   */
  async getCashbackVaultBalance(): Promise<bigint> {
    const [result] = await this.view<[string]>(
      `${this.addresses.aptree}::GuaranteedYieldLocking::get_cashback_vault_balance`,
    );
    return BigInt(result);
  }

  /**
   * Get protocol-wide statistics.
   *
   * Calls `GuaranteedYieldLocking::get_protocol_stats`.
   *
   * @returns A {@link ProtocolStats} object with total locked principal, AET held,
   *   cashback paid, and yield sent to treasury.
   */
  async getProtocolStats(): Promise<ProtocolStats> {
    const [totalLockedPrincipal, totalAetHeld, totalCashbackPaid, totalYieldToTreasury] =
      await this.view<[string, string, string, string]>(
        `${this.addresses.aptree}::GuaranteedYieldLocking::get_protocol_stats`,
      );
    return {
      totalLockedPrincipal: BigInt(totalLockedPrincipal),
      totalAetHeld: BigInt(totalAetHeld),
      totalCashbackPaid: BigInt(totalCashbackPaid),
      totalYieldToTreasury: BigInt(totalYieldToTreasury),
    };
  }

  /**
   * Check if a position has passed its unlock date and can be unlocked.
   *
   * Calls `GuaranteedYieldLocking::is_position_unlockable`.
   *
   * @param user - The user's account address.
   * @param positionId - The position ID.
   * @returns `true` if the position can be unlocked.
   */
  async isPositionUnlockable(
    user: AccountAddressInput,
    positionId: bigint,
  ): Promise<boolean> {
    const [result] = await this.view<[boolean]>(
      `${this.addresses.aptree}::GuaranteedYieldLocking::is_position_unlockable`,
      [user, positionId],
    );
    return result;
  }

  /**
   * Get the configuration for a specific tier.
   *
   * Calls `GuaranteedYieldLocking::get_tier_config`.
   *
   * @param tier - The tier number (1=Starter, 2=Bronze, 3=Silver, 4=Gold).
   * @returns A {@link GuaranteedTierConfig} with duration and yield BPS.
   */
  async getTierConfig(tier: number): Promise<GuaranteedTierConfig> {
    const [durationSeconds, yieldBps] = await this.view<[string, string]>(
      `${this.addresses.aptree}::GuaranteedYieldLocking::get_tier_config`,
      [tier],
    );
    return {
      durationSeconds: BigInt(durationSeconds),
      yieldBps: BigInt(yieldBps),
    };
  }

  /**
   * Get the current treasury address.
   *
   * Calls `GuaranteedYieldLocking::get_treasury`.
   *
   * @returns The treasury address that receives excess yield.
   */
  async getTreasury(): Promise<string> {
    const [result] = await this.view<[string]>(
      `${this.addresses.aptree}::GuaranteedYieldLocking::get_treasury`,
    );
    return result;
  }

  /**
   * Check if guaranteed-yield deposits are currently enabled.
   *
   * Calls `GuaranteedYieldLocking::are_deposits_enabled`.
   *
   * @returns `true` if deposits are enabled.
   */
  async areDepositsEnabled(): Promise<boolean> {
    const [result] = await this.view<[boolean]>(
      `${this.addresses.aptree}::GuaranteedYieldLocking::are_deposits_enabled`,
    );
    return result;
  }

  /**
   * Preview the outcome of an emergency unlock for a guaranteed-yield position.
   *
   * Calls `GuaranteedYieldLocking::get_emergency_unlock_preview`.
   *
   * @param user - The user's account address.
   * @param positionId - The position ID.
   * @returns A {@link GuaranteedEmergencyUnlockPreview} with the expected payout,
   *   yield forfeited, and cashback clawback amounts.
   */
  async getEmergencyUnlockPreview(
    user: AccountAddressInput,
    positionId: bigint,
  ): Promise<GuaranteedEmergencyUnlockPreview> {
    const [payout, yieldForfeited, cashbackClawback] = await this.view<
      [string, string, string]
    >(
      `${this.addresses.aptree}::GuaranteedYieldLocking::get_emergency_unlock_preview`,
      [user, positionId],
    );
    return {
      payout: BigInt(payout),
      yieldForfeited: BigInt(yieldForfeited),
      cashbackClawback: BigInt(cashbackClawback),
    };
  }

  /**
   * Get the maximum total locked principal allowed across all positions.
   *
   * Calls `GuaranteedYieldLocking::get_max_total_locked`.
   *
   * @returns The maximum total locked principal.
   */
  async getMaxTotalLocked(): Promise<bigint> {
    const [result] = await this.view<[string]>(
      `${this.addresses.aptree}::GuaranteedYieldLocking::get_max_total_locked`,
    );
    return BigInt(result);
  }

  /**
   * Get the minimum deposit amount for new positions.
   *
   * Calls `GuaranteedYieldLocking::get_min_deposit`.
   *
   * @returns The minimum deposit amount.
   */
  async getMinDeposit(): Promise<bigint> {
    const [result] = await this.view<[string]>(
      `${this.addresses.aptree}::GuaranteedYieldLocking::get_min_deposit`,
    );
    return BigInt(result);
  }
}

export { GuaranteedYieldBuilder } from "./builder";
export { GuaranteedYieldResources } from "./resources";
