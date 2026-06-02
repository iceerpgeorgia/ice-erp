const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRawUnsafe('SELECT uuid, dimension, is_active FROM dimensions ORDER BY dimension')
  .then(r => { r.forEach(x => console.log(`${x.uuid} | ${x.dimension} | active=${x.is_active}`)); return p.$disconnect(); })
  .catch(e => { console.error(e); process.exit(1); });
