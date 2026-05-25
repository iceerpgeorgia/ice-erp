const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check for duplicate rs_ids in rs_waybills_in
  const rows = await prisma.$queryRaw`
    SELECT rs_id, waybill_no, count(*) as cnt
    FROM rs_waybills_in
    WHERE rs_id IS NOT NULL
    GROUP BY rs_id, waybill_no
    HAVING count(*) > 1
    ORDER BY cnt DESC
    LIMIT 20
  `;
  console.log('Duplicate (rs_id, waybill_no) pairs:', rows.length);
  rows.forEach(r => console.log(JSON.stringify(r, (_, v) => typeof v === 'bigint' ? v.toString() : v)));

  // Also check same rs_id with different waybill_nos
  const rows2 = await prisma.$queryRaw`
    SELECT rs_id, count(*) as cnt, array_agg(waybill_no) as waybill_nos
    FROM rs_waybills_in
    WHERE rs_id IS NOT NULL
    GROUP BY rs_id
    HAVING count(*) > 1
    ORDER BY cnt DESC
    LIMIT 20
  `;
  console.log('\nSame rs_id with multiple rows:', rows2.length);
  rows2.forEach(r => console.log(JSON.stringify(r, (_, v) => typeof v === 'bigint' ? v.toString() : v)));
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
