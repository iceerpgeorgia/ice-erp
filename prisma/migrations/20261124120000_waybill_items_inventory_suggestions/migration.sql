-- Waybill items: inventory suggestions on insert.
-- Order: 1) exact inventory name, 2) latest earlier binding of the same goods name, 3) fuzzy (trigram).
-- Suggest only: the trigger fills suggested_inventory_uuid and never sets inventory_uuid.
-- Existing rows are marked 'legacy' and get no suggestion; backfills are run on request.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE rs_waybills_in_items
  ADD COLUMN IF NOT EXISTS suggested_inventory_uuid uuid,
  ADD COLUMN IF NOT EXISTS inventory_match_method text,
  ADD COLUMN IF NOT EXISTS inventory_match_score numeric(5,4),
  ADD COLUMN IF NOT EXISTS inventory_match_status text,
  ADD COLUMN IF NOT EXISTS inventory_matched_at timestamptz;

ALTER TABLE rs_waybills_in_items
  DROP CONSTRAINT IF EXISTS rs_waybills_in_items_suggested_inventory_uuid_fkey,
  ADD CONSTRAINT rs_waybills_in_items_suggested_inventory_uuid_fkey
    FOREIGN KEY (suggested_inventory_uuid) REFERENCES inventories(uuid)
    ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE rs_waybills_in_items
  DROP CONSTRAINT IF EXISTS rs_waybills_in_items_inventory_match_method_check,
  ADD CONSTRAINT rs_waybills_in_items_inventory_match_method_check
    CHECK (inventory_match_method IS NULL OR inventory_match_method IN ('exact', 'history', 'fuzzy'));

-- suggested: suggestion waiting for a person; confirmed: bound to the suggestion;
-- manual: bound by a person to an inventory that was not the suggestion; none: nothing found;
-- legacy: row existed before this migration.
ALTER TABLE rs_waybills_in_items
  DROP CONSTRAINT IF EXISTS rs_waybills_in_items_inventory_match_status_check,
  ADD CONSTRAINT rs_waybills_in_items_inventory_match_status_check
    CHECK (inventory_match_status IS NULL OR inventory_match_status IN ('suggested', 'confirmed', 'manual', 'none', 'legacy'));

-- Existing rows: no suggestion. Binding time starts from updated_at for rows that are already bound.
UPDATE rs_waybills_in_items
   SET inventory_match_status = 'legacy',
       inventory_matched_at = CASE WHEN inventory_uuid IS NOT NULL THEN updated_at ELSE NULL END
 WHERE inventory_match_status IS NULL;

-- Name normalisation shared by matching and indexes: trim, collapse whitespace, lowercase.
CREATE OR REPLACE FUNCTION waybill_norm_name(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(lower(regexp_replace(btrim(coalesce(value, '')), '\s+', ' ', 'g')), '')
$$;

-- Distinct numeric tokens (sizes such as 1/2, 28.6, 100x100x6 -> {100,6}), comma read as decimal point.
-- Fuzzy matches must carry the same set: trigram similarity alone treats "1/2" and "1 1/2" as equal.
CREATE OR REPLACE FUNCTION waybill_name_numbers(value text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT coalesce(array_agg(DISTINCT replace(m[1], ',', '.') ORDER BY replace(m[1], ',', '.')), '{}'::text[])
    FROM regexp_matches(coalesce(value, ''), '([0-9]+(?:[.,/][0-9]+)*)', 'g') AS m
$$;

CREATE INDEX IF NOT EXISTS idx_inventories_insider_norm_name
  ON inventories (insider_uuid, waybill_norm_name(name));

CREATE INDEX IF NOT EXISTS idx_inventories_norm_name_trgm
  ON inventories USING gin (waybill_norm_name(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_waybill_items_bound_norm_name
  ON rs_waybills_in_items (insider_uuid, waybill_norm_name(goods_name), inventory_matched_at DESC)
  WHERE inventory_uuid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_waybill_items_inventory_match_status
  ON rs_waybills_in_items (insider_uuid, inventory_match_status);

-- Returns the suggested inventory for one goods line, or NULLs when nothing qualifies.
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
  IF v_name IS NULL OR p_insider IS NULL THEN
    RETURN;
  END IF;

  -- 1) Exact inventory name. Prefer the single active match; duplicates fall through.
  SELECT count(*) FILTER (WHERE v.is_active), count(*)
    INTO v_active_count, v_total_count
    FROM inventories v
   WHERE v.insider_uuid = p_insider
     AND waybill_norm_name(v.name) = v_name;

  IF v_active_count = 1 OR (v_active_count = 0 AND v_total_count = 1) THEN
    SELECT v.uuid INTO inventory_uuid
      FROM inventories v
     WHERE v.insider_uuid = p_insider
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

  -- 3) Fuzzy: best active inventory by trigram similarity, with a compatible dimension and the
  --    same numeric tokens, at least 0.6 similar and 0.1 ahead of the runner-up.
  FOR v_row IN
    SELECT v.uuid AS uuid, similarity(waybill_norm_name(v.name), v_name) AS s
      FROM inventories v
     WHERE v.insider_uuid = p_insider
       AND v.is_active
       AND waybill_norm_name(v.name) % v_name
       AND (p_dimension IS NULL OR v.dimension_uuid IS NULL OR v.dimension_uuid = p_dimension)
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
BEGIN
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
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_waybill_items_inventory_match ON rs_waybills_in_items;
CREATE TRIGGER trg_waybill_items_inventory_match
  BEFORE INSERT OR UPDATE OF inventory_uuid ON rs_waybills_in_items
  FOR EACH ROW
  EXECUTE FUNCTION waybill_items_inventory_match_trg();
