-- CreateTable: projects
CREATE TABLE IF NOT EXISTS "projects" (
    "id" SERIAL PRIMARY KEY,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "project_uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "value" DECIMAL(15,2) NOT NULL,
    "oris_1630" TEXT,
    "contract_no" TEXT,
    "project_index" TEXT,
    "counteragent_uuid" UUID NOT NULL,
    "financial_code_uuid" UUID NOT NULL,
    "currency_uuid" UUID NOT NULL,
    "state_uuid" UUID NOT NULL,
    "counteragent" TEXT,
    "financial_code" TEXT,
    "currency" TEXT,
    "state" TEXT,
    CONSTRAINT "projects_project_uuid_key" UNIQUE ("project_uuid")
);

-- CreateTable: project_employees
CREATE TABLE IF NOT EXISTS "project_employees" (
    "id" SERIAL PRIMARY KEY,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "project_id" INTEGER NOT NULL,
    "employee_uuid" UUID NOT NULL,
    "employee_name" TEXT,
    CONSTRAINT "project_employees_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_employees_project_id_employee_uuid_key" UNIQUE ("project_id", "employee_uuid")
);

-- CreateTable: financial_codes
CREATE TABLE IF NOT EXISTS "financial_codes" (
    "id" SERIAL PRIMARY KEY,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "financial_code_uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "validation" TEXT,
    CONSTRAINT "financial_codes_financial_code_uuid_key" UNIQUE ("financial_code_uuid"),
    CONSTRAINT "financial_codes_code_key" UNIQUE ("code")
);

-- CreateTable: project_states
CREATE TABLE IF NOT EXISTS "project_states" (
    "id" SERIAL PRIMARY KEY,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "state_uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    CONSTRAINT "project_states_state_uuid_key" UNIQUE ("state_uuid"),
    CONSTRAINT "project_states_name_key" UNIQUE ("name")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "projects_counteragent_uuid_idx" ON "projects"("counteragent_uuid");
CREATE INDEX IF NOT EXISTS "projects_financial_code_uuid_idx" ON "projects"("financial_code_uuid");
CREATE INDEX IF NOT EXISTS "projects_currency_uuid_idx" ON "projects"("currency_uuid");
CREATE INDEX IF NOT EXISTS "projects_state_uuid_idx" ON "projects"("state_uuid");
CREATE INDEX IF NOT EXISTS "projects_date_idx" ON "projects"("date");

CREATE INDEX IF NOT EXISTS "project_employees_project_id_idx" ON "project_employees"("project_id");
CREATE INDEX IF NOT EXISTS "project_employees_employee_uuid_idx" ON "project_employees"("employee_uuid");

-- Function to auto-compute contract_no
CREATE OR REPLACE FUNCTION compute_contract_no(p_counteragent_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    internal_num TEXT;
    project_count INTEGER;
    result TEXT;
BEGIN
    -- Get internal number from counteragents
    SELECT internal_number INTO internal_num
    FROM counteragents
    WHERE counteragent_uuid = p_counteragent_uuid;
    
    -- Count existing projects for this counteragent
    SELECT COUNT(*) INTO project_count
    FROM projects
    WHERE counteragent_uuid = p_counteragent_uuid;
    
    -- Format: internal_number + "." + zero-padded count
    result := internal_num || '.' || LPAD((project_count + 1)::TEXT, 4, '0');
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-compute project_index
CREATE OR REPLACE FUNCTION compute_project_index(
    p_project_name TEXT,
    p_financial_code_uuid UUID,
    p_counteragent_uuid UUID,
    p_value DECIMAL,
    p_currency_uuid UUID,
    p_date DATE
)
RETURNS TEXT AS $$
DECLARE
    fin_code TEXT;
    counteragent_name TEXT;
    currency_code TEXT;
    formatted_value TEXT;
    formatted_date TEXT;
    result TEXT;
BEGIN
    -- Lookup financial code
    SELECT code INTO fin_code
    FROM financial_codes
    WHERE financial_code_uuid = p_financial_code_uuid;
    
    -- Lookup counteragent name
    SELECT name INTO counteragent_name
    FROM counteragents
    WHERE counteragent_uuid = p_counteragent_uuid;
    
    -- Lookup currency code
    SELECT code INTO currency_code
    FROM currencies
    WHERE currency_uuid = p_currency_uuid;
    
    -- Format value with thousands separator: 1,350,000.00
    formatted_value := TO_CHAR(p_value, 'FM999,999,999,999.00');
    
    -- Format date as dd.mm.yyyy
    formatted_date := TO_CHAR(p_date, 'DD.MM.YYYY');
    
    -- Compute project index
    result := p_project_name || ' | ' || 
              COALESCE(fin_code, '') || ' ' || 
              COALESCE(counteragent_name, '') || ' | ' || 
              formatted_value || ' ' || 
              COALESCE(currency_code, '') || ' ' || 
              formatted_date;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update lookup fields and computed fields
CREATE OR REPLACE FUNCTION update_project_lookups()
RETURNS TRIGGER AS $$
BEGIN
    -- Update counteragent lookup
    SELECT name INTO NEW.counteragent
    FROM counteragents
    WHERE counteragent_uuid = NEW.counteragent_uuid;
    
    -- Update financial code lookup
    SELECT validation INTO NEW.financial_code
    FROM financial_codes
    WHERE financial_code_uuid = NEW.financial_code_uuid;
    
    -- Update currency lookup
    SELECT code INTO NEW.currency
    FROM currencies
    WHERE currency_uuid = NEW.currency_uuid;
    
    -- Update state lookup
    SELECT name INTO NEW.state
    FROM project_states
    WHERE state_uuid = NEW.state_uuid;
    
    -- Auto-compute contract_no if not provided
    IF NEW.contract_no IS NULL THEN
        NEW.contract_no := compute_contract_no(NEW.counteragent_uuid);
    END IF;
    
    -- Auto-compute project_index
    NEW.project_index := compute_project_index(
        NEW.project_name,
        NEW.financial_code_uuid,
        NEW.counteragent_uuid,
        NEW.value,
        NEW.currency_uuid,
        NEW.date
    );
    
    NEW.updated_at := CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_before_insert_update
    BEFORE INSERT OR UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_project_lookups();

-- Insert default project states
INSERT INTO project_states (name) VALUES 
    ('Planning'),
    ('Active'),
    ('On Hold'),
    ('Completed'),
    ('Cancelled')
ON CONFLICT (name) DO NOTHING;
