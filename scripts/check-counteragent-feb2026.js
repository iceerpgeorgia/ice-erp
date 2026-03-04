const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      sa.counteragent_uuid::text AS counteragent_uuid,
      sa.salary_month::text AS salary_month,
      sa.payment_id,
      sa.deducted_insurance::text AS deducted_insurance,
      sa.surplus_insurance::text AS surplus_insurance
    FROM salary_accruals sa
    WHERE sa.counteragent_uuid = '0c7f8db5-32e0-420b-b059-ca204377f0f3'::uuid
      AND UPPER(sa.payment_id) LIKE '%PRL022026'
    ORDER BY sa.salary_month DESC
  `);

  console.table(rows);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
