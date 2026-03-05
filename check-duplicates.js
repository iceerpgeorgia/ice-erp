const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Get bank accounts to figure out deconsolidated table names
  const { data: accounts, error: accErr } = await supabase
    .from('bank_accounts')
    .select('account_number, raw_table_name')
    .not('raw_table_name', 'is', null);

  if (accErr) { console.error('Error:', accErr.message); return; }
  
  console.log('Bank accounts with raw table names:');
  const tableNames = new Set();
  for (const a of accounts || []) {
    tableNames.add(a.raw_table_name);
    console.log(`  ${a.account_number} → ${a.raw_table_name}`);
  }

  for (const tableName of tableNames) {
    console.log(`\n${'='.repeat(60)}\n=== Checking ${tableName} ===`);

    // Fetch ALL records (paginate past 1000 limit)
    let allRecords = [];
    let offset = 0;
    const pageSize = 1000;
    while (true) {
      const { data: page, error: err } = await supabase
        .from(tableName)
        .select('uuid, dockey, entriesid, transaction_date, account_currency_amount, docbenefname, docsendername, created_at, import_batch_id, docprodgroup')
        .order('dockey', { ascending: true })
        .order('entriesid', { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (err) {
        console.log(`  Skipped: ${err.message}`);
        allRecords = null;
        break;
      }
      if (!page || page.length === 0) break;
      allRecords.push(...page);
      if (page.length < pageSize) break;
      offset += pageSize;
    }
    if (!allRecords) continue;

    // Group by DocKey
    const byDocKey = new Map();
    for (const row of allRecords || []) {
      if (!byDocKey.has(row.dockey)) byDocKey.set(row.dockey, []);
      byDocKey.get(row.dockey).push(row);
    }

    // Find DocKeys with multiple records
    let duplicateCount = 0;
    const duplicateDetails = [];
    for (const [dockey, rows] of byDocKey) {
      if (rows.length > 1) {
        duplicateCount++;
        if (duplicateDetails.length < 15) {
          duplicateDetails.push({
            dockey,
            count: rows.length,
            entries: rows.map(r => ({
              entriesid: r.entriesid,
              uuid: r.uuid,
              date: r.transaction_date,
              amount: r.account_currency_amount,
              counteragent: (r.docbenefname || r.docsendername || '').slice(0, 40),
              prodgroup: r.docprodgroup,
              created_at: r.created_at,
              batch: r.import_batch_id,
            })),
          });
        }
      }
    }

    console.log(`  Total records: ${(allRecords || []).length}`);
    console.log(`  Unique DocKeys: ${byDocKey.size}`);
    console.log(`  DocKeys with multiple records (duplicates): ${duplicateCount}`);

    // Analyze: same date+amount vs different date/amount
    let sameDateAmount = 0;
    let diffDateAmount = 0;
    const sameDateAmountDetails = [];
    for (const [dockey, rows] of byDocKey) {
      if (rows.length <= 1) continue;
      const first = rows[0];
      let hasSame = false;
      for (let i = 1; i < rows.length; i++) {
        const sameDate = String(first.transaction_date) === String(rows[i].transaction_date);
        const sameAmount = Number(first.account_currency_amount) === Number(rows[i].account_currency_amount);
        if (sameDate && sameAmount) { sameDateAmount++; hasSame = true; }
        else diffDateAmount++;
      }
      if (hasSame && sameDateAmountDetails.length < 10) {
        sameDateAmountDetails.push({
          dockey,
          entries: rows.map(r => ({
            entriesid: r.entriesid,
            date: r.transaction_date,
            amount: r.account_currency_amount,
            prodgroup: r.docprodgroup,
            counteragent: (r.docbenefname || r.docsendername || '').slice(0, 40),
            batch: r.import_batch_id,
          })),
        });
      }
    }
    console.log(`  Same date+amount: ${sameDateAmount} | Different: ${diffDateAmount}`);
    
    if (sameDateAmountDetails.length > 0) {
      console.log(`\n  *** POTENTIAL PENDING→COMPLETED DUPLICATES (same date+amount, first ${sameDateAmountDetails.length}): ***`);
      for (const d of sameDateAmountDetails) {
        console.log(`\n  DocKey: ${d.dockey}`);
        for (const e of d.entries) {
          console.log(`    EntriesId: ${e.entriesid} | Date: ${e.date} | Amt: ${e.amount} | ProdGroup: ${e.prodgroup} | ${e.counteragent} | Batch: ${e.batch}`);
        }
      }
    }
    
    // Count TRN+COM pairs
    let trnComPairs = 0;
    for (const [dockey, rows] of byDocKey) {
      if (rows.length <= 1) continue;
      const prodGroups = rows.map(r => r.docprodgroup);
      if (prodGroups.includes('COM') && (prodGroups.includes('TRN') || prodGroups.includes('PMC'))) {
        trnComPairs++;
      }
    }
    console.log(`  TRN/PMC + COM pairs (transaction + commission): ${trnComPairs}`);

    if (duplicateDetails.length > 0) {
      console.log(`\n  Sample duplicates (first ${duplicateDetails.length}):`);
      for (const d of duplicateDetails) {
        console.log(`\n  DocKey: ${d.dockey} (${d.count} records)`);
        for (const e of d.entries) {
          console.log(`    EntriesId: ${e.entriesid} | Date: ${e.date} | Amt: ${e.amount} | ProdGroup: ${e.prodgroup} | ${e.counteragent} | Batch: ${e.batch}`);
        }
      }
    }
  }
})();
