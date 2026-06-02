const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const rows = await p.rs_waybills_in_items.findMany({
    where: { unit_id: '99' },
    select: { rs_id: true },
    distinct: ['rs_id'],
  });
  console.log('Unique waybills with unit_id=99:', rows.length);
  console.log('Sample rs_ids:', rows.slice(0, 5).map(r => r.rs_id));
}
main().finally(() => p.$disconnect());
