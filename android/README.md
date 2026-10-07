# Nexora Secure Vault — Android

The Android client must read and write the same NSV1 container as the web and Windows clients.

## Security requirements
- Argon2id derives a 32-byte key from the user password and per-container random salt.
- AES-256-GCM authenticates every encrypted chunk.
- Android Keystore may protect locally stored device keys, but it must not replace the NSV1 password protocol.
- Never log passwords, plaintext file contents, raw keys, or recovery secrets.

## Planned implementation
- Kotlin + Jetpack Compose UI
- Android Storage Access Framework for file selection
- Streaming container reader/writer
- Argon2id via a vetted, maintained cryptographic provider
- AES-GCM through Android's vetted cryptographic APIs
- Local audit database containing operation metadata only
- Biometric/device-credential gate for optional local vault access

The Android implementation is intentionally kept protocol-compatible rather than creating a separate encryption format.
