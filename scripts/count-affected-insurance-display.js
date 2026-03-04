const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*)::int AS affected_rows
    FROM salary_accruals
    WHERE COALESCE(surplus_insurance, 0) > COALESCE(deducted_insurance, 0)
  `);

  console.log(rows[0]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
