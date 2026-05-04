const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Check unique indexes on projects
  console.log('=== Unique indexes on projects ===');
  const idx = await p.$queryRawUnsafe(`
    SELECT indexname, indexdef FROM pg_indexes WHERE tablename='projects' ORDER BY indexname
  `);
  console.log(idx);

  // Check usage of each project_uuid in payments_ledger / bank tables / etc.
  for (const projectUuid of ['8e8e9e93-1570-45dc-beb8-75f5d202158f', '285da969-d537-40db-bca4-329a274ddbed']) {
    console.log(`\n=== Usage for ${projectUuid} ===`);

    const paymentIds = await p.$queryRawUnsafe(`
      SELECT array_agg(payment_id) AS ids FROM payments WHERE project_uuid = $1::uuid
    `, projectUuid);
    const ids = paymentIds[0]?.ids || [];
    console.log('Payment IDs:', ids);

    if (ids.length > 0) {
      const ledger = await p.$queryRawUnsafe(`
        SELECT payment_id, COUNT(*)::int AS n FROM payments_ledger WHERE payment_id = ANY($1::text[]) AND (is_deleted IS NULL OR is_deleted=false) GROUP BY payment_id
      `, ids);
      console.log('Ledger rows per payment_id:', ledger);

      const consol = await p.$queryRawUnsafe(`
        SELECT payment_id, COUNT(*)::int AS n FROM consolidated_bank_accounts WHERE payment_id = ANY($1::text[]) GROUP BY payment_id
      `, ids).catch(e => `(err: ${e.message})`);
      console.log('Consolidated bank rows per payment_id:', consol);
    }
  }

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
