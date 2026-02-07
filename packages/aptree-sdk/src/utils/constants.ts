/** Basis points denominator (10_000 = 100%). */
export const BPS_DENOMINATOR = 10_000n;

/** AET share price scaling factor (1e9). */
export const AET_SCALE = 1_000_000_000n;

/** Precision factor used in locking calculations (1e12). */
export const PRECISION = 1_000_000_000_000n;

/** Resource account seeds used by the on-chain contracts. */
export const SEEDS = {
  BRIDGE: "APTreeEarn",
  MONEYFI_CONTROLLER: "MoneyFiBridgeController",
  MONEYFI_RESERVE: "MoneyFiBridgeReserve",
  LOCKING_CONTROLLER: "APTreeLockingController",
  GUARANTEED_YIELD_CONTROLLER: "GuaranteedYieldController",
  GUARANTEED_YIELD_CASHBACK_VAULT: "GuaranteedYieldCashbackVault",
  MOCK_MONEYFI_VAULT: "MockMoneyFiVault",
} as const;

/** Locking tier durations in seconds. */
export const LOCKING_DURATIONS = {
  /** 90 days */
  BRONZE: 7_776_000n,
  /** 180 days */
  SILVER: 15_552_000n,
  /** 365 days */
  GOLD: 31_536_000n,
} as const;

/** Guaranteed yield tier durations in seconds. */
export const GUARANTEED_YIELD_DURATIONS = {
  /** 30 days */
  STARTER: 2_592_000n,
  /** 90 days */
  BRONZE: 7_776_000n,
  /** 180 days */
  SILVER: 15_552_000n,
  /** 365 days */
  GOLD: 31_536_000n,
} as const;
