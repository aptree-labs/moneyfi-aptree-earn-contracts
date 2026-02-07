import { AccountAddressInput } from "@aptos-labs/ts-sdk";
import { BaseModule } from "../base-module";
import type { UserLockPositions, LockConfig } from "../../types/locking";

/**
 * Resource readers for the `aptree::locking` on-chain resources.
 *
 * @example
 * ```typescript
 * const userPositions = await client.locking.resources.getUserLockPositions(userAddress);
 * console.log(userPositions.positions.length);
 * ```
 */
export class LockingResources extends BaseModule {
  /**
   * Read the `locking::UserLockPositions` resource for a given user.
   *
   * Contains all of the user's lock positions and the next position ID counter.
   * This resource is stored at the user's account address.
   *
   * @param user - The user's account address.
   * @returns The user's lock positions resource.
   */
  async getUserLockPositions(
    user: AccountAddressInput,
  ): Promise<UserLockPositions> {
    return this.getResource<UserLockPositions>(
      user,
      `${this.addresses.aptree}::locking::UserLockPositions`,
    );
  }

  /**
   * Read the `locking::LockConfig` resource.
   *
   * Contains global configuration: tier limits, durations, admin address,
   * and whether locks are enabled. Stored at the locking controller resource account.
   *
   * @param configAddress - The controller resource account address.
   * @returns The locking configuration resource.
   */
  async getLockConfig(
    configAddress: AccountAddressInput,
  ): Promise<LockConfig> {
    return this.getResource<LockConfig>(
      configAddress,
      `${this.addresses.aptree}::locking::LockConfig`,
    );
  }
}
