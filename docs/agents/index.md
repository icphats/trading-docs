---
sidebar_position: 1
sidebar_label: Overview
---

# Agent API

---

## The Agent Loop

Every agent tick follows the same cycle regardless of strategy:

```
// Bootstrap
user_data      = get_user()
routing_state  = get_routing_state()
last_versions  = user_data.versions

loop {
    // 1. POLL (see Monitoring)
    versions = poll_until_changed(last_versions)

    // 2. SENSE (see Monitoring)
    routing_state, user_data = refresh_stale(versions, last_versions)
    last_versions = versions

    // 3. DECIDE + 4. ACT (see Trading or Liquidity for domain-specific logic)
    check_system_state(routing_state.system_state)  // see Graceful Degradation
    action = strategy(routing_state, user_data)
    if action == none: continue
    result = execute(action)
    last_versions = result.versions
}
```

Every mutation response includes `versions: PollVersions` — store these as your baseline so the next poll only detects *external* changes.

---

## Ticks & Prices

All prices in the API are represented as **ticks** (`Int32`). A tick is a discrete price point on a logarithmic scale.

```
// Tick → human price (quote per base)
price = 1.0001^tick * 10^(baseDecimals - quoteDecimals)

// Human price → tick
tick = log(price / 10^(baseDecimals - quoteDecimals)) / log(1.0001)

// sqrt_price_x96 → human price (for interpreting pool.sqrt_price_x96)
price = (sqrtPriceX96 / 2^96)^2 * 10^(baseDecimals - quoteDecimals)
```

`baseDecimals` and `quoteDecimals` come from `get_routing_state().base.decimals` and `quote.decimals`.

Tick bounds: **-887272** to **887272**. For LP positions, ticks must be aligned to the pool's `tick_spacing` (read from `get_routing_state().pools[].tick_spacing`).

:::warning Input Token Convention
`input_amount` is always denominated in the **taker's input token**:
- **Buy** `input_amount` = **quote** — you're spending quote to get base
- **Sell** `input_amount` = **base** — you're spending base to get quote

This applies to `create_orders`, `create_triggers`, `pass_through_trade`, and `quote_order`.
:::

:::danger Order Book Denomination
`get_market_depth` sides use **different tokens**:
- **Bids** `.amount` = **quote** — what the buyer is offering
- **Asks** `.amount` = **base** — what the seller is offering

They are **not the same unit**. To compare depth across sides, convert to a common denomination using the tick at each level.
:::

---

## Trading Balance

Each market canister maintains its own **isolated trading balance** per user. Balances are not shared across markets — each canister has its own custody.

```
Wallet
  ├─ deposit → ckBTC/ckUSDT canister  → trading balance (base: ckBTC, quote: ckUSDT)
  ├─ deposit → ICP/ckUSDT canister    → trading balance (base: ICP, quote: ckUSDT)
  └─ deposit → PARTY/ICP canister     → trading balance (base: PARTY, quote: ICP)
```

### What Requires Trading Balance

| Requires trading balance | Does NOT require trading balance |
|--------------------------|----------------------------------|
| `create_orders` | `pass_through_trade` (wallet-to-wallet) |
| `create_triggers` | All queries (`get_*`) |
| `update_order` | `cancel_orders` / `cancel_triggers` |
| `add_liquidity` / `increase_liquidity` | `withdraw` (consumes balance, returns to wallet) |

### Funding Flow

```
// 1. Approve the canister to pull from your wallet (ICRC-2)
icrc2_approve(token_ledger, spot_canister, amount)

// 2. Deposit into the canister's trading balance
deposit(#base, amount)   // or #quote for the quote token

// 3. Now you can trade / LP on this market
create_orders([], [...], [])
add_liquidity(...)

// 4. When done, withdraw back to wallet
withdraw(#base, amount)
```

An agent operating across multiple markets must fund each separately. Alternatively, use `pass_through_trade` to bypass trading balance entirely for simple swaps — at the cost of async failure modes on the outbound transfer.

### Operation Fees

State-modifying operations charge a fee equal to the token's **ledger transfer fee**, charged **on top**:

```
fee = routing_state.base.fee  // or quote.fee for quote token
required_balance = input_amount + fee    // NOT just input_amount
```

| Charged (1 fee) | Free |
|-----------------|------|
| `create_orders` (1 per batch) | `cancel_orders` / `cancel_triggers` |
| `create_triggers` (1 per batch) | `cancel_all_orders` / `cancel_all_triggers` |
| `update_order` | `collect_fees` / `close_all_positions` |
| `add_liquidity` / `increase_liquidity` | `decrease_liquidity` |
| | `deposit` / `withdraw` (ledger fee only) |
| | `pass_through_trade` (ledger fees only) |

For decreases (`update_order` with lower amount), fee is subtracted from the refund instead. Fails if refund < fee.

---

## Monitoring

### Version-Based Polling

Use `get_versions()` for lightweight change detection before expensive re-fetches:

```
versions = get_versions()

// Market structure changed? (someone else traded, liquidity moved)
if versions.platform > last_versions.platform:
  routing_state = get_routing_state()

// User state changed externally? (order filled, trigger fired)
if versions.user > last_versions.user:
  user_data = get_user()

last_versions = versions
```

### `PollVersions`

```
PollVersions {
  platform: Nat    // trades, liquidity changes, price updates, system state
  orderbook: Nat   // limit order add/cancel (no match)
  candle: Nat      // timer boundary, candle archived (frontend use)
  user: Nat        // any change to the caller's account
}
```

### `get_routing_state()` Return Shape

```
RoutingState {
  system_state: #normal | #degraded | #halted
  base: { ledger: Principal, decimals: Nat8, fee: Nat }
  quote: { ledger: Principal, decimals: Nat8, fee: Nat }
  reference_tick: ?Int32
  last_book_tick: ?Int32
  last_trade_tick: ?Int32
  last_trade_sqrt_price_x96: ?Nat
  maker_fee_pips: Nat32
  taker_fee_pips: Nat32
  quote_usd_rate_e12: Nat                // USD price of quote token (×10¹²)
  current_price_usd_e12: Nat             // USD price of base token (×10¹²)
  pools: [{
    fee_pips: Nat32, tick_spacing: Nat, sqrt_price_x96: Nat, tick: Int32,
    liquidity: Nat, base_reserve: Nat, quote_reserve: Nat,
    initialized_ticks: [TickLiquidityData]
  }]
  book: { bids: [{ tick: Int32, total: Nat }], asks: [{ tick: Int32, total: Nat }] }
}
```

### `get_user()` Return Shape

Returns `null` if the caller has no trading account on this market.

```
UserData = ?{
  versions: PollVersions
  available: { base: Nat, quote: Nat }
  fees: { base: Nat, quote: Nat }
  cumulative_lp_fees: { base: Nat, quote: Nat }
  locked: {
    orders:    { base: Nat, quote: Nat }
    triggers:  { base: Nat, quote: Nat }
    positions: { base: Nat, quote: Nat }
  }
  net_flows: {
    external: { base: Int, quote: Int }
    swap:     { base: Int, quote: Int }
    lp:       { base: Int, quote: Int }
  }
  orders: [{
    order_id: Nat64, side: Side, tick: Int32,
    base_amount: Nat, quote_amount: Nat, base_filled: Nat, quote_filled: Nat,
    fee: Int, immediate_or_cancel: Bool,
    quote_usd_rate_e12: Nat, timestamp: Nat64,
    status: #pending | #partial | #filled | #cancelled
  }]
  triggers: [{
    trigger_id: Nat, side: Side, trigger_tick: Int32, limit_tick: Int32,
    input_amount: Nat, trigger_type: #above | #below,
    immediate_or_cancel: Bool, owner: Principal,
    quote_usd_rate_e12: Nat, timestamp: Nat64,
    status: #active | #triggered | #cancelled | #activation_failed
  }]
  positions: [{
    position_id: Nat64, tick_lower: Int32, tick_upper: Int32,
    liquidity: Nat, amount_base: Nat, amount_quote: Nat,
    fees_base: Nat, fees_quote: Nat, fee_pips: Nat32,
    usd_value_e6: Nat, fees_usd_value_e6: Nat, apr_bps: Nat,
    owner: Principal, locked_until: ?Nat64
  }]
}
```

### State Reconciliation

`get_user()` is the source of truth for periodic full reconciliation — it returns a complete snapshot of all balances and entities.

---

## Graceful Degradation

`routing_state.system_state` is included in every `get_routing_state()` response. State changes bump `platform` version, so agents detect them through normal polling.

| State | Agent Behavior |
|-------|----------------|
| `#normal` | Full strategy |
| `#degraded` | Exit only: `cancel_orders`, `cancel_all_orders`, `cancel_triggers`, `cancel_all_triggers`, `close_all_positions`, `withdraw`, `decrease_liquidity`, `collect_fees` |
| `#halted` | Stop all activity |
