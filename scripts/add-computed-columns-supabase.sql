-- Add computed columns to counteragents table in Supabase
-- These columns will automatically populate based on foreign key relations

-- First, drop the existing non-computed columns
ALTER TABLE counteragents DROP COLUMN IF EXISTS entity_type CASCADE;
ALTER TABLE counteragents DROP COLUMN IF EXISTS country CASCADE;
ALTER TABLE counteragents DROP COLUMN IF EXISTS counteragent CASCADE;

-- Add computed column for entity_type (name from entity_types table)
ALTER TABLE counteragents 
ADD COLUMN entity_type TEXT 
GENERATED ALWAYS AS (
    CASE 
        WHEN entity_type_uuid IS NOT NULL THEN (
            SELECT name_ka 
            FROM entity_types 
            WHERE entity_types.entity_type_uuid = counteragents.entity_type_uuid::uuid
        )
        ELSE NULL
    END
) STORED;

-- Add computed column for country (name from countries table)
ALTER TABLE counteragents 
ADD COLUMN country TEXT 
GENERATED ALWAYS AS (
    CASE 
        WHEN country_uuid IS NOT NULL THEN (
            SELECT name_ka 
            FROM countries 
            WHERE countries.country_uuid = counteragents.country_uuid::uuid
        )
        ELSE NULL
    END
) STORED;

-- Add computed column for counteragent (formatted display name)
ALTER TABLE counteragents 
ADD COLUMN counteragent TEXT 
GENERATED ALWAYS AS (
    CASE 
        WHEN name IS NOT NULL THEN 
            name || 
            COALESCE(' (ს.კ. ' || identification_number || ')', '') ||
            COALESCE(' - ' || (
                SELECT name_ka 
                FROM entity_types 
                WHERE entity_types.entity_type_uuid = counteragents.entity_type_uuid::uuid
            ), '')
        ELSE NULL
    END
) STORED;

-- Create indexes on the computed columns for better query performance
CREATE INDEX IF NOT EXISTS idx_counteragents_entity_type ON counteragents(entity_type);
CREATE INDEX IF NOT EXISTS idx_counteragents_country ON counteragents(country);
CREATE INDEX IF NOT EXISTS idx_counteragents_counteragent ON counteragents(counteragent);

-- Verify the computed columns
SELECT 
    name,
    identification_number,
    entity_type,
    country,
    counteragent
FROM counteragents
WHERE counteragent_uuid IS NOT NULL
LIMIT 5;
