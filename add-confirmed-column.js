const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const r = await p.$executeRawUnsafe(
    'ALTER TABLE salary_accruals ADD COLUMN IF NOT EXISTS confirmed BOOLEAN NOT NULL DEFAULT false'
  );
  console.log('Column added, affected:', r);
  await p.$disconnect();
}

main().catch(e => {
  console.error(e.message);
  p.$disconnect();
  process.exit(1);
});
