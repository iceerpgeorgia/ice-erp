-- Allow emitted payments_jobs snapshots to coexist with live non-emitted distributions.
-- Uniqueness should apply only to current editable rows (emission_uuid IS NULL).

DROP INDEX IF EXISTS "payments_jobs_unique_batch_partition";
DROP INDEX IF EXISTS "payments_jobs_unique_raw_record";
DROP INDEX IF EXISTS "payments_jobs_unique_legacy_null";

CREATE UNIQUE INDEX "payments_jobs_unique_batch_partition"
  ON "payments_jobs" ("payment_uuid", "job_uuid", "project_uuid", "batch_partition_uuid")
  WHERE "batch_partition_uuid" IS NOT NULL AND "emission_uuid" IS NULL;

CREATE UNIQUE INDEX "payments_jobs_unique_raw_record"
  ON "payments_jobs" ("payment_uuid", "job_uuid", "project_uuid", "raw_record_uuid")
  WHERE "batch_partition_uuid" IS NULL AND "raw_record_uuid" IS NOT NULL AND "emission_uuid" IS NULL;

CREATE UNIQUE INDEX "payments_jobs_unique_legacy_null"
  ON "payments_jobs" ("payment_uuid", "job_uuid", "project_uuid")
  WHERE "batch_partition_uuid" IS NULL AND "raw_record_uuid" IS NULL AND "emission_uuid" IS NULL;