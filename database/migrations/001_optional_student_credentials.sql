-- Preserve existing credentials while allowing students without a login.
BEGIN;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
COMMIT;
