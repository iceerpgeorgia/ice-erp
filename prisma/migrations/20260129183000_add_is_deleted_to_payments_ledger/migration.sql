ALTER TABLE "payments_ledger"
  ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS "payments_ledger_is_deleted_idx" ON "payments_ledger"("is_deleted");
