-- Fix 1: Counteragent column should use 'counteragent' field, not 'name'
CREATE OR REPLACE FUNCTION populate_project_counteragent()
RETURNS TRIGGER AS $$
BEGIN
  -- Lookup counteragent from counteragents table (use 'counteragent' column, not 'name')
  SELECT counteragent INTO NEW.counteragent
  FROM counteragents
  WHERE counteragent_uuid = NEW.counteragent_uuid;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix 2: Project index format should be: name | code counteragent | value | currency | date
CREATE OR REPLACE FUNCTION populate_project_index()
RETURNS TRIGGER AS $$
DECLARE
  fin_code TEXT;
  counteragent_name TEXT;
  currency_code TEXT;
  formatted_value TEXT;
  formatted_date TEXT;
BEGIN
  -- Lookup financial code
  SELECT code INTO fin_code
  FROM financial_codes
  WHERE uuid = NEW.financial_code_uuid;
  
  -- Lookup counteragent (use 'counteragent' column, not 'name')
  SELECT counteragent INTO counteragent_name
  FROM counteragents
  WHERE counteragent_uuid = NEW.counteragent_uuid;
  
  -- Lookup currency code
  SELECT code INTO currency_code
  FROM currencies
  WHERE uuid = NEW.currency_uuid;
  
  -- Format value with commas (e.g., 1,350,000.00)
  formatted_value := TO_CHAR(NEW.value, 'FM999,999,999,999.00');
  
  -- Format date as dd.mm.yyyy
  formatted_date := TO_CHAR(NEW.date, 'DD.MM.YYYY');
  
  -- Compute project_index with proper separators
  NEW.project_index := NEW.project_name || ' | ' || 
                       COALESCE(fin_code, '') || ' ' || 
                       COALESCE(counteragent_name, '') || ' | ' || 
                       formatted_value || ' | ' || 
                       COALESCE(currency_code, '') || ' | ' || 
                       formatted_date;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Refresh all existing projects to apply the fixes
UPDATE projects
SET counteragent_uuid = counteragent_uuid,
    updated_at = NOW();
