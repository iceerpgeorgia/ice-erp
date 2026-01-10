const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function parseCounteragentsFromRawData() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting counteragent parsing for all BOG GEL raw records...\n');

    // Step 1: Truncate consolidated_bank_accounts
    console.log('🗑️  Truncating consolidated_bank_accounts table...');
    await client.query('TRUNCATE TABLE consolidated_bank_accounts');
    console.log('✅ Consolidated table truncated\n');

    // Step 2: Reset processing flags
    console.log('🔄 Resetting processing flags...');
    await client.query(`
      UPDATE bog_gel_raw_893486000 
      SET 
        counteragent_processed = FALSE,
        parsing_rule_processed = FALSE,
        payment_id_processed = FALSE,
        is_processed = FALSE
    `);
    console.log('✅ Processing flags reset\n');

    // Step 3: Get account info
    const accountResult = await client.query(`
      SELECT uuid, currency_uuid 
      FROM bank_accounts 
      WHERE account_number = 'GE78BG0000000893486000' 
      AND currency_uuid = (SELECT uuid FROM currencies WHERE code = 'GEL')
    `);
    
    if (accountResult.rows.length === 0) {
      throw new Error('Bank account not found');
    }
    
    const bankAccountUuid = accountResult.rows[0].uuid;
    const accountCurrencyUuid = accountResult.rows[0].currency_uuid;

    console.log(`📊 Bank Account UUID: ${bankAccountUuid}`);
    console.log(`💱 Account Currency UUID: ${accountCurrencyUuid}\n`);

    // Step 4: Get all unprocessed records for counteragent parsing
    console.log('📥 Fetching all records for counteragent parsing...');
    const rawRecordsResult = await client.query(`
      SELECT *
      FROM bog_gel_raw_893486000
      WHERE counteragent_processed = FALSE
      AND docvaluedate IS NOT NULL
      ORDER BY docvaluedate DESC
    `);

    const totalRecords = rawRecordsResult.rows.length;
    console.log(`✅ Found ${totalRecords} records to process\n`);

    // Step 5: Load all counteragents into memory for fast lookup
    console.log('📚 Loading counteragents into memory...');
    const counteragentsResult = await client.query('SELECT counteragent_uuid, identification_number, counteragent FROM counteragents WHERE identification_number IS NOT NULL');
    const counteragentsMap = new Map();
    counteragentsResult.rows.forEach(ca => {
      counteragentsMap.set(ca.identification_number, {
        uuid: ca.counteragent_uuid,
        name: ca.counteragent
      });
    });
    console.log(`✅ Loaded ${counteragentsMap.size} counteragents\n`);

    // Step 6: Process counteragents for all records IN BATCHES
    console.log('🔍 Processing counteragents for all records...');
    console.log('⏱️  Started at:', new Date().toLocaleTimeString());
    let processedCount = 0;
    let identifiedCount = 0;
    let innFoundButNoCounteragentCount = 0;
    let noInnFoundCount = 0;
    let fromSender01InnCount = 0;
    let fromSender01CodeCount = 0;
    let fromReceiver01InnCount = 0;
    let fromReceiver01CodeCount = 0;
    const startTime = Date.now();
    const missingCounteragents = new Map(); // Track INNs that need counteragents
    
    const BATCH_SIZE = 500;
    const consolidatedInserts = [];
    const rawUpdates = [];

    for (const record of rawRecordsResult.rows) {
      try {
        // Calculate amount for consolidated table
        const accountCurrencyAmount = (record.entrycramt || 0) - (record.entrydbamt || 0);
        
        // Extract counteragent INN based on simple rule:
        // If entrydbamt is NULL → incoming payment → counteragent = sender (docsenderinn)
        // If entrydbamt has value → outgoing payment → counteragent = beneficiary (docbenefinn)
        let counteragentInn = null;
        let counteragentUuid = null;
        let innSource = null;

        if (record.entrydbamt === null || record.entrydbamt === undefined) {
          // Incoming payment - counteragent is the sender
          if (record.docsenderinn && record.docsenderinn.trim()) {
            counteragentInn = record.docsenderinn.trim();
            innSource = 'docsenderinn (incoming)';
          }
        } else {
          // Outgoing payment - counteragent is the beneficiary
          if (record.docbenefinn && record.docbenefinn.trim()) {
            counteragentInn = record.docbenefinn.trim();
            innSource = 'docbenefinn (outgoing)';
          }
        }

        // CASE ANALYSIS using in-memory lookup:
        if (counteragentInn) {
          // INN found - look up in memory
          const counteragentData = counteragentsMap.get(counteragentInn);

          if (counteragentData) {
            // CASE 1: INN found + counteragent exists in database
            counteragentUuid = counteragentData.uuid;
            identifiedCount++;
            
            // Track source statistics
            if (innSource.includes('docsenderinn')) fromSender01InnCount++;
            else if (innSource.includes('docbenefinn')) fromReceiver01InnCount++;
            
            // Log first few identifications
            if (identifiedCount <= 5) {
              console.log(`   ✅ [CASE 1] Identified: ${counteragentData.name} (INN: ${counteragentInn} from ${innSource})`);
            }
          } else {
            // CASE 2: INN found but counteragent NOT in database - needs to be added
            innFoundButNoCounteragentCount++;
            
            // Track this INN for reporting
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
              console.log(`   ⚠️  [CASE 2] INN found but no counteragent: ${counteragentInn} from ${innSource} in ${record.dockey}_${record.entriesid}`);
            }
          }
        } else {
          // CASE 3: No INN found in raw record - will try parsing rules/payment_id later
          noInnFoundCount++;
          if (noInnFoundCount <= 3) {
            console.log(`   ℹ️  [CASE 3] No INN in ${record.dockey}_${record.entriesid} - will try rules/payment parsing`);
          }
        }

        // Prepare batch insert for consolidated_bank_accounts
        const consolidatedUuid = uuidv4();
        consolidatedInserts.push({
          uuid: consolidatedUuid,
          bank_account_uuid: bankAccountUuid,
          raw_record_uuid: record.uuid,
          transaction_date: record.docvaluedate,
          description: record.docnomination || '',
          counteragent_uuid: counteragentUuid,
          account_currency_uuid: accountCurrencyUuid,
          account_currency_amount: accountCurrencyAmount,
          nominal_currency_uuid: accountCurrencyUuid,
          nominal_amount: accountCurrencyAmount
        });

        // Prepare batch update for raw table
        rawUpdates.push({
          uuid: record.uuid,
          counteragent_processed: counteragentUuid ? true : false,
          counteragent_inn: counteragentInn
        });

        processedCount++;

        // Execute batch inserts/updates every BATCH_SIZE records
        if (consolidatedInserts.length >= BATCH_SIZE) {
          // Batch insert to consolidated table
          const values = consolidatedInserts.map((item, idx) => {
            const offset = idx * 10;
            return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, NOW())`;
          }).join(',');
          
          const params = consolidatedInserts.flatMap(item => [
            item.uuid,
            item.bank_account_uuid,
            item.raw_record_uuid,
            item.transaction_date,
            item.description,
            item.counteragent_uuid,
            item.account_currency_uuid,
            item.account_currency_amount,
            item.nominal_currency_uuid,
            item.nominal_amount
          ]);

          await client.query(`
            INSERT INTO consolidated_bank_accounts (
              uuid, bank_account_uuid, raw_record_uuid, transaction_date, description,
              counteragent_uuid, account_currency_uuid, account_currency_amount,
              nominal_currency_uuid, nominal_amount, created_at
            ) VALUES ${values}
          `, params);

          // Batch update raw table using a SINGLE query with unnest
          const updateUuids = rawUpdates.map(u => u.uuid);
          const updateProcessed = rawUpdates.map(u => u.counteragent_processed);
          const updateInns = rawUpdates.map(u => u.counteragent_inn);
          
          await client.query(`
            UPDATE bog_gel_raw_893486000 AS r
            SET 
              counteragent_processed = data.processed,
              counteragent_inn = data.inn
            FROM (
              SELECT 
                unnest($1::uuid[]) AS uuid,
                unnest($2::boolean[]) AS processed,
                unnest($3::text[]) AS inn
            ) AS data
            WHERE r.uuid = data.uuid
          `, [updateUuids, updateProcessed, updateInns]);

          // Clear batches
          consolidatedInserts.length = 0;
          rawUpdates.length = 0;
        }

        // Progress reporting every 500 records with detailed status
        if (processedCount % 500 === 0) {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          const rate = Math.round(processedCount / elapsed);
          const remaining = totalRecords - processedCount;
          const eta = Math.round(remaining / rate);
          console.log(`   📊 Progress: ${processedCount}/${totalRecords} (${Math.round(processedCount/totalRecords*100)}%)`);
          console.log(`      ✅ Case 1 (matched): ${identifiedCount} | ⚠️  Case 2 (needs add): ${innFoundButNoCounteragentCount} | ℹ️  Case 3 (no INN): ${noInnFoundCount}`);
          console.log(`      ⏱️  Speed: ${rate} rec/sec | ETA: ${eta}s | Elapsed: ${elapsed}s`);
        }

      } catch (error) {
        console.error(`❌ Error processing record ${record.dockey}_${record.entriesid}:`, error.message);
        console.error(`   Continuing with next record...`);
        // Continue processing even if one record fails
        processedCount++;
      }
    }

    // Process remaining records in final batch
    if (consolidatedInserts.length > 0) {
      console.log(`\n📤 Processing final batch of ${consolidatedInserts.length} records...`);
      
      const values = consolidatedInserts.map((item, idx) => {
        const offset = idx * 10;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, NOW())`;
      }).join(',');
      
      const params = consolidatedInserts.flatMap(item => [
        item.uuid,
        item.bank_account_uuid,
        item.raw_record_uuid,
        item.transaction_date,
        item.description,
        item.counteragent_uuid,
        item.account_currency_uuid,
        item.account_currency_amount,
        item.nominal_currency_uuid,
        item.nominal_amount
      ]);

      await client.query(`
        INSERT INTO consolidated_bank_accounts (
          uuid, bank_account_uuid, raw_record_uuid, transaction_date, description,
          counteragent_uuid, account_currency_uuid, account_currency_amount,
          nominal_currency_uuid, nominal_amount, created_at
        ) VALUES ${values}
      `, params);

      // Batch update raw table using a SINGLE query with unnest
      const updateUuids = rawUpdates.map(u => u.uuid);
      const updateProcessed = rawUpdates.map(u => u.counteragent_processed);
      const updateInns = rawUpdates.map(u => u.counteragent_inn);
      
      await client.query(`
        UPDATE bog_gel_raw_893486000 AS r
        SET 
          counteragent_processed = data.processed,
          counteragent_inn = data.inn
        FROM (
          SELECT 
            unnest($1::uuid[]) AS uuid,
            unnest($2::boolean[]) AS processed,
            unnest($3::text[]) AS inn
        ) AS data
        WHERE r.uuid = data.uuid
      `, [updateUuids, updateProcessed, updateInns]);
    }

    const totalElapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n✅ Counteragent parsing completed in ${totalElapsed}s!`);
    console.log(`   Total processed: ${processedCount}`);
    console.log(`\n   📊 CASE BREAKDOWN:`);
    console.log(`   ✅ CASE 1 - INN matched in database: ${identifiedCount} (${Math.round(identifiedCount/processedCount*100)}%)`);
    console.log(`   ⚠️  CASE 2 - INN found but needs counteragent: ${innFoundButNoCounteragentCount} (${Math.round(innFoundButNoCounteragentCount/processedCount*100)}%)`);
    console.log(`   ℹ️  CASE 3 - No INN (proceed to rules/payment): ${noInnFoundCount} (${Math.round(noInnFoundCount/processedCount*100)}%)`);
    console.log(`\n   📍 INN Sources (for matched):`);
    console.log(`      docsenderinn (incoming): ${fromSender01InnCount}`);
    console.log(`      docbenefinn (outgoing): ${fromReceiver01InnCount}`);

    // Report missing counteragents
    if (missingCounteragents.size > 0) {
      console.log(`\n⚠️  CASE 2 REPORT - INNs that need counteragents added (${missingCounteragents.size} unique):`);
      console.log('━'.repeat(80));
      
      const sortedByCount = Array.from(missingCounteragents.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 20); // Show top 20
      
      sortedByCount.forEach((data, idx) => {
        console.log(`   ${idx + 1}. INN: ${data.inn} | Count: ${data.count} | Source: ${data.source}`);
        console.log(`      Sample records: ${data.sampleRecords.join(', ')}`);
      });
      
      if (missingCounteragents.size > 20) {
        console.log(`   ... and ${missingCounteragents.size - 20} more`);
      }
      console.log('━'.repeat(80));
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL SUMMARY - Counteragent Identification Only');
    console.log('='.repeat(60));
    
    const summaryResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN counteragent_processed THEN 1 ELSE 0 END) as counteragent_done
      FROM bog_gel_raw_893486000
    `);

    const summary = summaryResult.rows[0];
    console.log(`\n📋 Raw Table Status:`);
    console.log(`   Total records: ${summary.total}`);
    console.log(`   Counteragent processed: ${summary.counteragent_done} (${Math.round(summary.counteragent_done/summary.total*100)}%)`);

    const consolidatedResult = await client.query('SELECT COUNT(*) as count FROM consolidated_bank_accounts');
    const consolidatedWithCounteragent = await client.query('SELECT COUNT(*) as count FROM consolidated_bank_accounts WHERE counteragent_uuid IS NOT NULL');
    
    console.log(`\n📊 Consolidated Table Status:`);
    console.log(`   Total records: ${consolidatedResult.rows[0].count}`);
    console.log(`   With counteragent: ${consolidatedWithCounteragent.rows[0].count} (${Math.round(consolidatedWithCounteragent.rows[0].count/consolidatedResult.rows[0].count*100)}%)`);
    
    console.log('\n' + '='.repeat(60));
    console.log('⏱️  Total execution time:', Math.round((Date.now() - startTime) / 1000), 'seconds');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

parseCounteragentsFromRawData();
