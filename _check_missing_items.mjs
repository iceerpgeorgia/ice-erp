import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const all = await p.rs_waybills_in_api.findMany({ select: { rs_id:true, status:true, type:true, sum:true } });
const withItems = await p.rs_waybills_in_items.findMany({ select:{rs_id:true}, distinct:['rs_id'] });
const has = new Set(withItems.map(r => r.rs_id));
const missing = all.filter(w => !has.has(w.rs_id));
console.log('Total:', all.length, ' With items:', has.size, ' Missing:', missing.length);
const byStatus={}, byType={};
let zeroSum=0, nonZero=0;
for (const w of missing) {
  const s = w.status ?? 'null';
  const t = w.type ?? 'null';
  byStatus[s] = (byStatus[s] ?? 0) + 1;
  byType[t] = (byType[t] ?? 0) + 1;
  if (!w.sum || Number(w.sum) === 0) zeroSum++; else nonZero++;
}
console.log('By status:', JSON.stringify(byStatus, null, 2));
console.log('By type:', JSON.stringify(byType, null, 2));
console.log('Sum=0/null:', zeroSum, ' Sum>0:', nonZero);
await p.$disconnect();

