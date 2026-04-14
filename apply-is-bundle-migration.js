const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe("ALTER TABLE financial_codes ADD COLUMN IF NOT EXISTS is_bundle BOOLEAN NOT NULL DEFAULT false");
  const check = await prisma.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_name = 'financial_codes' AND column_name = 'is_bundle'");
  console.log('Column:', JSON.stringify(check));
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
