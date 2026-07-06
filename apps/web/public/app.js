const TESTNET_PROOF = {
  contractHash: "hash-11c55f283a39e492201bf3f4f7e9b76436599b364c0a0fbc385d46fb3d1e5fb8",
  contractPackageHash: "hash-a738b2bdb89a6b65c71c2ae11f5b688248f38abbf463b7d487ddc2c0981a7abb",
  installTransaction: "527101b5f588320530f091fdc390c852b9784df486722fae97fa518906892d0c",
  receiptTransaction: "b59446b16e1b17baa4081ee9152b7f4ac42c48fb6ddb3d9e1b0f6e22a7dd36ad"
};

async function loadDemo() {
  const response = await fetch("/demo-receipt.json");
  if (!response.ok) {
    throw new Error("Run `npm run demo` to generate the demo receipt.");
  }

  return response.json();
}

function text(id, value) {
  document.getElementById(id).textContent = value;
}

function setHref(id, value) {
  const element = document.getElementById(id);
  element.href = value;
  element.setAttribute("aria-disabled", "false");
}

function formatMotes(value) {
  const cspr = Number(value) / 1_000_000_000;
  return `${cspr.toFixed(2)} CSPR`;
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

function renderTimeline(receipt, deployResult) {
  const payload = deployResult.payload ?? {};
  const items = [
    {
      label: "Intent captured",
      body: receipt.task.intent,
      time: new Date(receipt.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    },
    {
      label: "Policy checked",
      body: `${receipt.policy.decision} with risk score ${receipt.policy.riskScore}. ${receipt.policy.explanation}`,
      time: "policy"
    },
    {
      label: "Tool called",
      body: `${receipt.toolCall.method} ${receipt.toolCall.target}; request and response hashes recorded.`,
      time: "tool"
    },
    {
      label: "Receipt anchored",
      body: `${payload.entryPoint ?? "submit_receipt"} on ${payload.network ?? "casper-test"}; transaction ${shortHash(TESTNET_PROOF.receiptTransaction, 12, 10)}.`,
      time: "Casper"
    }
  ];

  const list = document.getElementById("timeline");
  list.innerHTML = items
    .map(
      (item, index) => `
        <li>
          <span class="step-index">${String(index + 1).padStart(2, "0")}</span>
          <time>${escapeHtml(item.time)}</time>
          <div>
            <strong>${escapeHtml(item.label)}</strong>
            <p>${escapeHtml(item.body)}</p>
          </div>
        </li>
      `
    )
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function render(data) {
  const { receipt, deployResult, verification } = data;
  const payload = deployResult.payload ?? {};
  const integrity = document.getElementById("integrityState");

  text("integrityState", verification.ok ? "Verified" : "Mismatch");
  integrity.classList.toggle("is-risk", !verification.ok);
  text("receiptHash", receipt.receiptHash);
  text("policyDecision", receipt.policy.decision);
  text("riskScore", `${receipt.policy.riskScore}/100`);
  text("agentName", receipt.agent.name);
  text("toolCost", formatMotes(receipt.toolCall.costMotes));
  text("deployMode", deployResult.mode);
  text("toolName", receipt.toolCall.tool);
  text("receiptId", receipt.receiptId);
  text("agentWallet", receipt.agent.wallet);
  text("intentHash", receipt.task.intentHash);
  text("policyHash", receipt.policy.policyHash);
  text("contractHash", payload.contractHash ?? TESTNET_PROOF.contractHash);

  setHref("contractLink", explorerContract(payload.contractHash ?? TESTNET_PROOF.contractHash));
  setHref("receiptTxLink", explorerTransaction(TESTNET_PROOF.receiptTransaction));
  setHref("contractExplorerLink", explorerContract(payload.contractHash ?? TESTNET_PROOF.contractHash));
  setHref("installTxExplorerLink", explorerTransaction(TESTNET_PROOF.installTransaction));
  setHref("receiptTxExplorerLink", explorerTransaction(TESTNET_PROOF.receiptTransaction));
  text("contractExplorerLabel", shortHash(payload.contractHash ?? TESTNET_PROOF.contractHash, 12, 10));
  text("installTxExplorerLabel", shortHash(TESTNET_PROOF.installTransaction, 12, 10));
  text("receiptTxExplorerLabel", shortHash(TESTNET_PROOF.receiptTransaction, 12, 10));

  renderTimeline(receipt, deployResult);
  text("payloadJson", JSON.stringify({
    ...payload,
    proof: TESTNET_PROOF
  }, null, 2));

}

document.getElementById("copyPayload").addEventListener("click", async () => {
  const payload = document.getElementById("payloadJson").textContent;
  await navigator.clipboard.writeText(payload);
  document.getElementById("copyPayload").textContent = "Copied";
  window.setTimeout(() => {
    document.getElementById("copyPayload").textContent = "Copy JSON";
  }, 1200);
});

loadDemo()
  .then(render)
  .catch((error) => {
    const integrity = document.getElementById("integrityState");
    text("integrityState", "Missing demo");
    integrity.classList.add("is-risk");
    text("receiptHash", error.message);
    text("payloadJson", error.stack ?? error.message);
  });
