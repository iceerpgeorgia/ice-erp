-- Drop processing_case from consolidated_bank_accounts since we compute it in raw table
DROP INDEX IF EXISTS idx_consolidated_processing_case;
ALTER TABLE consolidated_bank_accounts DROP COLUMN IF EXISTS processing_case;
