const { Client } = require('pg');

async function migrate() {
  const client = new Client({
    connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1'
  });

  try {
    await client.connect();
    console.log('Connected to Supabase database');

    console.log('\n1. Adding condition_script column...');
    await client.query(`
      ALTER TABLE parsing_scheme_rules 
      ADD COLUMN IF NOT EXISTS condition_script TEXT;
    `);
    console.log('✓ condition_script column added');

    console.log('\n2. Making column_name nullable...');
    await client.query(`
      ALTER TABLE parsing_scheme_rules 
      ALTER COLUMN column_name DROP NOT NULL;
    `);
    console.log('✓ column_name is now nullable');

    console.log('\n3. Verifying schema...');
    const result = await client.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'parsing_scheme_rules'
      ORDER BY ordinal_position
    `);
    
    console.log('\nFinal Supabase schema:');
    result.rows.forEach(row => {
      console.log(`  ${row.column_name.padEnd(20)} ${row.data_type.padEnd(25)} nullable: ${row.is_nullable}`);
    });

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

migrate();
