import { prisma } from "../lib/prisma";

const pattern = process.argv[2];
if (!pattern) {
  console.error("Usage: pnpm exec tsx scripts/search_payment_id_like.ts <pattern>");
  process.exit(1);
}

async function main() {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT payment_id FROM payments WHERE payment_id ILIKE '%${pattern}%' LIMIT 10`
  );
  const salary = await prisma.$queryRawUnsafe<any[]>(
    `SELECT payment_id FROM salary_accruals WHERE payment_id ILIKE '%${pattern}%' LIMIT 10`
  );
  console.log({ payments: rows, salary });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
