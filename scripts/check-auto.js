BigInt.prototype.toJSON = function() { return Number(this); };
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const counts = await p.$queryRawUnsafe(`
    SELECT 
      count(*) as total,
      count(*) FILTER (WHERE is_project_derived = true) as auto_count,
      count(*) FILTER (WHERE is_project_derived = false OR is_project_derived IS NULL) as manual_count
    FROM payments
  `);
  console.log('Payments table counts:', JSON.stringify(counts));

  // Check a few sample auto payments
  const samples = await p.$queryRawUnsafe(`
    SELECT payment_id, is_project_derived, project_uuid, counteragent_uuid
    FROM payments 
    WHERE is_project_derived = true
    LIMIT 5
  `);
  console.log('Sample auto payments:', JSON.stringify(samples, null, 2));

  await p.$disconnect();
}
main().catch(e => { console.error(e); p.$disconnect(); });
