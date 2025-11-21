-- Update AuditLog table to support both BigInt and UUID record IDs
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/fojbzghphznbslqwurrm/sql

-- Change record_id from BIGINT to TEXT to support both BigInt and UUID
ALTER TABLE "AuditLog" 
ALTER COLUMN record_id TYPE TEXT USING record_id::TEXT;

-- Verify the change
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'AuditLog' AND column_name = 'record_id';
