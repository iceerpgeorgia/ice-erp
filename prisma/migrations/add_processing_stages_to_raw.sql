-- Add separate processing stage columns to bog_gel_raw_893486000
ALTER TABLE bog_gel_raw_893486000 
ADD COLUMN IF NOT EXISTS counteragent_processed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS parsing_rule_processed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS payment_id_processed BOOLEAN DEFAULT FALSE;

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_bog_gel_raw_counteragent_processed ON bog_gel_raw_893486000(counteragent_processed);
CREATE INDEX IF NOT EXISTS idx_bog_gel_raw_parsing_rule_processed ON bog_gel_raw_893486000(parsing_rule_processed);
CREATE INDEX IF NOT EXISTS idx_bog_gel_raw_payment_id_processed ON bog_gel_raw_893486000(payment_id_processed);
CREATE INDEX IF NOT EXISTS idx_bog_gel_raw_all_processed ON bog_gel_raw_893486000(counteragent_processed, parsing_rule_processed, payment_id_processed);

-- Update existing is_processed records to new structure (if they were processed, mark all stages as done)
UPDATE bog_gel_raw_893486000 
SET 
  counteragent_processed = TRUE,
  parsing_rule_processed = TRUE,
  payment_id_processed = TRUE
WHERE is_processed = TRUE;

COMMENT ON COLUMN bog_gel_raw_893486000.counteragent_processed IS 'Counteragent identified from raw data';
COMMENT ON COLUMN bog_gel_raw_893486000.parsing_rule_processed IS 'Parsed against parsing scheme rules';
COMMENT ON COLUMN bog_gel_raw_893486000.payment_id_processed IS 'Parsed against payment_id or batch_id';
