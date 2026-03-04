const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const testUuid = '01dfe71d-5350-4a02-abcd-c6a3c15b94ee';
  
  // Count ALL rows for this counteragent (no batch filter)
  const allRows = await p.$queryRawUnsafe(`
    SELECT COUNT(*) as cnt FROM "GE78BG0000000893486000_BOG_GEL" 
    WHERE counteragent_uuid = $1::uuid`, testUuid);
  console.log('Total BOG_GEL rows with this counteragent_uuid:', Number(allRows[0].cnt));

  // Count rows that have matching batch entries
  const withBatch = await p.$queryRawUnsafe(`
    SELECT COUNT(*) as cnt FROM "GE78BG0000000893486000_BOG_GEL" cba
    WHERE counteragent_uuid = $1::uuid
    AND EXISTS (SELECT 1 FROM bank_transaction_batches btb WHERE btb.raw_record_uuid::text = cba.raw_record_uuid::text)`, testUuid);
  console.log('Rows WITH batch entries:', Number(withBatch[0].cnt));

  // Count rows WITHOUT batch entries  
  const noBatch = await p.$queryRawUnsafe(`
    SELECT COUNT(*) as cnt FROM "GE78BG0000000893486000_BOG_GEL" cba
    WHERE counteragent_uuid = $1::uuid
    AND NOT EXISTS (SELECT 1 FROM bank_transaction_batches btb WHERE btb.raw_record_uuid::text = cba.raw_record_uuid::text)`, testUuid);
  console.log('Rows WITHOUT batch entries:', Number(noBatch[0].cnt));

  // Sample: show a few raw rows and their batch entries
  const sampleRows = await p.$queryRawUnsafe(`
    SELECT cba.id, cba.raw_record_uuid, cba.counteragent_uuid as raw_ca, cba.payment_id as raw_pid, 
           btb.id as btb_id, btb.counteragent_uuid as btb_ca, btb.payment_id as btb_pid, btb.batch_id
    FROM "GE78BG0000000893486000_BOG_GEL" cba
    JOIN bank_transaction_batches btb ON btb.raw_record_uuid::text = cba.raw_record_uuid::text
    WHERE cba.counteragent_uuid = $1::uuid
    LIMIT 5`, testUuid);
  console.log('\nSample rows with batch entries:');
  sampleRows.forEach(r => {
    console.log(`  raw_id=${r.id} raw_ca=${r.raw_ca} btb_ca=${r.btb_ca} raw_pid=${r.raw_pid} btb_pid=${r.btb_pid} batch_id=${r.batch_id}`);
    console.log(`  raw_ca matches? ${String(r.raw_ca) === String(r.btb_ca) ? 'YES' : 'NO -> btb has different counteragent!'}`);
  });

  // Check if batch partitions for this counteragent_uuid exist
  const batchForCA = await p.$queryRawUnsafe(`
    SELECT COUNT(*) as cnt FROM bank_transaction_batches WHERE counteragent_uuid = $1::uuid`, testUuid);
  console.log('\nBatch partitions with counteragent_uuid=employee:', Number(batchForCA[0].cnt));

  // Sample batch partitions for this employee
  const batchSamples = await p.$queryRawUnsafe(`
    SELECT btb.id, btb.raw_record_uuid, btb.counteragent_uuid, btb.payment_id, btb.batch_id
    FROM bank_transaction_batches btb
    WHERE btb.counteragent_uuid = $1::uuid
    LIMIT 5`, testUuid);
  console.log('Sample batch partitions:', batchSamples.length);

  // Check if there are raw rows where counteragent_uuid is set AND batch exists with SAME counteragent
  const matchingBothSides = await p.$queryRawUnsafe(`
    SELECT COUNT(*) as cnt 
    FROM "GE78BG0000000893486000_BOG_GEL" cba
    JOIN bank_transaction_batches btb ON btb.raw_record_uuid::text = cba.raw_record_uuid::text
    WHERE cba.counteragent_uuid = $1::uuid
    AND btb.counteragent_uuid = $1::uuid`, testUuid);
  console.log('Rows matching BOTH raw + batch counteragent:', Number(matchingBothSides[0].cnt));

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
