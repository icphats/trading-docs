---
sidebar_position: 7
sidebar_label: Rate Limits
---

# Rate Limits

Any `err` increments violations. Any `ok` clears all violations instantly. Per-principal, per-canister.

| Tier | Violations | Effect | Recovery |
|---|---|---|---|
| 0 | 0-9 | Normal | -- |
| 1 | 10-19 | `SOFT_BLOCKED`, 5 min cooldown | Wait cooldown, succeed once to reset |
| 2 | 20+ | Silent reject at inspect | Wait 24h or `release_block()` |

## Soft Block

Returns `SOFT_BLOCKED` with metadata:

- `blocked_until_ms` — sleep until this timestamp
- `tries_left` — violations remaining before hard block

One success after cooldown clears all violations (back to Tier 0). One failure adds another 5 min cooldown.

## Hard Block

Rejected at `inspect_message` — no error body, call silently fails. If all calls fail with no response, you are hard-blocked.

Recovery:
1. Wait 24h (hourly cleanup removes inactive blocks)
2. `release_block(blocked_principal)` from a second identity — see below

## `release_block()`

A hard-blocked principal cannot call the canister. A second identity pays to release it.

```text
// caller = unblocked principal with quote token trading balance
release_block(blocked_principal)
// cost: 10x quote token ledger fee + 1x operation fee = 11x total
// deducted from caller's quote trading balance
```

On success, blocked principal returns to Tier 0 immediately. Maintain a funded secondary identity as a recovery path.

## What Counts

Tracked (increments violations): any command returning `err` — validation, state, external errors.

Not tracked: query calls, successful commands, calls rejected at inspect.

The rate limiter penalizes repeated errors, not request volume.