-- CreateTable
CREATE TABLE "calculations_financial_codes" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "financial_code_uuid" UUID NOT NULL,
    "template_uuid" UUID NOT NULL,
    "template_name" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calculations_financial_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "calculations_financial_codes_uuid_key" ON "calculations_financial_codes"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "uq_calc_fc_template" ON "calculations_financial_codes"("financial_code_uuid", "template_uuid");

-- CreateIndex
CREATE INDEX "idx_calculations_fc_uuid" ON "calculations_financial_codes"("financial_code_uuid");

-- CreateIndex
CREATE INDEX "idx_calculations_template_uuid" ON "calculations_financial_codes"("template_uuid");

-- CreateIndex
CREATE INDEX "idx_calculations_is_active" ON "calculations_financial_codes"("is_active");

-- AddForeignKey
ALTER TABLE "calculations_financial_codes" ADD CONSTRAINT "calculations_financial_codes_financial_code_uuid_fkey" FOREIGN KEY ("financial_code_uuid") REFERENCES "financial_codes"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "calculations_financial_codes" ADD CONSTRAINT "calculations_financial_codes_template_uuid_fkey" FOREIGN KEY ("template_uuid") REFERENCES "templates"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION;
