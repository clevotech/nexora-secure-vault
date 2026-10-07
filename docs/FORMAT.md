# Nexora Encrypted Container v1

Suggested extension: `.nsv`

Header fields:
- magic: `NSV1`
- version
- algorithm identifier
- KDF identifier
- salt
- chunk size
- original filename metadata (authenticated, not trusted until authentication succeeds)
- original file size
- created timestamp
- encryption operation ID

Each chunk contains:
- sequence number
- nonce
- ciphertext
- authentication tag

All header metadata and chunk sequence information are authenticated as associated data.

The format is versioned so future cryptographic migrations can be implemented without ambiguity.


### Empty files
Empty files still contain one authenticated AES-256-GCM record (sequence 0) containing zero plaintext bytes. This authenticates the header and password even when the original file has no data.
