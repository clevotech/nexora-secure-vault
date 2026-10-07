# NSV1 Android Interoperability

Container fields are encoded using little-endian unsigned 32-bit lengths.

Header:
- 4 bytes: header length
- UTF-8 JSON header
- magic: NSV1
- version: 1
- algorithm: AES-256-GCM
- kdf: Argon2id
- salt: 32-character hexadecimal string representing 16 random bytes
- chunkSize: 1048576
- originalName: original filename metadata
- originalSize: original plaintext size in bytes
- createdAt: UTC ISO-8601 timestamp
- operationId: 32-character hexadecimal operation identifier

Each chunk:
- 4 bytes sequence number
- 1 byte nonce length (12)
- 12 byte random nonce
- 4 bytes ciphertext length
- ciphertext including the 16-byte GCM authentication tag

AAD is the exact UTF-8 header byte sequence followed by the 4-byte little-endian sequence number.

A future NSV2 version may change algorithms or encoding without silently changing NSV1 behavior.
