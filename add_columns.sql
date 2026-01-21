-- Add correction_date and exchange_rate columns to consolidated_bank_accounts

ALTER TABLE consolidated_bank_accounts 
ADD COLUMN IF NOT EXISTS correction_date DATE,
ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(20, 10);

CREATE INDEX IF NOT EXISTS idx_consolidated_correction_date 
ON consolidated_bank_accounts(correction_date);
