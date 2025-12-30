-- Update the trigger function to match import template format for payment_id
-- and use standard UUID for record_uuid
CREATE OR REPLACE FUNCTION generate_payment_id()
RETURNS TRIGGER AS $$
DECLARE
  existing_payment_id TEXT;
  new_payment_id TEXT;
  hex_chars TEXT := '0123456789abcdef';
  result TEXT := '';
  i INT;
  random_val INT;
BEGIN
  -- Only generate payment_id if it's empty or null
  IF NEW.payment_id IS NULL OR NEW.payment_id = '' THEN
    -- Check if a payment_id already exists for this combination
    SELECT payment_id INTO existing_payment_id
    FROM payments
    WHERE project_uuid = NEW.project_uuid
      AND counteragent_uuid = NEW.counteragent_uuid
      AND financial_code_uuid = NEW.financial_code_uuid
    LIMIT 1;
    
    IF existing_payment_id IS NOT NULL THEN
      -- Use existing payment_id for this combination
      NEW.payment_id := existing_payment_id;
    ELSE
      -- Generate new payment_id in format: xxxxxx_xx_xxxxxx (matching import template)
      -- Part 1: 6 hex characters
      FOR i IN 1..6 LOOP
        random_val := floor(random() * 16)::INT;
        result := result || substr(hex_chars, random_val + 1, 1);
      END LOOP;
      
      result := result || '_';
      
      -- Part 2: 2 hex characters
      FOR i IN 1..2 LOOP
        random_val := floor(random() * 16)::INT;
        result := result || substr(hex_chars, random_val + 1, 1);
      END LOOP;
      
      result := result || '_';
      
      -- Part 3: 6 hex characters
      FOR i IN 1..6 LOOP
        random_val := floor(random() * 16)::INT;
        result := result || substr(hex_chars, random_val + 1, 1);
      END LOOP;
      
      NEW.payment_id := result;
    END IF;
  END IF;
  
  -- Only generate record_uuid if it's empty or null
  IF NEW.record_uuid IS NULL OR NEW.record_uuid = '' THEN
    NEW.record_uuid := gen_random_uuid()::TEXT;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
