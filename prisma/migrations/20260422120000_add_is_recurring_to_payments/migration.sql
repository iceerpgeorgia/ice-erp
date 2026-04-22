-- Add is_recurring column to payments table
-- When true, a monthly cron job (run on the last day of each month) creates a
-- payments_ledger entry on the last day of the current month with accrual/order
-- equal to the SUM of all (accrual+order) ledger entries from the previous
-- calendar month. If a recurring entry already exists for the current month
-- the cron does nothing.
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "is_recurring" BOOLEAN NOT NULL DEFAULT false;

-- Partial index for cheap lookups by the cron job.
CREATE INDEX IF NOT EXISTS "payments_is_recurring_idx" ON "payments"("is_recurring") WHERE "is_recurring" = true;
