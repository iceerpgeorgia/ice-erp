const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.rs_waybills_in_api.groupBy({ by: ['is_confirmed'], _count: true })
  .then(r => { r.forEach(x => console.log('is_confirmed=' + x.is_confirmed + ': ' + x._count)); })
  .finally(() => p.$disconnect());
