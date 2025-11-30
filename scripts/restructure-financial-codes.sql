-- Restructure financial_codes table to simplified hierarchical structure
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/fojbzghphznbslqwurrm/sql

-- Step 1: Drop the closure table (not needed)
DROP TABLE IF EXISTS "financial_code_paths" CASCADE;

-- Step 2: Drop existing financial_codes table and recreate with clean structure
DROP TABLE IF EXISTS "financial_codes" CASCADE;

-- Step 3: Create simplified financial_codes table
CREATE TABLE "financial_codes" (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID UNIQUE DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    validation TEXT,
    applies_to_pl BOOLEAN DEFAULT false,
    applies_to_cf BOOLEAN DEFAULT false,
    is_income BOOLEAN DEFAULT false,
    parent_uuid UUID,
    description TEXT,
    depth INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX "financial_codes_code_idx" ON "financial_codes"(code);
CREATE INDEX "financial_codes_uuid_idx" ON "financial_codes"(uuid);
CREATE INDEX "financial_codes_parent_uuid_idx" ON "financial_codes"(parent_uuid);
CREATE INDEX "financial_codes_applies_to_pl_idx" ON "financial_codes"(applies_to_pl);
CREATE INDEX "financial_codes_applies_to_cf_idx" ON "financial_codes"(applies_to_cf);
CREATE INDEX "financial_codes_is_income_idx" ON "financial_codes"(is_income);
CREATE INDEX "financial_codes_is_active_idx" ON "financial_codes"(is_active);
CREATE INDEX "financial_codes_parent_uuid_sort_order_idx" ON "financial_codes"(parent_uuid, sort_order);

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_financial_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_financial_codes_updated_at
    BEFORE UPDATE ON "financial_codes"
    FOR EACH ROW
    EXECUTE FUNCTION update_financial_codes_updated_at();

-- Verify table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'financial_codes' 
ORDER BY ordinal_position;
