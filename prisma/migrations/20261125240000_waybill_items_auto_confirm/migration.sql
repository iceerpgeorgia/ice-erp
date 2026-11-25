-- Auto-confirm (decided 2026-11-25): suggestions from step 1 (exact inventory name) and step 2
-- (same goods name bound before) are bound at once, with status 'auto'. Fuzzy, LLM and expanded
-- suggestions still wait for a person. Clearing an auto binding returns the row to 'suggested'.
-- Suggestions only ever offer inventories with the item's dimension, so the unit rule holds.

-- One transaction: the relabel below relies on now() being the same for both updates.
BEGIN;

ALTER TABLE rs_waybills_in_items
  DROP CONSTRAINT IF EXISTS rs_waybills_in_items_inventory_match_status_check,
  ADD CONSTRAINT rs_waybills_in_items_inventory_match_status_check
    CHECK (inventory_match_status IS NULL OR inventory_match_status IN ('suggested', 'confirmed', 'auto', 'manual', 'none', 'legacy'));

CREATE OR REPLACE FUNCTION waybill_items_inventory_match_trg()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  s record;
  v_mapped uuid;
  v_inventory_dimension uuid;
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
  ELSIF NEW.inventory_uuid IS NULL
        AND NEW.dimension_uuid IS DISTINCT FROM OLD.dimension_uuid
        AND NEW.inventory_match_status IN ('suggested', 'none') THEN
    -- The unit now maps to another dimension: redo the suggestion within it. Without a match the
    -- LLM step looks at the item again.
    SELECT * INTO s FROM waybill_item_suggest_inventory(NEW.insider_uuid, NEW.goods_name, NEW.dimension_uuid);
    NEW.suggested_inventory_uuid := s.inventory_uuid;
    NEW.inventory_match_method := s.method;
    NEW.inventory_match_score := s.score;
    NEW.inventory_match_status := CASE WHEN s.inventory_uuid IS NULL THEN 'none' ELSE 'suggested' END;
    IF s.inventory_uuid IS NULL THEN
      NEW.inventory_llm_checked_at := NULL;
    ELSIF s.method IN ('exact', 'history') THEN
      NEW.inventory_uuid := s.inventory_uuid;
      NEW.inventory_match_status := 'auto';
      NEW.inventory_matched_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


-- Pending exact / history suggestions are bound now. The trigger marks them 'confirmed' and stamps
-- inventory_matched_at = now() (transaction start); the second statement relabels exactly those.
UPDATE rs_waybills_in_items i
   SET inventory_uuid = i.suggested_inventory_uuid
  FROM inventories v
 WHERE v.uuid = i.suggested_inventory_uuid
   AND v.dimension_uuid = i.dimension_uuid
   AND i.inventory_match_status = 'suggested'
   AND i.inventory_match_method IN ('exact', 'history')
   AND i.inventory_uuid IS NULL;

UPDATE rs_waybills_in_items
   SET inventory_match_status = 'auto'
 WHERE inventory_match_status = 'confirmed'
   AND inventory_match_method IN ('exact', 'history')
   AND inventory_matched_at = now();

COMMIT;
