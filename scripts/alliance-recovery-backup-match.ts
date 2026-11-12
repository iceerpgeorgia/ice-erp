#!/usr/bin/env npx ts-node
/**
 * Alliance Highline Cost Payment Recovery - Backup Matching Script
 *
 * This script:
 * 1. Loads backup CSV with original payment_ids
 * 2. Loads production CSV with orphaned payments
 * 3. Matches them using composite key + ROW_NUMBER approach
 * 4. Generates recovery SQL with validation
 * 5. Outputs recovery commands
 */

import * as fs from 'fs';
import * as path from 'path';

interface PaymentRecord {
  id: string;
  uuid: string;
  counteragent_uuid: string;
  payment_id?: string | null;
  amount: string;
  financial_code_uuid: string;
  created_at: string;
  waybill_derived?: string;
}

function loadCSV(filePath: string): PaymentRecord[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  
  if (lines.length < 2) {
    throw new Error(`CSV file is empty: ${filePath}`);
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const records: PaymentRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const record: any = {};
    
    headers.forEach((header, idx) => {
      record[header] = values[idx] || null;
    });
    
    records.push(record);
  }

  return records;
}

function getCompositeKey(record: PaymentRecord): string {
  return `${record.financial_code_uuid}|${record.counteragent_uuid}`;
}

function matchPayments(
  backupRecords: PaymentRecord[],
  orphanedRecords: PaymentRecord[]
): { matched: Array<{ orphaned: PaymentRecord; source: PaymentRecord }>; unmatched: PaymentRecord[] } {
  
  // Group by composite key
  const backupByKey = new Map<string, PaymentRecord[]>();
  const orphanedByKey = new Map<string, PaymentRecord[]>();

  backupRecords.forEach(r => {
    const key = getCompositeKey(r);
    if (!backupByKey.has(key)) backupByKey.set(key, []);
    backupByKey.get(key)!.push(r);
  });

  orphanedRecords.forEach(r => {
    const key = getCompositeKey(r);
    if (!orphanedByKey.has(key)) orphanedByKey.set(key, []);
    orphanedByKey.get(key)!.push(r);
  });

  const matched: Array<{ orphaned: PaymentRecord; source: PaymentRecord }> = [];
  const unmatched: PaymentRecord[] = [];

  // Match within each composite key group
  for (const [key, orphanedRecs] of orphanedByKey.entries()) {
    const backupRecs = backupByKey.get(key) || [];
    
    if (backupRecs.length !== orphanedRecs.length) {
      console.warn(
        `⚠️  Count mismatch for composite key "${key}": ` +
        `backup has ${backupRecs.length} records, orphaned has ${orphanedRecs.length} records`
      );
    }

    for (let i = 0; i < orphanedRecs.length; i++) {
      const orphaned = orphanedRecs[i];
      const source = backupRecs[i];

      if (source && source.payment_id) {
        matched.push({ orphaned, source });
      } else {
        unmatched.push(orphaned);
      }
    }
  }

  return { matched, unmatched };
}

function generateRecoverySql(
  matched: Array<{ orphaned: PaymentRecord; source: PaymentRecord }>
): string[] {
  return matched.map(({ orphaned, source }) => {
    const paymentId = source.payment_id!.replace(/'/g, "''"); // Escape single quotes
    return `UPDATE payments SET payment_id = '${paymentId}' WHERE uuid = '${orphaned.uuid}';`;
  });
}

function main() {
  console.log('🔄 Alliance Highline Cost Payment Recovery - Backup Matching\n');

  const backupFile = 'alliance_cost_payments_backup.csv';
  const orphanedFile = 'alliance_orphaned_payments_prod.csv';

  // Check files exist
  if (!fs.existsSync(backupFile)) {
    console.error(`❌ Missing file: ${backupFile}`);
    console.error(`\n📝 Generate it by running this query against the backup database:\n`);
    console.error(`SELECT id, uuid, project_uuid, counteragent_uuid, payment_id, amount, financial_code_uuid, waybill_derived, created_at, updated_at FROM payments WHERE project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262' AND waybill_derived = TRUE AND payment_id IS NOT NULL ORDER BY financial_code_uuid, counteragent_uuid, id;\n`);
    process.exit(1);
  }

  if (!fs.existsSync(orphanedFile)) {
    console.error(`❌ Missing file: ${orphanedFile}`);
    console.error(`\n📝 Generate it by running this query against production:\n`);
    console.error(`SELECT id, uuid, project_uuid, counteragent_uuid, payment_id, amount, financial_code_uuid, waybill_derived, created_at, updated_at FROM payments WHERE project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262' AND waybill_derived = TRUE AND payment_id IS NULL ORDER BY financial_code_uuid, counteragent_uuid, id;\n`);
    process.exit(1);
  }

  // Load CSVs
  console.log(`📂 Loading backup data from: ${backupFile}`);
  const backupData = loadCSV(backupFile);
  console.log(`   ✅ Loaded ${backupData.length} records from backup\n`);

  console.log(`📂 Loading orphaned data from: ${orphanedFile}`);
  const orphanedData = loadCSV(orphanedFile);
  console.log(`   ✅ Loaded ${orphanedData.length} records from production\n`);

  // Match payments
  console.log(`🔍 Matching payments by composite key...\n`);
  const { matched, unmatched } = matchPayments(backupData, orphanedData);

  // Generate SQL
  console.log(`✅ Generated recovery mapping:`);
  console.log(`   Matched: ${matched.length} payments`);
  console.log(`   Unmatched: ${unmatched.length} payments\n`);

  if (unmatched.length > 0) {
    console.warn(`⚠️  WARNING: ${unmatched.length} orphaned payments could not be matched!`);
    console.warn(`   This may indicate data corruption or backup/production mismatch.\n`);
    unmatched.forEach(r => {
      console.warn(`   - UUID: ${r.uuid}, Amount: ${r.amount}, Created: ${r.created_at}`);
    });
    console.warn(`\n   ⚠️  Review these records carefully before proceeding.\n`);
  }

  if (matched.length !== 20) {
    console.warn(`\n⚠️  Expected 20 matches, but got ${matched.length}`);
    console.warn(`   This may indicate the backup has different data than expected.\n`);
  }

  // Generate recovery SQL
  const recoverySql = generateRecoverySql(matched);

  // Save to file
  const outputFile = 'alliance-recovery-statements.sql';
  fs.writeFileSync(outputFile, recoverySql.join('\n') + '\n');
  console.log(`💾 Saved ${recoverySql.length} UPDATE statements to: ${outputFile}\n`);

  // Generate transaction wrapper
  const transactionFile = 'alliance-recovery-transaction.sql';
  const transactionSql = `
-- Alliance Highline Cost Payment Recovery Transaction
-- Project UUID: dc975886-9bf9-42c8-afbe-87695aa01262
-- Generated: ${new Date().toISOString()}

BEGIN;

-- Verify starting state (should be 20 orphaned records)
CREATE TEMP TABLE recovery_starting_state AS
SELECT uuid, payment_id, amount, financial_code_uuid
FROM payments
WHERE project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
  AND waybill_derived = TRUE
  AND payment_id IS NULL;

SELECT 'Starting state:' as info, COUNT(*) as orphaned_count FROM recovery_starting_state;

-- Execute recovery updates
${recoverySql.join('\n')}

-- Verify recovery results
SELECT 
    'Recovery results:' as info,
    COUNT(DISTINCT payment_uuid) as payments_with_ids,
    COUNT(*) as total_with_ids
FROM payments
WHERE project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
  AND waybill_derived = TRUE
  AND payment_id IS NOT NULL;

-- Final verification (should be 20)
SELECT 
    'Final state:' as info,
    SUM(CASE WHEN payment_id IS NOT NULL THEN 1 ELSE 0 END) as with_ids,
    SUM(CASE WHEN payment_id IS NULL THEN 1 ELSE 0 END) as without_ids
FROM payments
WHERE project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
  AND waybill_derived = TRUE;

-- If all looks good, COMMIT; otherwise ROLLBACK;
-- COMMIT;
-- ROLLBACK;
`.trim();

  fs.writeFileSync(transactionFile, transactionSql + '\n');
  console.log(`📋 Saved transaction wrapper to: ${transactionFile}\n`);

  // Show summary
  console.log('═'.repeat(60));
  console.log('📊 RECOVERY SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Backup Records:     ${backupData.length}`);
  console.log(`Orphaned Records:   ${orphanedData.length}`);
  console.log(`Matched:            ${matched.length}`);
  console.log(`Unmatched:          ${unmatched.length}`);
  console.log(`Expected:           20`);
  console.log('═'.repeat(60));

  if (matched.length === 20 && unmatched.length === 0) {
    console.log('✅ Recovery mapping is COMPLETE and READY to execute\n');
    console.log('📝 Next steps:');
    console.log('   1. Review the SQL in: alliance-recovery-transaction.sql');
    console.log('   2. Copy to Supabase SQL Editor');
    console.log('   3. Run the transaction');
    console.log('   4. Verify results show 20 recovered payments');
    console.log('   5. Verify UI functionality (Payments Report, Job Distributions)');
    console.log('   6. Delete temporary backup project\n');
  } else {
    console.log('⚠️  Recovery mapping has issues - review before executing\n');
    console.log('❌ DO NOT proceed until matched count = 20 and unmatched = 0\n');
  }

  // Show first few SQL statements as preview
  console.log('📋 SQL Preview (first 3 statements):');
  console.log('─'.repeat(60));
  recoverySql.slice(0, 3).forEach((sql, i) => {
    console.log(`${i + 1}. ${sql}`);
  });
  if (recoverySql.length > 3) {
    console.log(`... and ${recoverySql.length - 3} more statements`);
  }
  console.log('─'.repeat(60));
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
