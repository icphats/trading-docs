---
sidebar_position: 1
slug: /
---

# PartyDex Documentation

PartyDex is a hybrid CLOB + AMM spot trading protocol on the Internet Computer.

## Overview

Each spot market is a single canister with a base/quote token pair. The canister combines:

- **Central Limit Order Book (CLOB)** — limit orders, IOC orders, trigger orders (stop-loss/take-profit)
- **Concentrated Liquidity AMM** — Uniswap V3-style pools with multiple fee tiers per market
- **Smart Order Routing** — `quote_order` computes optimal routing across book and pools

## Authentication

- **Public queries** — no authentication: `get_routing_state`, `get_reference_tick`, `quote_order`, `get_market_depth`, `get_pool`, `get_pools_overview`, `get_balance_sheet`
- **User queries** — caller's principal: `get_user`, `get_versions`, `get_user_activity`
- **Mutations** — caller's principal: all `deposit`, `withdraw`, `create_*`, `cancel_*`, `update_*`, etc.

## Token Decimals

Tokens are referenced as `#base` or `#quote` within a market canister. All amounts are in **native token decimals**:

| Token | Decimals | 1.0 = |
|-------|----------|-------|
| ckUSDT | 6 | `1_000_000` |
| ckUSDC | 6 | `1_000_000` |
| ckBTC | 8 | `100_000_000` |
| ICP | 8 | `100_000_000` |
| ckETH | 18 | `1_000_000_000_000_000_000` |

## Tick System

Prices are expressed as **ticks** — a log-scale representation where each tick is approximately 1 basis point (0.01%) of price movement. Higher tick = higher price of base in terms of quote.

