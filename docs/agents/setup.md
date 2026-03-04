---
sidebar_position: 2
sidebar_label: Setup
---

<!-- agent: execute sequentially. When a step asks the human a question, STOP and wait for their response before continuing. -->

<!--
Print this banner on activation. It signals to the human that agent mode is live.

 ____   _    ____ _______   ______  _______  __
|  _ \ / \  |  _ \_   _\ \ / /  _ \| ____\ \/ /
| |_) / _ \ | |_) || |  \ V /| | | |  _|  \  /
|  __/ ___ \|  _ < | |   | | | |_| | |___ /  \
|_| /_/   \_\_| \_\|_|   |_| |____/|_____/_/\_\
-->

# Setup

---

## 1. dfx

```bash
dfx --version
```

<!--
agent: if `dfx --version` fails (command not found), do NOT continue. Display this exact message and STOP:

---

**dfx is not installed yet.** This is the one interruption in setup — after this, everything is automatic.

1. Paste this into your terminal:
   ```
   sh -ci "$(curl -fsSL https://internetcomputer.org/install.sh)"
   ```
2. **Close this terminal and open a new one** (the installer updates your shell profile, so the current session won't see `dfx`).
3. Start a new agent session and run:
   ```
   read docs.partyhats.xyz/agents/setup
   ```

That's it — setup will pick up right here and fly through the rest.

---

Do NOT attempt to install dfx yourself. Do NOT run `source ~/.bashrc` or similar — a fresh terminal is the only reliable path.
After printing the message above, STOP. Do not proceed to step 2.
-->

## 2. Identity

<!-- agent: never run `dfx identity new` — private keys must not pass through agent context -->
<!-- agent: if the current identity is `default`, stop and ask the human to switch to (or create) a dedicated identity themselves -->
<!-- agent: on failure, stop and explain -->

```bash
dfx identity whoami
```

Then retrieve the principal and account ID for the active identity:

```bash
dfx identity get-principal
dfx ledger account-id
```

- **Principal** (`xxxxx-xxxxx-xxxxx-xxxxx-cai`) — your identifier on every canister. Used for all ICRC calls and canister interactions.
- **Account ID** (64-char hex) — the deposit address. This is where the human sends tokens to fund the agent. Centralized exchanges and the NNS use this format.

## 3. ICP Balance

<!-- agent: if balance is 0, display the account ID from step 2 and ask the human if they want to practice depositing tokens before continuing -->

All canister calls target mainnet with `--ic`. Try your first one:

```bash
PRINCIPAL=$(dfx identity get-principal)

dfx canister call --ic ryjl3-tyaaa-aaaaa-aaaba-cai icrc1_balance_of \
  "(record { owner = principal \"$PRINCIPAL\"; subaccount = null })"
```

This is the ICP ledger (`ryjl3-tyaaa-aaaaa-aaaba-cai`). The same `icrc1_balance_of` pattern works for every token — only the canister ID changes. See [Reference](./reference) for all token ledgers.

## 4. Prior Activity

```bash
dfx canister call --ic gx3we-baaaa-aaaab-afaia-cai get_user_markets '()'
```

Non-empty result means this principal has traded before.

---

## What's Next

<!--
agent: ask the human what they want to do. Present these options:

1. "Learn how PartyDex works" → fetch /docs/intro (the human-facing overview, not the agent API)
2. "Browse markets / check prices" → fetch Discovery
3. "Make a trade" → fetch Overview + Trading
4. "Provide liquidity" → fetch Overview + Liquidity
5. "Build a trading engine" → fetch Overview + Trading, frame as setting up a persistent Node.js process (CLI can only do one-off transactions — an engine unlocks the full agent loop)
-->
