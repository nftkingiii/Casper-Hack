# Testing Playbook

This playbook is intentionally step-by-step and suitable for final review.

## Live UI test

1. Open the Railway production URL.
2. Open **Console** and connect a Casper Testnet wallet through CSPR.click.
3. Change the agent intent and select `Create receipt`.
4. Confirm the current receipt panel displays a receipt ID and SHA-256 hash.
5. Select `Sign and anchor`, approve the transaction, and wait for its transaction hash.
6. Confirm the status reports either `Receipt anchored and verified` or a clearly labeled pending indexer state.
7. Open the new transaction from the current receipt panel.
8. Open **Demo** from the navigation.
9. Confirm receipt integrity is `Verified` and the API metric says `Persisted`.
10. Open the contract registry, install transaction, and receipt transaction links.
11. Open **Verify** and select `Verify receipt`.
12. Confirm the result is `Receipt verified`.
13. Select `Simulate tamper`, then `Verify receipt`.
14. Confirm the result changes to `Tampering detected`.
15. Select `Reset demo`, verify again, and confirm the receipt returns to `Receipt verified`.
16. Open `/health` in a new tab and confirm `ok: true`.

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
