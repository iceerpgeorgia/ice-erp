const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function syncCounteragentAccountsFromSupabase() {
  const supabase = new Client({
    connectionString: process.env.REMOTE_DATABASE_URL
  });

  const local = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await supabase.connect();
    await local.connect();
    console.log('✅ Connected to both databases\n');

    // Step 1: Get all counteragent account numbers from Supabase using transaction details as keys
    console.log('📥 Fetching counteragent accounts from Supabase...');
    const supabaseData = await supabase.query(`
      SELECT 
        transaction_date, 
        account_currency_amount, 
        counteragent_account_number::text as counteragent_account_number, 
        description
      FROM consolidated_bank_accounts
      WHERE counteragent_account_number IS NOT NULL
      LIMIT 50000
    `);
    
    console.log(`✅ Found ${supabaseData.rows.length} records with counteragent account\n`);

    // Step 2: Update local database one by one (slower but more reliable)
    console.log('🔄 Updating local database...\n');
    
    let updatedCount = 0;
    let notFoundCount = 0;

    for (let i = 0; i < supabaseData.rows.length; i++) {
      const row = supabaseData.rows[i];
      
      // Ensure account number is a string
      const accountNumber = String(row.counteragent_account_number);
      
      const result = await local.query(`
        UPDATE consolidated_bank_accounts
        SET 
          counteragent_account_number = $1::text,
          updated_at = NOW()
        WHERE transaction_date = $2
        AND account_currency_amount = $3
        RETURNING id
      `, [accountNumber, row.transaction_date, row.account_currency_amount]);
      
      if (result.rowCount > 0) {
        updatedCount++;
      } else {
        notFoundCount++;
      }
      
      if ((i + 1) % 1000 === 0) {
        console.log(`  ✅ Processed ${i + 1}/${supabaseData.rows.length} (updated: ${updatedCount}, not found: ${notFoundCount})...`);
      }
    }
    
    console.log(`  ✅ Final: ${updatedCount} updated, ${notFoundCount} not found\n`);

    console.log('\n📊 Update Summary:');
    
    // Verify local count
    const localResult = await local.query(`
      SELECT COUNT(*) as count
      FROM consolidated_bank_accounts
      WHERE counteragent_account_number IS NOT NULL
    `);
    
    console.log(`  ✅ Local records with counteragent account: ${localResult.rows[0].count}`);
    console.log(`  📋 Expected: ${supabaseData.rows.length}`);
    console.log(`  ${localResult.rows[0].count === supabaseData.rows.length.toString() ? '✅ MATCH!' : '❌ MISMATCH!'}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await supabase.end();
    await local.end();
  }
}

syncCounteragentAccountsFromSupabase()
  .then(() => {
    console.log('\n✅ Sync completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Sync failed:', error.message);
    process.exit(1);
  });
