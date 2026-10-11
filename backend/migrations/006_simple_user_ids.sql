-- Keep generated employee IDs compact and easy to type while retaining uniqueness.
-- Eight hexadecimal characters provide a large identifier space; the UNIQUE constraint
-- remains the final collision guard. Existing twelve-character IDs continue to work.
ALTER TABLE nexora_organization_members
  ALTER COLUMN user_code SET DEFAULT ('NXU-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)));
