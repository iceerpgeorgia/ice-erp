import { prisma } from '../lib/prisma';

const run = async () => {
  const rows = await prisma.$queryRawUnsafe<Array<{ payment_id: string; record_uuid: string }>>(
    "SELECT payment_id, record_uuid FROM payments WHERE record_uuid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'"
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
