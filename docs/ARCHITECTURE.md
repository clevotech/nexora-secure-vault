# Architecture

Nexora Secure Vault uses one interoperable encrypted-container specification with platform-specific clients.

## Layers
1. **Crypto protocol** — defines algorithms, parameters, authenticated metadata and container versioning.
2. **Core operations** — encrypt, decrypt, hash, verify and audit.
3. **Clients** — web, Windows and Android user interfaces.
4. **Audit** — local tamper-evident operation history. Secrets are never logged.

## Cryptography
Default password mode:
- KDF: Argon2id
- Cipher: AES-256-GCM
- Random salt: 16 bytes minimum
- Random nonce/IV: 12 bytes per encrypted chunk
- Authentication tag: supplied by AES-GCM

A future public-key mode can use an established envelope-encryption design rather than encrypting large files directly with RSA/ECC.

## Threat model
The software protects file confidentiality and integrity when the user's password/key remains secret. It does not recover a forgotten password and does not weaken an existing encryption scheme.

## Audit integrity
Each audit entry contains a canonical record hash and previous-entry hash. The audit chain must be verified before being considered trustworthy.
