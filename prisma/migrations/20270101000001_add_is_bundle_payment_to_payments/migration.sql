-- Add is_bundle_payment column to payments table
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "is_bundle_payment" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "payments_is_bundle_payment_idx" ON "payments"("is_bundle_payment") WHERE "is_bundle_payment" = true;
