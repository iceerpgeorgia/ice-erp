const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const cols = await prisma.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name='projects' ORDER BY ordinal_position"
  );
  console.log(cols.map(c => c.column_name).join(', '));
  await prisma.$disconnect();
})();
