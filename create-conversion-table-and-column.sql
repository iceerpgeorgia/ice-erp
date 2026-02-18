-- Add conversion_id to deconsolidated tables
ALTER TABLE "GE78BG0000000893486000_BOG_GEL" ADD COLUMN IF NOT EXISTS conversion_id uuid;
ALTER TABLE "GE74BG0000000586388146_BOG_USD" ADD COLUMN IF NOT EXISTS conversion_id uuid;
ALTER TABLE "GE78BG0000000893486000_BOG_USD" ADD COLUMN IF NOT EXISTS conversion_id uuid;
ALTER TABLE "GE78BG0000000893486000_BOG_EUR" ADD COLUMN IF NOT EXISTS conversion_id uuid;
ALTER TABLE "GE78BG0000000893486000_BOG_AED" ADD COLUMN IF NOT EXISTS conversion_id uuid;
ALTER TABLE "GE78BG0000000893486000_BOG_GBP" ADD COLUMN IF NOT EXISTS conversion_id uuid;
ALTER TABLE "GE78BG0000000893486000_BOG_KZT" ADD COLUMN IF NOT EXISTS conversion_id uuid;
ALTER TABLE "GE78BG0000000893486000_BOG_CNY" ADD COLUMN IF NOT EXISTS conversion_id uuid;
ALTER TABLE "GE78BG0000000893486000_BOG_TRY" ADD COLUMN IF NOT EXISTS conversion_id uuid;

-- Create conversion table
CREATE TABLE IF NOT EXISTS "conversion" (
  id bigserial PRIMARY KEY,
  uuid uuid NOT NULL DEFAULT gen_random_uuid(),
  date date NOT NULL,
  key_value text NOT NULL,
  bank_uuid uuid,
  account_out_uuid uuid NOT NULL,
  account_in_uuid uuid NOT NULL,
  currency_out_uuid uuid NOT NULL,
  currency_in_uuid uuid NOT NULL,
  amount_out numeric(20, 6) NOT NULL,
  amount_in numeric(20, 6) NOT NULL,
  fee numeric(20, 6),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "conversion" ADD COLUMN IF NOT EXISTS bank_uuid uuid;

CREATE UNIQUE INDEX IF NOT EXISTS conversion_key_unique
  ON "conversion" (key_value, account_out_uuid, account_in_uuid);

CREATE INDEX IF NOT EXISTS conversion_date_idx ON "conversion" (date);
CREATE INDEX IF NOT EXISTS conversion_key_idx ON "conversion" (key_value);
CREATE INDEX IF NOT EXISTS conversion_bank_uuid_idx ON "conversion" (bank_uuid);

UPDATE "conversion"
SET bank_uuid = (SELECT uuid FROM banks WHERE bank_name = 'BOG' LIMIT 1)
WHERE bank_uuid IS NULL;
