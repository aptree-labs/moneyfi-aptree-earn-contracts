// ─── On-chain Resources ──────────────────────────────────────────────────────

/** On-chain resource `moneyfi_mock::vault::MockVaultState`. */
export interface MockVaultState {
  signer_cap: { account: string };
  total_deposits: string;
  yield_multiplier_bps: string;
  pending_withdrawals: string;
  admin: string;
}

/** On-chain resource `moneyfi_mock::vault::DepositorState`. */
export interface DepositorState {
  deposited: string;
  pending_withdrawal: string;
}

// ─── View Function Return Types ──────────────────────────────────────────────

/** Parsed return type for `vault::get_depositor_state(depositor) -> (deposited, pending_withdrawal)`. */
export interface DepositorStateView {
  deposited: number;
  pendingWithdrawal: number;
}

// ─── Builder Arg Types ───────────────────────────────────────────────────────

/** Arguments for `vault::deposit`. */
export interface MockVaultDepositArgs {
  /** Address of the fungible asset metadata object. */
  token: string;
  /** Amount to deposit. */
  amount: number;
}

/** Arguments for `vault::request_withdraw`. */
export interface MockVaultRequestWithdrawArgs {
  /** Address of the fungible asset metadata object. */
  token: string;
  /** Amount to request for withdrawal. */
  amount: number;
}

/** Arguments for `vault::withdraw_requested_amount`. */
export interface MockVaultWithdrawRequestedArgs {
  /** Address of the fungible asset metadata object. */
  token: string;
}

/** Arguments for `vault::set_yield_multiplier` (admin only). */
export interface SetYieldMultiplierArgs {
  /** New yield multiplier in basis points. */
  multiplierBps: number;
}

/** Arguments for `vault::simulate_yield` (admin only). */
export interface SimulateYieldArgs {
  /** Yield to simulate in basis points. */
  yieldBps: number;
}

/** Arguments for `vault::simulate_loss` (admin only). */
export interface SimulateLossArgs {
  /** Loss to simulate in basis points. */
  lossBps: number;
}

/** Arguments for `vault::set_total_deposits` (admin only). */
export interface SetTotalDepositsArgs {
  /** New total deposits value. */
  amount: number;
}
