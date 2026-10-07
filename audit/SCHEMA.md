# Audit Record

Recommended fields:

- operation_id
- operation: encrypt | decrypt | verify
- status: success | failure
- timestamp_utc
- file_name
- file_size
- file_hash
- algorithm
- kdf
- container_version
- key_id
- device_id (optional, privacy-sensitive)
- error_code (on failure)
- previous_record_hash
- record_hash

Never store the password, raw encryption key, private key, recovery phrase or plaintext file contents.
