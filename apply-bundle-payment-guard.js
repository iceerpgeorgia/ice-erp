/**
 * Apply database guard: partial unique index on payments table
 * Prevents duplicate bundle child payments (same project + financial code)
 * and duplicate project-derived payments (same project + financial code, non-bundle).
 * 
 * Run: node apply-bundle-payment-guard.js
 */
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DIRECT_DATABASE_URL;
if (!connectionString) {
  console.error('DIRECT_DATABASE_URL not found in .env.local');
  process.exit(1);
}

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected to Supabase.');

  try {
    // 1. Partial unique index: one bundle-child payment per (project, financial_code)
    console.log('\n[1/3] Creating partial unique index for bundle payments...');
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS payments_bundle_child_unique
        ON payments (project_uuid, financial_code_uuid)
        WHERE is_bundle_payment = true
    `);
    console.log('  ✓ payments_bundle_child_unique created (or already exists).');

    // 2. Partial unique index: one project-derived (non-bundle) payment per (project, financial_code)
    console.log('\n[2/3] Creating partial unique index for project-derived payments...');
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS payments_project_derived_unique
        ON payments (project_uuid, financial_code_uuid)
        WHERE is_project_derived = true AND is_bundle_payment = false
    `);
    console.log('  ✓ payments_project_derived_unique created (or already exists).');

    // 3. Verify
    console.log('\n[3/3] Verifying indexes...');
    const { rows } = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'payments'
        AND indexname IN ('payments_bundle_child_unique', 'payments_project_derived_unique')
      ORDER BY indexname
    `);
    for (const row of rows) {
      console.log(`  ✓ ${row.indexname}`);
      console.log(`    ${row.indexdef}`);
    }

    if (rows.length < 2) {
      console.warn('\n⚠ Expected 2 indexes but found', rows.length);
    } else {
      console.log('\n✅ All database guards applied successfully.');
    }
  } catch (err) {
    console.error('Error applying guard:', err.message);
    throw err;
  } finally {
    await client.end();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
