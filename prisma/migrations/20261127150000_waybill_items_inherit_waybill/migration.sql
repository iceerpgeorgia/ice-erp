-- Waybill items inherit their waybill's project, financial code and corresponding account
-- (decided 2026-11-27). Items no longer have values of their own:
-- 1. trg_waybill_items_inherit_waybill (BEFORE INSERT OR UPDATE on rs_waybills_in_items) copies the
--    three values from the item's waybill (rs_waybills_in_api, by rs_id) whenever an item is inserted
--    or any of the three is written; values sent for an item are ignored.
-- 2. trg_sync_waybill_items_project (AFTER UPDATE on rs_waybills_in_api) now copies all three values to
--    every item of the waybill whenever any of them changes (before: only the project, and only to items
--    without a project of their own).
-- Existing items are aligned separately (they may hold their own project or financial code).

CREATE OR REPLACE FUNCTION waybill_items_inherit_waybill_trg()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  w record;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.project_uuid IS NOT DISTINCT FROM OLD.project_uuid
     AND NEW.financial_code_uuid IS NOT DISTINCT FROM OLD.financial_code_uuid
     AND NEW.corresponding_account IS NOT DISTINCT FROM OLD.corresponding_account
     AND NEW.rs_id IS NOT DISTINCT FROM OLD.rs_id THEN
    RETURN NEW;
  END IF;
  SELECT a.project_uuid, a.financial_code_uuid, a.corresponding_account INTO w
    FROM rs_waybills_in_api a
   WHERE a.rs_id = NEW.rs_id;
  NEW.project_uuid := w.project_uuid;
  NEW.financial_code_uuid := w.financial_code_uuid;
  NEW.corresponding_account := w.corresponding_account;
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
  IF NEW.project_uuid IS NOT DISTINCT FROM OLD.project_uuid
     AND NEW.financial_code_uuid IS NOT DISTINCT FROM OLD.financial_code_uuid
     AND NEW.corresponding_account IS NOT DISTINCT FROM OLD.corresponding_account THEN
    RETURN NEW;
  END IF;
  UPDATE rs_waybills_in_items
     SET project_uuid = NEW.project_uuid,
         financial_code_uuid = NEW.financial_code_uuid,
         corresponding_account = NEW.corresponding_account,
         updated_at = now()
   WHERE rs_id = NEW.rs_id
     AND (project_uuid IS DISTINCT FROM NEW.project_uuid
          OR financial_code_uuid IS DISTINCT FROM NEW.financial_code_uuid
          OR corresponding_account IS DISTINCT FROM NEW.corresponding_account);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_waybill_items_project ON rs_waybills_in_api;
CREATE TRIGGER trg_sync_waybill_items_project
  AFTER UPDATE ON rs_waybills_in_api
  FOR EACH ROW
  EXECUTE FUNCTION sync_waybill_items_project();
