-- Add exchange_rate and correction_date columns to consolidated_bank_accounts

ALTER TABLE consolidated_bank_accounts
ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(20, 10),
ADD COLUMN IF NOT EXISTS correction_date DATE;

-- Add comment explaining the columns
COMMENT ON COLUMN consolidated_bank_accounts.exchange_rate IS 'Exchange rate used for nominal amount calculation. Fetched from nbg_exchange_rates based on nominal currency and transaction_date (or correction_date if present)';
COMMENT ON COLUMN consolidated_bank_accounts.correction_date IS 'If set, this date overrides transaction_date for exchange rate lookup';

-- Create index for correction_date for faster queries
CREATE INDEX IF NOT EXISTS idx_consolidated_correction_date ON consolidated_bank_accounts(correction_date);
