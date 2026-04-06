const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

p.$executeRawUnsafe(
  `UPDATE "_prisma_migrations" 
   SET finished_at = NOW() 
   WHERE migration_name = '20260406150000_add_attachments_base' 
     AND finished_at IS NULL`
).then(() => {
  console.log('✓ Updated migration timestamp');
  p.$disconnect();
}).catch(e => {
  console.error(e.message);
  p.$disconnect();
  process.exit(1);
});
