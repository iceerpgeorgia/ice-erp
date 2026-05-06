const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Check raw record's account_currency_amount sign
  const raw = await p.$queryRawUnsafe(`
    SELECT raw_record_uuid, payment_id, parsing_lock,
           account_currency_amount, nominal_amount,
           counteragent_uuid, counteragent_processed
    FROM "GE78BG0000000893486000_BOG_GEL"
    WHERE raw_record_uuid = '20484ee9-8d44-560d-82eb-59dedcb0b33e'
  `);
  console.log('=== Raw record ===');
  console.log(JSON.stringify(raw, (k,v) => typeof v === 'bigint' ? Number(v) : v, 2));

  // Simulate the paidRows query result for this raw record
  const sim = await p.$queryRawUnsafe(`
    SELECT
      lower(trim(split_part(COALESCE(
        CASE WHEN btb.payment_id ILIKE 'BTC_%' THEN NULL ELSE btb.payment_id END,
        p.payment_id
      ), ':', 1))) as payment_id_key,
      COALESCE(btb.counteragent_uuid, p.counteragent_uuid, cba.counteragent_uuid) as counteragent_uuid,
      btb.payment_id as btb_payment_id,
      btb.partition_amount,
      btb.nominal_amount as btb_nominal_amount,
      cba.account_currency_amount,
      (COALESCE(NULLIF(btb.nominal_amount, 0), btb.partition_amount) * CASE WHEN cba.account_currency_amount < 0 THEN -1 ELSE 1 END) as computed_nominal
    FROM "GE78BG0000000893486000_BOG_GEL" cba
    JOIN bank_transaction_batches btb
      ON btb.raw_record_uuid::text = cba.raw_record_uuid::text
    LEFT JOIN payments p
      ON (
        btb.payment_uuid IS NOT NULL AND p.record_uuid = btb.payment_uuid
      ) OR (
        btb.payment_uuid IS NULL AND btb.payment_id IS NOT NULL AND p.payment_id = btb.payment_id
      )
    WHERE cba.raw_record_uuid = '20484ee9-8d44-560d-82eb-59dedcb0b33e'
  `);
  console.log('\n=== paidRows simulation for this raw record ===');
  console.log(JSON.stringify(sim, (k,v) => typeof v === 'bigint' ? Number(v) : v, 2));
}

main().catch(console.error).finally(() => p.$disconnect());
