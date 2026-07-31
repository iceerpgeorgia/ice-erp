-- Add service_state column to jobs table
ALTER TABLE "jobs" ADD COLUMN "service_state" TEXT NOT NULL DEFAULT 'Active';

-- Add check constraint for valid enum values
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_service_state_check" CHECK ("service_state" IN ('Active', 'Conversion', 'Free', 'Others', 'Recovery'));
