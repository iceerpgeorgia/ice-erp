-- Step 5 of waybill item inventory matching: method 'expanded' marks an LLM suggestion of the same
-- kind of item in the closest size or variant (not the exact product). See lib/waybills/llm-inventory-match.ts.
ALTER TABLE rs_waybills_in_items
  DROP CONSTRAINT IF EXISTS rs_waybills_in_items_inventory_match_method_check,
  ADD CONSTRAINT rs_waybills_in_items_inventory_match_method_check
    CHECK (inventory_match_method IS NULL OR inventory_match_method IN ('exact', 'history', 'fuzzy', 'llm', 'expanded'));
