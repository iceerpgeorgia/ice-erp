const { Client } = require('pg');
const fs = require('fs');

async function applyToSupabase() {
  const client = new Client({
    connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres'
  });
  
  const migration = fs.readFileSync(
    'prisma/migrations/20251224000000_add_payments_table/migration.sql',
    'utf8'
  );
  
  try {
    console.log('Connecting to Supabase...');
    await client.connect();
    console.log('Connected. Applying migration...');
    await client.query(migration);
    console.log('✓ Migration applied successfully to Supabase');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

applyToSupabase().catch(console.error);
