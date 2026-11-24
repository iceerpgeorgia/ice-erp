// The trg_waybill_items_inventory_match trigger rejects binding an inventory whose dimension differs
// from the waybill item's unit (SQLSTATE 23514, message prefix waybill_item_unit_mismatch).
export const UNIT_MISMATCH_MESSAGE =
  "The inventory's unit does not match the item's unit. Choose an inventory with the same unit, or fix the unit in Unit Text → Dimension Mapping.";

export const isUnitMismatchError = (error: unknown): boolean =>
  String((error as any)?.message ?? '').includes('waybill_item_unit_mismatch');
