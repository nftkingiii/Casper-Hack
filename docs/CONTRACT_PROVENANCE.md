# Contract Provenance

The Agent Blackbox registry is deployed on Casper Testnet.

```text
Contract hash:
hash-11c55f283a39e492201bf3f4f7e9b76436599b364c0a0fbc385d46fb3d1e5fb8

Contract package hash:
hash-a738b2bdb89a6b65c71c2ae11f5b688248f38abbf463b7d487ddc2c0981a7abb

Install transaction:
527101b5f588320530f091fdc390c852b9784df486722fae97fa518906892d0c
```

The public contract source is in `contracts/agent-blackbox/src/lib.rs`. The deployment source lineage is preserved in Git, and the contract is reproducibly built with:

```bash
rustup toolchain install nightly
rustup target add wasm32-unknown-unknown --toolchain nightly
cargo +nightly build --release --target wasm32-unknown-unknown --manifest-path contracts/agent-blackbox/Cargo.toml
```

The current local release artifact has SHA-256:

```text
44e570b87c3f4f59edbdd874d930ace9b87f7c5a3f31bb0013e0857a89e6a8bf
```

This artifact hash documents the reproducible local build. It is not presented as explorer-level bytecode/source verification because Casper Testnet does not expose the same source-verification workflow used by EVM explorers.
