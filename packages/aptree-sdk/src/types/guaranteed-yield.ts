// ─── On-chain Structs / Resources ────────────────────────────────────────────

/**
 * On-chain struct `aptree::GuaranteedYieldLocking::GuaranteedLockPosition`.
 *
 * Represents a guaranteed-yield lock position with instant cashback.
 */
export interface GuaranteedLockPosition {
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
export interface UserGuaranteedPositions {
  positions: GuaranteedLockPosition[];
  next_position_id: string;
}

// ─── View Function Return Types ──────────────────────────────────────────────

/**
 * Parsed return type for `get_protocol_stats() -> (total_locked, total_aet, total_cashback, total_yield_to_treasury)`.
 */
export interface ProtocolStats {
  totalLockedPrincipal: bigint;
  totalAetHeld: bigint;
  totalCashbackPaid: bigint;
  totalYieldToTreasury: bigint;
}

/** Parsed return type for `get_tier_config(tier) -> (duration, yield_bps)`. */
export interface GuaranteedTierConfig {
  /** Lock duration in seconds. */
  durationSeconds: bigint;
  /** Guaranteed yield in basis points. */
  yieldBps: bigint;
}

/**
 * Parsed return type for `get_emergency_unlock_preview(user, position_id) -> (payout, yield_forfeited, cashback_clawback)`.
 */
export interface GuaranteedEmergencyUnlockPreview {
  /** Amount the user receives. */
  payout: bigint;
  /** Amount of yield forfeited. */
  yieldForfeited: bigint;
  /** Cashback amount clawed back. */
  cashbackClawback: bigint;
}

// ─── Builder Arg Types ───────────────────────────────────────────────────────

/** Arguments for `GuaranteedYieldLocking::deposit_guaranteed`. */
export interface DepositGuaranteedArgs {
  /** Amount of underlying tokens to deposit. */
  amount: bigint;
  /** Lock tier (1=Starter, 2=Bronze, 3=Silver, 4=Gold). Use {@link GuaranteedYieldTier} enum. */
  tier: number;
  /** Minimum AET tokens to receive (slippage protection). */
  minAetReceived: bigint;
}

/**
 * Arguments for `GuaranteedYieldLocking::request_unlock_guaranteed`.
 *
 * Initiates the unlock process for a matured position. This requests a
 * withdrawal from MoneyFi which must be confirmed off-chain before
 * calling {@link WithdrawGuaranteedArgs | withdraw_guaranteed}.
 */
export interface RequestUnlockGuaranteedArgs {
  /** ID of the position to request unlock for. */
  positionId: bigint;
}

/**
 * Arguments for `GuaranteedYieldLocking::withdraw_guaranteed`.
 *
 * Completes the unlock process after the off-chain withdrawal confirmation.
 * Must be called after {@link RequestUnlockGuaranteedArgs | request_unlock_guaranteed}.
 */
export interface WithdrawGuaranteedArgs {
  /** ID of the position to withdraw. */
  positionId: bigint;
}

/** Arguments for `GuaranteedYieldLocking::fund_cashback_vault`. */
export interface FundCashbackVaultArgs {
  /** Amount to fund the cashback vault with. */
  amount: bigint;
}

/**
 * Arguments for `GuaranteedYieldLocking::request_emergency_unlock_guaranteed`.
 *
 * Initiates emergency unlock before maturity. Requests a withdrawal from
 * MoneyFi which must be confirmed off-chain before calling
 * {@link WithdrawEmergencyGuaranteedArgs | withdraw_emergency_guaranteed}.
 */
export interface RequestEmergencyUnlockGuaranteedArgs {
  /** ID of the position to emergency unlock. */
  positionId: bigint;
}

/**
 * Arguments for `GuaranteedYieldLocking::withdraw_emergency_guaranteed`.
 *
 * Completes the emergency unlock after off-chain withdrawal confirmation.
 * Must be called after {@link RequestEmergencyUnlockGuaranteedArgs | request_emergency_unlock_guaranteed}.
 */
export interface WithdrawEmergencyGuaranteedArgs {
  /** ID of the position to complete emergency withdrawal for. */
  positionId: bigint;
}

/** Arguments for `GuaranteedYieldLocking::set_tier_yield` (admin only). */
export interface SetTierYieldArgs {
  /** Tier to update. */
  tier: number;
  /** New yield in basis points. */
  newYieldBps: bigint;
}

/** Arguments for `GuaranteedYieldLocking::set_treasury` (admin only). */
export interface SetTreasuryArgs {
  /** New treasury address. */
  newTreasury: string;
}

/** Arguments for `GuaranteedYieldLocking::set_deposits_enabled` (admin only). */
export interface SetDepositsEnabledArgs {
  /** Whether deposits should be enabled. */
  enabled: boolean;
}

/** Arguments for `GuaranteedYieldLocking::admin_withdraw_cashback_vault` (admin only). */
export interface AdminWithdrawCashbackVaultArgs {
  /** Amount to withdraw from the cashback vault. */
  amount: bigint;
}

/** Arguments for `GuaranteedYieldLocking::propose_admin` (admin only). */
export interface ProposeAdminArgs {
  /** Address of the proposed new admin. */
  newAdmin: string;
}

/** Arguments for `GuaranteedYieldLocking::set_max_total_locked` (admin only). */
export interface SetMaxTotalLockedArgs {
  /** New maximum total locked principal. */
  newMax: bigint;
}

/** Arguments for `GuaranteedYieldLocking::set_min_deposit` (admin only). */
export interface SetMinDepositArgs {
  /** New minimum deposit amount. */
  newMin: bigint;
}
