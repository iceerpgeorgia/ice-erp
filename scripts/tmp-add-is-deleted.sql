ALTER TABLE payments_ledger
  ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;

UPDATE payments_ledger
SET is_deleted = false
WHERE is_deleted IS NULL;

CREATE INDEX IF NOT EXISTS payments_ledger_is_deleted_idx
  ON payments_ledger(is_deleted);
