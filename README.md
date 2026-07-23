# Agent Blackbox

[![CI](https://github.com/nftkingiii/agent-blackbox/actions/workflows/ci.yml/badge.svg)](https://github.com/nftkingiii/agent-blackbox/actions/workflows/ci.yml)
[![CodeQL](https://github.com/nftkingiii/agent-blackbox/actions/workflows/codeql.yml/badge.svg)](https://github.com/nftkingiii/agent-blackbox/actions/workflows/codeql.yml)

Verifiable execution receipts for autonomous AI agents on Casper.

Agent Blackbox is a "flight recorder" for AI agents. Every important agent action becomes a signed receipt containing the task intent, policy decision, tool call, cost, transaction hash, and result hash. The receipt body can stay off-chain while Casper stores a tamper-evident digest and emits events for dashboards, monitors, and future dispute resolution.

![Agent Blackbox interface preview](docs/assets/agent-blackbox-ui.svg)

## Links

- Live app: deploy with Railway using [docs/RAILWAY_DEPLOYMENT.md](docs/RAILWAY_DEPLOYMENT.md)
- Repository: https://github.com/nftkingiii/agent-blackbox

## Try it in 3 minutes

```bash
npm install
npm test
npm run demo
npm run dev
```

Then open `http://localhost:4173`.

In the UI:

1. Review the live receipt console.
2. Open the Casper Testnet explorer links in the evidence map.
3. Scroll to **Receipt verifier**.
4. Click **Verify receipt** to recompute the hash.
5. Click **Simulate tamper**, then **Verify receipt** again to see the mismatch.

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
- Railway-ready API server with durable receipt persistence.
- Web dashboard for replaying agent decisions and inspecting receipt integrity.
- CSPR.click wallet connection, transaction approval, and status updates.
- CSPR.cloud indexed read-back that matches the contract, receipt ID, and receipt hash.
- Paste/upload verifier for receipt JSON.
- Tampering simulation that demonstrates hash mismatch detection.
- CSPR.cloud-ready event/query adapter seam.

## Project layout

```text
apps/agent/              Agent simulator and demo runner
apps/api/                Railway-ready API, static app server, and receipt store
apps/web/                Dependency-light dashboard
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

The same server also exposes:

```text
GET  /health
GET  /api/config
GET  /api/receipts
POST /api/receipts
GET  /api/receipts/:receiptId
POST /api/receipts/:receiptId/verify
POST /api/receipts/:receiptId/anchor
POST /api/receipts/:receiptId/transaction
POST /api/receipts/:receiptId/confirm
GET  /api/receipts/:receiptId/proof
```

## Developer integration

Agent Blackbox is designed to wrap an agent action at the point where the agent calls a tool, spends funds, signs, deploys, or triggers a workflow.

```js
import { createReceipt, verifyReceipt } from "./packages/core/receipt.mjs";
import { createCasperBlackboxClient } from "./packages/casper/blackboxClient.mjs";

const receipt = createReceipt({
  agent,
  task,
  policy,
  toolCall,
  chain,
  evidence
});

const verification = verifyReceipt(receipt);

const casper = createCasperBlackboxClient({
  contractHash: process.env.AGENT_BLACKBOX_CONTRACT_HASH
});

const deployPayload = casper.prepareSubmitReceipt(receipt);
```

More detail:

- [Developer integration guide](docs/INTEGRATION.md)
- [Contract provenance](docs/CONTRACT_PROVENANCE.md)
- [Railway deployment guide](docs/RAILWAY_DEPLOYMENT.md)
- [Receipt format](docs/RECEIPT_FORMAT.md)
- [Testing playbook](docs/TESTING.md)
- [Threat model](docs/THREAT_MODEL.md)

## Casper integration

Agent Blackbox produces deterministic receipt hashes locally, prepares Casper runtime arguments, and anchors receipt metadata through the deployed `contracts/agent-blackbox` registry on Casper Testnet.

The console can create a fresh receipt, request approval through CSPR.click, submit it from the connected Casper wallet, and confirm the indexed transaction through CSPR.cloud. Production wallet signing requires `CSPR_CLICK_APP_ID`; indexed confirmation requires `CSPR_CLOUD_API_KEY`.

Required on-chain action:

```text
submit_receipt(receipt_id, receipt_hash, agent_id, policy_hash, cost_motes, tool, decision, timestamp)
```

The contract stores receipt records in dictionaries and emits enough named-key state for indexers or CSPR.cloud-driven dashboards to verify submitted receipts.

### What the sample Testnet records prove

- Contract install transaction: proves the registry contract was installed on Casper Testnet.
- Contract package hash: identifies the upgradeable contract package.
- Contract hash: identifies the callable registry contract.
- Receipt submit transaction: proves the sample receipt hash was submitted to the registry.
- Demo receipt hash: lets anyone recompute the off-chain receipt hash and compare it to the submitted proof.

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

The reusable SDK entry point is available from `packages/sdk/index.mjs` as the internal `@agent-blackbox/sdk` package.
