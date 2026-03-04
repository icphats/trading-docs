---
sidebar_position: 5
sidebar_label: Liquidity
---

# Liquidity Management

## Decide + Act (steps 3–4 of the Agent Loop)

```
// For each position, compare pool.tick against the position's range
for position in user_data.positions:
  pool = find_pool(routing_state.pools, position.fee_pips)

  if pool.tick < position.tick_lower
     or pool.tick > position.tick_upper:

    // Out of range — full withdrawal (principal + fees returned atomically)
    decrease_liquidity(position.id, position.liquidity)

    // Reopen centered on current tick
    new_lower = align(pool.tick - range, pool.tick_spacing)
    new_upper = align(pool.tick + range, pool.tick_spacing)
    add_liquidity(fee_pips, new_lower, new_upper, amt_base, amt_quote, null, null)

  else if position.fees_base > 0 or position.fees_quote > 0:
    collect_fees(position.id)
```

## Fee Tiers & Tick Spacing

`fee_pips` ranges from 100 to 10000 in multiples of 100 (0.01% to 1.00%). Tick spacing is derived: `fee_pips / 100 * 2` (exception: 100 pips → spacing 1). Tick bounds for positions must be multiples of the pool's tick spacing.

Read `get_routing_state().pools[].tick_spacing` for each active pool — don't compute it yourself.

## Adding Liquidity

```
result = add_liquidity(
  fee_pips:       500,          // 0.05% pool
  tick_lower:     -230_500,     // must be multiple of tick_spacing (10)
  tick_upper:     -229_500,     // must be multiple of tick_spacing (10)
  amt_base:       10_000_000,   // desired base amount
  amt_quote:      500_000_000,  // desired quote amount
  initial_tick:   null,         // only for first LP in pool
  lock_until_ms:  null          // optional lock timestamp (one-way ratchet)
)
// result.position_id      → use for all future operations
// result.actual_amt_base  → base actually deposited (≤ amt_base)
// result.actual_amt_quote → quote actually deposited (≤ amt_quote)
```

The canister computes actual amounts from the current pool price and your tick range. One side may be zero if the current tick is outside your range. Excess is credited back to trading balance.

:::warning First LP
The first liquidity provider for a pool **must** provide `initial_tick` to set the pool price. Subsequent LPs pass `null`.
:::

## Increasing a Position

```
result = increase_liquidity(
  position_id:       42,
  amt_base_desired:  5_000_000,
  amt_quote_desired: 250_000_000
)
// result.liquidity_delta    → liquidity units added
// result.actual_amt_base    → base actually deposited
// result.actual_amt_quote   → quote actually deposited
```

Same excess-back behavior as `add_liquidity`. Fees are **not** auto-collected — they accumulate on the position for explicit `collect_fees`.

## Decreasing a Position

```
result = decrease_liquidity(
  position_id:    42,
  liquidity_delta: 1_000_000_000   // liquidity units to remove
)
// result.amount_base  → base tokens returned to trading balance
// result.amount_quote → quote tokens returned to trading balance
```

**Full withdrawal** (`liquidity_delta >= position.liquidity`): returns principal + all accumulated fees, deletes the position.

**Partial withdrawal**: returns only principal. Fees remain on the position — call `collect_fees` to claim them.

**Dust prevention**: cannot leave a position below **$10 USD** — either withdraw everything or leave at least $10. The withdrawal itself must also be at least $10.

`close_all_positions` is a parameterless kill switch — full withdrawal on every position, principal + fees auto-collected.

## Collecting Fees

```
result = collect_fees(position_id: 42)
// result.collected_amt_base  → base fees credited to trading balance
// result.collected_amt_quote → quote fees credited to trading balance
```

Drains all accumulated fees (including any `tokens_owed` stored from prior increases/decreases).

## Position Fields

`get_user().positions` returns full detail — same pattern as orders and triggers.

```
position_id, fee_pips, tick_lower, tick_upper, liquidity
amount_base, amount_quote            // current token amounts in position
fees_base, fees_quote                // total claimable (tokens_owed + newly accrued)
usd_value_e6, fees_usd_value_e6     // USD valuations
```

`fees_base/fees_quote` is the amount `collect_fees` would return. For a single position outside the loop, use `get_position(id)`.

