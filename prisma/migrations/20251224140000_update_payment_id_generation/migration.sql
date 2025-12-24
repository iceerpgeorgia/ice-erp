-- Update payment_id generation to use custom UUID format (same as record_uuid)
-- Instead of combination-based ID, generate unique random ID

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
  
  -- Add first underscore
  new_payment_id := new_payment_id || '_';
  
  -- Generate 2 more random hex characters
  FOR i IN 1..2 LOOP
    random_val := floor(random() * 16)::INT;
    new_payment_id := new_payment_id || substr(hex_chars, random_val + 1, 1);
  END LOOP;
  
  -- Add second underscore
  new_payment_id := new_payment_id || '_';
  
  -- Generate 4 more random hex characters
  FOR i IN 1..4 LOOP
    random_val := floor(random() * 16)::INT;
    new_payment_id := new_payment_id || substr(hex_chars, random_val + 1, 1);
  END LOOP;
  
  NEW.payment_id := new_payment_id;
  
  -- Generate custom record_uuid
  NEW.record_uuid := generate_custom_record_uuid();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: Existing payment_ids will keep their current values
-- Only new payments will get the new format
