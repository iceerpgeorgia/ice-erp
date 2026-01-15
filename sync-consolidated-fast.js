/**
 * Fast sync of consolidated_bank_accounts from LOCAL to Supabase
 * Uses batch INSERT with 500 records per query
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const localPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

const supabasePool = new Pool({
  connectionString: process.env.REMOTE_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('='.repeat(80));
  console.log('🚀 FAST SYNC - Consolidated Bank Accounts (LOCAL → Supabase)');
  console.log('='.repeat(80));
  console.log();

  const localClient = await localPool.connect();
  const supabaseClient = await supabasePool.connect();

  try {
    // Get all LOCAL consolidated records
    console.log('📥 Fetching LOCAL consolidated records...');
    const localResult = await localClient.query(`
      SELECT 
        uuid, bank_account_uuid, raw_record_uuid, transaction_date,
        description, counteragent_uuid, counteragent_account_number,
        project_uuid, financial_code_uuid, payment_id,
        account_currency_uuid, account_currency_amount,
        nominal_currency_uuid, nominal_amount,
        processing_case, created_at, updated_at
      FROM consolidated_bank_accounts
      ORDER BY transaction_date DESC
    `);
    const localRecords = localResult.rows;
    console.log(`📥 Found ${localRecords.length} records in LOCAL`);

    // Get existing Supabase UUIDs
    console.log('📥 Fetching Supabase UUIDs...');
    const supabaseResult = await supabaseClient.query(`
      SELECT uuid FROM consolidated_bank_accounts
    `);
    const supabaseUuids = new Set(supabaseResult.rows.map(r => r.uuid));
    console.log(`📥 Found ${supabaseUuids.size} records in Supabase`);

    // Find missing records
    const missing = localRecords.filter(r => !supabaseUuids.has(r.uuid));
    console.log(`📊 Missing in Supabase: ${missing.length} records`);
    console.log();

    if (missing.length === 0) {
      console.log('✅ Supabase is already up to date!');
      return;
    }

    // Insert in batches of 500
    const BATCH_SIZE = 500;
    let inserted = 0;

    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      const batch = missing.slice(i, i + BATCH_SIZE);
      
      // Build multi-value INSERT
      const values = [];
      const params = [];
      let paramIndex = 1;

      for (const rec of batch) {
        const rowParams = [
          rec.uuid,
          rec.bank_account_uuid,
          rec.raw_record_uuid,
          rec.transaction_date,
          rec.description,
          rec.counteragent_uuid,
          rec.counteragent_account_number,
          rec.project_uuid,
          rec.financial_code_uuid,
          rec.payment_id,
          rec.account_currency_uuid,
          rec.account_currency_amount,
          rec.nominal_currency_uuid,
          rec.nominal_amount,
          rec.processing_case,
          rec.created_at || new Date(),
          rec.updated_at || new Date()
        ];

        const placeholders = rowParams.map(() => `$${paramIndex++}`).join(', ');
        values.push(`(${placeholders})`);
        params.push(...rowParams);
      }

      const query = `
        INSERT INTO consolidated_bank_accounts (
          uuid, bank_account_uuid, raw_record_uuid, transaction_date,
          description, counteragent_uuid, counteragent_account_number,
          project_uuid, financial_code_uuid, payment_id,
          account_currency_uuid, account_currency_amount,
          nominal_currency_uuid, nominal_amount,
          processing_case, created_at, updated_at
        ) VALUES ${values.join(', ')}
        ON CONFLICT (uuid) DO NOTHING
      `;

      await supabaseClient.query(query, params);
      inserted += batch.length;
      
      const percent = Math.round((inserted / missing.length) * 100);
      console.log(`  📤 Inserted ${inserted}/${missing.length} (${percent}%)`);
    }

    console.log();
    console.log(`✅ Inserted ${inserted} records`);
    console.log();

    // Verify final counts
    const finalResult = await supabaseClient.query('SELECT COUNT(*) FROM consolidated_bank_accounts');
    console.log(`📊 Final Supabase count: ${finalResult.rows[0].count}`);

  } finally {
    localClient.release();
    supabaseClient.release();
    await localPool.end();
    await supabasePool.end();
  }
}

main().catch(console.error);
