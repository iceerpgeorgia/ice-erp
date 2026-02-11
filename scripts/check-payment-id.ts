import { prisma } from '../lib/prisma';

const paymentId = process.argv[2];

if (!paymentId) {
  console.error('Usage: pnpm exec tsx scripts/check-payment-id.ts <payment_id>');
  process.exit(1);
}

const run = async () => {
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      payment_id: string;
      record_uuid: string;
      counteragent_uuid: string | null;
      project_uuid: string | null;
      financial_code_uuid: string | null;
      currency_uuid: string | null;
      is_active: boolean | null;
    }>
  >(
    'SELECT payment_id, record_uuid, counteragent_uuid, project_uuid, financial_code_uuid, currency_uuid, is_active FROM payments WHERE payment_id = $1',
    paymentId
  );

  console.log(rows);
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
