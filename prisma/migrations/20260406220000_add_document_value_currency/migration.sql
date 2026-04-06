-- AlterTable
ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "document_value" DECIMAL(15,2);
ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "document_currency_uuid" UUID;
