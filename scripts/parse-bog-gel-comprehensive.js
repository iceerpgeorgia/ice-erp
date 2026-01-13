const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Determine which database to use based on command line argument
const useRemote = process.argv.includes('--remote') || process.argv.includes('--supabase');
const connectionString = useRemote 
  ? process.env.REMOTE_DATABASE_URL 
  : process.env.DATABASE_URL;

const dbName = useRemote ? 'Supabase' : 'Local';
console.log(`\n🔗 Using ${dbName} database\n`);

const pool = new Pool({
  connectionString,
  ssl: useRemote ? { rejectUnauthorized: false } : false
});

/**
 * COMPREHENSIVE BOG_GEL PARSING SCRIPT
 * 
 * Three-stage parsing approach:
 * 
 * STAGE 1: COUNTERAGENT & ACCOUNT IDENTIFICATION
 * - Extract counteragent INN from raw data (docsenderinn/docbenefinn)
 * - Extract counteragent account number from raw data (docsenderacctno/docbenefacctno)
 * - Match counteragent in database by INN
 * - Update consolidated_bank_accounts with: counteragent_uuid, counteragent_account_number
 * - Mark raw records: counteragent_processed, counteragent_inn
 * 
 * Cases:
 * - CASE 1: INN found + counteragent exists → counteragent_processed=TRUE
 * - CASE 2: INN found + counteragent missing → counteragent_processed=FALSE (needs manual add)
 * - CASE 3: No INN in raw data → counteragent_processed=FALSE (will try rules/payment)
 * 
 * STAGE 2: PARSING RULES APPLICATION (TODO - future implementation)
 * - Match parsing scheme rules (e.g., docprodgroup='COM')
 * - Validate counteragent compatibility
 * - Apply rule parameters: project_uuid, financial_code_uuid, nominal_currency_uuid
 * - Mark: parsing_rule_processed=TRUE
 * 
 * STAGE 3: PAYMENT ID MATCHING (TODO - future implementation)
 * - Extract payment_id from docinformation field
 * - Query payments table by payment_id
 * - Validate counteragent compatibility
 * - Apply payment parameters
 * - Mark: payment_id_processed=TRUE
 */

async function parseBogGelComprehensive() {
  const client = await pool.connect();
  
  try {
    console.log('=' .repeat(80));
    console.log('  BOG_GEL COMPREHENSIVE PARSING SCRIPT');
    console.log('=' .repeat(80));
    console.log(`  Database: ${dbName}`);
    console.log(`  Date: ${new Date().toLocaleString()}`);
    console.log('=' .repeat(80));
    console.log();

    // ========================================================================
    // STAGE 1: COUNTERAGENT & ACCOUNT IDENTIFICATION
    // ========================================================================
    console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ STAGE 1: COUNTERAGENT & ACCOUNT IDENTIFICATION                              │');
    console.log('└─────────────────────────────────────────────────────────────────────────────┘');
    console.log();

    // Step 1.1: Get bank account info
    console.log('📊 Step 1.1: Looking up bank account...');
    const accountResult = await client.query(`
      SELECT ba.uuid, ba.currency_uuid, ba.account_number, c.code as currency_code
      FROM bank_accounts ba
      JOIN currencies c ON ba.currency_uuid = c.uuid
      WHERE ba.account_number = 'GE78BG0000000893486000' 
      AND c.code = 'GEL'
    `);
    
    if (accountResult.rows.length === 0) {
      throw new Error('❌ Bank account GE78BG0000000893486000 (GEL) not found in database');
    }
    
    const bankAccountUuid = accountResult.rows[0].uuid;
    const accountCurrencyUuid = accountResult.rows[0].currency_uuid;
    
    console.log(`   ✅ Bank Account: ${accountResult.rows[0].account_number}`);
    console.log(`   ✅ Currency: ${accountResult.rows[0].currency_code}`);
    console.log(`   ✅ Account UUID: ${bankAccountUuid}`);
    console.log();

    // Step 1.2: Load all counteragents into memory for fast lookup
    console.log('📚 Step 1.2: Loading counteragents into memory...');
    const counteragentsResult = await client.query(`
      SELECT counteragent_uuid, identification_number, counteragent 
      FROM counteragents 
      WHERE identification_number IS NOT NULL
    `);
    
    const counteragentsMap = new Map();
    counteragentsResult.rows.forEach(ca => {
      counteragentsMap.set(ca.identification_number, {
        uuid: ca.counteragent_uuid,
        name: ca.counteragent
      });
    });
    console.log(`   ✅ Loaded ${counteragentsMap.size} counteragents into memory`);
    console.log();

    // Step 1.3: Get records that need counteragent processing
    console.log('🔍 Step 1.3: Fetching records for counteragent processing...');
    const rawRecordsResult = await client.query(`
      SELECT 
        r.uuid as raw_uuid,
        r.dockey,
        r.entriesid,
        r.docvaluedate,
        r.docnomination,
        r.entrycramt,
        r.entrydbamt,
        r.docsenderinn,
        r.docbenefinn,
        r.docsenderacctno,
        r.docbenefacctno,
        r.counteragent_processed,
        r.counteragent_inn,
        c.uuid as consolidated_uuid,
        c.counteragent_uuid as current_counteragent,
        c.counteragent_account_number as current_ca_account
      FROM bog_gel_raw_893486000 r
      LEFT JOIN consolidated_bank_accounts c ON c.raw_record_uuid = r.uuid
      WHERE r.counteragent_processed = FALSE
      AND r.docvaluedate IS NOT NULL
      ORDER BY r.docvaluedate DESC
    `);

    const totalRecords = rawRecordsResult.rows.length;
    console.log(`   ✅ Found ${totalRecords} records to process`);
    console.log();

    // Step 1.4: Process counteragents in batches
    console.log('🔄 Step 1.4: Processing counteragents and accounts...');
    console.log();
    
    let processedCount = 0;
    let identifiedCount = 0;
    let innFoundButNoCounteragentCount = 0;
    let noInnFoundCount = 0;
    let updatedConsolidatedCount = 0;
    const startTime = Date.now();
    const missingCounteragents = new Map();
    
    const BATCH_SIZE = 500;
    const consolidatedUpdates = [];
    const rawUpdates = [];

    for (const record of rawRecordsResult.rows) {
      try {
        // Calculate amount for consolidated table
        const accountCurrencyAmount = (record.entrycramt || 0) - (record.entrydbamt || 0);
        
        // Extract counteragent INN and account number based on transaction direction:
        // If entrydbamt is NULL → incoming payment → counteragent = sender
        // If entrydbamt has value → outgoing payment → counteragent = beneficiary
        let counteragentInn = null;
        let counteragentAccountNumber = null;
        let counteragentUuid = null;
        let innSource = null;

        if (record.entrydbamt === null || record.entrydbamt === undefined) {
          // Incoming payment - counteragent is the sender
          if (record.docsenderinn && record.docsenderinn.trim()) {
            counteragentInn = record.docsenderinn.trim();
            innSource = 'docsenderinn';
          }
          if (record.docsenderacctno && record.docsenderacctno.trim()) {
            counteragentAccountNumber = record.docsenderacctno.trim();
          }
        } else {
          // Outgoing payment - counteragent is the beneficiary
          if (record.docbenefinn && record.docbenefinn.trim()) {
            counteragentInn = record.docbenefinn.trim();
            innSource = 'docbenefinn';
          }
          if (record.docbenefacctno && record.docbenefacctno.trim()) {
            counteragentAccountNumber = record.docbenefacctno.trim();
          }
        }

        // CASE ANALYSIS using in-memory lookup:
        if (counteragentInn) {
          // Normalize INN: if length is 10, prepend "0" to make it 11 digits
          if (counteragentInn.length === 10 && /^\d+$/.test(counteragentInn)) {
            counteragentInn = '0' + counteragentInn;
          }
          
          // INN found - look up in memory
          const counteragentData = counteragentsMap.get(counteragentInn);

          if (counteragentData) {
            // CASE 1: INN found + counteragent exists in database
            counteragentUuid = counteragentData.uuid;
            identifiedCount++;
            
            if (identifiedCount <= 3) {
              console.log(`   ✅ [CASE 1] ${counteragentData.name} (INN: ${counteragentInn}, Account: ${counteragentAccountNumber || 'N/A'})`);
            }
          } else {
            // CASE 2: INN found but counteragent NOT in database - needs to be added
            innFoundButNoCounteragentCount++;
            
            if (!missingCounteragents.has(counteragentInn)) {
              missingCounteragents.set(counteragentInn, {
                inn: counteragentInn,
                source: innSource,
                count: 0,
                sampleRecords: []
              });
            }
            const innData = missingCounteragents.get(counteragentInn);
            innData.count++;
            if (innData.sampleRecords.length < 3) {
              innData.sampleRecords.push(`${record.dockey}_${record.entriesid}`);
            }
            
            if (innFoundButNoCounteragentCount <= 3) {
              console.log(`   ⚠️  [CASE 2] INN ${counteragentInn} not in DB (from ${innSource}, Account: ${counteragentAccountNumber || 'N/A'})`);
            }
          }
        } else {
          // CASE 3: No INN found in raw record - will try parsing rules/payment_id later
          noInnFoundCount++;
          if (noInnFoundCount <= 3) {
            console.log(`   ℹ️  [CASE 3] No INN in ${record.dockey}_${record.entriesid} - will use rules/payment matching`);
          }
        }

        // Prepare batch update for CONSOLIDATED table (if record exists)
        if (record.consolidated_uuid) {
          consolidatedUpdates.push({
            uuid: record.consolidated_uuid,
            counteragent_uuid: counteragentUuid,
            counteragent_account_number: counteragentAccountNumber
          });
        }

        // Prepare batch update for RAW table
        rawUpdates.push({
          uuid: record.raw_uuid,
          counteragent_processed: counteragentUuid ? true : false,
          counteragent_inn: counteragentInn
        });

        processedCount++;

        // Execute batch updates every BATCH_SIZE records
        if (consolidatedUpdates.length >= BATCH_SIZE) {
          // Batch update consolidated table
          const consUuids = consolidatedUpdates.map(u => u.uuid);
          const consCounterUuids = consolidatedUpdates.map(u => u.counteragent_uuid);
          const consAccounts = consolidatedUpdates.map(u => u.counteragent_account_number);
          
          const result = await client.query(`
            UPDATE consolidated_bank_accounts
            SET 
              counteragent_uuid = data.counteragent_uuid,
              counteragent_account_number = data.account_number,
              updated_at = NOW()
            FROM (
              SELECT 
                unnest($1::uuid[]) as uuid,
                unnest($2::uuid[]) as counteragent_uuid,
                unnest($3::text[]) as account_number
            ) as data
            WHERE consolidated_bank_accounts.uuid = data.uuid
          `, [consUuids, consCounterUuids, consAccounts]);
          
          updatedConsolidatedCount += result.rowCount;

          // Batch update raw table
          const rawUuids = rawUpdates.map(u => u.uuid);
          const rawProcessed = rawUpdates.map(u => u.counteragent_processed);
          const rawInns = rawUpdates.map(u => u.counteragent_inn);
          
          await client.query(`
            UPDATE bog_gel_raw_893486000
            SET 
              counteragent_processed = data.processed,
              counteragent_inn = data.inn,
              updated_at = NOW()
            FROM (
              SELECT 
                unnest($1::uuid[]) as uuid,
                unnest($2::boolean[]) as processed,
                unnest($3::text[]) as inn
            ) as data
            WHERE bog_gel_raw_893486000.uuid = data.uuid
          `, [rawUuids, rawProcessed, rawInns]);

          consolidatedUpdates.length = 0;
          rawUpdates.length = 0;
        }

        // Progress reporting every 500 records
        if (processedCount % 500 === 0) {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          const rate = elapsed > 0 ? Math.round(processedCount / elapsed) : 0;
          const remaining = totalRecords - processedCount;
          const eta = rate > 0 ? Math.round(remaining / rate) : 0;
          
          console.log();
          console.log(`   📊 Progress: ${processedCount}/${totalRecords} (${Math.round(processedCount/totalRecords*100)}%)`);
          console.log(`      ✅ Case 1 (matched): ${identifiedCount}`);
          console.log(`      ⚠️  Case 2 (needs add): ${innFoundButNoCounteragentCount}`);
          console.log(`      ℹ️  Case 3 (no INN): ${noInnFoundCount}`);
          console.log(`      💾 Consolidated updated: ${updatedConsolidatedCount}`);
          console.log(`      ⏱️  ${rate} rec/sec | ETA: ${eta}s | Elapsed: ${elapsed}s`);
          console.log();
        }

      } catch (error) {
        console.error(`   ❌ Error processing ${record.dockey}_${record.entriesid}:`, error.message);
      }
    }

    // Process remaining records in final batch
    if (consolidatedUpdates.length > 0 || rawUpdates.length > 0) {
      console.log();
      console.log(`📤 Processing final batch...`);
      
      if (consolidatedUpdates.length > 0) {
        const consUuids = consolidatedUpdates.map(u => u.uuid);
        const consCounterUuids = consolidatedUpdates.map(u => u.counteragent_uuid);
        const consAccounts = consolidatedUpdates.map(u => u.counteragent_account_number);
        
        const result = await client.query(`
          UPDATE consolidated_bank_accounts
          SET 
            counteragent_uuid = data.counteragent_uuid,
            counteragent_account_number = data.account_number,
            updated_at = NOW()
          FROM (
            SELECT 
              unnest($1::uuid[]) as uuid,
              unnest($2::uuid[]) as counteragent_uuid,
              unnest($3::text[]) as account_number
          ) as data
          WHERE consolidated_bank_accounts.uuid = data.uuid
        `, [consUuids, consCounterUuids, consAccounts]);
        
        updatedConsolidatedCount += result.rowCount;
      }

      if (rawUpdates.length > 0) {
        const rawUuids = rawUpdates.map(u => u.uuid);
        const rawProcessed = rawUpdates.map(u => u.counteragent_processed);
        const rawInns = rawUpdates.map(u => u.counteragent_inn);
        
        await client.query(`
          UPDATE bog_gel_raw_893486000
          SET 
            counteragent_processed = data.processed,
            counteragent_inn = data.inn,
            updated_at = NOW()
          FROM (
            SELECT 
              unnest($1::uuid[]) as uuid,
              unnest($2::boolean[]) as processed,
              unnest($3::text[]) as inn
          ) as data
          WHERE bog_gel_raw_893486000.uuid = data.uuid
        `, [rawUuids, rawProcessed, rawInns]);
      }
    }

    const elapsedTotal = Math.round((Date.now() - startTime) / 1000);

    // Stage 1 Summary
    console.log();
    console.log('─'.repeat(80));
    console.log('STAGE 1 SUMMARY: COUNTERAGENT & ACCOUNT IDENTIFICATION');
    console.log('─'.repeat(80));
    console.log(`  Total records processed:     ${processedCount}`);
    console.log(`  ✅ Case 1 (matched):          ${identifiedCount} (${Math.round(identifiedCount/processedCount*100)}%)`);
    console.log(`  ⚠️  Case 2 (needs add):        ${innFoundButNoCounteragentCount} (${Math.round(innFoundButNoCounteragentCount/processedCount*100)}%)`);
    console.log(`  ℹ️  Case 3 (no INN):           ${noInnFoundCount} (${Math.round(noInnFoundCount/processedCount*100)}%)`);
    console.log(`  💾 Consolidated updated:      ${updatedConsolidatedCount}`);
    console.log(`  ⏱️  Time elapsed:              ${elapsedTotal} seconds`);
    console.log('─'.repeat(80));
    console.log();

    // Report missing counteragents (Case 2)
    if (missingCounteragents.size > 0) {
      console.log('⚠️  MISSING COUNTERAGENTS REPORT (CASE 2):');
      console.log('   These INNs were found in raw data but do not exist in counteragents table.');
      console.log('   Please add these counteragents manually before proceeding to Stage 2.');
      console.log();
      
      const sortedMissing = Array.from(missingCounteragents.values())
        .sort((a, b) => b.count - a.count);
      
      console.log('   INN          | Count | Source          | Sample Records');
      console.log('   ' + '─'.repeat(74));
      
      sortedMissing.forEach(item => {
        const samples = item.sampleRecords.join(', ');
        console.log(`   ${item.inn.padEnd(12)} | ${String(item.count).padEnd(5)} | ${item.source.padEnd(15)} | ${samples}`);
      });
      
      console.log();
      console.log(`   Total unique missing INNs: ${missingCounteragents.size}`);
      console.log(`   Total records affected: ${innFoundButNoCounteragentCount}`);
      console.log();
    }

    // ========================================================================
    // STAGE 2: PARSING RULES APPLICATION (Placeholder)
    // ========================================================================
    console.log();
    console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ STAGE 2: PARSING RULES APPLICATION                                          │');
    console.log('└─────────────────────────────────────────────────────────────────────────────┘');
    console.log();
    console.log('   ℹ️  Stage 2 (Parsing Rules) - Not yet implemented');
    console.log('   📋 Will process records with parsing_rule_processed = FALSE');
    console.log('   📋 Will match parsing scheme rules and apply project/financial code');
    console.log();

    // ========================================================================
    // STAGE 3: PAYMENT ID MATCHING (Placeholder)
    // ========================================================================
    console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ STAGE 3: PAYMENT ID MATCHING                                                │');
    console.log('└─────────────────────────────────────────────────────────────────────────────┘');
    console.log();
    console.log('   ℹ️  Stage 3 (Payment ID Matching) - Not yet implemented');
    console.log('   📋 Will process records with payment_id_processed = FALSE');
    console.log('   📋 Will extract payment_id from docinformation and match with payments table');
    console.log();

    // Final summary
    console.log('=' .repeat(80));
    console.log('✅ PARSING COMPLETED');
    console.log('=' .repeat(80));
    console.log();

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
parseBogGelComprehensive()
  .then(() => {
    console.log('✅ Script finished successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  });
