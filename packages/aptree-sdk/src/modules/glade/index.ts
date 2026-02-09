import { Aptos } from "@aptos-labs/ts-sdk";
import { AptreeAddresses } from "../../config";
import { BaseModule } from "../base-module";
import { GladeBuilder } from "./builder";

/**
 * Module for interacting with the Glade contracts:
 * - `aptree::glade_flexible` — Swap any token + bridge deposit/withdraw in one transaction.
 * - `aptree::glade_guaranteed` — Swap any token + guaranteed-yield deposit/unlock in one transaction.
 * - `aptree::swap_helpers` — Standalone Panora DEX swap.
 *
 * The Glade contracts integrate with the [Panora DEX aggregator](https://panora.exchange)
 * to enable single-transaction deposit/withdraw flows from any supported token.
 * All entry functions require 32 type arguments for the Panora router.
 *
 * This module has no view functions or on-chain resources — it only provides
 * transaction builders via {@link GladeModule.builder | builder}.
 *
 * @example
 * ```typescript
 * // 32 type arguments for Panora router
 * const typeArgs = [
 *   "0x1::string::String", // fromTokenAddress (FA swap)
 *   ...Array(30).fill("0x1::string::String"), // T1–T30 placeholders
 *   "0x1::string::String", // toTokenAddress (FA swap)
 * ];
 *
 * // Swap + deposit in one transaction
 * const txn = await client.glade.builder.deposit(sender, {
 *   swapParams: {
 *     optionalSigner: null,
 *     toWalletAddress: senderAddress,
 *     arg3: 0,
 *     arg4: 0,
 *     arg5: new Uint8Array(),
 *     arg6: [],
 *     arg7: [],
 *     arg8: [],
 *     withdrawCase: [[1]],
 *     arg10: [],
 *     faAddresses: [[usdtMetadataAddress]],
 *     arg12: [],
 *     arg13: null,
 *     arg14: [],
 *     arg15: null,
 *     arg16: "0x0",
 *     fromTokenAmounts: [100_000_000],
 *     arg18: 0,
 *     arg19: 0,
 *     arg20: "0x0",
 *   },
 *   depositAmount: 100_000_000,
 *   provider: 0,
 * }, typeArgs);
 *
 * // Standalone swap
 * const swapTxn = await client.glade.builder.swap(sender, {
 *   swapParams: { ... },
 * }, typeArgs);
 * ```
 */
export class GladeModule extends BaseModule {
  /**
   * Transaction builders for Glade entry functions.
   *
   * Includes builders for:
   * - `glade_flexible::deposit` / `withdraw`
   * - `glade_guaranteed::deposit_guaranteed` / `unlock_guaranteed` / `emergency_unlock_guaranteed`
   * - `swap_helpers::swap`
   */
  readonly builder: GladeBuilder;

  constructor(aptos: Aptos, addresses: AptreeAddresses) {
    super(aptos, addresses);
    this.builder = new GladeBuilder(aptos, addresses);
  }
}

export { GladeBuilder } from "./builder";
