const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const migration = `
-- CreateTable templates
CREATE TABLE IF NOT EXISTS "templates" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "operation_type" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "storage_provider" TEXT NOT NULL DEFAULT 'supabase',
    "storage_bucket" TEXT,
    "storage_path" TEXT NOT NULL,
    "file_size_bytes" BIGINT,
    "file_hash_sha256" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "templates_uuid_key" ON "templates"("uuid");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_templates_operation_type" ON "templates"("operation_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_templates_is_active" ON "templates"("is_active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_templates_created_at" ON "templates"("created_at");

-- CreateIndex for operation_type + is_active lookup
CREATE INDEX IF NOT EXISTS "idx_templates_operation_active" ON "templates"("operation_type", "is_active");

-- Create trigger to enforce only one active template per operation_type
CREATE OR REPLACE FUNCTION enforce_one_active_template_per_operation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE "templates"
    SET is_active = false, updated_at = CURRENT_TIMESTAMP
    WHERE operation_type = NEW.operation_type
      AND is_active = true
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS enforce_one_active_template_per_operation_trigger ON "templates";

CREATE TRIGGER enforce_one_active_template_per_operation_trigger
BEFORE INSERT OR UPDATE ON "templates"
FOR EACH ROW
EXECUTE FUNCTION enforce_one_active_template_per_operation();
`;

async function applyMigration() {
  const client = await pool.connect();
  try {
    console.log('Connecting to database...');
    await client.query('SELECT 1');
    console.log('✓ Connected successfully');

    console.log('\nApplying templates migration...');
    await client.query(migration);
    console.log('✓ Migration applied successfully');

    // Verify table was created
    const result = await client.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'templates');`
    );
    if (result.rows[0].exists) {
      console.log('✓ Templates table verified in database');
    } else {
      console.error('✗ Templates table not found after migration');
      process.exit(1);
    }
  } catch (error) {
    console.error('✗ Error applying migration:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    await pool.end();
  }
}

applyMigration();
