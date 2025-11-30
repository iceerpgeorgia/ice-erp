-- Add soft-delete flag to countries
ALTER TABLE "countries" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;

-- Add soft-delete flag to counteragents
ALTER TABLE "counteragents" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;

