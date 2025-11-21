-- Add new fields to existing financial_codes table
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/fojbzghphznbslqwurrm/sql
-- This adds the fields from the new Figma hierarchical design to the existing financial codes structure

-- Add new columns for hierarchical code management
ALTER TABLE "financial_codes" 
ADD COLUMN IF NOT EXISTS uuid UUID DEFAULT gen_random_uuid() UNIQUE,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS is_income BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES "financial_codes"(uuid) ON DELETE CASCADE;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS "financial_codes_uuid_idx" ON "financial_codes"(uuid);
CREATE INDEX IF NOT EXISTS "financial_codes_parent_id_idx" ON "financial_codes"(parent_id);
CREATE INDEX IF NOT EXISTS "financial_codes_is_income_idx" ON "financial_codes"(is_income);

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'financial_codes' 
ORDER BY ordinal_position;
