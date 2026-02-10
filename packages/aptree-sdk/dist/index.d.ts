import { Aptos, AptosConfig, AccountAddressInput, MoveFunctionId, SimpleTransaction, InputEntryFunctionData } from '@aptos-labs/ts-sdk';
export { InputEntryFunctionData } from '@aptos-labs/ts-sdk';

/**
 * Contract deployment addresses for the Aptree protocol.
 *
 * - `aptree` is the shared namespace address for bridge, locking, and guaranteed-yield modules.
 * - `moneyfi` is the address of the MoneyFi vault (or mock vault on testnet).
 */
interface AptreeAddresses {
    /** Address where bridge, moneyfi_adapter, locking, and GuaranteedYieldLocking modules are deployed. */
    aptree: string;
    /** Address where the MoneyFi vault (or mock vault) module is deployed. */
    moneyfi: string;
}
/** Preset addresses for the Aptos testnet deployment. */
declare const TESTNET_ADDRESSES: AptreeAddresses;
/**
 * Configuration for the {@link AptreeClient}.
 */
interface AptreeClientConfig {
    /** An existing Aptos SDK client instance, or an AptosConfig to construct one. */
    aptos: Aptos | AptosConfig;
    /** Contract deployment addresses. */
    addresses: AptreeAddresses;
}

/**
 * Abstract base class shared by all contract module classes.
 *
 * Provides helpers for building transactions, calling view functions,
 * and reading on-chain resources.
 */
declare abstract class BaseModule {
    protected readonly aptos: Aptos;
    protected readonly addresses: AptreeAddresses;
    constructor(aptos: Aptos, addresses: AptreeAddresses);
    /**
     * Build a simple entry-function transaction.
     *
     * @param sender - The account address that will sign the transaction.
     * @param functionId - Fully qualified Move function identifier (e.g. `"0x1::module::function"`).
     * @param functionArguments - Arguments to pass to the Move function.
     * @param typeArguments - Generic type arguments, if any.
     * @returns A built {@link SimpleTransaction} ready for signing and submission.
     */
    protected buildTransaction(sender: AccountAddressInput, functionId: MoveFunctionId, functionArguments: Array<string | number | boolean | Uint8Array | AccountAddressInput>, typeArguments?: string[]): Promise<SimpleTransaction>;
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
    protected buildPayload(functionId: MoveFunctionId, functionArguments: Array<string | number | boolean | Uint8Array | AccountAddressInput>, typeArguments?: string[]): InputEntryFunctionData;
    /**
     * Call an on-chain view function and return the raw result array.
     *
     * @param functionId - Fully qualified Move function identifier.
     * @param functionArguments - Arguments to pass to the view function.
     * @param typeArguments - Generic type arguments, if any.
     * @returns The result array returned by the view function.
     */
    protected view<T extends Array<unknown>>(functionId: MoveFunctionId, functionArguments?: Array<string | number | boolean | Uint8Array | AccountAddressInput>, typeArguments?: string[]): Promise<T>;
    /**
     * Read an on-chain Move resource with a typed return value.
     *
     * @param accountAddress - The account holding the resource.
     * @param resourceType - Fully qualified Move resource type (e.g. `"0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"`).
     * @returns The resource data parsed into type `T`.
     */
    protected getResource<T extends object>(accountAddress: AccountAddressInput, resourceType: `${string}::${string}::${string}`): Promise<T>;
}

/** On-chain resource `aptree::bridge::State`. Stored at the bridge resource account. */
interface BridgeState {
    signer_cap: {
        account: string;
    };
}
/** On-chain resource `aptree::moneyfi_adapter::BridgeState`. Stored at the controller resource account. */
interface MoneyFiBridgeState {
    controller: string;
    controller_capability: {
        account: string;
    };
    reserve: string;
    reserve_capability: {
        account: string;
    };
}
/** On-chain resource `aptree::moneyfi_adapter::ReserveState`. Stored at the reserve resource account. */
interface MoneyFiReserveState {
    mint_ref: object;
    burn_ref: object;
    transfer_ref: object;
    token_address: string;
}
/** On-chain resource `aptree::moneyfi_adapter::BridgeWithdrawalTokenState`. Stored at the reserve resource account. */
interface BridgeWithdrawalTokenState {
    mint_ref: object;
    burn_ref: object;
    transfer_ref: object;
    token_address: string;
}
/** Arguments for `bridge::deposit`. */
interface BridgeDepositArgs {
    /** The amount of the underlying token to deposit. */
    amount: number;
    /** The provider identifier (e.g. 0 for MoneyFi). */
    provider: number;
}
/** Arguments for `bridge::request`. */
interface BridgeRequestArgs {
    /** The amount of share tokens (AET) to request withdrawal for. */
    amount: number;
    /** Minimum acceptable share price (u128) as slippage protection. */
    minAmount: number;
}
/** Arguments for `bridge::withdraw`. */
interface BridgeWithdrawArgs {
    /** The amount of underlying tokens to withdraw. */
    amount: number;
    /** The provider identifier. */
    provider: number;
}
/** Arguments for `moneyfi_adapter::deposit`. */
interface MoneyFiAdapterDepositArgs {
    /** The amount of the underlying token to deposit. */
    amount: number;
}
/** Arguments for `moneyfi_adapter::request`. */
interface MoneyFiAdapterRequestArgs {
    /** The amount of AET share tokens to burn for withdrawal. */
    amount: number;
    /** Minimum share price (u128) for slippage protection. */
    minSharePrice: number;
}
/** Arguments for `moneyfi_adapter::withdraw`. */
interface MoneyFiAdapterWithdrawArgs {
    /** The amount of underlying tokens to withdraw. */
    amount: number;
}

/**
 * Transaction builders for the `aptree::bridge` and `aptree::moneyfi_adapter` entry functions.
 *
 * Each method returns a {@link SimpleTransaction} that can be signed and submitted
 * via the Aptos SDK.
 *
 * @example
 * ```typescript
 * const txn = await client.bridge.builder.deposit(senderAddress, {
 *   amount: 100_000_000,
 *   provider: 0,
 * });
 * const signed = client.aptos.transaction.sign({ signer, transaction: txn });
 * const result = await client.aptos.transaction.submit.simple({ transaction: txn, senderAuthenticator: signed });
 * ```
 */
declare class BridgeBuilder extends BaseModule {
    /**
     * Build a `bridge::deposit` transaction.
     *
     * Deposits the specified amount of the underlying token through the bridge,
     * routing through the given provider. The user receives AET share tokens in return.
     *
     * @param sender - The account address that will sign this transaction.
     * @param args - {@link BridgeDepositArgs}
     * @returns A built transaction ready for signing.
     */
    deposit(sender: AccountAddressInput, args: BridgeDepositArgs): Promise<SimpleTransaction>;
    /**
     * Build a `bridge::request` transaction.
     *
     * Requests a withdrawal by burning AET share tokens. The `minAmount` parameter
     * provides slippage protection — the transaction reverts if the share price is
     * below this threshold.
     *
     * @param sender - The account address that will sign this transaction.
     * @param args - {@link BridgeRequestArgs}
     * @returns A built transaction ready for signing.
     */
    request(sender: AccountAddressInput, args: BridgeRequestArgs): Promise<SimpleTransaction>;
    /**
     * Build a `bridge::withdraw` transaction.
     *
     * Completes a pending withdrawal request, transferring the underlying tokens
     * back to the user.
     *
     * @param sender - The account address that will sign this transaction.
     * @param args - {@link BridgeWithdrawArgs}
     * @returns A built transaction ready for signing.
     */
    withdraw(sender: AccountAddressInput, args: BridgeWithdrawArgs): Promise<SimpleTransaction>;
    /**
     * Build a `moneyfi_adapter::deposit` transaction.
     *
     * Deposits directly through the MoneyFi adapter without specifying a provider.
     * This is the lower-level deposit function used internally by the bridge.
     *
     * @param sender - The account address that will sign this transaction.
     * @param args - {@link MoneyFiAdapterDepositArgs}
     * @returns A built transaction ready for signing.
     */
    adapterDeposit(sender: AccountAddressInput, args: MoneyFiAdapterDepositArgs): Promise<SimpleTransaction>;
    /**
     * Build a `moneyfi_adapter::request` transaction.
     *
     * Requests a withdrawal through the adapter with minimum share price protection.
     *
     * @param sender - The account address that will sign this transaction.
     * @param args - {@link MoneyFiAdapterRequestArgs}
     * @returns A built transaction ready for signing.
     */
    adapterRequest(sender: AccountAddressInput, args: MoneyFiAdapterRequestArgs): Promise<SimpleTransaction>;
    /**
     * Build a `moneyfi_adapter::withdraw` transaction.
     *
     * Completes a pending withdrawal through the adapter.
     *
     * @param sender - The account address that will sign this transaction.
     * @param args - {@link MoneyFiAdapterWithdrawArgs}
     * @returns A built transaction ready for signing.
     */
    adapterWithdraw(sender: AccountAddressInput, args: MoneyFiAdapterWithdrawArgs): Promise<SimpleTransaction>;
    /** Payload for `bridge::deposit`. @see {@link deposit} */
    depositPayload(args: BridgeDepositArgs): InputEntryFunctionData;
    /** Payload for `bridge::request`. @see {@link request} */
    requestPayload(args: BridgeRequestArgs): InputEntryFunctionData;
    /** Payload for `bridge::withdraw`. @see {@link withdraw} */
    withdrawPayload(args: BridgeWithdrawArgs): InputEntryFunctionData;
    /** Payload for `moneyfi_adapter::deposit`. @see {@link adapterDeposit} */
    adapterDepositPayload(args: MoneyFiAdapterDepositArgs): InputEntryFunctionData;
    /** Payload for `moneyfi_adapter::request`. @see {@link adapterRequest} */
    adapterRequestPayload(args: MoneyFiAdapterRequestArgs): InputEntryFunctionData;
    /** Payload for `moneyfi_adapter::withdraw`. @see {@link adapterWithdraw} */
    adapterWithdrawPayload(args: MoneyFiAdapterWithdrawArgs): InputEntryFunctionData;
}

/**
 * Resource readers for the `aptree::bridge` and `aptree::moneyfi_adapter` on-chain resources.
 *
 * Resources are raw Move structs stored on-chain at specific account addresses.
 * Use these methods to read the current state of the bridge contracts.
 *
 * @example
 * ```typescript
 * const bridgeState = await client.bridge.resources.getBridgeState(bridgeResourceAddress);
 * ```
 */
declare class BridgeResources extends BaseModule {
    /**
     * Read the `bridge::State` resource.
     *
     * This resource is created during module initialization and stored at the
     * bridge's resource account address.
     *
     * @param address - The account address holding the resource.
     * @returns The bridge state containing the signer capability.
     */
    getBridgeState(address: AccountAddressInput): Promise<BridgeState>;
    /**
     * Read the `moneyfi_adapter::BridgeState` resource.
     *
     * Contains controller and reserve addresses and their signer capabilities.
     *
     * @param address - The controller resource account address.
     * @returns The MoneyFi bridge state.
     */
    getMoneyFiBridgeState(address: AccountAddressInput): Promise<MoneyFiBridgeState>;
    /**
     * Read the `moneyfi_adapter::ReserveState` resource.
     *
     * Contains mint/burn/transfer references and the AET token address.
     *
     * @param address - The reserve resource account address.
     * @returns The reserve state.
     */
    getReserveState(address: AccountAddressInput): Promise<MoneyFiReserveState>;
    /**
     * Read the `moneyfi_adapter::BridgeWithdrawalTokenState` resource.
     *
     * Contains mint/burn/transfer references for withdrawal tokens (AEWT).
     *
     * @param address - The reserve resource account address.
     * @returns The withdrawal token state.
     */
    getWithdrawalTokenState(address: AccountAddressInput): Promise<BridgeWithdrawalTokenState>;
}

/**
 * Module for interacting with the `aptree::bridge` and `aptree::moneyfi_adapter` contracts.
 *
 * Provides:
 * - {@link BridgeModule.builder | builder} — Transaction builders for all entry functions.
 * - {@link BridgeModule.resources | resources} — Typed readers for on-chain resources.
 * - View functions as direct methods (e.g. {@link BridgeModule.getSupportedToken | getSupportedToken}).
 *
 * @example
 * ```typescript
 * // Build and submit a deposit transaction
 * const txn = await client.bridge.builder.deposit(sender, { amount: 1_00000000, provider: 0 });
 *
 * // Query the current LP price
 * const lpPrice = await client.bridge.getLpPrice();
 *
 * // Read on-chain state
 * const state = await client.bridge.resources.getBridgeState(bridgeAddress);
 * ```
 */
declare class BridgeModule extends BaseModule {
    /** Transaction builders for bridge entry functions. */
    readonly builder: BridgeBuilder;
    /** Typed readers for bridge on-chain resources. */
    readonly resources: BridgeResources;
    constructor(aptos: Aptos, addresses: AptreeAddresses);
    /**
     * Get the address of the supported underlying token (e.g. USDT metadata object).
     *
     * Calls `moneyfi_adapter::get_supported_token`.
     *
     * @returns The address of the supported fungible asset metadata object.
     */
    getSupportedToken(): Promise<string>;
    /**
     * Get the current LP (AET) share price.
     *
     * Calls `moneyfi_adapter::get_lp_price`.
     *
     * The price is scaled by AET_SCALE (1e9). A value of `1_000_000_000` means 1:1.
     *
     * @returns The current share price as a number (u128).
     */
    getLpPrice(): Promise<number>;
    /**
     * Get the total estimated value of the pool in the underlying token.
     *
     * Calls `moneyfi_adapter::get_pool_estimated_value`.
     *
     * @returns The pool's estimated total value.
     */
    getPoolEstimatedValue(): Promise<number>;
}

/**
 * On-chain struct `aptree::locking::LockPosition`.
 *
 * Represents a single time-locked deposit position held by a user.
 */
interface LockPosition {
    /** Unique identifier for this position within the user's positions. */
    position_id: string;
    /** Tier of the lock (1=Bronze, 2=Silver, 3=Gold). */
    tier: number;
    /** Principal amount in the underlying token. */
    principal: string;
    /** Number of AET share tokens held. */
    aet_amount: string;
    /** Share price at the time of deposit (u128, scaled by AET_SCALE). */
    entry_share_price: string;
    /** Unix timestamp when the position was created. */
    created_at: string;
    /** Unix timestamp when the position unlocks. */
    unlock_at: string;
    /** Amount of early withdrawal already used. */
    early_withdrawal_used: string;
}
/** On-chain resource `aptree::locking::UserLockPositions`. Stored at the user's account. */
interface UserLockPositions {
    positions: LockPosition[];
    next_position_id: string;
}
/** On-chain resource `aptree::locking::LockConfig`. Stored at the controller resource account. */
interface LockConfig {
    signer_cap: {
        account: string;
    };
    tier_limits_bps: string[];
    tier_durations: string[];
    locks_enabled: boolean;
    admin: string;
}
/** Parsed return type for `locking::get_tier_config(tier) -> (duration, early_limit_bps)`. */
interface TierConfig {
    /** Lock duration in seconds. */
    durationSeconds: number;
    /** Early withdrawal limit in basis points. */
    earlyLimitBps: number;
}
/** Parsed return type for `locking::get_emergency_unlock_preview(user, position_id) -> (payout, forfeited)`. */
interface EmergencyUnlockPreview {
    /** Amount the user receives. */
    payout: number;
    /** Amount forfeited by the user. */
    forfeited: number;
}
/** Arguments for `locking::deposit_locked`. */
interface DepositLockedArgs {
    /** Amount of underlying tokens to lock. */
    amount: number;
    /** Lock tier (1=Bronze, 2=Silver, 3=Gold). Use {@link LockingTier} enum. */
    tier: number;
}
/** Arguments for `locking::add_to_position`. */
interface AddToPositionArgs {
    /** ID of the existing position to add to. */
    positionId: number;
    /** Additional amount to lock. */
    amount: number;
}
/** Arguments for `locking::withdraw_early`. */
interface WithdrawEarlyArgs {
    /** ID of the position to withdraw from. */
    positionId: number;
    /** Amount to withdraw early. */
    amount: number;
}
/** Arguments for `locking::withdraw_unlocked`. */
interface WithdrawUnlockedArgs {
    /** ID of the unlocked position to withdraw. */
    positionId: number;
}
/** Arguments for `locking::emergency_unlock`. */
interface EmergencyUnlockArgs {
    /** ID of the position to emergency unlock. */
    positionId: number;
}
/** Arguments for `locking::set_tier_limit` (admin only). */
interface SetTierLimitArgs {
    /** Tier to update (1=Bronze, 2=Silver, 3=Gold). */
    tier: number;
    /** New early withdrawal limit in basis points. */
    newLimitBps: number;
}
/** Arguments for `locking::set_locks_enabled` (admin only). */
interface SetLocksEnabledArgs {
    /** Whether locking deposits should be enabled. */
    enabled: boolean;
}

/**
 * Transaction builders for the `aptree::locking` entry functions.
 *
 * Each method returns a {@link SimpleTransaction} ready for signing and submission.
 *
 * @example
 * ```typescript
 * const txn = await client.locking.builder.depositLocked(sender, {
 *   amount: 100_000_000,
 *   tier: LockingTier.Gold,
 * });
 * ```
 */
declare class LockingBuilder extends BaseModule {
    /**
     * Build a `locking::deposit_locked` transaction.
     *
     * Creates a new time-locked deposit position. The user's tokens are deposited
     * through the bridge and locked for the tier's duration. AET share tokens are
     * minted and held in the lock position.
     *
     * @param sender - The account address that will sign this transaction.
     * @param args - {@link DepositLockedArgs}
     * @returns A built transaction ready for signing.
     */
    depositLocked(sender: AccountAddressInput, args: DepositLockedArgs): Promise<SimpleTransaction>;
    /**
     * Build a `locking::add_to_position` transaction.
     *
     * Adds additional tokens to an existing lock position. The unlock timestamp
     * does not change — only the principal and AET amounts increase. The entry
     * share price is recalculated as a weighted average.
     *
     * @param sender - The account address that will sign this transaction.
     * @param args - {@link AddToPositionArgs}
     * @returns A built transaction ready for signing.
     */
    addToPosition(sender: AccountAddressInput, args: AddToPositionArgs): Promise<SimpleTransaction>;
    /**
     * Build a `locking::withdraw_early` transaction.
     *
     * Withdraws tokens from a locked position before the unlock date. The
     * withdrawal is limited by the tier's early withdrawal BPS limit, applied
     * to the position's principal.
     *
     * @param sender - The account address that will sign this transaction.
     * @param args - {@link WithdrawEarlyArgs}
     * @returns A built transaction ready for signing.
     */
    withdrawEarly(sender: AccountAddressInput, args: WithdrawEarlyArgs): Promise<SimpleTransaction>;
    /**
     * Build a `locking::withdraw_unlocked` transaction.
     *
     * Withdraws all tokens from a position that has passed its unlock date.
     * The full AET amount is redeemed through the bridge at the current share price.
     *
     * @param sender - The account address that will sign this transaction.
     * @param args - {@link WithdrawUnlockedArgs}
     * @returns A built transaction ready for signing.
     */
    withdrawUnlocked(sender: AccountAddressInput, args: WithdrawUnlockedArgs): Promise<SimpleTransaction>;
    /**
     * Build a `locking::emergency_unlock` transaction.
     *
     * Immediately unlocks a position, forfeiting any accrued yield. The user
     * receives their principal minus any yield portion. Use
     * {@link LockingModule.getEmergencyUnlockPreview | getEmergencyUnlockPreview}
     * to see the expected payout before calling this.
     *
     * @param sender - The account address that will sign this transaction.
     * @param args - {@link EmergencyUnlockArgs}
     * @returns A built transaction ready for signing.
     */
    emergencyUnlock(sender: AccountAddressInput, args: EmergencyUnlockArgs): Promise<SimpleTransaction>;
    /**
     * Build a `locking::set_tier_limit` transaction.
     *
     * Updates the early withdrawal BPS limit for a given tier.
     *
     * @remarks Admin only — the sender must be the contract admin.
     *
     * @param sender - The admin account address.
     * @param args - {@link SetTierLimitArgs}
     * @returns A built transaction ready for signing.
     */
    setTierLimit(sender: AccountAddressInput, args: SetTierLimitArgs): Promise<SimpleTransaction>;
    /**
     * Build a `locking::set_locks_enabled` transaction.
     *
     * Enables or disables new lock deposits. Existing positions are not affected.
     *
     * @remarks Admin only — the sender must be the contract admin.
     *
     * @param sender - The admin account address.
     * @param args - {@link SetLocksEnabledArgs}
     * @returns A built transaction ready for signing.
     */
    setLocksEnabled(sender: AccountAddressInput, args: SetLocksEnabledArgs): Promise<SimpleTransaction>;
    /** Payload for `locking::deposit_locked`. @see {@link depositLocked} */
    depositLockedPayload(args: DepositLockedArgs): InputEntryFunctionData;
    /** Payload for `locking::add_to_position`. @see {@link addToPosition} */
    addToPositionPayload(args: AddToPositionArgs): InputEntryFunctionData;
    /** Payload for `locking::withdraw_early`. @see {@link withdrawEarly} */
    withdrawEarlyPayload(args: WithdrawEarlyArgs): InputEntryFunctionData;
    /** Payload for `locking::withdraw_unlocked`. @see {@link withdrawUnlocked} */
    withdrawUnlockedPayload(args: WithdrawUnlockedArgs): InputEntryFunctionData;
    /** Payload for `locking::emergency_unlock`. @see {@link emergencyUnlock} */
    emergencyUnlockPayload(args: EmergencyUnlockArgs): InputEntryFunctionData;
    /** Payload for `locking::set_tier_limit`. @see {@link setTierLimit} */
    setTierLimitPayload(args: SetTierLimitArgs): InputEntryFunctionData;
    /** Payload for `locking::set_locks_enabled`. @see {@link setLocksEnabled} */
    setLocksEnabledPayload(args: SetLocksEnabledArgs): InputEntryFunctionData;
}

/**
 * Resource readers for the `aptree::locking` on-chain resources.
 *
 * @example
 * ```typescript
 * const userPositions = await client.locking.resources.getUserLockPositions(userAddress);
 * console.log(userPositions.positions.length);
 * ```
 */
declare class LockingResources extends BaseModule {
    /**
     * Read the `locking::UserLockPositions` resource for a given user.
     *
     * Contains all of the user's lock positions and the next position ID counter.
     * This resource is stored at the user's account address.
     *
     * @param user - The user's account address.
     * @returns The user's lock positions resource.
     */
    getUserLockPositions(user: AccountAddressInput): Promise<UserLockPositions>;
    /**
     * Read the `locking::LockConfig` resource.
     *
     * Contains global configuration: tier limits, durations, admin address,
     * and whether locks are enabled. Stored at the locking controller resource account.
     *
     * @param configAddress - The controller resource account address.
     * @returns The locking configuration resource.
     */
    getLockConfig(configAddress: AccountAddressInput): Promise<LockConfig>;
}

/**
 * Module for interacting with the `aptree::locking` contract.
 *
 * Provides:
 * - {@link LockingModule.builder | builder} — Transaction builders for all entry functions.
 * - {@link LockingModule.resources | resources} — Typed readers for on-chain resources.
 * - View functions as direct methods (e.g. {@link LockingModule.getUserPositions | getUserPositions}).
 *
 * @example
 * ```typescript
 * // Query a user's lock positions
 * const positions = await client.locking.getUserPositions("0xabc...");
 *
 * // Check if a position is unlocked
 * const unlocked = await client.locking.isPositionUnlocked("0xabc...", 0);
 *
 * // Build a deposit transaction
 * const txn = await client.locking.builder.depositLocked(sender, {
 *   amount: 100_000_000,
 *   tier: LockingTier.Gold,
 * });
 * ```
 */
declare class LockingModule extends BaseModule {
    /** Transaction builders for locking entry functions. */
    readonly builder: LockingBuilder;
    /** Typed readers for locking on-chain resources. */
    readonly resources: LockingResources;
    constructor(aptos: Aptos, addresses: AptreeAddresses);
    /**
     * Get all lock positions for a user.
     *
     * Calls `locking::get_user_positions`.
     *
     * @param user - The user's account address.
     * @returns Array of {@link LockPosition} structs.
     */
    getUserPositions(user: AccountAddressInput): Promise<LockPosition[]>;
    /**
     * Get a specific lock position for a user.
     *
     * Calls `locking::get_position`.
     *
     * @param user - The user's account address.
     * @param positionId - The position ID.
     * @returns The {@link LockPosition} struct.
     */
    getPosition(user: AccountAddressInput, positionId: number): Promise<LockPosition>;
    /**
     * Get the amount available for early withdrawal from a position.
     *
     * Calls `locking::get_early_withdrawal_available`.
     *
     * The available amount is calculated based on the tier's BPS limit applied
     * to the position's principal, minus any early withdrawals already taken.
     *
     * @param user - The user's account address.
     * @param positionId - The position ID.
     * @returns The amount available for early withdrawal.
     */
    getEarlyWithdrawalAvailable(user: AccountAddressInput, positionId: number): Promise<number>;
    /**
     * Check if a lock position has passed its unlock date.
     *
     * Calls `locking::is_position_unlocked`.
     *
     * @param user - The user's account address.
     * @param positionId - The position ID.
     * @returns `true` if the position can be fully withdrawn.
     */
    isPositionUnlocked(user: AccountAddressInput, positionId: number): Promise<boolean>;
    /**
     * Get the total locked value across all of a user's positions.
     *
     * Calls `locking::get_user_total_locked_value`.
     *
     * @param user - The user's account address.
     * @returns The total locked value in the underlying token.
     */
    getUserTotalLockedValue(user: AccountAddressInput): Promise<number>;
    /**
     * Get the configuration for a specific tier.
     *
     * Calls `locking::get_tier_config`.
     *
     * @param tier - The tier number (1=Bronze, 2=Silver, 3=Gold).
     * @returns A {@link TierConfig} with the tier's duration and early withdrawal limit.
     */
    getTierConfig(tier: number): Promise<TierConfig>;
    /**
     * Preview the outcome of an emergency unlock for a position.
     *
     * Calls `locking::get_emergency_unlock_preview`.
     *
     * @param user - The user's account address.
     * @param positionId - The position ID.
     * @returns A {@link EmergencyUnlockPreview} with the expected payout and forfeited amount.
     */
    getEmergencyUnlockPreview(user: AccountAddressInput, positionId: number): Promise<EmergencyUnlockPreview>;
}

/**
 * On-chain struct `aptree::GuaranteedYieldLocking::GuaranteedLockPosition`.
 *
 * Represents a guaranteed-yield lock position with instant cashback.
 */
interface GuaranteedLockPosition {
    /** Unique position identifier. */
    position_id: string;
    /** Tier (1=Starter, 2=Bronze, 3=Silver, 4=Gold). */
    tier: number;
    /** Principal amount in the underlying token. */
    principal: string;
    /** Number of AET share tokens held. */
    aet_amount: string;
    /** Cashback already paid out for this position. */
    cashback_paid: string;
    /** Guaranteed yield rate in basis points. */
    guaranteed_yield_bps: string;
    /** Unix timestamp when the position was created. */
    created_at: string;
    /** Unix timestamp when the position can be unlocked. */
    unlock_at: string;
}
/** On-chain resource `aptree::GuaranteedYieldLocking::UserGuaranteedPositions`. */
interface UserGuaranteedPositions {
    positions: GuaranteedLockPosition[];
    next_position_id: string;
}
/**
 * Parsed return type for `get_protocol_stats() -> (total_locked, total_aet, total_cashback, total_yield_to_treasury)`.
 */
interface ProtocolStats {
    totalLockedPrincipal: number;
    totalAetHeld: number;
    totalCashbackPaid: number;
    totalYieldToTreasury: number;
}
/** Parsed return type for `get_tier_config(tier) -> (duration, yield_bps)`. */
interface GuaranteedTierConfig {
    /** Lock duration in seconds. */
    durationSeconds: number;
    /** Guaranteed yield in basis points. */
    yieldBps: number;
}
/**
 * Parsed return type for `get_emergency_unlock_preview(user, position_id) -> (payout, yield_forfeited, cashback_clawback)`.
 */
interface GuaranteedEmergencyUnlockPreview {
    /** Amount the user receives. */
    payout: number;
    /** Amount of yield forfeited. */
    yieldForfeited: number;
    /** Cashback amount clawed back. */
    cashbackClawback: number;
}
/** Arguments for `GuaranteedYieldLocking::deposit_guaranteed`. */
interface DepositGuaranteedArgs {
    /** Amount of underlying tokens to deposit. */
    amount: number;
    /** Lock tier (1=Starter, 2=Bronze, 3=Silver, 4=Gold). Use {@link GuaranteedYieldTier} enum. */
    tier: number;
    /** Minimum AET tokens to receive (slippage protection). */
    minAetReceived: number;
}
/**
 * Arguments for `GuaranteedYieldLocking::request_unlock_guaranteed`.
 *
 * Initiates the unlock process for a matured position. This requests a
 * withdrawal from MoneyFi which must be confirmed off-chain before
 * calling {@link WithdrawGuaranteedArgs | withdraw_guaranteed}.
 */
interface RequestUnlockGuaranteedArgs {
    /** ID of the position to request unlock for. */
    positionId: number;
}
/**
 * Arguments for `GuaranteedYieldLocking::withdraw_guaranteed`.
 *
 * Completes the unlock process after the off-chain withdrawal confirmation.
 * Must be called after {@link RequestUnlockGuaranteedArgs | request_unlock_guaranteed}.
 */
interface WithdrawGuaranteedArgs {
    /** ID of the position to withdraw. */
    positionId: number;
}
/** Arguments for `GuaranteedYieldLocking::fund_cashback_vault`. */
interface FundCashbackVaultArgs {
    /** Amount to fund the cashback vault with. */
    amount: number;
}
/**
 * Arguments for `GuaranteedYieldLocking::request_emergency_unlock_guaranteed`.
 *
 * Initiates emergency unlock before maturity. Requests a withdrawal from
 * MoneyFi which must be confirmed off-chain before calling
 * {@link WithdrawEmergencyGuaranteedArgs | withdraw_emergency_guaranteed}.
 */
interface RequestEmergencyUnlockGuaranteedArgs {
    /** ID of the position to emergency unlock. */
    positionId: number;
}
/**
 * Arguments for `GuaranteedYieldLocking::withdraw_emergency_guaranteed`.
 *
 * Completes the emergency unlock after off-chain withdrawal confirmation.
 * Must be called after {@link RequestEmergencyUnlockGuaranteedArgs | request_emergency_unlock_guaranteed}.
 */
interface WithdrawEmergencyGuaranteedArgs {
    /** ID of the position to complete emergency withdrawal for. */
    positionId: number;
}
/** Arguments for `GuaranteedYieldLocking::set_tier_yield` (admin only). */
interface SetTierYieldArgs {
    /** Tier to update. */
    tier: number;
    /** New yield in basis points. */
    newYieldBps: number;
}
/** Arguments for `GuaranteedYieldLocking::set_treasury` (admin only). */
interface SetTreasuryArgs {
    /** New treasury address. */
    newTreasury: string;
}
/** Arguments for `GuaranteedYieldLocking::set_deposits_enabled` (admin only). */
interface SetDepositsEnabledArgs {
    /** Whether deposits should be enabled. */
    enabled: boolean;
}
/** Arguments for `GuaranteedYieldLocking::admin_withdraw_cashback_vault` (admin only). */
interface AdminWithdrawCashbackVaultArgs {
    /** Amount to withdraw from the cashback vault. */
    amount: number;
}
/** Arguments for `GuaranteedYieldLocking::propose_admin` (admin only). */
interface ProposeAdminArgs {
    /** Address of the proposed new admin. */
    newAdmin: string;
}
/** Arguments for `GuaranteedYieldLocking::set_max_total_locked` (admin only). */
interface SetMaxTotalLockedArgs {
    /** New maximum total locked principal. */
    newMax: number;
}
/** Arguments for `GuaranteedYieldLocking::set_min_deposit` (admin only). */
interface SetMinDepositArgs {
    /** New minimum deposit amount. */
    newMin: number;
}

/**
 * Transaction builders for the `aptree::GuaranteedYieldLocking` entry functions.
 *
 * @example
 * ```typescript
 * const txn = await client.guaranteedYield.builder.depositGuaranteed(sender, {
 *   amount: 100_000_000,
 *   tier: GuaranteedYieldTier.Gold,
 *   minAetReceived: 0,
 * });
 * ```
 */
declare class GuaranteedYieldBuilder extends BaseModule {
    /**
     * Build a `GuaranteedYieldLocking::deposit_guaranteed` transaction.
     *
     * Creates a guaranteed-yield lock position. The user deposits tokens, receives
     * AET share tokens (locked for the tier duration), and immediately receives
     * a cashback payment representing the guaranteed yield.
     *
     * @param sender - The account address that will sign this transaction.
     * @param args - {@link DepositGuaranteedArgs}
     * @returns A built transaction ready for signing.
     */
    depositGuaranteed(sender: AccountAddressInput, args: DepositGuaranteedArgs): Promise<SimpleTransaction>;
    /**
     * Build a `GuaranteedYieldLocking::request_unlock_guaranteed` transaction.
     *
     * **Step 1 of 2** for unlocking a matured guaranteed-yield position.
     *
     * Initiates the unlock by requesting a withdrawal from MoneyFi. This is an
     * async operation — the withdrawal must be confirmed off-chain before calling
     * {@link withdrawGuaranteed} to complete the process.
     *
     * @param sender - The account address that will sign this transaction.
     * @param args - {@link RequestUnlockGuaranteedArgs}
     * @returns A built transaction ready for signing.
     */
    requestUnlockGuaranteed(sender: AccountAddressInput, args: RequestUnlockGuaranteedArgs): Promise<SimpleTransaction>;
    /**
     * Build a `GuaranteedYieldLocking::withdraw_guaranteed` transaction.
     *
     * **Step 2 of 2** for unlocking a matured guaranteed-yield position.
     *
     * Completes the unlock after the off-chain withdrawal confirmation. The user
     * receives their principal. Any yield above the guaranteed amount is sent to
     * the treasury.
     *
     * Must be called after {@link requestUnlockGuaranteed} and off-chain confirmation.
     *
     * @param sender - The account address that will sign this transaction.
     * @param args - {@link WithdrawGuaranteedArgs}
     * @returns A built transaction ready for signing.
     */
    withdrawGuaranteed(sender: AccountAddressInput, args: WithdrawGuaranteedArgs): Promise<SimpleTransaction>;
    /**
     * Build a `GuaranteedYieldLocking::fund_cashback_vault` transaction.
     *
     * Funds the cashback vault with underlying tokens. The vault is used to pay
     * instant cashback to users when they create guaranteed-yield positions.
     *
     * @param sender - The account address that will sign this transaction.
     * @param args - {@link FundCashbackVaultArgs}
     * @returns A built transaction ready for signing.
     */
    fundCashbackVault(sender: AccountAddressInput, args: FundCashbackVaultArgs): Promise<SimpleTransaction>;
    /**
     * Build a `GuaranteedYieldLocking::request_emergency_unlock_guaranteed` transaction.
     *
     * **Step 1 of 2** for emergency-unlocking a position before maturity.
     *
     * Initiates the emergency unlock by requesting a withdrawal from MoneyFi.
     * The withdrawal must be confirmed off-chain before calling
     * {@link withdrawEmergencyGuaranteed} to complete the process.
     *
     * Use {@link GuaranteedYieldModule.getEmergencyUnlockPreview | getEmergencyUnlockPreview}
     * to preview the expected payout, forfeited yield, and cashback clawback.
     *
     * @param sender - The account address that will sign this transaction.
     * @param args - {@link RequestEmergencyUnlockGuaranteedArgs}
     * @returns A built transaction ready for signing.
     */
    requestEmergencyUnlockGuaranteed(sender: AccountAddressInput, args: RequestEmergencyUnlockGuaranteedArgs): Promise<SimpleTransaction>;
    /**
     * Build a `GuaranteedYieldLocking::withdraw_emergency_guaranteed` transaction.
     *
     * **Step 2 of 2** for emergency-unlocking a position before maturity.
     *
     * Completes the emergency unlock after off-chain withdrawal confirmation.
     * The user forfeits yield and the cashback is clawed back.
     *
     * Must be called after {@link requestEmergencyUnlockGuaranteed} and off-chain confirmation.
     *
     * @param sender - The account address that will sign this transaction.
     * @param args - {@link WithdrawEmergencyGuaranteedArgs}
     * @returns A built transaction ready for signing.
     */
    withdrawEmergencyGuaranteed(sender: AccountAddressInput, args: WithdrawEmergencyGuaranteedArgs): Promise<SimpleTransaction>;
    /**
     * Build a `GuaranteedYieldLocking::set_tier_yield` transaction.
     *
     * Updates the guaranteed yield BPS for a given tier. Only affects new positions.
     *
     * @remarks Admin only.
     * @param sender - The admin account address.
     * @param args - {@link SetTierYieldArgs}
     */
    setTierYield(sender: AccountAddressInput, args: SetTierYieldArgs): Promise<SimpleTransaction>;
    /**
     * Build a `GuaranteedYieldLocking::set_treasury` transaction.
     *
     * Updates the treasury address that receives excess yield above the guaranteed rate.
     *
     * @remarks Admin only.
     * @param sender - The admin account address.
     * @param args - {@link SetTreasuryArgs}
     */
    setTreasury(sender: AccountAddressInput, args: SetTreasuryArgs): Promise<SimpleTransaction>;
    /**
     * Build a `GuaranteedYieldLocking::set_deposits_enabled` transaction.
     *
     * Enables or disables new guaranteed-yield deposits.
     *
     * @remarks Admin only.
     * @param sender - The admin account address.
     * @param args - {@link SetDepositsEnabledArgs}
     */
    setDepositsEnabled(sender: AccountAddressInput, args: SetDepositsEnabledArgs): Promise<SimpleTransaction>;
    /**
     * Build a `GuaranteedYieldLocking::admin_withdraw_cashback_vault` transaction.
     *
     * Withdraws tokens from the cashback vault to the admin.
     *
     * @remarks Admin only.
     * @param sender - The admin account address.
     * @param args - {@link AdminWithdrawCashbackVaultArgs}
     */
    adminWithdrawCashbackVault(sender: AccountAddressInput, args: AdminWithdrawCashbackVaultArgs): Promise<SimpleTransaction>;
    /**
     * Build a `GuaranteedYieldLocking::propose_admin` transaction.
     *
     * Proposes a new admin address. The new admin must call {@link acceptAdmin}
     * to complete the transfer.
     *
     * @remarks Admin only.
     * @param sender - The current admin account address.
     * @param args - {@link ProposeAdminArgs}
     */
    proposeAdmin(sender: AccountAddressInput, args: ProposeAdminArgs): Promise<SimpleTransaction>;
    /**
     * Build a `GuaranteedYieldLocking::accept_admin` transaction.
     *
     * Accepts the admin role after being proposed via {@link proposeAdmin}.
     *
     * @param sender - The proposed new admin account address.
     * @returns A built transaction ready for signing.
     */
    acceptAdmin(sender: AccountAddressInput): Promise<SimpleTransaction>;
    /**
     * Build a `GuaranteedYieldLocking::set_max_total_locked` transaction.
     *
     * Sets the maximum total principal that can be locked across all positions.
     *
     * @remarks Admin only.
     * @param sender - The admin account address.
     * @param args - {@link SetMaxTotalLockedArgs}
     */
    setMaxTotalLocked(sender: AccountAddressInput, args: SetMaxTotalLockedArgs): Promise<SimpleTransaction>;
    /**
     * Build a `GuaranteedYieldLocking::set_min_deposit` transaction.
     *
     * Sets the minimum deposit amount for new positions.
     *
     * @remarks Admin only.
     * @param sender - The admin account address.
     * @param args - {@link SetMinDepositArgs}
     */
    setMinDeposit(sender: AccountAddressInput, args: SetMinDepositArgs): Promise<SimpleTransaction>;
    /** Payload for `GuaranteedYieldLocking::deposit_guaranteed`. @see {@link depositGuaranteed} */
    depositGuaranteedPayload(args: DepositGuaranteedArgs): InputEntryFunctionData;
    /** Payload for `GuaranteedYieldLocking::request_unlock_guaranteed`. @see {@link requestUnlockGuaranteed} */
    requestUnlockGuaranteedPayload(args: RequestUnlockGuaranteedArgs): InputEntryFunctionData;
    /** Payload for `GuaranteedYieldLocking::withdraw_guaranteed`. @see {@link withdrawGuaranteed} */
    withdrawGuaranteedPayload(args: WithdrawGuaranteedArgs): InputEntryFunctionData;
    /** Payload for `GuaranteedYieldLocking::fund_cashback_vault`. @see {@link fundCashbackVault} */
    fundCashbackVaultPayload(args: FundCashbackVaultArgs): InputEntryFunctionData;
    /** Payload for `GuaranteedYieldLocking::request_emergency_unlock_guaranteed`. @see {@link requestEmergencyUnlockGuaranteed} */
    requestEmergencyUnlockGuaranteedPayload(args: RequestEmergencyUnlockGuaranteedArgs): InputEntryFunctionData;
    /** Payload for `GuaranteedYieldLocking::withdraw_emergency_guaranteed`. @see {@link withdrawEmergencyGuaranteed} */
    withdrawEmergencyGuaranteedPayload(args: WithdrawEmergencyGuaranteedArgs): InputEntryFunctionData;
    /** Payload for `GuaranteedYieldLocking::set_tier_yield`. @see {@link setTierYield} */
    setTierYieldPayload(args: SetTierYieldArgs): InputEntryFunctionData;
    /** Payload for `GuaranteedYieldLocking::set_treasury`. @see {@link setTreasury} */
    setTreasuryPayload(args: SetTreasuryArgs): InputEntryFunctionData;
    /** Payload for `GuaranteedYieldLocking::set_deposits_enabled`. @see {@link setDepositsEnabled} */
    setDepositsEnabledPayload(args: SetDepositsEnabledArgs): InputEntryFunctionData;
    /** Payload for `GuaranteedYieldLocking::admin_withdraw_cashback_vault`. @see {@link adminWithdrawCashbackVault} */
    adminWithdrawCashbackVaultPayload(args: AdminWithdrawCashbackVaultArgs): InputEntryFunctionData;
    /** Payload for `GuaranteedYieldLocking::propose_admin`. @see {@link proposeAdmin} */
    proposeAdminPayload(args: ProposeAdminArgs): InputEntryFunctionData;
    /** Payload for `GuaranteedYieldLocking::accept_admin`. @see {@link acceptAdmin} */
    acceptAdminPayload(): InputEntryFunctionData;
    /** Payload for `GuaranteedYieldLocking::set_max_total_locked`. @see {@link setMaxTotalLocked} */
    setMaxTotalLockedPayload(args: SetMaxTotalLockedArgs): InputEntryFunctionData;
    /** Payload for `GuaranteedYieldLocking::set_min_deposit`. @see {@link setMinDeposit} */
    setMinDepositPayload(args: SetMinDepositArgs): InputEntryFunctionData;
}

/**
 * Resource readers for the `aptree::GuaranteedYieldLocking` on-chain resources.
 *
 * @example
 * ```typescript
 * const positions = await client.guaranteedYield.resources.getUserGuaranteedPositions(userAddress);
 * ```
 */
declare class GuaranteedYieldResources extends BaseModule {
    /**
     * Read the `GuaranteedYieldLocking::UserGuaranteedPositions` resource for a user.
     *
     * Contains all of the user's guaranteed-yield positions and the next position ID.
     * Stored at the user's account address.
     *
     * @param user - The user's account address.
     * @returns The user's guaranteed-yield positions resource.
     */
    getUserGuaranteedPositions(user: AccountAddressInput): Promise<UserGuaranteedPositions>;
}

/**
 * Module for interacting with the `aptree::GuaranteedYieldLocking` contract.
 *
 * Provides:
 * - {@link GuaranteedYieldModule.builder | builder} — Transaction builders for all entry functions.
 * - {@link GuaranteedYieldModule.resources | resources} — Typed readers for on-chain resources.
 * - View functions as direct methods (e.g. {@link GuaranteedYieldModule.getProtocolStats | getProtocolStats}).
 *
 * @example
 * ```typescript
 * // Deposit with guaranteed yield
 * const txn = await client.guaranteedYield.builder.depositGuaranteed(sender, {
 *   amount: 100_000_000,
 *   tier: GuaranteedYieldTier.Silver,
 *   minAetReceived: 0,
 * });
 *
 * // Check cashback for a given amount and tier
 * const cashback = await client.guaranteedYield.calculateCashback(100_000_000, 3);
 *
 * // Get protocol-wide stats
 * const stats = await client.guaranteedYield.getProtocolStats();
 * ```
 */
declare class GuaranteedYieldModule extends BaseModule {
    /** Transaction builders for guaranteed-yield entry functions. */
    readonly builder: GuaranteedYieldBuilder;
    /** Typed readers for guaranteed-yield on-chain resources. */
    readonly resources: GuaranteedYieldResources;
    constructor(aptos: Aptos, addresses: AptreeAddresses);
    /**
     * Get all guaranteed-yield positions for a user.
     *
     * Calls `GuaranteedYieldLocking::get_user_guaranteed_positions`.
     *
     * @param user - The user's account address.
     * @returns Array of {@link GuaranteedLockPosition} structs.
     */
    getUserGuaranteedPositions(user: AccountAddressInput): Promise<GuaranteedLockPosition[]>;
    /**
     * Get a specific guaranteed-yield position.
     *
     * Calls `GuaranteedYieldLocking::get_guaranteed_position`.
     *
     * @param user - The user's account address.
     * @param positionId - The position ID.
     * @returns The {@link GuaranteedLockPosition} struct.
     */
    getGuaranteedPosition(user: AccountAddressInput, positionId: number): Promise<GuaranteedLockPosition>;
    /**
     * Get the guaranteed yield rate (in BPS) for a tier.
     *
     * Calls `GuaranteedYieldLocking::get_tier_guaranteed_yield`.
     *
     * @param tier - The tier number (1=Starter, 2=Bronze, 3=Silver, 4=Gold).
     * @returns The yield in basis points (e.g. 500 = 5%).
     */
    getTierGuaranteedYield(tier: number): Promise<number>;
    /**
     * Get the lock duration (in seconds) for a tier.
     *
     * Calls `GuaranteedYieldLocking::get_tier_duration`.
     *
     * @param tier - The tier number (1=Starter, 2=Bronze, 3=Silver, 4=Gold).
     * @returns The lock duration in seconds.
     */
    getTierDuration(tier: number): Promise<number>;
    /**
     * Calculate the cashback amount for a given deposit amount and tier.
     *
     * Calls `GuaranteedYieldLocking::calculate_cashback`.
     *
     * @param amount - The deposit amount.
     * @param tier - The tier number.
     * @returns The cashback amount in the underlying token.
     */
    calculateCashback(amount: number, tier: number): Promise<number>;
    /**
     * Get the current balance of the cashback vault.
     *
     * Calls `GuaranteedYieldLocking::get_cashback_vault_balance`.
     *
     * @returns The vault balance in the underlying token.
     */
    getCashbackVaultBalance(): Promise<number>;
    /**
     * Get protocol-wide statistics.
     *
     * Calls `GuaranteedYieldLocking::get_protocol_stats`.
     *
     * @returns A {@link ProtocolStats} object with total locked principal, AET held,
     *   cashback paid, and yield sent to treasury.
     */
    getProtocolStats(): Promise<ProtocolStats>;
    /**
     * Check if a position has passed its unlock date and can be unlocked.
     *
     * Calls `GuaranteedYieldLocking::is_position_unlockable`.
     *
     * @param user - The user's account address.
     * @param positionId - The position ID.
     * @returns `true` if the position can be unlocked.
     */
    isPositionUnlockable(user: AccountAddressInput, positionId: number): Promise<boolean>;
    /**
     * Get the configuration for a specific tier.
     *
     * Calls `GuaranteedYieldLocking::get_tier_config`.
     *
     * @param tier - The tier number (1=Starter, 2=Bronze, 3=Silver, 4=Gold).
     * @returns A {@link GuaranteedTierConfig} with duration and yield BPS.
     */
    getTierConfig(tier: number): Promise<GuaranteedTierConfig>;
    /**
     * Get the current treasury address.
     *
     * Calls `GuaranteedYieldLocking::get_treasury`.
     *
     * @returns The treasury address that receives excess yield.
     */
    getTreasury(): Promise<string>;
    /**
     * Check if guaranteed-yield deposits are currently enabled.
     *
     * Calls `GuaranteedYieldLocking::are_deposits_enabled`.
     *
     * @returns `true` if deposits are enabled.
     */
    areDepositsEnabled(): Promise<boolean>;
    /**
     * Preview the outcome of an emergency unlock for a guaranteed-yield position.
     *
     * Calls `GuaranteedYieldLocking::get_emergency_unlock_preview`.
     *
     * @param user - The user's account address.
     * @param positionId - The position ID.
     * @returns A {@link GuaranteedEmergencyUnlockPreview} with the expected payout,
     *   yield forfeited, and cashback clawback amounts.
     */
    getEmergencyUnlockPreview(user: AccountAddressInput, positionId: number): Promise<GuaranteedEmergencyUnlockPreview>;
    /**
     * Get the maximum total locked principal allowed across all positions.
     *
     * Calls `GuaranteedYieldLocking::get_max_total_locked`.
     *
     * @returns The maximum total locked principal.
     */
    getMaxTotalLocked(): Promise<number>;
    /**
     * Get the minimum deposit amount for new positions.
     *
     * Calls `GuaranteedYieldLocking::get_min_deposit`.
     *
     * @returns The minimum deposit amount.
     */
    getMinDeposit(): Promise<number>;
}

/** On-chain resource `moneyfi_mock::vault::MockVaultState`. */
interface MockVaultState {
    signer_cap: {
        account: string;
    };
    total_deposits: string;
    yield_multiplier_bps: string;
    pending_withdrawals: string;
    admin: string;
}
/** On-chain resource `moneyfi_mock::vault::DepositorState`. */
interface DepositorState {
    deposited: string;
    pending_withdrawal: string;
}
/** Parsed return type for `vault::get_depositor_state(depositor) -> (deposited, pending_withdrawal)`. */
interface DepositorStateView {
    deposited: number;
    pendingWithdrawal: number;
}
/** Arguments for `vault::deposit`. */
interface MockVaultDepositArgs {
    /** Address of the fungible asset metadata object. */
    token: string;
    /** Amount to deposit. */
    amount: number;
}
/** Arguments for `vault::request_withdraw`. */
interface MockVaultRequestWithdrawArgs {
    /** Address of the fungible asset metadata object. */
    token: string;
    /** Amount to request for withdrawal. */
    amount: number;
}
/** Arguments for `vault::withdraw_requested_amount`. */
interface MockVaultWithdrawRequestedArgs {
    /** Address of the fungible asset metadata object. */
    token: string;
}
/** Arguments for `vault::set_yield_multiplier` (admin only). */
interface SetYieldMultiplierArgs {
    /** New yield multiplier in basis points. */
    multiplierBps: number;
}
/** Arguments for `vault::simulate_yield` (admin only). */
interface SimulateYieldArgs {
    /** Yield to simulate in basis points. */
    yieldBps: number;
}
/** Arguments for `vault::simulate_loss` (admin only). */
interface SimulateLossArgs {
    /** Loss to simulate in basis points. */
    lossBps: number;
}
/** Arguments for `vault::set_total_deposits` (admin only). */
interface SetTotalDepositsArgs {
    /** New total deposits value. */
    amount: number;
}

/**
 * Transaction builders for the `moneyfi_mock::vault` entry functions.
 *
 * This module wraps a mock implementation of the MoneyFi vault, useful for
 * testing on devnet/testnet.
 *
 * @example
 * ```typescript
 * const txn = await client.mockVault.builder.deposit(sender, {
 *   token: tokenMetadataAddress,
 *   amount: 1_000_000_00,
 * });
 * ```
 */
declare class MockVaultBuilder extends BaseModule {
    /**
     * Build a `vault::deposit` transaction.
     *
     * Deposits a fungible asset into the mock vault.
     *
     * @param sender - The account address that will sign this transaction.
     * @param args - {@link MockVaultDepositArgs}
     * @returns A built transaction ready for signing.
     */
    deposit(sender: AccountAddressInput, args: MockVaultDepositArgs): Promise<SimpleTransaction>;
    /**
     * Build a `vault::request_withdraw` transaction.
     *
     * Requests a withdrawal from the mock vault.
     *
     * @param sender - The account address that will sign this transaction.
     * @param args - {@link MockVaultRequestWithdrawArgs}
     * @returns A built transaction ready for signing.
     */
    requestWithdraw(sender: AccountAddressInput, args: MockVaultRequestWithdrawArgs): Promise<SimpleTransaction>;
    /**
     * Build a `vault::withdraw_requested_amount` transaction.
     *
     * Completes a pending withdrawal from the mock vault.
     *
     * @param sender - The account address that will sign this transaction.
     * @param args - {@link MockVaultWithdrawRequestedArgs}
     * @returns A built transaction ready for signing.
     */
    withdrawRequestedAmount(sender: AccountAddressInput, args: MockVaultWithdrawRequestedArgs): Promise<SimpleTransaction>;
    /**
     * Build a `vault::set_yield_multiplier` transaction.
     *
     * Sets the yield multiplier in basis points for the mock vault.
     *
     * @remarks Admin only.
     * @param sender - The admin account address.
     * @param args - {@link SetYieldMultiplierArgs}
     */
    setYieldMultiplier(sender: AccountAddressInput, args: SetYieldMultiplierArgs): Promise<SimpleTransaction>;
    /**
     * Build a `vault::simulate_yield` transaction.
     *
     * Simulates yield by increasing total deposits by the given BPS.
     *
     * @remarks Admin only.
     * @param sender - The admin account address.
     * @param args - {@link SimulateYieldArgs}
     */
    simulateYield(sender: AccountAddressInput, args: SimulateYieldArgs): Promise<SimpleTransaction>;
    /**
     * Build a `vault::simulate_loss` transaction.
     *
     * Simulates a loss by decreasing total deposits by the given BPS.
     *
     * @remarks Admin only.
     * @param sender - The admin account address.
     * @param args - {@link SimulateLossArgs}
     */
    simulateLoss(sender: AccountAddressInput, args: SimulateLossArgs): Promise<SimpleTransaction>;
    /**
     * Build a `vault::reset_vault` transaction.
     *
     * Resets the mock vault state (total deposits, pending withdrawals, multiplier).
     *
     * @remarks Admin only.
     * @param sender - The admin account address.
     */
    resetVault(sender: AccountAddressInput): Promise<SimpleTransaction>;
    /**
     * Build a `vault::set_total_deposits` transaction.
     *
     * Directly sets the total deposits value for testing.
     *
     * @remarks Admin only.
     * @param sender - The admin account address.
     * @param args - {@link SetTotalDepositsArgs}
     */
    setTotalDeposits(sender: AccountAddressInput, args: SetTotalDepositsArgs): Promise<SimpleTransaction>;
    /** Payload for `vault::deposit`. @see {@link deposit} */
    depositPayload(args: MockVaultDepositArgs): InputEntryFunctionData;
    /** Payload for `vault::request_withdraw`. @see {@link requestWithdraw} */
    requestWithdrawPayload(args: MockVaultRequestWithdrawArgs): InputEntryFunctionData;
    /** Payload for `vault::withdraw_requested_amount`. @see {@link withdrawRequestedAmount} */
    withdrawRequestedAmountPayload(args: MockVaultWithdrawRequestedArgs): InputEntryFunctionData;
    /** Payload for `vault::set_yield_multiplier`. @see {@link setYieldMultiplier} */
    setYieldMultiplierPayload(args: SetYieldMultiplierArgs): InputEntryFunctionData;
    /** Payload for `vault::simulate_yield`. @see {@link simulateYield} */
    simulateYieldPayload(args: SimulateYieldArgs): InputEntryFunctionData;
    /** Payload for `vault::simulate_loss`. @see {@link simulateLoss} */
    simulateLossPayload(args: SimulateLossArgs): InputEntryFunctionData;
    /** Payload for `vault::reset_vault`. @see {@link resetVault} */
    resetVaultPayload(): InputEntryFunctionData;
    /** Payload for `vault::set_total_deposits`. @see {@link setTotalDeposits} */
    setTotalDepositsPayload(args: SetTotalDepositsArgs): InputEntryFunctionData;
}

/**
 * Resource readers for the `moneyfi_mock::vault` on-chain resources.
 *
 * @example
 * ```typescript
 * const vaultState = await client.mockVault.resources.getMockVaultState(vaultAddress);
 * console.log(vaultState.total_deposits);
 * ```
 */
declare class MockVaultResources extends BaseModule {
    /**
     * Read the `vault::MockVaultState` resource.
     *
     * Contains global vault state: total deposits, yield multiplier, pending
     * withdrawals, and admin address.
     *
     * @param address - The vault resource account address.
     * @returns The mock vault state.
     */
    getMockVaultState(address: AccountAddressInput): Promise<MockVaultState>;
    /**
     * Read the `vault::DepositorState` resource for a specific depositor.
     *
     * Contains the depositor's deposited amount and pending withdrawal amount.
     *
     * @param depositor - The depositor's account address.
     * @returns The depositor's state.
     */
    getDepositorState(depositor: AccountAddressInput): Promise<DepositorState>;
}

/**
 * Module for interacting with the `moneyfi_mock::vault` contract.
 *
 * This is a mock implementation of the MoneyFi vault, useful for testing
 * on devnet/testnet. It supports yield simulation, loss simulation, and
 * manual state manipulation.
 *
 * Provides:
 * - {@link MockVaultModule.builder | builder} — Transaction builders for all entry functions.
 * - {@link MockVaultModule.resources | resources} — Typed readers for on-chain resources.
 * - View functions as direct methods (e.g. {@link MockVaultModule.getTotalDeposits | getTotalDeposits}).
 *
 * @example
 * ```typescript
 * // Get vault address
 * const vaultAddr = await client.mockVault.getVaultAddress();
 *
 * // Get depositor state
 * const state = await client.mockVault.getDepositorState("0xabc...");
 * ```
 */
declare class MockVaultModule extends BaseModule {
    /** Transaction builders for mock vault entry functions. */
    readonly builder: MockVaultBuilder;
    /** Typed readers for mock vault on-chain resources. */
    readonly resources: MockVaultResources;
    constructor(aptos: Aptos, addresses: AptreeAddresses);
    /**
     * Estimate the total fund value for a depositor and token.
     *
     * Calls `vault::estimate_total_fund_value`.
     *
     * @param depositor - The depositor's account address.
     * @param token - The fungible asset metadata object address.
     * @returns The estimated total fund value.
     */
    estimateTotalFundValue(depositor: AccountAddressInput, token: string): Promise<number>;
    /**
     * Get the vault's resource account address.
     *
     * Calls `vault::get_vault_address`.
     *
     * @returns The vault resource account address.
     */
    getVaultAddress(): Promise<string>;
    /**
     * Get the current yield multiplier in basis points.
     *
     * Calls `vault::get_yield_multiplier`.
     *
     * @returns The yield multiplier BPS value.
     */
    getYieldMultiplier(): Promise<number>;
    /**
     * Get the total deposits held in the vault.
     *
     * Calls `vault::get_total_deposits`.
     *
     * @returns The total deposits amount.
     */
    getTotalDeposits(): Promise<number>;
    /**
     * Get the total pending withdrawals in the vault.
     *
     * Calls `vault::get_pending_withdrawals`.
     *
     * @returns The total pending withdrawal amount.
     */
    getPendingWithdrawals(): Promise<number>;
    /**
     * Get the state of a specific depositor.
     *
     * Calls `vault::get_depositor_state`.
     *
     * @param depositor - The depositor's account address.
     * @returns A {@link DepositorStateView} with deposited and pending withdrawal amounts.
     */
    getDepositorState(depositor: AccountAddressInput): Promise<DepositorStateView>;
}

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
interface PanoraSwapParams {
    /**
     * Optional secondary signer. Pass `null` / empty array if not needed.
     * On-chain type: `0x1::option::Option<signer>`.
     */
    optionalSigner: null;
    /** Address that receives the output tokens from the swap. */
    toWalletAddress: string;
    arg2: number;
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
}
/**
 * Arguments for `glade_flexible::deposit`.
 *
 * Performs a swap via Panora (converting any token to the bridge's underlying token)
 * and then deposits the result into the bridge.
 */
interface GladeFlexibleDepositArgs {
    /** Panora swap routing parameters. */
    swapParams: PanoraSwapParams;
}
/**
 * Arguments for `glade_flexible::withdraw`.
 *
 * Withdraws from the bridge and then performs a swap via Panora (converting
 * the underlying token to the desired output token).
 */
interface GladeFlexibleWithdrawArgs {
    /** Panora swap routing parameters. */
    swapParams: PanoraSwapParams;
    /** Amount of underlying tokens to withdraw from the bridge before the swap. */
    withdrawalAmount: number;
    /** Bridge provider identifier. */
    provider: number;
}
/**
 * Arguments for `glade_guaranteed::deposit_guaranteed`.
 *
 * Performs a swap via Panora and then creates a guaranteed-yield lock position.
 */
interface GladeGuaranteedDepositArgs {
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
interface GladeGuaranteedUnlockArgs {
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
interface GladeGuaranteedEmergencyUnlockArgs {
    /** Panora swap routing parameters. */
    swapParams: PanoraSwapParams;
    /** ID of the position to complete emergency withdrawal for. */
    positionId: number;
}
/**
 * Arguments for `swap_helpers::swap`.
 *
 * Executes a standalone Panora swap without any bridge/locking operations.
 */
interface SwapArgs {
    /** Panora swap routing parameters. */
    swapParams: PanoraSwapParams;
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
declare class GladeBuilder extends BaseModule {
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
    deposit(sender: AccountAddressInput, args: GladeFlexibleDepositArgs, typeArguments: string[]): Promise<SimpleTransaction>;
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
    withdraw(sender: AccountAddressInput, args: GladeFlexibleWithdrawArgs, typeArguments: string[]): Promise<SimpleTransaction>;
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
    depositGuaranteed(sender: AccountAddressInput, args: GladeGuaranteedDepositArgs, typeArguments: string[]): Promise<SimpleTransaction>;
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
    unlockGuaranteed(sender: AccountAddressInput, args: GladeGuaranteedUnlockArgs, typeArguments: string[]): Promise<SimpleTransaction>;
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
    emergencyUnlockGuaranteed(sender: AccountAddressInput, args: GladeGuaranteedEmergencyUnlockArgs, typeArguments: string[]): Promise<SimpleTransaction>;
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
    swap(sender: AccountAddressInput, args: SwapArgs, typeArguments: string[]): Promise<SimpleTransaction>;
    /** Payload for `glade_flexible::deposit`. @see {@link deposit} */
    depositPayload(args: GladeFlexibleDepositArgs, typeArguments: string[]): InputEntryFunctionData;
    /** Payload for `glade_flexible::withdraw`. @see {@link withdraw} */
    withdrawPayload(args: GladeFlexibleWithdrawArgs, typeArguments: string[]): InputEntryFunctionData;
    /** Payload for `glade_guaranteed::deposit_guaranteed`. @see {@link depositGuaranteed} */
    depositGuaranteedPayload(args: GladeGuaranteedDepositArgs, typeArguments: string[]): InputEntryFunctionData;
    /** Payload for `glade_guaranteed::unlock_guaranteed`. @see {@link unlockGuaranteed} */
    unlockGuaranteedPayload(args: GladeGuaranteedUnlockArgs, typeArguments: string[]): InputEntryFunctionData;
    /** Payload for `glade_guaranteed::emergency_unlock_guaranteed`. @see {@link emergencyUnlockGuaranteed} */
    emergencyUnlockGuaranteedPayload(args: GladeGuaranteedEmergencyUnlockArgs, typeArguments: string[]): InputEntryFunctionData;
    /** Payload for `swap_helpers::swap`. @see {@link swap} */
    swapPayload(args: SwapArgs, typeArguments: string[]): InputEntryFunctionData;
}

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
declare class GladeModule extends BaseModule {
    /**
     * Transaction builders for Glade entry functions.
     *
     * Includes builders for:
     * - `glade_flexible::deposit` / `withdraw`
     * - `glade_guaranteed::deposit_guaranteed` / `unlock_guaranteed` / `emergency_unlock_guaranteed`
     * - `swap_helpers::swap`
     */
    readonly builder: GladeBuilder;
    constructor(aptos: Aptos, addresses: AptreeAddresses);
}

/**
 * Main entry point for the Aptree SDK.
 *
 * Provides namespaced access to all contract modules:
 * - {@link AptreeClient.bridge | bridge} — Bridge and MoneyFi adapter interactions.
 * - {@link AptreeClient.locking | locking} — Time-locked deposit positions.
 * - {@link AptreeClient.guaranteedYield | guaranteedYield} — Fixed-rate guaranteed yield locking.
 * - {@link AptreeClient.glade | glade} — Swap + deposit/withdraw via Panora DEX aggregator.
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
 *   amount: 1_00000000, // 1 token (8 decimals)
 *   provider: 0,
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
declare class AptreeClient {
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
    /** Glade: swap + deposit/withdraw via Panora DEX aggregator. */
    readonly glade: GladeModule;
    /** Mock MoneyFi vault interactions (for testing). */
    readonly mockVault: MockVaultModule;
    constructor(config: AptreeClientConfig);
}

/**
 * Tier values for the locking module.
 *
 * - Bronze: 90-day lock, 2% early withdrawal limit
 * - Silver: 180-day lock, 3% early withdrawal limit
 * - Gold: 365-day lock, 5% early withdrawal limit
 */
declare enum LockingTier {
    Bronze = 1,
    Silver = 2,
    Gold = 3
}
/**
 * Tier values for the guaranteed yield module.
 *
 * - Starter: 30-day lock, 0.4% yield
 * - Bronze: 90-day lock, 1.25% yield
 * - Silver: 180-day lock, 2.5% yield
 * - Gold: 365-day lock, 5% yield
 */
declare enum GuaranteedYieldTier {
    Starter = 1,
    Bronze = 2,
    Silver = 3,
    Gold = 4
}

/** Basis points denominator (10_000 = 100%). */
declare const BPS_DENOMINATOR = 10000;
/** AET share price scaling factor (1e9). */
declare const AET_SCALE = 1000000000;
/** Precision factor used in locking calculations (1e12). */
declare const PRECISION = 1000000000000;
/** Resource account seeds used by the on-chain contracts. */
declare const SEEDS: {
    readonly BRIDGE: "APTreeEarn";
    readonly MONEYFI_CONTROLLER: "MoneyFiBridgeController";
    readonly MONEYFI_RESERVE: "MoneyFiBridgeReserve";
    readonly LOCKING_CONTROLLER: "APTreeLockingController";
    readonly GUARANTEED_YIELD_CONTROLLER: "GuaranteedYieldController";
    readonly GUARANTEED_YIELD_CASHBACK_VAULT: "GuaranteedYieldCashbackVault";
    readonly MOCK_MONEYFI_VAULT: "MockMoneyFiVault";
};
/** Locking tier durations in seconds. */
declare const LOCKING_DURATIONS: {
    /** 90 days */
    readonly BRONZE: 7776000;
    /** 180 days */
    readonly SILVER: 15552000;
    /** 365 days */
    readonly GOLD: 31536000;
};
/** Guaranteed yield tier durations in seconds. */
declare const GUARANTEED_YIELD_DURATIONS: {
    /** 30 days */
    readonly STARTER: 2592000;
    /** 90 days */
    readonly BRONZE: 7776000;
    /** 180 days */
    readonly SILVER: 15552000;
    /** 365 days */
    readonly GOLD: 31536000;
};

export { AET_SCALE, type AddToPositionArgs, type AdminWithdrawCashbackVaultArgs, type AptreeAddresses, AptreeClient, type AptreeClientConfig, BPS_DENOMINATOR, BridgeBuilder, type BridgeDepositArgs, BridgeModule, type BridgeRequestArgs, BridgeResources, type BridgeState, type BridgeWithdrawArgs, type BridgeWithdrawalTokenState, type DepositGuaranteedArgs, type DepositLockedArgs, type DepositorState, type DepositorStateView, type EmergencyUnlockArgs, type EmergencyUnlockPreview, type FundCashbackVaultArgs, GUARANTEED_YIELD_DURATIONS, GladeBuilder, type GladeFlexibleDepositArgs, type GladeFlexibleWithdrawArgs, type GladeGuaranteedDepositArgs, type GladeGuaranteedEmergencyUnlockArgs, type GladeGuaranteedUnlockArgs, GladeModule, type GuaranteedEmergencyUnlockPreview, type GuaranteedLockPosition, type GuaranteedTierConfig, GuaranteedYieldBuilder, GuaranteedYieldModule, GuaranteedYieldResources, GuaranteedYieldTier, LOCKING_DURATIONS, type LockConfig, type LockPosition, LockingBuilder, LockingModule, LockingResources, LockingTier, MockVaultBuilder, type MockVaultDepositArgs, MockVaultModule, type MockVaultRequestWithdrawArgs, MockVaultResources, type MockVaultState, type MockVaultWithdrawRequestedArgs, type MoneyFiAdapterDepositArgs, type MoneyFiAdapterRequestArgs, type MoneyFiAdapterWithdrawArgs, type MoneyFiBridgeState, type MoneyFiReserveState, PRECISION, type PanoraSwapParams, type ProposeAdminArgs, type ProtocolStats, type RequestEmergencyUnlockGuaranteedArgs, type RequestUnlockGuaranteedArgs, SEEDS, type SetDepositsEnabledArgs, type SetLocksEnabledArgs, type SetMaxTotalLockedArgs, type SetMinDepositArgs, type SetTierLimitArgs, type SetTierYieldArgs, type SetTotalDepositsArgs, type SetTreasuryArgs, type SetYieldMultiplierArgs, type SimulateLossArgs, type SimulateYieldArgs, type SwapArgs, TESTNET_ADDRESSES, type TierConfig, type UserGuaranteedPositions, type UserLockPositions, type WithdrawEarlyArgs, type WithdrawEmergencyGuaranteedArgs, type WithdrawGuaranteedArgs, type WithdrawUnlockedArgs };
