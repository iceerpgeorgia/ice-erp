-- Add computed processing_case column to raw table
-- This calculates the case based on existing flags without storing duplicate data

ALTER TABLE bog_gel_raw_893486000 
ADD COLUMN processing_case TEXT GENERATED ALWAYS AS (
  CASE 
    WHEN counteragent_processed = TRUE THEN 'CASE 1: Counteragent Matched'
    WHEN counteragent_processed = FALSE AND counteragent_inn IS NOT NULL THEN 'CASE 2: INN Found - No Counteragent'
    ELSE 'CASE 3: No INN Found'
  END
) STORED;

-- Index for efficient filtering by case
CREATE INDEX idx_raw_processing_case ON bog_gel_raw_893486000(processing_case);

COMMENT ON COLUMN bog_gel_raw_893486000.processing_case IS 
'Computed from counteragent_processed and counteragent_inn flags. 
CASE 1: Counteragent matched in database. 
CASE 2: INN found but counteragent needs to be added. 
CASE 3: No INN found in raw data.';
