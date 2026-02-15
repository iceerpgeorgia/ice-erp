-- Enforce single batch_id per raw_record_uuid

CREATE OR REPLACE FUNCTION enforce_single_batch_per_raw_record()
RETURNS TRIGGER AS $$
DECLARE
  existing_batch_id TEXT;
BEGIN
  SELECT batch_id INTO existing_batch_id
  FROM bank_transaction_batches
  WHERE raw_record_uuid = NEW.raw_record_uuid
  LIMIT 1;

  IF existing_batch_id IS NOT NULL AND existing_batch_id <> NEW.batch_id THEN
    RAISE EXCEPTION 'raw_record_uuid % already assigned to batch_id %', NEW.raw_record_uuid, existing_batch_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_enforce_single_batch_per_raw_record ON bank_transaction_batches;

CREATE TRIGGER trigger_enforce_single_batch_per_raw_record
  BEFORE INSERT OR UPDATE ON bank_transaction_batches
  FOR EACH ROW
  EXECUTE FUNCTION enforce_single_batch_per_raw_record();
