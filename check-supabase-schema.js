const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkSchema() {
  const client = new Client({
    connectionString: process.env.REMOTE_DATABASE_URL
  });

  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'consolidated_bank_accounts'
      ORDER BY ordinal_position
    `);
    
    console.log('Supabase consolidated_bank_accounts columns:');
    result.rows.forEach((r, i) => console.log(`${i + 1}. ${r.column_name}`));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkSchema();
