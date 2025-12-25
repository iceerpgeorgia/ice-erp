-- AlterTable: Make project_uuid and job_uuid nullable in payments
ALTER TABLE "payments" ALTER COLUMN "project_uuid" DROP NOT NULL;
ALTER TABLE "payments" ALTER COLUMN "job_uuid" DROP NOT NULL;
