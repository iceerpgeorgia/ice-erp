const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT counteragent_uuid::text AS counteragent_uuid, payment_id, salary_month::text AS salary_month,
           deducted_insurance::text AS deducted_insurance,
           surplus_insurance::text AS surplus_insurance
    FROM salary_accruals
    WHERE counteragent_uuid = '01dfe71d-5350-4a02-abcd-c6a3c15b94ee'::uuid
      AND UPPER(payment_id) LIKE '%PRL012023'
    LIMIT 5
  `);
  console.table(rows);

  const stats = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*)::int AS total_rows,
      COUNT(*) FILTER (WHERE deducted_insurance IS NOT NULL OR surplus_insurance IS NOT NULL)::int AS rows_with_any_insurance
    FROM salary_accruals
  `);
  console.table(stats);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
