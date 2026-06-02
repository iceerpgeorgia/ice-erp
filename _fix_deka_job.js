const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  const result = await p.$executeRawUnsafe(
    `UPDATE payments
     SET job_uuid = '78089c5a-535b-481d-8b90-f80ebb87af3d'
     WHERE payment_id = '3a55e2_01_705744'
       AND project_uuid = '317f801f-bf5e-43fc-91d4-d5978e6673a3'`
  );
  console.log('Rows updated:', result);
  await p.$disconnect();
}

run().catch(e => { console.error(e.message); process.exit(1); });
