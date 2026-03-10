BEGIN;

ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS insider_uuid uuid;
CREATE INDEX IF NOT EXISTS idx_bank_accounts_insider_uuid ON bank_accounts(insider_uuid);

COMMIT;
