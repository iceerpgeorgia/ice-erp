-- Add 8 processing flags to bog_gel_raw table
-- These flags track the hierarchical processing state of each record

ALTER TABLE bog_gel_raw_893486000
ADD COLUMN IF NOT EXISTS counteragent_processed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS counteragent_inn_blank BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS counteragent_inn_nonblank_no_match BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS payment_id_match BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS payment_id_counteragent_mismatch BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS parsing_rule_match BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS parsing_rule_counteragent_mismatch BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS parsing_rule_dominance BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN bog_gel_raw_893486000.counteragent_processed IS 'Case 1: Counteragent successfully matched by INN';
COMMENT ON COLUMN bog_gel_raw_893486000.counteragent_inn_blank IS 'Case 2: INN column is blank';
COMMENT ON COLUMN bog_gel_raw_893486000.counteragent_inn_nonblank_no_match IS 'Case 3: INN exists but no matching counteragent in database';
COMMENT ON COLUMN bog_gel_raw_893486000.payment_id_match IS 'Case 4: Payment ID identified and counteragent matches Case 1';
COMMENT ON COLUMN bog_gel_raw_893486000.payment_id_counteragent_mismatch IS 'Case 5: Payment ID identified but counteragent conflicts with Case 1';
COMMENT ON COLUMN bog_gel_raw_893486000.parsing_rule_match IS 'Case 6: Parsing rule matched and counteragent matches Case 1';
COMMENT ON COLUMN bog_gel_raw_893486000.parsing_rule_counteragent_mismatch IS 'Case 7: Parsing rule matched but counteragent conflicts with Case 1';
COMMENT ON COLUMN bog_gel_raw_893486000.parsing_rule_dominance IS 'Case 8: Parsing rule overrides payment parameters (when Case 4 exists)';

-- Create index on processing flags for faster queries
CREATE INDEX IF NOT EXISTS idx_bog_gel_raw_893486000_flags 
ON bog_gel_raw_893486000 (counteragent_processed, payment_id_match, parsing_rule_match);
