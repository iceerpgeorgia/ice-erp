-- Add processing_case column to consolidated_bank_accounts
ALTER TABLE consolidated_bank_accounts 
ADD COLUMN IF NOT EXISTS processing_case TEXT;

-- Populate the processing_case column from the raw table
UPDATE consolidated_bank_accounts cba
SET processing_case = raw.processing_case
FROM bog_gel_raw_893486000 raw
WHERE cba.raw_record_uuid = raw.uuid;

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_consolidated_processing_case ON consolidated_bank_accounts(processing_case);

-- Add comment
COMMENT ON COLUMN consolidated_bank_accounts.processing_case IS 'CASE 1: Counteragent Matched, CASE 2: INN Found - No Counteragent, CASE 3: No INN Found';
