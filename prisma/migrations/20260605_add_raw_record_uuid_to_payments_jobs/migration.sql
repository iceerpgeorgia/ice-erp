-- Add raw_record_uuid to payments_jobs to link distributions to specific bank transactions
ALTER TABLE "payments_jobs" ADD COLUMN "raw_record_uuid" UUID;

-- Create index for performance
CREATE INDEX "idx_payments_jobs_raw_record_uuid" ON "payments_jobs"("raw_record_uuid");

-- Add comment
COMMENT ON COLUMN "payments_jobs"."raw_record_uuid" IS 'Optional link to specific bank transaction record (consolidated_bank_accounts.uuid). When set, this distribution applies only to that specific transaction, not all transactions with the same payment_id.';
