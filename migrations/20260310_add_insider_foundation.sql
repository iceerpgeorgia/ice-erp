-- Insider foundation rollout (phase 1)
-- Add insider_uuid reference columns + indexes to core business tables

BEGIN;

ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS insider_uuid uuid;
ALTER TABLE consolidated_bank_accounts ADD COLUMN IF NOT EXISTS insider_uuid uuid;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS insider_uuid uuid;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS insider_uuid uuid;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS insider_uuid uuid;
ALTER TABLE payments_ledger ADD COLUMN IF NOT EXISTS insider_uuid uuid;
ALTER TABLE salary_accruals ADD COLUMN IF NOT EXISTS insider_uuid uuid;

CREATE INDEX IF NOT EXISTS idx_bank_accounts_insider_uuid ON bank_accounts(insider_uuid);
CREATE INDEX IF NOT EXISTS idx_consolidated_bank_accounts_insider_uuid ON consolidated_bank_accounts(insider_uuid);
CREATE INDEX IF NOT EXISTS idx_projects_insider_uuid ON projects(insider_uuid);
CREATE INDEX IF NOT EXISTS idx_jobs_insider_uuid ON jobs(insider_uuid);
CREATE INDEX IF NOT EXISTS idx_payments_insider_uuid ON payments(insider_uuid);
CREATE INDEX IF NOT EXISTS idx_payments_ledger_insider_uuid ON payments_ledger(insider_uuid);
CREATE INDEX IF NOT EXISTS idx_salary_accruals_insider_uuid ON salary_accruals(insider_uuid);

COMMIT;
