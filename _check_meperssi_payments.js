// Check for linked ledger entries, adjustments, and bank transactions on bundle payments
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const caUuid = '43eabc78-af64-4c14-9fef-c7e6a1b6f07e';
  const fc111Uuid = 'b59170ec-16cc-499a-9ff7-0428dcb8f727';

  // Get all project UUIDs
  const projects = await prisma.$queryRawUnsafe(
    `SELECT project_uuid, project_name, currency_uuid FROM projects WHERE counteragent_uuid = $1::uuid AND financial_code_uuid = $2::uuid ORDER BY id`,
    caUuid, fc111Uuid
  );
  const projUuids = projects.map(p => `'${p.project_uuid}'`).join(',');

  // Get all bundle/auto/recurring payment_ids
  const payments = await prisma.$queryRawUnsafe(
    `SELECT id, payment_id, project_uuid, is_project_derived, is_bundle_payment, is_recurring
     FROM payments
     WHERE project_uuid = ANY(ARRAY[${projUuids}]::uuid[])
     AND (is_project_derived = true OR is_bundle_payment = true OR is_recurring = true)`
  );
  const paymentIds = payments.map(p => `'${p.payment_id}'`).join(',');

  console.log(`Total payments to delete: ${payments.length}`);

  if (!paymentIds) { console.log('No payments to process'); return; }

  // Check payments_ledger
  const ledgerCount = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) as cnt FROM payments_ledger WHERE payment_id IN (${paymentIds}) AND is_deleted = false`
  );
  console.log(`Active ledger entries: ${ledgerCount[0].cnt}`);

  // Check payment_adjustments
  const adjCount = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) as cnt FROM payment_adjustments WHERE payment_id IN (${paymentIds}) AND is_deleted = false`
  );
  console.log(`Active payment adjustments: ${adjCount[0].cnt}`);

  // Check deconsolidated tables for linked transactions
  const DECONSOLIDATED_TABLES = [
    'GE78BG0000000893486000_BOG_GEL',
    'GE65TB7856036050100002_TBC_GEL',
    'GE43BG0000000609494201_BOG_GEL',
    'GE43BG0000000609494201_BOG_USD',
  ];

  for (const table of DECONSOLIDATED_TABLES) {
    try {
      const txCount = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as cnt FROM "${table}" WHERE payment_id IN (${paymentIds})`
      );
      if (txCount[0].cnt > 0) {
        console.log(`Bank transactions in ${table} linked to payments: ${txCount[0].cnt}`);
      }
    } catch (e) {
      console.log(`Table ${table} not accessible: ${e.message}`);
    }
  }

  // Check bank_transaction_batches
  const batchCount = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) as cnt FROM bank_transaction_batches WHERE payment_id IN (${paymentIds})`
  );
  console.log(`Bank transaction batches linked: ${batchCount[0].cnt}`);

  // Also check if there are non-bundle/non-derived payments for these projects
  const otherPayments = await prisma.$queryRawUnsafe(
    `SELECT id, payment_id, is_project_derived, is_bundle_payment, is_recurring
     FROM payments
     WHERE project_uuid = ANY(ARRAY[${projUuids}]::uuid[])
     AND is_project_derived = false AND is_bundle_payment = false AND is_recurring = false`
  );
  console.log(`\nOther (non-bundle, non-derived) payments for these projects: ${otherPayments.length}`);
  if (otherPayments.length > 0) {
    for (const p of otherPayments) console.log(`  - id=${p.id} payment_id=${p.payment_id}`);
  }

  console.log('\nReady to proceed with:');
  console.log(`  - 26 projects: financial_code 1.1.1 → 1.1.3`);
  console.log(`  - Delete ${payments.length} bundle/auto payments`);
  console.log(`  - Create 26 new is_project_derived payments for 1.1.3`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
