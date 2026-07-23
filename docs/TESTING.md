# Testing Playbook

This playbook is intentionally step-by-step and suitable for final review.

## Live UI test

1. Open the Railway production URL.
2. Review the live verification console.
3. Confirm the receipt integrity state is `Verified`.
4. Confirm the API metric says `Persisted`.
5. Open `/health` in a new tab and confirm `ok: true`.
6. Open the contract registry link in the Testnet explorer block.
7. Open the install transaction link.
8. Open the receipt transaction link.
9. Scroll to the Receipt verifier.
10. Click `Verify receipt`.
11. Confirm the result is `Valid`.
12. Click `Simulate tamper`.
13. Click `Verify receipt`.
14. Confirm the result changes to `Tampered`.
15. Click `Load demo`.
16. Click `Verify receipt` again.
17. Confirm the receipt returns to `Valid`.
18. In **Create your own proof**, connect a Casper Testnet wallet through CSPR.click.
19. Change the agent intent and click `Create receipt`.
20. Click `Sign and anchor`, approve the transaction, and wait for its transaction hash.
21. Confirm the status reports either `Receipt anchored and verified` or a clearly labeled pending indexer state.
22. Open the new receipt transaction from the proof ledger.

## Local test

```bash
npm install
npm run check
npm test
npm run build
npm run dev
```

Open `http://localhost:4173`.

Also check the local API:

```bash
curl http://localhost:4173/health
curl http://localhost:4173/api/receipts
```

## Contract build test

```bash
rustup toolchain install nightly
rustup target add wasm32-unknown-unknown --toolchain nightly
cargo +nightly build --release --target wasm32-unknown-unknown --manifest-path contracts/agent-blackbox/Cargo.toml
```

## Expected Testnet values

```text
Contract hash:
hash-11c55f283a39e492201bf3f4f7e9b76436599b364c0a0fbc385d46fb3d1e5fb8

Contract package hash:
hash-a738b2bdb89a6b65c71c2ae11f5b688248f38abbf463b7d487ddc2c0981a7abb

Install transaction:
527101b5f588320530f091fdc390c852b9784df486722fae97fa518906892d0c

Receipt submit transaction:
b59446b16e1b17baa4081ee9152b7f4ac42c48fb6ddb3d9e1b0f6e22a7dd36ad
```
