DROP INDEX IF EXISTS "idx_jobs_insider_uuid";
ALTER TABLE "jobs" DROP COLUMN IF EXISTS "insider_uuid";
