-- Sync LOCAL raw table schema to match SUPABASE (new 8-case naming)
-- This renames the old 5-flag columns to match the new 8-case naming on Supabase

DO $$
DECLARE
    raw_table_name TEXT;
BEGIN
    -- Find the latest bog_gel_raw table
    SELECT table_name INTO raw_table_name
    FROM information_schema.tables
    WHERE table_name LIKE 'bog_gel_raw_%'
    ORDER BY table_name DESC
    LIMIT 1;
    
    IF raw_table_name IS NOT NULL THEN
        RAISE NOTICE 'Updating schema for table: %', raw_table_name;
        
        -- Drop old columns if they exist
        EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS counteragent_inn_nonblank_no_match', raw_table_name);
        EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS payment_id_match', raw_table_name);
        EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS payment_id_counteragent_mismatch', raw_table_name);
        EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS parsing_rule_match', raw_table_name);
        EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS parsing_rule_counteragent_mismatch', raw_table_name);
        
        -- Add new 8-case columns if they don't exist
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS parsing_rule_processed BOOLEAN DEFAULT FALSE', raw_table_name);
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS payment_id_processed BOOLEAN DEFAULT FALSE', raw_table_name);
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS counteragent_inn TEXT', raw_table_name);
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS processing_case TEXT', raw_table_name);
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS counteragent_found BOOLEAN DEFAULT FALSE', raw_table_name);
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS counteragent_missing BOOLEAN DEFAULT FALSE', raw_table_name);
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS payment_id_matched BOOLEAN DEFAULT FALSE', raw_table_name);
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS payment_id_conflict BOOLEAN DEFAULT FALSE', raw_table_name);
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS parsing_rule_applied BOOLEAN DEFAULT FALSE', raw_table_name);
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS parsing_rule_conflict BOOLEAN DEFAULT FALSE', raw_table_name);
        
        RAISE NOTICE 'Schema updated successfully for %', raw_table_name;
    ELSE
        RAISE NOTICE 'No bog_gel_raw table found';
    END IF;
END $$;
