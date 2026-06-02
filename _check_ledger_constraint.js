const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRawUnsafe(`
  SELECT pg_get_constraintdef(oid) AS def, conname
  FROM pg_constraint
  WHERE conname = 'check_accrual_or_order'
`).then(r => {
  console.log('Constraint:', r[0]?.def);
  p.$disconnect();
}).catch(e => { console.error(e); p.$disconnect(); });
