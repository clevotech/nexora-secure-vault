# Nexora Secure Vault

Secure cross-platform file encryption and decryption platform.

## Security model
- AES-256-GCM authenticated encryption
- Argon2id password-based key derivation
- Random salt and nonce per encryption
- Streaming/chunked file processing design
- Integrity verification
- No plaintext passwords or encryption keys in audit logs

## Planned clients
- Web: React/TypeScript
- Windows: Tauri desktop client
- Android: Kotlin
- Shared protocol/specification

## Important
This project is designed for authorized encryption/decryption of files. It does not bypass or crack encryption.

## Status
Foundation initialized. See `docs/ARCHITECTURE.md` and `docs/FORMAT.md`.
