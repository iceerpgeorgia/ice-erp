const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT salary_month::text AS salary_month_text
    FROM salary_accruals
    ORDER BY salary_month_text
    LIMIT 24
  `);
  console.table(rows);

  const sample = await prisma.$queryRawUnsafe(`
    SELECT payment_id, counteragent_uuid::text AS counteragent_uuid, salary_month::text AS salary_month_text
    FROM salary_accruals
    WHERE payment_id ILIKE '%PRL012023%'
    LIMIT 10
  `);
  console.table(sample);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
