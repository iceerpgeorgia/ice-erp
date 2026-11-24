-- Step 4 of waybill item inventory matching: an LLM picks among candidates for items the
-- trigger left at 'none'. Suggest only. Each item is sent to the model at most once.

ALTER TABLE rs_waybills_in_items
  ADD COLUMN IF NOT EXISTS inventory_llm_checked_at timestamptz;

ALTER TABLE rs_waybills_in_items
  DROP CONSTRAINT IF EXISTS rs_waybills_in_items_inventory_match_method_check,
  ADD CONSTRAINT rs_waybills_in_items_inventory_match_method_check
    CHECK (inventory_match_method IS NULL OR inventory_match_method IN ('exact', 'history', 'fuzzy', 'llm'));

-- Queue lookup for the step 4 job: unbound items with no suggestion that the model has not seen.
CREATE INDEX IF NOT EXISTS idx_waybill_items_llm_queue
  ON rs_waybills_in_items (id DESC)
  WHERE inventory_match_status = 'none'
    AND inventory_uuid IS NULL
    AND inventory_llm_checked_at IS NULL;

-- Trigram index on goods names so step 4 can offer earlier bound goods lines as candidates.
CREATE INDEX IF NOT EXISTS idx_waybill_items_bound_norm_name_trgm
  ON rs_waybills_in_items USING gin (waybill_norm_name(goods_name) gin_trgm_ops)
  WHERE inventory_uuid IS NOT NULL;
