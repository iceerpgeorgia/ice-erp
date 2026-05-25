-- Add rs_id FK to rs_waybills_in_items linking to rs_waybills_in_api
ALTER TABLE "rs_waybills_in_items" ADD COLUMN IF NOT EXISTS "rs_id" TEXT;

-- Backfill rs_id from rs_waybills_in_api matched by waybill_no
-- Uses DISTINCT ON to handle the (unlikely) case of multiple api rows with same waybill_no
UPDATE "rs_waybills_in_items" i
SET rs_id = a.rs_id
FROM (
  SELECT DISTINCT ON (waybill_no) rs_id, waybill_no
  FROM "rs_waybills_in_api"
  WHERE waybill_no IS NOT NULL
  ORDER BY waybill_no, synced_at DESC
) a
WHERE a.waybill_no = i.waybill_no
  AND i.rs_id IS NULL;

-- Add FK constraint (deferrable, set null on delete so items survive waybill deletion)
ALTER TABLE "rs_waybills_in_items"
  ADD CONSTRAINT "rs_waybills_in_items_rs_id_fkey"
  FOREIGN KEY ("rs_id") REFERENCES "rs_waybills_in_api"("rs_id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Index for the new column
CREATE INDEX IF NOT EXISTS "rs_waybills_in_items_rs_id_idx" ON "rs_waybills_in_items"("rs_id");
