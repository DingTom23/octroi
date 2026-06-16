# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) once it reaches 1.0.

## [Unreleased]

### Changed

- Migrated the project from the Arc testnet (EVM) to **Stellar**. The shared
  protocol types, the receipt signer/verifier, the publisher middleware, the
  crawler SDK, the facilitator, and the API gateway were converted to Stellar:
  - Settlement model is x402 over Soroban authorization entries plus MPP
    sessions, replacing EIP-3009 / Circle Gateway batching.
  - Receipts are signed with Ed25519 over a canonical JSON form, replacing
    keccak256 + ECDSA.
  - USDC uses Stellar's 7-decimal atomic representation; addresses are Stellar
    G-addresses; assets are `CODE:ISSUER` identifiers.
  - API-gateway authentication is an API-key bearer token, replacing SIWE.
  - Reputation is provisional and computed off-chain from settlement history.

### Removed

- All Arc/EVM artifacts: EIP-3009 types, the Circle Gateway facilitator,
  viem/Privy/SIWE, ERC-8004 reputation reads, and the Gateway smoke tests.

### Pending

- The live Soroban settlement path (signing authorization entries, submitting
  the USDC SAC `transfer`, and MPP sessions) is the active v0 build. Modules that
  depend on it expose their interfaces and fail fast until it lands.
