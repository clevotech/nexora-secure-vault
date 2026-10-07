# Security Policy

Never commit passwords, private keys, recovery secrets, test credentials or real user files.

Report suspected vulnerabilities privately to the repository owner rather than publishing exploit details before a fix is available.

Security-sensitive changes require tests and review. Cryptographic primitives should come from established, maintained libraries; do not implement AES, Argon2 or elliptic-curve primitives from scratch.
