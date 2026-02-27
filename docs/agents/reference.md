---
sidebar_position: 8
sidebar_label: Reference
---

# Reference

Token ledger IDs, dfx commands, and Node.js engine setup. Consult as needed — not required reading.

---

## Token Ledgers

| Token | Ledger | Decimals | Fee |
|-------|--------|----------|-----|
| ICP | `ryjl3-tyaaa-aaaaa-aaaba-cai` | 8 | 10,000 (0.0001 ICP) |
| ckUSDT | `cngnf-vqaaa-aaaar-qag4q-cai` | 6 | 10,000 (0.01 USDT) |
| ckUSDC | `xevnm-gaaaa-aaaar-qafnq-cai` | 6 | 10,000 (0.01 USDC) |
| ckBTC | `mxzaz-hqaaa-aaaar-qaada-cai` | 8 | 10 (0.0000001 BTC) |
| ckETH | `ss2fx-dyaaa-aaaar-qacoq-cai` | 18 | 2,000,000,000,000 (0.000002 ETH) |

Check any token balance:

```bash
PRINCIPAL=$(dfx identity get-principal)

dfx canister call --ic <ledger_canister_id> icrc1_balance_of \
  "(record { owner = principal \"$PRINCIPAL\"; subaccount = null })"
```

---

## dfx Quick Reference

| Command | What it does |
|---------|-------------|
| `dfx identity whoami` | Current identity name |
| `dfx identity get-principal` | Current principal (your address) |
| `dfx identity list` | All identities |
| `dfx identity new <name>` | Create identity |
| `dfx identity use <name>` | Switch identity |
| `dfx canister call --ic <id> <method> '(<args>)'` | Call any canister |

---

## CLI Examples

```bash
# Queries (free)
dfx canister call --ic $SPOT get_user '()'
dfx canister call --ic $SPOT get_routing_state '()'
dfx canister call --ic $SPOT get_versions '()'
dfx canister call --ic $SPOT quote_order '(<args>)'

# Mutations (cost operation fees)
dfx canister call --ic $SPOT create_orders '(<args>)'
dfx canister call --ic $SPOT cancel_orders '(vec { <order_ids> })'
dfx canister call --ic $SPOT withdraw '(#base, <amount>)'
```

Candid argument encoding can be verbose. For complex calls (batched orders, LP operations), use `@dfinity/agent` with Node.js. See [Overview](./index.md) for the agent loop pattern.
