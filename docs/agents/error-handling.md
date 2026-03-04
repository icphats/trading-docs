---
sidebar_position: 6
sidebar_label: Error Handling
---

# Error Handling for Agents

## Error Shape

All mutations return `variant { ok : T, err : ApiError }`.

```text
ApiError = {
  category : ErrorCategory        -- match category for broad handling
  code     : text                  -- match this for specific handling
  message  : text                  -- human-readable, never match
  metadata : opt [(text, text)]    -- structured context
}

ErrorCategory = validation | authorization | state | resource
              | rate_limit | external | admin | other
```

Match on `code` for programmatic handling. Use `metadata` for structured context (balances, limits, tick values). Ignore `message` in code paths — it's for logs/humans.

## Decision Table

| Category | Codes | Agent Response |
|---|---|---|
| **validation** | `TICK_*`, `AMOUNT_*`, `ZERO_AMOUNT`, `INVALID_*`, `EMPTY_BATCH`, `DUST_POSITION` | Fix input, retry |
| **validation** | `*_LIMIT_EXCEEDED` | Reduce batch size or close existing entities |
| **validation** | `INSUFFICIENT_BALANCE` | Re-sync via `get_user()`, recalculate amounts. Check `metadata.available` and `metadata.required` |
| **validation** | `SLIPPAGE_EXCEEDED` | Widen slippage or re-quote |
| **state** | `ORDER_NOT_FOUND`, `TRIGGER_NOT_FOUND`, `POSITION_NOT_FOUND` | Re-sync state, entity was already closed |
| **state** | `HALTED`, `DEGRADED` | Check `routing_state.system_state`, switch to exit-only or stop |
| **state** | `UNINITIALIZED_MARKET` | Market not ready, wait and retry |
| **rate_limit** | `SOFT_BLOCKED`, `HARD_BLOCKED` | See [Rate Limits](./rate-limits) |
| **external** | `EXTERNAL_SERVICE_ERROR` | Check `metadata.service` for source. Retry with backoff |
| **external** | `TRANSFER_FAILED` | Funds remain in trading balance. Re-sync, retry withdrawal |
| **authorization** | `UNAUTHORIZED` | Wrong identity or not permitted |

## Error Codes

### Spot Canister

| Code | Metadata | When |
|---|---|---|
| `TICK_OUT_OF_BOUNDS` | `tick`, `min`, `max` | Tick outside MIN_TICK..MAX_TICK |
| `TICK_NOT_ALIGNED` | `tick`, `tick_spacing` | Tick not multiple of spacing |
| `INVALID_TICK_RANGE` | -- | tickLower \>= tickUpper |
| `INVALID_FEE_TIER` | -- | fee\_pips not a valid tier (multiples of 100, 100–10000) |
| `AMOUNT_TOO_SMALL` | `required_usd`, `provided_usd` | Below min USD threshold |
| `AMOUNT_TOO_LARGE` | -- | Exceeds 2\^128-1 |
| `ZERO_AMOUNT` | -- | Amount is 0 |
| `AMOUNT_BELOW_FEE` | -- | Amount at or below ledger fee |
| `EMPTY_BATCH` | -- | Zero-length order/trigger batch |
| `ORDER_LIMIT_EXCEEDED` | `current`, `limit` | Would exceed max orders per user |
| `TRIGGER_LIMIT_EXCEEDED` | `current`, `limit` | Would exceed max triggers per user |
| `POSITION_LIMIT_EXCEEDED` | `current`, `limit` | Would exceed max positions per user |
| `INVALID_ROUTE` | `reason` | `reason`: `too_many_pools`, `invalid_fee_tier`, `pool_not_viable`, `allocation_exceeds_input` |
| `TRIGGER_ALREADY_CROSSED` | -- | Trigger price already past current |
| `ZERO_LIQUIDITY` | -- | Wrong token for current price range |
| `DUST_POSITION` | -- | Partial withdrawal would leave under $10 |
| `INSUFFICIENT_BALANCE` | `available`, `required`, `token` | `token`: `base` or `quote` |
| `SLIPPAGE_EXCEEDED` | -- | Execution price worse than limit |
| `DUPLICATE_REQUEST` | -- | Idempotency key already used |
| `TRANSFER_FAILED` | `service` | ICRC transfer failed |
| `INSUFFICIENT_ALLOWANCE` | -- | ICRC-2 allowance too low |
| `ACCOUNT_NOT_FOUND` | -- | No trading account |
| `ORDER_NOT_FOUND` | -- | Order ID doesn't exist |
| `TRIGGER_NOT_FOUND` | -- | Trigger ID doesn't exist |
| `POSITION_NOT_FOUND` | -- | Position ID doesn't exist |
| `INVALID_STATE_TRANSITION` | -- | Entity in wrong state |
| `UNINITIALIZED_MARKET` | -- | Market not yet initialized |
| `HALTED` | -- | System halted |
| `DEGRADED` | -- | System in degraded mode |

### All Canister Endpoints

| Code | Metadata | When |
|---|---|---|
| `UNAUTHORIZED` | -- | Caller lacks permission |
| `EXTERNAL_SERVICE_ERROR` | `service` | Inter-canister call failed |
| `SOFT_BLOCKED` | `tries_left`, `blocked_until_ms` | Rate limit tier 1 |
| `HARD_BLOCKED` | -- | Rate limit tier 2 |

## Batch Partial Failures

Batch endpoints (`create_orders`, `create_triggers`, `cancel_orders`, `cancel_triggers`) return **per-item results**. A batch call can succeed overall while individual items fail.

```
results = create_orders([], [spec_a, spec_b, spec_c], [])
// results.order_results[0] = { ok: ... }   <- spec_a succeeded
// results.order_results[1] = { err: ... }  <- spec_b failed validation
// results.order_results[2] = { ok: ... }   <- spec_c succeeded
```

:::danger
Never assume a batch call is all-or-nothing. Always check per-item results.
:::

## Cancel + Create Budget

When passing `cancel_ids` to `create_orders` or `create_triggers`, cancels execute first. The creation step uses the **freed balance from cancellations** plus existing available balance. If you cancel 3 orders worth 1000 each and create 4 orders worth 1000 each, you need at least 1000 pre-existing available balance.

## Pass-Through Fallback

`pass_through_trade` has a fallback mode: if the outbound ICRC transfer fails after execution, the output credits to the user's trading balance instead of their wallet. The agent should check trading balance after a pass-through trade to detect this case.

## Retry Strategy

```text
on error:
  match category:
    validation  -> fix input, retry immediately
    state       -> re-sync state via get_user(), retry once
    external    -> retry with exponential backoff (500ms base, 30s cap)
    rate_limit  -> see Rate Limits page
```

For rate limit handling (tiers, forgiveness, recovery), see [Rate Limits](./rate-limits).
