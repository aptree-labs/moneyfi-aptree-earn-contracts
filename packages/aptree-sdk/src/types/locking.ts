// ─── On-chain Structs / Resources ────────────────────────────────────────────

/**
 * On-chain struct `aptree::locking::LockPosition`.
 *
 * Represents a single time-locked deposit position held by a user.
 */
export interface LockPosition {
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
export interface UserLockPositions {
  positions: LockPosition[];
  next_position_id: string;
}

/** On-chain resource `aptree::locking::LockConfig`. Stored at the controller resource account. */
export interface LockConfig {
  signer_cap: { account: string };
  tier_limits_bps: string[];
  tier_durations: string[];
  locks_enabled: boolean;
  admin: string;
}

// ─── View Function Return Types ──────────────────────────────────────────────

/** Parsed return type for `locking::get_tier_config(tier) -> (duration, early_limit_bps)`. */
export interface TierConfig {
  /** Lock duration in seconds. */
  durationSeconds: bigint;
  /** Early withdrawal limit in basis points. */
  earlyLimitBps: bigint;
}

/** Parsed return type for `locking::get_emergency_unlock_preview(user, position_id) -> (payout, forfeited)`. */
export interface EmergencyUnlockPreview {
  /** Amount the user receives. */
  payout: bigint;
  /** Amount forfeited by the user. */
  forfeited: bigint;
}

// ─── Builder Arg Types ───────────────────────────────────────────────────────

/** Arguments for `locking::deposit_locked`. */
export interface DepositLockedArgs {
  /** Amount of underlying tokens to lock. */
  amount: bigint;
  /** Lock tier (1=Bronze, 2=Silver, 3=Gold). Use {@link LockingTier} enum. */
  tier: number;
}

/** Arguments for `locking::add_to_position`. */
export interface AddToPositionArgs {
  /** ID of the existing position to add to. */
  positionId: bigint;
  /** Additional amount to lock. */
  amount: bigint;
}

/** Arguments for `locking::withdraw_early`. */
export interface WithdrawEarlyArgs {
  /** ID of the position to withdraw from. */
  positionId: bigint;
  /** Amount to withdraw early. */
  amount: bigint;
}

/** Arguments for `locking::withdraw_unlocked`. */
export interface WithdrawUnlockedArgs {
  /** ID of the unlocked position to withdraw. */
  positionId: bigint;
}

/** Arguments for `locking::emergency_unlock`. */
export interface EmergencyUnlockArgs {
  /** ID of the position to emergency unlock. */
  positionId: bigint;
}

/** Arguments for `locking::set_tier_limit` (admin only). */
export interface SetTierLimitArgs {
  /** Tier to update (1=Bronze, 2=Silver, 3=Gold). */
  tier: number;
  /** New early withdrawal limit in basis points. */
  newLimitBps: bigint;
}

/** Arguments for `locking::set_locks_enabled` (admin only). */
export interface SetLocksEnabledArgs {
  /** Whether locking deposits should be enabled. */
  enabled: boolean;
}
