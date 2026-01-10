-- Bank Transaction Batches Table
-- Allows splitting a single raw bank transaction into multiple payment allocations

CREATE TABLE bank_transaction_batches (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    
    -- Raw Transaction Reference
    bank_account_uuid UUID NOT NULL,
    raw_record_id_1 TEXT NOT NULL,  -- dockey
    raw_record_id_2 TEXT NOT NULL,  -- entriesid
    raw_record_uuid TEXT NOT NULL,  -- dockey_entriesid combination
    
    -- Batch Grouping
    batch_uuid UUID NOT NULL,  -- Groups all partitions of same raw transaction
    
    -- Partition Details
    partition_amount DECIMAL(20, 2) NOT NULL,  -- Amount in account currency (GEL)
    partition_sequence INT NOT NULL,  -- Order within batch (1, 2, 3...)
    
    -- Payment Assignment
    payment_uuid TEXT NULL,  -- Text type to match payments.record_uuid
    payment_id TEXT NULL,
    
    -- Override Fields (if different from payment)
    counteragent_uuid UUID NULL REFERENCES counteragents(counteragent_uuid),
    project_uuid UUID NULL REFERENCES projects(project_uuid),
    financial_code_uuid UUID NULL REFERENCES financial_codes(uuid),
    nominal_currency_uuid UUID NULL REFERENCES currencies(uuid),
    
    -- Nominal Amount Calculation
    nominal_amount DECIMAL(20, 2) NULL,  -- Converted amount in nominal currency
    
    -- Notes
    partition_note TEXT NULL,
    
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by TEXT NULL,
    
    -- Constraints
    CONSTRAINT bank_transaction_batches_positive_amount CHECK (partition_amount > 0),
    CONSTRAINT bank_transaction_batches_sequence_positive CHECK (partition_sequence > 0)
);

-- Indexes
CREATE INDEX idx_bank_transaction_batches_batch_uuid ON bank_transaction_batches(batch_uuid);
CREATE INDEX idx_bank_transaction_batches_raw_record ON bank_transaction_batches(raw_record_id_1, raw_record_id_2);
CREATE INDEX idx_bank_transaction_batches_payment ON bank_transaction_batches(payment_uuid);
CREATE INDEX idx_bank_transaction_batches_account ON bank_transaction_batches(bank_account_uuid);
CREATE INDEX idx_bank_transaction_batches_raw_uuid ON bank_transaction_batches(raw_record_uuid);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_bank_transaction_batches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bank_transaction_batches_updated_at
    BEFORE UPDATE ON bank_transaction_batches
    FOR EACH ROW
    EXECUTE FUNCTION update_bank_transaction_batches_updated_at();

-- Function to validate batch totals
CREATE OR REPLACE FUNCTION validate_batch_total(p_batch_uuid UUID, p_expected_total DECIMAL)
RETURNS BOOLEAN AS $$
DECLARE
    v_actual_total DECIMAL;
BEGIN
    SELECT COALESCE(SUM(partition_amount), 0)
    INTO v_actual_total
    FROM bank_transaction_batches
    WHERE batch_uuid = p_batch_uuid;
    
    RETURN ABS(v_actual_total - p_expected_total) < 0.01;  -- Allow 0.01 rounding difference
END;
$$ LANGUAGE plpgsql;

-- View to check batch integrity
CREATE OR REPLACE VIEW bank_transaction_batch_summary AS
SELECT 
    btb.batch_uuid,
    btb.bank_account_uuid,
    btb.raw_record_id_1,
    btb.raw_record_id_2,
    btb.raw_record_uuid,
    COUNT(*) as partition_count,
    SUM(btb.partition_amount) as total_partition_amount,
    ARRAY_AGG(btb.payment_id ORDER BY btb.partition_sequence) as payment_ids,
    MIN(btb.created_at) as created_at
FROM bank_transaction_batches btb
GROUP BY btb.batch_uuid, btb.bank_account_uuid, btb.raw_record_id_1, 
         btb.raw_record_id_2, btb.raw_record_uuid;

COMMENT ON TABLE bank_transaction_batches IS 'Splits raw bank transactions into multiple payment allocations';
COMMENT ON COLUMN bank_transaction_batches.batch_uuid IS 'Groups all partitions of the same raw transaction';
COMMENT ON COLUMN bank_transaction_batches.partition_amount IS 'Amount allocated to this partition in account currency';
COMMENT ON COLUMN bank_transaction_batches.partition_sequence IS 'Order of partition within batch';
COMMENT ON COLUMN bank_transaction_batches.nominal_amount IS 'Partition amount converted to nominal currency';
