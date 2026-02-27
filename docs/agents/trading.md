---
sidebar_position: 4
sidebar_label: Trading
---

# Trading

## Orders

### `create_orders`

```
create_orders(
  cancel_ids  : [OrderId],        // cancel these first (freeing slots + balance)
  book_orders : [BookOrderSpec],   // limit orders — resting or IOC
  pool_swaps  : [PoolSwapSpec],    // AMM swaps — execute first
)
```

Cancels execute first, then pool swaps, then book orders through the cascade.

```
// Book-only limit orders
create_orders([], [
    { side: #buy,  limit_tick: -230_000, input_amount: 500_000_000, ioc: false },
    { side: #sell, limit_tick: -229_800, input_amount: 10_000_000,  ioc: false },
], [])

// Routed order (book + pools) via quote
quote = quote_order(#buy, 1_000_000, limit_tick, ?50)
create_orders(
  [],
  quote.book_order != null ? [quote.book_order] : [],
  quote.pool_swaps
)

// Atomic replace: cancel old orders, create new ones in single call
create_orders([old_id_1, old_id_2], [new_spec_1, new_spec_2], [])
```

Pool swaps and book orders fill independently — `swap_results[i]` corresponds 1:1 to `pool_swaps[i]`, `order_results[i]` to `book_orders[i]`.

```
// Response
{
  versions: PollVersions,
  cancel_results: [{ order_id, result: #ok(()) | #err(...) }],
  cancel_summary: BatchSummary,           // { succeeded, failed }
  order_results: [{ index, result: #ok({ order_id }) | #err(...) }],
  swap_results: [{
    index,
    result: #ok({
      input_amount,   // gross input consumed (includes fee), may be < spec.input_amount on partial fill
      output_amount,  // net output received
      fee,            // pool fee extracted from input (input_amount = net_input + fee)
    }) | #err(...)
  }],
  order_summary: BatchSummary,
  available_base: Nat,
  available_quote: Nat,
}
```

Zero-fill (`input_amount = 0, output_amount = 0, fee = 0`) means no liquidity at that tier — not failure.

### `quote_order`

`quote_order(side, amount, limit_tick, ?slippage_bps)` — `slippage_bps` is optional max slippage in basis points, `null` for no constraint.

```
QuoteResult {
  input_amount: Nat,
  output_amount: Nat,
  price_impact_bps: Nat,
  min_output: Nat,
  pool_swaps: [PoolSwapSpec],       // pass to create_orders / pass_through_trade
  book_order: ?BookOrderSpec,       // pass to create_orders / pass_through_trade
  venue_breakdown: [VenueBreakdown],
  total_fees: Nat,
  effective_tick: Tick,
  reference_tick: Tick,
}
```

Agents with proprietary routing can construct `BookOrderSpec` and `PoolSwapSpec` directly from `get_routing_state()` instead of using `quote_order`.

### Triggers

`create_triggers(cancel_ids, specs)` (up to 20) — conditional orders that activate when book trade tick crosses a threshold. Pass `cancel_ids` to atomically cancel existing triggers first.

```
create_triggers([], [{
  side: #sell,
  trigger_tick: -231_000,
  limit_tick:   -231_500,
  input_amount: 10_000_000,
  reference_tick: -230_000,
  ioc: true,
}])
```

```
// Response
{
  versions: PollVersions,
  cancel_results: [{ trigger_id, result: #ok(()) | #err(...) }],
  cancel_summary: BatchSummary,
  results: [{ index, result: #ok({ trigger_id }) | #err(...) }],
  summary: BatchSummary,
  available_base: Nat,
  available_quote: Nat,
}
```

:::warning Activation Source
Triggers are only evaluated during **book-based trades** (limit order matches). Pool swaps do not activate triggers.
:::

### `update_order`

Returns `#replaced` when tick changes (new entity) or `#modified` when only amount decreases at same tick (same entity, retains queue priority).

```
// Response (one of)
#replaced({ versions, order_id, available_base, available_quote })
#modified({ versions, refunded, available_base, available_quote })
```

### Cancellation

`cancel_orders(order_ids)`, `cancel_triggers(trigger_ids)` — batch cancel by ID.

```
// Response (both follow same shape)
{
  versions: PollVersions,
  results: [{ order_id|trigger_id, result: #ok(()) | #err(...) }],
  summary: BatchSummary,
  available_base: Nat,
  available_quote: Nat,
}
```

`cancel_all_orders()`, `cancel_all_triggers()` — parameterless kill switches. No per-item results.

```
// Response (both follow same shape)
{
  versions: PollVersions,
  cancelled: Nat32,
  available_base: Nat,
  available_quote: Nat,
}
```

## Pass-Through (wallet-to-wallet)

Bypasses trading balance entirely. Tokens move from wallet → routing engine → wallet. Needs ICRC-2 approval instead of deposit.

```
// Routed (book + pools) via quote
icrc2_approve(token_ledger, spot_canister, amount)
quote = quote_order(#buy, 1_000_000, limit_tick, ?50)
pass_through_trade({
  book_order: quote.book_order,
  pool_swaps: quote.pool_swaps,
  recipient: ?my_principal,  // optional, defaults to caller
})

// Pool-swaps-only (no book order)
pass_through_trade({
  book_order: null,
  pool_swaps: quote.pool_swaps,
  recipient: null,
})
```

```
// Response
{
  versions: PollVersions,
  swap_results: [{ index, result: #ok({ input_amount, output_amount, fee }) | #err(...) }],
  output: Nat,
  output_block_index: ?Nat,
  output_error: ?Text,
  refund: Nat,
  refund_block_index: ?Nat,
  refund_error: ?Text,
}
```

On outbound transfer failure, funds credit to your **trading balance** as fallback (not lost, but not in your wallet). Check trading balance if the output transfer block index is null.

## Type Reference

```
BookOrderSpec {
  side: #buy | #sell
  input_amount: Nat               // native decimals
  limit_tick: Tick
  immediate_or_cancel: Bool       // true = refund unfilled
}

PoolSwapSpec {
  side: #buy | #sell
  input_amount: Nat               // native decimals
  limit_tick: Tick                 // slippage protection
  fee_pips: Nat32                 // pool tier: 100, 500, 3000, 10000
}

TriggerSpec {
  side: #buy | #sell
  trigger_tick: Tick              // activation price
  limit_tick: Tick                // slippage tolerance for resulting order
  input_amount: Nat               // native decimals
  reference_tick: Tick            // caller's current price → direction (#above if trigger > reference, #below otherwise)
  immediate_or_cancel: Bool
}

VenueBreakdown {
  venue_id: #book | #pool(fee_pips)
  input_amount: Nat
  output_amount: Nat
  fee_amount: Nat
}

BatchSummary { succeeded: Nat32, failed: Nat32 }
```
