import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCasperBlackboxClient } from "../packages/casper/blackboxClient.mjs";
import { createAgentBlackbox } from "../packages/sdk/index.mjs";

const demo = JSON.parse(
  await readFile(new URL("../apps/web/public/demo-receipt.json", import.meta.url), "utf8")
);
const receipt = demo.receipt;
const publicKey =
  "020227c032dc0cda3475482a27d86c2ccbd7f3444f7a17dfc08ce1a16087aafca8a1";
const contractHash =
  "hash-11c55f283a39e492201bf3f4f7e9b76436599b364c0a0fbc385d46fb3d1e5fb8";

test("Casper client builds an unsigned submit_receipt transaction", () => {
  const client = createCasperBlackboxClient({ contractHash });
  const prepared = client.buildUnsignedSubmitTransaction(receipt, publicKey);

  assert.ok(prepared.transaction.transaction.Version1);
  assert.equal(prepared.payload.entryPoint, "submit_receipt");
  assert.equal(prepared.payload.runtimeArgs.receipt_id, receipt.receiptId);
  assert.equal(prepared.payload.runtimeArgs.receipt_hash, receipt.receiptHash);
});

test("SDK exposes a reusable create, verify, and prepare workflow", () => {
  const blackbox = createAgentBlackbox({
    casper: { contractHash }
  });

  assert.equal(blackbox.verify(receipt).ok, true);
  assert.equal(blackbox.prepare(receipt).entryPoint, "submit_receipt");
  assert.ok(blackbox.buildTransaction(receipt, publicKey).transaction);
});

test("CSPR.cloud verification matches contract and receipt arguments", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    data: {
      deploy_hash: "transaction-hash",
      status: "processed",
      error_message: null,
      contract_hash: contractHash.replace(/^hash-/, ""),
      block_hash: "block-hash",
      block_height: 123,
      caller_public_key: publicKey,
      args: {
        receipt_id: { parsed: receipt.receiptId },
        receipt_hash: { parsed: receipt.receiptHash }
      }
    }
  }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });

  try {
    const client = createCasperBlackboxClient({
      contractHash,
      apiKey: "test-key"
    });
    const proof = await client.verifyReceiptTransaction("transaction-hash", receipt);

    assert.equal(proof.ok, true);
    assert.equal(proof.contractMatches, true);
    assert.equal(proof.receiptMatches, true);
    assert.equal(proof.source, "cspr.cloud");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Casper client relays a wallet-signed transaction", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      result: {
        transaction_hash: { Version1: "signed-transaction-hash" }
      }
    }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };

  try {
    const client = createCasperBlackboxClient({ contractHash });
    const signedTransaction = {
      Version1: {
        approvals: [{ signer: publicKey, signature: "02signature" }]
      }
    };
    const submitted = await client.submitSignedTransaction(signedTransaction);

    assert.equal(submitted.transactionHash, "signed-transaction-hash");
    assert.equal(requestBody.method, "account_put_transaction");
    assert.deepEqual(requestBody.params.transaction, signedTransaction);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
