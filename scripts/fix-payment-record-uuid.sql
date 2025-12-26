-- Update the trigger function to use standard UUID for record_uuid
CREATE OR REPLACE FUNCTION generate_payment_id()
RETURNS TRIGGER AS $$
DECLARE
  existing_payment_id TEXT;
  new_payment_id TEXT;
  max_sequence INT;
BEGIN
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
    -- Generate new payment_id
    -- Format: P-{project_uuid_first8}-{counter_uuid_first8}-{fincode_uuid_first8}
    new_payment_id := 'P-' || 
                      substring(NEW.project_uuid::TEXT, 1, 8) || '-' ||
                      substring(NEW.counteragent_uuid::TEXT, 1, 8) || '-' ||
                      substring(NEW.financial_code_uuid::TEXT, 1, 8);
    NEW.payment_id := new_payment_id;
  END IF;
  
  -- Generate standard UUID for record_uuid
  NEW.record_uuid := gen_random_uuid()::TEXT;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
