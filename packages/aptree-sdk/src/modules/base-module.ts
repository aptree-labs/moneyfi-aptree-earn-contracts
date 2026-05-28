import {
  Aptos,
  AccountAddressInput,
  InputViewFunctionData,
  InputEntryFunctionData,
  SimpleTransaction,
  MoveFunctionId,
} from "@aptos-labs/ts-sdk";
import { AptreeAddresses } from "../config";

/**
 * Default `maxGasAmount` applied to every transaction built by an SDK
 * builder. The Aptos default (~200k) is too low to simulate the bridge's
 * `request` flow, which walks the moneyfi vault inside the price-monitor
 * and withdrawal-limits gates. We default to a generous 2M to keep
 * `execution_limit_reached` from surfacing during simulation; the user is
 * only ever charged for gas actually consumed, so the higher ceiling has
 * no cost when the txn is cheap.
 *
 * For wallet-adapter flows (where the wallet builds the txn, not us), pass
 * this value through under `options.maxGasAmount` at submission time, e.g.
 *
 * ```ts
 * await signAndSubmitTransaction({
 *   data: client.bridge.builder.requestPayload(args),
 *   options: { maxGasAmount: RECOMMENDED_MAX_GAS_AMOUNT },
 * });
 * ```
 */
export const RECOMMENDED_MAX_GAS_AMOUNT = 2_000_000;

/**
 * Per-transaction overrides accepted by every SDK builder. Anything you
 * leave out falls back to the SDK defaults (notably
 * {@link RECOMMENDED_MAX_GAS_AMOUNT} for `maxGasAmount`).
 */
export interface BuildTransactionOptions {
  /**
   * Maximum gas units the network is allowed to charge for this txn. You
   * only pay for what's used; this is the ceiling, not the cost. Defaults
   * to {@link RECOMMENDED_MAX_GAS_AMOUNT}.
   */
  maxGasAmount?: number;
  /** Octas per gas unit. If omitted, the SDK picks a network default. */
  gasUnitPrice?: number;
  /** Unix seconds after which the txn is rejected by the chain. */
  expireTimestamp?: number;
}

/**
 * Abstract base class shared by all contract module classes.
 *
 * Provides helpers for building transactions, calling view functions,
 * and reading on-chain resources.
 */
export abstract class BaseModule {
  protected readonly aptos: Aptos;
  protected readonly addresses: AptreeAddresses;

  constructor(aptos: Aptos, addresses: AptreeAddresses) {
    this.aptos = aptos;
    this.addresses = addresses;
  }

  /**
   * Build a simple entry-function transaction.
   *
   * Applies a generous default `maxGasAmount` ({@link RECOMMENDED_MAX_GAS_AMOUNT})
   * to keep the bridge's `request` / `deposit` flows from tripping the
   * simulator's compute limit. Pass `options` to override per call.
   *
   * @param sender - The account address that will sign the transaction.
   * @param functionId - Fully qualified Move function identifier (e.g. `"0x1::module::function"`).
   * @param functionArguments - Arguments to pass to the Move function.
   * @param typeArguments - Generic type arguments, if any.
   * @param options - Optional gas / expiry overrides. See {@link BuildTransactionOptions}.
   * @returns A built {@link SimpleTransaction} ready for signing and submission.
   */
  protected async buildTransaction(
    sender: AccountAddressInput,
    functionId: MoveFunctionId,
    functionArguments: Array<
      string | number | boolean | Uint8Array | AccountAddressInput
    >,
    typeArguments?: string[],
    options?: BuildTransactionOptions,
  ): Promise<SimpleTransaction> {
    return this.aptos.transaction.build.simple({
      sender,
      data: {
        function: functionId,
        typeArguments: typeArguments ?? [],
        functionArguments,
      },
      options: {
        maxGasAmount: options?.maxGasAmount ?? RECOMMENDED_MAX_GAS_AMOUNT,
        ...(options?.gasUnitPrice !== undefined
          ? { gasUnitPrice: options.gasUnitPrice }
          : {}),
        ...(options?.expireTimestamp !== undefined
          ? { expireTimestamp: options.expireTimestamp }
          : {}),
      },
    });
  }

  /**
   * Create an entry-function payload for use with wallet adapters.
   *
   * Unlike {@link buildTransaction}, this does **not** call the network.
   * It returns an {@link InputEntryFunctionData} object that can be passed
   * directly to a wallet adapter's `signAndSubmitTransaction`:
   *
   * ```ts
   * const payload = client.bridge.builder.depositPayload({ amount, provider });
   * await signAndSubmitTransaction({ data: payload });
   * ```
   *
   * @param functionId - Fully qualified Move function identifier (e.g. `"0x1::module::function"`).
   * @param functionArguments - Arguments to pass to the Move function.
   * @param typeArguments - Generic type arguments, if any.
   * @returns An {@link InputEntryFunctionData} payload ready for wallet adapter submission.
   */
  protected buildPayload(
    functionId: MoveFunctionId,
    functionArguments: Array<
      string | number | boolean | Uint8Array | AccountAddressInput
    >,
    typeArguments?: string[],
  ): InputEntryFunctionData {
    return {
      function: functionId,
      typeArguments: typeArguments ?? [],
      functionArguments,
    };
  }

  /**
   * Call an on-chain view function and return the raw result array.
   *
   * @param functionId - Fully qualified Move function identifier.
   * @param functionArguments - Arguments to pass to the view function.
   * @param typeArguments - Generic type arguments, if any.
   * @returns The result array returned by the view function.
   */
  protected async view<T extends Array<unknown>>(
    functionId: MoveFunctionId,
    functionArguments: Array<
      string | number | boolean | Uint8Array | AccountAddressInput
    > = [],
    typeArguments?: string[],
  ): Promise<T> {
    const payload: InputViewFunctionData = {
      function: functionId,
      typeArguments: typeArguments ?? [],
      functionArguments,
    };
    const result = await this.aptos.view<T>({ payload });
    return result;
  }

  /**
   * Read an on-chain Move resource with a typed return value.
   *
   * @param accountAddress - The account holding the resource.
   * @param resourceType - Fully qualified Move resource type (e.g. `"0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"`).
   * @returns The resource data parsed into type `T`.
   */
  protected async getResource<T extends object>(
    accountAddress: AccountAddressInput,
    resourceType: `${string}::${string}::${string}`,
  ): Promise<T> {
    return this.aptos.getAccountResource<T>({
      accountAddress,
      resourceType,
    });
  }
}
