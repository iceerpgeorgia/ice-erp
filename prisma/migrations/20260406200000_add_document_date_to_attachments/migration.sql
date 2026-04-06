-- AlterTable
ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "document_date" TIMESTAMP(3);
