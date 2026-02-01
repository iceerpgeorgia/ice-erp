import { prisma } from "../lib/prisma";

const paymentId = process.argv[2];
if (!paymentId) {
  console.error("Usage: pnpm exec tsx scripts/check_payment_id_exists.ts <payment_id>");
  process.exit(1);
}

async function main() {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT payment_id, counteragent_uuid, project_uuid, financial_code_uuid, currency_uuid
     FROM payments
     WHERE lower(payment_id) = lower('${paymentId}')
     LIMIT 5`
  );

  const salary = await prisma.$queryRawUnsafe<any[]>(
    `SELECT payment_id, counteragent_uuid, financial_code_uuid, nominal_currency_uuid
     FROM salary_accruals
     WHERE lower(payment_id) = lower('${paymentId}')
     LIMIT 5`
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
