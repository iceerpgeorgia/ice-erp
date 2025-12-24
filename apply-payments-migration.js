const { Client } = require('pg');
const fs = require('fs');

async function applyMigration() {
  const local = new Client({
    connectionString: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP'
  });
  
  const supabase = new Client({
    connectionString: 'postgresql://postgres.iceerpgeorgia:fulebimojviT1985%25@aws-0-eu-central-1.pooler.supabase.com:6543/postgres'
  });
  
  const migration = fs.readFileSync(
    'prisma/migrations/20251224000000_add_payments_table/migration.sql',
    'utf8'
  );
  
  try {
    console.log('\n=== Applying to LOCAL ===');
    await local.connect();
    await local.query(migration);
    console.log('✓ Migration applied successfully');
    await local.end();
  } catch (error) {
    console.error('Error on LOCAL:', error.message);
  }
  
  try {
    console.log('\n=== Applying to SUPABASE ===');
    await supabase.connect();
    await supabase.query(migration);
    console.log('✓ Migration applied successfully');
    await supabase.end();
  } catch (error) {
    console.error('Error on SUPABASE:', error.message);
  }
}

applyMigration().catch(console.error);
