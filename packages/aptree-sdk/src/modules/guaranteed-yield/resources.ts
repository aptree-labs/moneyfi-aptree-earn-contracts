import { AccountAddressInput } from "@aptos-labs/ts-sdk";
import { BaseModule } from "../base-module";
import type { UserGuaranteedPositions } from "../../types/guaranteed-yield";

/**
 * Resource readers for the `aptree::GuaranteedYieldLocking` on-chain resources.
 *
 * @example
 * ```typescript
 * const positions = await client.guaranteedYield.resources.getUserGuaranteedPositions(userAddress);
 * ```
 */
export class GuaranteedYieldResources extends BaseModule {
  /**
   * Read the `GuaranteedYieldLocking::UserGuaranteedPositions` resource for a user.
   *
   * Contains all of the user's guaranteed-yield positions and the next position ID.
   * Stored at the user's account address.
   *
   * @param user - The user's account address.
   * @returns The user's guaranteed-yield positions resource.
   */
  async getUserGuaranteedPositions(
    user: AccountAddressInput,
  ): Promise<UserGuaranteedPositions> {
    return this.getResource<UserGuaranteedPositions>(
      user,
      `${this.addresses.aptree}::GuaranteedYieldLocking::UserGuaranteedPositions`,
    );
  }
}
