-- CreateTable
CREATE TABLE "banks" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "bank_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "banks_uuid_key" ON "banks"("uuid");

-- AlterTable
ALTER TABLE "bank_accounts" ADD COLUMN "bank_uuid" UUID;

-- CreateIndex
CREATE INDEX "bank_accounts_bank_uuid_idx" ON "bank_accounts"("bank_uuid");

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_bank_uuid_fkey" FOREIGN KEY ("bank_uuid") REFERENCES "banks"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;
