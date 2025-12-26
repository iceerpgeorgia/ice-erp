-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "account_number" TEXT NOT NULL,
    "currency_uuid" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_uuid_key" ON "bank_accounts"("uuid");

-- CreateIndex
CREATE INDEX "bank_accounts_currency_uuid_idx" ON "bank_accounts"("currency_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_account_number_currency_uuid_key" ON "bank_accounts"("account_number", "currency_uuid");

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_currency_uuid_fkey" FOREIGN KEY ("currency_uuid") REFERENCES "currencies"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;
