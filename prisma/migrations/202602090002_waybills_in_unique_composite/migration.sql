-- Update waybills uniqueness to composite key (rs_id, waybill_no)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'rs_waybills_in_rs_id_key'
  ) THEN
    EXECUTE 'DROP INDEX IF EXISTS rs_waybills_in_rs_id_key';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS rs_waybills_in_rs_id_waybill_no_key
  ON "rs_waybills_in"(rs_id, waybill_no);

CREATE INDEX IF NOT EXISTS idx_rs_waybills_in_rs_id ON "rs_waybills_in"(rs_id);
