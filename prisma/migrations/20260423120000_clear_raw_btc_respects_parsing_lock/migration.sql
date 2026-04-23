-- Fix: clear_raw_btc_on_batch_delete must not reset rows that were manually
-- locked by the user. Original trigger force-set parsing_lock=false on any raw
-- row whose payment_id matched the deleted batch, even if a user had since
-- locked it. We now only clear when the row is still in its
-- batch-auto-bound state (parsing_lock = false / NULL).

CREATE OR REPLACE FUNCTION clear_raw_btc_on_batch_delete()
RETURNS TRIGGER AS $$
DECLARE
  remaining_count INT;
BEGIN
  SELECT COUNT(*) INTO remaining_count
  FROM bank_transaction_batches
  WHERE batch_id = OLD.batch_id;

  IF remaining_count = 0 THEN
    UPDATE "GE78BG0000000893486000_BOG_GEL"
    SET payment_id = NULL,
        parsing_lock = false,
        updated_at = NOW()
    WHERE raw_record_uuid::text = OLD.raw_record_uuid::text
      AND payment_id = OLD.batch_id
      AND (parsing_lock IS NULL OR parsing_lock = false);

    UPDATE "GE65TB7856036050100002_TBC_GEL"
    SET payment_id = NULL,
        parsing_lock = false,
        updated_at = NOW()
    WHERE raw_record_uuid::text = OLD.raw_record_uuid::text
      AND payment_id = OLD.batch_id
      AND (parsing_lock IS NULL OR parsing_lock = false);
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
