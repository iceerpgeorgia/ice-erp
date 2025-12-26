-- Change record_uuid in payments table to use standard UUID format
-- First, drop the existing trigger if it exists
DROP TRIGGER IF EXISTS set_payment_id_trigger ON payments;
DROP FUNCTION IF EXISTS set_payment_id();

-- Create new trigger function that only generates payment_id, not record_uuid
CREATE OR REPLACE FUNCTION set_payment_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.payment_id IS NULL THEN
        NEW.payment_id := 
            LPAD(TO_HEX(FLOOR(RANDOM() * 16777215)::INT), 6, '0') || '_' ||
            LPAD(TO_HEX(FLOOR(RANDOM() * 255)::INT), 2, '0') || '_' ||
            LPAD(TO_HEX(FLOOR(RANDOM() * 65535)::INT), 4, '0');
    END IF;
    
    -- Generate standard UUID for record_uuid if NULL
    IF NEW.record_uuid IS NULL THEN
        NEW.record_uuid := gen_random_uuid();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER set_payment_id_trigger
    BEFORE INSERT ON payments
    FOR EACH ROW
    EXECUTE FUNCTION set_payment_id();

-- Update existing records to use standard UUID format for record_uuid
UPDATE payments 
SET record_uuid = gen_random_uuid()
WHERE record_uuid IS NOT NULL;

COMMENT ON COLUMN payments.record_uuid IS 'Standard UUID format for record identification';
COMMENT ON COLUMN payments.payment_id IS 'Custom format: 6hex_2hex_4hex for payment identification';
