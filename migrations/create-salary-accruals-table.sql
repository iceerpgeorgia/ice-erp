-- Create salary_accruals table
CREATE TABLE IF NOT EXISTS salary_accruals (
  id BIGSERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  
  -- References
  counteragent_uuid UUID NOT NULL,
  financial_code_uuid UUID NOT NULL,
  nominal_currency_uuid UUID NOT NULL,
  payment_id VARCHAR(100) NOT NULL,
  
  -- Period
  salary_month DATE NOT NULL,
  
  -- Amounts
  net_sum DECIMAL(15, 2) NOT NULL DEFAULT 0,
  surplus_insurance DECIMAL(15, 2),
  deducted_insurance DECIMAL(15, 2),
  deducted_fitness DECIMAL(15, 2),
  deducted_fine DECIMAL(15, 2),
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255) NOT NULL,
  
  -- Constraints
  CONSTRAINT salary_accruals_net_sum_check CHECK (net_sum >= 0)
);

-- Create indexes for performance
CREATE INDEX idx_salary_accruals_counteragent ON salary_accruals(counteragent_uuid);
CREATE INDEX idx_salary_accruals_financial_code ON salary_accruals(financial_code_uuid);
CREATE INDEX idx_salary_accruals_salary_month ON salary_accruals(salary_month);
CREATE INDEX idx_salary_accruals_payment_id ON salary_accruals(payment_id);
CREATE INDEX idx_salary_accruals_currency ON salary_accruals(nominal_currency_uuid);

-- Create composite index for common queries
CREATE INDEX idx_salary_accruals_month_counteragent ON salary_accruals(salary_month, counteragent_uuid);

COMMENT ON TABLE salary_accruals IS 'Monthly salary accruals for employees and contractors';
COMMENT ON COLUMN salary_accruals.counteragent_uuid IS 'Reference to employee/contractor in counteragents table';
COMMENT ON COLUMN salary_accruals.financial_code_uuid IS 'Financial code for accounting classification';
COMMENT ON COLUMN salary_accruals.salary_month IS 'Salary period (first day of month)';
COMMENT ON COLUMN salary_accruals.net_sum IS 'Net amount to be paid to employee';
COMMENT ON COLUMN salary_accruals.surplus_insurance IS 'Surplus insurance amount over the base insurance';
COMMENT ON COLUMN salary_accruals.deducted_insurance IS 'Insurance deducted from salary';
COMMENT ON COLUMN salary_accruals.deducted_fitness IS 'Fitness benefit deducted from salary';
COMMENT ON COLUMN salary_accruals.deducted_fine IS 'Fines deducted from salary';
COMMENT ON COLUMN salary_accruals.payment_id IS 'Reference to payment transaction ID';
