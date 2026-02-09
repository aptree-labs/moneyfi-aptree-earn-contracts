import { Aptos } from "@aptos-labs/ts-sdk";
import { AptreeAddresses } from "../../config";
import { BaseModule } from "../base-module";
import { BridgeBuilder } from "./builder";
import { BridgeResources } from "./resources";

/**
 * Module for interacting with the `aptree::bridge` and `aptree::moneyfi_adapter` contracts.
 *
 * Provides:
 * - {@link BridgeModule.builder | builder} — Transaction builders for all entry functions.
 * - {@link BridgeModule.resources | resources} — Typed readers for on-chain resources.
 * - View functions as direct methods (e.g. {@link BridgeModule.getSupportedToken | getSupportedToken}).
 *
 * @example
 * ```typescript
 * // Build and submit a deposit transaction
 * const txn = await client.bridge.builder.deposit(sender, { amount: 1_00000000, provider: 0 });
 *
 * // Query the current LP price
 * const lpPrice = await client.bridge.getLpPrice();
 *
 * // Read on-chain state
 * const state = await client.bridge.resources.getBridgeState(bridgeAddress);
 * ```
 */
export class BridgeModule extends BaseModule {
  /** Transaction builders for bridge entry functions. */
  readonly builder: BridgeBuilder;
  /** Typed readers for bridge on-chain resources. */
  readonly resources: BridgeResources;

  constructor(aptos: Aptos, addresses: AptreeAddresses) {
    super(aptos, addresses);
    this.builder = new BridgeBuilder(aptos, addresses);
    this.resources = new BridgeResources(aptos, addresses);
  }

  // ── View Functions ─────────────────────────────────────────────────────

  /**
   * Get the address of the supported underlying token (e.g. USDT metadata object).
   *
   * Calls `moneyfi_adapter::get_supported_token`.
   *
   * @returns The address of the supported fungible asset metadata object.
   */
  async getSupportedToken(): Promise<string> {
    const [result] = await this.view<[string]>(
      `${this.addresses.aptree}::moneyfi_adapter::get_supported_token`,
    );
    return result;
  }

  /**
   * Get the current LP (AET) share price.
   *
   * Calls `moneyfi_adapter::get_lp_price`.
   *
   * The price is scaled by AET_SCALE (1e9). A value of `1_000_000_000` means 1:1.
   *
   * @returns The current share price as a number (u128).
   */
  async getLpPrice(): Promise<number> {
    const [result] = await this.view<[string]>(
      `${this.addresses.aptree}::moneyfi_adapter::get_lp_price`,
    );
    return Number(result);
  }

  /**
   * Get the total estimated value of the pool in the underlying token.
   *
   * Calls `moneyfi_adapter::get_pool_estimated_value`.
   *
   * @returns The pool's estimated total value.
   */
  async getPoolEstimatedValue(): Promise<number> {
    const [result] = await this.view<[string]>(
      `${this.addresses.aptree}::moneyfi_adapter::get_pool_estimated_value`,
    );
    return Number(result);
  }
}

export { BridgeBuilder } from "./builder";
export { BridgeResources } from "./resources";
