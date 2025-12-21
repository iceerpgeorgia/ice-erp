-- Add computed/derived columns to projects table
-- These columns are auto-populated by triggers based on UUID references

-- Add derived text columns
ALTER TABLE projects ADD COLUMN IF NOT EXISTS counteragent TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS financial_code TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contract_no TEXT;

-- Add indexes for the UUID columns if not exists
CREATE INDEX IF NOT EXISTS idx_projects_counteragent_uuid ON projects(counteragent_uuid);
CREATE INDEX IF NOT EXISTS idx_projects_financial_code_uuid ON projects(financial_code_uuid);
CREATE INDEX IF NOT EXISTS idx_projects_currency_uuid ON projects(currency_uuid);
CREATE INDEX IF NOT EXISTS idx_projects_state_uuid ON projects(state_uuid);

-- Create trigger function to populate counteragent from counteragents table
CREATE OR REPLACE FUNCTION populate_project_counteragent()
RETURNS TRIGGER AS $$
BEGIN
  -- Lookup counteragent name from counteragents table
  SELECT name INTO NEW.counteragent
  FROM counteragents
  WHERE counteragent_uuid = NEW.counteragent_uuid;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to populate financial_code from financial_codes table
CREATE OR REPLACE FUNCTION populate_project_financial_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Lookup validation column from financial_codes table
  SELECT validation INTO NEW.financial_code
  FROM financial_codes
  WHERE uuid = NEW.financial_code_uuid;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to populate currency from currencies table
CREATE OR REPLACE FUNCTION populate_project_currency()
RETURNS TRIGGER AS $$
BEGIN
  -- Lookup code from currencies table
  SELECT code INTO NEW.currency
  FROM currencies
  WHERE uuid = NEW.currency_uuid;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to populate state from project_states table
CREATE OR REPLACE FUNCTION populate_project_state()
RETURNS TRIGGER AS $$
BEGIN
  -- Lookup name from project_states table
  SELECT name INTO NEW.state
  FROM project_states
  WHERE uuid = NEW.state_uuid;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to compute contract_no
-- Format: counteragent_internal_number + "." + REPT("0", 4-LEN(count)) + count
CREATE OR REPLACE FUNCTION populate_project_contract_no()
RETURNS TRIGGER AS $$
DECLARE
  internal_num TEXT;
  project_count INT;
  padded_count TEXT;
BEGIN
  -- Get counteragent's internal_number
  SELECT internal_number INTO internal_num
  FROM counteragents
  WHERE counteragent_uuid = NEW.counteragent_uuid;
  
  -- Count previously registered projects for this counteragent
  SELECT COUNT(*) INTO project_count
  FROM projects
  WHERE counteragent_uuid = NEW.counteragent_uuid
    AND id < NEW.id; -- Only count projects created before this one
  
  -- Increment count for this new project
  project_count := project_count + 1;
  
  -- Pad with zeros (4 digits total)
  padded_count := LPAD(project_count::TEXT, 4, '0');
  
  -- Compute contract_no
  NEW.contract_no := internal_num || '.' || padded_count;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to compute project_index
-- Format: project_name | financial_code | counteragent | formatted_value | currency | formatted_date
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
  
  -- Lookup counteragent name
  SELECT name INTO counteragent_name
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
  
  -- Compute project_index
  NEW.project_index := NEW.project_name || ' | ' || 
                       COALESCE(fin_code, '') || ' | ' || 
                       COALESCE(counteragent_name, '') || ' | ' || 
                       formatted_value || ' | ' || 
                       COALESCE(currency_code, '') || ' | ' || 
                       formatted_date;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_populate_project_counteragent ON projects;
DROP TRIGGER IF EXISTS trigger_populate_project_financial_code ON projects;
DROP TRIGGER IF EXISTS trigger_populate_project_currency ON projects;
DROP TRIGGER IF EXISTS trigger_populate_project_state ON projects;
DROP TRIGGER IF EXISTS trigger_populate_project_contract_no ON projects;
DROP TRIGGER IF EXISTS trigger_populate_project_index ON projects;

-- Create triggers for INSERT and UPDATE
CREATE TRIGGER trigger_populate_project_counteragent
  BEFORE INSERT OR UPDATE OF counteragent_uuid ON projects
  FOR EACH ROW
  EXECUTE FUNCTION populate_project_counteragent();

CREATE TRIGGER trigger_populate_project_financial_code
  BEFORE INSERT OR UPDATE OF financial_code_uuid ON projects
  FOR EACH ROW
  EXECUTE FUNCTION populate_project_financial_code();

CREATE TRIGGER trigger_populate_project_currency
  BEFORE INSERT OR UPDATE OF currency_uuid ON projects
  FOR EACH ROW
  EXECUTE FUNCTION populate_project_currency();

CREATE TRIGGER trigger_populate_project_state
  BEFORE INSERT OR UPDATE OF state_uuid ON projects
  FOR EACH ROW
  EXECUTE FUNCTION populate_project_state();

CREATE TRIGGER trigger_populate_project_contract_no
  BEFORE INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION populate_project_contract_no();

CREATE TRIGGER trigger_populate_project_index
  BEFORE INSERT OR UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION populate_project_index();

-- Create triggers on related tables to update projects when they change
-- Update projects.counteragent when counteragents.name changes
CREATE OR REPLACE FUNCTION update_projects_on_counteragent_change()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE projects
  SET counteragent = NEW.name
  WHERE counteragent_uuid = NEW.counteragent_uuid;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_projects_counteragent ON counteragents;
CREATE TRIGGER trigger_update_projects_counteragent
  AFTER UPDATE OF name ON counteragents
  FOR EACH ROW
  WHEN (OLD.name IS DISTINCT FROM NEW.name)
  EXECUTE FUNCTION update_projects_on_counteragent_change();

-- Update projects.financial_code when financial_codes.validation changes
CREATE OR REPLACE FUNCTION update_projects_on_financial_code_change()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE projects
  SET financial_code = NEW.validation
  WHERE financial_code_uuid = NEW.uuid;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_projects_financial_code ON financial_codes;
CREATE TRIGGER trigger_update_projects_financial_code
  AFTER UPDATE OF validation ON financial_codes
  FOR EACH ROW
  WHEN (OLD.validation IS DISTINCT FROM NEW.validation)
  EXECUTE FUNCTION update_projects_on_financial_code_change();

-- Update projects.currency when currencies.code changes
CREATE OR REPLACE FUNCTION update_projects_on_currency_change()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE projects
  SET currency = NEW.code
  WHERE currency_uuid = NEW.uuid;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_projects_currency ON currencies;
CREATE TRIGGER trigger_update_projects_currency
  AFTER UPDATE OF code ON currencies
  FOR EACH ROW
  WHEN (OLD.code IS DISTINCT FROM NEW.code)
  EXECUTE FUNCTION update_projects_on_currency_change();

-- Update projects.state when project_states.name changes
CREATE OR REPLACE FUNCTION update_projects_on_state_change()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE projects
  SET state = NEW.name
  WHERE state_uuid = NEW.uuid;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_projects_state ON project_states;
CREATE TRIGGER trigger_update_projects_state
  AFTER UPDATE OF name ON project_states
  FOR EACH ROW
  WHEN (OLD.name IS DISTINCT FROM NEW.name)
  EXECUTE FUNCTION update_projects_on_state_change();

COMMENT ON COLUMN projects.counteragent IS 'Derived from counteragents.name via counteragent_uuid. Auto-updated by trigger.';
COMMENT ON COLUMN projects.financial_code IS 'Derived from financial_codes.validation via financial_code_uuid. Auto-updated by trigger.';
COMMENT ON COLUMN projects.currency IS 'Derived from currencies.code via currency_uuid. Auto-updated by trigger.';
COMMENT ON COLUMN projects.state IS 'Derived from project_states.name via state_uuid. Auto-updated by trigger.';
COMMENT ON COLUMN projects.contract_no IS 'Computed: counteragent_internal_number.padded_project_count. Auto-populated by trigger on INSERT.';
COMMENT ON COLUMN projects.project_index IS 'Computed display value combining all project details. Auto-updated by trigger.';
