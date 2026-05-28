// ── Client ─────────────────────────────────────────────────────────────────
export { AptreeClient } from "./client";

// ── Config ─────────────────────────────────────────────────────────────────
export {
  TESTNET_ADDRESSES,
  type AptreeAddresses,
  type AptreeClientConfig,
} from "./config";

// ── Base module + gas defaults ────────────────────────────────────────────
export {
  BaseModule,
  RECOMMENDED_MAX_GAS_AMOUNT,
  type BuildTransactionOptions,
} from "./modules/base-module";

// ── Modules (for advanced usage / extending) ──────────────────────────────
export { BridgeModule, BridgeBuilder, BridgeResources } from "./modules/bridge";
export {
  LockingModule,
  LockingBuilder,
  LockingResources,
} from "./modules/locking";
export {
  GuaranteedYieldModule,
  GuaranteedYieldBuilder,
  GuaranteedYieldResources,
} from "./modules/guaranteed-yield";
export {
  FlexibleYieldModule,
  FlexibleYieldBuilder,
  FlexibleYieldResources,
} from "./modules/flexible-yield";
export {
  MockVaultModule,
  MockVaultBuilder,
  MockVaultResources,
} from "./modules/mock-vault";
export { GladeModule, GladeBuilder } from "./modules/glade";

// ── Types ──────────────────────────────────────────────────────────────────
export * from "./types";

// ── Re-exported Aptos SDK types (for wallet adapter consumers) ────────────
export type { InputEntryFunctionData } from "@aptos-labs/ts-sdk";

// ── Utilities ──────────────────────────────────────────────────────────────
export * from "./utils";
