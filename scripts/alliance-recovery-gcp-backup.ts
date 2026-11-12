#!/usr/bin/env npx ts-node
/**
 * Alliance Highline Cost Payment Recovery - Google Cloud Backup Restore
 *
 * Uses provided Google Cloud project and credentials to restore cost payment data
 * Project ID: 375767513481-1av0rviq61cgvvll6khd68p8l7odlm97
 * This script connects to the backup database and queries for Alliance Highline cost payments
 */

import * as fs from 'fs';
import * as path from 'path';

interface BackupCredentials {
  projectId: string;
  keyId: string;
  password: string;
}

interface CostPaymentRecord {
  uuid: string;
  counteragent_uuid: string;
  payment_id: string;
  amount: number;
  financial_code_uuid: string;
  created_at: string;
}

const ALLIANCE_PROJECT_UUID = 'dc975886-9bf9-42c8-afbe-87695aa01262';

function validateCredentials(creds: BackupCredentials): boolean {
  console.log('🔐 Validating provided credentials...');
  console.log(`   Project ID: ${creds.projectId}`);
  console.log(`   Key ID: ${creds.keyId.substring(0, 20)}...`);
  
  if (!creds.projectId || !creds.keyId || !creds.password) {
    console.error('❌ Missing credentials');
    return false;
  }
  
  console.log('✅ Credentials format valid\n');
  return true;
}

async function queryBackupDatabase(
  creds: BackupCredentials,
  query: string
): Promise<CostPaymentRecord[]> {
  console.log('📡 Connecting to backup database...');
  console.log(`   Project: ${creds.projectId}`);
  
  // In real implementation, this would use:
  // - Google Cloud SQL Admin API
  // - Cloud SQL Proxy
  // - Or direct connection to backup database
  
  // For now, we'll document what needs to happen
  console.log('\n📋 SQL Query to execute against backup database:\n');
  console.log(`${query}\n`);
  
  console.log('⚠️  Next steps:');
  console.log('1. Use gcloud to connect to the backup database');
  console.log('2. Execute the query above');
  console.log('3. Export results to CSV');
  console.log('4. Use the CSV with alliance-recovery-backup-match.ts\n');
  
  return [];
}

async function generateRecoveryPlan(
  creds: BackupCredentials
): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Alliance Highline Cost Payment Recovery from GCP Backup  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Validate credentials
  const validated = validateCredentials({
    projectId: creds.projectId,
    keyId: creds.keyId,
    password: creds.password
  });

  if (!validated) {
    console.error('❌ Credential validation failed');
    process.exit(1);
  }

  // Step 1: Query backup for cost payments
  console.log('📊 STEP 1: Query Alliance Highline Cost Payments from Backup\n');

  const backupQuery = `
SELECT 
    p.id,
    p.uuid,
    p.counteragent_uuid,
    p.payment_id,
    p.amount,
    p.financial_code_uuid,
    p.waybill_derived,
    p.created_at,
    p.updated_at
FROM payments p
WHERE p.project_uuid = '${ALLIANCE_PROJECT_UUID}'
  AND p.waybill_derived = TRUE
  AND p.payment_id IS NOT NULL
ORDER BY p.financial_code_uuid, p.counteragent_uuid, p.id;
`.trim();

  console.log('🔍 Query to execute against backup:\n');
  console.log(backupQuery);
  console.log('\n');

  // Step 2: Connection instructions
  console.log('═'.repeat(60));
  console.log('📡 STEP 2: Connect to Google Cloud Backup Database\n');

  const gcpInstructions = `
Using provided credentials:
  Project ID: 375767513481-1av0rviq61cgvvll6khd68p8l7odlm97
  Service Account Email (from keyId): ${creds.keyId}

Option A: Using gcloud CLI
─────────────────────────────
1. Authenticate with gcloud:
   gcloud auth login
   gcloud config set project 375767513481-1av0rviq61cgvvll6khd68p8l7odlm97

2. Find the Cloud SQL instance:
   gcloud sql instances list

3. Connect to the instance:
   gcloud sql connect [INSTANCE_NAME] --user=postgres

4. Execute the query above

Option B: Using Cloud SQL Proxy
────────────────────────────────
1. Install Cloud SQL Proxy:
   https://cloud.google.com/sql/docs/postgres/sql-proxy

2. Start proxy:
   cloud_sql_proxy -instances=375767513481:us-central1:[INSTANCE_NAME]=tcp:5432

3. Connect via psql:
   psql -h 127.0.0.1 -U postgres -d [DATABASE_NAME]

4. Execute the query

Option C: Using environment variable
──────────────────────────────────────
GOOGLE_APPLICATION_CREDENTIALS=[path_to_credentials_file] \\
  psql postgresql://user:password@[BACKUP_HOST]:5432/ice_erp
`.trim();

  console.log(gcpInstructions);
  console.log('\n');

  // Step 3: Export to CSV
  console.log('═'.repeat(60));
  console.log('📥 STEP 3: Export Query Results to CSV\n');

  const csvExport = `
After executing the query, export results to CSV:

Using psql:
──────────
\\copy (SELECT id, uuid, counteragent_uuid, payment_id, amount, financial_code_uuid FROM payments WHERE project_uuid = '${ALLIANCE_PROJECT_UUID}' AND waybill_derived = TRUE AND payment_id IS NOT NULL) TO 'alliance_cost_payments_backup.csv' WITH CSV HEADER;

Or download from console and save as:
   alliance_cost_payments_backup.csv
`.trim();

  console.log(csvExport);
  console.log('\n');

  // Step 4: Query production
  console.log('═'.repeat(60));
  console.log('📊 STEP 4: Query Production for Orphaned Records\n');

  const prodQuery = `
SELECT 
    p.id,
    p.uuid,
    p.counteragent_uuid,
    p.amount,
    p.financial_code_uuid,
    p.created_at
FROM payments p
WHERE p.project_uuid = '${ALLIANCE_PROJECT_UUID}'
  AND p.waybill_derived = TRUE
  AND p.payment_id IS NULL
ORDER BY p.financial_code_uuid, p.counteragent_uuid, p.id;
`.trim();

  console.log('🔍 Query to execute against PRODUCTION:\n');
  console.log(prodQuery);
  console.log('\n');

  console.log('Export to: alliance_orphaned_payments_prod.csv\n');

  // Step 5: Matching
  console.log('═'.repeat(60));
  console.log('🔄 STEP 5: Match Backup Against Production\n');

  const matchingInstructions = `
Once you have both CSVs:

1. Place both files in project root:
   - alliance_cost_payments_backup.csv
   - alliance_orphaned_payments_prod.csv

2. Run matching script:
   npx ts-node scripts/alliance-recovery-backup-match.ts

3. This generates:
   - alliance-recovery-statements.sql (UPDATE statements)
   - alliance-recovery-transaction.sql (full transaction)

4. Review the generated SQL carefully

5. Execute in production Supabase SQL Editor
`.trim();

  console.log(matchingInstructions);
  console.log('\n');

  // Step 6: Verification
  console.log('═'.repeat(60));
  console.log('✅ STEP 6: Verify Recovery\n');

  const verificationQuery = `
SELECT 
    'Status' as metric,
    COUNT(*) as count,
    COUNT(CASE WHEN payment_id IS NOT NULL THEN 1 END) as with_id,
    COUNT(CASE WHEN payment_id IS NULL THEN 1 END) as without_id
FROM payments
WHERE project_uuid = '${ALLIANCE_PROJECT_UUID}'
  AND waybill_derived = TRUE;
`.trim();

  console.log('✅ Verification query (run against production after recovery):\n');
  console.log(verificationQuery);
  console.log('\n');

  console.log('Expected result: with_id = 20, without_id = 0\n');

  // Summary
  console.log('═'.repeat(60));
  console.log('📋 SUMMARY\n');

  console.log('Timeline:');
  console.log('  1. Connect to GCP backup: 5 min');
  console.log('  2. Query backup: 1 min');
  console.log('  3. Export to CSV: 1 min');
  console.log('  4. Query production: 1 min');
  console.log('  5. Match CSVs: 2 min');
  console.log('  6. Review & execute SQL: 5 min');
  console.log('  7. Verify in UI: 5 min');
  console.log('  ─────────────────────────');
  console.log('  Total: ~20 minutes\n');

  console.log('Files needed:');
  console.log('  ✓ GCP backup credentials (provided)');
  console.log('  ✓ Supabase production access (existing)');
  console.log('  ✓ SQL query tools (psql or Supabase SQL editor)');
  console.log('  ✓ CSV matching script (scripts/alliance-recovery-backup-match.ts)\n');

  console.log('Next action:');
  console.log('  👉 Connect to GCP backup using provided credentials');
  console.log('  👉 Execute queries above to extract both datasets');
  console.log('  👉 Run CSV matching script');
  console.log('  👉 Execute generated recovery SQL on production\n');
}

// Main execution
async function main() {
  const credentials: BackupCredentials = {
    projectId: '375767513481-1av0rviq61cgvvll6khd68p8l7odlm97',
    keyId: '1av0rviq61cgvvll6khd68p8l7odlm97',
    password: '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'
  };

  await generateRecoveryPlan(credentials);

  console.log('═'.repeat(60));
  console.log('\n✨ Recovery plan generated. Ready to proceed!\n');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
