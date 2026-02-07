// ─── On-chain Resources ──────────────────────────────────────────────────────

/** On-chain resource `aptree::bridge::State`. Stored at the bridge resource account. */
export interface BridgeState {
  signer_cap: { account: string };
}

/** On-chain resource `aptree::moneyfi_adapter::BridgeState`. Stored at the controller resource account. */
export interface MoneyFiBridgeState {
  controller: string;
  controller_capability: { account: string };
  reserve: string;
  reserve_capability: { account: string };
}

/** On-chain resource `aptree::moneyfi_adapter::ReserveState`. Stored at the reserve resource account. */
export interface MoneyFiReserveState {
  mint_ref: object;
  burn_ref: object;
  transfer_ref: object;
  token_address: string;
}

/** On-chain resource `aptree::moneyfi_adapter::BridgeWithdrawalTokenState`. Stored at the reserve resource account. */
export interface BridgeWithdrawalTokenState {
  mint_ref: object;
  burn_ref: object;
  transfer_ref: object;
  token_address: string;
}

// ─── Builder Arg Types ───────────────────────────────────────────────────────

/** Arguments for `bridge::deposit`. */
export interface BridgeDepositArgs {
  /** The amount of the underlying token to deposit. */
  amount: bigint;
  /** The provider identifier (e.g. 0 for MoneyFi). */
  provider: bigint;
}

/** Arguments for `bridge::request`. */
export interface BridgeRequestArgs {
  /** The amount of share tokens (AET) to request withdrawal for. */
  amount: bigint;
  /** Minimum acceptable share price (u128) as slippage protection. */
  minAmount: bigint;
}

/** Arguments for `bridge::withdraw`. */
export interface BridgeWithdrawArgs {
  /** The amount of underlying tokens to withdraw. */
  amount: bigint;
  /** The provider identifier. */
  provider: bigint;
}

/** Arguments for `moneyfi_adapter::deposit`. */
export interface MoneyFiAdapterDepositArgs {
  /** The amount of the underlying token to deposit. */
  amount: bigint;
}

/** Arguments for `moneyfi_adapter::request`. */
export interface MoneyFiAdapterRequestArgs {
  /** The amount of AET share tokens to burn for withdrawal. */
  amount: bigint;
  /** Minimum share price (u128) for slippage protection. */
  minSharePrice: bigint;
}

/** Arguments for `moneyfi_adapter::withdraw`. */
export interface MoneyFiAdapterWithdrawArgs {
  /** The amount of underlying tokens to withdraw. */
  amount: bigint;
}
