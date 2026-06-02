const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRawUnsafe(`
  SELECT pg_get_constraintdef(oid) AS def
  FROM pg_constraint
  WHERE conname = 'payments_payment_id_format_check'
`).then(r => {
  console.log('Constraint:', r[0]?.def);
  return p.$queryRawUnsafe(`SELECT payment_id FROM payments WHERE payment_id LIKE 'WB-%' LIMIT 5`);
}).then(r => {
  console.log('Existing WB- payments:', r);
  p.$disconnect();
}).catch(e => { console.error(e); p.$disconnect(); });
