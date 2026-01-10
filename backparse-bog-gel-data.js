const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
});

async function backparseData() {
  console.log('🔄 Starting backparsing of BOG GEL data...\n');

  try {
    await client.connect();
    console.log('✅ Connected to Supabase\n');

    // 1. Get BOG_GEL parsing scheme
    const schemeResult = await client.query(`
      SELECT uuid, scheme FROM parsing_schemes WHERE scheme = 'BOG_GEL'
    `);

    if (schemeResult.rows.length === 0) {
      console.error('❌ BOG_GEL parsing scheme not found');
      return;
    }

    const schemeUuid = schemeResult.rows[0].uuid;
    console.log(`✅ Found BOG_GEL scheme: ${schemeUuid}\n`);

    // 2. Get parsing rules for BOG_GEL
    const rulesResult = await client.query(`
      SELECT 
        id, 
        condition, 
        payment_id,
        counteragent_uuid,
        financial_code_uuid,
        nominal_currency_uuid
      FROM parsing_scheme_rules 
      WHERE scheme_uuid = $1
      ORDER BY id ASC
    `, [schemeUuid]);

    console.log(`✅ Found ${rulesResult.rows.length} parsing rule(s)\n`);

    if (rulesResult.rows.length === 0) {
      console.log('ℹ️  No rules to apply');
      return;
    }

    // Display rules
    rulesResult.rows.forEach((rule, index) => {
      console.log(`Rule ${index + 1}:`);
      console.log(`  Condition: ${rule.condition}`);
      console.log(`  Payment ID: ${rule.payment_id || 'N/A'}`);
      console.log(`  Counteragent UUID: ${rule.counteragent_uuid || 'N/A'}`);
      console.log(`  Financial Code UUID: ${rule.financial_code_uuid || 'N/A'}`);
      console.log(`  Currency UUID: ${rule.nominal_currency_uuid || 'N/A'}\n`);
    });

    // 3. Get BOG GEL bank account
    const accountResult = await client.query(`
      SELECT ba.uuid, ba.account_number, b.bank_name, ba.parsing_scheme_id
      FROM bank_accounts ba
      JOIN banks b ON ba.bank_uuid = b.uuid
      WHERE b.bank_name LIKE '%BOG%' OR b.bank_name LIKE '%Georgia%'
      LIMIT 1
    `);

    if (accountResult.rows.length === 0) {
      console.error('❌ BOG bank account not found');
      return;
    }

    const accountUuid = accountResult.rows[0].uuid;
    console.log(`✅ Found bank account: ${accountResult.rows[0].account_number} (${accountResult.rows[0].bank_name})`);
    console.log(`   Parsing Scheme ID: ${accountResult.rows[0].parsing_scheme_id}\n`);

    // 4. Get unprocessed records from bog_gel_raw_893486000
    const rawTableName = 'bog_gel_raw_893486000';
    const rawResult = await client.query(`
      SELECT 
        uuid as raw_uuid,
        dockey as doc_key,
        entriesid as entries_id,
        docrecdate as doc_rec_date,
        docvaluedate as doc_value_date,
        docprodgroup,
        docnomination as doc_nomination,
        docinformation as doc_information,
        entrycramt as entry_cr_amt,
        entrydbamt as entry_db_amt,
        docsenderinn as doc_sender_inn,
        docbenefinn as doc_benef_inn,
        docsenderacctno as doc_sender_acct_no,
        docbenefacctno as doc_benef_acct_no,
        docsrcccy as doc_src_ccy,
        docdstccy as doc_dst_ccy
      FROM ${rawTableName}
      WHERE is_processed = false
      ORDER BY docrecdate DESC
    `);

    console.log(`📊 Found ${rawResult.rows.length} unprocessed raw records\n`);

    if (rawResult.rows.length === 0) {
      console.log('ℹ️  No unprocessed raw records to process');
      return;
    }

    // 5. Get counteragents map
    const counteragentsResult = await client.query(`
      SELECT counteragent_uuid, identification_number 
      FROM counteragents 
      WHERE identification_number IS NOT NULL
    `);
    const counteragentsMap = {};
    counteragentsResult.rows.forEach(row => {
      counteragentsMap[row.identification_number] = row.counteragent_uuid;
    });
    console.log(`✅ Loaded ${counteragentsResult.rows.length} counteragents\n`);

    // 6. Apply parsing rules to each raw record
    let successCount = 0;
    let failCount = 0;
    let matchedCount = 0;

    for (const record of rawResult.rows) {
      let matched = false;

      // Check for duplicates
      const dupCheck = await client.query(`
        SELECT uuid FROM consolidated_bank_accounts 
        WHERE id_1 = $1 AND id_2 = $2
      `, [record.doc_key, record.entries_id]);

      if (dupCheck.rows.length > 0) {
        console.log(`⏭️  Skipping duplicate: ${record.doc_key}_${record.entries_id}`);
        continue;
      }

      for (const rule of rulesResult.rows) {
        try {
          // Evaluate the condition against the raw record
          // The rule condition references column names like docprodgroup
          let conditionMet = false;

          // Simple condition parser for format: docprodgroup="COM"
          const simpleMatch = rule.condition.match(/^(\w+)="([^"]+)"$/);
          if (simpleMatch) {
            const [, columnName, expectedValue] = simpleMatch;
            const actualValue = record[columnName.toLowerCase()];
            conditionMet = actualValue === expectedValue;
          } else {
            // More complex condition - convert to JS
            let jsCondition = rule.condition
              .replace(/(\w+)/g, (match) => {
                // If it's a column name, replace with the value
                const lowerMatch = match.toLowerCase();
                if (record.hasOwnProperty(lowerMatch)) {
                  return JSON.stringify(record[lowerMatch] || '');
                }
                return match;
              })
              .replace(/=/g, '===');

            try {
              conditionMet = eval(jsCondition);
            } catch (e) {
              console.error(`❌ Failed to evaluate condition: ${rule.condition}`, e.message);
            }
          }
          
          if (conditionMet) {
            matchedCount++;
            console.log(`✅ Rule matched for record ${record.doc_key}_${record.entries_id}`);
            console.log(`   Payment ID: ${rule.payment_id}`);

            // Get payment record to populate fields
            let paymentUuid = null;
            let counteragentUuid = null;
            let projectUuid = null;
            let financialCodeUuid = null;
            let nominalCurrencyUuid = null;

            if (rule.payment_id) {
              const paymentResult = await client.query(`
                SELECT record_uuid, counteragent_uuid, project_uuid, 
                       financial_code_uuid, currency_uuid
                FROM payments 
                WHERE payment_id = $1
              `, [rule.payment_id]);
              
              if (paymentResult.rows.length > 0) {
                const payment = paymentResult.rows[0];
                paymentUuid = payment.record_uuid;
                counteragentUuid = payment.counteragent_uuid;
                projectUuid = payment.project_uuid;
                financialCodeUuid = payment.financial_code_uuid;
                nominalCurrencyUuid = payment.currency_uuid;
              }
            }

            // Override with rule UUIDs if specified
            if (rule.counteragent_uuid) counteragentUuid = rule.counteragent_uuid;
            if (rule.financial_code_uuid) financialCodeUuid = rule.financial_code_uuid;
            if (rule.nominal_currency_uuid) nominalCurrencyUuid = rule.nominal_currency_uuid;

            // Parse dates
            function parseBogDate(dateStr) {
              if (!dateStr) return null;
              try {
                const parts = dateStr.split('.');
                if (parts.length === 3) {
                  const day = parts[0].padStart(2, '0');
                  const month = parts[1].padStart(2, '0');
                  let year = parts[2];
                  if (year.length === 2) {
                    year = '20' + year;
                  }
                  return `${year}-${month}-${day}`;
                }
              } catch (e) {}
              return null;
            }

            const transactionDate = parseBogDate(record.doc_value_date);
            const correctionDate = parseBogDate(record.doc_rec_date);

            if (!transactionDate) {
              console.log(`⚠️  Skipping record with invalid date: ${record.doc_key}_${record.entries_id}`);
              continue;
            }

            // Calculate amounts
            const credit = parseFloat(record.entry_cr_amt) || 0;
            const debit = parseFloat(record.entry_db_amt) || 0;
            const accountCurrencyAmount = credit - debit;

            // Determine counteragent from INN
            const isCredit = credit > 0;
            const counteragentInn = isCredit ? 
              (record.doc_sender_inn || '').trim() : 
              (record.doc_benef_inn || '').trim();
            
            const counteragentAccountNumber = isCredit ?
              record.doc_sender_acct_no :
              record.doc_benef_acct_no;

            // Match counteragent by INN if not already set
            if (!counteragentUuid && counteragentInn && counteragentsMap[counteragentInn]) {
              counteragentUuid = counteragentsMap[counteragentInn];
            }

            // Generate UUID
            const recordUuidStr = `${record.doc_key}_${record.entries_id}`;
            const { v5: uuidv5, parse: uuidParse } = require('uuid');
            const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // DNS namespace
            const recordUuid = uuidv5(recordUuidStr, namespace);

            // Get account currency
            const currencyResult = await client.query(`
              SELECT currency_uuid FROM bank_accounts WHERE uuid = $1
            `, [accountUuid]);
            const accountCurrencyUuid = currencyResult.rows[0]?.currency_uuid;

            // Insert into consolidated_bank_accounts
            await client.query(`
              INSERT INTO consolidated_bank_accounts (
                uuid, account_uuid, account_currency_uuid, account_currency_amount,
                payment_uuid, counteragent_uuid, project_uuid, financial_code_uuid,
                nominal_currency_uuid, nominal_amount, date, correction_date,
                id_1, id_2, record_uuid, counteragent_account_number, description
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
              )
            `, [
              recordUuid,
              accountUuid,
              accountCurrencyUuid,
              accountCurrencyAmount,
              paymentUuid,
              counteragentUuid,
              projectUuid,
              financialCodeUuid,
              nominalCurrencyUuid,
              accountCurrencyAmount, // nominal_amount same as account for now
              transactionDate,
              correctionDate,
              record.doc_key,
              record.entries_id,
              recordUuidStr,
              counteragentAccountNumber,
              record.doc_nomination
            ]);

            // Mark raw record as processed
            await client.query(`
              UPDATE ${rawTableName}
              SET is_processed = true, updated_at = NOW()
              WHERE uuid = $1
            `, [record.raw_uuid]);

            successCount++;
            matched = true;
            break; // Stop checking other rules for this record
          }
        } catch (error) {
          console.error(`❌ Error processing record ${record.doc_key}_${record.entries_id}:`, error.message);
          failCount++;
        }
      }

      if (!matched) {
        console.log(`⚠️  No rule match for record ${record.doc_key}_${record.entries_id}`);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Rules matched: ${matchedCount}`);
    console.log(`   ✅ Successfully processed: ${successCount}`);
    console.log(`   ⚠️  Errors: ${failCount}`);
    console.log(`   📝 Total raw records: ${rawResult.rows.length}`);

  } catch (error) {
    console.error('❌ Error during backparsing:', error);
  } finally {
    await client.end();
  }
}

backparseData();
