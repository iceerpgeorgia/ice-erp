-- Migration: add dimensions, inventory_groups, inventories, rs_waybills_in_items
-- Date: 2026-03-02

-- 1. dimensions
CREATE TABLE IF NOT EXISTS "dimensions" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dimension" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dimensions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "dimensions_uuid_key" ON "dimensions"("uuid");
CREATE UNIQUE INDEX IF NOT EXISTS "dimensions_dimension_key" ON "dimensions"("dimension");

-- 2. inventory_groups
CREATE TABLE IF NOT EXISTS "inventory_groups" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "dimension_uuid" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_groups_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_groups_uuid_key" ON "inventory_groups"("uuid");
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_groups_name_key" ON "inventory_groups"("name");
CREATE INDEX IF NOT EXISTS "inventory_groups_dimension_uuid_idx" ON "inventory_groups"("dimension_uuid");

ALTER TABLE "inventory_groups" ADD CONSTRAINT "inventory_groups_dimension_uuid_fkey"
    FOREIGN KEY ("dimension_uuid") REFERENCES "dimensions"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. inventories
CREATE TABLE IF NOT EXISTS "inventories" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "producer_uuid" UUID,
    "inventory_group_uuid" UUID,
    "dimension_uuid" UUID,
    "internal_number" TEXT,
    "is_nonbalance" BOOLEAN NOT NULL DEFAULT false,
    "is_capex" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "inventories_uuid_key" ON "inventories"("uuid");
CREATE INDEX IF NOT EXISTS "inventories_producer_uuid_idx" ON "inventories"("producer_uuid");
CREATE INDEX IF NOT EXISTS "inventories_inventory_group_uuid_idx" ON "inventories"("inventory_group_uuid");
CREATE INDEX IF NOT EXISTS "inventories_dimension_uuid_idx" ON "inventories"("dimension_uuid");
CREATE INDEX IF NOT EXISTS "inventories_internal_number_idx" ON "inventories"("internal_number");

ALTER TABLE "inventories" ADD CONSTRAINT "inventories_inventory_group_uuid_fkey"
    FOREIGN KEY ("inventory_group_uuid") REFERENCES "inventory_groups"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_dimension_uuid_fkey"
    FOREIGN KEY ("dimension_uuid") REFERENCES "dimensions"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. rs_waybills_in_items
CREATE TABLE IF NOT EXISTS "rs_waybills_in_items" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "waybill_no" TEXT,
    "goods_code" TEXT,
    "goods_name" TEXT,
    "unit" TEXT,
    "quantity" DECIMAL(20,4),
    "unit_price" DECIMAL(20,4),
    "total_price" DECIMAL(20,2),
    "taxation" TEXT,
    "inventory_uuid" UUID,
    "project_uuid" UUID,
    "financial_code_uuid" UUID,
    "corresponding_account" TEXT,
    "import_batch_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rs_waybills_in_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "rs_waybills_in_items_uuid_key" ON "rs_waybills_in_items"("uuid");
CREATE INDEX IF NOT EXISTS "rs_waybills_in_items_waybill_no_idx" ON "rs_waybills_in_items"("waybill_no");
CREATE INDEX IF NOT EXISTS "rs_waybills_in_items_inventory_uuid_idx" ON "rs_waybills_in_items"("inventory_uuid");
CREATE INDEX IF NOT EXISTS "rs_waybills_in_items_project_uuid_idx" ON "rs_waybills_in_items"("project_uuid");
CREATE INDEX IF NOT EXISTS "rs_waybills_in_items_financial_code_uuid_idx" ON "rs_waybills_in_items"("financial_code_uuid");
CREATE INDEX IF NOT EXISTS "rs_waybills_in_items_goods_code_idx" ON "rs_waybills_in_items"("goods_code");

ALTER TABLE "rs_waybills_in_items" ADD CONSTRAINT "rs_waybills_in_items_inventory_uuid_fkey"
    FOREIGN KEY ("inventory_uuid") REFERENCES "inventories"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;
