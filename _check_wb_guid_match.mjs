import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Check sample waybill numbers from Excel
const testWaybillNos = ['0901242866', '0901237743', '0901231340'];

const items = await prisma.rs_waybills_in_items.findMany({
  where: { waybill_no: { in: testWaybillNos } },
  select: { uuid: true, a_id: true, waybill_no: true, goods_code: true, goods_name: true, quantity: true }
});
console.log('Items found by waybill_no:', items.length);
for (const r of items.slice(0, 10)) console.log('  ', JSON.stringify(r));

// Sample goods_code from DB
const sampleCodes = await prisma.rs_waybills_in_items.findMany({
  where: { goods_code: { not: null } },
  select: { goods_code: true, goods_name: true, waybill_no: true },
  take: 5
});
console.log('\nSample goods_code from DB:');
for (const r of sampleCodes) console.log('  ', JSON.stringify(r));

// Period distribution
const periods = await prisma.rs_waybills_in_api.groupBy({
  by: ['period'],
  _count: true,
  orderBy: { period: 'desc' },
  take: 10
});
console.log('\nLatest periods in rs_waybills_in_api:');
for (const r of periods) console.log('  ', r.period, r._count);

const total = await prisma.rs_waybills_in_items.count();
const withInv = await prisma.rs_waybills_in_items.count({ where: { inventory_uuid: { not: null } } });
console.log('\nTotal items:', total, '| with inventory_uuid:', withInv);

await prisma.$disconnect();
