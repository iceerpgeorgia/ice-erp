/**
 * Diagnose duplicate WB- payments: find groups of waybills
 * that share the same (counteragent, project, financial_code, currency)
 * and currently have separate WB- payments.
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  // How many WB- payments exist total?
  const total = await p.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS cnt FROM payments WHERE payment_id LIKE 'WB-%'`
  );
  console.log(`Total WB- payments: ${total[0].cnt}`);

  // How many WB- payments have a non-null project?
  const withProject = await p.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS cnt FROM payments WHERE payment_id LIKE 'WB-%' AND project_uuid IS NOT NULL`
  );
  console.log(`WB- payments with project: ${withProject[0].cnt}`);

  // Find duplicate groups: same (counteragent, project, fc, currency) with >1 WB- payment
  const dupeGroups = await p.$queryRawUnsafe(`
    SELECT
      counteragent_uuid,
      project_uuid,
      financial_code_uuid,
      currency_uuid,
      COUNT(*) AS payment_count,
      array_agg(payment_id ORDER BY payment_id) AS payment_ids
    FROM payments
    WHERE payment_id LIKE 'WB-%'
    GROUP BY counteragent_uuid, project_uuid, financial_code_uuid, currency_uuid
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 10
  `);
  console.log(`\nDuplicate groups (same counteragent+project+fc+currency): ${dupeGroups.length}`);
  if (dupeGroups.length > 0) {
    console.log('Top groups:');
    dupeGroups.slice(0, 5).forEach(g => {
      console.log(`  ${g.payment_count} payments, ca=${g.counteragent_uuid?.slice(0,8)}, proj=${g.project_uuid?.slice(0,8)}, fc=${g.financial_code_uuid?.slice(0,8)}`);
      console.log(`    payment_ids: ${g.payment_ids.slice(0,5).join(', ')}`);
    });
  }

  // Count total duplicate payments (those that could be merged)
  const dupeCount = await p.$queryRawUnsafe(`
    WITH groups AS (
      SELECT
        counteragent_uuid, project_uuid, financial_code_uuid, currency_uuid,
        COUNT(*) AS cnt
      FROM payments
      WHERE payment_id LIKE 'WB-%'
      GROUP BY counteragent_uuid, project_uuid, financial_code_uuid, currency_uuid
      HAVING COUNT(*) > 1
    )
    SELECT COALESCE(SUM(cnt), 0)::int AS total_in_dupe_groups,
           COUNT(*)::int AS num_groups
    FROM groups
  `);
  console.log(`\nTotal WB- payments in duplicate groups: ${dupeCount[0].total_in_dupe_groups}`);
  console.log(`Number of duplicate groups: ${dupeCount[0].num_groups}`);
  console.log(`Payments that would remain after merge: ${dupeCount[0].num_groups} (one per group)`);
  console.log(`Payments that would be deleted: ${dupeCount[0].total_in_dupe_groups - dupeCount[0].num_groups}`);

  // Also check: do waybills have a payment_id column pointing to existing payments?
  const wbCols = await p.$queryRawUnsafe(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'rs_waybills_in_api'
    ORDER BY ordinal_position
  `);
  const colNames = wbCols.map(c => c.column_name);
  console.log(`\nrs_waybills_in_api has payment_id col: ${colNames.includes('payment_id')}`);
  console.log(`Columns: ${colNames.join(', ')}`);
}

run()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
