-- Add new columns to payments table with defaults
ALTER TABLE "payments" ADD COLUMN "income_tax" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "payments" ADD COLUMN "currency_uuid" UUID;

-- Set a default currency for existing records (you may need to adjust this)
UPDATE "payments" SET "currency_uuid" = (SELECT uuid FROM currencies LIMIT 1) WHERE "currency_uuid" IS NULL;

-- Make currency_uuid NOT NULL after setting defaults
ALTER TABLE "payments" ALTER COLUMN "currency_uuid" SET NOT NULL;

-- Drop old unique constraint
DROP INDEX IF EXISTS "payments_project_uuid_counteragent_uuid_financial_code_uu_key";

-- Create index on currency_uuid
CREATE INDEX "payments_currency_uuid_idx" ON "payments"("currency_uuid");

-- Create new unique constraint with all 6 columns
CREATE UNIQUE INDEX "payments_project_uuid_counteragent_uuid_financial_code_uu_key" ON "payments"("project_uuid", "counteragent_uuid", "financial_code_uuid", "job_uuid", "income_tax", "currency_uuid");

-- Update the payment_id generation function to include new fields
CREATE OR REPLACE FUNCTION generate_payment_id()
RETURNS TRIGGER AS $$
DECLARE
  existing_payment_id TEXT;
  new_payment_id TEXT;
BEGIN
  -- Check if a payment_id already exists for this combination
  SELECT payment_id INTO existing_payment_id
  FROM payments
  WHERE project_uuid = NEW.project_uuid
    AND counteragent_uuid = NEW.counteragent_uuid
    AND financial_code_uuid = NEW.financial_code_uuid
    AND job_uuid = NEW.job_uuid
    AND income_tax = NEW.income_tax
    AND currency_uuid = NEW.currency_uuid
  LIMIT 1;
  
  IF existing_payment_id IS NOT NULL THEN
    -- Use existing payment_id for this combination
    NEW.payment_id := existing_payment_id;
  ELSE
    -- Generate new payment_id
    -- Format: P-{project_first8}-{counter_first8}-{fincode_first8}-{job_first8}-{tax}-{curr_first4}
    new_payment_id := 'P-' || 
                      substring(NEW.project_uuid::TEXT, 1, 8) || '-' ||
                      substring(NEW.counteragent_uuid::TEXT, 1, 8) || '-' ||
                      substring(NEW.financial_code_uuid::TEXT, 1, 8) || '-' ||
                      substring(NEW.job_uuid::TEXT, 1, 8) || '-' ||
                      CASE WHEN NEW.income_tax THEN 'T' ELSE 'F' END || '-' ||
                      substring(NEW.currency_uuid::TEXT, 1, 4);
    NEW.payment_id := new_payment_id;
  END IF;
  
  -- Generate custom record_uuid
  NEW.record_uuid := generate_custom_record_uuid();
  
  -- Ensure uniqueness (retry if collision)
  WHILE EXISTS (SELECT 1 FROM payments WHERE record_uuid = NEW.record_uuid) LOOP
    NEW.record_uuid := generate_custom_record_uuid();
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
