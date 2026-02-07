import { AccountAddressInput } from "@aptos-labs/ts-sdk";
import { BaseModule } from "../base-module";
import type {
  BridgeState,
  MoneyFiBridgeState,
  MoneyFiReserveState,
  BridgeWithdrawalTokenState,
} from "../../types/bridge";

/**
 * Resource readers for the `aptree::bridge` and `aptree::moneyfi_adapter` on-chain resources.
 *
 * Resources are raw Move structs stored on-chain at specific account addresses.
 * Use these methods to read the current state of the bridge contracts.
 *
 * @example
 * ```typescript
 * const bridgeState = await client.bridge.resources.getBridgeState(bridgeResourceAddress);
 * ```
 */
export class BridgeResources extends BaseModule {
  /**
   * Read the `bridge::State` resource.
   *
   * This resource is created during module initialization and stored at the
   * bridge's resource account address.
   *
   * @param address - The account address holding the resource.
   * @returns The bridge state containing the signer capability.
   */
  async getBridgeState(address: AccountAddressInput): Promise<BridgeState> {
    return this.getResource<BridgeState>(
      address,
      `${this.addresses.aptree}::bridge::State`,
    );
  }

  /**
   * Read the `moneyfi_adapter::BridgeState` resource.
   *
   * Contains controller and reserve addresses and their signer capabilities.
   *
   * @param address - The controller resource account address.
   * @returns The MoneyFi bridge state.
   */
  async getMoneyFiBridgeState(
    address: AccountAddressInput,
  ): Promise<MoneyFiBridgeState> {
    return this.getResource<MoneyFiBridgeState>(
      address,
      `${this.addresses.aptree}::moneyfi_adapter::BridgeState`,
    );
  }

  /**
   * Read the `moneyfi_adapter::ReserveState` resource.
   *
   * Contains mint/burn/transfer references and the AET token address.
   *
   * @param address - The reserve resource account address.
   * @returns The reserve state.
   */
  async getReserveState(
    address: AccountAddressInput,
  ): Promise<MoneyFiReserveState> {
    return this.getResource<MoneyFiReserveState>(
      address,
      `${this.addresses.aptree}::moneyfi_adapter::ReserveState`,
    );
  }

  /**
   * Read the `moneyfi_adapter::BridgeWithdrawalTokenState` resource.
   *
   * Contains mint/burn/transfer references for withdrawal tokens (AEWT).
   *
   * @param address - The reserve resource account address.
   * @returns The withdrawal token state.
   */
  async getWithdrawalTokenState(
    address: AccountAddressInput,
  ): Promise<BridgeWithdrawalTokenState> {
    return this.getResource<BridgeWithdrawalTokenState>(
      address,
      `${this.addresses.aptree}::moneyfi_adapter::BridgeWithdrawalTokenState`,
    );
  }
}
