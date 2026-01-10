-- Add processing_case column to consolidated_bank_accounts
ALTER TABLE consolidated_bank_accounts 
ADD COLUMN processing_case TEXT;

-- Add index for filtering
CREATE INDEX idx_consolidated_processing_case ON consolidated_bank_accounts(processing_case);

-- Add comment
COMMENT ON COLUMN consolidated_bank_accounts.processing_case IS 'CASE 1: Counteragent Matched, CASE 2: INN Found - No Counteragent, CASE 3: No INN Found';
