// ─── Panora Swap Routing Parameters ──────────────────────────────────────────

/**
 * Common parameters for the Panora DEX aggregator swap routing.
 *
 * These parameters are shared across all Glade entry functions
 * (`glade_flexible::deposit`, `glade_flexible::withdraw`,
 * `glade_guaranteed::deposit_guaranteed`, etc.).
 *
 * They are passed directly to the Panora swap router on-chain. The SDK
 * does not interpret or validate these parameters — they should be
 * obtained from the Panora API / quote endpoint.
 *
 * @remarks
 * The 32 type arguments (`fromTokenAddress`, `T1`–`T30`, `toTokenAddress`)
 * are separate and passed via `typeArguments` in the builder methods.
 * For Fungible Asset swaps, use `"0x1::string::String"` as the type argument
 * for coin-type slots.
 */
export interface PanoraSwapParams {
  /**
   * Optional secondary signer. Pass `null` / empty array if not needed.
   * On-chain type: `0x1::option::Option<signer>`.
   */
  optionalSigner: null;

  /** Address that receives the output tokens from the swap. */
  toWalletAddress: string;

  arg2: number,

  /** Panora router arg3 (u64). */
  arg3: number;

  /** Panora router arg4 (u8). */
  arg4: number;

  /** Panora router arg5 (vector<u8>). */
  arg5: Uint8Array;

  /** Panora router arg6 (vector<vector<vector<u8>>>). */
  arg6: number[][][];

  /** Panora router arg7 (vector<vector<vector<u64>>>). */
  arg7: number[][][];

  /** Panora router arg8 (vector<vector<vector<bool>>>). */
  arg8: boolean[][][];

  /**
   * Withdraw case flags. Determines token standard per swap leg.
   * - `1` or `2` = Fungible Asset (FA)
   * - `3` or `4` = Coin
   *
   * On-chain type: `vector<vector<u8>>`.
   */
  withdrawCase: number[][];

  /** Panora router arg10 (vector<vector<vector<address>>>). */
  arg10: string[][][];

  /**
   * Fungible Asset metadata addresses for each swap leg.
   * Use dummy addresses for Coin-type legs.
   *
   * On-chain type: `vector<vector<address>>`.
   */
  faAddresses: string[][];

  /** Panora router arg12 (vector<vector<address>>). */
  arg12: string[][];

  /**
   * Panora router arg13. Optional deeply nested bytes.
   * On-chain type: `0x1::option::Option<vector<vector<vector<vector<vector<u8>>>>>>`.
   * Pass `null` for `Option::none`.
   */
  arg13: number[][][][][] | null;

  /** Panora router arg14 (vector<vector<vector<u64>>>). */
  arg14: number[][][];

  /**
   * Panora router arg15. Optional nested bytes.
   * On-chain type: `0x1::option::Option<vector<vector<vector<u8>>>>`.
   * Pass `null` for `Option::none`.
   */
  arg15: number[][][] | null;

  /** Panora router arg16 (address). */
  arg16: string;

  /**
   * Token amounts to deduct from the user's wallet for the swap.
   * The sum of this vector is the total input amount.
   *
   * On-chain type: `vector<u64>`.
   */
  fromTokenAmounts: number[];

  /** Panora router arg18 (u64). */
  arg18: number;

  /** Panora router arg19 (u64). */
  arg19: number;

  /** Panora router arg20 (address). */
  arg20: string;
}

// ─── Glade Flexible Builder Arg Types ────────────────────────────────────────

/**
 * Arguments for `glade_flexible::deposit`.
 *
 * Performs a swap via Panora (converting any token to the bridge's underlying token)
 * and then deposits the result into the bridge.
 */
export interface GladeFlexibleDepositArgs {
  /** Panora swap routing parameters. */
  swapParams: PanoraSwapParams;
}

/**
 * Arguments for `glade_flexible::withdraw`.
 *
 * Withdraws from the bridge and then performs a swap via Panora (converting
 * the underlying token to the desired output token).
 */
export interface GladeFlexibleWithdrawArgs {
  /** Panora swap routing parameters. */
  swapParams: PanoraSwapParams;
  /** Amount of underlying tokens to withdraw from the bridge before the swap. */
  withdrawalAmount: number;
  /** Bridge provider identifier. */
  provider: number;
}

// ─── Glade Guaranteed Builder Arg Types ──────────────────────────────────────

/**
 * Arguments for `glade_guaranteed::deposit_guaranteed`.
 *
 * Performs a swap via Panora and then creates a guaranteed-yield lock position.
 */
export interface GladeGuaranteedDepositArgs {
  /** Panora swap routing parameters. */
  swapParams: PanoraSwapParams;
  /** Lock tier (1=Starter, 2=Bronze, 3=Silver, 4=Gold). */
  tier: number;
  /** Minimum AET tokens to receive (slippage protection). */
  minAetReceived: number;
}

/**
 * Arguments for `glade_guaranteed::unlock_guaranteed`.
 *
 * Completes withdrawal of a guaranteed-yield position (step 2 of the async flow)
 * and then swaps the received tokens to any desired output token via Panora.
 *
 * The request step must be done directly via
 * {@link GuaranteedYieldModule} (`requestUnlockGuaranteed`) before calling this.
 */
export interface GladeGuaranteedUnlockArgs {
  /** Panora swap routing parameters. */
  swapParams: PanoraSwapParams;
  /** ID of the position to complete withdrawal for. */
  positionId: number;
}

/**
 * Arguments for `glade_guaranteed::emergency_unlock_guaranteed`.
 *
 * Completes emergency withdrawal of a guaranteed-yield position (step 2 of the async flow)
 * and then swaps the received tokens to any desired output token via Panora.
 *
 * The request step must be done directly via
 * {@link GuaranteedYieldModule} (`requestEmergencyUnlockGuaranteed`) before calling this.
 */
export interface GladeGuaranteedEmergencyUnlockArgs {
  /** Panora swap routing parameters. */
  swapParams: PanoraSwapParams;
  /** ID of the position to complete emergency withdrawal for. */
  positionId: number;
}

// ─── Swap Helpers Builder Arg Types ──────────────────────────────────────────

/**
 * Arguments for `swap_helpers::swap`.
 *
 * Executes a standalone Panora swap without any bridge/locking operations.
 */
export interface SwapArgs {
  /** Panora swap routing parameters. */
  swapParams: PanoraSwapParams;
}
