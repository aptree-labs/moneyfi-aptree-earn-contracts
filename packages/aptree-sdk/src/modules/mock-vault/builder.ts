import { AccountAddressInput, SimpleTransaction } from "@aptos-labs/ts-sdk";
import { BaseModule } from "../base-module";
import type {
  MockVaultDepositArgs,
  MockVaultRequestWithdrawArgs,
  MockVaultWithdrawRequestedArgs,
  SetYieldMultiplierArgs,
  SimulateYieldArgs,
  SimulateLossArgs,
  SetTotalDepositsArgs,
} from "../../types/mock-vault";

/**
 * Transaction builders for the `moneyfi_mock::vault` entry functions.
 *
 * This module wraps a mock implementation of the MoneyFi vault, useful for
 * testing on devnet/testnet.
 *
 * @example
 * ```typescript
 * const txn = await client.mockVault.builder.deposit(sender, {
 *   token: tokenMetadataAddress,
 *   amount: 1_000_000_00n,
 * });
 * ```
 */
export class MockVaultBuilder extends BaseModule {
  // ── Core vault entry functions ───────────────────────────────────────────

  /**
   * Build a `vault::deposit` transaction.
   *
   * Deposits a fungible asset into the mock vault.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link MockVaultDepositArgs}
   * @returns A built transaction ready for signing.
   */
  async deposit(
    sender: AccountAddressInput,
    args: MockVaultDepositArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.moneyfi}::vault::deposit`,
      [args.token, args.amount],
    );
  }

  /**
   * Build a `vault::request_withdraw` transaction.
   *
   * Requests a withdrawal from the mock vault.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link MockVaultRequestWithdrawArgs}
   * @returns A built transaction ready for signing.
   */
  async requestWithdraw(
    sender: AccountAddressInput,
    args: MockVaultRequestWithdrawArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.moneyfi}::vault::request_withdraw`,
      [args.token, args.amount],
    );
  }

  /**
   * Build a `vault::withdraw_requested_amount` transaction.
   *
   * Completes a pending withdrawal from the mock vault.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link MockVaultWithdrawRequestedArgs}
   * @returns A built transaction ready for signing.
   */
  async withdrawRequestedAmount(
    sender: AccountAddressInput,
    args: MockVaultWithdrawRequestedArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.moneyfi}::vault::withdraw_requested_amount`,
      [args.token],
    );
  }

  // ── Admin / test-tuning entry functions ──────────────────────────────────

  /**
   * Build a `vault::set_yield_multiplier` transaction.
   *
   * Sets the yield multiplier in basis points for the mock vault.
   *
   * @remarks Admin only.
   * @param sender - The admin account address.
   * @param args - {@link SetYieldMultiplierArgs}
   */
  async setYieldMultiplier(
    sender: AccountAddressInput,
    args: SetYieldMultiplierArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.moneyfi}::vault::set_yield_multiplier`,
      [args.multiplierBps],
    );
  }

  /**
   * Build a `vault::simulate_yield` transaction.
   *
   * Simulates yield by increasing total deposits by the given BPS.
   *
   * @remarks Admin only.
   * @param sender - The admin account address.
   * @param args - {@link SimulateYieldArgs}
   */
  async simulateYield(
    sender: AccountAddressInput,
    args: SimulateYieldArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.moneyfi}::vault::simulate_yield`,
      [args.yieldBps],
    );
  }

  /**
   * Build a `vault::simulate_loss` transaction.
   *
   * Simulates a loss by decreasing total deposits by the given BPS.
   *
   * @remarks Admin only.
   * @param sender - The admin account address.
   * @param args - {@link SimulateLossArgs}
   */
  async simulateLoss(
    sender: AccountAddressInput,
    args: SimulateLossArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.moneyfi}::vault::simulate_loss`,
      [args.lossBps],
    );
  }

  /**
   * Build a `vault::reset_vault` transaction.
   *
   * Resets the mock vault state (total deposits, pending withdrawals, multiplier).
   *
   * @remarks Admin only.
   * @param sender - The admin account address.
   */
  async resetVault(
    sender: AccountAddressInput,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.moneyfi}::vault::reset_vault`,
      [],
    );
  }

  /**
   * Build a `vault::set_total_deposits` transaction.
   *
   * Directly sets the total deposits value for testing.
   *
   * @remarks Admin only.
   * @param sender - The admin account address.
   * @param args - {@link SetTotalDepositsArgs}
   */
  async setTotalDeposits(
    sender: AccountAddressInput,
    args: SetTotalDepositsArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.moneyfi}::vault::set_total_deposits`,
      [args.amount],
    );
  }
}
