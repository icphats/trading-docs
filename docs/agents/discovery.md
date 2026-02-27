---
sidebar_position: 3
sidebar_label: Discovery
---

# Discovery

The **indexer canister** resolves markets. Call it once to get spot canister principals, then interact with spot canisters directly. Token metadata (decimals, ledger principals) comes from `get_routing_state()` on the spot canister — no separate lookup needed.

## Returning Agent

```
canister_ids = indexer.get_user_markets()
// → [Principal] — spot canisters where you have balances, orders, triggers, or LP positions
```

Tracked automatically. Spot canisters register your principal on first deposit/trade, deregister on full withdrawal.

## New Agent

```
// Resolve by symbol (case-insensitive)
canister_id = indexer.get_market_by_symbols("ckBTC", "ckUSDT")
// → ?Principal

// Or browse all markets
markets = indexer.get_markets({ limit: 50, cursor: null })
// → { data: [{ symbol, canister_id, base_token, quote_token, ... }], next_cursor, has_more }
```

If you already have ledger principals, `get_market_by_pair(base_ledger, quote_ledger)` also works.
