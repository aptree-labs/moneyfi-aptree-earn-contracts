import {
  Aptos,
  AccountAddressInput,
  InputViewFunctionData,
  SimpleTransaction,
  MoveFunctionId,
} from "@aptos-labs/ts-sdk";
import { AptreeAddresses } from "../config";

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
   * @param sender - The account address that will sign the transaction.
   * @param functionId - Fully qualified Move function identifier (e.g. `"0x1::module::function"`).
   * @param functionArguments - Arguments to pass to the Move function.
   * @param typeArguments - Generic type arguments, if any.
   * @returns A built {@link SimpleTransaction} ready for signing and submission.
   */
  protected async buildTransaction(
    sender: AccountAddressInput,
    functionId: MoveFunctionId,
    functionArguments: Array<
      string | number | boolean | Uint8Array | AccountAddressInput
    >,
    typeArguments?: string[],
  ): Promise<SimpleTransaction> {
    return this.aptos.transaction.build.simple({
      sender,
      data: {
        function: functionId,
        typeArguments: typeArguments ?? [],
        functionArguments,
      },
    });
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
