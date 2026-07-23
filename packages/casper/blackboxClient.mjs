import { createHash } from "node:crypto";
import sdk from "casper-js-sdk";
import { toContractRuntimeArgs } from "../core/receipt.mjs";

const { Args, CLValue, ContractCallBuilder, PublicKey } = sdk;

export function createCasperBlackboxClient(config = {}) {
  return {
    network: config.network ?? "casper-test",
    nodeUrl: config.nodeUrl ?? "https://node.testnet.casper.network/rpc",
    csprCloudUrl: config.csprCloudUrl ?? "https://api.testnet.cspr.cloud",
    contractHash: config.contractHash ?? null,
    apiKey: config.apiKey ?? null,
    paymentAmount: config.paymentAmount ?? "5000000000",

    prepareSubmitReceipt(receipt) {
      return {
        network: this.network,
        nodeUrl: this.nodeUrl,
        contractHash: this.contractHash,
        entryPoint: "submit_receipt",
        runtimeArgs: toContractRuntimeArgs(receipt)
      };
    },

    async submitReceipt(receipt) {
      const payload = this.prepareSubmitReceipt(receipt);

      if (!this.contractHash) {
        return createMockDeployResult(payload);
      }

      return {
        mode: "prepared",
        message: "Connect Casper SDK, CSPR.click, or Casper CLI signing to send this deploy.",
        payload
      };
    },

    async fetchReceiptEvents() {
      if (!this.apiKey) {
        return {
          mode: "offline",
          events: [],
          message: "Set CSPR_CLOUD_API_KEY to query indexed Casper events."
        };
      }

      return {
        mode: "prepared",
        events: [],
        message: "CSPR.cloud event query adapter is ready for contract-specific endpoint wiring."
      };
    },

    buildUnsignedSubmitTransaction(receipt, publicKeyHex) {
      if (!this.contractHash) throw new Error("A deployed contract hash is required.");
      if (!publicKeyHex) throw new Error("Connect a Casper account before creating a transaction.");

      const args = toContractRuntimeArgs(receipt);
      const runtimeArgs = Args.fromMap(Object.fromEntries(
        Object.entries(args).map(([key, value]) => [key, CLValue.newCLString(String(value))])
      ));

      const transaction = new ContractCallBuilder()
        .from(PublicKey.fromHex(publicKeyHex))
        .chainName(this.network)
        .payment(Number(this.paymentAmount))
        .byHash(this.contractHash.replace(/^hash-/, ""))
        .entryPoint("submit_receipt")
        .runtimeArgs(runtimeArgs)
        .build();

      return {
        transaction: {
          transaction: {
            Version1: transaction.toJSON()
          }
        },
        transactionHash: transaction.hash?.toHex?.() ?? null,
        payload: this.prepareSubmitReceipt(receipt)
      };
    },

    async submitSignedTransaction(transaction) {
      const signedTransaction = transaction?.Version1
        ? transaction
        : transaction?.transaction;

      if (!signedTransaction?.Version1) {
        throw new Error("A signed Casper TransactionV1 is required.");
      }
      if (!signedTransaction.Version1.approvals?.length) {
        throw new Error("The Casper transaction does not contain a wallet approval.");
      }

      const response = await fetch(this.nodeUrl, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "account_put_transaction",
          params: { transaction: signedTransaction }
        })
      });

      if (!response.ok) {
        throw new Error(`Casper RPC returned HTTP ${response.status}.`);
      }

      const body = await response.json();
      if (body.error) {
        throw new Error(body.error.data ?? body.error.message ?? "Casper rejected the transaction.");
      }

      const transactionHash = body.result?.transaction_hash?.Version1;
      if (!transactionHash) {
        throw new Error("Casper RPC did not return a transaction hash.");
      }

      return { transactionHash, rpcResult: body.result };
    },

    async verifyReceiptTransaction(transactionHash, receipt) {
      if (!transactionHash) throw new Error("A Casper transaction hash is required.");
      if (!this.apiKey) {
        return {
          ok: false,
          indexed: false,
          status: "awaiting-indexer",
          source: "cspr.cloud",
          message: "Set CSPR_CLOUD_API_KEY to enable indexed receipt read-back."
        };
      }

      const response = await fetch(`${this.csprCloudUrl}/deploys/${transactionHash}`, {
        headers: {
          accept: "application/json",
          authorization: this.apiKey
        }
      });

      if (response.status === 404) {
        return {
          ok: false,
          indexed: false,
          status: "pending",
          source: "cspr.cloud",
          message: "The transaction has not been indexed yet."
        };
      }

      if (!response.ok) throw new Error(`CSPR.cloud returned ${response.status}.`);

      const body = await response.json();
      const deploy = body.data ?? body;
      const args = deploy.args ?? {};
      const parsed = (name) => args[name]?.parsed ?? args[name];
      const contractMatches =
        String(deploy.contract_hash ?? "").toLowerCase() ===
        this.contractHash.replace(/^hash-/, "").toLowerCase();
      const receiptMatches =
        parsed("receipt_id") === receipt.receiptId &&
        parsed("receipt_hash") === receipt.receiptHash;
      const processed = deploy.status === "processed" && !deploy.error_message;

      return {
        ok: processed && contractMatches && receiptMatches,
        indexed: true,
        status: deploy.status,
        source: "cspr.cloud",
        contractMatches,
        receiptMatches,
        errorMessage: deploy.error_message ?? null,
        blockHash: deploy.block_hash ?? null,
        blockHeight: deploy.block_height ?? null,
        callerPublicKey: deploy.caller_public_key ?? null,
        transactionHash,
        message: processed && contractMatches && receiptMatches
          ? "CSPR.cloud confirms the receipt ID and hash were processed by the Agent Blackbox contract."
          : "The indexed transaction does not yet match every expected receipt proof field."
      };
    }
  };
}

function createMockDeployResult(payload) {
  const hash = createHash("sha256")
    .update(JSON.stringify(payload.runtimeArgs))
    .digest("hex");

  return {
    mode: "mock-testnet",
    deployHash: `mock-${hash.slice(0, 32)}`,
    payload,
    explorerUrl: null,
    message: "No contract hash configured; generated a deterministic mock deploy hash for local demo."
  };
}
