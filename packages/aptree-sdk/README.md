# @aptree/sdk

TypeScript SDK for interacting with Aptree smart contracts on [Aptos](https://aptos.dev).

Provides typed transaction builders, view function wrappers, and on-chain resource readers for all Aptree protocol contracts: **Bridge**, **Locking**, **Guaranteed Yield**, **Glade** (DEX aggregation), and **Mock Vault**.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Modules](#modules)
  - [Bridge](#bridge)
  - [Locking](#locking)
  - [Guaranteed Yield](#guaranteed-yield)
  - [Glade](#glade)
  - [Mock Vault](#mock-vault)
- [Signing & Submitting Transactions](#signing--submitting-transactions)
- [Utilities & Constants](#utilities--constants)
- [API Reference](#api-reference)

---

## Installation

```bash
npm install @aptree/sdk @aptos-labs/ts-sdk
```

`@aptos-labs/ts-sdk` is a **peer dependency** — you must install it alongside the Aptree SDK.

---

## Quick Start

```typescript
import { AptreeClient, TESTNET_ADDRESSES, LockingTier } from "@aptree/sdk";
import { Aptos, AptosConfig, Network, Account } from "@aptos-labs/ts-sdk";

// 1. Create an Aptos client
const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));

// 2. Create the Aptree client with contract addresses
const client = new AptreeClient({
  aptos,
  addresses: TESTNET_ADDRESSES,
});

// 3. Build a transaction
const txn = await client.bridge.builder.deposit(account.accountAddress, {
  amount: 100_000_000n, // 1 token (8 decimals)
  provider: 0n,
});

// 4. Sign and submit
const pendingTxn = await aptos.signAndSubmitTransaction({
  signer: account,
  transaction: txn,
});
const result = await aptos.waitForTransaction({
  transactionHash: pendingTxn.hash,
});

// 5. Read on-chain data
const lpPrice = await client.bridge.getLpPrice();
const positions = await client.locking.getUserPositions(account.accountAddress);
```

---

## Architecture

Every module follows the same structure:

```
client.<module>.builder.<method>(sender, args)    → SimpleTransaction
client.<module>.<viewFunction>(args)              → typed result
client.<module>.resources.<method>(address)        → typed resource
```

| Layer | Purpose | Returns |
|---|---|---|
| **`builder`** | Builds entry function transactions | `SimpleTransaction` |
| **view functions** | Reads computed on-chain data | Typed values (`bigint`, structs, etc.) |
| **`resources`** | Reads raw on-chain Move resources | Typed resource interfaces |

All `u64` and `u128` values are represented as `bigint` in TypeScript for full numeric range safety.

---

## Configuration

### `AptreeAddresses`

All contract addresses are configurable at client creation time:

```typescript
interface AptreeAddresses {
  /** Address for bridge, locking, guaranteed-yield, and glade contracts (aptree namespace). */
  aptree: string;
  /** Address for the MoneyFi vault (or mock vault on testnet). */
  moneyfi: string;
}
```

### Presets

```typescript
import { TESTNET_ADDRESSES } from "@aptree/sdk";

// Testnet preset (included in the SDK):
// {
//   aptree: "0x7609a1f4fffae8048bf48d7ba740fab64d7b30ec463512bb9b2fd45645b1326b",
//   moneyfi: "0xd4b0e499b766905e4da6633aa10cef52e0ffb98054ef76a9a97ea80b486782ca",
// }
```

### Custom Addresses (e.g. Mainnet)

```typescript
const client = new AptreeClient({
  aptos,
  addresses: {
    aptree: "0x<your-mainnet-aptree-address>",
    moneyfi: "0x<your-mainnet-moneyfi-address>",
  },
});
```

### Using an existing Aptos instance

```typescript
// Pass an existing Aptos instance
const client = new AptreeClient({ aptos: existingAptosInstance, addresses: TESTNET_ADDRESSES });

// Or pass an AptosConfig (an Aptos instance will be created internally)
const client = new AptreeClient({
  aptos: new AptosConfig({ network: Network.MAINNET }),
  addresses: { aptree: "0x...", moneyfi: "0x..." },
});
```

---

## Modules

### Bridge

The bridge module wraps `aptree::bridge` and `aptree::moneyfi_adapter` contracts. It handles deposits into and withdrawals from the MoneyFi yield vault, minting/burning AET share tokens.

#### Transaction Builders

```typescript
// Deposit tokens through the bridge — mints AET share tokens
const txn = await client.bridge.builder.deposit(sender, {
  amount: 100_000_000n,  // amount of underlying token (e.g. USDT)
  provider: 0n,          // provider ID (0 = MoneyFi)
});

// Request a withdrawal — burns AET for withdrawal tokens
const txn = await client.bridge.builder.request(sender, {
  amount: 50_000_000n,   // amount of AET to burn
  minAmount: 900_000_000n, // min share price (u128, slippage protection)
});

// Complete a pending withdrawal — redeems withdrawal tokens
const txn = await client.bridge.builder.withdraw(sender, {
  amount: 50_000_000n,
  provider: 0n,
});
```

**Lower-level adapter functions** (used internally by the bridge):

```typescript
const txn = await client.bridge.builder.adapterDeposit(sender, { amount: 100_000_000n });
const txn = await client.bridge.builder.adapterRequest(sender, { amount: 50_000_000n, minSharePrice: 900_000_000n });
const txn = await client.bridge.builder.adapterWithdraw(sender, { amount: 50_000_000n });
```

#### View Functions

```typescript
// Get the supported underlying token address (e.g. USDT metadata object)
const tokenAddr: string = await client.bridge.getSupportedToken();

// Get the current AET share price (scaled by 1e9; 1_000_000_000n = 1:1)
const lpPrice: bigint = await client.bridge.getLpPrice();

// Get the pool's total estimated value
const poolValue: bigint = await client.bridge.getPoolEstimatedValue();
```

#### Resources

```typescript
const bridgeState = await client.bridge.resources.getBridgeState(bridgeResourceAddr);
// → { signer_cap: { account: "0x..." } }

const adapterState = await client.bridge.resources.getMoneyFiBridgeState(controllerAddr);
// → { controller, controller_capability, reserve, reserve_capability }

const reserveState = await client.bridge.resources.getReserveState(reserveAddr);
// → { mint_ref, burn_ref, transfer_ref, token_address }

const withdrawalTokenState = await client.bridge.resources.getWithdrawalTokenState(reserveAddr);
// → { mint_ref, burn_ref, transfer_ref, token_address }
```

---

### Locking

The locking module wraps `aptree::locking`. It creates time-locked deposit positions with tiered durations and early withdrawal limits.

#### Tier Overview

| Tier | Enum | Duration | Early Withdrawal Limit |
|---|---|---|---|
| Bronze | `LockingTier.Bronze` (1) | 90 days | 2% of principal |
| Silver | `LockingTier.Silver` (2) | 180 days | 3% of principal |
| Gold | `LockingTier.Gold` (3) | 365 days | 5% of principal |

#### Transaction Builders

```typescript
import { LockingTier } from "@aptree/sdk";

// Create a new lock position
const txn = await client.locking.builder.depositLocked(sender, {
  amount: 500_000_000n,
  tier: LockingTier.Gold, // or just 3
});

// Add more tokens to an existing position (doesn't extend unlock date)
const txn = await client.locking.builder.addToPosition(sender, {
  positionId: 0n,
  amount: 100_000_000n,
});

// Withdraw early (limited by tier's BPS cap)
const txn = await client.locking.builder.withdrawEarly(sender, {
  positionId: 0n,
  amount: 10_000_000n,
});

// Withdraw fully after unlock date
const txn = await client.locking.builder.withdrawUnlocked(sender, {
  positionId: 0n,
});

// Emergency unlock — forfeits yield, returns principal
const txn = await client.locking.builder.emergencyUnlock(sender, {
  positionId: 0n,
});
```

**Admin functions:**

```typescript
// Update early withdrawal limit for a tier
const txn = await client.locking.builder.setTierLimit(admin, {
  tier: LockingTier.Bronze,
  newLimitBps: 300n, // 3%
});

// Enable or disable new lock deposits
const txn = await client.locking.builder.setLocksEnabled(admin, {
  enabled: false,
});
```

#### View Functions

```typescript
// Get all lock positions for a user
const positions = await client.locking.getUserPositions("0xabc...");
// → LockPosition[] (see types below)

// Get a specific position
const position = await client.locking.getPosition("0xabc...", 0n);

// Check how much can be withdrawn early
const available: bigint = await client.locking.getEarlyWithdrawalAvailable("0xabc...", 0n);

// Check if a position has passed its unlock date
const unlocked: boolean = await client.locking.isPositionUnlocked("0xabc...", 0n);

// Get total locked value across all user positions
const totalValue: bigint = await client.locking.getUserTotalLockedValue("0xabc...");

// Get tier configuration
const config = await client.locking.getTierConfig(LockingTier.Gold);
// → { durationSeconds: 31536000n, earlyLimitBps: 500n }

// Preview emergency unlock outcome
const preview = await client.locking.getEmergencyUnlockPreview("0xabc...", 0n);
// → { payout: bigint, forfeited: bigint }
```

#### Resources

```typescript
// Read raw user positions resource
const userPositions = await client.locking.resources.getUserLockPositions("0xabc...");
// → { positions: LockPosition[], next_position_id: string }

// Read global lock config
const config = await client.locking.resources.getLockConfig(configAddr);
// → { tier_limits_bps, tier_durations, locks_enabled, admin, ... }
```

#### Types

```typescript
interface LockPosition {
  position_id: string;
  tier: number;                  // 1=Bronze, 2=Silver, 3=Gold
  principal: string;             // underlying token amount
  aet_amount: string;            // AET share tokens held
  entry_share_price: string;     // share price at deposit (u128)
  created_at: string;            // unix timestamp
  unlock_at: string;             // unix timestamp
  early_withdrawal_used: string; // amount already withdrawn early
}
```

---

### Guaranteed Yield

The guaranteed yield module wraps `aptree::GuaranteedYieldLocking`. It creates lock positions with instant cashback representing the guaranteed yield, paid upfront from a funded vault.

#### Tier Overview

| Tier | Enum | Duration | Guaranteed Yield |
|---|---|---|---|
| Starter | `GuaranteedYieldTier.Starter` (1) | 30 days | 0.4% |
| Bronze | `GuaranteedYieldTier.Bronze` (2) | 90 days | 1.25% |
| Silver | `GuaranteedYieldTier.Silver` (3) | 180 days | 2.5% |
| Gold | `GuaranteedYieldTier.Gold` (4) | 365 days | 5% |

#### Transaction Builders

```typescript
import { GuaranteedYieldTier } from "@aptree/sdk";

// Create a guaranteed-yield position (receives instant cashback)
const txn = await client.guaranteedYield.builder.depositGuaranteed(sender, {
  amount: 1_000_000_000n,
  tier: GuaranteedYieldTier.Gold,
  minAetReceived: 0n, // slippage protection for AET minting
});

// Unlock after maturity — excess yield goes to treasury
const txn = await client.guaranteedYield.builder.unlockGuaranteed(sender, {
  positionId: 0n,
});

// Fund the cashback vault (anyone can call)
const txn = await client.guaranteedYield.builder.fundCashbackVault(sender, {
  amount: 500_000_000n,
});

// Emergency unlock — forfeits yield, claws back cashback
const txn = await client.guaranteedYield.builder.emergencyUnlockGuaranteed(sender, {
  positionId: 0n,
});
```

**Admin functions:**

```typescript
await client.guaranteedYield.builder.setTierYield(admin, { tier: 4, newYieldBps: 600n });
await client.guaranteedYield.builder.setTreasury(admin, { newTreasury: "0x..." });
await client.guaranteedYield.builder.setDepositsEnabled(admin, { enabled: true });
await client.guaranteedYield.builder.adminWithdrawCashbackVault(admin, { amount: 100n });
await client.guaranteedYield.builder.proposeAdmin(admin, { newAdmin: "0x..." });
await client.guaranteedYield.builder.acceptAdmin(newAdmin); // no args
await client.guaranteedYield.builder.setMaxTotalLocked(admin, { newMax: 10_000_000_000n });
await client.guaranteedYield.builder.setMinDeposit(admin, { newMin: 1_00000000n });
```

#### View Functions

```typescript
// Get all positions for a user
const positions = await client.guaranteedYield.getUserGuaranteedPositions("0xabc...");

// Get a specific position
const pos = await client.guaranteedYield.getGuaranteedPosition("0xabc...", 0n);

// Get tier yield and duration
const yieldBps: bigint = await client.guaranteedYield.getTierGuaranteedYield(4); // 500n = 5%
const duration: bigint = await client.guaranteedYield.getTierDuration(4); // 31536000n

// Calculate cashback for a deposit
const cashback: bigint = await client.guaranteedYield.calculateCashback(1_000_000_000n, 4);

// Get cashback vault balance
const balance: bigint = await client.guaranteedYield.getCashbackVaultBalance();

// Get protocol-wide statistics
const stats = await client.guaranteedYield.getProtocolStats();
// → { totalLockedPrincipal, totalAetHeld, totalCashbackPaid, totalYieldToTreasury }

// Check if a position can be unlocked
const unlockable: boolean = await client.guaranteedYield.isPositionUnlockable("0xabc...", 0n);

// Get tier configuration (duration + yield in one call)
const config = await client.guaranteedYield.getTierConfig(4);
// → { durationSeconds: 31536000n, yieldBps: 500n }

// Get treasury address
const treasury: string = await client.guaranteedYield.getTreasury();

// Check if deposits are enabled
const enabled: boolean = await client.guaranteedYield.areDepositsEnabled();

// Preview emergency unlock outcome
const preview = await client.guaranteedYield.getEmergencyUnlockPreview("0xabc...", 0n);
// → { payout, yieldForfeited, cashbackClawback }

// Get protocol limits
const maxLocked: bigint = await client.guaranteedYield.getMaxTotalLocked();
const minDeposit: bigint = await client.guaranteedYield.getMinDeposit();
```

#### Resources

```typescript
const userPositions = await client.guaranteedYield.resources.getUserGuaranteedPositions("0xabc...");
// → { positions: GuaranteedLockPosition[], next_position_id: string }
```

#### Types

```typescript
interface GuaranteedLockPosition {
  position_id: string;
  tier: number;                // 1=Starter, 2=Bronze, 3=Silver, 4=Gold
  principal: string;
  aet_amount: string;
  cashback_paid: string;       // instant cashback already paid
  guaranteed_yield_bps: string; // locked-in yield rate
  created_at: string;
  unlock_at: string;
}
```

---

### Glade

The glade module wraps `aptree::glade_flexible`, `aptree::glade_guaranteed`, and `aptree::swap_helpers`. It integrates with the [Panora DEX aggregator](https://panora.exchange) to enable single-transaction flows: swap any supported token and deposit/withdraw in one atomic operation.

> **Note:** Glade has no view functions or on-chain resources — it only provides transaction builders.

#### Type Arguments

All Glade functions require **32 type arguments** for the Panora swap router:

```typescript
// [fromTokenAddress, T1, T2, ..., T30, toTokenAddress]
// For Fungible Asset swaps, use "0x1::string::String" for coin-type slots
const typeArgs = [
  "0x1::string::String", // fromTokenAddress
  ...Array(30).fill("0x1::string::String"), // T1–T30 (placeholders for FA swaps)
  "0x1::string::String", // toTokenAddress
];
```

#### Panora Swap Parameters

All Glade builders accept a `swapParams` object conforming to the Panora router interface. These parameters should be obtained from the Panora API / quote endpoint:

```typescript
interface PanoraSwapParams {
  optionalSigner: null;           // always null
  toWalletAddress: string;        // recipient of swap output
  arg3: bigint;
  arg4: number;
  arg5: Uint8Array;
  arg6: number[][][];
  arg7: bigint[][][];
  arg8: boolean[][][];
  withdrawCase: number[][];       // 1,2 = FA; 3,4 = Coin
  arg10: string[][][];
  faAddresses: string[][];        // FA metadata addresses
  arg12: string[][];
  arg13: number[][][][][] | null; // Option — null for none
  arg14: bigint[][][];
  arg15: number[][][] | null;     // Option — null for none
  arg16: string;
  fromTokenAmounts: bigint[];     // input amounts
  arg18: bigint;
  arg19: bigint;
  arg20: string;
}
```

#### Transaction Builders

```typescript
// Swap any token → deposit into bridge
const txn = await client.glade.builder.deposit(sender, {
  swapParams: panoraQuoteParams,
  depositAmount: 100_000_000n,
  provider: 0n,
}, typeArgs);

// Bridge withdraw → swap to any token
const txn = await client.glade.builder.withdraw(sender, {
  swapParams: panoraQuoteParams,
  withdrawalAmount: 100_000_000n,
  provider: 0n,
}, typeArgs);

// Swap any token → guaranteed-yield deposit
const txn = await client.glade.builder.depositGuaranteed(sender, {
  swapParams: panoraQuoteParams,
  depositAmount: 100_000_000n,
  tier: GuaranteedYieldTier.Silver,
  minAetReceived: 0n,
}, typeArgs);

// Unlock guaranteed position → swap output to any token
const txn = await client.glade.builder.unlockGuaranteed(sender, {
  swapParams: panoraQuoteParams,
  positionId: 0n,
}, typeArgs);

// Emergency unlock guaranteed → swap output to any token
const txn = await client.glade.builder.emergencyUnlockGuaranteed(sender, {
  swapParams: panoraQuoteParams,
  positionId: 0n,
}, typeArgs);

// Standalone Panora swap (no bridge/locking)
const txn = await client.glade.builder.swap(sender, {
  swapParams: panoraQuoteParams,
}, typeArgs);
```

---

### Mock Vault

The mock vault module wraps `moneyfi_mock::vault`. It is a testing implementation of the MoneyFi vault for devnet/testnet use, supporting yield/loss simulation and manual state control.

#### Transaction Builders

```typescript
// Deposit into the mock vault
const txn = await client.mockVault.builder.deposit(sender, {
  token: tokenMetadataAddress,
  amount: 100_000_000n,
});

// Request a withdrawal
const txn = await client.mockVault.builder.requestWithdraw(sender, {
  token: tokenMetadataAddress,
  amount: 50_000_000n,
});

// Complete a pending withdrawal
const txn = await client.mockVault.builder.withdrawRequestedAmount(sender, {
  token: tokenMetadataAddress,
});
```

**Admin / test-tuning functions:**

```typescript
await client.mockVault.builder.setYieldMultiplier(admin, { multiplierBps: 10_500n }); // 105%
await client.mockVault.builder.simulateYield(admin, { yieldBps: 100n });  // +1%
await client.mockVault.builder.simulateLoss(admin, { lossBps: 50n });     // -0.5%
await client.mockVault.builder.resetVault(admin);
await client.mockVault.builder.setTotalDeposits(admin, { amount: 1_000_000_000n });
```

#### View Functions

```typescript
const fundValue: bigint = await client.mockVault.estimateTotalFundValue("0xabc...", tokenAddr);
const vaultAddr: string = await client.mockVault.getVaultAddress();
const multiplier: bigint = await client.mockVault.getYieldMultiplier();
const deposits: bigint = await client.mockVault.getTotalDeposits();
const pending: bigint = await client.mockVault.getPendingWithdrawals();

const depositorState = await client.mockVault.getDepositorState("0xabc...");
// → { deposited: bigint, pendingWithdrawal: bigint }
```

#### Resources

```typescript
const vaultState = await client.mockVault.resources.getMockVaultState(vaultAddr);
// → { total_deposits, yield_multiplier_bps, pending_withdrawals, admin, ... }

const depositorState = await client.mockVault.resources.getDepositorState("0xabc...");
// → { deposited: string, pending_withdrawal: string }
```

---

## Signing & Submitting Transactions

All `builder` methods return a `SimpleTransaction` from the Aptos SDK. Here is the full flow:

```typescript
import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

// 1. Build the transaction
const txn = await client.locking.builder.depositLocked(account.accountAddress, {
  amount: 100_000_000n,
  tier: LockingTier.Gold,
});

// 2. Sign and submit
const pendingTxn = await client.aptos.signAndSubmitTransaction({
  signer: account,
  transaction: txn,
});

// 3. Wait for confirmation
const result = await client.aptos.waitForTransaction({
  transactionHash: pendingTxn.hash,
});

console.log("Transaction succeeded:", result.success);
console.log("Version:", result.version);
```

### Simulation

You can simulate a transaction before submitting:

```typescript
const [simulation] = await client.aptos.transaction.simulate.simple({
  signerPublicKey: account.publicKey,
  transaction: txn,
});

console.log("Gas used:", simulation.gas_used);
console.log("Success:", simulation.success);
```

---

## Utilities & Constants

The SDK exports useful constants for calculations:

```typescript
import {
  BPS_DENOMINATOR,
  AET_SCALE,
  PRECISION,
  SEEDS,
  LOCKING_DURATIONS,
  GUARANTEED_YIELD_DURATIONS,
} from "@aptree/sdk";

// Basis points conversion
const yieldPercent = Number(yieldBps) / Number(BPS_DENOMINATOR) * 100;

// AET share price interpretation
// AET_SCALE = 1_000_000_000n (1e9)
// A share price of 1_050_000_000n means 1 AET = 1.05 underlying tokens

// Resource account seeds (for deriving addresses)
SEEDS.BRIDGE                         // "APTreeEarn"
SEEDS.MONEYFI_CONTROLLER             // "MoneyFiBridgeController"
SEEDS.MONEYFI_RESERVE                // "MoneyFiBridgeReserve"
SEEDS.LOCKING_CONTROLLER             // "APTreeLockingController"
SEEDS.GUARANTEED_YIELD_CONTROLLER    // "GuaranteedYieldController"
SEEDS.GUARANTEED_YIELD_CASHBACK_VAULT // "GuaranteedYieldCashbackVault"
SEEDS.MOCK_MONEYFI_VAULT             // "MockMoneyFiVault"

// Lock durations (in seconds)
LOCKING_DURATIONS.BRONZE  // 7_776_000n  (90 days)
LOCKING_DURATIONS.SILVER  // 15_552_000n (180 days)
LOCKING_DURATIONS.GOLD    // 31_536_000n (365 days)

GUARANTEED_YIELD_DURATIONS.STARTER // 2_592_000n  (30 days)
GUARANTEED_YIELD_DURATIONS.BRONZE  // 7_776_000n  (90 days)
GUARANTEED_YIELD_DURATIONS.SILVER  // 15_552_000n (180 days)
GUARANTEED_YIELD_DURATIONS.GOLD    // 31_536_000n (365 days)
```

---

## API Reference

### `AptreeClient`

| Property | Type | Description |
|---|---|---|
| `aptos` | `Aptos` | The underlying Aptos SDK instance |
| `addresses` | `AptreeAddresses` | Contract deployment addresses |
| `bridge` | `BridgeModule` | Bridge & MoneyFi adapter |
| `locking` | `LockingModule` | Time-locked positions |
| `guaranteedYield` | `GuaranteedYieldModule` | Guaranteed yield locking |
| `glade` | `GladeModule` | Panora swap + deposit/withdraw |
| `mockVault` | `MockVaultModule` | Mock vault for testing |

### `BridgeModule`

| Method | Description | Returns |
|---|---|---|
| **Builder** | | |
| `builder.deposit(sender, args)` | Deposit tokens, receive AET | `SimpleTransaction` |
| `builder.request(sender, args)` | Request withdrawal, burn AET | `SimpleTransaction` |
| `builder.withdraw(sender, args)` | Complete pending withdrawal | `SimpleTransaction` |
| `builder.adapterDeposit(sender, args)` | Low-level adapter deposit | `SimpleTransaction` |
| `builder.adapterRequest(sender, args)` | Low-level adapter request | `SimpleTransaction` |
| `builder.adapterWithdraw(sender, args)` | Low-level adapter withdraw | `SimpleTransaction` |
| **View Functions** | | |
| `getSupportedToken()` | Underlying token address | `string` |
| `getLpPrice()` | AET share price (scaled 1e9) | `bigint` |
| `getPoolEstimatedValue()` | Total pool value | `bigint` |
| **Resources** | | |
| `resources.getBridgeState(addr)` | Bridge state resource | `BridgeState` |
| `resources.getMoneyFiBridgeState(addr)` | Adapter state resource | `MoneyFiBridgeState` |
| `resources.getReserveState(addr)` | Reserve state resource | `MoneyFiReserveState` |
| `resources.getWithdrawalTokenState(addr)` | Withdrawal token state | `BridgeWithdrawalTokenState` |

### `LockingModule`

| Method | Description | Returns |
|---|---|---|
| **Builder** | | |
| `builder.depositLocked(sender, args)` | Create a lock position | `SimpleTransaction` |
| `builder.addToPosition(sender, args)` | Add tokens to existing position | `SimpleTransaction` |
| `builder.withdrawEarly(sender, args)` | Partial early withdrawal | `SimpleTransaction` |
| `builder.withdrawUnlocked(sender, args)` | Full withdrawal after unlock | `SimpleTransaction` |
| `builder.emergencyUnlock(sender, args)` | Emergency unlock (forfeits yield) | `SimpleTransaction` |
| `builder.setTierLimit(admin, args)` | Admin: update tier BPS limit | `SimpleTransaction` |
| `builder.setLocksEnabled(admin, args)` | Admin: enable/disable deposits | `SimpleTransaction` |
| **View Functions** | | |
| `getUserPositions(user)` | All user lock positions | `LockPosition[]` |
| `getPosition(user, positionId)` | Single position | `LockPosition` |
| `getEarlyWithdrawalAvailable(user, positionId)` | Amount available for early withdrawal | `bigint` |
| `isPositionUnlocked(user, positionId)` | Whether position has matured | `boolean` |
| `getUserTotalLockedValue(user)` | Total locked across all positions | `bigint` |
| `getTierConfig(tier)` | Tier duration + early limit | `TierConfig` |
| `getEmergencyUnlockPreview(user, positionId)` | Preview emergency unlock | `EmergencyUnlockPreview` |
| **Resources** | | |
| `resources.getUserLockPositions(user)` | Raw user positions resource | `UserLockPositions` |
| `resources.getLockConfig(addr)` | Raw global config resource | `LockConfig` |

### `GuaranteedYieldModule`

| Method | Description | Returns |
|---|---|---|
| **Builder** | | |
| `builder.depositGuaranteed(sender, args)` | Create guaranteed-yield position | `SimpleTransaction` |
| `builder.unlockGuaranteed(sender, args)` | Unlock matured position | `SimpleTransaction` |
| `builder.fundCashbackVault(sender, args)` | Fund the cashback vault | `SimpleTransaction` |
| `builder.emergencyUnlockGuaranteed(sender, args)` | Emergency unlock | `SimpleTransaction` |
| `builder.setTierYield(admin, args)` | Admin: update tier yield | `SimpleTransaction` |
| `builder.setTreasury(admin, args)` | Admin: set treasury address | `SimpleTransaction` |
| `builder.setDepositsEnabled(admin, args)` | Admin: toggle deposits | `SimpleTransaction` |
| `builder.adminWithdrawCashbackVault(admin, args)` | Admin: withdraw from vault | `SimpleTransaction` |
| `builder.proposeAdmin(admin, args)` | Admin: propose new admin | `SimpleTransaction` |
| `builder.acceptAdmin(newAdmin)` | Accept admin role | `SimpleTransaction` |
| `builder.setMaxTotalLocked(admin, args)` | Admin: set max locked cap | `SimpleTransaction` |
| `builder.setMinDeposit(admin, args)` | Admin: set min deposit | `SimpleTransaction` |
| **View Functions** | | |
| `getUserGuaranteedPositions(user)` | All user positions | `GuaranteedLockPosition[]` |
| `getGuaranteedPosition(user, positionId)` | Single position | `GuaranteedLockPosition` |
| `getTierGuaranteedYield(tier)` | Yield rate in BPS | `bigint` |
| `getTierDuration(tier)` | Lock duration in seconds | `bigint` |
| `calculateCashback(amount, tier)` | Preview cashback amount | `bigint` |
| `getCashbackVaultBalance()` | Vault balance | `bigint` |
| `getProtocolStats()` | Protocol-wide statistics | `ProtocolStats` |
| `isPositionUnlockable(user, positionId)` | Whether position can be unlocked | `boolean` |
| `getTierConfig(tier)` | Duration + yield in one call | `GuaranteedTierConfig` |
| `getTreasury()` | Treasury address | `string` |
| `areDepositsEnabled()` | Deposit toggle state | `boolean` |
| `getEmergencyUnlockPreview(user, positionId)` | Preview emergency unlock | `GuaranteedEmergencyUnlockPreview` |
| `getMaxTotalLocked()` | Max total locked cap | `bigint` |
| `getMinDeposit()` | Min deposit amount | `bigint` |
| **Resources** | | |
| `resources.getUserGuaranteedPositions(user)` | Raw user positions resource | `UserGuaranteedPositions` |

### `GladeModule`

| Method | Description | Returns |
|---|---|---|
| **Builder** | | |
| `builder.deposit(sender, args, typeArgs)` | Swap + bridge deposit | `SimpleTransaction` |
| `builder.withdraw(sender, args, typeArgs)` | Bridge withdraw + swap | `SimpleTransaction` |
| `builder.depositGuaranteed(sender, args, typeArgs)` | Swap + guaranteed-yield deposit | `SimpleTransaction` |
| `builder.unlockGuaranteed(sender, args, typeArgs)` | Unlock position + swap | `SimpleTransaction` |
| `builder.emergencyUnlockGuaranteed(sender, args, typeArgs)` | Emergency unlock + swap | `SimpleTransaction` |
| `builder.swap(sender, args, typeArgs)` | Standalone Panora swap | `SimpleTransaction` |

### `MockVaultModule`

| Method | Description | Returns |
|---|---|---|
| **Builder** | | |
| `builder.deposit(sender, args)` | Deposit into mock vault | `SimpleTransaction` |
| `builder.requestWithdraw(sender, args)` | Request withdrawal | `SimpleTransaction` |
| `builder.withdrawRequestedAmount(sender, args)` | Complete withdrawal | `SimpleTransaction` |
| `builder.setYieldMultiplier(admin, args)` | Admin: set yield multiplier | `SimpleTransaction` |
| `builder.simulateYield(admin, args)` | Admin: simulate yield | `SimpleTransaction` |
| `builder.simulateLoss(admin, args)` | Admin: simulate loss | `SimpleTransaction` |
| `builder.resetVault(admin)` | Admin: reset vault state | `SimpleTransaction` |
| `builder.setTotalDeposits(admin, args)` | Admin: set total deposits | `SimpleTransaction` |
| **View Functions** | | |
| `estimateTotalFundValue(depositor, token)` | Estimated fund value | `bigint` |
| `getVaultAddress()` | Vault resource address | `string` |
| `getYieldMultiplier()` | Current yield multiplier BPS | `bigint` |
| `getTotalDeposits()` | Total deposits | `bigint` |
| `getPendingWithdrawals()` | Total pending withdrawals | `bigint` |
| `getDepositorState(depositor)` | Depositor's state | `DepositorStateView` |
| **Resources** | | |
| `resources.getMockVaultState(addr)` | Raw vault state | `MockVaultState` |
| `resources.getDepositorState(depositor)` | Raw depositor state | `DepositorState` |

---

## License

MIT
