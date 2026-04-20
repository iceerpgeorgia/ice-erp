// Trigger reparse for counteragent INN 406198421 to assign counteragent_uuid
// to the 2 stuck records in BOG_GEL (ids 52058, 52642)
require('dotenv').config({ path: '.env.local' });

async function run() {
  // Dynamic import to get the reparse function
  const { reparseByCounteragentInn } = require('./lib/bank-import/reparse');
  
  console.log('Triggering reparse for INN 406198421...');
  const result = await reparseByCounteragentInn(['406198421']);
  console.log('Reparse result:', JSON.stringify(result, null, 2));
  
  // Verify the fix
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  
  const rows = await p.$queryRawUnsafe(
    `SELECT id, counteragent_uuid, counteragent_processed, payment_id 
     FROM "GE78BG0000000893486000_BOG_GEL" 
     WHERE counteragent_inn = $1`, '406198421'
  );
  console.log('\nLocal DB state after reparse:');
  for (const r of rows) {
    console.log(`  id=${r.id} ca_uuid=${r.counteragent_uuid} ca_proc=${r.counteragent_processed} pid=${r.payment_id}`);
  }
  
  await p.$disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
