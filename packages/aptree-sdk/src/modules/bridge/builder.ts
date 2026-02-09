import { AccountAddressInput, SimpleTransaction } from "@aptos-labs/ts-sdk";
import { BaseModule } from "../base-module";
import type {
  BridgeDepositArgs,
  BridgeRequestArgs,
  BridgeWithdrawArgs,
  MoneyFiAdapterDepositArgs,
  MoneyFiAdapterRequestArgs,
  MoneyFiAdapterWithdrawArgs,
} from "../../types/bridge";

/**
 * Transaction builders for the `aptree::bridge` and `aptree::moneyfi_adapter` entry functions.
 *
 * Each method returns a {@link SimpleTransaction} that can be signed and submitted
 * via the Aptos SDK.
 *
 * @example
 * ```typescript
 * const txn = await client.bridge.builder.deposit(senderAddress, {
 *   amount: 100_000_000,
 *   provider: 0,
 * });
 * const signed = client.aptos.transaction.sign({ signer, transaction: txn });
 * const result = await client.aptos.transaction.submit.simple({ transaction: txn, senderAuthenticator: signed });
 * ```
 */
export class BridgeBuilder extends BaseModule {
  // ── bridge module entry functions ────────────────────────────────────────

  /**
   * Build a `bridge::deposit` transaction.
   *
   * Deposits the specified amount of the underlying token through the bridge,
   * routing through the given provider. The user receives AET share tokens in return.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link BridgeDepositArgs}
   * @returns A built transaction ready for signing.
   */
  async deposit(
    sender: AccountAddressInput,
    args: BridgeDepositArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::bridge::deposit`,
      [args.amount, args.provider],
    );
  }

  /**
   * Build a `bridge::request` transaction.
   *
   * Requests a withdrawal by burning AET share tokens. The `minAmount` parameter
   * provides slippage protection — the transaction reverts if the share price is
   * below this threshold.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link BridgeRequestArgs}
   * @returns A built transaction ready for signing.
   */
  async request(
    sender: AccountAddressInput,
    args: BridgeRequestArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::bridge::request`,
      [args.amount, args.minAmount],
    );
  }

  /**
   * Build a `bridge::withdraw` transaction.
   *
   * Completes a pending withdrawal request, transferring the underlying tokens
   * back to the user.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link BridgeWithdrawArgs}
   * @returns A built transaction ready for signing.
   */
  async withdraw(
    sender: AccountAddressInput,
    args: BridgeWithdrawArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::bridge::withdraw`,
      [args.amount, args.provider],
    );
  }

  // ── moneyfi_adapter module entry functions ───────────────────────────────

  /**
   * Build a `moneyfi_adapter::deposit` transaction.
   *
   * Deposits directly through the MoneyFi adapter without specifying a provider.
   * This is the lower-level deposit function used internally by the bridge.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link MoneyFiAdapterDepositArgs}
   * @returns A built transaction ready for signing.
   */
  async adapterDeposit(
    sender: AccountAddressInput,
    args: MoneyFiAdapterDepositArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::moneyfi_adapter::deposit`,
      [args.amount],
    );
  }

  /**
   * Build a `moneyfi_adapter::request` transaction.
   *
   * Requests a withdrawal through the adapter with minimum share price protection.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link MoneyFiAdapterRequestArgs}
   * @returns A built transaction ready for signing.
   */
  async adapterRequest(
    sender: AccountAddressInput,
    args: MoneyFiAdapterRequestArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::moneyfi_adapter::request`,
      [args.amount, args.minSharePrice],
    );
  }

  /**
   * Build a `moneyfi_adapter::withdraw` transaction.
   *
   * Completes a pending withdrawal through the adapter.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link MoneyFiAdapterWithdrawArgs}
   * @returns A built transaction ready for signing.
   */
  async adapterWithdraw(
    sender: AccountAddressInput,
    args: MoneyFiAdapterWithdrawArgs,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::moneyfi_adapter::withdraw`,
      [args.amount],
    );
  }
}
