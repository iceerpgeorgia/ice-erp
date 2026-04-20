CREATE TABLE IF NOT EXISTS "payment_bundles" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "label" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payment_bundles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_bundles_uuid_key" ON "payment_bundles"("uuid");

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "payment_bundle_uuid" UUID;

CREATE INDEX IF NOT EXISTS "payments_payment_bundle_uuid_idx" ON "payments"("payment_bundle_uuid");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_payment_bundle_uuid_fkey') THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_bundle_uuid_fkey" FOREIGN KEY ("payment_bundle_uuid") REFERENCES "payment_bundles"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
