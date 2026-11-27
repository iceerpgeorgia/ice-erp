-- Default cost code per counteragent and the ORIS corresponding account of waybills (decided 2026-11-27).
-- 1. counteragents.default_cost_fc_uuid: a cost financial code (is_income = false, no child codes),
--    chosen on the Counteragents page.
-- 2. Waybills (rs_waybills_in_api): when a waybill is imported, or its counteragent changes, and it has
--    no financial code yet, it gets its counteragent's default cost code.
-- 3. corresponding_account is no longer entered by hand: whenever a waybill's financial code is set or
--    changed (by import, the default above, a person, or a bulk edit) it becomes that code's ORIS
--    account (financial_codes.oris_account; NULL when the code has none or the code is cleared).
--    Writing the account directly is ignored (the previous value is kept).

ALTER TABLE counteragents ADD COLUMN IF NOT EXISTS default_cost_fc_uuid uuid;
ALTER TABLE counteragents
  DROP CONSTRAINT IF EXISTS counteragents_default_cost_fc_uuid_fkey,
  ADD CONSTRAINT counteragents_default_cost_fc_uuid_fkey
    FOREIGN KEY (default_cost_fc_uuid) REFERENCES financial_codes(uuid) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION rs_waybills_in_api_financial_code_trg()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_default uuid;
BEGIN
  IF NEW.financial_code_uuid IS NULL
     AND NEW.counteragent_uuid IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.counteragent_uuid IS DISTINCT FROM OLD.counteragent_uuid) THEN
    SELECT c.default_cost_fc_uuid INTO v_default
      FROM counteragents c
     WHERE c.counteragent_uuid = NEW.counteragent_uuid;
    NEW.financial_code_uuid := v_default;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.financial_code_uuid IS DISTINCT FROM OLD.financial_code_uuid THEN
    SELECT nullif(btrim(f.oris_account), '') INTO NEW.corresponding_account
      FROM financial_codes f
     WHERE f.uuid = NEW.financial_code_uuid;
    IF NEW.financial_code_uuid IS NULL THEN
      NEW.corresponding_account := NULL;
    END IF;
  ELSE
    NEW.corresponding_account := OLD.corresponding_account;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rs_waybills_in_api_financial_code ON rs_waybills_in_api;
CREATE TRIGGER trg_rs_waybills_in_api_financial_code
  BEFORE INSERT OR UPDATE ON rs_waybills_in_api
  FOR EACH ROW
  EXECUTE FUNCTION rs_waybills_in_api_financial_code_trg();
