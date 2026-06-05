-- Add batch_partition_uuid column to payments_jobs for tracking batch partition distributions
ALTER TABLE "payments_jobs" ADD COLUMN "batch_partition_uuid" UUID;

-- Create index for batch_partition_uuid lookups
CREATE INDEX "idx_payments_jobs_batch_partition_uuid" ON "payments_jobs"("batch_partition_uuid");

-- Add foreign key constraint to bank_transaction_batches
ALTER TABLE "payments_jobs" 
  ADD CONSTRAINT "payments_jobs_batch_partition_uuid_fkey" 
  FOREIGN KEY ("batch_partition_uuid") 
  REFERENCES "bank_transaction_batches"("uuid") 
  ON DELETE NO ACTION 
  ON UPDATE NO ACTION;

-- Add comment explaining the column purpose
COMMENT ON COLUMN "payments_jobs"."batch_partition_uuid" IS 'Optional link to specific batch partition (bank_transaction_batches.uuid) when raw transaction is split into batches. Allows autonomous distribution per partition.';
COMMENT ON COLUMN "payments_jobs"."raw_record_uuid" IS 'Optional link to specific bank transaction record (consolidated_bank_accounts.record_uuid). Used for non-batched transactions.';
