const { Client } = require('pg');
const fs = require('fs');

async function applyMigration() {
  const local = new Client({
    connectionString: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP'
  });

  const supabase = new Client({
    connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres'
  });
  
  const migration = fs.readFileSync(
    'prisma/migrations/20251224130000_add_payments_ledger_table/migration.sql',
    'utf8'
  );
  
  // Apply to LOCAL
  try {
    console.log('Applying to LOCAL...');
    await local.connect();
    await local.query(migration);
    console.log('✓ Migration applied successfully to LOCAL');
  } catch (error) {
    console.error('✗ Error on LOCAL:', error.message);
  } finally {
    try {
      await local.end();
    } catch (e) {
      // Ignore connection close errors
    }
  }

  // Apply to SUPABASE
  try {
    console.log('\nApplying to SUPABASE...');
    await supabase.connect();
    await supabase.query(migration);
    console.log('✓ Migration applied successfully to SUPABASE');
  } catch (error) {
    console.error('✗ Error on SUPABASE:', error.message);
  } finally {
    try {
      await supabase.end();
    } catch (e) {
      // Ignore connection close errors
    }
  }

  console.log('\nMigration process completed.');
  process.exit(0);
}

applyMigration().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
