-- CreateTable
CREATE TABLE "payments" (
    "id" BIGSERIAL NOT NULL,
    "project_uuid" UUID NOT NULL,
    "counteragent_uuid" UUID NOT NULL,
    "financial_code_uuid" UUID NOT NULL,
    "job_uuid" UUID NOT NULL,
    "payment_id" TEXT NOT NULL,
    "record_uuid" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_record_uuid_key" ON "payments"("record_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "payments_project_uuid_counteragent_uuid_financial_code_uu_key" ON "payments"("project_uuid", "counteragent_uuid", "financial_code_uuid");

-- CreateIndex
CREATE INDEX "payments_project_uuid_idx" ON "payments"("project_uuid");

-- CreateIndex
CREATE INDEX "payments_counteragent_uuid_idx" ON "payments"("counteragent_uuid");

-- CreateIndex
CREATE INDEX "payments_financial_code_uuid_idx" ON "payments"("financial_code_uuid");

-- CreateIndex
CREATE INDEX "payments_job_uuid_idx" ON "payments"("job_uuid");

-- Function to generate custom record_uuid (Excel formula equivalent)
CREATE OR REPLACE FUNCTION generate_custom_record_uuid()
RETURNS TEXT AS $$
DECLARE
  hex_chars TEXT := '0123456789abcdef';
  result TEXT := '';
  i INT;
  random_val INT;
BEGIN
  -- Generate 6 random hex characters
  FOR i IN 1..6 LOOP
    random_val := floor(random() * 16)::INT;
    result := result || substr(hex_chars, random_val + 1, 1);
  END LOOP;
  
  -- Add first underscore
  result := result || '_';
  
  -- Generate 2 more random hex characters
  FOR i IN 1..2 LOOP
    random_val := floor(random() * 16)::INT;
    result := result || substr(hex_chars, random_val + 1, 1);
  END LOOP;
  
  -- Add second underscore
  result := result || '_';
  
  -- Generate 4 more random hex characters
  FOR i IN 1..4 LOOP
    random_val := floor(random() * 16)::INT;
    result := result || substr(hex_chars, random_val + 1, 1);
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to generate payment_id for unique combination
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
  
  -- Generate custom record_uuid
  NEW.record_uuid := generate_custom_record_uuid();
  
  -- Ensure uniqueness (retry if collision)
  WHILE EXISTS (SELECT 1 FROM payments WHERE record_uuid = NEW.record_uuid) LOOP
    NEW.record_uuid := generate_custom_record_uuid();
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payment_id and record_uuid generation
CREATE TRIGGER set_payment_identifiers
BEFORE INSERT ON payments
FOR EACH ROW
EXECUTE FUNCTION generate_payment_id();
