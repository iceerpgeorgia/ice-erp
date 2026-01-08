-- Create parsing_schemes table
CREATE TABLE "parsing_schemes" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parsing_schemes_pkey" PRIMARY KEY ("id")
);

-- Create bank_accounts_parsing_rules table
CREATE TABLE "bank_accounts_parsing_rules" (
    "id" BIGSERIAL NOT NULL,
    "parsing_scheme_id" BIGINT NOT NULL,
    "column_name" VARCHAR(100) NOT NULL,
    "condition_operator" VARCHAR(50) NOT NULL,
    "condition_value" TEXT,
    "payment_id" VARCHAR(255) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_parsing_rules_pkey" PRIMARY KEY ("id")
);

-- Add parsing_scheme_id to bank_accounts table
ALTER TABLE "bank_accounts" ADD COLUMN "parsing_scheme_id" BIGINT;

-- Create unique constraints
CREATE UNIQUE INDEX "parsing_schemes_name_key" ON "parsing_schemes"("name");

-- Create indexes
CREATE INDEX "bank_accounts_parsing_rules_parsing_scheme_id_idx" ON "bank_accounts_parsing_rules"("parsing_scheme_id");
CREATE INDEX "bank_accounts_parsing_rules_priority_idx" ON "bank_accounts_parsing_rules"("priority");
CREATE INDEX "bank_accounts_parsing_rules_is_active_idx" ON "bank_accounts_parsing_rules"("is_active");
CREATE INDEX "bank_accounts_parsing_scheme_id_idx" ON "bank_accounts"("parsing_scheme_id");

-- Add foreign key constraints
ALTER TABLE "bank_accounts_parsing_rules" ADD CONSTRAINT "bank_accounts_parsing_rules_parsing_scheme_id_fkey" FOREIGN KEY ("parsing_scheme_id") REFERENCES "parsing_schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_parsing_scheme_id_fkey" FOREIGN KEY ("parsing_scheme_id") REFERENCES "parsing_schemes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Insert initial parsing scheme: BOG_GEL
INSERT INTO "parsing_schemes" ("name", "description", "is_active", "updated_at") 
VALUES ('BOG_GEL', 'Bank of Georgia - GEL accounts standard parsing scheme', true, CURRENT_TIMESTAMP);

-- Update existing BOG GEL bank accounts to use BOG_GEL scheme
-- This assumes you have a way to identify BOG accounts, adjust the WHERE clause as needed
UPDATE "bank_accounts" ba
SET "parsing_scheme_id" = (SELECT id FROM "parsing_schemes" WHERE name = 'BOG_GEL')
WHERE ba."bank_uuid" IN (
    SELECT uuid FROM "banks" WHERE name ILIKE '%Bank of Georgia%' OR name ILIKE '%BOG%'
)
AND ba."currency_uuid" IN (
    SELECT uuid FROM "currencies" WHERE code = 'GEL'
);
