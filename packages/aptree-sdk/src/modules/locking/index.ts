import { Aptos, AccountAddressInput } from "@aptos-labs/ts-sdk";
import { AptreeAddresses } from "../../config";
import { BaseModule } from "../base-module";
import { LockingBuilder } from "./builder";
import { LockingResources } from "./resources";
import type {
  LockPosition,
  TierConfig,
  EmergencyUnlockPreview,
} from "../../types/locking";

/**
 * Module for interacting with the `aptree::locking` contract.
 *
 * Provides:
 * - {@link LockingModule.builder | builder} — Transaction builders for all entry functions.
 * - {@link LockingModule.resources | resources} — Typed readers for on-chain resources.
 * - View functions as direct methods (e.g. {@link LockingModule.getUserPositions | getUserPositions}).
 *
 * @example
 * ```typescript
 * // Query a user's lock positions
 * const positions = await client.locking.getUserPositions("0xabc...");
 *
 * // Check if a position is unlocked
 * const unlocked = await client.locking.isPositionUnlocked("0xabc...", 0);
 *
 * // Build a deposit transaction
 * const txn = await client.locking.builder.depositLocked(sender, {
 *   amount: 100_000_000,
 *   tier: LockingTier.Gold,
 * });
 * ```
 */
export class LockingModule extends BaseModule {
  /** Transaction builders for locking entry functions. */
  readonly builder: LockingBuilder;
  /** Typed readers for locking on-chain resources. */
  readonly resources: LockingResources;

  constructor(aptos: Aptos, addresses: AptreeAddresses) {
    super(aptos, addresses);
    this.builder = new LockingBuilder(aptos, addresses);
    this.resources = new LockingResources(aptos, addresses);
  }

  // ── View Functions ─────────────────────────────────────────────────────

  /**
   * Get all lock positions for a user.
   *
   * Calls `locking::get_user_positions`.
   *
   * @param user - The user's account address.
   * @returns Array of {@link LockPosition} structs.
   */
  async getUserPositions(
    user: AccountAddressInput,
  ): Promise<LockPosition[]> {
    const [result] = await this.view<[LockPosition[]]>(
      `${this.addresses.aptree}::locking::get_user_positions`,
      [user],
    );
    return result;
  }

  /**
   * Get a specific lock position for a user.
   *
   * Calls `locking::get_position`.
   *
   * @param user - The user's account address.
   * @param positionId - The position ID.
   * @returns The {@link LockPosition} struct.
   */
  async getPosition(
    user: AccountAddressInput,
    positionId: number,
  ): Promise<LockPosition> {
    const [result] = await this.view<[LockPosition]>(
      `${this.addresses.aptree}::locking::get_position`,
      [user, positionId],
    );
    return result;
  }

  /**
   * Get the amount available for early withdrawal from a position.
   *
   * Calls `locking::get_early_withdrawal_available`.
   *
   * The available amount is calculated based on the tier's BPS limit applied
   * to the position's principal, minus any early withdrawals already taken.
   *
   * @param user - The user's account address.
   * @param positionId - The position ID.
   * @returns The amount available for early withdrawal.
   */
  async getEarlyWithdrawalAvailable(
    user: AccountAddressInput,
    positionId: number,
  ): Promise<number> {
    const [result] = await this.view<[string]>(
      `${this.addresses.aptree}::locking::get_early_withdrawal_available`,
      [user, positionId],
    );
    return Number(result);
  }

  /**
   * Check if a lock position has passed its unlock date.
   *
   * Calls `locking::is_position_unlocked`.
   *
   * @param user - The user's account address.
   * @param positionId - The position ID.
   * @returns `true` if the position can be fully withdrawn.
   */
  async isPositionUnlocked(
    user: AccountAddressInput,
    positionId: number,
  ): Promise<boolean> {
    const [result] = await this.view<[boolean]>(
      `${this.addresses.aptree}::locking::is_position_unlocked`,
      [user, positionId],
    );
    return result;
  }

  /**
   * Get the total locked value across all of a user's positions.
   *
   * Calls `locking::get_user_total_locked_value`.
   *
   * @param user - The user's account address.
   * @returns The total locked value in the underlying token.
   */
  async getUserTotalLockedValue(
    user: AccountAddressInput,
  ): Promise<number> {
    const [result] = await this.view<[string]>(
      `${this.addresses.aptree}::locking::get_user_total_locked_value`,
      [user],
    );
    return Number(result);
  }

  /**
   * Get the configuration for a specific tier.
   *
   * Calls `locking::get_tier_config`.
   *
   * @param tier - The tier number (1=Bronze, 2=Silver, 3=Gold).
   * @returns A {@link TierConfig} with the tier's duration and early withdrawal limit.
   */
  async getTierConfig(tier: number): Promise<TierConfig> {
    const [durationSeconds, earlyLimitBps] = await this.view<[string, string]>(
      `${this.addresses.aptree}::locking::get_tier_config`,
      [tier],
    );
    return {
      durationSeconds: Number(durationSeconds),
      earlyLimitBps: Number(earlyLimitBps),
    };
  }

  /**
   * Preview the outcome of an emergency unlock for a position.
   *
   * Calls `locking::get_emergency_unlock_preview`.
   *
   * @param user - The user's account address.
   * @param positionId - The position ID.
   * @returns A {@link EmergencyUnlockPreview} with the expected payout and forfeited amount.
   */
  async getEmergencyUnlockPreview(
    user: AccountAddressInput,
    positionId: number,
  ): Promise<EmergencyUnlockPreview> {
    const [payout, forfeited] = await this.view<[string, string]>(
      `${this.addresses.aptree}::locking::get_emergency_unlock_preview`,
      [user, positionId],
    );
    return {
      payout: Number(payout),
      forfeited: Number(forfeited),
    };
  }
}

export { LockingBuilder } from "./builder";
export { LockingResources } from "./resources";
