-- Adjust payments_jobs uniqueness to allow per-batch/per-raw-record distributions

-- Drop legacy unique index (payment_uuid, job_uuid, project_uuid)
DROP INDEX IF EXISTS "payments_jobs_payment_uuid_job_uuid_project_uuid_key";

-- Unique per batch partition (batched transactions)
CREATE UNIQUE INDEX "payments_jobs_unique_batch_partition"
  ON "payments_jobs" ("payment_uuid", "job_uuid", "project_uuid", "batch_partition_uuid")
  WHERE "batch_partition_uuid" IS NOT NULL;

-- Unique per raw record (non-batched transactions)
CREATE UNIQUE INDEX "payments_jobs_unique_raw_record"
  ON "payments_jobs" ("payment_uuid", "job_uuid", "project_uuid", "raw_record_uuid")
  WHERE "batch_partition_uuid" IS NULL AND "raw_record_uuid" IS NOT NULL;

-- Legacy uniqueness for rows without batch or raw record
CREATE UNIQUE INDEX "payments_jobs_unique_legacy_null"
  ON "payments_jobs" ("payment_uuid", "job_uuid", "project_uuid")
  WHERE "batch_partition_uuid" IS NULL AND "raw_record_uuid" IS NULL;
