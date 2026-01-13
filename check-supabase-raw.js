const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkSupabase() {
  const client = new Client({
    connectionString: process.env.REMOTE_DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Connected to Supabase\n');

    // Check raw table
    const rawResult = await client.query(`
      SELECT COUNT(*) as count
      FROM bog_gel_raw_893486000
    `);
    
    console.log('Supabase raw table count:', rawResult.rows[0].count);
    
    // Check consolidated table
    const consResult = await client.query(`
      SELECT COUNT(*) as count
      FROM consolidated_bank_accounts
    `);
    
    console.log('Supabase consolidated count:', consResult.rows[0].count);
    
    // Check how many have counteragent accounts
    const accountResult = await client.query(`
      SELECT COUNT(*) as with_account
      FROM consolidated_bank_accounts
      WHERE counteragent_account_number IS NOT NULL
    `);
    
    console.log('With counteragent account:', accountResult.rows[0].with_account);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkSupabase();
