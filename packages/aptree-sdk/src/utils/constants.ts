/** Basis points denominator (10_000 = 100%). */
export const BPS_DENOMINATOR = 10_000;

/** AET share price scaling factor (1e9). */
export const AET_SCALE = 1_000_000_000;

/** Precision factor used in locking calculations (1e12). */
export const PRECISION = 1_000_000_000_000;

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
  BRONZE: 7_776_000,
  /** 180 days */
  SILVER: 15_552_000,
  /** 365 days */
  GOLD: 31_536_000,
} as const;

/** Guaranteed yield tier durations in seconds. */
export const GUARANTEED_YIELD_DURATIONS = {
  /** 30 days */
  STARTER: 2_592_000,
  /** 90 days */
  BRONZE: 7_776_000,
  /** 180 days */
  SILVER: 15_552_000,
  /** 365 days */
  GOLD: 31_536_000,
} as const;
