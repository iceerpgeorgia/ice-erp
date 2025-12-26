-- Create table to track duplicate payment_ids
CREATE TABLE IF NOT EXISTS payment_id_duplicates (
    id SERIAL PRIMARY KEY,
    master_payment_id VARCHAR(255) NOT NULL,
    duplicate_payment_id VARCHAR(255) NOT NULL,
    project_uuid UUID,
    counteragent_uuid UUID NOT NULL,
    financial_code_uuid UUID NOT NULL,
    job_uuid UUID,
    income_tax BOOLEAN NOT NULL,
    currency_uuid UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(duplicate_payment_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_duplicates_master ON payment_id_duplicates(master_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_duplicates_duplicate ON payment_id_duplicates(duplicate_payment_id);
