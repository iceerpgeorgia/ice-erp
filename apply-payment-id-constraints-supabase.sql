-- Apply payment_id + record_uuid validation and trigger in Supabase

-- 1) Trigger function to generate valid IDs
CREATE OR REPLACE FUNCTION generate_payment_id()
RETURNS TRIGGER AS $$
DECLARE
  hex_chars TEXT := '0123456789abcdef';
  new_payment_id TEXT := '';
  i INT;
  random_val INT;
BEGIN
  FOR i IN 1..6 LOOP
    random_val := floor(random() * 16)::INT;
    new_payment_id := new_payment_id || substr(hex_chars, random_val + 1, 1);
  END LOOP;
  new_payment_id := new_payment_id || '_';

  FOR i IN 1..2 LOOP
    random_val := floor(random() * 16)::INT;
    new_payment_id := new_payment_id || substr(hex_chars, random_val + 1, 1);
  END LOOP;
  new_payment_id := new_payment_id || '_';

  FOR i IN 1..6 LOOP
    random_val := floor(random() * 16)::INT;
    new_payment_id := new_payment_id || substr(hex_chars, random_val + 1, 1);
  END LOOP;

  IF NEW.payment_id IS NULL OR NEW.payment_id = '' THEN
    NEW.payment_id := new_payment_id;
  END IF;

  IF NEW.record_uuid IS NULL OR NEW.record_uuid = '' THEN
    NEW.record_uuid := gen_random_uuid()::text;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2) Trigger
DROP TRIGGER IF EXISTS payment_id_trigger ON payments;
CREATE TRIGGER payment_id_trigger
  BEFORE INSERT ON payments
  FOR EACH ROW
  WHEN (NEW.payment_id IS NULL OR NEW.payment_id = '' OR NEW.record_uuid IS NULL OR NEW.record_uuid = '')
  EXECUTE FUNCTION generate_payment_id();

-- 3) Cascade update for ledger references
ALTER TABLE payments_ledger
  DROP CONSTRAINT IF EXISTS fk_payment_ledger_payment;
ALTER TABLE payments_ledger
  ADD CONSTRAINT fk_payment_ledger_payment
  FOREIGN KEY (payment_id) REFERENCES payments(payment_id)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) Format constraints (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_payment_id_format_check'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_payment_id_format_check
      CHECK (payment_id ~ '^[0-9a-f]{6}_[0-9a-f]{2}_[0-9a-f]{6}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_record_uuid_format_check'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_record_uuid_format_check
      CHECK (record_uuid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
  END IF;
END $$;
