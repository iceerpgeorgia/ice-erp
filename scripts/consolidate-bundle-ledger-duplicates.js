// Consolidate duplicate auto-managed bundle ledger entries.
// For each bundle child payment, keep only the most recent NULL or 'Bundle distribution:%' row,
// summing up nothing — just deleting older duplicates that match (since they were repeated saves).
require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_DATABASE_URL } } });

(async () => {
  const dups = await p.$queryRawUnsafe(`
    SELECT pl.payment_id, ARRAY_AGG(pl.id ORDER BY pl.id ASC) as ids
    FROM payments_ledger pl
    JOIN payments p ON p.payment_id = pl.payment_id
    WHERE p.is_bundle_payment = true
      AND (pl.comment IS NULL OR pl.comment LIKE 'Bundle distribution:%')
    GROUP BY pl.payment_id
    HAVING COUNT(*) > 1
  `);

  console.log(`Found ${dups.length} bundle payments with duplicate auto-managed ledger rows`);
  let totalDeleted = 0;
  for (const d of dups) {
    const idsStr = d.ids.map(String);
    // Keep the LATEST (highest id), delete earlier ones
    const keepId = idsStr[idsStr.length - 1];
    const deleteIds = idsStr.slice(0, -1);
    console.log(`  ${d.payment_id}: keep id=${keepId}, delete ${deleteIds.length} extras: [${deleteIds.join(',')}]`);
    await p.$queryRawUnsafe(
      `DELETE FROM payments_ledger WHERE id IN (${deleteIds.join(',')})`
    );
    totalDeleted += deleteIds.length;
  }
  console.log(`\nTotal deleted: ${totalDeleted} duplicate rows`);
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
