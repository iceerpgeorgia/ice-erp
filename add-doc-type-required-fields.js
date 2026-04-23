const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const cols = [
    ['require_date',         'BOOLEAN NOT NULL DEFAULT false'],
    ['require_value',        'BOOLEAN NOT NULL DEFAULT false'],
    ['require_currency',     'BOOLEAN NOT NULL DEFAULT false'],
    ['require_document_no',  'BOOLEAN NOT NULL DEFAULT false'],
    ['require_project',      'BOOLEAN NOT NULL DEFAULT false'],
  ];
  for (const [col, def] of cols) {
    await p.$executeRawUnsafe(
      `ALTER TABLE document_types ADD COLUMN IF NOT EXISTS ${col} ${def}`
    );
    console.log(`Added: ${col}`);
  }
  console.log('Done.');
  await p.$disconnect();
}

main().catch(e => {
  console.error(e.message);
  p.$disconnect();
  process.exit(1);
});
