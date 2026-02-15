-- Enforce BTC_* payment_id on raw tables only when batch has at least 2 partitions

CREATE OR REPLACE FUNCTION enforce_raw_btc_has_min_partitions()
RETURNS TRIGGER AS $$
DECLARE
  partition_count INT;
BEGIN
  IF NEW.payment_id IS NULL OR NEW.payment_id NOT LIKE 'BTC_%' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO partition_count
  FROM bank_transaction_batches
  WHERE batch_id = NEW.payment_id
    AND raw_record_uuid::text = NEW.raw_record_uuid::text;

  IF partition_count < 2 THEN
    RAISE EXCEPTION 'BTC batch_id % for raw_record_uuid % must have at least 2 partitions before setting payment_id', NEW.payment_id, NEW.raw_record_uuid;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_raw_bog_btc_requires_partitions ON "GE78BG0000000893486000_BOG_GEL";
DROP TRIGGER IF EXISTS trigger_raw_tbc_btc_requires_partitions ON "GE65TB7856036050100002_TBC_GEL";

CREATE CONSTRAINT TRIGGER trigger_raw_bog_btc_requires_partitions
  AFTER INSERT OR UPDATE OF payment_id ON "GE78BG0000000893486000_BOG_GEL"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION enforce_raw_btc_has_min_partitions();

CREATE CONSTRAINT TRIGGER trigger_raw_tbc_btc_requires_partitions
  AFTER INSERT OR UPDATE OF payment_id ON "GE65TB7856036050100002_TBC_GEL"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION enforce_raw_btc_has_min_partitions();

-- Clean raw payment_id when a batch is fully deleted
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
      AND payment_id = OLD.batch_id;

    UPDATE "GE65TB7856036050100002_TBC_GEL"
    SET payment_id = NULL,
        parsing_lock = false,
        updated_at = NOW()
    WHERE raw_record_uuid::text = OLD.raw_record_uuid::text
      AND payment_id = OLD.batch_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_clear_raw_btc_on_batch_delete ON bank_transaction_batches;

CREATE TRIGGER trigger_clear_raw_btc_on_batch_delete
  AFTER DELETE ON bank_transaction_batches
  FOR EACH ROW
  EXECUTE FUNCTION clear_raw_btc_on_batch_delete();
