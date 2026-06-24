-- ============================================================================
-- PRODUCTION MIGRATION: Add Handover Emissions Support
-- ============================================================================
-- This migration adds support for handover emissions, which allows locking
-- distributions after they've been exported to the handover document.
-- 
-- WARNING: This migration should only be run once. Run in Supabase SQL Editor.
-- ============================================================================

-- Step 1: Create handover_emissions table (if not exists)
CREATE TABLE IF NOT EXISTS "handover_emissions" (
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "description" TEXT,
    CONSTRAINT "handover_emissions_pkey" PRIMARY KEY ("uuid")
);

-- Create index on created_at for handover_emissions
CREATE INDEX IF NOT EXISTS "handover_emissions_created_at_idx" ON "handover_emissions"("created_at" DESC);

-- Step 2: Add emission columns to payments_jobs table
ALTER TABLE "payments_jobs" ADD COLUMN IF NOT EXISTS "emission_uuid" UUID;
ALTER TABLE "payments_jobs" ADD COLUMN IF NOT EXISTS "emission_date" TIMESTAMP(3);

-- Step 3: Create index on emission_uuid
CREATE INDEX IF NOT EXISTS "idx_payments_jobs_emission_uuid" ON "payments_jobs"("emission_uuid");

-- Step 4: Add foreign key constraint
-- First, drop the old constraint if it exists
ALTER TABLE "payments_jobs" DROP CONSTRAINT IF EXISTS "payments_jobs_emission_uuid_fkey";

-- Then add the new one
ALTER TABLE "payments_jobs" 
ADD CONSTRAINT "payments_jobs_emission_uuid_fkey" 
  FOREIGN KEY ("emission_uuid") REFERENCES "handover_emissions"("uuid") 
  ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Step 5: Create trigger functions to prevent updates/deletes of emitted records
CREATE OR REPLACE FUNCTION prevent_emitted_record_updates()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."emission_uuid" IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot update emitted handover record (emission_uuid: %)', OLD."emission_uuid";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS prevent_emitted_payments_jobs_update ON "payments_jobs";

-- Create the update prevention trigger
CREATE TRIGGER prevent_emitted_payments_jobs_update
BEFORE UPDATE ON "payments_jobs"
FOR EACH ROW
EXECUTE FUNCTION prevent_emitted_record_updates();

-- Step 6: Create deletion prevention trigger
CREATE OR REPLACE FUNCTION prevent_emitted_record_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."emission_uuid" IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot delete emitted handover record (emission_uuid: %)', OLD."emission_uuid";
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS prevent_emitted_payments_jobs_delete ON "payments_jobs";

-- Create the deletion prevention trigger
CREATE TRIGGER prevent_emitted_payments_jobs_delete
BEFORE DELETE ON "payments_jobs"
FOR EACH ROW
EXECUTE FUNCTION prevent_emitted_record_deletion();

-- Step 7: Verification query (run this to confirm migration was applied)
-- This will show you whether the migration succeeded
SELECT 
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'handover_emissions') AS handover_emissions_table_exists,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'payments_jobs' AND column_name = 'emission_uuid') AS emission_uuid_column_exists,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'payments_jobs' AND column_name = 'emission_date') AS emission_date_column_exists,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'pg_trigger' AND table_name = 'payments_jobs') AS triggers_exist;
