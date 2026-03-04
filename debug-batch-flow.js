const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    // 1. Get the synthetic_id for a batch partition of BTC_42DBCC_B1_AA5049
    // btb.id=276, BOG_GEL offset=0, BATCH_OFFSET=2000000000000
    const syntheticId = 276 + 2000000000000 + 0;
    console.log('Testing synthetic_id:', syntheticId);

    // 2. Simulate what /api/bank-transactions?ids=<syntheticId> returns
    const UNION_SQL_MINI = `
      SELECT cba.id, cba.uuid, cba.bank_account_uuid, cba.raw_record_uuid,
             cba.dockey, cba.entriesid, cba.transaction_date,
             cba.account_currency_amount, cba.nominal_amount,
             cba.payment_id,
             ( btb.id + 2000000000000 + 0 )::bigint as synthetic_id,
             cba.id as source_id,
             btb.batch_id as batch_id,
             btb.id as batch_partition_id,
             btb.payment_id as batch_payment_id_raw,
             COALESCE(
               CASE WHEN btb.payment_id ILIKE 'BTC_%' THEN NULL ELSE btb.payment_id END,
               btb.payment_id
             ) as batch_payment_id
      FROM "GE78BG0000000893486000_BOG_GEL" cba
      JOIN bank_transaction_batches btb ON btb.raw_record_uuid::text = cba.raw_record_uuid::text
    `;
    
    const rows = await p.$queryRawUnsafe(
      `SELECT * FROM (${UNION_SQL_MINI}) sub WHERE sub.synthetic_id = $1::bigint`,
      BigInt(syntheticId)
    );
    
    console.log('\nBank-transactions API would return:',
      JSON.stringify(rows, (k, v) => typeof v === 'bigint' ? Number(v) : v, 2));

    if (rows.length > 0) {
      const row = rows[0];
      console.log('\nKey fields for batch editor:');
      console.log('  recordUuid:', row.raw_record_uuid);
      console.log('  id1 (dockey):', row.dockey);
      console.log('  id2 (entriesid):', row.entriesid);
      console.log('  accountUuid:', row.bank_account_uuid);
      console.log('  batchId:', row.batch_id);
      console.log('  batch_partition_id:', Number(row.batch_partition_id));
      console.log('  payment_id:', row.payment_id);
      console.log('  batch_payment_id:', row.batch_payment_id);
      
      const isDisabled = !row.raw_record_uuid || !row.dockey || !row.entriesid || !row.bank_account_uuid;
      console.log('\n  Button would be DISABLED:', isDisabled);
      if (isDisabled) {
        console.log('    recordUuid missing:', !row.raw_record_uuid);
        console.log('    id1 missing:', !row.dockey);
        console.log('    id2 missing:', !row.entriesid);
        console.log('    accountUuid missing:', !row.bank_account_uuid);
      }

      // 3. Simulate the batch lookup by rawRecordUuid
      const batchStatus = await p.$queryRawUnsafe(`
        SELECT batch_uuid, COUNT(*) as partition_count, SUM(partition_amount) as total_amount
        FROM bank_transaction_batches
        WHERE raw_record_uuid = $1
        GROUP BY batch_uuid
      `, row.raw_record_uuid);
      console.log('\nBatch status lookup:', JSON.stringify(batchStatus, (k, v) => typeof v === 'bigint' ? Number(v) : v, 2));
    }

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await p.$disconnect();
  }
})();
