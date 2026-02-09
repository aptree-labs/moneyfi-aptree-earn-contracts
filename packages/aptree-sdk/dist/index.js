"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AET_SCALE: () => AET_SCALE,
  AptreeClient: () => AptreeClient,
  BPS_DENOMINATOR: () => BPS_DENOMINATOR,
  BridgeBuilder: () => BridgeBuilder,
  BridgeModule: () => BridgeModule,
  BridgeResources: () => BridgeResources,
  GUARANTEED_YIELD_DURATIONS: () => GUARANTEED_YIELD_DURATIONS,
  GladeBuilder: () => GladeBuilder,
  GladeModule: () => GladeModule,
  GuaranteedYieldBuilder: () => GuaranteedYieldBuilder,
  GuaranteedYieldModule: () => GuaranteedYieldModule,
  GuaranteedYieldResources: () => GuaranteedYieldResources,
  GuaranteedYieldTier: () => GuaranteedYieldTier,
  LOCKING_DURATIONS: () => LOCKING_DURATIONS,
  LockingBuilder: () => LockingBuilder,
  LockingModule: () => LockingModule,
  LockingResources: () => LockingResources,
  LockingTier: () => LockingTier,
  MockVaultBuilder: () => MockVaultBuilder,
  MockVaultModule: () => MockVaultModule,
  MockVaultResources: () => MockVaultResources,
  PRECISION: () => PRECISION,
  SEEDS: () => SEEDS,
  TESTNET_ADDRESSES: () => TESTNET_ADDRESSES
});
module.exports = __toCommonJS(index_exports);

// src/client.ts
var import_ts_sdk = require("@aptos-labs/ts-sdk");

// src/modules/base-module.ts
var BaseModule = class {
  constructor(aptos, addresses) {
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
  async buildTransaction(sender, functionId, functionArguments, typeArguments) {
    return this.aptos.transaction.build.simple({
      sender,
      data: {
        function: functionId,
        typeArguments: typeArguments ?? [],
        functionArguments
      }
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
  async view(functionId, functionArguments = [], typeArguments) {
    const payload = {
      function: functionId,
      typeArguments: typeArguments ?? [],
      functionArguments
    };
    const result = await this.aptos.view({ payload });
    return result;
  }
  /**
   * Read an on-chain Move resource with a typed return value.
   *
   * @param accountAddress - The account holding the resource.
   * @param resourceType - Fully qualified Move resource type (e.g. `"0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"`).
   * @returns The resource data parsed into type `T`.
   */
  async getResource(accountAddress, resourceType) {
    return this.aptos.getAccountResource({
      accountAddress,
      resourceType
    });
  }
};

// src/modules/bridge/builder.ts
var BridgeBuilder = class extends BaseModule {
  // ── bridge module entry functions ────────────────────────────────────────
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
  async deposit(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::bridge::deposit`,
      [args.amount, args.provider]
    );
  }
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
  async request(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::bridge::request`,
      [args.amount, args.minAmount]
    );
  }
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
  async withdraw(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::bridge::withdraw`,
      [args.amount, args.provider]
    );
  }
  // ── moneyfi_adapter module entry functions ───────────────────────────────
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
  async adapterDeposit(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::moneyfi_adapter::deposit`,
      [args.amount]
    );
  }
  /**
   * Build a `moneyfi_adapter::request` transaction.
   *
   * Requests a withdrawal through the adapter with minimum share price protection.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link MoneyFiAdapterRequestArgs}
   * @returns A built transaction ready for signing.
   */
  async adapterRequest(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::moneyfi_adapter::request`,
      [args.amount, args.minSharePrice]
    );
  }
  /**
   * Build a `moneyfi_adapter::withdraw` transaction.
   *
   * Completes a pending withdrawal through the adapter.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link MoneyFiAdapterWithdrawArgs}
   * @returns A built transaction ready for signing.
   */
  async adapterWithdraw(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::moneyfi_adapter::withdraw`,
      [args.amount]
    );
  }
};

// src/modules/bridge/resources.ts
var BridgeResources = class extends BaseModule {
  /**
   * Read the `bridge::State` resource.
   *
   * This resource is created during module initialization and stored at the
   * bridge's resource account address.
   *
   * @param address - The account address holding the resource.
   * @returns The bridge state containing the signer capability.
   */
  async getBridgeState(address) {
    return this.getResource(
      address,
      `${this.addresses.aptree}::bridge::State`
    );
  }
  /**
   * Read the `moneyfi_adapter::BridgeState` resource.
   *
   * Contains controller and reserve addresses and their signer capabilities.
   *
   * @param address - The controller resource account address.
   * @returns The MoneyFi bridge state.
   */
  async getMoneyFiBridgeState(address) {
    return this.getResource(
      address,
      `${this.addresses.aptree}::moneyfi_adapter::BridgeState`
    );
  }
  /**
   * Read the `moneyfi_adapter::ReserveState` resource.
   *
   * Contains mint/burn/transfer references and the AET token address.
   *
   * @param address - The reserve resource account address.
   * @returns The reserve state.
   */
  async getReserveState(address) {
    return this.getResource(
      address,
      `${this.addresses.aptree}::moneyfi_adapter::ReserveState`
    );
  }
  /**
   * Read the `moneyfi_adapter::BridgeWithdrawalTokenState` resource.
   *
   * Contains mint/burn/transfer references for withdrawal tokens (AEWT).
   *
   * @param address - The reserve resource account address.
   * @returns The withdrawal token state.
   */
  async getWithdrawalTokenState(address) {
    return this.getResource(
      address,
      `${this.addresses.aptree}::moneyfi_adapter::BridgeWithdrawalTokenState`
    );
  }
};

// src/modules/bridge/index.ts
var BridgeModule = class extends BaseModule {
  constructor(aptos, addresses) {
    super(aptos, addresses);
    this.builder = new BridgeBuilder(aptos, addresses);
    this.resources = new BridgeResources(aptos, addresses);
  }
  // ── View Functions ─────────────────────────────────────────────────────
  /**
   * Get the address of the supported underlying token (e.g. USDT metadata object).
   *
   * Calls `moneyfi_adapter::get_supported_token`.
   *
   * @returns The address of the supported fungible asset metadata object.
   */
  async getSupportedToken() {
    const [result] = await this.view(
      `${this.addresses.aptree}::moneyfi_adapter::get_supported_token`
    );
    return result;
  }
  /**
   * Get the current LP (AET) share price.
   *
   * Calls `moneyfi_adapter::get_lp_price`.
   *
   * The price is scaled by AET_SCALE (1e9). A value of `1_000_000_000` means 1:1.
   *
   * @returns The current share price as a number (u128).
   */
  async getLpPrice() {
    const [result] = await this.view(
      `${this.addresses.aptree}::moneyfi_adapter::get_lp_price`
    );
    return Number(result);
  }
  /**
   * Get the total estimated value of the pool in the underlying token.
   *
   * Calls `moneyfi_adapter::get_pool_estimated_value`.
   *
   * @returns The pool's estimated total value.
   */
  async getPoolEstimatedValue() {
    const [result] = await this.view(
      `${this.addresses.aptree}::moneyfi_adapter::get_pool_estimated_value`
    );
    return Number(result);
  }
};

// src/modules/locking/builder.ts
var LockingBuilder = class extends BaseModule {
  // ── User entry functions ─────────────────────────────────────────────────
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
  async depositLocked(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::locking::deposit_locked`,
      [args.amount, args.tier]
    );
  }
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
  async addToPosition(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::locking::add_to_position`,
      [args.positionId, args.amount]
    );
  }
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
  async withdrawEarly(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::locking::withdraw_early`,
      [args.positionId, args.amount]
    );
  }
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
  async withdrawUnlocked(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::locking::withdraw_unlocked`,
      [args.positionId]
    );
  }
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
  async emergencyUnlock(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::locking::emergency_unlock`,
      [args.positionId]
    );
  }
  // ── Admin entry functions ────────────────────────────────────────────────
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
  async setTierLimit(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::locking::set_tier_limit`,
      [args.tier, args.newLimitBps]
    );
  }
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
  async setLocksEnabled(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::locking::set_locks_enabled`,
      [args.enabled]
    );
  }
};

// src/modules/locking/resources.ts
var LockingResources = class extends BaseModule {
  /**
   * Read the `locking::UserLockPositions` resource for a given user.
   *
   * Contains all of the user's lock positions and the next position ID counter.
   * This resource is stored at the user's account address.
   *
   * @param user - The user's account address.
   * @returns The user's lock positions resource.
   */
  async getUserLockPositions(user) {
    return this.getResource(
      user,
      `${this.addresses.aptree}::locking::UserLockPositions`
    );
  }
  /**
   * Read the `locking::LockConfig` resource.
   *
   * Contains global configuration: tier limits, durations, admin address,
   * and whether locks are enabled. Stored at the locking controller resource account.
   *
   * @param configAddress - The controller resource account address.
   * @returns The locking configuration resource.
   */
  async getLockConfig(configAddress) {
    return this.getResource(
      configAddress,
      `${this.addresses.aptree}::locking::LockConfig`
    );
  }
};

// src/modules/locking/index.ts
var LockingModule = class extends BaseModule {
  constructor(aptos, addresses) {
    super(aptos, addresses);
    this.builder = new LockingBuilder(aptos, addresses);
    this.resources = new LockingResources(aptos, addresses);
  }
  // ── View Functions ─────────────────────────────────────────────────────
  /**
   * Get all lock positions for a user.
   *
   * Calls `locking::get_user_positions`.
   *
   * @param user - The user's account address.
   * @returns Array of {@link LockPosition} structs.
   */
  async getUserPositions(user) {
    const [result] = await this.view(
      `${this.addresses.aptree}::locking::get_user_positions`,
      [user]
    );
    return result;
  }
  /**
   * Get a specific lock position for a user.
   *
   * Calls `locking::get_position`.
   *
   * @param user - The user's account address.
   * @param positionId - The position ID.
   * @returns The {@link LockPosition} struct.
   */
  async getPosition(user, positionId) {
    const [result] = await this.view(
      `${this.addresses.aptree}::locking::get_position`,
      [user, positionId]
    );
    return result;
  }
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
  async getEarlyWithdrawalAvailable(user, positionId) {
    const [result] = await this.view(
      `${this.addresses.aptree}::locking::get_early_withdrawal_available`,
      [user, positionId]
    );
    return Number(result);
  }
  /**
   * Check if a lock position has passed its unlock date.
   *
   * Calls `locking::is_position_unlocked`.
   *
   * @param user - The user's account address.
   * @param positionId - The position ID.
   * @returns `true` if the position can be fully withdrawn.
   */
  async isPositionUnlocked(user, positionId) {
    const [result] = await this.view(
      `${this.addresses.aptree}::locking::is_position_unlocked`,
      [user, positionId]
    );
    return result;
  }
  /**
   * Get the total locked value across all of a user's positions.
   *
   * Calls `locking::get_user_total_locked_value`.
   *
   * @param user - The user's account address.
   * @returns The total locked value in the underlying token.
   */
  async getUserTotalLockedValue(user) {
    const [result] = await this.view(
      `${this.addresses.aptree}::locking::get_user_total_locked_value`,
      [user]
    );
    return Number(result);
  }
  /**
   * Get the configuration for a specific tier.
   *
   * Calls `locking::get_tier_config`.
   *
   * @param tier - The tier number (1=Bronze, 2=Silver, 3=Gold).
   * @returns A {@link TierConfig} with the tier's duration and early withdrawal limit.
   */
  async getTierConfig(tier) {
    const [durationSeconds, earlyLimitBps] = await this.view(
      `${this.addresses.aptree}::locking::get_tier_config`,
      [tier]
    );
    return {
      durationSeconds: Number(durationSeconds),
      earlyLimitBps: Number(earlyLimitBps)
    };
  }
  /**
   * Preview the outcome of an emergency unlock for a position.
   *
   * Calls `locking::get_emergency_unlock_preview`.
   *
   * @param user - The user's account address.
   * @param positionId - The position ID.
   * @returns A {@link EmergencyUnlockPreview} with the expected payout and forfeited amount.
   */
  async getEmergencyUnlockPreview(user, positionId) {
    const [payout, forfeited] = await this.view(
      `${this.addresses.aptree}::locking::get_emergency_unlock_preview`,
      [user, positionId]
    );
    return {
      payout: Number(payout),
      forfeited: Number(forfeited)
    };
  }
};

// src/modules/guaranteed-yield/builder.ts
var GuaranteedYieldBuilder = class extends BaseModule {
  // ── User entry functions ─────────────────────────────────────────────────
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
  async depositGuaranteed(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::deposit_guaranteed`,
      [args.amount, args.tier, args.minAetReceived]
    );
  }
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
  async requestUnlockGuaranteed(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::request_unlock_guaranteed`,
      [args.positionId]
    );
  }
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
  async withdrawGuaranteed(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::withdraw_guaranteed`,
      [args.positionId]
    );
  }
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
  async fundCashbackVault(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::fund_cashback_vault`,
      [args.amount]
    );
  }
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
  async requestEmergencyUnlockGuaranteed(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::request_emergency_unlock_guaranteed`,
      [args.positionId]
    );
  }
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
  async withdrawEmergencyGuaranteed(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::withdraw_emergency_guaranteed`,
      [args.positionId]
    );
  }
  // ── Admin entry functions ────────────────────────────────────────────────
  /**
   * Build a `GuaranteedYieldLocking::set_tier_yield` transaction.
   *
   * Updates the guaranteed yield BPS for a given tier. Only affects new positions.
   *
   * @remarks Admin only.
   * @param sender - The admin account address.
   * @param args - {@link SetTierYieldArgs}
   */
  async setTierYield(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::set_tier_yield`,
      [args.tier, args.newYieldBps]
    );
  }
  /**
   * Build a `GuaranteedYieldLocking::set_treasury` transaction.
   *
   * Updates the treasury address that receives excess yield above the guaranteed rate.
   *
   * @remarks Admin only.
   * @param sender - The admin account address.
   * @param args - {@link SetTreasuryArgs}
   */
  async setTreasury(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::set_treasury`,
      [args.newTreasury]
    );
  }
  /**
   * Build a `GuaranteedYieldLocking::set_deposits_enabled` transaction.
   *
   * Enables or disables new guaranteed-yield deposits.
   *
   * @remarks Admin only.
   * @param sender - The admin account address.
   * @param args - {@link SetDepositsEnabledArgs}
   */
  async setDepositsEnabled(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::set_deposits_enabled`,
      [args.enabled]
    );
  }
  /**
   * Build a `GuaranteedYieldLocking::admin_withdraw_cashback_vault` transaction.
   *
   * Withdraws tokens from the cashback vault to the admin.
   *
   * @remarks Admin only.
   * @param sender - The admin account address.
   * @param args - {@link AdminWithdrawCashbackVaultArgs}
   */
  async adminWithdrawCashbackVault(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::admin_withdraw_cashback_vault`,
      [args.amount]
    );
  }
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
  async proposeAdmin(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::propose_admin`,
      [args.newAdmin]
    );
  }
  /**
   * Build a `GuaranteedYieldLocking::accept_admin` transaction.
   *
   * Accepts the admin role after being proposed via {@link proposeAdmin}.
   *
   * @param sender - The proposed new admin account address.
   * @returns A built transaction ready for signing.
   */
  async acceptAdmin(sender) {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::accept_admin`,
      []
    );
  }
  /**
   * Build a `GuaranteedYieldLocking::set_max_total_locked` transaction.
   *
   * Sets the maximum total principal that can be locked across all positions.
   *
   * @remarks Admin only.
   * @param sender - The admin account address.
   * @param args - {@link SetMaxTotalLockedArgs}
   */
  async setMaxTotalLocked(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::set_max_total_locked`,
      [args.newMax]
    );
  }
  /**
   * Build a `GuaranteedYieldLocking::set_min_deposit` transaction.
   *
   * Sets the minimum deposit amount for new positions.
   *
   * @remarks Admin only.
   * @param sender - The admin account address.
   * @param args - {@link SetMinDepositArgs}
   */
  async setMinDeposit(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::GuaranteedYieldLocking::set_min_deposit`,
      [args.newMin]
    );
  }
};

// src/modules/guaranteed-yield/resources.ts
var GuaranteedYieldResources = class extends BaseModule {
  /**
   * Read the `GuaranteedYieldLocking::UserGuaranteedPositions` resource for a user.
   *
   * Contains all of the user's guaranteed-yield positions and the next position ID.
   * Stored at the user's account address.
   *
   * @param user - The user's account address.
   * @returns The user's guaranteed-yield positions resource.
   */
  async getUserGuaranteedPositions(user) {
    return this.getResource(
      user,
      `${this.addresses.aptree}::GuaranteedYieldLocking::UserGuaranteedPositions`
    );
  }
};

// src/modules/guaranteed-yield/index.ts
var GuaranteedYieldModule = class extends BaseModule {
  constructor(aptos, addresses) {
    super(aptos, addresses);
    this.builder = new GuaranteedYieldBuilder(aptos, addresses);
    this.resources = new GuaranteedYieldResources(aptos, addresses);
  }
  // ── View Functions ─────────────────────────────────────────────────────
  /**
   * Get all guaranteed-yield positions for a user.
   *
   * Calls `GuaranteedYieldLocking::get_user_guaranteed_positions`.
   *
   * @param user - The user's account address.
   * @returns Array of {@link GuaranteedLockPosition} structs.
   */
  async getUserGuaranteedPositions(user) {
    const [result] = await this.view(
      `${this.addresses.aptree}::GuaranteedYieldLocking::get_user_guaranteed_positions`,
      [user]
    );
    return result;
  }
  /**
   * Get a specific guaranteed-yield position.
   *
   * Calls `GuaranteedYieldLocking::get_guaranteed_position`.
   *
   * @param user - The user's account address.
   * @param positionId - The position ID.
   * @returns The {@link GuaranteedLockPosition} struct.
   */
  async getGuaranteedPosition(user, positionId) {
    const [result] = await this.view(
      `${this.addresses.aptree}::GuaranteedYieldLocking::get_guaranteed_position`,
      [user, positionId]
    );
    return result;
  }
  /**
   * Get the guaranteed yield rate (in BPS) for a tier.
   *
   * Calls `GuaranteedYieldLocking::get_tier_guaranteed_yield`.
   *
   * @param tier - The tier number (1=Starter, 2=Bronze, 3=Silver, 4=Gold).
   * @returns The yield in basis points (e.g. 500 = 5%).
   */
  async getTierGuaranteedYield(tier) {
    const [result] = await this.view(
      `${this.addresses.aptree}::GuaranteedYieldLocking::get_tier_guaranteed_yield`,
      [tier]
    );
    return Number(result);
  }
  /**
   * Get the lock duration (in seconds) for a tier.
   *
   * Calls `GuaranteedYieldLocking::get_tier_duration`.
   *
   * @param tier - The tier number (1=Starter, 2=Bronze, 3=Silver, 4=Gold).
   * @returns The lock duration in seconds.
   */
  async getTierDuration(tier) {
    const [result] = await this.view(
      `${this.addresses.aptree}::GuaranteedYieldLocking::get_tier_duration`,
      [tier]
    );
    return Number(result);
  }
  /**
   * Calculate the cashback amount for a given deposit amount and tier.
   *
   * Calls `GuaranteedYieldLocking::calculate_cashback`.
   *
   * @param amount - The deposit amount.
   * @param tier - The tier number.
   * @returns The cashback amount in the underlying token.
   */
  async calculateCashback(amount, tier) {
    const [result] = await this.view(
      `${this.addresses.aptree}::GuaranteedYieldLocking::calculate_cashback`,
      [amount, tier]
    );
    return Number(result);
  }
  /**
   * Get the current balance of the cashback vault.
   *
   * Calls `GuaranteedYieldLocking::get_cashback_vault_balance`.
   *
   * @returns The vault balance in the underlying token.
   */
  async getCashbackVaultBalance() {
    const [result] = await this.view(
      `${this.addresses.aptree}::GuaranteedYieldLocking::get_cashback_vault_balance`
    );
    return Number(result);
  }
  /**
   * Get protocol-wide statistics.
   *
   * Calls `GuaranteedYieldLocking::get_protocol_stats`.
   *
   * @returns A {@link ProtocolStats} object with total locked principal, AET held,
   *   cashback paid, and yield sent to treasury.
   */
  async getProtocolStats() {
    const [totalLockedPrincipal, totalAetHeld, totalCashbackPaid, totalYieldToTreasury] = await this.view(
      `${this.addresses.aptree}::GuaranteedYieldLocking::get_protocol_stats`
    );
    return {
      totalLockedPrincipal: Number(totalLockedPrincipal),
      totalAetHeld: Number(totalAetHeld),
      totalCashbackPaid: Number(totalCashbackPaid),
      totalYieldToTreasury: Number(totalYieldToTreasury)
    };
  }
  /**
   * Check if a position has passed its unlock date and can be unlocked.
   *
   * Calls `GuaranteedYieldLocking::is_position_unlockable`.
   *
   * @param user - The user's account address.
   * @param positionId - The position ID.
   * @returns `true` if the position can be unlocked.
   */
  async isPositionUnlockable(user, positionId) {
    const [result] = await this.view(
      `${this.addresses.aptree}::GuaranteedYieldLocking::is_position_unlockable`,
      [user, positionId]
    );
    return result;
  }
  /**
   * Get the configuration for a specific tier.
   *
   * Calls `GuaranteedYieldLocking::get_tier_config`.
   *
   * @param tier - The tier number (1=Starter, 2=Bronze, 3=Silver, 4=Gold).
   * @returns A {@link GuaranteedTierConfig} with duration and yield BPS.
   */
  async getTierConfig(tier) {
    const [durationSeconds, yieldBps] = await this.view(
      `${this.addresses.aptree}::GuaranteedYieldLocking::get_tier_config`,
      [tier]
    );
    return {
      durationSeconds: Number(durationSeconds),
      yieldBps: Number(yieldBps)
    };
  }
  /**
   * Get the current treasury address.
   *
   * Calls `GuaranteedYieldLocking::get_treasury`.
   *
   * @returns The treasury address that receives excess yield.
   */
  async getTreasury() {
    const [result] = await this.view(
      `${this.addresses.aptree}::GuaranteedYieldLocking::get_treasury`
    );
    return result;
  }
  /**
   * Check if guaranteed-yield deposits are currently enabled.
   *
   * Calls `GuaranteedYieldLocking::are_deposits_enabled`.
   *
   * @returns `true` if deposits are enabled.
   */
  async areDepositsEnabled() {
    const [result] = await this.view(
      `${this.addresses.aptree}::GuaranteedYieldLocking::are_deposits_enabled`
    );
    return result;
  }
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
  async getEmergencyUnlockPreview(user, positionId) {
    const [payout, yieldForfeited, cashbackClawback] = await this.view(
      `${this.addresses.aptree}::GuaranteedYieldLocking::get_emergency_unlock_preview`,
      [user, positionId]
    );
    return {
      payout: Number(payout),
      yieldForfeited: Number(yieldForfeited),
      cashbackClawback: Number(cashbackClawback)
    };
  }
  /**
   * Get the maximum total locked principal allowed across all positions.
   *
   * Calls `GuaranteedYieldLocking::get_max_total_locked`.
   *
   * @returns The maximum total locked principal.
   */
  async getMaxTotalLocked() {
    const [result] = await this.view(
      `${this.addresses.aptree}::GuaranteedYieldLocking::get_max_total_locked`
    );
    return Number(result);
  }
  /**
   * Get the minimum deposit amount for new positions.
   *
   * Calls `GuaranteedYieldLocking::get_min_deposit`.
   *
   * @returns The minimum deposit amount.
   */
  async getMinDeposit() {
    const [result] = await this.view(
      `${this.addresses.aptree}::GuaranteedYieldLocking::get_min_deposit`
    );
    return Number(result);
  }
};

// src/modules/mock-vault/builder.ts
var MockVaultBuilder = class extends BaseModule {
  // ── Core vault entry functions ───────────────────────────────────────────
  /**
   * Build a `vault::deposit` transaction.
   *
   * Deposits a fungible asset into the mock vault.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link MockVaultDepositArgs}
   * @returns A built transaction ready for signing.
   */
  async deposit(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.moneyfi}::vault::deposit`,
      [args.token, args.amount]
    );
  }
  /**
   * Build a `vault::request_withdraw` transaction.
   *
   * Requests a withdrawal from the mock vault.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link MockVaultRequestWithdrawArgs}
   * @returns A built transaction ready for signing.
   */
  async requestWithdraw(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.moneyfi}::vault::request_withdraw`,
      [args.token, args.amount]
    );
  }
  /**
   * Build a `vault::withdraw_requested_amount` transaction.
   *
   * Completes a pending withdrawal from the mock vault.
   *
   * @param sender - The account address that will sign this transaction.
   * @param args - {@link MockVaultWithdrawRequestedArgs}
   * @returns A built transaction ready for signing.
   */
  async withdrawRequestedAmount(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.moneyfi}::vault::withdraw_requested_amount`,
      [args.token]
    );
  }
  // ── Admin / test-tuning entry functions ──────────────────────────────────
  /**
   * Build a `vault::set_yield_multiplier` transaction.
   *
   * Sets the yield multiplier in basis points for the mock vault.
   *
   * @remarks Admin only.
   * @param sender - The admin account address.
   * @param args - {@link SetYieldMultiplierArgs}
   */
  async setYieldMultiplier(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.moneyfi}::vault::set_yield_multiplier`,
      [args.multiplierBps]
    );
  }
  /**
   * Build a `vault::simulate_yield` transaction.
   *
   * Simulates yield by increasing total deposits by the given BPS.
   *
   * @remarks Admin only.
   * @param sender - The admin account address.
   * @param args - {@link SimulateYieldArgs}
   */
  async simulateYield(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.moneyfi}::vault::simulate_yield`,
      [args.yieldBps]
    );
  }
  /**
   * Build a `vault::simulate_loss` transaction.
   *
   * Simulates a loss by decreasing total deposits by the given BPS.
   *
   * @remarks Admin only.
   * @param sender - The admin account address.
   * @param args - {@link SimulateLossArgs}
   */
  async simulateLoss(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.moneyfi}::vault::simulate_loss`,
      [args.lossBps]
    );
  }
  /**
   * Build a `vault::reset_vault` transaction.
   *
   * Resets the mock vault state (total deposits, pending withdrawals, multiplier).
   *
   * @remarks Admin only.
   * @param sender - The admin account address.
   */
  async resetVault(sender) {
    return this.buildTransaction(
      sender,
      `${this.addresses.moneyfi}::vault::reset_vault`,
      []
    );
  }
  /**
   * Build a `vault::set_total_deposits` transaction.
   *
   * Directly sets the total deposits value for testing.
   *
   * @remarks Admin only.
   * @param sender - The admin account address.
   * @param args - {@link SetTotalDepositsArgs}
   */
  async setTotalDeposits(sender, args) {
    return this.buildTransaction(
      sender,
      `${this.addresses.moneyfi}::vault::set_total_deposits`,
      [args.amount]
    );
  }
};

// src/modules/mock-vault/resources.ts
var MockVaultResources = class extends BaseModule {
  /**
   * Read the `vault::MockVaultState` resource.
   *
   * Contains global vault state: total deposits, yield multiplier, pending
   * withdrawals, and admin address.
   *
   * @param address - The vault resource account address.
   * @returns The mock vault state.
   */
  async getMockVaultState(address) {
    return this.getResource(
      address,
      `${this.addresses.moneyfi}::vault::MockVaultState`
    );
  }
  /**
   * Read the `vault::DepositorState` resource for a specific depositor.
   *
   * Contains the depositor's deposited amount and pending withdrawal amount.
   *
   * @param depositor - The depositor's account address.
   * @returns The depositor's state.
   */
  async getDepositorState(depositor) {
    return this.getResource(
      depositor,
      `${this.addresses.moneyfi}::vault::DepositorState`
    );
  }
};

// src/modules/mock-vault/index.ts
var MockVaultModule = class extends BaseModule {
  constructor(aptos, addresses) {
    super(aptos, addresses);
    this.builder = new MockVaultBuilder(aptos, addresses);
    this.resources = new MockVaultResources(aptos, addresses);
  }
  // ── View Functions ─────────────────────────────────────────────────────
  /**
   * Estimate the total fund value for a depositor and token.
   *
   * Calls `vault::estimate_total_fund_value`.
   *
   * @param depositor - The depositor's account address.
   * @param token - The fungible asset metadata object address.
   * @returns The estimated total fund value.
   */
  async estimateTotalFundValue(depositor, token) {
    const [result] = await this.view(
      `${this.addresses.moneyfi}::vault::estimate_total_fund_value`,
      [depositor, token]
    );
    return Number(result);
  }
  /**
   * Get the vault's resource account address.
   *
   * Calls `vault::get_vault_address`.
   *
   * @returns The vault resource account address.
   */
  async getVaultAddress() {
    const [result] = await this.view(
      `${this.addresses.moneyfi}::vault::get_vault_address`
    );
    return result;
  }
  /**
   * Get the current yield multiplier in basis points.
   *
   * Calls `vault::get_yield_multiplier`.
   *
   * @returns The yield multiplier BPS value.
   */
  async getYieldMultiplier() {
    const [result] = await this.view(
      `${this.addresses.moneyfi}::vault::get_yield_multiplier`
    );
    return Number(result);
  }
  /**
   * Get the total deposits held in the vault.
   *
   * Calls `vault::get_total_deposits`.
   *
   * @returns The total deposits amount.
   */
  async getTotalDeposits() {
    const [result] = await this.view(
      `${this.addresses.moneyfi}::vault::get_total_deposits`
    );
    return Number(result);
  }
  /**
   * Get the total pending withdrawals in the vault.
   *
   * Calls `vault::get_pending_withdrawals`.
   *
   * @returns The total pending withdrawal amount.
   */
  async getPendingWithdrawals() {
    const [result] = await this.view(
      `${this.addresses.moneyfi}::vault::get_pending_withdrawals`
    );
    return Number(result);
  }
  /**
   * Get the state of a specific depositor.
   *
   * Calls `vault::get_depositor_state`.
   *
   * @param depositor - The depositor's account address.
   * @returns A {@link DepositorStateView} with deposited and pending withdrawal amounts.
   */
  async getDepositorState(depositor) {
    const [deposited, pendingWithdrawal] = await this.view(
      `${this.addresses.moneyfi}::vault::get_depositor_state`,
      [depositor]
    );
    return {
      deposited: Number(deposited),
      pendingWithdrawal: Number(pendingWithdrawal)
    };
  }
};

// src/modules/glade/builder.ts
function swapParamsToArgs(p) {
  return [
    [],
    // arg1: Option<signer> — always none, cannot pass signers as args
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
    p.arg13 ?? [],
    // Option wrapping handled by the SDK
    p.arg14,
    p.arg15 ?? [],
    // Option wrapping handled by the SDK
    p.arg16,
    p.fromTokenAmounts,
    p.arg18,
    p.arg19,
    p.arg20
  ];
}
var GladeBuilder = class extends BaseModule {
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
  async deposit(sender, args, typeArguments) {
    const fnArgs = [
      ...swapParamsToArgs(args.swapParams),
      args.depositAmount,
      args.provider
    ];
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::glade_flexible::deposit`,
      fnArgs,
      typeArguments
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
  async withdraw(sender, args, typeArguments) {
    const fnArgs = [
      ...swapParamsToArgs(args.swapParams),
      args.withdrawalAmount,
      args.provider
    ];
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::glade_flexible::withdraw`,
      fnArgs,
      typeArguments
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
  async depositGuaranteed(sender, args, typeArguments) {
    const fnArgs = [
      ...swapParamsToArgs(args.swapParams),
      args.depositAmount,
      args.tier,
      args.minAetReceived
    ];
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::glade_guaranteed::deposit_guaranteed`,
      fnArgs,
      typeArguments
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
  async unlockGuaranteed(sender, args, typeArguments) {
    const fnArgs = [
      ...swapParamsToArgs(args.swapParams),
      args.positionId
    ];
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::glade_guaranteed::unlock_guaranteed`,
      fnArgs,
      typeArguments
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
  async emergencyUnlockGuaranteed(sender, args, typeArguments) {
    const fnArgs = [
      ...swapParamsToArgs(args.swapParams),
      args.positionId
    ];
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::glade_guaranteed::emergency_unlock_guaranteed`,
      fnArgs,
      typeArguments
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
  async swap(sender, args, typeArguments) {
    const fnArgs = swapParamsToArgs(args.swapParams);
    return this.buildTransaction(
      sender,
      `${this.addresses.aptree}::swap_helpers::swap`,
      fnArgs,
      typeArguments
    );
  }
};

// src/modules/glade/index.ts
var GladeModule = class extends BaseModule {
  constructor(aptos, addresses) {
    super(aptos, addresses);
    this.builder = new GladeBuilder(aptos, addresses);
  }
};

// src/client.ts
var AptreeClient = class {
  constructor(config) {
    this.aptos = config.aptos instanceof import_ts_sdk.Aptos ? config.aptos : new import_ts_sdk.Aptos(config.aptos);
    this.addresses = config.addresses;
    this.bridge = new BridgeModule(this.aptos, this.addresses);
    this.locking = new LockingModule(this.aptos, this.addresses);
    this.guaranteedYield = new GuaranteedYieldModule(
      this.aptos,
      this.addresses
    );
    this.glade = new GladeModule(this.aptos, this.addresses);
    this.mockVault = new MockVaultModule(this.aptos, this.addresses);
  }
};

// src/config.ts
var TESTNET_ADDRESSES = {
  aptree: "0x7609a1f4fffae8048bf48d7ba740fab64d7b30ec463512bb9b2fd45645b1326b",
  moneyfi: "0xd4b0e499b766905e4da6633aa10cef52e0ffb98054ef76a9a97ea80b486782ca"
};

// src/types/common.ts
var LockingTier = /* @__PURE__ */ ((LockingTier2) => {
  LockingTier2[LockingTier2["Bronze"] = 1] = "Bronze";
  LockingTier2[LockingTier2["Silver"] = 2] = "Silver";
  LockingTier2[LockingTier2["Gold"] = 3] = "Gold";
  return LockingTier2;
})(LockingTier || {});
var GuaranteedYieldTier = /* @__PURE__ */ ((GuaranteedYieldTier2) => {
  GuaranteedYieldTier2[GuaranteedYieldTier2["Starter"] = 1] = "Starter";
  GuaranteedYieldTier2[GuaranteedYieldTier2["Bronze"] = 2] = "Bronze";
  GuaranteedYieldTier2[GuaranteedYieldTier2["Silver"] = 3] = "Silver";
  GuaranteedYieldTier2[GuaranteedYieldTier2["Gold"] = 4] = "Gold";
  return GuaranteedYieldTier2;
})(GuaranteedYieldTier || {});

// src/utils/constants.ts
var BPS_DENOMINATOR = 1e4;
var AET_SCALE = 1e9;
var PRECISION = 1e12;
var SEEDS = {
  BRIDGE: "APTreeEarn",
  MONEYFI_CONTROLLER: "MoneyFiBridgeController",
  MONEYFI_RESERVE: "MoneyFiBridgeReserve",
  LOCKING_CONTROLLER: "APTreeLockingController",
  GUARANTEED_YIELD_CONTROLLER: "GuaranteedYieldController",
  GUARANTEED_YIELD_CASHBACK_VAULT: "GuaranteedYieldCashbackVault",
  MOCK_MONEYFI_VAULT: "MockMoneyFiVault"
};
var LOCKING_DURATIONS = {
  /** 90 days */
  BRONZE: 7776e3,
  /** 180 days */
  SILVER: 15552e3,
  /** 365 days */
  GOLD: 31536e3
};
var GUARANTEED_YIELD_DURATIONS = {
  /** 30 days */
  STARTER: 2592e3,
  /** 90 days */
  BRONZE: 7776e3,
  /** 180 days */
  SILVER: 15552e3,
  /** 365 days */
  GOLD: 31536e3
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AET_SCALE,
  AptreeClient,
  BPS_DENOMINATOR,
  BridgeBuilder,
  BridgeModule,
  BridgeResources,
  GUARANTEED_YIELD_DURATIONS,
  GladeBuilder,
  GladeModule,
  GuaranteedYieldBuilder,
  GuaranteedYieldModule,
  GuaranteedYieldResources,
  GuaranteedYieldTier,
  LOCKING_DURATIONS,
  LockingBuilder,
  LockingModule,
  LockingResources,
  LockingTier,
  MockVaultBuilder,
  MockVaultModule,
  MockVaultResources,
  PRECISION,
  SEEDS,
  TESTNET_ADDRESSES
});
//# sourceMappingURL=index.js.map