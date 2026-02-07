import { Aptos, AptosConfig } from "@aptos-labs/ts-sdk";

/**
 * Contract deployment addresses for the Aptree protocol.
 *
 * - `aptree` is the shared namespace address for bridge, locking, and guaranteed-yield modules.
 * - `moneyfi` is the address of the MoneyFi vault (or mock vault on testnet).
 */
export interface AptreeAddresses {
  /** Address where bridge, moneyfi_adapter, locking, and GuaranteedYieldLocking modules are deployed. */
  aptree: string;
  /** Address where the MoneyFi vault (or mock vault) module is deployed. */
  moneyfi: string;
}

/** Preset addresses for the Aptos testnet deployment. */
export const TESTNET_ADDRESSES: AptreeAddresses = {
  aptree:
    "0x7609a1f4fffae8048bf48d7ba740fab64d7b30ec463512bb9b2fd45645b1326b",
  moneyfi:
    "0xd4b0e499b766905e4da6633aa10cef52e0ffb98054ef76a9a97ea80b486782ca",
};

/**
 * Configuration for the {@link AptreeClient}.
 */
export interface AptreeClientConfig {
  /** An existing Aptos SDK client instance, or an AptosConfig to construct one. */
  aptos: Aptos | AptosConfig;
  /** Contract deployment addresses. */
  addresses: AptreeAddresses;
}
