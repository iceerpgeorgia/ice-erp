-- Create consolidated_bank_accounts table
CREATE TABLE IF NOT EXISTS consolidated_bank_accounts (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    bank_account_uuid UUID NOT NULL,
    raw_record_uuid UUID NOT NULL,
    transaction_date TEXT NOT NULL,
    description TEXT,
    counteragent_uuid UUID,
    project_uuid UUID,
    financial_code_uuid UUID,
    account_currency_uuid UUID NOT NULL,
    account_currency_amount DECIMAL(20, 2) NOT NULL,
    nominal_currency_uuid UUID NOT NULL,
    nominal_amount DECIMAL(20, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_consolidated_bank_account_uuid ON consolidated_bank_accounts(bank_account_uuid);
CREATE INDEX IF NOT EXISTS idx_consolidated_raw_record_uuid ON consolidated_bank_accounts(raw_record_uuid);
CREATE INDEX IF NOT EXISTS idx_consolidated_counteragent_uuid ON consolidated_bank_accounts(counteragent_uuid);
CREATE INDEX IF NOT EXISTS idx_consolidated_project_uuid ON consolidated_bank_accounts(project_uuid);
CREATE INDEX IF NOT EXISTS idx_consolidated_transaction_date ON consolidated_bank_accounts(transaction_date);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_consolidated_bank_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_consolidated_bank_accounts_updated_at ON consolidated_bank_accounts;
CREATE TRIGGER trigger_update_consolidated_bank_accounts_updated_at
    BEFORE UPDATE ON consolidated_bank_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_consolidated_bank_accounts_updated_at();

COMMENT ON TABLE consolidated_bank_accounts IS 'Consolidated bank account transactions from raw data with identified counteragents and parsed parameters';
