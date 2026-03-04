const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const marker = 'supabase_insurance_csv_patch';
  const [marked, nonNull, total] = await Promise.all([
    prisma.salary_accruals.count({ where: { updated_by: marker } }),
    prisma.salary_accruals.count({
      where: {
        OR: [
          { surplus_insurance: { not: null } },
          { deducted_insurance: { not: null } },
        ],
      },
    }),
    prisma.salary_accruals.count(),
  ]);

  console.log(JSON.stringify({ marker_rows: marked, rows_with_any_insurance: nonNull, total_rows: total }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
