-- Enforce batches to have at least 2 partitions

CREATE OR REPLACE FUNCTION enforce_batch_min_two_partitions()
RETURNS TRIGGER AS $$
DECLARE
  batch_id_value TEXT;
  batch_count INT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    batch_id_value := OLD.batch_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.batch_id IS DISTINCT FROM OLD.batch_id THEN
      IF OLD.batch_id IS NOT NULL THEN
        SELECT COUNT(*) INTO batch_count
        FROM bank_transaction_batches
        WHERE batch_id = OLD.batch_id;

        IF batch_count = 1 THEN
          RAISE EXCEPTION 'batch_id % must have at least 2 partitions', OLD.batch_id;
        END IF;
      END IF;
    END IF;
    batch_id_value := NEW.batch_id;
  ELSE
    batch_id_value := NEW.batch_id;
  END IF;

  IF batch_id_value IS NOT NULL THEN
    SELECT COUNT(*) INTO batch_count
    FROM bank_transaction_batches
    WHERE batch_id = batch_id_value;

    IF batch_count = 1 THEN
      RAISE EXCEPTION 'batch_id % must have at least 2 partitions', batch_id_value;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_enforce_batch_min_two_partitions ON bank_transaction_batches;

CREATE CONSTRAINT TRIGGER trigger_enforce_batch_min_two_partitions
  AFTER INSERT OR UPDATE OR DELETE ON bank_transaction_batches
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION enforce_batch_min_two_partitions();
