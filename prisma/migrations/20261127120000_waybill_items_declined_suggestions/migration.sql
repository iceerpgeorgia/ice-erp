-- Declined inventory suggestions (decided 2026-11-27): a person can decline a pending suggestion on
-- Waybill Items. The item (and every identical pending item: same insider, normalised goods name and
-- suggested inventory) gets status 'declined' with no suggested inventory, and no automatic suggestion
-- afterwards (unit remaps and the LLM steps only look at 'suggested' / 'none' items). A person binds
-- it from the Inventory picker, which makes it 'manual'.

ALTER TABLE rs_waybills_in_items
  DROP CONSTRAINT IF EXISTS rs_waybills_in_items_inventory_match_status_check,
  ADD CONSTRAINT rs_waybills_in_items_inventory_match_status_check
    CHECK (inventory_match_status IS NULL OR inventory_match_status IN ('suggested', 'confirmed', 'auto', 'manual', 'none', 'legacy', 'declined'));
