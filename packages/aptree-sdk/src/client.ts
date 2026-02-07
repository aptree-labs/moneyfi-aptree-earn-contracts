import { Aptos, AptosConfig } from "@aptos-labs/ts-sdk";
import { AptreeClientConfig, AptreeAddresses } from "./config";
import { BridgeModule } from "./modules/bridge";
import { LockingModule } from "./modules/locking";
import { GuaranteedYieldModule } from "./modules/guaranteed-yield";
import { MockVaultModule } from "./modules/mock-vault";

/**
 * Main entry point for the Aptree SDK.
 *
 * Provides namespaced access to all contract modules:
 * - {@link AptreeClient.bridge | bridge} — Bridge and MoneyFi adapter interactions.
 * - {@link AptreeClient.locking | locking} — Time-locked deposit positions.
 * - {@link AptreeClient.guaranteedYield | guaranteedYield} — Fixed-rate guaranteed yield locking.
 * - {@link AptreeClient.mockVault | mockVault} — Mock MoneyFi vault for testing.
 *
 * Each module exposes:
 * - `builder` — Transaction builders that return `SimpleTransaction` objects.
 * - `resources` — Typed readers for on-chain Move resources.
 * - View functions as direct methods on the module.
 *
 * @example
 * ```typescript
 * import { AptreeClient, TESTNET_ADDRESSES } from "@aptree/sdk";
 * import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
 *
 * const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
 * const client = new AptreeClient({ aptos, addresses: TESTNET_ADDRESSES });
 *
 * // Build a deposit transaction
 * const txn = await client.bridge.builder.deposit(senderAddress, {
 *   amount: 1_00000000n, // 1 token (8 decimals)
 *   provider: 0n,
 * });
 *
 * // Query LP price
 * const price = await client.bridge.getLpPrice();
 *
 * // Read user lock positions
 * const positions = await client.locking.getUserPositions(userAddress);
 *
 * // Read on-chain resource
 * const config = await client.locking.resources.getLockConfig(configAddress);
 * ```
 */
export class AptreeClient {
  /** The underlying Aptos SDK client instance. */
  readonly aptos: Aptos;

  /** The contract deployment addresses. */
  readonly addresses: AptreeAddresses;

  /** Bridge and MoneyFi adapter contract interactions. */
  readonly bridge: BridgeModule;

  /** Time-locked deposit contract interactions. */
  readonly locking: LockingModule;

  /** Guaranteed yield locking contract interactions. */
  readonly guaranteedYield: GuaranteedYieldModule;

  /** Mock MoneyFi vault interactions (for testing). */
  readonly mockVault: MockVaultModule;

  constructor(config: AptreeClientConfig) {
    this.aptos =
      config.aptos instanceof Aptos
        ? config.aptos
        : new Aptos(config.aptos);
    this.addresses = config.addresses;

    this.bridge = new BridgeModule(this.aptos, this.addresses);
    this.locking = new LockingModule(this.aptos, this.addresses);
    this.guaranteedYield = new GuaranteedYieldModule(
      this.aptos,
      this.addresses,
    );
    this.mockVault = new MockVaultModule(this.aptos, this.addresses);
  }
}
