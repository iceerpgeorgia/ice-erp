const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
});

async function processAllRecords(shouldTruncate = false) {
  console.log('🔄 Starting comprehensive BOG GEL processing...\n');

  try {
    await client.connect();
    console.log('✅ Connected to Supabase\n');

    const accountNumber = 'GE78BG0000000893486000';
    const rawTableName = 'bog_gel_raw_893486000';

    // 1. Get account info - specifically the GEL currency account
    const accountResult = await client.query(`
      SELECT ba.uuid, ba.currency_uuid 
      FROM bank_accounts ba
      JOIN currencies c ON ba.currency_uuid = c.uuid
      WHERE ba.account_number = $1 AND c.code = 'GEL'
    `, [accountNumber]);

    if (accountResult.rows.length === 0) {
      console.error('❌ GEL account not found');
      return;
    }

    const accountUuid = accountResult.rows[0].uuid;
    const accountCurrencyUuid = accountResult.rows[0].currency_uuid;
    console.log(`✅ Account UUID: ${accountUuid}`);
    console.log(`💰 Account Currency UUID: ${accountCurrencyUuid}\n`);

    // 2. Truncate consolidated_bank_accounts if requested
    if (shouldTruncate) {
      console.log('🗑️  Truncating consolidated_bank_accounts...');
      await client.query('TRUNCATE TABLE consolidated_bank_accounts CASCADE');
      console.log('✅ Table truncated\n');

      // Reset is_processed flag on raw records
      console.log('🔄 Resetting is_processed flag on raw records...');
      await client.query(`UPDATE ${rawTableName} SET is_processed = false`);
      console.log('✅ Reset complete\n');
    }

    // 3. Load parsing rules for BOG_GEL
    const rulesResult = await client.query(`
      SELECT 
        r.id, 
        r.condition, 
        r.payment_id,
        r.counteragent_uuid,
        r.financial_code_uuid,
        r.nominal_currency_uuid
      FROM parsing_scheme_rules r
      JOIN parsing_schemes s ON r.scheme_uuid = s.uuid
      WHERE s.scheme = 'BOG_GEL'
      ORDER BY r.id ASC
    `);
    console.log(`✅ Loaded ${rulesResult.rows.length} parsing rule(s)\n`);

    // 4. Load counteragents map
    const counteragentsResult = await client.query(`
      SELECT counteragent_uuid, identification_number, counteragent 
      FROM counteragents 
      WHERE identification_number IS NOT NULL
    `);
    const counteragentsMap = {};
    const counteragentNamesMap = {};
    counteragentsResult.rows.forEach(row => {
      counteragentsMap[row.identification_number] = row.counteragent_uuid;
      counteragentNamesMap[row.counteragent_uuid] = row.counteragent;
    });
    console.log(`✅ Loaded ${counteragentsResult.rows.length} counteragents\n`);

    // 5. Load payments map
    const paymentsResult = await client.query(`
      SELECT record_uuid, payment_id, counteragent_uuid, project_uuid, 
             financial_code_uuid, currency_uuid 
      FROM payments 
      WHERE payment_id IS NOT NULL
    `);
    const paymentsMap = {};
    paymentsResult.rows.forEach(row => {
      paymentsMap[row.payment_id] = {
        payment_uuid: row.record_uuid,
        counteragent_uuid: row.counteragent_uuid,
        project_uuid: row.project_uuid,
        financial_code_uuid: row.financial_code_uuid,
        currency_uuid: row.currency_uuid
      };
    });
    console.log(`✅ Loaded ${paymentsResult.rows.length} payments\n`);

    // 6. Load NBG exchange rates
    const ratesResult = await client.query(`
      SELECT date, usd_rate, eur_rate, cny_rate, gbp_rate, rub_rate, try_rate, aed_rate, kzt_rate
      FROM nbg_exchange_rates
    `);
    const nbgRatesMap = {};
    ratesResult.rows.forEach(row => {
      const dateKey = row.date.toISOString().split('T')[0];
      nbgRatesMap[dateKey] = {
        'USD': row.usd_rate,
        'EUR': row.eur_rate,
        'CNY': row.cny_rate,
        'GBP': row.gbp_rate,
        'RUB': row.rub_rate,
        'TRY': row.try_rate,
        'AED': row.aed_rate,
        'KZT': row.kzt_rate
      };
    });
    console.log(`✅ Loaded NBG rates for ${Object.keys(nbgRatesMap).length} dates\n`);

    // 7. Get unprocessed records
    const rawResult = await client.query(`
      SELECT 
        uuid as raw_uuid,
        dockey,
        entriesid,
        docrecdate,
        docvaluedate,
        docprodgroup,
        docnomination,
        docinformation,
        entrycramt,
        entrydbamt,
        docsenderinn,
        docbenefinn,
        docsenderacctno,
        docbenefacctno,
        docsrcccy,
        docdstccy
      FROM ${rawTableName}
      WHERE is_processed = false
      ORDER BY docvaluedate, dockey, entriesid
    `);

    console.log(`📊 Found ${rawResult.rows.length} unprocessed raw records\n`);

    if (rawResult.rows.length === 0) {
      console.log('✅ No records to process');
      return;
    }

    // 8. Process each record
    let successCount = 0;
    let skippedDuplicates = 0;
    let skippedInvalidDate = 0;
    let ruleMatchCount = 0;
    let paymentMatchCount = 0;
    const invalidDateRecords = [];

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

    for (const record of rawResult.rows) {
      // Check for duplicates
      const dupCheck = await client.query(`
        SELECT uuid FROM consolidated_bank_accounts 
        WHERE id_1 = $1 AND id_2 = $2
      `, [record.dockey, record.entriesid]);

      if (dupCheck.rows.length > 0) {
        skippedDuplicates++;
        continue;
      }

      // Parse dates
      const transactionDate = parseBogDate(record.docvaluedate);
      const correctionDate = parseBogDate(record.docrecdate);

      if (!transactionDate) {
        skippedInvalidDate++;
        invalidDateRecords.push({
          dockey: record.dockey,
          entriesid: record.entriesid,
          docvaluedate: record.docvaluedate,
          docrecdate: record.docrecdate,
          description: record.docnomination
        });
        continue;
      }

      // Calculate amounts
      const credit = parseFloat(record.entrycramt) || 0;
      const debit = parseFloat(record.entrydbamt) || 0;
      const accountCurrencyAmount = credit - debit;

      // Determine transaction direction
      const isCredit = credit > 0;
      const counteragentInn = (isCredit ? record.docsenderinn : record.docbenefinn)?.trim() || null;
      const counteragentAccountNumber = isCredit ? record.docsenderacctno : record.docbenefacctno;

      // Initialize fields
      let paymentUuid = null;
      let counteragentUuid = null;
      let projectUuid = null;
      let financialCodeUuid = null;
      let nominalCurrencyUuid = null;

      // Match counteragent by INN
      if (counteragentInn && counteragentsMap[counteragentInn]) {
        counteragentUuid = counteragentsMap[counteragentInn];
      }

      // PRIORITY 1: Try parsing rules FIRST
      let matchedByRule = false;
      
      for (const rule of rulesResult.rows) {
        let conditionMet = false;

        // Evaluate parsing rule condition
        const simpleMatch = rule.condition.match(/^(\w+)="([^"]+)"$/);
        if (simpleMatch) {
          const [, columnName, expectedValue] = simpleMatch;
          const actualValue = record[columnName.toLowerCase()];
          conditionMet = actualValue === expectedValue;
        }

        if (conditionMet) {
          matchedByRule = true;
          ruleMatchCount++;

          if (rule.payment_id && paymentsMap[rule.payment_id]) {
            // Rule has payment_id: Use ALL fields from payment (like direct payment_id match)
            const payment = paymentsMap[rule.payment_id];
            paymentUuid = payment.payment_uuid;
            counteragentUuid = payment.counteragent_uuid;
            projectUuid = payment.project_uuid;
            financialCodeUuid = payment.financial_code_uuid;
            nominalCurrencyUuid = payment.currency_uuid;
          } else {
            // Rule does NOT have payment_id: Use rule's own fields
            if (rule.counteragent_uuid) counteragentUuid = rule.counteragent_uuid;
            if (rule.financial_code_uuid) financialCodeUuid = rule.financial_code_uuid;
            if (rule.nominal_currency_uuid) nominalCurrencyUuid = rule.nominal_currency_uuid;
            // Keep INN-matched counteragent if rule doesn't specify one
          }

          break; // Stop at first matching rule
        }
      }

      // PRIORITY 2: If not matched by rule, try payment_id in docinformation
      if (!matchedByRule) {
        const docInfoText = record.docinformation?.trim();

        if (docInfoText && paymentsMap[docInfoText]) {
          const payment = paymentsMap[docInfoText];
          paymentUuid = payment.payment_uuid;
          projectUuid = payment.project_uuid;
          financialCodeUuid = payment.financial_code_uuid;
          nominalCurrencyUuid = payment.currency_uuid;

          // Validate counteragent match
          if (counteragentUuid && payment.counteragent_uuid !== counteragentUuid) {
            const paymentCounterName = counteragentNamesMap[payment.counteragent_uuid] || 'Unknown';
            const innCounterName = counteragentNamesMap[counteragentUuid] || 'Not in the base';
            console.log(`⚠️  Counteragent mismatch for ${record.dockey}_${record.entriesid}: Payment ID = ${docInfoText}, Payment_ID counteragent = ${paymentCounterName}; Raw data inn = ${counteragentInn}, Raw data inn counteragent = ${innCounterName}`);
            // Keep INN-matched counteragent, clear payment
            paymentUuid = null;
            projectUuid = null;
            financialCodeUuid = null;
            nominalCurrencyUuid = null;
          } else {
            paymentMatchCount++;
          }
        }
      }

      // Fall back to account currency if nominal currency not identified
      if (!nominalCurrencyUuid) {
        nominalCurrencyUuid = accountCurrencyUuid;
      }

      // Calculate nominal amount
      let nominalAmount = accountCurrencyAmount;
      
      if (nominalCurrencyUuid) {
        const currResult = await client.query('SELECT code FROM currencies WHERE uuid = $1', [nominalCurrencyUuid]);
        const nominalCurrencyCode = currResult.rows[0]?.code;

        if (nominalCurrencyCode && nominalCurrencyCode !== 'GEL') {
          const rate = nbgRatesMap[transactionDate]?.[nominalCurrencyCode];
          if (rate && rate > 0) {
            nominalAmount = accountCurrencyAmount / rate;
          }
        }
      }

      // Generate UUID
      const { v5: uuidv5 } = require('uuid');
      const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
      const recordUuidStr = `${record.dockey}_${record.entriesid}`;
      const recordUuid = uuidv5(recordUuidStr, namespace);

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
        nominalAmount,
        transactionDate,
        correctionDate,
        record.dockey,
        record.entriesid,
        recordUuidStr,
        counteragentAccountNumber,
        record.docnomination
      ]);

      // Mark raw record as processed
      await client.query(`
        UPDATE ${rawTableName}
        SET is_processed = true, updated_at = NOW()
        WHERE uuid = $1
      `, [record.raw_uuid]);

      successCount++;
    }

    console.log(`\n📊 Processing Summary:`);
    console.log(`   ✅ Successfully processed: ${successCount}`);
    console.log(`   💳 Matched by payment_id: ${paymentMatchCount}`);
    console.log(`   📋 Matched by parsing rule: ${ruleMatchCount}`);
    console.log(`   🔄 Skipped duplicates: ${skippedDuplicates}`);
    console.log(`   ⚠️  Skipped invalid dates: ${skippedInvalidDate}`);
    console.log(`   📝 Total raw records: ${rawResult.rows.length}`);

    if (invalidDateRecords.length > 0) {
      console.log(`\n❌ Records with Invalid Dates:`);
      invalidDateRecords.forEach((rec, idx) => {
        console.log(`   ${idx + 1}. DocKey: ${rec.dockey}, EntriesId: ${rec.entriesid}`);
        console.log(`      Value Date: "${rec.docvaluedate}" | Rec Date: "${rec.docrecdate}"`);
        console.log(`      Description: ${rec.description}`);
      });
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

// Check command line argument for truncate flag
const shouldTruncate = process.argv.includes('--truncate');

if (shouldTruncate) {
  console.log('⚠️  TRUNCATE MODE: Will delete all consolidated_bank_accounts records!\n');
}

processAllRecords(shouldTruncate);
