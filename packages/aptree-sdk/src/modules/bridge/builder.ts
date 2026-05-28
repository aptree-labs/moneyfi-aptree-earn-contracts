import {
  AccountAddressInput,
  InputEntryFunctionData,
  SimpleTransaction,
} from "@aptos-labs/ts-sdk";
import { BaseModule, BuildTransactionOptions } from "../base-module";
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
    options?: BuildTransactionOptions,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::bridge::deposit`,
      [args.amount, args.provider],
      undefined,
      options,
    );
  }

  /**
   * Build a `bridge::request` transaction.
   *
   * Requests a withdrawal by burning AET share tokens. The `minAmount` parameter
   * provides slippage protection — the transaction reverts if the share price is
   * below this threshold.
   *
   * The base module applies a generous default `maxGasAmount` (2M) so the
   * vault + price-monitor + withdrawal-limits gates don't trip the simulator's
   * compute budget. Pass `options.maxGasAmount` to override per call.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link BridgeRequestArgs}
   * @param options - Optional gas / expiry overrides.
   * @returns A built transaction ready for signing.
   */
  async request(
    sender: AccountAddressInput,
    args: BridgeRequestArgs,
    options?: BuildTransactionOptions,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::bridge::request`,
      [args.amount, args.minAmount],
      undefined,
      options,
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
   * @param options - Optional gas / expiry overrides.
   * @returns A built transaction ready for signing.
   */
  async withdraw(
    sender: AccountAddressInput,
    args: BridgeWithdrawArgs,
    options?: BuildTransactionOptions,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::bridge::withdraw`,
      [args.amount, args.provider],
      undefined,
      options,
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
    options?: BuildTransactionOptions,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::moneyfi_adapter::deposit`,
      [args.amount],
      undefined,
      options,
    );
  }

  /**
   * Build a `moneyfi_adapter::request` transaction.
   *
   * Requests a withdrawal through the adapter with minimum share price protection.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link MoneyFiAdapterRequestArgs}
   * @param options - Optional gas / expiry overrides.
   * @returns A built transaction ready for signing.
   */
  async adapterRequest(
    sender: AccountAddressInput,
    args: MoneyFiAdapterRequestArgs,
    options?: BuildTransactionOptions,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::moneyfi_adapter::request`,
      [args.amount, args.minSharePrice],
      undefined,
      options,
    );
  }

  /**
   * Build a `moneyfi_adapter::withdraw` transaction.
   *
   * Completes a pending withdrawal through the adapter.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link MoneyFiAdapterWithdrawArgs}
   * @param options - Optional gas / expiry overrides.
   * @returns A built transaction ready for signing.
   */
  async adapterWithdraw(
    sender: AccountAddressInput,
    args: MoneyFiAdapterWithdrawArgs,
    options?: BuildTransactionOptions,
  ): Promise<SimpleTransaction> {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::moneyfi_adapter::withdraw`,
      [args.amount],
      undefined,
      options,
    );
  }

  // ── Wallet adapter payload methods ─────────────────────────────────────
  //
  // When submitting via a wallet adapter, the wallet builds the transaction
  // itself — our SDK only provides the `InputEntryFunctionData` payload, so
  // the default `maxGasAmount` baked into `buildTransaction` does NOT apply
  // here. For the bridge's `deposit` and `request` paths (which walk the
  // moneyfi vault inside the price-monitor and withdrawal-limits gates), pass
  // `options.maxGasAmount: RECOMMENDED_MAX_GAS_AMOUNT` to
  // `signAndSubmitTransaction` to avoid `execution_limit_reached` on
  // simulation:
  //
  //   import { RECOMMENDED_MAX_GAS_AMOUNT } from "@aptree/sdk";
  //   await signAndSubmitTransaction({
  //     data: client.bridge.builder.requestPayload(args),
  //     options: { maxGasAmount: RECOMMENDED_MAX_GAS_AMOUNT },
  //   });

  /**
   * Payload for `bridge::deposit`. @see {@link deposit}
   *
   * When submitting via a wallet adapter, also pass
   * `options.maxGasAmount: RECOMMENDED_MAX_GAS_AMOUNT` — the wallet builds
   * the txn so the SDK's default `maxGasAmount` doesn't apply.
   */
  depositPayload(args: BridgeDepositArgs): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::bridge::deposit`,
      [args.amount, args.provider],
    );
  }

  /**
   * Payload for `bridge::request`. @see {@link request}
   *
   * When submitting via a wallet adapter, also pass
   * `options.maxGasAmount: RECOMMENDED_MAX_GAS_AMOUNT` — the wallet builds
   * the txn so the SDK's default `maxGasAmount` doesn't apply.
   */
  requestPayload(args: BridgeRequestArgs): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::bridge::request`,
      [args.amount, args.minAmount],
    );
  }

  /** Payload for `bridge::withdraw`. @see {@link withdraw} */
  withdrawPayload(args: BridgeWithdrawArgs): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::bridge::withdraw`,
      [args.amount, args.provider],
    );
  }

  /** Payload for `moneyfi_adapter::deposit`. @see {@link adapterDeposit} */
  adapterDepositPayload(args: MoneyFiAdapterDepositArgs): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::moneyfi_adapter::deposit`,
      [args.amount],
    );
  }

  /** Payload for `moneyfi_adapter::request`. @see {@link adapterRequest} */
  adapterRequestPayload(args: MoneyFiAdapterRequestArgs): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::moneyfi_adapter::request`,
      [args.amount, args.minSharePrice],
    );
  }

  /** Payload for `moneyfi_adapter::withdraw`. @see {@link adapterWithdraw} */
  adapterWithdrawPayload(args: MoneyFiAdapterWithdrawArgs): InputEntryFunctionData {
    return this.buildPayload(
      `${this.addresses.aptree}::moneyfi_adapter::withdraw`,
      [args.amount],
    );
  }
}
