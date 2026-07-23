const TESTNET_PROOF = {
  contractHash: "hash-11c55f283a39e492201bf3f4f7e9b76436599b364c0a0fbc385d46fb3d1e5fb8",
  contractPackageHash: "hash-a738b2bdb89a6b65c71c2ae11f5b688248f38abbf463b7d487ddc2c0981a7abb",
  installTransaction: "527101b5f588320530f091fdc390c852b9784df486722fae97fa518906892d0c",
  receiptTransaction: "b59446b16e1b17baa4081ee9152b7f4ac42c48fb6ddb3d9e1b0f6e22a7dd36ad",
  receiptHash: "235470a706053333103e6c12741c4cfa8e147ab1d0230a1343e075c55cfac359",
  receiptId: "28f49029-999a-496c-8e64-ce94df16b7bf"
};

const page = document.body.dataset.page;
let demoData = null;
let productConfig = null;
let activeAccount = null;
let createdRecord = null;

function byId(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const element = byId(id);
  if (element) element.textContent = value;
}

function setHref(id, value) {
  const element = byId(id);
  if (!element) return;
  element.href = value;
  element.removeAttribute("aria-disabled");
}

function initializeNavigation() {
  const toggle = document.querySelector(".menu-toggle");
  const links = byId("navLinks");
  if (!toggle || !links) return;

  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!isOpen));
    toggle.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
    links.classList.toggle("is-open", !isOpen);
  });

  links.addEventListener("click", (event) => {
    if (!event.target.closest("a")) return;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open navigation");
    links.classList.remove("is-open");
  });
}

async function loadDemo() {
  const response = await fetch("/demo-receipt.json");
  if (!response.ok) throw new Error("The demo receipt is unavailable.");
  return response.json();
}

async function loadApiConfig() {
  const response = await fetch("/api/config");
  if (!response.ok) throw new Error("The product API is unavailable.");
  return response.json();
}

async function persistReceipt(receipt) {
  const response = await fetch("/api/receipts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(receipt)
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Receipt persistence failed.");
  return body.record;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok && response.status !== 202) {
    throw new Error(body.error ?? body.proof?.message ?? "The request failed.");
  }
  return body;
}

function applyApiConfig(config) {
  Object.assign(TESTNET_PROOF, {
    contractHash: config.contractHash,
    contractPackageHash: config.contractPackageHash,
    installTransaction: config.installTransaction,
    receiptTransaction: config.sampleReceiptTransaction,
    receiptHash: config.sampleReceiptHash,
    receiptId: config.sampleReceiptId
  });
}

function formatMotes(value) {
  return `${(Number(value) / 1_000_000_000).toFixed(2)} CSPR`;
}

function shortHash(value, start = 10, end = 8) {
  const input = String(value ?? "");
  if (input.length <= start + end + 3) return input;
  return `${input.slice(0, start)}...${input.slice(-end)}`;
}

function explorerTransaction(hash) {
  return `https://testnet.cspr.live/transaction/${hash}`;
}

function explorerContract(hash) {
  return `https://testnet.cspr.live/contract/${hash.replace(/^hash-/, "")}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sortForCanonicalJson(value) {
  if (Array.isArray(value)) return value.map(sortForCanonicalJson);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = sortForCanonicalJson(value[key]);
      return result;
    }, {});
  }
  return value;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyReceiptObject(receipt) {
  const { receiptHash, ...body } = receipt;
  const actual = await sha256Hex(JSON.stringify(sortForCanonicalJson(body)));
  return { ok: receiptHash === actual, expected: receiptHash ?? "-", actual };
}

function renderTimeline(receipt, deployResult) {
  const list = byId("timeline");
  if (!list) return;
  const payload = deployResult.payload ?? {};
  const items = [
    { label: "Intent captured", body: receipt.task.intent, meta: new Date(receipt.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
    { label: "Policy checked", body: `${receipt.policy.decision} with risk score ${receipt.policy.riskScore}. ${receipt.policy.explanation}`, meta: "Runtime policy" },
    { label: "Tool called", body: `${receipt.toolCall.method} ${receipt.toolCall.target}; request and response hashes recorded.`, meta: receipt.toolCall.tool },
    { label: "Receipt anchored", body: `${payload.entryPoint ?? "submit_receipt"} on ${payload.network ?? "casper-test"}; transaction ${shortHash(TESTNET_PROOF.receiptTransaction, 12, 10)}.`, meta: "Casper Testnet" }
  ];

  list.innerHTML = items.map((item, index) => `
    <li>
      <span class="step-index">${String(index + 1).padStart(2, "0")}</span>
      <div class="timeline-content"><span class="timeline-meta">${escapeHtml(item.meta)}</span><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.body)}</p></div>
    </li>
  `).join("");
}

function renderApiMessage(title, body, ok) {
  const panel = byId("apiMessage");
  if (!panel) return;
  panel.classList.toggle("is-risk", ok === false);
  panel.classList.toggle("is-ok", ok === true);
  setText("apiMessageTitle", title);
  setText("apiMessageBody", body);
}

function renderWorkflowStatus(title, body, state = "ok") {
  const panel = byId("workflowStatus");
  if (!panel) return;
  panel.dataset.state = state;
  panel.classList.toggle("is-risk", state === "error");
  panel.classList.toggle("is-pending", state === "pending");
  const titleElement = panel.querySelector("strong");
  const bodyElement = panel.querySelector("p");
  if (titleElement) titleElement.textContent = title;
  if (bodyElement) bodyElement.textContent = body;
}

function updateProgress(currentStep) {
  const steps = ["captureStep", "signStep", "anchorStep"];
  const activeIndex = steps.indexOf(currentStep);
  steps.forEach((stepId, index) => {
    const step = byId(stepId);
    if (!step) return;
    step.classList.toggle("is-complete", index < activeIndex);
    step.classList.toggle("is-current", index === activeIndex);
  });
}

function showCreatedReceipt(record) {
  const panel = byId("currentReceipt");
  if (!panel) return;
  panel.hidden = false;
  setText("createdReceiptId", record.receiptId);
  setText("createdReceiptHash", record.receiptHash);
  setText("createdAnchorState", "Created off-chain");
  const link = byId("createdReceiptLink");
  if (link) link.hidden = true;
}

function updateWalletState(account) {
  activeAccount = account ?? null;
  const publicKey = activeAccount?.public_key ?? activeAccount?.publicKey;
  setText("walletState", publicKey ? shortHash(publicKey, 12, 8) : "Wallet disconnected");
  const button = byId("connectWallet");
  if (button) button.textContent = publicKey ? "Switch account" : "Connect wallet";
}

function loadExternalScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (window.csprclick) resolve();
      else existing.addEventListener("load", resolve, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", () => reject(new Error("CSPR.click could not be loaded.")), { once: true });
    document.head.append(script);
  });
}

async function initializeCsprClick(config) {
  const connectButton = byId("connectWallet");
  if (!connectButton) return;

  if (!config.csprClickEnabled) {
    connectButton.disabled = true;
    renderWorkflowStatus(
      "Wallet setup required",
      "Set CSPR_CLICK_APP_ID on Railway to enable CSPR.click wallet approvals.",
      "error"
    );
    return;
  }

  try {
    window.clickUIOptions = {
      uiContainer: "csprclick-ui",
      rootAppElement: "body",
      showTopBar: false,
      show1ClickModal: true
    };
    window.clickSDKOptions = {
      appName: "Agent Blackbox",
      appId: config.csprClickAppId,
      contentMode: "iframe",
      chainName: "casper-test",
      casperNode: config.casperNode,
      providers: ["casper-wallet", "ledger", "metamask-snap"]
    };

    const loaded = new Promise((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error("CSPR.click initialization timed out.")),
        15000
      );
      window.addEventListener("csprclick:loaded", () => {
        window.clearTimeout(timeout);
        resolve();
      }, { once: true });
    });
    await loadExternalScript("https://cdn.cspr.click/ui/v1.12.0/csprclick-client-1.12.0.js");
    await loaded;
    if (!window.csprclick) throw new Error("CSPR.click did not expose its browser client.");

    window.csprclick.on?.("csprclick:signed_in", (event) => updateWalletState(event.account ?? event));
    window.csprclick.on?.("csprclick:switched_account", (event) => updateWalletState(event.account ?? event));
    window.csprclick.on?.("csprclick:signed_out", () => updateWalletState(null));
    window.csprclick.on?.("csprclick:disconnected", () => updateWalletState(null));
    window.csprclick.on?.("csprclick:unsolicited_account_change", (event) => {
      if (event.account) window.csprclick.signInWithAccount(event.account);
    });

    const restored = await window.csprclick.getActiveAccountAsync?.();
    updateWalletState(restored);
    renderWorkflowStatus(
      "Wallet integration ready",
      config.csprCloudEnabled
        ? "Connect a wallet, create a receipt, and anchor it on Casper Testnet."
        : "Wallet signing is ready. Add CSPR_CLOUD_API_KEY for indexed proof confirmation.",
      "ok"
    );
  } catch (error) {
    connectButton.disabled = true;
    renderWorkflowStatus("Wallet integration unavailable", error.message, "error");
  }
}

async function connectWallet() {
  if (!window.csprclick) return;
  if (activeAccount) window.csprclick.switchAccount();
  else window.csprclick.signIn();
}

function composerInput() {
  const source = demoData?.receipt;
  if (!source) throw new Error("The receipt template is not loaded.");
  const publicKey = activeAccount?.public_key ?? activeAccount?.publicKey ?? "wallet-not-connected";

  return {
    agent: {
      ...source.agent,
      wallet: publicKey
    },
    task: {
      ...source.task,
      intent: byId("actionIntent").value.trim()
    },
    policy: {
      ...source.policy,
      explanation: "The action was evaluated against the Agent Blackbox demo policy."
    },
    toolCall: {
      ...source.toolCall,
      tool: byId("actionTool").value.trim(),
      request: { intent: byId("actionIntent").value.trim() },
      response: { allowed: true },
      costMotes: String(byId("actionCost").value)
    },
    chain: {
      ...source.chain,
      network: "casper-test",
      contractPackageHash: productConfig.contractPackageHash,
      deployHash: null,
      blockHash: null
    },
    evidence: source.evidence
  };
}

async function createCustomReceipt(event) {
  event.preventDefault();
  const button = byId("createReceipt");
  try {
    button.disabled = true;
    renderWorkflowStatus("Creating receipt", "Canonicalizing the action and computing its SHA-256 proof.", "pending");
    createdRecord = await persistReceipt(composerInput());
    showCreatedReceipt(createdRecord);
    updateProgress("signStep");
    byId("anchorReceipt").disabled = false;
    renderWorkflowStatus(
      "Receipt created",
      `${shortHash(createdRecord.receiptId, 12, 8)} is locally valid and ready for wallet approval.`,
      "ok"
    );
  } catch (error) {
    renderWorkflowStatus("Receipt creation failed", error.message, "error");
  } finally {
    button.disabled = false;
  }
}

async function anchorCustomReceipt() {
  const button = byId("anchorReceipt");
  try {
    if (!createdRecord) throw new Error("Create a receipt first.");
    if (!activeAccount) {
      connectWallet();
      throw new Error("Connect a wallet, then select Sign and anchor again.");
    }
    if (!window.csprclick) throw new Error("CSPR.click is unavailable.");

    button.disabled = true;
    updateProgress("signStep");
    const publicKey = activeAccount.public_key ?? activeAccount.publicKey;
    renderWorkflowStatus("Preparing transaction", "Building the unsigned submit_receipt contract call.", "pending");
    const prepared = await requestJson(`/api/receipts/${encodeURIComponent(createdRecord.receiptId)}/transaction`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ publicKey })
    });

    renderWorkflowStatus("Awaiting wallet approval", "Review and approve the Casper Testnet transaction.", "pending");
    const result = await window.csprclick.send(
      prepared.transaction,
      publicKey,
      (status) => renderWorkflowStatus("Casper transaction", `Current status: ${status}.`, "pending")
    );
    if (result?.cancelled) throw new Error("The wallet approval was cancelled.");
    if (result?.error) throw new Error(result.error);

    const transactionHash = result?.transactionHash ?? result?.deployHash;
    if (!transactionHash) throw new Error("The wallet did not return a transaction hash.");
    updateProgress("anchorStep");
    setHref("receiptTxLink", explorerTransaction(transactionHash));
    setHref("receiptTxExplorerLink", explorerTransaction(transactionHash));
    setText("receiptTxExplorerLabel", shortHash(transactionHash, 12, 10));
    setHref("createdReceiptLink", explorerTransaction(transactionHash));
    const createdReceiptLink = byId("createdReceiptLink");
    if (createdReceiptLink) createdReceiptLink.hidden = false;
    setText("createdAnchorState", "Submitted to Casper");

    renderWorkflowStatus("Checking indexed proof", "Comparing the submitted receipt arguments through CSPR.cloud.", "pending");
    const confirmation = await requestJson(`/api/receipts/${encodeURIComponent(createdRecord.receiptId)}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transactionHash })
    });
    renderWorkflowStatus(
      confirmation.proof.ok ? "Receipt anchored and verified" : "Transaction submitted",
      confirmation.proof.message,
      confirmation.proof.ok ? "ok" : "pending"
    );
    setText("createdAnchorState", confirmation.proof.ok ? "Anchored and verified" : "Pending confirmation");
    if (confirmation.proof.ok) {
      byId("anchorStep")?.classList.add("is-complete");
      byId("anchorStep")?.classList.remove("is-current");
    }
  } catch (error) {
    renderWorkflowStatus("Anchor failed", error.message, "error");
  } finally {
    button.disabled = false;
  }
}

function initializeReceiptComposer() {
  byId("connectWallet")?.addEventListener("click", connectWallet);
  byId("receiptComposer")?.addEventListener("submit", createCustomReceipt);
  byId("anchorReceipt")?.addEventListener("click", anchorCustomReceipt);
}

async function renderConsole(data) {
  demoData = data;
  const { receipt, deployResult, verification } = data;
  const payload = deployResult.payload ?? {};
  const contractHash = payload.contractHash ?? TESTNET_PROOF.contractHash;
  const integrity = byId("integrityState");

  setText("integrityState", verification.ok ? "Verified" : "Mismatch");
  integrity?.classList.toggle("is-risk", !verification.ok);
  setText("policyDecision", receipt.policy.decision);
  setText("riskScore", `${receipt.policy.riskScore}/100`);
  setText("toolCost", formatMotes(receipt.toolCall.costMotes));
  setText("apiStatus", "Syncing");
  setText("receiptId", receipt.receiptId);
  setText("agentName", receipt.agent.name);
  setText("agentWallet", receipt.agent.wallet);
  setText("toolName", receipt.toolCall.tool);
  setText("intentHash", receipt.task.intentHash);
  setText("policyHash", receipt.policy.policyHash);

  setHref("contractLink", explorerContract(contractHash));
  setHref("receiptTxLink", explorerTransaction(TESTNET_PROOF.receiptTransaction));
  setHref("contractExplorerLink", explorerContract(contractHash));
  setHref("installTxExplorerLink", explorerTransaction(TESTNET_PROOF.installTransaction));
  setHref("receiptTxExplorerLink", explorerTransaction(TESTNET_PROOF.receiptTransaction));
  setText("contractExplorerLabel", shortHash(contractHash, 12, 10));
  setText("installTxExplorerLabel", shortHash(TESTNET_PROOF.installTransaction, 12, 10));
  setText("receiptTxExplorerLabel", shortHash(TESTNET_PROOF.receiptTransaction, 12, 10));

  renderTimeline(receipt, deployResult);
  setText("payloadJson", JSON.stringify({ ...payload, proof: TESTNET_PROOF }, null, 2));

  try {
    const record = await persistReceipt(receipt);
    setText("apiStatus", "Persisted");
    renderApiMessage("Receipt persisted", `Stored as ${shortHash(record.receiptId, 10, 6)} with ${record.anchor.status} Casper proof state.`, true);
  } catch (error) {
    setText("apiStatus", "Read only");
    renderApiMessage("Console loaded in read-only mode", `${error.message} The bundled receipt and explorer proof remain available.`, false);
  }
}

function initializeCopyButton() {
  const button = byId("copyPayload");
  if (!button) return;
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(byId("payloadJson").textContent);
      button.textContent = "Copied";
    } catch {
      button.textContent = "Copy failed";
    }
    window.setTimeout(() => { button.textContent = "Copy JSON"; }, 1400);
  });
}

function renderVerifierMessage(result) {
  const state = byId("verifierState");
  if (!state) return;
  state.textContent = result.state;
  state.classList.toggle("is-risk", result.ok === false);
  state.classList.toggle("is-ok", result.ok === true);
  byId("verifierState")?.closest(".verifier-result")?.classList.toggle("is-risk", result.ok === false);
  setText("verifierSummary", result.summary);
  setText("verifierExpected", result.expected ?? "-");
  setText("verifierActual", result.actual ?? "-");
  setText("verifierAnchor", result.anchor ?? "-");
}

function loadReceiptIntoVerifier(receipt) {
  byId("receiptInput").value = JSON.stringify(receipt, null, 2);
  renderVerifierMessage({
    state: "Ready to verify",
    ok: true,
    summary: "The sample receipt is loaded. Verify it, then simulate a changed policy field to see tamper detection.",
    expected: receipt.receiptHash,
    actual: "Not computed yet",
    anchor: "Not checked yet"
  });
}

function parseReceiptInput() {
  const parsed = JSON.parse(byId("receiptInput").value);
  return parsed.receipt ?? parsed;
}

async function verifyReceiptFromInput() {
  try {
    const receipt = parseReceiptInput();
    const verification = await verifyReceiptObject(receipt);
    const anchorMatchesDemo = receipt.receiptId === TESTNET_PROOF.receiptId && verification.actual === TESTNET_PROOF.receiptHash;
    renderVerifierMessage({
      state: verification.ok ? "Receipt verified" : "Tampering detected",
      ok: verification.ok,
      summary: verification.ok
        ? anchorMatchesDemo ? "The canonical hash matches the receipt and the bundled Casper Testnet proof." : "The receipt is internally consistent, but it does not match the bundled Testnet sample proof."
        : "At least one receipt field changed after the recorded hash was created.",
      expected: verification.expected,
      actual: verification.actual,
      anchor: anchorMatchesDemo ? `Matches ${shortHash(TESTNET_PROOF.receiptTransaction, 12, 10)}` : "No bundled proof match"
    });
  } catch (error) {
    renderVerifierMessage({ state: "Invalid JSON", ok: false, summary: error.message, expected: "-", actual: "-", anchor: "-" });
  }
}

function tamperReceiptInput() {
  try {
    const receipt = parseReceiptInput();
    receipt.policy = receipt.policy ?? {};
    receipt.policy.riskScore = Number(receipt.policy.riskScore ?? 0) + 41;
    receipt.policy.explanation = "Changed locally after the receipt hash was created.";
    byId("receiptInput").value = JSON.stringify(receipt, null, 2);
    renderVerifierMessage({
      state: "Change staged",
      ok: false,
      summary: "The policy data now differs from the signed receipt body. Select Verify receipt to expose the mismatch.",
      expected: receipt.receiptHash,
      actual: "Run verification",
      anchor: "Pending verification"
    });
  } catch (error) {
    renderVerifierMessage({ state: "Invalid JSON", ok: false, summary: error.message, expected: "-", actual: "-", anchor: "-" });
  }
}

function initializeVerifier() {
  setHref("verifierProofLink", explorerTransaction(TESTNET_PROOF.receiptTransaction));
  byId("verifyReceipt")?.addEventListener("click", verifyReceiptFromInput);
  byId("tamperReceipt")?.addEventListener("click", tamperReceiptInput);
  byId("loadDemoReceipt")?.addEventListener("click", () => demoData?.receipt && loadReceiptIntoVerifier(demoData.receipt));
  byId("receiptFile")?.addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    byId("receiptInput").value = await file.text();
    await verifyReceiptFromInput();
  });
}

async function initializeProductPage() {
  const [configResult, demoResult] = await Promise.allSettled([loadApiConfig(), loadDemo()]);
  if (configResult.status === "fulfilled") {
    productConfig = configResult.value;
    applyApiConfig(configResult.value);
  }

  if (demoResult.status === "rejected") {
    if (page === "demo") {
      setText("integrityState", "Unavailable");
      setText("apiStatus", "Offline");
      setText("payloadJson", demoResult.reason.message);
      renderApiMessage("Demo receipt unavailable", demoResult.reason.message, false);
    } else if (page === "verify") {
      renderVerifierMessage({ state: "Unavailable", ok: false, summary: demoResult.reason.message, expected: "-", actual: "-", anchor: "-" });
    } else {
      renderWorkflowStatus("Receipt template unavailable", demoResult.reason.message, "error");
    }
    return;
  }

  demoData = demoResult.value;
  if (page === "console") {
    if (productConfig) await initializeCsprClick(productConfig);
  }
  if (page === "demo") {
    await renderConsole(demoData);
  }
  if (page === "verify") {
    setHref("verifierProofLink", explorerTransaction(TESTNET_PROOF.receiptTransaction));
    loadReceiptIntoVerifier(demoData.receipt);
  }
}

initializeNavigation();

if (page === "console") {
  initializeReceiptComposer();
  initializeProductPage();
}

if (page === "demo") {
  initializeCopyButton();
  initializeProductPage();
}

if (page === "verify") {
  initializeVerifier();
  initializeProductPage();
}
