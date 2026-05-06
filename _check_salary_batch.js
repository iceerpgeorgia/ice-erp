const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Check Feb 2024 accrual for this counteragent
  const feb = await p.$queryRawUnsafe(`
    SELECT id, payment_id, salary_month, net_sum
    FROM salary_accruals
    WHERE counteragent_uuid = 'c247edba-fd51-4a47-8765-f7ea1a0a9459'
      AND salary_month BETWEEN '2024-01-01' AND '2024-12-31'
    ORDER BY salary_month
  `);
  console.log('=== 2024 accruals for counteragent ===');
  console.log(JSON.stringify(feb, (k,v) => typeof v === 'bigint' ? Number(v) : v, 2));

  // What the raw record had as payment_id originally
  const raw = await p.$queryRawUnsafe(`
    SELECT id, uuid, payment_id, counteragent_uuid, counteragent_processed
    FROM "GE78BG0000000893486000_BOG_GEL"
    WHERE raw_record_uuid = '20484ee9-8d44-560d-82eb-59dedcb0b33e'
    LIMIT 1
  `);
  console.log('\n=== Raw record ===');
  console.log(JSON.stringify(raw, (k,v) => typeof v === 'bigint' ? Number(v) : v, 2));
}

main().catch(console.error).finally(() => p.$disconnect());

async function main() {
  // Get salary_accruals columns
  const cols = await p.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'salary_accruals' ORDER BY ordinal_position`
  );
  console.log('=== salary_accruals columns ===');
  console.log(cols.map(c => c.column_name).join(', '));

  // Check salary_accruals for NP_27daf5_NJ_5c8b11_PRL032024
  const salRows = await p.$queryRawUnsafe(`
    SELECT * FROM salary_accruals WHERE payment_id = $1 LIMIT 10
  `, 'NP_27daf5_NJ_5c8b11_PRL032024');
  console.log('\n=== salary_accruals matching NP_27daf5_NJ_5c8b11_PRL032024 ===');
  console.log(JSON.stringify(salRows, (k,v) => typeof v === 'bigint' ? Number(v) : v, 2));

  // Check what salary_accruals exist for this counteragent
  const caRows = await p.$queryRawUnsafe(`
    SELECT * FROM salary_accruals
    WHERE counteragent_uuid = 'c247edba-fd51-4a47-8765-f7ea1a0a9459'
    ORDER BY id LIMIT 20
  `);
  console.log('\n=== salary_accruals for counteragent ===');
  console.log(JSON.stringify(caRows, (k,v) => typeof v === 'bigint' ? Number(v) : v, 2));

  // Check payments table
  const pRows = await p.$queryRawUnsafe(`
    SELECT record_uuid, payment_id, counteragent_uuid, is_active
    FROM payments WHERE payment_id = $1 LIMIT 5
  `, 'NP_27daf5_NJ_5c8b11_PRL032024');
  console.log('\n=== payments table match ===');
  console.log(JSON.stringify(pRows, (k,v) => typeof v === 'bigint' ? Number(v) : v, 2));
}

main().catch(console.error).finally(() => p.$disconnect());
