const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function updateCounteragentAccounts() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Step 1: Get all records from consolidated_bank_accounts with their raw record UUIDs
    console.log('📥 Fetching all consolidated records...');
    const consolidatedResult = await client.query(`
      SELECT 
        cba.uuid,
        cba.raw_record_uuid,
        cba.counteragent_account_number
      FROM consolidated_bank_accounts cba
      WHERE cba.raw_record_uuid IS NOT NULL
    `);

    console.log(`✅ Found ${consolidatedResult.rows.length} consolidated records with raw_record_uuid\n`);

    // Step 2: Get counteragent account data from raw table
    console.log('📚 Fetching counteragent account data from raw table...');
    const rawDataResult = await client.query(`
      SELECT 
        uuid as raw_uuid,
        entrydbamt,
        docsenderacctno,
        docbenefacctno
      FROM bog_gel_raw_893486000
    `);

    // Build map of raw_uuid -> counteragent_account_number
    const rawAccountMap = new Map();
    rawDataResult.rows.forEach(raw => {
      let counteragentAccountNumber = null;
      
      if (raw.entrydbamt === null || raw.entrydbamt === undefined) {
        // Incoming payment - counteragent is sender
        if (raw.docsenderacctno && raw.docsenderacctno.trim()) {
          counteragentAccountNumber = raw.docsenderacctno.trim();
        }
      } else {
        // Outgoing payment - counteragent is beneficiary
        if (raw.docbenefacctno && raw.docbenefacctno.trim()) {
          counteragentAccountNumber = raw.docbenefacctno.trim();
        }
      }
      
      if (counteragentAccountNumber) {
        rawAccountMap.set(raw.raw_uuid, counteragentAccountNumber);
      }
    });

    console.log(`✅ Extracted account numbers for ${rawAccountMap.size} raw records\n`);

    // Step 3: Update consolidated records with counteragent account numbers
    console.log('🔄 Updating consolidated records...');
    let updatedCount = 0;
    let alreadyHasAccountCount = 0;
    let noAccountDataCount = 0;

    const BATCH_SIZE = 500;
    const updates = [];

    for (const consolidated of consolidatedResult.rows) {
      if (consolidated.counteragent_account_number) {
        alreadyHasAccountCount++;
        continue;
      }

      const accountNumber = rawAccountMap.get(consolidated.raw_record_uuid);
      
      if (accountNumber) {
        updates.push({
          uuid: consolidated.uuid,
          account_number: accountNumber
        });
        
        if (updates.length >= BATCH_SIZE) {
          // Execute batch update
          const updateUuids = updates.map(u => u.uuid);
          const updateAccounts = updates.map(u => u.account_number);
          
          await client.query(`
            UPDATE consolidated_bank_accounts
            SET 
              counteragent_account_number = data.account_number,
              updated_at = NOW()
            FROM (
              SELECT 
                unnest($1::uuid[]) as uuid,
                unnest($2::text[]) as account_number
            ) as data
            WHERE consolidated_bank_accounts.uuid = data.uuid
          `, [updateUuids, updateAccounts]);
          
          updatedCount += updates.length;
          console.log(`  ✅ Updated ${updatedCount} records...`);
          updates.length = 0;
        }
      } else {
        noAccountDataCount++;
      }
    }

    // Update remaining records
    if (updates.length > 0) {
      const updateUuids = updates.map(u => u.uuid);
      const updateAccounts = updates.map(u => u.account_number);
      
      await client.query(`
        UPDATE consolidated_bank_accounts
        SET 
          counteragent_account_number = data.account_number,
          updated_at = NOW()
        FROM (
          SELECT 
            unnest($1::uuid[]) as uuid,
            unnest($2::text[]) as account_number
        ) as data
        WHERE consolidated_bank_accounts.uuid = data.uuid
      `, [updateUuids, updateAccounts]);
      
      updatedCount += updates.length;
    }

    console.log('\n📊 Update Summary:');
    console.log(`  ✅ Updated with account number: ${updatedCount}`);
    console.log(`  ℹ️  Already had account number: ${alreadyHasAccountCount}`);
    console.log(`  ⚠️  No account data in raw: ${noAccountDataCount}`);
    console.log(`  📋 Total processed: ${consolidatedResult.rows.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

updateCounteragentAccounts()
  .then(() => {
    console.log('\n✅ Update completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Update failed:', error.message);
    process.exit(1);
  });
