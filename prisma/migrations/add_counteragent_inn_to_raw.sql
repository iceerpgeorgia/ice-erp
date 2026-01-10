-- Add counteragent_inn column to track found INN values
ALTER TABLE bog_gel_raw_893486000 
ADD COLUMN IF NOT EXISTS counteragent_inn TEXT;

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_bog_gel_raw_counteragent_inn ON bog_gel_raw_893486000(counteragent_inn);

-- Create index for finding records that need counteragent creation
CREATE INDEX IF NOT EXISTS idx_bog_gel_raw_needs_counteragent ON bog_gel_raw_893486000(counteragent_processed, counteragent_inn) 
WHERE counteragent_processed = FALSE AND counteragent_inn IS NOT NULL;

COMMENT ON COLUMN bog_gel_raw_893486000.counteragent_inn IS 'INN found in raw data (may not exist in counteragents table yet)';
