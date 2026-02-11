import { prisma } from '../lib/prisma';

const counteragents = [
  'ba94ed59-522c-4852-994c-130ef7e8cd30',
  '8e8e99be-75fc-49ec-9d89-960e30e7cb06',
];

const run = async () => {
  const deleted = await prisma.$executeRawUnsafe(
    'DELETE FROM payments WHERE counteragent_uuid = ANY($1::uuid[]) AND created_at::date = CURRENT_DATE',
    counteragents
  );

  console.log({ deleted });
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
