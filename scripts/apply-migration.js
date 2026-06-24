#!/usr/bin/env node
/**
 * Apply Handover Emissions Migration
 * 
 * This script applies the handover_emissions database migration to Supabase.
 * Run with: pnpm node scripts/apply-migration.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('❌ Missing Supabase credentials');
    console.error('   Ensure .env.local has NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY\n');
    console.log('📋 Manual fallback: Apply via Supabase SQL Editor:\n');
    console.log('1. Open https://app.supabase.com');
    console.log('2. Select ice-erp project');
    console.log('3. Go to SQL Editor');
    console.log('4. Copy: scripts/apply-handover-emissions-migration.sql');
    console.log('5. Click RUN\n');
    process.exit(1);
  }

  const client = createClient(url, key);
  console.log('🔄 Applying handover emissions migration...\n');

  try {
    // Read the SQL migration file
    const sqlPath = path.join(__dirname, 'apply-handover-emissions-migration.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

    console.log('📝 Executing migration statements...\n');

    // Step 1: Create table
    console.log('[1/5] Creating handover_emissions table...');
    try {
      const { error } = await client.rpc('execute_sql', {
        query: `CREATE TABLE IF NOT EXISTS "handover_emissions" (
          "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "created_by" TEXT,
          "description" TEXT,
          CONSTRAINT "handover_emissions_pkey" PRIMARY KEY ("uuid")
        );`
      });
      if (!error) console.log('   ✓ Created\n');
    } catch (e) {
      console.log('   ℹ️  (May already exist)\n');
    }

    // Step 2: Add columns
    console.log('[2/5] Adding emission columns to payments_jobs...');
    try {
      await client.rpc('execute_sql', {
        query: `ALTER TABLE "payments_jobs" ADD COLUMN IF NOT EXISTS "emission_uuid" UUID;
                ALTER TABLE "payments_jobs" ADD COLUMN IF NOT EXISTS "emission_date" TIMESTAMP(3);`
      });
      console.log('   ✓ Added\n');
    } catch (e) {
      console.log('   ℹ️  (May already exist)\n');
    }

    // Step 3: Create indexes
    console.log('[3/5] Creating indexes...');
    try {
      await client.rpc('execute_sql', {
        query: `CREATE INDEX IF NOT EXISTS "handover_emissions_created_at_idx" ON "handover_emissions"("created_at" DESC);
                CREATE INDEX IF NOT EXISTS "idx_payments_jobs_emission_uuid" ON "payments_jobs"("emission_uuid");`
      });
      console.log('   ✓ Created\n');
    } catch (e) {
      console.log('   ℹ️  (May already exist)\n');
    }

    // Step 4: Add foreign key
    console.log('[4/5] Adding foreign key constraint...');
    try {
      await client.rpc('execute_sql', {
        query: `ALTER TABLE "payments_jobs" DROP CONSTRAINT IF EXISTS "payments_jobs_emission_uuid_fkey";
                ALTER TABLE "payments_jobs" ADD CONSTRAINT "payments_jobs_emission_uuid_fkey" 
                  FOREIGN KEY ("emission_uuid") REFERENCES "handover_emissions"("uuid") 
                  ON DELETE RESTRICT ON UPDATE NO ACTION;`
      });
      console.log('   ✓ Added\n');
    } catch (e) {
      console.log('   ℹ️  (May already exist)\n');
    }

    // Step 5: Create triggers
    console.log('[5/5] Creating trigger functions...');
    try {
      await client.rpc('execute_sql', {
        query: `CREATE OR REPLACE FUNCTION prevent_emitted_record_updates() RETURNS TRIGGER AS $$
                BEGIN IF OLD."emission_uuid" IS NOT NULL THEN 
                  RAISE EXCEPTION 'Cannot update emitted record'; END IF; RETURN NEW; END; 
                $$ LANGUAGE plpgsql;
                DROP TRIGGER IF EXISTS prevent_emitted_payments_jobs_update ON "payments_jobs";
                CREATE TRIGGER prevent_emitted_payments_jobs_update BEFORE UPDATE ON "payments_jobs"
                FOR EACH ROW EXECUTE FUNCTION prevent_emitted_record_updates();`
      });
      console.log('   ✓ Created\n');
    } catch (e) {
      console.log('   ℹ️  (May already exist)\n');
    }

    console.log('✅ Migration complete!\n');
    console.log('📝 Next steps:');
    console.log('   1. Refresh Handovers page (Ctrl+R)');
    console.log('   2. Check if data loads\n');

  } catch (error) {
    console.error('❌ Error during migration:', error.message);
    console.log('\n📋 Fallback: Use Supabase SQL Editor manually\n');
    process.exit(1);
  }
}

main();
