/**
 * Cleanup script: Remove pending→completed duplicate records.
 * For each DocKey with multiple records having same date+amount but different EntriesId,
 * keep the one with the HIGHEST EntriesId (completed) and delete the rest (pending).
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN = process.argv.includes('--dry-run');

(async () => {
  if (DRY_RUN) console.log('🔍 DRY RUN MODE — no records will be deleted\n');
  else console.log('🗑️  LIVE MODE — duplicate records will be deleted\n');

  const { data: accounts } = await supabase
    .from('bank_accounts')
    .select('account_number, raw_table_name')
    .not('raw_table_name', 'is', null);

  const tableNames = new Set();
  for (const a of accounts || []) tableNames.add(a.raw_table_name);

  let totalDeleted = 0;

  for (const tableName of tableNames) {
    console.log(`\n=== ${tableName} ===`);

    // Fetch all records (paginate)
    let allRecords = [];
    let offset = 0;
    const pageSize = 1000;
    while (true) {
      const { data: page, error } = await supabase
        .from(tableName)
        .select('uuid, dockey, entriesid, transaction_date, account_currency_amount, parsing_lock, conversion_id')
        .order('dockey', { ascending: true })
        .order('entriesid', { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) { console.log(`  Skip: ${error.message}`); allRecords = null; break; }
      if (!page || page.length === 0) break;
      allRecords.push(...page);
      if (page.length < pageSize) break;
      offset += pageSize;
    }
    if (!allRecords) continue;

    // Group by DocKey
    const byDocKey = new Map();
    for (const row of allRecords) {
      if (!byDocKey.has(row.dockey)) byDocKey.set(row.dockey, []);
      byDocKey.get(row.dockey).push(row);
    }

    const uuidsToDelete = [];
    for (const [dockey, rows] of byDocKey) {
      if (rows.length <= 1) continue;

      // Group by date+amount to find same-date+amount entries
      const groups = new Map();
      for (const row of rows) {
        const key = `${row.transaction_date}_${row.account_currency_amount}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
      }

      for (const [, group] of groups) {
        if (group.length <= 1) continue;
        // Multiple records with same DocKey, same date, same amount
        // Sort by EntriesId descending — keep the highest (completed), delete the rest
        group.sort((a, b) => (a.entriesid > b.entriesid ? -1 : 1));
        const keep = group[0]; // highest EntriesId
        for (let i = 1; i < group.length; i++) {
          const del = group[i];
          // Skip if record has parsing_lock or conversion_id
          if (del.parsing_lock || del.conversion_id) {
            console.log(`  ⚠️ SKIP (locked): DocKey=${dockey} EntriesId=${del.entriesid} UUID=${del.uuid}`);
            continue;
          }
          uuidsToDelete.push(del.uuid);
          console.log(`  🗑️  DELETE: DocKey=${dockey} EntriesId=${del.entriesid} UUID=${del.uuid} (keep EntriesId=${keep.entriesid})`);
        }
      }
    }

    if (uuidsToDelete.length === 0) {
      console.log(`  No pending→completed duplicates found`);
      continue;
    }

    console.log(`  Total to delete: ${uuidsToDelete.length}`);

    if (!DRY_RUN) {
      const batchSize = 200;
      for (let i = 0; i < uuidsToDelete.length; i += batchSize) {
        const batch = uuidsToDelete.slice(i, i + batchSize);
        const { error: delErr } = await supabase.from(tableName).delete().in('uuid', batch);
        if (delErr) console.error(`  Error deleting: ${delErr.message}`);
      }
      console.log(`  ✅ Deleted ${uuidsToDelete.length} duplicate records`);
    }

    totalDeleted += uuidsToDelete.length;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Total duplicate records ${DRY_RUN ? 'found' : 'deleted'}: ${totalDeleted}`);
})();
