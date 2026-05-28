# Mobile: read all pool stats from view functions, never hardcode

The FlexibleYieldPool config is mutable on-chain — admin can change target APY, performance fee, min deposit, and pause flags at any time. **Do not hardcode any of these values in the mobile app.** Always read them live from the contract.

Concrete example: target APY was just changed from 10% → 8% on mainnet (tx `0x4e2ae8be…`). Any UI that hardcoded "10%" is now lying to users.

---

## What to read from where

| UI element / decision | View function | Returns |
|---|---|---|
| "Target APY: X%" | `client.flexibleYield.getProtocolStats()` → `targetApyBps / 100` | number (bps) |
| "Performance fee: Y% on excess" | `getProtocolStats()` → `performanceFeeBps / 100` | number (bps) |
| Pool TVL display | `getProtocolStats()` → `totalPrincipal` (user-deposited principal) or `getPoolValue()` (current marked-to-market) | base units (6 decimals) |
| Total fees collected by treasury | `getProtocolStats()` → `totalFeesCollected` | base units |
| Min deposit gating | `getMinDeposit()` | base units |
| Deposit button enabled | `areDepositsEnabled()` | boolean |
| Withdraw button enabled | `areWithdrawalsEnabled()` | boolean |
| Max possible target APY (admin info / future-proofing) | `getMaxTargetApyBps()` | number (bps) |
| Current NAV (for share-value math) | `getPoolNav()` or read from `resources.getConfig()` for BigInt precision | u128 |
| Pool admin (informational, e.g. about screen) | `getAdmin()` | address string |
| Pending admin handoff in flight | `getPendingAdmin()` | address \| null |

`getProtocolStats()` returns one tuple — call it once per screen render, not once per stat. Shape:

```ts
{
  totalInternalShares: number;
  totalAetHeld: number;
  totalPrincipal: number;
  totalPendingGross: number;
  totalFeesCollected: number;
  targetApyBps: number;        // e.g. 800 = 8%
  performanceFeeBps: number;   // e.g. 2000 = 20%
}
```

---

## Per-user reads

| UI element | View function | Notes |
|---|---|---|
| User's active positions | `getUserTickets(user)` then filter `BigInt(t.shares) > 0n` | drained tickets stay in array |
| User's pending withdrawals | `getPendingWithdrawals(user)` | |
| Withdrawal preview (fee breakdown) | `previewWithdrawal(user, grossAmount)` | call before showing confirm sheet |

---

## Recommended caching strategy

- **Per-screen**: fetch `getProtocolStats()` + `getMinDeposit()` + `areDepositsEnabled()` + `areWithdrawalsEnabled()` once on screen mount. Cache for the lifetime of the screen.
- **Per-action**: fetch fresh `getPoolNav()` + `getProtocolStats()` right before building a deposit/withdraw tx (so slippage calc uses current values).
- **Per-positions-refresh**: `getUserTickets(user)` + `getPendingWithdrawals(user)` on pull-to-refresh or every ~30s if the screen is open.

Don't cache `targetApyBps` / `performanceFeeBps` across sessions or in app state. Always read on screen entry.

---

## Quick snippet

```ts
async function loadPoolScreenData(client: AptreeClient, user: string) {
  const [stats, minDeposit, depositsOn, withdrawalsOn, tickets, pending] =
    await Promise.all([
      client.flexibleYield.getProtocolStats(),
      client.flexibleYield.getMinDeposit(),
      client.flexibleYield.areDepositsEnabled(),
      client.flexibleYield.areWithdrawalsEnabled(),
      client.flexibleYield.getUserTickets(user),
      client.flexibleYield.getPendingWithdrawals(user),
    ]);

  return {
    // Display
    targetApyPercent: stats.targetApyBps / 100,           // e.g. 8 for 8%
    performanceFeePercent: stats.performanceFeeBps / 100, // e.g. 20 for 20%
    tvlBaseUnits: stats.totalPrincipal,
    // Gates
    canDeposit: depositsOn,
    canWithdraw: withdrawalsOn,
    minDepositBaseUnits: minDeposit,
    // Positions
    activeTickets: tickets.filter(t => BigInt(t.shares) > 0n),
    pendingWithdrawals: pending,
  };
}
```

---

## Current mainnet values (as of last admin tx — for reference, do NOT hardcode)

- `target_apy_bps`: **800** (8%)
- `performance_fee_bps`: **2000** (20%)
- `max_target_apy_bps`: **1000** (10%) — cap, admin can raise target up to this without raising the cap first
- `min_deposit_amount`: **1_000_000** (1 USDT)
- `deposits_enabled`: **true**
- `withdrawals_enabled`: **true**

These are what the view functions return *right now*. They will change. Read them live.
