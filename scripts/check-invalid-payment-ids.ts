import { prisma } from '../lib/prisma';

const run = async () => {
  const rows = await prisma.$queryRawUnsafe<Array<{ payment_id: string }>>(
    "SELECT payment_id FROM payments WHERE payment_id !~ '^[0-9a-f]{6}_[0-9a-f]{2}_[0-9a-f]{6}$'"
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
