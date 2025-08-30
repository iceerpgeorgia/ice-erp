-- CreateEnum
CREATE TYPE "public"."Sex" AS ENUM ('male', 'female', 'other');

-- DropIndex
DROP INDEX "public"."Account_userId_idx";

-- DropIndex
DROP INDEX "public"."Session_userId_idx";

-- CreateTable
CREATE TABLE "public"."counteragents" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "ts" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "counteragent_uuid" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "first_name" TEXT,
    "middle_name" TEXT,
    "last_name" TEXT,
    "sex" "public"."Sex",
    "identification_number" TEXT,
    "birth_date" TIMESTAMP(3),
    "foundation_date" TIMESTAMP(3),
    "email" TEXT,
    "phone" TEXT,
    "official_webpage" TEXT,
    "legal_address" TEXT,
    "actual_address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "has_signing_authority" BOOLEAN NOT NULL DEFAULT false,
    "country_uuid" UUID NOT NULL,
    "entity_type_uuid" UUID NOT NULL,

    CONSTRAINT "counteragents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "counteragents_counteragent_uuid_key" ON "public"."counteragents"("counteragent_uuid");

-- CreateIndex
CREATE INDEX "idx_counteragents_country_uuid" ON "public"."counteragents"("country_uuid");

-- CreateIndex
CREATE INDEX "idx_counteragents_entity_type_uuid" ON "public"."counteragents"("entity_type_uuid");

-- AddForeignKey
ALTER TABLE "public"."counteragents" ADD CONSTRAINT "counteragents_country_uuid_fkey" FOREIGN KEY ("country_uuid") REFERENCES "public"."countries"("country_uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."counteragents" ADD CONSTRAINT "counteragents_entity_type_uuid_fkey" FOREIGN KEY ("entity_type_uuid") REFERENCES "public"."entity_types"("entity_type_uuid") ON DELETE RESTRICT ON UPDATE CASCADE;
