-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    contract_number TEXT,
    
    -- Foreign keys
    counteragent_id BIGINT NOT NULL REFERENCES counteragents(id),
    financial_code_id BIGINT NOT NULL REFERENCES financial_codes(id),
    employee_id TEXT REFERENCES "User"(id),
    
    -- Financial info
    amount DECIMAL(15, 2) NOT NULL,
    currency TEXT DEFAULT 'GEL' NOT NULL,
    start_date TIMESTAMP(3) NOT NULL,
    
    -- Status
    status TEXT DEFAULT 'active' NOT NULL,
    is_deleted BOOLEAN DEFAULT false NOT NULL,
    
    -- ORIS Integration
    oris_id TEXT UNIQUE,
    oris_counteragent_id TEXT,
    
    -- Additional fields
    collateral TEXT,
    notes TEXT,
    
    -- Audit fields
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by TEXT,
    updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_projects_counteragent_id ON projects(counteragent_id);
CREATE INDEX IF NOT EXISTS idx_projects_financial_code_id ON projects(financial_code_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_start_date ON projects(start_date);
CREATE INDEX IF NOT EXISTS idx_projects_employee_id ON projects(employee_id);
