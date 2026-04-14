-- CreateTable: project_bundle_payments
CREATE TABLE IF NOT EXISTS "project_bundle_payments" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_uuid" UUID NOT NULL,
    "financial_code_uuid" UUID NOT NULL,
    "percentage" DECIMAL(5,2),
    "amount" DECIMAL(18,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_bundle_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "project_bundle_payments_uuid_key" ON "project_bundle_payments"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "uq_project_bundle_payments_project_fc" ON "project_bundle_payments"("project_uuid", "financial_code_uuid");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_bundle_payments_project_uuid_idx" ON "project_bundle_payments"("project_uuid");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_bundle_payments_financial_code_uuid_idx" ON "project_bundle_payments"("financial_code_uuid");