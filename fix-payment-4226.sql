-- Fix Payment #4226 - Install triggers and backfill missing IDs

-- 1. Install trigger function
CREATE OR REPLACE FUNCTION generate_payment_id()
RETURNS TRIGGER AS $$
DECLARE
  hex_chars TEXT := '0123456789abcdef';
  new_payment_id TEXT := '';
  i INT;
  random_val INT;
BEGIN
  -- Generate 6 random hex characters
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
  
  NEW.payment_id := new_payment_id;
  NEW.record_uuid := gen_random_uuid()::text;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Attach trigger to payments table
DROP TRIGGER IF EXISTS payment_id_trigger ON payments;
CREATE TRIGGER payment_id_trigger
  BEFORE INSERT ON payments
  FOR EACH ROW
  WHEN (NEW.payment_id IS NULL OR NEW.payment_id = '')
  EXECUTE FUNCTION generate_payment_id();

-- 3. Backfill payment #4226 (generate IDs manually)
UPDATE payments 
SET 
  payment_id = substring(md5(random()::text) from 1 for 6) || '_' || 
               substring(md5(random()::text) from 1 for 2) || '_' || 
               substring(md5(random()::text) from 1 for 6),
  record_uuid = gen_random_uuid()::text
WHERE id = 4226 
AND (payment_id IS NULL OR payment_id = '' OR record_uuid IS NULL OR record_uuid = '');

-- 4. Verify payment #4226
SELECT id, payment_id, record_uuid FROM payments WHERE id = 4226;
