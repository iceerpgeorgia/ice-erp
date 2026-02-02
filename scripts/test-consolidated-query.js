const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function run() {
  const rows = await prisma.$queryRawUnsafe('SELECT COUNT(*)::bigint as count FROM "consolidated_bank_accounts"');
  console.log(rows);
}

run()
  .catch(error => {
    console.error('Error:', error.message);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
