-- Create handover_emissions table
CREATE TABLE "handover_emissions" (
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "description" TEXT,

    CONSTRAINT "handover_emissions_pkey" PRIMARY KEY ("uuid")
);

-- Create index on created_at
CREATE INDEX "handover_emissions_created_at_idx" ON "handover_emissions"("created_at" DESC);

-- Add emission columns to payments_jobs table
ALTER TABLE "payments_jobs" ADD COLUMN "emission_uuid" UUID;
ALTER TABLE "payments_jobs" ADD COLUMN "emission_date" TIMESTAMP(3);

-- Create index on emission_uuid
CREATE INDEX "idx_payments_jobs_emission_uuid" ON "payments_jobs"("emission_uuid");

-- Add foreign key constraint to handover_emissions
ALTER TABLE "payments_jobs" ADD CONSTRAINT "payments_jobs_emission_uuid_fkey" 
  FOREIGN KEY ("emission_uuid") REFERENCES "handover_emissions"("uuid") 
  ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Create trigger to prevent updates to emitted records
CREATE OR REPLACE FUNCTION prevent_emitted_record_updates()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."emission_uuid" IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot update emitted handover record (emission_uuid: %)', OLD."emission_uuid";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_emitted_payments_jobs_update
BEFORE UPDATE ON "payments_jobs"
FOR EACH ROW
EXECUTE FUNCTION prevent_emitted_record_updates();

-- Create trigger to prevent deletion of emitted records
CREATE OR REPLACE FUNCTION prevent_emitted_record_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."emission_uuid" IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot delete emitted handover record (emission_uuid: %)', OLD."emission_uuid";
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_emitted_payments_jobs_delete
BEFORE DELETE ON "payments_jobs"
FOR EACH ROW
EXECUTE FUNCTION prevent_emitted_record_deletion();

-- Create trigger to prevent deletion of projects with emitted records
CREATE OR REPLACE FUNCTION prevent_project_delete_with_emitted_records()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "payments_jobs" 
    WHERE "project_uuid" = OLD."project_uuid" AND "emission_uuid" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Cannot delete project with emitted handover records';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_project_delete_with_emitted_jobs
BEFORE DELETE ON "projects"
FOR EACH ROW
EXECUTE FUNCTION prevent_project_delete_with_emitted_records();

-- Create trigger to prevent deletion of jobs with emitted records
CREATE OR REPLACE FUNCTION prevent_job_delete_with_emitted_records()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "payments_jobs" 
    WHERE "job_uuid" = OLD."job_uuid" AND "emission_uuid" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Cannot delete job with emitted handover records';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_job_delete_with_emitted_distributions
BEFORE DELETE ON "jobs"
FOR EACH ROW
EXECUTE FUNCTION prevent_job_delete_with_emitted_records();
