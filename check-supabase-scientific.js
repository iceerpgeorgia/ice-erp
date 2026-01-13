const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkSupabase() {
  const client = new Client({
    connectionString: process.env.REMOTE_DATABASE_URL
  });

  try {
    await client.connect();
    
    // Check if Supabase also has scientific notation
    const result = await client.query(`
      SELECT COUNT(*) as count
      FROM consolidated_bank_accounts
      WHERE counteragent_account_number LIKE '%e+%' OR counteragent_account_number LIKE '%e-%'
    `);
    
    console.log(`Supabase records with scientific notation: ${result.rows[0].count}`);
    
    if (result.rows[0].count > 0) {
      const samples = await client.query(`
        SELECT id, counteragent_account_number, transaction_date
        FROM consolidated_bank_accounts
        WHERE counteragent_account_number LIKE '%e+%' OR counteragent_account_number LIKE '%e-%'
        LIMIT 5
      `);
      
      console.log('\nSample bad records in Supabase:');
      samples.rows.forEach(r => console.log(`  ID ${r.id}: ${r.counteragent_account_number}`));
      
      console.log('\n❌ Supabase also has corrupted data!');
      console.log('📋 Need to fix data at source (raw table)');
    } else {
      console.log('\n✅ Supabase data is clean');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkSupabase();
