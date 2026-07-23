import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { createReceipt, verifyReceipt } from "../../packages/core/receipt.mjs";
import { createCasperBlackboxClient } from "../../packages/casper/blackboxClient.mjs";
import { ReceiptStore } from "./storage.mjs";

const PUBLIC_ROOT = join(process.cwd(), "apps", "web", "public");
const PREFERRED_PORT = Number(process.env.PORT ?? 4173);
const API_KEY = process.env.AGENT_BLACKBOX_API_KEY;
const CONTRACT_HASH =
  process.env.AGENT_BLACKBOX_CONTRACT_HASH ??
  "hash-11c55f283a39e492201bf3f4f7e9b76436599b364c0a0fbc385d46fb3d1e5fb8";
const PACKAGE_HASH =
  process.env.AGENT_BLACKBOX_CONTRACT_PACKAGE_HASH ??
  "hash-a738b2bdb89a6b65c71c2ae11f5b688248f38abbf463b7d487ddc2c0981a7abb";
const RECEIPT_TX =
  process.env.AGENT_BLACKBOX_SAMPLE_RECEIPT_TX ??
  "b59446b16e1b17baa4081ee9152b7f4ac42c48fb6ddb3d9e1b0f6e22a7dd36ad";
const INSTALL_TX =
  process.env.AGENT_BLACKBOX_INSTALL_TX ??
  "527101b5f588320530f091fdc390c852b9784df486722fae97fa518906892d0c";
const SAMPLE_RECEIPT_ID =
  process.env.AGENT_BLACKBOX_SAMPLE_RECEIPT_ID ??
  "28f49029-999a-496c-8e64-ce94df16b7bf";
const SAMPLE_RECEIPT_HASH =
  process.env.AGENT_BLACKBOX_SAMPLE_RECEIPT_HASH ??
  "235470a706053333103e6c12741c4cfa8e147ab1d0230a1343e075c55cfac359";
const CSPR_CLICK_APP_ID = process.env.CSPR_CLICK_APP_ID ?? "";
const CSPR_CLOUD_API_KEY = process.env.CSPR_CLOUD_API_KEY ?? "";
const CASPER_CALL_PAYMENT = process.env.CASPER_CALL_PAYMENT ?? "5000000000";
const CASPER_RPC_URL =
  process.env.CASPER_RPC_URL ?? "https://node.testnet.casper.network/rpc";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

const store = new ReceiptStore();
const casper = createCasperBlackboxClient({
  contractHash: CONTRACT_HASH,
  nodeUrl: CASPER_RPC_URL,
  apiKey: CSPR_CLOUD_API_KEY,
  paymentAmount: CASPER_CALL_PAYMENT
});

function json(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(body, null, 2));
}

function methodNotAllowed(response) {
  json(response, 405, { ok: false, error: "Method not allowed" });
}

async function readJson(request) {
  let raw = "";

  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 1_000_000) {
      throw new Error("Request body is too large.");
    }
  }

  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function requireWriteAccess(request, response) {
  if (!API_KEY) return true;

  const header = request.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (token === API_KEY) return true;

  json(response, 401, {
    ok: false,
    error: "Missing or invalid API key."
  });
  return false;
}

function knownAnchorFor(receipt) {
  if (receipt.receiptId === SAMPLE_RECEIPT_ID && receipt.receiptHash === SAMPLE_RECEIPT_HASH) {
    return {
      status: "anchored",
      network: "casper-test",
      contractHash: CONTRACT_HASH,
      contractPackageHash: PACKAGE_HASH,
      installTransaction: INSTALL_TX,
      receiptTransaction: RECEIPT_TX,
      receiptHash: SAMPLE_RECEIPT_HASH
    };
  }

  return {
    status: "prepared",
    network: "casper-test",
    contractHash: CONTRACT_HASH,
    contractPackageHash: PACKAGE_HASH,
    receiptHash: receipt.receiptHash
  };
}

function receiptRecord(receipt) {
  const verification = verifyReceipt(receipt);
  return {
    receiptId: receipt.receiptId,
    receiptHash: receipt.receiptHash,
    agentId: receipt.agent?.id ?? "unknown-agent",
    agentName: receipt.agent?.name ?? "Unknown agent",
    decision: receipt.policy?.decision ?? "unknown",
    riskScore: receipt.policy?.riskScore ?? null,
    tool: receipt.toolCall?.tool ?? "unknown-tool",
    costMotes: receipt.toolCall?.costMotes ?? "0",
    timestamp: receipt.timestamp ?? new Date().toISOString(),
    receipt,
    verification,
    anchor: knownAnchorFor(receipt)
  };
}

async function handleApi(request, response, url) {
  if (url.pathname === "/health") {
    json(response, 200, {
      ok: true,
      service: "agent-blackbox",
      storage: process.env.RECEIPT_STORE_PATH ? "volume" : "local-file",
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (url.pathname === "/api/config") {
    json(response, 200, {
      ok: true,
      network: "casper-test",
      contractHash: CONTRACT_HASH,
      contractPackageHash: PACKAGE_HASH,
      installTransaction: INSTALL_TX,
      sampleReceiptId: SAMPLE_RECEIPT_ID,
      sampleReceiptHash: SAMPLE_RECEIPT_HASH,
      sampleReceiptTransaction: RECEIPT_TX,
      csprClickAppId: CSPR_CLICK_APP_ID,
      csprClickEnabled: Boolean(CSPR_CLICK_APP_ID),
      csprCloudEnabled: Boolean(CSPR_CLOUD_API_KEY),
      casperNode: CASPER_RPC_URL,
      callPaymentMotes: CASPER_CALL_PAYMENT,
      writesRequireApiKey: Boolean(API_KEY)
    });
    return;
  }

  if (url.pathname === "/api/receipts") {
    if (request.method === "GET") {
      json(response, 200, { ok: true, receipts: await store.list() });
      return;
    }

    if (request.method !== "POST") {
      methodNotAllowed(response);
      return;
    }

    if (!requireWriteAccess(request, response)) return;

    const body = await readJson(request);
    const receipt = body.receiptHash ? body : createReceipt(body);
    const record = await store.put(receiptRecord(receipt));
    json(response, 201, { ok: true, record });
    return;
  }

  const receiptMatch = url.pathname.match(
    /^\/api\/receipts\/([^/]+)(?:\/(verify|anchor|transaction|submit|confirm|proof))?$/
  );
  if (receiptMatch) {
    const [, receiptId, action] = receiptMatch;
    const record = await store.get(decodeURIComponent(receiptId));

    if (!record) {
      json(response, 404, { ok: false, error: "Receipt not found" });
      return;
    }

    if (!action && request.method === "GET") {
      json(response, 200, { ok: true, record });
      return;
    }

    if (action === "verify" && request.method === "POST") {
      const verification = verifyReceipt(record.receipt);
      const updated = await store.put({ ...record, verification });
      json(response, 200, { ok: true, verification, record: updated });
      return;
    }

    if (action === "anchor" && request.method === "POST") {
      if (!requireWriteAccess(request, response)) return;

      const payload = casper.prepareSubmitReceipt(record.receipt);
      const knownAnchor = knownAnchorFor(record.receipt);
      const updated = await store.markAnchor(receiptId, {
        ...knownAnchor,
        status: knownAnchor.status === "anchored" ? "anchored" : "prepared",
        network: payload.network,
        contractHash: payload.contractHash,
        entryPoint: payload.entryPoint,
        runtimeArgs: payload.runtimeArgs
      });

      json(response, 200, { ok: true, payload, record: updated });
      return;
    }

    if (action === "transaction" && request.method === "POST") {
      const body = await readJson(request);
      const prepared = casper.buildUnsignedSubmitTransaction(record.receipt, body.publicKey);
      json(response, 200, { ok: true, ...prepared });
      return;
    }

    if (action === "submit" && request.method === "POST") {
      const body = await readJson(request);
      const submitted = await casper.submitSignedTransaction(body.transaction);
      const updated = await store.markAnchor(receiptId, {
        status: "submitted",
        network: "casper-test",
        contractHash: CONTRACT_HASH,
        contractPackageHash: PACKAGE_HASH,
        receiptHash: record.receiptHash,
        receiptTransaction: submitted.transactionHash
      });
      json(response, 200, { ok: true, ...submitted, record: updated });
      return;
    }

    if (action === "confirm" && request.method === "POST") {
      const body = await readJson(request);
      const proof = await casper.verifyReceiptTransaction(body.transactionHash, record.receipt);
      const updated = await store.markAnchor(receiptId, {
        status: proof.ok ? "anchored" : proof.status,
        network: "casper-test",
        contractHash: CONTRACT_HASH,
        contractPackageHash: PACKAGE_HASH,
        receiptHash: record.receiptHash,
        receiptTransaction: body.transactionHash,
        verification: proof
      });
      json(response, proof.ok ? 200 : 202, { ok: proof.ok, proof, record: updated });
      return;
    }

    if (action === "proof" && request.method === "GET") {
      const transactionHash = url.searchParams.get("transactionHash") ??
        record.anchor?.receiptTransaction;
      const proof = await casper.verifyReceiptTransaction(transactionHash, record.receipt);
      json(response, proof.ok ? 200 : 202, { ok: proof.ok, proof });
      return;
    }

    methodNotAllowed(response);
    return;
  }

  json(response, 404, { ok: false, error: "API route not found" });
}

async function serveStatic(response, url) {
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = normalize(join(PUBLIC_ROOT, requestedPath));

  if (!filePath.startsWith(PUBLIC_ROOT)) {
    response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "content-type": contentTypes[extname(filePath)] ?? "application/octet-stream",
      "cache-control": extname(filePath) === ".html" ? "no-store" : "public, max-age=3600"
    });
    response.end(body);
  } catch {
    const fallback = await readFile(join(PUBLIC_ROOT, "index.html"));
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    });
    response.end(fallback);
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

    if (url.pathname === "/health" || url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    await serveStatic(response, url);
  } catch (error) {
    json(response, 500, {
      ok: false,
      error: error.message
    });
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE" && !process.env.PORT) {
    const nextPort = Number(server.requestedPort ?? PREFERRED_PORT) + 1;
    if (nextPort <= PREFERRED_PORT + 10) {
      server.requestedPort = nextPort;
      server.listen(nextPort);
      return;
    }
  }

  throw error;
});

server.requestedPort = PREFERRED_PORT;
server.listen(PREFERRED_PORT, () => {
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : PREFERRED_PORT;
  console.log(`Agent Blackbox API and dashboard running on port ${port}`);
});
