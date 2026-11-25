-- No unit mismatches (decided 2026-11-25): a waybill item can only ever be bound to an inventory
-- with the item's dimension. Bindings made before the strict rule (and any that a unit remap or an
-- inventory dimension change would create) are matched again with the normal procedure:
-- exact / history -> bound ('auto'); fuzzy -> suggestion only; nothing -> binding cleared and the
-- item queued for the LLM steps (4-5).

BEGIN;

CREATE OR REPLACE FUNCTION waybill_items_inventory_match_trg()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  s record;
  v_mapped uuid;
  v_inventory_dimension uuid;
  v_suggested_dimension uuid;
  v_redo boolean := false;
BEGIN
  -- The item's dimension follows the unit map whenever the unit is set or changed. An unmapped
  -- unit leaves the item without a dimension (nothing can be bound until it is mapped), and a unit
  -- text the map has never seen is added to it, unmapped, so it shows on the mapping page.
  IF TG_OP = 'INSERT' OR NEW.unit IS DISTINCT FROM OLD.unit THEN
    SELECT m.dimension_uuid INTO v_mapped
      FROM rs_unit_dimension_map m
     WHERE m.unit_text = NEW.unit AND m.is_active AND m.dimension_uuid IS NOT NULL;
    NEW.dimension_uuid := v_mapped;
    IF v_mapped IS NULL AND nullif(btrim(NEW.unit), '') IS NOT NULL THEN
      INSERT INTO rs_unit_dimension_map (unit_text) VALUES (NEW.unit) ON CONFLICT (unit_text) DO NOTHING;
    END IF;
  END IF;

  -- Strict units: a newly bound inventory must have the item's dimension.
  IF NEW.inventory_uuid IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.inventory_uuid IS DISTINCT FROM OLD.inventory_uuid) THEN
    SELECT v.dimension_uuid INTO v_inventory_dimension FROM inventories v WHERE v.uuid = NEW.inventory_uuid;
    IF NEW.dimension_uuid IS NULL OR v_inventory_dimension IS DISTINCT FROM NEW.dimension_uuid THEN
      RAISE EXCEPTION 'waybill_item_unit_mismatch: unit "%" of waybill item % does not match the inventory dimension',
        coalesce(NEW.unit, ''), NEW.id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.inventory_uuid IS NOT NULL THEN
      NEW.inventory_match_status := 'manual';
      NEW.inventory_matched_at := coalesce(NEW.inventory_matched_at, now());
    ELSIF NEW.inventory_match_status IS NULL THEN
      SELECT * INTO s FROM waybill_item_suggest_inventory(NEW.insider_uuid, NEW.goods_name, NEW.dimension_uuid);
      NEW.suggested_inventory_uuid := s.inventory_uuid;
      NEW.inventory_match_method := s.method;
      NEW.inventory_match_score := s.score;
      NEW.inventory_match_status := CASE WHEN s.inventory_uuid IS NULL THEN 'none' ELSE 'suggested' END;
      -- Exact name and earlier-binding matches are bound at once (status 'auto').
      IF s.method IN ('exact', 'history') THEN
        NEW.inventory_uuid := s.inventory_uuid;
        NEW.inventory_match_status := 'auto';
        NEW.inventory_matched_at := now();
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: record the binding time whenever the bound inventory changes, from any code path.
  IF NEW.inventory_uuid IS DISTINCT FROM OLD.inventory_uuid THEN
    IF NEW.inventory_uuid IS NULL THEN
      NEW.inventory_matched_at := NULL;
      NEW.inventory_match_status := CASE
        WHEN OLD.inventory_match_status = 'legacy' THEN 'legacy'
        WHEN NEW.suggested_inventory_uuid IS NULL THEN 'none'
        ELSE 'suggested'
      END;
    ELSE
      NEW.inventory_matched_at := now();
      NEW.inventory_match_status := CASE
        WHEN NEW.inventory_uuid = NEW.suggested_inventory_uuid THEN 'confirmed'
        ELSE 'manual'
      END;
    END IF;
  ELSE
    -- Units must always match. A bound inventory whose dimension no longer equals the item's
    -- (the unit was remapped, or the inventory's dimension changed), or a pending suggestion that
    -- no longer fits, is matched again: exact / history are bound ('auto'), anything else clears
    -- the binding and leaves a suggestion (or none, which the LLM step looks at again).
    IF NEW.inventory_uuid IS NOT NULL THEN
      SELECT v.dimension_uuid INTO v_inventory_dimension FROM inventories v WHERE v.uuid = NEW.inventory_uuid;
      v_redo := NEW.dimension_uuid IS NULL OR v_inventory_dimension IS DISTINCT FROM NEW.dimension_uuid;
    ELSIF NEW.inventory_match_status IN ('suggested', 'none') THEN
      IF NEW.dimension_uuid IS DISTINCT FROM OLD.dimension_uuid THEN
        v_redo := true;
      ELSIF NEW.suggested_inventory_uuid IS NOT NULL THEN
        SELECT v.dimension_uuid INTO v_suggested_dimension FROM inventories v WHERE v.uuid = NEW.suggested_inventory_uuid;
        v_redo := v_suggested_dimension IS DISTINCT FROM NEW.dimension_uuid;
      END IF;
    END IF;

    IF v_redo THEN
      SELECT * INTO s FROM waybill_item_suggest_inventory(NEW.insider_uuid, NEW.goods_name, NEW.dimension_uuid);
      NEW.suggested_inventory_uuid := s.inventory_uuid;
      NEW.inventory_match_method := s.method;
      NEW.inventory_match_score := s.score;
      IF s.method IN ('exact', 'history') THEN
        NEW.inventory_uuid := s.inventory_uuid;
        NEW.inventory_match_status := 'auto';
        NEW.inventory_matched_at := now();
      ELSE
        NEW.inventory_uuid := NULL;
        NEW.inventory_matched_at := NULL;
        NEW.inventory_match_status := CASE WHEN s.inventory_uuid IS NULL THEN 'none' ELSE 'suggested' END;
        IF s.inventory_uuid IS NULL THEN
          NEW.inventory_llm_checked_at := NULL;
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- The trigger also fires on a no-op SET dimension_uuid = dimension_uuid, which is how the
-- inventories trigger below and the cleanup at the end ask it to check a row again.
DROP TRIGGER IF EXISTS trg_waybill_items_inventory_match ON rs_waybills_in_items;
CREATE TRIGGER trg_waybill_items_inventory_match
  BEFORE INSERT OR UPDATE OF inventory_uuid, unit, dimension_uuid ON rs_waybills_in_items
  FOR EACH ROW
  EXECUTE FUNCTION waybill_items_inventory_match_trg();

-- Changing an inventory's dimension re-checks the items bound to it or suggested with it.
CREATE OR REPLACE FUNCTION inventories_dimension_recheck_items_trg()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.dimension_uuid IS DISTINCT FROM OLD.dimension_uuid THEN
    UPDATE rs_waybills_in_items
       SET dimension_uuid = dimension_uuid
     WHERE inventory_uuid = NEW.uuid
        OR (suggested_inventory_uuid = NEW.uuid AND inventory_uuid IS NULL);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventories_dimension_recheck_items ON inventories;
CREATE TRIGGER trg_inventories_dimension_recheck_items
  AFTER UPDATE OF dimension_uuid ON inventories
  FOR EACH ROW
  EXECUTE FUNCTION inventories_dimension_recheck_items_trg();

-- Cleanup: every existing mismatched binding is matched again (legacy rows included).
UPDATE rs_waybills_in_items i
   SET dimension_uuid = i.dimension_uuid
  FROM inventories v
 WHERE v.uuid = i.inventory_uuid
   AND i.dimension_uuid IS DISTINCT FROM v.dimension_uuid;

COMMIT;
