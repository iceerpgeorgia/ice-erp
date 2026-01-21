require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function checkStatus() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not found');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });

  try {
    console.log('\n========================================');
    console.log('  CONSOLIDATED TABLE STATUS');
    console.log('========================================\n');

    // Check consolidated records
    const consolidatedResult = await pool.query('SELECT COUNT(*) FROM consolidated_bank_accounts');
    console.log(`Current consolidated records: ${consolidatedResult.rows[0].count}\n`);

    // Check bank accounts
    const accountsResult = await pool.query(`
      SELECT uuid, account_number
      FROM bank_accounts 
      ORDER BY account_number
    `);

    console.log(`Bank accounts (${accountsResult.rows.length}):`);
    accountsResult.rows.forEach(a => {
      console.log(`  - ${a.account_number}`);
      console.log(`    UUID: ${a.uuid}`);
    });

    console.log('\n========================================\n');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkStatus();
