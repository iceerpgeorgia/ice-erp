const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const cols = await p.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'GE78BG0000000893486000_BOG_GEL' ORDER BY ordinal_position"
  );
  console.log('BOG_GEL columns:', JSON.stringify(cols.map(c => c.column_name)));

  // Test counteragent statement API query for a salary employee
  const salaryEmployee = await p.$queryRawUnsafe(
    "SELECT DISTINCT sa.counteragent_uuid, ca.counteragent FROM salary_accruals sa LEFT JOIN counteragents ca ON sa.counteragent_uuid = ca.counteragent_uuid LIMIT 3"
  );
  console.log('Sample salary employees:', JSON.stringify(salaryEmployee));

  if (salaryEmployee.length > 0) {
    const testUuid = salaryEmployee[0].counteragent_uuid;
    console.log('\nTesting with counteragent:', testUuid);

    // Test payments query
    const paymentRows = await p.$queryRawUnsafe(
      "SELECT payment_id FROM payments WHERE counteragent_uuid = $1::uuid AND is_active = true LIMIT 5",
      testUuid
    );
    console.log('Payments table rows:', paymentRows.length, JSON.stringify(paymentRows));

    // Test salary accruals query
    const salaryRows = await p.$queryRawUnsafe(
      "SELECT payment_id FROM salary_accruals WHERE counteragent_uuid = $1::uuid LIMIT 5",
      testUuid
    );
    console.log('Salary accrual rows:', salaryRows.length, JSON.stringify(salaryRows));

    // Test bank transactions - non-batch
    const bankNonBatch = await p.$queryRawUnsafe(
      `SELECT COUNT(*) as cnt FROM "GE78BG0000000893486000_BOG_GEL" WHERE counteragent_uuid = $1::uuid`,
      testUuid
    );
    console.log('BOG_GEL non-batch rows for counteragent:', bankNonBatch);

    const tbcNonBatch = await p.$queryRawUnsafe(
      `SELECT COUNT(*) as cnt FROM "GE65TB7856036050100002_TBC_GEL" WHERE counteragent_uuid = $1::uuid`,
      testUuid
    );
    console.log('TBC_GEL non-batch rows for counteragent:', tbcNonBatch);

    // Test bank transactions - batch
    const batchRows = await p.$queryRawUnsafe(
      `SELECT COUNT(*) as cnt FROM bank_transaction_batches WHERE counteragent_uuid = $1::uuid`,
      testUuid
    );
    console.log('Batch partition rows for counteragent:', batchRows);

    // Test the full counteragent statement bank query
    try {
      const fullQuery = await p.$queryRawUnsafe(`
        SELECT COUNT(*) as cnt FROM (
          SELECT cba.id
          FROM (
            SELECT id, uuid, raw_record_uuid, counteragent_uuid, bank_account_uuid, account_currency_uuid, nominal_currency_uuid, payment_id
            FROM "GE78BG0000000893486000_BOG_GEL"
            UNION ALL
            SELECT id, uuid, raw_record_uuid, counteragent_uuid, bank_account_uuid, account_currency_uuid, nominal_currency_uuid, payment_id
            FROM "GE65TB7856036050100002_TBC_GEL"
          ) cba
          WHERE NOT EXISTS (
            SELECT 1 FROM bank_transaction_batches btb WHERE btb.raw_record_uuid::text = cba.raw_record_uuid::text
          )
          AND cba.counteragent_uuid = $1::uuid

          UNION ALL

          SELECT cba.id
          FROM (
            SELECT id, uuid, raw_record_uuid, counteragent_uuid, bank_account_uuid, account_currency_uuid, nominal_currency_uuid, payment_id
            FROM "GE78BG0000000893486000_BOG_GEL"
            UNION ALL
            SELECT id, uuid, raw_record_uuid, counteragent_uuid, bank_account_uuid, account_currency_uuid, nominal_currency_uuid, payment_id
            FROM "GE65TB7856036050100002_TBC_GEL"
          ) cba
          JOIN bank_transaction_batches btb ON btb.raw_record_uuid::text = cba.raw_record_uuid::text
          WHERE btb.counteragent_uuid = $1::uuid
        ) result
      `, testUuid);
      console.log('Full bank query result:', fullQuery);
    } catch (e) {
      console.error('Full bank query ERROR:', e.message);
    }
  }

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
