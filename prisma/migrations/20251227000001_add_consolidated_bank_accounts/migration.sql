-- CreateTable
CREATE TABLE "consolidated_bank_accounts" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "account_uuid" UUID NOT NULL,
    "account_currency_uuid" UUID NOT NULL,
    "account_currency_amount" DECIMAL(18,2) NOT NULL,
    "payment_uuid" UUID,
    "counteragent_uuid" UUID,
    "project_uuid" UUID,
    "financial_code_uuid" UUID,
    "nominal_currency_uuid" UUID,
    "nominal_amount" DECIMAL(18,2),
    "date" DATE NOT NULL,
    "correction_date" DATE,
    "id_1" TEXT,
    "id_2" TEXT,
    "record_uuid" TEXT NOT NULL,
    "counteragent_account_number" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consolidated_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consolidated_bank_accounts_uuid_key" ON "consolidated_bank_accounts"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "consolidated_bank_accounts_id_1_id_2_key" ON "consolidated_bank_accounts"("id_1", "id_2");

-- CreateIndex
CREATE INDEX "consolidated_bank_accounts_account_uuid_idx" ON "consolidated_bank_accounts"("account_uuid");

-- CreateIndex
CREATE INDEX "consolidated_bank_accounts_counteragent_uuid_idx" ON "consolidated_bank_accounts"("counteragent_uuid");

-- CreateIndex
CREATE INDEX "consolidated_bank_accounts_payment_uuid_idx" ON "consolidated_bank_accounts"("payment_uuid");

-- CreateIndex
CREATE INDEX "consolidated_bank_accounts_project_uuid_idx" ON "consolidated_bank_accounts"("project_uuid");

-- CreateIndex
CREATE INDEX "consolidated_bank_accounts_financial_code_uuid_idx" ON "consolidated_bank_accounts"("financial_code_uuid");

-- CreateIndex
CREATE INDEX "consolidated_bank_accounts_date_idx" ON "consolidated_bank_accounts"("date");

-- AddForeignKey
ALTER TABLE "consolidated_bank_accounts" ADD CONSTRAINT "consolidated_bank_accounts_account_uuid_fkey" FOREIGN KEY ("account_uuid") REFERENCES "bank_accounts"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;
