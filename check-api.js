const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Get a salary employee
  const empRows = await p.$queryRawUnsafe(
    "SELECT DISTINCT sa.counteragent_uuid FROM salary_accruals sa LIMIT 1"
  );
  const testUuid = empRows[0].counteragent_uuid;
  console.log('Testing counteragent:', testUuid);

  // Simulate the counteragent-statement API query
  const counteragentRows = await p.$queryRawUnsafe(
    `SELECT counteragent_uuid, counteragent as counteragent_name, identification_number as counteragent_id
     FROM counteragents WHERE counteragent_uuid = $1::uuid LIMIT 1`, testUuid);
  console.log('Counteragent:', JSON.stringify(counteragentRows[0]));

  const paymentRows = await p.$queryRawUnsafe(
    `SELECT p.payment_id, proj.project_index, proj.project_name, fc.validation as financial_code_validation, fc.code as financial_code, j.job_name, p.income_tax, curr.code as currency_code
     FROM payments p
     LEFT JOIN projects proj ON p.project_uuid = proj.project_uuid
     LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
     LEFT JOIN jobs j ON p.job_uuid = j.job_uuid
     LEFT JOIN currencies curr ON p.currency_uuid = curr.uuid
     WHERE p.counteragent_uuid = $1::uuid AND p.is_active = true`, testUuid);
  console.log('Payment rows:', paymentRows.length);

  const salaryRows = await p.$queryRawUnsafe(
    `SELECT sa.payment_id, fc.validation as financial_code_validation, fc.code as financial_code, curr.code as currency_code
     FROM salary_accruals sa
     LEFT JOIN financial_codes fc ON sa.financial_code_uuid = fc.uuid
     LEFT JOIN currencies curr ON sa.nominal_currency_uuid = curr.uuid
     WHERE sa.counteragent_uuid = $1::uuid`, testUuid);
  console.log('Salary rows:', salaryRows.length);

  // Build paymentIds
  const paymentIdSet = new Set();
  for (const row of salaryRows) {
    if (row.payment_id) paymentIdSet.add(row.payment_id);
  }
  for (const row of paymentRows) {
    if (row.payment_id) paymentIdSet.add(row.payment_id);
  }
  const paymentIds = Array.from(paymentIdSet);
  console.log('Total paymentIds:', paymentIds.length);
  console.log('Sample paymentIds:', paymentIds.slice(0, 5));

  // Test ledger entries
  if (paymentIds.length) {
    const ledgerEntries = await p.$queryRawUnsafe(
      `SELECT COUNT(*) as cnt FROM payments_ledger
       WHERE payment_id = ANY($1::text[]) AND (is_deleted = false OR is_deleted IS NULL)`,
      paymentIds
    );
    console.log('Ledger entries count:', ledgerEntries);
  }

  // Now test the full bank transaction query (the exact one from the API)
  const SOURCE_TABLES = [
    { name: 'GE78BG0000000893486000_BOG_GEL', offset: 0 },
    { name: 'GE65TB7856036050100002_TBC_GEL', offset: 1000000000000 },
  ];
  const BATCH_OFFSET = 2000000000000;

  const rawBankUnionQuery = SOURCE_TABLES.map(t => 
    `SELECT id, uuid, raw_record_uuid, payment_id, dockey, entriesid, account_currency_amount, nominal_amount, exchange_rate, transaction_date, counteragent_account_number, description, created_at, bank_account_uuid, account_currency_uuid, nominal_currency_uuid, counteragent_uuid, '${t.name}' as source_table, ${t.offset}::bigint as source_offset FROM "${t.name}"`
  ).join(' UNION ALL ');

  try {
    const bankTx = await p.$queryRawUnsafe(`
      SELECT COUNT(*) as cnt FROM (
        SELECT
          (cba.id + cba.source_offset)::bigint as synthetic_id,
          cba.id as source_id,
          cba.source_table,
          cba.id,
          cba.uuid,
          CASE WHEN cba.payment_id ILIKE 'BTC_%' THEN NULL ELSE cba.payment_id END as payment_id,
          cba.dockey,
          cba.entriesid,
          NULL::text as batch_payment_id_raw,
          cba.payment_id::text as raw_payment_id,
          cba.account_currency_amount,
          cba.nominal_amount,
          cba.exchange_rate,
          cba.transaction_date,
          cba.counteragent_account_number,
          cba.description,
          cba.created_at
        FROM (${rawBankUnionQuery}) cba
        WHERE NOT EXISTS (
          SELECT 1 FROM bank_transaction_batches btb WHERE btb.raw_record_uuid::text = cba.raw_record_uuid::text
        )
        AND cba.counteragent_uuid = $1::uuid

        UNION ALL

        SELECT
          (btb.id + ${BATCH_OFFSET} + cba.source_offset)::bigint as synthetic_id,
          cba.id as source_id,
          cba.source_table,
          cba.id,
          cba.uuid,
          COALESCE(
            CASE WHEN btb.payment_id ILIKE 'BTC_%' THEN NULL ELSE btb.payment_id END,
            p.payment_id
          ) as payment_id,
          cba.dockey,
          cba.entriesid,
          btb.payment_id as batch_payment_id_raw,
          cba.payment_id::text as raw_payment_id,
          (btb.partition_amount * CASE WHEN cba.account_currency_amount < 0 THEN -1 ELSE 1 END) as account_currency_amount,
          (btb.nominal_amount * CASE WHEN cba.account_currency_amount < 0 THEN -1 ELSE 1 END) as nominal_amount,
          cba.exchange_rate,
          cba.transaction_date,
          cba.counteragent_account_number,
          cba.description,
          cba.created_at
        FROM (${rawBankUnionQuery}) cba
        JOIN bank_transaction_batches btb ON btb.raw_record_uuid::text = cba.raw_record_uuid::text
        LEFT JOIN payments p ON (btb.payment_uuid IS NOT NULL AND p.record_uuid = btb.payment_uuid) OR (btb.payment_uuid IS NULL AND btb.payment_id IS NOT NULL AND p.payment_id = btb.payment_id)
        WHERE btb.counteragent_uuid = $1::uuid
      ) result`, testUuid);
    console.log('Bank transactions count:', bankTx);
  } catch (e) {
    console.error('Bank query ERROR:', e.message);
  }

  // Test real API call
  console.log('\n--- Now testing via HTTP ---');
  try {
    const http = require('http');
    const url = `http://localhost:3000/api/counteragent-statement?counteragentUuid=${testUuid}`;
    console.log('Fetching:', url);
    // We'd need a running server for this, skip for now
    console.log('(Server not running, skipping HTTP test)');
  } catch (e) {
    console.error('HTTP test error:', e.message);
  }

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
