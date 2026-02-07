import { Aptos, AccountAddressInput } from "@aptos-labs/ts-sdk";
import { AptreeAddresses } from "../../config";
import { BaseModule } from "../base-module";
import { MockVaultBuilder } from "./builder";
import { MockVaultResources } from "./resources";
import type { DepositorStateView } from "../../types/mock-vault";

/**
 * Module for interacting with the `moneyfi_mock::vault` contract.
 *
 * This is a mock implementation of the MoneyFi vault, useful for testing
 * on devnet/testnet. It supports yield simulation, loss simulation, and
 * manual state manipulation.
 *
 * Provides:
 * - {@link MockVaultModule.builder | builder} — Transaction builders for all entry functions.
 * - {@link MockVaultModule.resources | resources} — Typed readers for on-chain resources.
 * - View functions as direct methods (e.g. {@link MockVaultModule.getTotalDeposits | getTotalDeposits}).
 *
 * @example
 * ```typescript
 * // Get vault address
 * const vaultAddr = await client.mockVault.getVaultAddress();
 *
 * // Get depositor state
 * const state = await client.mockVault.getDepositorState("0xabc...");
 * ```
 */
export class MockVaultModule extends BaseModule {
  /** Transaction builders for mock vault entry functions. */
  readonly builder: MockVaultBuilder;
  /** Typed readers for mock vault on-chain resources. */
  readonly resources: MockVaultResources;

  constructor(aptos: Aptos, addresses: AptreeAddresses) {
    super(aptos, addresses);
    this.builder = new MockVaultBuilder(aptos, addresses);
    this.resources = new MockVaultResources(aptos, addresses);
  }

  // ── View Functions ─────────────────────────────────────────────────────

  /**
   * Estimate the total fund value for a depositor and token.
   *
   * Calls `vault::estimate_total_fund_value`.
   *
   * @param depositor - The depositor's account address.
   * @param token - The fungible asset metadata object address.
   * @returns The estimated total fund value.
   */
  async estimateTotalFundValue(
    depositor: AccountAddressInput,
    token: string,
  ): Promise<bigint> {
    const [result] = await this.view<[string]>(
      `${this.addresses.moneyfi}::vault::estimate_total_fund_value`,
      [depositor, token],
    );
    return BigInt(result);
  }

  /**
   * Get the vault's resource account address.
   *
   * Calls `vault::get_vault_address`.
   *
   * @returns The vault resource account address.
   */
  async getVaultAddress(): Promise<string> {
    const [result] = await this.view<[string]>(
      `${this.addresses.moneyfi}::vault::get_vault_address`,
    );
    return result;
  }

  /**
   * Get the current yield multiplier in basis points.
   *
   * Calls `vault::get_yield_multiplier`.
   *
   * @returns The yield multiplier BPS value.
   */
  async getYieldMultiplier(): Promise<bigint> {
    const [result] = await this.view<[string]>(
      `${this.addresses.moneyfi}::vault::get_yield_multiplier`,
    );
    return BigInt(result);
  }

  /**
   * Get the total deposits held in the vault.
   *
   * Calls `vault::get_total_deposits`.
   *
   * @returns The total deposits amount.
   */
  async getTotalDeposits(): Promise<bigint> {
    const [result] = await this.view<[string]>(
      `${this.addresses.moneyfi}::vault::get_total_deposits`,
    );
    return BigInt(result);
  }

  /**
   * Get the total pending withdrawals in the vault.
   *
   * Calls `vault::get_pending_withdrawals`.
   *
   * @returns The total pending withdrawal amount.
   */
  async getPendingWithdrawals(): Promise<bigint> {
    const [result] = await this.view<[string]>(
      `${this.addresses.moneyfi}::vault::get_pending_withdrawals`,
    );
    return BigInt(result);
  }

  /**
   * Get the state of a specific depositor.
   *
   * Calls `vault::get_depositor_state`.
   *
   * @param depositor - The depositor's account address.
   * @returns A {@link DepositorStateView} with deposited and pending withdrawal amounts.
   */
  async getDepositorState(
    depositor: AccountAddressInput,
  ): Promise<DepositorStateView> {
    const [deposited, pendingWithdrawal] = await this.view<[string, string]>(
      `${this.addresses.moneyfi}::vault::get_depositor_state`,
      [depositor],
    );
    return {
      deposited: BigInt(deposited),
      pendingWithdrawal: BigInt(pendingWithdrawal),
    };
  }
}

export { MockVaultBuilder } from "./builder";
export { MockVaultResources } from "./resources";
