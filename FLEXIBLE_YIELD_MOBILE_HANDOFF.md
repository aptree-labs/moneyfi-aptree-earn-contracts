# Handoff: FlexibleYieldPool integration for the mobile app

Audience: the React Native / TypeScript agent maintaining the Aptree mobile app.
Assumes you're already wired up to `@aptree/sdk` for `client.bridge` and `client.glade`.

---

## 1. What this product is

A new variable-yield pool: users deposit USDT and earn whatever MoneyFi generates, minus a performance fee charged only on profit above a target APY.

- **Deposit** any amount (≥ `min_deposit_amount`, currently 1 USDT) any time.
- **Withdraw** any amount any time, two-step (request → complete) because the underlying MoneyFi vault settles withdrawals asynchronously.
- **Yield** is reflected in NAV growth, not in claim-able cashback. Position value = `shares × current_NAV`.
- **Fee** model: each deposit snapshots a target APY (10%) at the time of deposit. On withdraw, only the *excess* profit above that target is fee-bearing (20% on excess). If actual yield ≤ target, fee = 0.

Per-deposit accounting is done via **tickets** (one ticket per deposit), kept in FIFO order. Tickets store: shares, principal, entry NAV, entry time, target APY snapshot.

---

## 2. SDK additions

You already have `client.bridge` and `client.glade`. New surface:

- `client.flexibleYield` — the main module
  - `.builder` — transaction builders + payload builders
  - `.resources` — direct resource reads
  - view methods directly on the module (see §6)
- `client.glade.depositFlexiblePool(...)` / `.completeWithdrawFlexiblePool(...)` — swap-and-deposit / complete-and-swap one-shot entries, same pattern as the existing `client.glade` flexible/guaranteed wrappers you're already using
- New types (all re-exported from `@aptree/sdk`):
  `FlexibleTicket`, `UserFlexibleTickets`, `FlexiblePendingWithdrawal`, `UserFlexiblePendingWithdrawals`, `FlexiblePoolConfig`, `FlexibleProtocolStats`, `FlexibleWithdrawalPreview`, plus builder arg types prefixed `Flexible*Args`

The two patterns the rest of the SDK uses also apply here:
- `await client.flexibleYield.builder.deposit(sender, args)` → returns a `SimpleTransaction` for direct sign+submit
- `client.flexibleYield.builder.depositPayload(args)` → returns `InputEntryFunctionData` for wallet adapters. **Mobile should use the `*Payload` form** (it doesn't hit the network for build) and feed it into your wallet adapter's `signAndSubmitTransaction({ data: payload })`. Same pattern you already use for bridge/glade.

---

## 3. Mental model the UI needs

```
User
 ├─ tickets[]              (per-deposit records, FIFO)
 │    └─ { id, shares, principal, entry_nav, entry_time, target_apy_bps }
 └─ pending[]              (in-flight withdrawal requests)
      └─ { pending_id, gross_amount, user_receives, fee, principal_portion, shares_burned, requested_at }
```

Two list views to surface:

1. **Active positions** — `getUserTickets(user)` filtered to `shares > 0`. Each ticket is independently valued at the current NAV.
2. **Pending withdrawals** — `getPendingWithdrawals(user)`. Each one has a "Complete withdrawal" CTA once MoneyFi has processed it off-chain.

**Drained tickets stay in the array with `shares = 0`.** This is intentional — the indexer relies on it. Filter `shares > 0` before rendering.

---

## 4. The two-step withdraw flow (important UX)

```
[User] ──requestWithdraw──> tx 1: burns shares, requests bridge unwind, creates pending entry
                              │
                              │  (off-chain: MoneyFi processes the withdrawal — minutes to hours)
                              │
[User] ──completeWithdraw──> tx 2: pulls funds from bridge, transfers user_receives, pays fee to treasury
```

- Between tx 1 and tx 2, the pending entry is visible to the user. Show as "Processing…" with the elapsed time since `requested_at`.
- Calling `completeWithdraw` too early aborts with `EINSUFFICIENT_BALANCE` (the bridge doesn't have funds yet). You can either:
  - **Poll** `client.flexibleYield.getPendingWithdrawals(user)` + dry-run / simulate `completeWithdraw` until it doesn't abort.
  - **Backend trigger**: have a backend service listen for MoneyFi settlement events and notify the app when it's safe to call `completeWithdraw`.
  - **User-driven retry**: show a "Try complete" button; if it aborts, show "Still processing, try again in a few minutes."

For UX, the third option is the cheapest to ship. We can add server-side notification later.

---

## 5. Integration flows (code)

### 5a. Show current pool state on the deposit screen

```ts
import { AptreeClient } from "@aptree/sdk";

// Display before user picks an amount:
const [poolNav, poolValue, stats, minDeposit, depositsOn] = await Promise.all([
  client.flexibleYield.getPoolNav(),           // u128, returned as number (large)
  client.flexibleYield.getPoolValue(),          // u64, current pool value in USDT base units
  client.flexibleYield.getProtocolStats(),      // totals + targetApyBps + performanceFeeBps
  client.flexibleYield.getMinDeposit(),         // u64 base units
  client.flexibleYield.areDepositsEnabled(),
]);

// Gate the deposit button on depositsOn === true
// Show stats.targetApyBps / 100 as the target APY %
// Show stats.performanceFeeBps / 100 as the fee % on excess
```

> **Precision warning.** `getPoolNav()` returns a number; the underlying u128 can exceed `Number.MAX_SAFE_INTEGER`. For correctness use BigInt in any math: read the raw config via `client.flexibleYield.resources.getConfig(address)` (returns strings) and convert with `BigInt(...)`. The `number`-returning view methods are convenience for display only.

### 5b. Deposit (user already holds USDT)

```ts
// 1. Compute slippage protection
const nav = BigInt(/* fetch as string via resources.getConfig or use getPoolNav with care */);
const SHARE_SCALE = 10n ** 18n;
const amount = BigInt(10_000_000); // 10 USDT, 6 decimals
const expectedShares = (amount * SHARE_SCALE) / nav;
const minPoolShares = Number(expectedShares * 99n / 100n); // 1% slippage

// 2. Build payload for wallet adapter
const payload = client.flexibleYield.builder.depositPayload({
  amount: Number(amount),
  minPoolShares,
});

// 3. Submit via your existing wallet adapter
await signAndSubmitTransaction({ data: payload });
```

### 5c. Deposit (user holds another token, swap first)

Use the glade one-shot entry — same params shape as the existing `glade.depositFlexible`:

```ts
const payload = client.glade.depositFlexiblePoolPayload(
  {
    swapParams: panoraSwapParams,   // same shape as your existing glade calls
    minPoolShares: 0,                // or computed
  },
  typeArguments,                     // same as existing glade calls
);
await signAndSubmitTransaction({ data: payload });
```

### 5d. Render user positions

```ts
const tickets = await client.flexibleYield.getUserTickets(userAddress);
const active = tickets.filter(t => BigInt(t.shares) > 0n);

// Current value of each ticket:
const SHARE_SCALE = 10n ** 18n;
const navStr = /* fetch nav as string */;
const nav = BigInt(navStr);

const positions = active.map(t => {
  const shares = BigInt(t.shares);
  const principal = BigInt(t.principal);
  const currentValue = (shares * nav) / SHARE_SCALE;
  const unrealizedProfit = currentValue > principal ? currentValue - principal : 0n;
  const entryTime = Number(t.entry_time) * 1000; // ms
  return {
    id: t.id,
    principal,
    currentValue,
    unrealizedProfit,
    entryDate: new Date(entryTime),
    targetApyBps: Number(t.target_apy_bps),
  };
});
```

### 5e. Withdraw — preview, request, complete

```ts
// 1. Preview (show user fee breakdown before they confirm)
const preview = await client.flexibleYield.previewWithdrawal(
  userAddress,
  5_000_000, // 5 USDT
);
// preview = { grossAmount, principalPortion, actualProfit, targetProfit,
//             excessProfit, fee, userReceives, sharesBurned }

// 2. Request (slippage on lp_price)
const lpPrice = /* fetch from bridge: client.bridge.<view for lp_price> or via raw view */;
const minLpPrice = lpPrice * 99n / 100n;

const reqPayload = client.flexibleYield.builder.requestWithdrawPayload({
  grossAmount: 5_000_000,
  minLpPrice: Number(minLpPrice),
});
await signAndSubmitTransaction({ data: reqPayload });

// 3. List pending → user taps "Complete"
const pending = await client.flexibleYield.getPendingWithdrawals(userAddress);
// pending[i] = { pending_id, gross_amount, user_receives, fee, ... requested_at }

// 4. Complete (after MoneyFi processed)
const completePayload = client.flexibleYield.builder.completeWithdrawPayload({
  pendingId: Number(pending[0].pending_id),
});
await signAndSubmitTransaction({ data: completePayload });
```

### 5f. Withdraw with swap to a different output token

Use the glade one-shot:

```ts
const payload = client.glade.completeWithdrawFlexiblePoolPayload(
  {
    swapParams: panoraSwapParams,    // user_receives from the pending entry is what gets swapped
    pendingId: Number(pending[0].pending_id),
  },
  typeArguments,
);
```

The caller is responsible for sizing `swapParams.fromTokenAmounts` to match `pending.user_receives`. Look that up from `getPendingWithdrawals` first.

---

## 6. View functions cheat-sheet

| Method | Returns | Notes |
|---|---|---|
| `getUserTickets(user)` | `FlexibleTicket[]` | Includes drained tickets; filter `shares > 0` |
| `getPendingWithdrawals(user)` | `FlexiblePendingWithdrawal[]` | |
| `getPoolNav()` | `number` | u128 — see precision warning |
| `getPoolValue()` | `number` | u64, pool TVL in underlying base units |
| `getProtocolStats()` | `FlexibleProtocolStats` | totals + APY/fee bps |
| `previewWithdrawal(user, gross)` | `FlexibleWithdrawalPreview` | Use to show fee transparency pre-confirm |
| `getMinDeposit()` | `number` | base units |
| `getTreasury()` | `string` | informational |
| `areDepositsEnabled()` | `boolean` | gate deposit UI |
| `areWithdrawalsEnabled()` | `boolean` | gate withdraw UI; does **not** affect already-pending |
| `getMaxTargetApyBps()` | `number` | currently 1000 (10%) |
| `getAdmin()` | `string` | informational |
| `getPendingAdmin()` | `string \| null` | informational |

Direct resource reads via `client.flexibleYield.resources` if you need raw string values (e.g. for BigInt math): `getConfig`, `getUserTickets`, `getUserPendingWithdrawals`.

---

## 7. Gotchas (these will bite you)

1. **NAV / shares precision.** `SHARE_SCALE = 1e18`. Don't cast through plain `number` for math.
2. **Drained tickets in `getUserTickets`.** Filter `BigInt(t.shares) > 0n`.
3. **Two-step withdrawal.** `completeWithdraw` will abort if called too early — handle the error and prompt the user to try again later.
4. **`min_pool_shares` / `min_lp_price`** are slippage guards. Don't ship with `0` in production.
5. **Amount units.** USDT has 6 decimals. `1_000_000` = 1 USDT.
6. **Indexer compatibility.** The contract keeps drained tickets in the array; the indexer relies on that. Don't add UI logic that, e.g., assumes ticket indices are stable across deposits — but you can use ticket `id` (monotonic) as a stable key.
7. **Withdrawal pause.** Admin can call `set_withdrawals_enabled(false)`; check `areWithdrawalsEnabled()` and disable the request CTA accordingly. Pause does **not** block `completeWithdraw`, so users with pending entries can still settle.
8. **Admin rotation in flight.** If `getPendingAdmin()` is non-null, an admin handoff is in progress. Mostly informational, but if you have an admin-only screen, you may want to surface this.

---

## 8. Error codes (for surfacing readable errors)

From `FlexibleYieldPool.move`:

| Code | Constant | Meaning |
|---|---|---|
| 401 | `EZERO_AMOUNT` | Amount must be > 0 |
| 402 | `ENOT_ADMIN` | Caller is not admin |
| 403 | `EDEPOSITS_DISABLED` | Deposits are paused |
| 404 | `EBELOW_MINIMUM_DEPOSIT` | Amount < `min_deposit_amount` |
| 405 | `ESLIPPAGE_EXCEEDED` | `min_pool_shares` / `min_lp_price` not met |
| 406 | `EZERO_SHARES` | Math produced zero shares — usually a dust deposit |
| 407 | `EINSUFFICIENT_BALANCE` | Not enough tickets, or `completeWithdraw` called too early |
| 408 | `EPENDING_NOT_FOUND` | `pending_id` doesn't exist for this user |
| 409 | `EINVALID_ADDRESS` | Treasury / admin can't be `0x0` |
| 410 | `EINVALID_BPS` | bps value > 10000 |
| 411 | `ENOT_PENDING_ADMIN` | `accept_admin` caller isn't the proposed admin |
| 412 | `ENO_PENDING_ADMIN` | `accept_admin` with no pending proposal |
| 413 | `EWITHDRAWALS_DISABLED` | Withdrawal requests are paused |
| 414 | `ETARGET_EXCEEDS_CAP` | `set_target_apy_bps` above `max_target_apy_bps` |

The bridge also emits codes in the 100s (`ECLAIMS_DO_NOT_EXIST` etc.) — those can surface during deposit/withdraw bridge calls.

---

## 9. Migration notes from the current app

The app currently uses `client.bridge` and `client.glade` for swap+deposit into the bridge. Compared to that:

- **Same swap helpers, same `glade` pattern.** `client.glade.depositFlexiblePoolPayload` mirrors the existing `client.glade.depositFlexiblePayload` you already use — just a different terminal destination.
- **New mental model: tickets and pending withdrawals.** The current bridge model is share-token based (mint/burn AET); the flexible pool wraps that with internal accounting. From the UI's perspective, you stop showing AET balances for this product and instead show ticket-based positions.
- **Withdrawal is now two-step.** The previous bridge withdraw was also two-step (`request` + `withdraw`), so this should be familiar — same async settlement pattern, just with the additional pending entry the pool tracks for you.

---

## 10. Quick verification checklist before shipping a screen

- [ ] Deposit button gated on `areDepositsEnabled()` AND user balance ≥ `getMinDeposit()`
- [ ] Withdraw button gated on `areWithdrawalsEnabled()` AND at least one ticket with `shares > 0`
- [ ] Preview shown before withdraw confirmation, with fee breakdown
- [ ] `minPoolShares` / `minLpPrice` computed with ≥ 1% slippage tolerance
- [ ] Pending list shows "Complete withdrawal" CTA + elapsed time since `requested_at`
- [ ] Tickets filtered to `BigInt(shares) > 0n` before rendering
- [ ] All BigInt math (never `Number` for NAV / shares / large amounts)
- [ ] Error mapping for codes 401-414 + bridge 100s

---

If you need anything else (SDK gaps, missing views, additional helpers), flag it back — the contract owner has the codebase open and can add what you need.
