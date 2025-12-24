-- Add unique constraint to payment_id in payments table
CREATE UNIQUE INDEX IF NOT EXISTS "payments_payment_id_key" ON "payments"("payment_id");

-- Create payments_ledger table
CREATE TABLE IF NOT EXISTS "payments_ledger" (
    "id" BIGSERIAL PRIMARY KEY,
    "payment_id" TEXT NOT NULL,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "accrual" DECIMAL(18,2),
    "order" DECIMAL(18,2),
    "record_uuid" UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    "user_email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "fk_payment_ledger_payment" 
        FOREIGN KEY ("payment_id") 
        REFERENCES "payments"("payment_id") 
        ON DELETE CASCADE,
    
    -- Ensure at least one of accrual or order is not null, and neither can be zero
    CONSTRAINT "check_accrual_or_order" 
        CHECK (
            ("accrual" IS NOT NULL AND "accrual" != 0) OR 
            ("order" IS NOT NULL AND "order" != 0)
        )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "payments_ledger_payment_id_idx" ON "payments_ledger"("payment_id");
CREATE INDEX IF NOT EXISTS "payments_ledger_effective_date_idx" ON "payments_ledger"("effective_date");

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_payments_ledger_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payments_ledger_updated_at
    BEFORE UPDATE ON payments_ledger
    FOR EACH ROW
    EXECUTE FUNCTION update_payments_ledger_updated_at();
