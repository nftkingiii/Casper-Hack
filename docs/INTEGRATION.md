# Developer Integration

Agent Blackbox is meant to sit next to an autonomous agent runtime. The agent performs work as usual, but important actions are wrapped in a receipt before or immediately after execution.

## When to create a receipt

Create a receipt when an agent:

- Calls an external tool or paid API.
- Touches a wallet or signs a transaction.
- Triggers a workflow with user or financial impact.
- Makes a policy-sensitive decision.
- Produces evidence that may need audit review later.

## Minimal flow

```js
import { createReceipt, verifyReceipt } from "../packages/core/receipt.mjs";
import { createCasperBlackboxClient } from "../packages/casper/blackboxClient.mjs";

const receipt = createReceipt({
  agent: {
    id: "agent-risk-ops-01",
    name: "RiskOps Autopilot",
    wallet: "account-hash-demo-agent",
    model: "gpt-5-casper-policy-runner"
  },
  task: {
    intent: "Call a paid risk API if policy allows it.",
    user: "account-hash-demo-user"
  },
  policy: {
    policyHash: "policy-hash",
    decision: "approved",
    rules: ["allowed_tool", "under_single_call_limit"],
    riskScore: 18,
    explanation: "The action stays within configured limits."
  },
  toolCall: {
    tool: "risk-api",
    target: "https://api.example.test/risk-score",
    method: "POST",
    request: { account: "demo", amount: 1200000000 },
    response: { score: 18, status: "ok" },
    costMotes: 1200000000,
    status: "ok"
  },
  chain: {
    network: "casper-test",
    contractPackageHash: process.env.AGENT_BLACKBOX_PACKAGE_HASH,
    deployHash: "pending",
    blockHash: "pending"
  },
  evidence: [
    {
      label: "policy snapshot",
      uri: "ipfs://example/policy-snapshot.json"
    }
  ]
});

const localCheck = verifyReceipt(receipt);
if (!localCheck.ok) {
  throw new Error("Receipt failed local integrity check.");
}

const casper = createCasperBlackboxClient({
  contractHash: process.env.AGENT_BLACKBOX_CONTRACT_HASH
});

const payload = casper.prepareSubmitReceipt(receipt);
```

For an interactive dApp, the backend can construct an unsigned transaction for the connected account:

```js
const prepared = casper.buildUnsignedSubmitTransaction(receipt, publicKey);
const result = await window.csprclick.send(prepared.transaction, publicKey);
const proof = await casper.verifyReceiptTransaction(
  result.transactionHash ?? result.deployHash,
  receipt
);
```

CSPR.click requests wallet approval and submits the transaction. CSPR.cloud read-back then checks that the processed transaction called the expected contract with the expected `receipt_id` and `receipt_hash`.

## Integration contract

The Casper registry receives only compact receipt metadata:

```text
submit_receipt(receipt_id, receipt_hash, agent_id, policy_hash, cost_motes, tool, decision, timestamp)
```

The full receipt and private evidence can remain in the developer's database, object storage, IPFS, or encrypted audit archive.

## Verification contract

To verify a receipt:

1. Remove `receiptHash` from the receipt body.
2. Canonically sort all object keys.
3. SHA-256 hash the canonical JSON.
4. Compare the recomputed hash to `receiptHash`.
5. Compare `receiptHash` to the hash submitted to Casper.
