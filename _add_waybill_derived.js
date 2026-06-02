const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.$executeRawUnsafe('ALTER TABLE payments ADD COLUMN IF NOT EXISTS waybill_derived BOOLEAN NOT NULL DEFAULT FALSE')
  .then(r => { console.log('Column added, rows affected:', r); })
  .catch(e => { console.error('Error:', e.message); })
  .finally(() => prisma.$disconnect());
