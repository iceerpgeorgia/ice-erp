import { prisma } from '../lib/prisma';

const run = async () => {
  const invalidRows = await prisma.$queryRawUnsafe<
    Array<{ id: bigint; payment_id: string; record_uuid: string }>
  >(
    "SELECT id, payment_id, record_uuid FROM payments WHERE record_uuid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'"
  );

  if (invalidRows.length === 0) {
    console.log('No invalid record_uuid values found.');
    return;
  }

  console.log(`Found ${invalidRows.length} invalid record_uuid values.`);

  for (const row of invalidRows) {
    const newRows = await prisma.$queryRawUnsafe<Array<{ uuid: string }>>(
      'SELECT gen_random_uuid()::text as uuid'
    );
    const newUuid = newRows[0]?.uuid;
    if (!newUuid) {
      throw new Error('Failed to generate new UUID');
    }

    await prisma.$transaction([
      prisma.$executeRawUnsafe(
        'UPDATE payments SET record_uuid = $1, updated_at = NOW() WHERE id = $2',
        newUuid,
        row.id
      ),
      prisma.$executeRawUnsafe(
        'UPDATE bank_transaction_batches SET payment_uuid = $1 WHERE payment_uuid = $2',
        newUuid,
        row.record_uuid
      ),
    ]);

    console.log(`${row.payment_id}: ${row.record_uuid} -> ${newUuid}`);
  }
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
