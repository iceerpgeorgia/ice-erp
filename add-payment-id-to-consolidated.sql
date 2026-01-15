-- Add payment_id column to consolidated_bank_accounts
-- This links bank transactions to payments for proper reporting

-- Add the column
ALTER TABLE consolidated_bank_accounts 
ADD COLUMN IF NOT EXISTS payment_id VARCHAR(255);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_consolidated_payment_id 
ON consolidated_bank_accounts(payment_id);

-- Add comment
COMMENT ON COLUMN consolidated_bank_accounts.payment_id IS 'Links bank transaction to payment record for accurate payment tracking';
