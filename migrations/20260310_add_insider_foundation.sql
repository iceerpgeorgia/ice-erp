-- Insider foundation rollout (phase 1)
-- 1) Counteragents: insider flag + owner insider reference
-- 2) Core business tables: insider_uuid reference column + index

BEGIN;

ALTER TABLE counteragents
  ADD COLUMN IF NOT EXISTS insider boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS insider_uuid uuid;

CREATE INDEX IF NOT EXISTS idx_counteragents_insider ON counteragents(insider);
CREATE INDEX IF NOT EXISTS idx_counteragents_insider_uuid ON counteragents(insider_uuid);

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

ALTER TABLE counteragents
  ADD CONSTRAINT fk_counteragents_insider_uuid
  FOREIGN KEY (insider_uuid)
  REFERENCES counteragents(counteragent_uuid)
  ON DELETE SET NULL;

COMMIT;
