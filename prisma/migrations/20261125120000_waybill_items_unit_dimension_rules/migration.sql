-- Waybill item units and inventory dimensions must match (decided 2026-11-25: strict).
-- * The item's dimension comes from rs_unit_dimension_map (RS unit text -> our dimension), kept in
--   sync by triggers on both tables. Unknown unit texts are added to the map unmapped.
-- * Every suggestion step (exact, history, fuzzy; the LLM step in code) only offers inventories with
--   the item's dimension.
-- * Binding an inventory whose dimension differs from the item's is rejected (SQLSTATE 23514,
--   message prefix waybill_item_unit_mismatch). Existing mismatched bindings stay and are flagged.

-- Units that were never mapped.
INSERT INTO rs_unit_dimension_map (unit_text, dimension_uuid)
SELECT u.unit_text, d.uuid
  FROM (VALUES ('კომპ.', 'კომპლექტი'), ('კომპლ', 'კომპლექტი'), ('კვ. მეტრი', 'მ²')) AS u(unit_text, dimension)
  JOIN dimensions d ON d.dimension = u.dimension
ON CONFLICT (unit_text) DO UPDATE
   SET dimension_uuid = EXCLUDED.dimension_uuid
 WHERE rs_unit_dimension_map.dimension_uuid IS NULL;

CREATE OR REPLACE FUNCTION waybill_item_suggest_inventory(
  p_insider uuid,
  p_goods_name text,
  p_dimension uuid,
  OUT inventory_uuid uuid,
  OUT method text,
  OUT score numeric
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_name text := waybill_norm_name(p_goods_name);
  v_numbers text[] := waybill_name_numbers(p_goods_name);
  v_active_count int;
  v_total_count int;
  v_row record;
  v_best_uuid uuid;
  v_best_score real;
  v_second_score real;
BEGIN
  -- Units must match: an item without a dimension gets no suggestion.
  IF v_name IS NULL OR p_insider IS NULL OR p_dimension IS NULL THEN
    RETURN;
  END IF;

  -- 1) Exact inventory name. Prefer the single active match; duplicates fall through.
  SELECT count(*) FILTER (WHERE v.is_active), count(*)
    INTO v_active_count, v_total_count
    FROM inventories v
   WHERE v.insider_uuid = p_insider
     AND v.dimension_uuid = p_dimension
     AND waybill_norm_name(v.name) = v_name;

  IF v_active_count = 1 OR (v_active_count = 0 AND v_total_count = 1) THEN
    SELECT v.uuid INTO inventory_uuid
      FROM inventories v
     WHERE v.insider_uuid = p_insider
       AND v.dimension_uuid = p_dimension
       AND waybill_norm_name(v.name) = v_name
     ORDER BY v.is_active DESC
     LIMIT 1;
    method := 'exact';
    score := 1;
    RETURN;
  END IF;

  -- 2) Same goods name bound before: take the most recent binding.
  SELECT h.inventory_uuid INTO inventory_uuid
    FROM rs_waybills_in_items h
    JOIN inventories hv ON hv.uuid = h.inventory_uuid AND hv.dimension_uuid = p_dimension
   WHERE h.insider_uuid = p_insider
     AND h.inventory_uuid IS NOT NULL
     AND waybill_norm_name(h.goods_name) = v_name
   ORDER BY h.inventory_matched_at DESC NULLS LAST, h.updated_at DESC, h.id DESC
   LIMIT 1;

  IF inventory_uuid IS NOT NULL THEN
    method := 'history';
    score := 1;
    RETURN;
  END IF;

  -- 3) Fuzzy: best active inventory by trigram similarity, with the item's dimension and the
  --    same numeric tokens, at least 0.6 similar and 0.1 ahead of the runner-up.
  FOR v_row IN
    SELECT v.uuid AS uuid, similarity(waybill_norm_name(v.name), v_name) AS s
      FROM inventories v
     WHERE v.insider_uuid = p_insider
       AND v.is_active
       AND waybill_norm_name(v.name) % v_name
       AND v.dimension_uuid = p_dimension
       AND waybill_name_numbers(v.name) = v_numbers
     ORDER BY s DESC
     LIMIT 2
  LOOP
    IF v_best_uuid IS NULL THEN
      v_best_uuid := v_row.uuid;
      v_best_score := v_row.s;
    ELSE
      v_second_score := v_row.s;
    END IF;
  END LOOP;

  IF v_best_uuid IS NOT NULL
     AND v_best_score >= 0.6
     AND v_best_score - coalesce(v_second_score, 0) >= 0.1 THEN
    inventory_uuid := v_best_uuid;
    method := 'fuzzy';
    score := round(v_best_score::numeric, 4);
  END IF;
END;
$$;

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
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_waybill_items_inventory_match ON rs_waybills_in_items;
CREATE TRIGGER trg_waybill_items_inventory_match
  BEFORE INSERT OR UPDATE OF inventory_uuid, unit, dimension_uuid ON rs_waybills_in_items
  FOR EACH ROW
  EXECUTE FUNCTION waybill_items_inventory_match_trg();

-- Mapping (or remapping) a unit moves every item with that unit text to the new dimension.
CREATE OR REPLACE FUNCTION rs_unit_dimension_map_sync_items_trg()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_active AND NEW.dimension_uuid IS NOT NULL THEN
    UPDATE rs_waybills_in_items
       SET dimension_uuid = NEW.dimension_uuid
     WHERE unit = NEW.unit_text
       AND dimension_uuid IS DISTINCT FROM NEW.dimension_uuid;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rs_unit_dimension_map_sync_items ON rs_unit_dimension_map;
CREATE TRIGGER trg_rs_unit_dimension_map_sync_items
  AFTER INSERT OR UPDATE OF dimension_uuid, is_active ON rs_unit_dimension_map
  FOR EACH ROW
  EXECUTE FUNCTION rs_unit_dimension_map_sync_items_trg();

-- Bring item dimensions in line with the map (covers the units mapped above).
UPDATE rs_waybills_in_items i
   SET dimension_uuid = m.dimension_uuid
  FROM rs_unit_dimension_map m
 WHERE m.unit_text = i.unit
   AND m.is_active
   AND m.dimension_uuid IS NOT NULL
   AND i.dimension_uuid IS DISTINCT FROM m.dimension_uuid;

-- Pending suggestions with another dimension are redone within the item's dimension.
WITH redo AS (
  SELECT i.id, s.inventory_uuid, s.method, s.score
    FROM rs_waybills_in_items i
    JOIN inventories v ON v.uuid = i.suggested_inventory_uuid
   CROSS JOIN LATERAL waybill_item_suggest_inventory(i.insider_uuid, i.goods_name, i.dimension_uuid) s
   WHERE i.inventory_match_status = 'suggested'
     AND i.inventory_uuid IS NULL
     AND v.dimension_uuid IS DISTINCT FROM i.dimension_uuid
)
UPDATE rs_waybills_in_items i
   SET suggested_inventory_uuid = redo.inventory_uuid,
       inventory_match_method = redo.method,
       inventory_match_score = redo.score,
       inventory_match_status = CASE WHEN redo.inventory_uuid IS NULL THEN 'none' ELSE 'suggested' END,
       inventory_llm_checked_at = CASE WHEN redo.inventory_uuid IS NULL THEN NULL ELSE i.inventory_llm_checked_at END
  FROM redo
 WHERE i.id = redo.id;

-- Picking an inventory fills unbound items with the same goods name and unit.
CREATE INDEX IF NOT EXISTS idx_waybill_items_unbound_name_unit
  ON rs_waybills_in_items (insider_uuid, waybill_norm_name(goods_name), unit)
  WHERE inventory_uuid IS NULL;
