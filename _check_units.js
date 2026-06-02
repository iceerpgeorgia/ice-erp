const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRawUnsafe('SELECT unit, unit_id, COUNT(*) as cnt FROM rs_waybills_in_items GROUP BY unit, unit_id ORDER BY cnt DESC')
  .then(r => { r.forEach(x => console.log(`unit=${x.unit} unit_id=${x.unit_id} cnt=${x.cnt}`)); return p.$disconnect(); })
  .catch(e => { console.error(e); process.exit(1); });
