# Agent Blackbox

Verifiable execution receipts for autonomous AI agents on Casper.

Agent Blackbox is a "flight recorder" for AI agents. Every important agent action becomes a signed receipt containing the task intent, policy decision, tool call, cost, transaction hash, and result hash. The receipt body can stay off-chain while Casper stores a tamper-evident digest and emits events for dashboards, monitors, and future dispute resolution.

## Links

- Live demo: https://agent-blackbox-blush.vercel.app/
- Repository: https://github.com/nftkingiii/agent-blackbox

## Casper Testnet Deployment

- Account: `020227c032dc0cda3475482a27d86c2ccbd7f3444f7a17dfc08ce1a16087aafca8a1`
- Contract install transaction: `527101b5f588320530f091fdc390c852b9784df486722fae97fa518906892d0c`
- Contract hash: `hash-11c55f283a39e492201bf3f4f7e9b76436599b364c0a0fbc385d46fb3d1e5fb8`
- Contract package hash: `hash-a738b2bdb89a6b65c71c2ae11f5b688248f38abbf463b7d487ddc2c0981a7abb`
- Demo receipt ID: `28f49029-999a-496c-8e64-ce94df16b7bf`
- Demo receipt hash: `235470a706053333103e6c12741c4cfa8e147ab1d0230a1343e075c55cfac359`
- Receipt submit transaction: `b59446b16e1b17baa4081ee9152b7f4ac42c48fb6ddb3d9e1b0f6e22a7dd36ad`

Both transactions were accepted on Casper Testnet and returned execution info with no error message.

## Why this matters

Autonomous agents are starting to call APIs, spend tokens, sign transactions, and trigger contract execution. When something goes wrong, users need more than a chat transcript. They need cryptographic receipts that show what the agent was allowed to do, what it actually did, and what evidence exists for the result.

Agent Blackbox gives users, teams, and auditors a shared record of agent behavior without exposing private prompts or raw documents on-chain.

## Prototype scope

- Receipt canonicalization and SHA-256 hashing.
- Agent simulator that produces realistic execution receipts.
- Casper adapter that prepares receipt payloads for testnet anchoring.
- Casper smart contract scaffold for receipt registry storage.
- Web dashboard for replaying agent decisions and inspecting receipt integrity.
- CSPR.cloud-ready event/query adapter seam.

## Project layout

```text
apps/agent/              Agent simulator and demo runner
apps/web/                Dependency-light dashboard and local server
contracts/agent-blackbox Casper contract scaffold
packages/casper/         Casper adapter and payload preparation
packages/core/           Receipt schema, hashing, validation
scripts/                 Deployment helper scripts
docs/                    Architecture, deployment, and product notes
tests/                   Node test suite
```

## Run locally

```bash
npm test
npm run demo
npm run dev
```

Then open `http://localhost:4173`.

## Casper integration

Agent Blackbox produces deterministic receipt hashes locally, prepares Casper runtime arguments, and anchors receipt metadata through the deployed `contracts/agent-blackbox` registry on Casper Testnet.

Required on-chain action:

```text
submit_receipt(receipt_id, receipt_hash, agent_id, policy_hash, cost_motes, tool, decision, timestamp)
```

The contract stores receipt records in dictionaries and emits enough named-key state for indexers or CSPR.cloud-driven dashboards to verify submitted receipts.

## Contract build notes

Casper contract crates use nightly-only Rust features. If your local default toolchain is stable, install and use nightly:

```bash
rustup toolchain install nightly
rustup target add wasm32-unknown-unknown --toolchain nightly
cargo +nightly build --release --target wasm32-unknown-unknown --manifest-path contracts/agent-blackbox/Cargo.toml
```

If you prefer Casper's official build flow, compile the same contract directory in the Casper contract build container or CI environment, then deploy the resulting WASM to testnet.

## Demo narrative

1. A user gives an autonomous agent a task.
2. The agent checks policy before spending or calling a tool.
3. The agent calls a paid API or blockchain tool.
4. Agent Blackbox creates a signed execution receipt.
5. A hash of that receipt is anchored to Casper.
6. The dashboard verifies that the visible receipt still matches the on-chain digest.

## Positioning

Agent Blackbox is not a yield bot, oracle, or KYC flow. It is accountability infrastructure for the agent economy: a verifiable audit layer that any future Casper AI agent can use before it spends, trades, deploys, or calls paid services.
