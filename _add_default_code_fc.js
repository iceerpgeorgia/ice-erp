const { PrismaClient } = require('./node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$queryRawUnsafe('ALTER TABLE financial_codes ADD COLUMN IF NOT EXISTS default_code_fc UUID');
  console.log('Column default_code_fc added (or already existed)');
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e.message); prisma.$disconnect(); process.exit(1); });
