/* eslint-disable */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const ids = ['5a22f1_9a_56b2ec', 'd6a0b5_24_2d3430'];
    console.log('=== payments rows ===');
    const pays = await prisma.$queryRawUnsafe(
      `SELECT payment_id, project_uuid, counteragent_uuid, currency_uuid, is_active, is_project_derived, is_bundle_payment, payment_bundle_uuid
       FROM payments WHERE payment_id = ANY($1::text[])`,
      ids
    );
    console.log(JSON.stringify(pays, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));

    console.log('\n=== payments_ledger rows ===');
    const led = await prisma.$queryRawUnsafe(
      `SELECT id, payment_id, accrual, "order", confirmed, effective_date, is_deleted, user_email, created_at
       FROM payments_ledger WHERE payment_id = ANY($1::text[]) ORDER BY effective_date DESC`,
      ids
    );
    console.log(JSON.stringify(led, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));

    console.log('\n=== effective_date NULL count across payments_ledger ===');
    const nulls = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS null_eff_date FROM payments_ledger WHERE effective_date IS NULL AND (is_deleted = false OR is_deleted IS NULL)`
    );
    console.log(JSON.stringify(nulls));
  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await prisma.$disconnect();
  }
})();
