import {
  AccountAddressInput,
  InputEntryFunctionData,
  SimpleTransaction,
} from "@aptos-labs/ts-sdk";
import { BaseModule } from "../base-module";
import type {
  PanoraSwapParams,
  GladeFlexibleDepositArgs,
  GladeFlexibleWithdrawArgs,
  GladeGuaranteedDepositArgs,
  GladeGuaranteedUnlockArgs,
  GladeGuaranteedEmergencyUnlockArgs,
  SwapArgs,
} from "../../types/glade";

/**
 * Flatten {@link PanoraSwapParams} into the positional argument array
 * expected by the on-chain Panora swap router.
 *
 * The Option<signer> (arg1) is not included here because the Aptos SDK
 * doesn't allow passing signers as function arguments — it is always
 * passed as `[]` (Option::none) and handled at the framework level.
 */
function swapParamsToArgs(p: PanoraSwapParams): Array<unknown> {
  return [
    [], // arg1: Option<signer> — always none, cannot pass signers as args
    p.toWalletAddress,
    p.arg3,
    p.arg4,
    p.arg5,
    p.arg6,
    p.arg7,
    p.arg8,
    p.withdrawCase,
    p.arg10,
    p.faAddresses,
    p.arg12,
    p.arg13 ?? [], // Option wrapping handled by the SDK
    p.arg14,
    p.arg15 ?? [], // Option wrapping handled by the SDK
    p.arg16,
    p.fromTokenAmounts,
    p.arg18,
    p.arg19,
    p.arg20,
  ];
}

/**
 * Transaction builders for the Glade contract modules:
 * - `aptree::glade_flexible` — Swap + bridge deposit/withdraw
 * - `aptree::glade_guaranteed` — Swap + guaranteed-yield deposit/unlock
 * - `aptree::swap_helpers` — Standalone Panora swap
 *
 * All functions require 32 type arguments for the Panora swap router:
 * `[fromTokenAddress, T1, T2, ..., T30, toTokenAddress]`.
 *
 * For Fungible Asset swaps, use `"0x1::string::String"` as the type argument
 * for coin-type parameter slots.
 *
 * @example
 * ```typescript
 * const typeArgs = [
 *   "0x1::string::String", // fromTokenAddress (FA swap)
 *   ...Array(30).fill("0x1::string::String"), // T1–T30
 *   "0x1::string::String", // toTokenAddress (FA swap)
 * ];
 *
 * const txn = await client.glade.builder.deposit(
 *   senderAddress,
 *   {
 *     swapParams: { ... },
 *     depositAmount: 100_000_000,
 *     provider: 0,
 *   },
 *   typeArgs,
 * );
 * ```
 */
export class GladeBuilder extends BaseModule {
  // ── glade_flexible entry functions ───────────────────────────────────────

  /**
   * Build a `glade_flexible::deposit` transaction.
   *
   * Swaps from any token to the bridge's underlying token via Panora,
   * then deposits the result into the bridge.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link GladeFlexibleDepositArgs}
   * @param typeArguments - 32 type arguments for the Panora router: `[fromTokenAddress, T1..T30, toTokenAddress]`.
   * @returns A built transaction ready for signing.
   */
  async deposit(
    sender: AccountAddressInput,
    args: GladeFlexibleDepositArgs,
    typeArguments: string[],
  ): Promise<SimpleTransaction> {
    const fnArgs = [
      ...swapParamsToArgs(args.swapParams),
      args.depositAmount,
      args.provider,
    ];

    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::glade_flexible::deposit`,
      fnArgs as Array<string | number | boolean | Uint8Array>,
      typeArguments,
    );
  }

  /**
   * Build a `glade_flexible::withdraw` transaction.
   *
   * Withdraws from the bridge, then swaps the underlying token to any
   * desired output token via Panora.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link GladeFlexibleWithdrawArgs}
   * @param typeArguments - 32 type arguments for the Panora router: `[fromTokenAddress, T1..T30, toTokenAddress]`.
   * @returns A built transaction ready for signing.
   */
  async withdraw(
    sender: AccountAddressInput,
    args: GladeFlexibleWithdrawArgs,
    typeArguments: string[],
  ): Promise<SimpleTransaction> {
    const fnArgs = [
      ...swapParamsToArgs(args.swapParams),
      args.withdrawalAmount,
      args.provider,
    ];

    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::glade_flexible::withdraw`,
      fnArgs as Array<string | number | boolean | Uint8Array>,
      typeArguments,
    );
  }

  // ── glade_guaranteed entry functions ─────────────────────────────────────

  /**
   * Build a `glade_guaranteed::deposit_guaranteed` transaction.
   *
   * Swaps from any token to the bridge's underlying token via Panora,
   * then creates a guaranteed-yield lock position.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link GladeGuaranteedDepositArgs}
   * @param typeArguments - 32 type arguments for the Panora router.
   * @returns A built transaction ready for signing.
   */
  async depositGuaranteed(
    sender: AccountAddressInput,
    args: GladeGuaranteedDepositArgs,
    typeArguments: string[],
  ): Promise<SimpleTransaction> {
    const fnArgs = [
      ...swapParamsToArgs(args.swapParams),
      args.depositAmount,
      args.tier,
      args.minAetReceived,
    ];

    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::glade_guaranteed::deposit_guaranteed`,
      fnArgs as Array<string | number | boolean | Uint8Array>,
      typeArguments,
    );
  }

  /**
   * Build a `glade_guaranteed::unlock_guaranteed` transaction.
   *
   * Completes withdrawal of a matured guaranteed-yield position
   * and then swaps the received tokens to any desired output token via Panora.
   *
   * This wraps the withdraw step (step 2) of the async unlock flow.
   * The request step must be done directly via
   * {@link GuaranteedYieldModule} (`requestUnlockGuaranteed`) before calling this.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link GladeGuaranteedUnlockArgs}
   * @param typeArguments - 32 type arguments for the Panora router.
   * @returns A built transaction ready for signing.
   */
  async unlockGuaranteed(
    sender: AccountAddressInput,
    args: GladeGuaranteedUnlockArgs,
    typeArguments: string[],
  ): Promise<SimpleTransaction> {
    const fnArgs = [
      ...swapParamsToArgs(args.swapParams),
      args.positionId,
    ];

    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::glade_guaranteed::unlock_guaranteed`,
      fnArgs as Array<string | number | boolean | Uint8Array>,
      typeArguments,
    );
  }

  /**
   * Build a `glade_guaranteed::emergency_unlock_guaranteed` transaction.
   *
   * Completes emergency withdrawal of a guaranteed-yield position,
   * forfeiting yield and clawing back cashback, then swaps the received
   * tokens to any desired output token via Panora.
   *
   * This wraps the withdraw step (step 2) of the async emergency unlock flow.
   * The request step must be done directly via
   * {@link GuaranteedYieldModule} (`requestEmergencyUnlockGuaranteed`) before calling this.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link GladeGuaranteedEmergencyUnlockArgs}
   * @param typeArguments - 32 type arguments for the Panora router.
   * @returns A built transaction ready for signing.
   */
  async emergencyUnlockGuaranteed(
    sender: AccountAddressInput,
    args: GladeGuaranteedEmergencyUnlockArgs,
    typeArguments: string[],
  ): Promise<SimpleTransaction> {
    const fnArgs = [
      ...swapParamsToArgs(args.swapParams),
      args.positionId,
    ];

    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::glade_guaranteed::emergency_unlock_guaranteed`,
      fnArgs as Array<string | number | boolean | Uint8Array>,
      typeArguments,
    );
  }

  // ── swap_helpers entry functions ─────────────────────────────────────────

  /**
   * Build a `swap_helpers::swap` transaction.
   *
   * Executes a standalone Panora DEX swap without any bridge or locking operations.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link SwapArgs}
   * @param typeArguments - 32 type arguments for the Panora router: `[fromTokenAddress, T1..T30, toTokenAddress]`.
   * @returns A built transaction ready for signing.
   */
  async swap(
    sender: AccountAddressInput,
    args: SwapArgs,
    typeArguments: string[],
  ): Promise<SimpleTransaction> {
    const fnArgs = swapParamsToArgs(args.swapParams);

    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::swap_helpers::swap`,
      fnArgs as Array<string | number | boolean | Uint8Array>,
      typeArguments,
    );
  }

  // ── Wallet adapter payload methods ─────────────────────────────────────

  /** Payload for `glade_flexible::deposit`. @see {@link deposit} */
  depositPayload(
    args: GladeFlexibleDepositArgs,
    typeArguments: string[],
  ): InputEntryFunctionData {
    const fnArgs = [
      ...swapParamsToArgs(args.swapParams),
      args.depositAmount,
      args.provider,
    ];
    return this.buildPayload(
      `${this.addresses.aptree}::glade_flexible::deposit`,
      fnArgs as Array<string | number | boolean | Uint8Array>,
      typeArguments,
    );
  }

  /** Payload for `glade_flexible::withdraw`. @see {@link withdraw} */
  withdrawPayload(
    args: GladeFlexibleWithdrawArgs,
    typeArguments: string[],
  ): InputEntryFunctionData {
    const fnArgs = [
      ...swapParamsToArgs(args.swapParams),
      args.withdrawalAmount,
      args.provider,
    ];
    return this.buildPayload(
      `${this.addresses.aptree}::glade_flexible::withdraw`,
      fnArgs as Array<string | number | boolean | Uint8Array>,
      typeArguments,
    );
  }

  /** Payload for `glade_guaranteed::deposit_guaranteed`. @see {@link depositGuaranteed} */
  depositGuaranteedPayload(
    args: GladeGuaranteedDepositArgs,
    typeArguments: string[],
  ): InputEntryFunctionData {
    const fnArgs = [
      ...swapParamsToArgs(args.swapParams),
      args.depositAmount,
      args.tier,
      args.minAetReceived,
    ];
    return this.buildPayload(
      `${this.addresses.aptree}::glade_guaranteed::deposit_guaranteed`,
      fnArgs as Array<string | number | boolean | Uint8Array>,
      typeArguments,
    );
  }

  /** Payload for `glade_guaranteed::unlock_guaranteed`. @see {@link unlockGuaranteed} */
  unlockGuaranteedPayload(
    args: GladeGuaranteedUnlockArgs,
    typeArguments: string[],
  ): InputEntryFunctionData {
    const fnArgs = [
      ...swapParamsToArgs(args.swapParams),
      args.positionId,
    ];
    return this.buildPayload(
      `${this.addresses.aptree}::glade_guaranteed::unlock_guaranteed`,
      fnArgs as Array<string | number | boolean | Uint8Array>,
      typeArguments,
    );
  }

  /** Payload for `glade_guaranteed::emergency_unlock_guaranteed`. @see {@link emergencyUnlockGuaranteed} */
  emergencyUnlockGuaranteedPayload(
    args: GladeGuaranteedEmergencyUnlockArgs,
    typeArguments: string[],
  ): InputEntryFunctionData {
    const fnArgs = [
      ...swapParamsToArgs(args.swapParams),
      args.positionId,
    ];
    return this.buildPayload(
      `${this.addresses.aptree}::glade_guaranteed::emergency_unlock_guaranteed`,
      fnArgs as Array<string | number | boolean | Uint8Array>,
      typeArguments,
    );
  }

  /** Payload for `swap_helpers::swap`. @see {@link swap} */
  swapPayload(
    args: SwapArgs,
    typeArguments: string[],
  ): InputEntryFunctionData {
    const fnArgs = swapParamsToArgs(args.swapParams);
    return this.buildPayload(
      `${this.addresses.aptree}::swap_helpers::swap`,
      fnArgs as Array<string | number | boolean | Uint8Array>,
      typeArguments,
    );
  }
}
