import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const all = await p.rs_waybills_in_api.findMany({
  select: { rs_id: true, state: true, is_confirmed: true, sum: true }
});
const withItems = await p.rs_waybills_in_items.findMany({ select: { rs_id: true }, distinct: ['rs_id'] });
const has = new Set(withItems.map(r => r.rs_id));
const missing = all.filter(w => !has.has(w.rs_id));

console.log('Total:', all.length, ' With items:', has.size, ' Missing:', missing.length);

const byState = {};
let zeroSum = 0, nonZero = 0, confirmed = 0, unconfirmed = 0;
for (const w of missing) {
  const s = w.state ?? 'null';
  byState[s] = (byState[s] ?? 0) + 1;
  if (!w.sum || Number(w.sum) === 0) zeroSum++; else nonZero++;
  if (w.is_confirmed === true) confirmed++; else unconfirmed++;
}
console.log('By state:', JSON.stringify(byState, null, 2));
console.log('Sum=0/null:', zeroSum, ' Sum>0:', nonZero);
console.log('Confirmed:', confirmed, ' Not confirmed:', unconfirmed);
await p.$disconnect();
