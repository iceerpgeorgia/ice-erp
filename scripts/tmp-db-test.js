const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe('select 1 as ok');
    console.log('DB_OK', rows);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('DB_ERR', error?.message || error);
  process.exit(1);
});
