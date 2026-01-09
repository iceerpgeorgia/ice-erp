const { Client } = require('pg');

async function migrateSupabase() {
  const client = new Client({
    connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1'
  });

  try {
    await client.connect();
    console.log('Connected to Supabase database');

    console.log('\n1. Making payment_id nullable...');
    await client.query(`
      ALTER TABLE parsing_scheme_rules 
      ALTER COLUMN payment_id DROP NOT NULL;
    `);
    console.log('✓ payment_id is now nullable');

    console.log('\n2. Adding counteragent_uuid column...');
    await client.query(`
      ALTER TABLE parsing_scheme_rules 
      ADD COLUMN IF NOT EXISTS counteragent_uuid UUID;
    `);
    console.log('✓ counteragent_uuid added');

    console.log('\n3. Adding financial_code_uuid column...');
    await client.query(`
      ALTER TABLE parsing_scheme_rules 
      ADD COLUMN IF NOT EXISTS financial_code_uuid UUID;
    `);
    console.log('✓ financial_code_uuid added');

    console.log('\n4. Adding nominal_currency_uuid column...');
    await client.query(`
      ALTER TABLE parsing_scheme_rules 
      ADD COLUMN IF NOT EXISTS nominal_currency_uuid UUID;
    `);
    console.log('✓ nominal_currency_uuid added');

    console.log('\n5. Verifying schema...');
    const result = await client.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'parsing_scheme_rules'
      ORDER BY ordinal_position
    `);
    
    console.log('\nFinal Supabase schema:');
    result.rows.forEach(row => {
      console.log(`  ${row.column_name.padEnd(30)} ${row.data_type.padEnd(25)} nullable: ${row.is_nullable}`);
    });

    console.log('\n✅ Supabase migration completed successfully!');
  } catch (error) {
    console.error('❌ Supabase migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

migrateSupabase();
