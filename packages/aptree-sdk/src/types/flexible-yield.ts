// ─── On-chain Structs / Resources ────────────────────────────────────────────

/** On-chain struct `aptree::FlexibleYieldPool::Ticket`. */
export interface FlexibleTicket {
  id: string;
  shares: string;
  principal: string;
  entry_nav: string;
  entry_time: string;
  target_apy_bps: string;
}

/** On-chain resource `aptree::FlexibleYieldPool::UserFlexibleTickets`. */
export interface UserFlexibleTickets {
  tickets: FlexibleTicket[];
  next_ticket_id: string;
  fifo_cursor: string;
}

/** On-chain struct `aptree::FlexibleYieldPool::PendingWithdrawal`. */
export interface FlexiblePendingWithdrawal {
  pending_id: string;
  gross_amount: string;
  user_receives: string;
  fee: string;
  principal_portion: string;
  shares_burned: string;
  requested_at: string;
}

/** On-chain resource `aptree::FlexibleYieldPool::UserPendingWithdrawals`. */
export interface UserFlexiblePendingWithdrawals {
  pending: FlexiblePendingWithdrawal[];
  next_pending_id: string;
}

/** On-chain resource `aptree::FlexibleYieldPool::FlexiblePoolConfig`. */
export interface FlexiblePoolConfig {
  signer_cap: { account: string };
  admin: string;
  /** Move `Option<address>` — `{ vec: [] }` when none, `{ vec: [address] }` when some. */
  pending_admin: { vec: [] | [string] };
  treasury: string;
  target_apy_bps: string;
  max_target_apy_bps: string;
  performance_fee_bps: string;
  deposits_enabled: boolean;
  withdrawals_enabled: boolean;
  min_deposit_amount: string;
  total_internal_shares: string;
  total_aet_held: string;
  total_principal: string;
  total_pending_gross: string;
  total_fees_collected: string;
}

// ─── View Function Return Types ──────────────────────────────────────────────

/** Parsed return type for `get_protocol_stats()`. */
export interface FlexibleProtocolStats {
  totalInternalShares: number;
  totalAetHeld: number;
  totalPrincipal: number;
  totalPendingGross: number;
  totalFeesCollected: number;
  targetApyBps: number;
  performanceFeeBps: number;
}

/** Parsed return type for `preview_withdrawal()`. */
export interface FlexibleWithdrawalPreview {
  grossAmount: number;
  principalPortion: number;
  actualProfit: number;
  targetProfit: number;
  excessProfit: number;
  fee: number;
  userReceives: number;
  sharesBurned: number;
}

// ─── Builder Arg Types ───────────────────────────────────────────────────────

/** Arguments for `FlexibleYieldPool::deposit`. */
export interface FlexibleDepositArgs {
  amount: number;
  minPoolShares: number;
}

/** Arguments for `FlexibleYieldPool::request_withdraw`. */
export interface FlexibleRequestWithdrawArgs {
  grossAmount: number;
  minLpPrice: number;
}

/** Arguments for `FlexibleYieldPool::complete_withdraw`. */
export interface FlexibleCompleteWithdrawArgs {
  pendingId: number;
}

/** Arguments for `FlexibleYieldPool::set_target_apy_bps`. */
export interface FlexibleSetTargetApyArgs {
  newTargetApyBps: number;
}

/** Arguments for `FlexibleYieldPool::set_performance_fee_bps`. */
export interface FlexibleSetPerformanceFeeArgs {
  newPerformanceFeeBps: number;
}

/** Arguments for `FlexibleYieldPool::set_treasury`. */
export interface FlexibleSetTreasuryArgs {
  newTreasury: string;
}

/** Arguments for `FlexibleYieldPool::set_deposits_enabled`. */
export interface FlexibleSetDepositsEnabledArgs {
  enabled: boolean;
}

/** Arguments for `FlexibleYieldPool::set_min_deposit`. */
export interface FlexibleSetMinDepositArgs {
  newMinDeposit: number;
}

/** Arguments for `FlexibleYieldPool::set_max_target_apy_bps`. */
export interface FlexibleSetMaxTargetApyArgs {
  newMaxTargetApyBps: number;
}

/** Arguments for `FlexibleYieldPool::set_withdrawals_enabled`. */
export interface FlexibleSetWithdrawalsEnabledArgs {
  enabled: boolean;
}

/** Arguments for `FlexibleYieldPool::propose_admin`. */
export interface FlexibleProposeAdminArgs {
  newAdmin: string;
}
