import { createReceipt, verifyReceipt } from "../core/receipt.mjs";
import { createCasperBlackboxClient } from "../casper/blackboxClient.mjs";

export { createReceipt, verifyReceipt, createCasperBlackboxClient };

export function createAgentBlackbox(options = {}) {
  const casper = createCasperBlackboxClient(options.casper);

  return {
    create(input) {
      return createReceipt({
        ...input,
        agent: input.agent ?? options.agent,
        policy: input.policy ?? options.policy,
        chain: input.chain ?? options.chain,
        evidence: input.evidence ?? []
      });
    },

    verify(receipt) {
      return verifyReceipt(receipt);
    },

    prepare(receipt) {
      return casper.prepareSubmitReceipt(receipt);
    },

    buildTransaction(receipt, publicKey) {
      return casper.buildUnsignedSubmitTransaction(receipt, publicKey);
    },

    confirm(transactionHash, receipt) {
      return casper.verifyReceiptTransaction(transactionHash, receipt);
    }
  };
}
