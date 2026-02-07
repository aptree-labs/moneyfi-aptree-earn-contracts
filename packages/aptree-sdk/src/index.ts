// ── Client ─────────────────────────────────────────────────────────────────
export { AptreeClient } from "./client";

// ── Config ─────────────────────────────────────────────────────────────────
export {
  TESTNET_ADDRESSES,
  type AptreeAddresses,
  type AptreeClientConfig,
} from "./config";

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
  MockVaultModule,
  MockVaultBuilder,
  MockVaultResources,
} from "./modules/mock-vault";
export { GladeModule, GladeBuilder } from "./modules/glade";

// ── Types ──────────────────────────────────────────────────────────────────
export * from "./types";

// ── Utilities ──────────────────────────────────────────────────────────────
export * from "./utils";
