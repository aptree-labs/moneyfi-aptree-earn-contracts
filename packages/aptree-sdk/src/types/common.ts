/**
 * Tier values for the locking module.
 *
 * - Bronze: 90-day lock, 2% early withdrawal limit
 * - Silver: 180-day lock, 3% early withdrawal limit
 * - Gold: 365-day lock, 5% early withdrawal limit
 */
export enum LockingTier {
  Bronze = 1,
  Silver = 2,
  Gold = 3,
}

/**
 * Tier values for the guaranteed yield module.
 *
 * - Starter: 30-day lock, 0.4% yield
 * - Bronze: 90-day lock, 1.25% yield
 * - Silver: 180-day lock, 2.5% yield
 * - Gold: 365-day lock, 5% yield
 */
export enum GuaranteedYieldTier {
  Starter = 1,
  Bronze = 2,
  Silver = 3,
  Gold = 4,
}
