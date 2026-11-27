-- Waybills can be split across items (decided 2026-11-27, replaces the strict inheritance of
-- 20261127150000_waybill_items_inherit_waybill):
-- - A waybill's project and financial code are the default for its items. Setting either on the
--   waybill applies it to every item of the waybill (and so ends a split of that field).
-- - An item may have its own project or financial code (a split); the Waybills page then shows the
--   waybill with all its item projects / codes. Existing item values are kept.
-- - An item's corresponding account follows its financial code: the waybill's account when the item
--   has the waybill's code, otherwise that code's ORIS account. It is never entered by hand.

CREATE OR REPLACE FUNCTION waybill_items_inherit_waybill_trg()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  w record;
BEGIN
  SELECT a.project_uuid, a.financial_code_uuid, a.corresponding_account INTO w
    FROM rs_waybills_in_api a
   WHERE a.rs_id = NEW.rs_id;

  IF TG_OP = 'INSERT' THEN
    -- New items start with the waybill's values unless they come with their own.
    NEW.project_uuid := coalesce(NEW.project_uuid, w.project_uuid);
    NEW.financial_code_uuid := coalesce(NEW.financial_code_uuid, w.financial_code_uuid);
  END IF;

  IF NEW.financial_code_uuid IS NULL THEN
    NEW.corresponding_account := NULL;
  ELSIF NEW.financial_code_uuid IS NOT DISTINCT FROM w.financial_code_uuid THEN
    NEW.corresponding_account := w.corresponding_account;
  ELSE
    SELECT nullif(btrim(f.oris_account), '') INTO NEW.corresponding_account
      FROM financial_codes f WHERE f.uuid = NEW.financial_code_uuid;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_waybill_items_inherit_waybill ON rs_waybills_in_items;
CREATE TRIGGER trg_waybill_items_inherit_waybill
  BEFORE INSERT OR UPDATE ON rs_waybills_in_items
  FOR EACH ROW
  EXECUTE FUNCTION waybill_items_inherit_waybill_trg();

CREATE OR REPLACE FUNCTION sync_waybill_items_project()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.project_uuid IS DISTINCT FROM OLD.project_uuid THEN
    UPDATE rs_waybills_in_items
       SET project_uuid = NEW.project_uuid, updated_at = now()
     WHERE rs_id = NEW.rs_id AND project_uuid IS DISTINCT FROM NEW.project_uuid;
  END IF;
  IF NEW.financial_code_uuid IS DISTINCT FROM OLD.financial_code_uuid THEN
    UPDATE rs_waybills_in_items
       SET financial_code_uuid = NEW.financial_code_uuid, updated_at = now()
     WHERE rs_id = NEW.rs_id AND financial_code_uuid IS DISTINCT FROM NEW.financial_code_uuid;
  END IF;
  -- Items with the waybill's code carry the waybill's account; touching them makes their trigger
  -- read the new account (the item trigger always recalculates the account, so any value works).
  IF NEW.corresponding_account IS DISTINCT FROM OLD.corresponding_account THEN
    UPDATE rs_waybills_in_items
       SET corresponding_account = NEW.corresponding_account, updated_at = now()
     WHERE rs_id = NEW.rs_id
       AND financial_code_uuid IS NOT DISTINCT FROM NEW.financial_code_uuid
       AND corresponding_account IS DISTINCT FROM NEW.corresponding_account;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_waybill_items_project ON rs_waybills_in_api;
CREATE TRIGGER trg_sync_waybill_items_project
  AFTER UPDATE ON rs_waybills_in_api
  FOR EACH ROW
  EXECUTE FUNCTION sync_waybill_items_project();
