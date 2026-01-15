const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const localPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const remotePool = new Pool({
  connectionString: process.env.REMOTE_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function syncToProduction() {
  const localClient = await localPool.connect();
  const remoteClient = await remotePool.connect();
  
  try {
    console.log('🚀 SYNCING LOCAL → SUPABASE FOR PRODUCTION DEPLOYMENT\n');
    console.log('=' .repeat(80));
    
    // ========================================
    // 1. SYNC consolidated_bank_accounts
    // ========================================
    console.log('\n📊 1. Syncing consolidated_bank_accounts...\n');
    
    const localCount = await localClient.query('SELECT COUNT(*) FROM consolidated_bank_accounts');
    console.log(`   📍 Local: ${localCount.rows[0].count} records`);
    
    const remoteCount = await remoteClient.query('SELECT COUNT(*) FROM consolidated_bank_accounts');
    console.log(`   ☁️  Supabase: ${remoteCount.rows[0].count} records`);
    
    if (localCount.rows[0].count > remoteCount.rows[0].count) {
      console.log(`\n   🔄 Truncating Supabase consolidated_bank_accounts...`);
      await remoteClient.query('TRUNCATE consolidated_bank_accounts CASCADE');
      
      console.log(`   📥 Fetching ${localCount.rows[0].count} records from local...`);
      const localData = await localClient.query(`
        SELECT 
          id, uuid, bank_account_uuid, transaction_date, account_currency_amount, 
          nominal_amount, description, counteragent_uuid, counteragent_account_number,
          project_uuid, financial_code_uuid, payment_id, nominal_currency_uuid,
          processing_case, raw_record_uuid, created_at, account_currency_uuid
        FROM consolidated_bank_accounts
        ORDER BY id
      `);
      
      console.log(`   💾 Inserting into Supabase...`);
      let inserted = 0;
      const batchSize = 1000;
      
      for (let i = 0; i < localData.rows.length; i += batchSize) {
        const batch = localData.rows.slice(i, i + batchSize);
        
        for (const row of batch) {
          await remoteClient.query(`
            INSERT INTO consolidated_bank_accounts (
              id, uuid, bank_account_uuid, transaction_date, account_currency_amount,
              nominal_amount, description, counteragent_uuid, counteragent_account_number,
              project_uuid, financial_code_uuid, payment_id, nominal_currency_uuid,
              processing_case, raw_record_uuid, created_at, account_currency_uuid
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          `, [
            row.id, row.uuid, row.bank_account_uuid, row.transaction_date, row.account_currency_amount,
            row.nominal_amount, row.description, row.counteragent_uuid, row.counteragent_account_number,
            row.project_uuid, row.financial_code_uuid, row.payment_id, row.nominal_currency_uuid,
            row.processing_case, row.raw_record_uuid, row.created_at, row.account_currency_uuid
          ]);
          inserted++;
        }
        
        process.stdout.write(`\r   Progress: ${inserted}/${localData.rows.length} (${Math.round(inserted/localData.rows.length*100)}%)`);
      }
      
      // Reset sequence
      const maxId = await remoteClient.query('SELECT MAX(id) FROM consolidated_bank_accounts');
      if (maxId.rows[0].max) {
        await remoteClient.query(`SELECT setval('consolidated_bank_accounts_id_seq', ${maxId.rows[0].max})`);
      }
      
      console.log(`\n   ✅ Synced ${inserted} records`);
    } else {
      console.log(`   ✅ Supabase is already up to date`);
    }
    
    // ========================================
    // 2. VERIFY NBG rates
    // ========================================
    console.log('\n📊 2. Verifying nbg_exchange_rates...\n');
    
    const localRates = await localClient.query('SELECT COUNT(*) FROM nbg_exchange_rates');
    console.log(`   📍 Local: ${localRates.rows[0].count} rates`);
    
    const remoteRates = await remoteClient.query('SELECT COUNT(*) FROM nbg_exchange_rates');
    console.log(`   ☁️  Supabase: ${remoteRates.rows[0].count} rates`);
    
    if (remoteRates.rows[0].count === '0' || remoteRates.rows[0].count < localRates.rows[0].count) {
      console.log(`\n   ⚠️  Need to copy NBG rates to Supabase first!`);
      console.log(`   Run: node copy-nbg-rates-to-supabase.js`);
    } else {
      console.log(`   ✅ NBG rates already in Supabase`);
    }
    
    // ========================================
    // 3. VERIFY other critical tables
    // ========================================
    console.log('\n📊 3. Verifying other tables...\n');
    
    const tables = [
      'counteragents',
      'projects', 
      'payments',
      'parsing_scheme_rules',
      'bank_accounts',
      'currencies'
    ];
    
    for (const table of tables) {
      const localCnt = await localClient.query(`SELECT COUNT(*) FROM ${table}`);
      const remoteCnt = await remoteClient.query(`SELECT COUNT(*) FROM ${table}`);
      
      const localCount = parseInt(localCnt.rows[0].count);
      const remoteCount = parseInt(remoteCnt.rows[0].count);
      
      const status = localCount === remoteCount ? '✅' : '⚠️';
      console.log(`   ${status} ${table}: Local=${localCount}, Supabase=${remoteCount}`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ SYNC COMPLETE!\n');
    console.log('Next steps:');
    console.log('1. If NBG rates need syncing: node copy-nbg-rates-to-supabase.js');
    console.log('2. Verify schema: pnpm prisma db pull');
    console.log('3. Deploy: git push origin main (or vercel --prod)');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    localClient.release();
    remoteClient.release();
    await localPool.end();
    await remotePool.end();
  }
}

syncToProduction()
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
