import { AccountAddressInput } from "@aptos-labs/ts-sdk";
import { BaseModule } from "../base-module";
import type {
  MockVaultState,
  DepositorState,
} from "../../types/mock-vault";

/**
 * Resource readers for the `moneyfi_mock::vault` on-chain resources.
 *
 * @example
 * ```typescript
 * const vaultState = await client.mockVault.resources.getMockVaultState(vaultAddress);
 * console.log(vaultState.total_deposits);
 * ```
 */
export class MockVaultResources extends BaseModule {
  /**
   * Read the `vault::MockVaultState` resource.
   *
   * Contains global vault state: total deposits, yield multiplier, pending
   * withdrawals, and admin address.
   *
   * @param address - The vault resource account address.
   * @returns The mock vault state.
   */
  async getMockVaultState(
    address: AccountAddressInput,
  ): Promise<MockVaultState> {
    return this.getResource<MockVaultState>(
      address,
      `${this.addresses.moneyfi}::vault::MockVaultState`,
    );
  }

  /**
   * Read the `vault::DepositorState` resource for a specific depositor.
   *
   * Contains the depositor's deposited amount and pending withdrawal amount.
   *
   * @param depositor - The depositor's account address.
   * @returns The depositor's state.
   */
  async getDepositorState(
    depositor: AccountAddressInput,
  ): Promise<DepositorState> {
    return this.getResource<DepositorState>(
      depositor,
      `${this.addresses.moneyfi}::vault::DepositorState`,
    );
  }
}
