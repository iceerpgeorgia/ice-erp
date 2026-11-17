-- jobs.insider_uuid is removed; insider is derived from project bindings (job_projects -> projects).
DROP INDEX IF EXISTS "idx_jobs_insider_uuid";
ALTER TABLE "jobs" DROP COLUMN IF EXISTS "insider_uuid";
