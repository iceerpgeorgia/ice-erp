-- Enforce strict insider policy from decision matrix:
-- required tables must always be bound to the single insider.

-- 1) Ensure required columns exist where missing.
ALTER TABLE IF EXISTS bank_accounts ADD COLUMN IF NOT EXISTS insider_uuid uuid;
ALTER TABLE IF EXISTS inventories ADD COLUMN IF NOT EXISTS insider_uuid uuid;
ALTER TABLE IF EXISTS jobs ADD COLUMN IF NOT EXISTS insider_uuid uuid;
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS insider_uuid uuid;
ALTER TABLE IF EXISTS payments_ledger ADD COLUMN IF NOT EXISTS insider_uuid uuid;
ALTER TABLE IF EXISTS projects ADD COLUMN IF NOT EXISTS insider_uuid uuid;
ALTER TABLE IF EXISTS rs_waybills_in ADD COLUMN IF NOT EXISTS insider_uuid uuid;
ALTER TABLE IF EXISTS rs_waybills_in_items ADD COLUMN IF NOT EXISTS insider_uuid uuid;
ALTER TABLE IF EXISTS salary_accruals ADD COLUMN IF NOT EXISTS insider_uuid uuid;
ALTER TABLE IF EXISTS conversion ADD COLUMN IF NOT EXISTS insider_uuid uuid;
ALTER TABLE IF EXISTS conversion_entries ADD COLUMN IF NOT EXISTS insider_uuid uuid;

CREATE INDEX IF NOT EXISTS idx_bank_accounts_insider_uuid ON bank_accounts(insider_uuid);
CREATE INDEX IF NOT EXISTS idx_inventories_insider_uuid ON inventories(insider_uuid);
CREATE INDEX IF NOT EXISTS idx_jobs_insider_uuid ON jobs(insider_uuid);
CREATE INDEX IF NOT EXISTS idx_payments_insider_uuid ON payments(insider_uuid);
CREATE INDEX IF NOT EXISTS idx_payments_ledger_insider_uuid ON payments_ledger(insider_uuid);
CREATE INDEX IF NOT EXISTS idx_projects_insider_uuid ON projects(insider_uuid);
CREATE INDEX IF NOT EXISTS idx_rs_waybills_in_insider_uuid ON rs_waybills_in(insider_uuid);
CREATE INDEX IF NOT EXISTS idx_rs_waybills_in_items_insider_uuid ON rs_waybills_in_items(insider_uuid);
CREATE INDEX IF NOT EXISTS idx_salary_accruals_insider_uuid ON salary_accruals(insider_uuid);
CREATE INDEX IF NOT EXISTS idx_conversion_insider_uuid ON conversion(insider_uuid);
CREATE INDEX IF NOT EXISTS idx_conversion_entries_insider_uuid ON conversion_entries(insider_uuid);

-- Allow only one row with insider=true in counteragents.
CREATE UNIQUE INDEX IF NOT EXISTS uq_single_true_insider
  ON counteragents (insider)
  WHERE insider = true;

-- 2) Validate there is exactly one active insider source row.
DO $$
DECLARE
  insider_count bigint;
BEGIN
  SELECT COUNT(*) INTO insider_count FROM counteragents WHERE insider = true;
  IF insider_count = 0 THEN
    RAISE EXCEPTION 'No insider counteragent found (counteragents.insider=true). Required insider binding cannot be enforced.';
  END IF;
END $$;

-- 3) Backfill all required tables with the single insider UUID.
WITH sole_insider AS (
  SELECT counteragent_uuid AS insider_uuid
  FROM counteragents
  WHERE insider = true
  ORDER BY id ASC
  LIMIT 1
)
UPDATE bank_accounts t
SET insider_uuid = s.insider_uuid
FROM sole_insider s
WHERE t.insider_uuid IS DISTINCT FROM s.insider_uuid;

WITH sole_insider AS (
  SELECT counteragent_uuid AS insider_uuid
  FROM counteragents
  WHERE insider = true
  ORDER BY id ASC
  LIMIT 1
)
UPDATE inventories t
SET insider_uuid = s.insider_uuid
FROM sole_insider s
WHERE t.insider_uuid IS DISTINCT FROM s.insider_uuid;

WITH sole_insider AS (
  SELECT counteragent_uuid AS insider_uuid
  FROM counteragents
  WHERE insider = true
  ORDER BY id ASC
  LIMIT 1
)
UPDATE jobs t
SET insider_uuid = s.insider_uuid
FROM sole_insider s
WHERE t.insider_uuid IS DISTINCT FROM s.insider_uuid;

WITH sole_insider AS (
  SELECT counteragent_uuid AS insider_uuid
  FROM counteragents
  WHERE insider = true
  ORDER BY id ASC
  LIMIT 1
)
UPDATE payments t
SET insider_uuid = s.insider_uuid
FROM sole_insider s
WHERE t.insider_uuid IS DISTINCT FROM s.insider_uuid;

ALTER TABLE IF EXISTS payments_ledger DISABLE TRIGGER USER;

WITH sole_insider AS (
  SELECT counteragent_uuid AS insider_uuid
  FROM counteragents
  WHERE insider = true
  ORDER BY id ASC
  LIMIT 1
)
UPDATE payments_ledger t
SET insider_uuid = s.insider_uuid
FROM sole_insider s
WHERE t.insider_uuid IS DISTINCT FROM s.insider_uuid;

ALTER TABLE IF EXISTS payments_ledger ENABLE TRIGGER USER;

WITH sole_insider AS (
  SELECT counteragent_uuid AS insider_uuid
  FROM counteragents
  WHERE insider = true
  ORDER BY id ASC
  LIMIT 1
)
UPDATE projects t
SET insider_uuid = s.insider_uuid
FROM sole_insider s
WHERE t.insider_uuid IS DISTINCT FROM s.insider_uuid;

WITH sole_insider AS (
  SELECT counteragent_uuid AS insider_uuid
  FROM counteragents
  WHERE insider = true
  ORDER BY id ASC
  LIMIT 1
)
UPDATE rs_waybills_in t
SET insider_uuid = s.insider_uuid
FROM sole_insider s
WHERE t.insider_uuid IS DISTINCT FROM s.insider_uuid;

WITH sole_insider AS (
  SELECT counteragent_uuid AS insider_uuid
  FROM counteragents
  WHERE insider = true
  ORDER BY id ASC
  LIMIT 1
)
UPDATE rs_waybills_in_items t
SET insider_uuid = s.insider_uuid
FROM sole_insider s
WHERE t.insider_uuid IS DISTINCT FROM s.insider_uuid;

WITH sole_insider AS (
  SELECT counteragent_uuid AS insider_uuid
  FROM counteragents
  WHERE insider = true
  ORDER BY id ASC
  LIMIT 1
)
UPDATE salary_accruals t
SET insider_uuid = s.insider_uuid
FROM sole_insider s
WHERE t.insider_uuid IS DISTINCT FROM s.insider_uuid;

WITH sole_insider AS (
  SELECT counteragent_uuid AS insider_uuid
  FROM counteragents
  WHERE insider = true
  ORDER BY id ASC
  LIMIT 1
)
UPDATE conversion t
SET insider_uuid = s.insider_uuid
FROM sole_insider s
WHERE t.insider_uuid IS DISTINCT FROM s.insider_uuid;

WITH sole_insider AS (
  SELECT counteragent_uuid AS insider_uuid
  FROM counteragents
  WHERE insider = true
  ORDER BY id ASC
  LIMIT 1
)
UPDATE conversion_entries t
SET insider_uuid = s.insider_uuid
FROM sole_insider s
WHERE t.insider_uuid IS DISTINCT FROM s.insider_uuid;

-- 4) Enforce NOT NULL for required insider columns.
ALTER TABLE IF EXISTS bank_accounts ALTER COLUMN insider_uuid SET NOT NULL;
ALTER TABLE IF EXISTS inventories ALTER COLUMN insider_uuid SET NOT NULL;
ALTER TABLE IF EXISTS jobs ALTER COLUMN insider_uuid SET NOT NULL;
ALTER TABLE IF EXISTS payments ALTER COLUMN insider_uuid SET NOT NULL;
ALTER TABLE IF EXISTS payments_ledger ALTER COLUMN insider_uuid SET NOT NULL;
ALTER TABLE IF EXISTS projects ALTER COLUMN insider_uuid SET NOT NULL;
ALTER TABLE IF EXISTS rs_waybills_in ALTER COLUMN insider_uuid SET NOT NULL;
ALTER TABLE IF EXISTS rs_waybills_in_items ALTER COLUMN insider_uuid SET NOT NULL;
ALTER TABLE IF EXISTS salary_accruals ALTER COLUMN insider_uuid SET NOT NULL;
ALTER TABLE IF EXISTS conversion ALTER COLUMN insider_uuid SET NOT NULL;
ALTER TABLE IF EXISTS conversion_entries ALTER COLUMN insider_uuid SET NOT NULL;

-- 5) Trigger to force all required rows to the single insider UUID on insert/update.
CREATE OR REPLACE FUNCTION bind_single_required_insider_uuid()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_insider uuid;
BEGIN
  SELECT counteragent_uuid::uuid
  INTO v_insider
  FROM counteragents
  WHERE insider = true
  ORDER BY id ASC
  LIMIT 1;

  IF v_insider IS NULL THEN
    RAISE EXCEPTION 'No insider counteragent found (counteragents.insider=true).';
  END IF;

  NEW.insider_uuid := v_insider;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.bank_accounts') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_bind_single_insider_bank_accounts ON bank_accounts;
    CREATE TRIGGER trg_bind_single_insider_bank_accounts
    BEFORE INSERT OR UPDATE ON bank_accounts
    FOR EACH ROW EXECUTE FUNCTION bind_single_required_insider_uuid();
  END IF;

  IF to_regclass('public.inventories') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_bind_single_insider_inventories ON inventories;
    CREATE TRIGGER trg_bind_single_insider_inventories
    BEFORE INSERT OR UPDATE ON inventories
    FOR EACH ROW EXECUTE FUNCTION bind_single_required_insider_uuid();
  END IF;

  IF to_regclass('public.jobs') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_bind_single_insider_jobs ON jobs;
    CREATE TRIGGER trg_bind_single_insider_jobs
    BEFORE INSERT OR UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION bind_single_required_insider_uuid();
  END IF;

  IF to_regclass('public.payments') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_bind_single_insider_payments ON payments;
    CREATE TRIGGER trg_bind_single_insider_payments
    BEFORE INSERT OR UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION bind_single_required_insider_uuid();
  END IF;

  IF to_regclass('public.payments_ledger') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_bind_single_insider_payments_ledger ON payments_ledger;
    CREATE TRIGGER trg_bind_single_insider_payments_ledger
    BEFORE INSERT OR UPDATE ON payments_ledger
    FOR EACH ROW EXECUTE FUNCTION bind_single_required_insider_uuid();
  END IF;

  IF to_regclass('public.projects') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_bind_single_insider_projects ON projects;
    CREATE TRIGGER trg_bind_single_insider_projects
    BEFORE INSERT OR UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION bind_single_required_insider_uuid();
  END IF;

  IF to_regclass('public.rs_waybills_in') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_bind_single_insider_rs_waybills_in ON rs_waybills_in;
    CREATE TRIGGER trg_bind_single_insider_rs_waybills_in
    BEFORE INSERT OR UPDATE ON rs_waybills_in
    FOR EACH ROW EXECUTE FUNCTION bind_single_required_insider_uuid();
  END IF;

  IF to_regclass('public.rs_waybills_in_items') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_bind_single_insider_rs_waybills_in_items ON rs_waybills_in_items;
    CREATE TRIGGER trg_bind_single_insider_rs_waybills_in_items
    BEFORE INSERT OR UPDATE ON rs_waybills_in_items
    FOR EACH ROW EXECUTE FUNCTION bind_single_required_insider_uuid();
  END IF;

  IF to_regclass('public.salary_accruals') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_bind_single_insider_salary_accruals ON salary_accruals;
    CREATE TRIGGER trg_bind_single_insider_salary_accruals
    BEFORE INSERT OR UPDATE ON salary_accruals
    FOR EACH ROW EXECUTE FUNCTION bind_single_required_insider_uuid();
  END IF;

  IF to_regclass('public.conversion') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_bind_single_insider_conversion ON conversion;
    CREATE TRIGGER trg_bind_single_insider_conversion
    BEFORE INSERT OR UPDATE ON conversion
    FOR EACH ROW EXECUTE FUNCTION bind_single_required_insider_uuid();
  END IF;

  IF to_regclass('public.conversion_entries') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_bind_single_insider_conversion_entries ON conversion_entries;
    CREATE TRIGGER trg_bind_single_insider_conversion_entries
    BEFORE INSERT OR UPDATE ON conversion_entries
    FOR EACH ROW EXECUTE FUNCTION bind_single_required_insider_uuid();
  END IF;
END $$;
