-- Identical pending suggestions (same insider, goods name and suggested inventory) are counted per
-- page in /api/waybill-items and confirmed together by /api/waybill-items/confirm-suggestion.
CREATE INDEX IF NOT EXISTS idx_waybill_items_suggestion_groups
  ON rs_waybills_in_items (insider_uuid, suggested_inventory_uuid, waybill_norm_name(goods_name))
  WHERE inventory_match_status = 'suggested' AND inventory_uuid IS NULL;
