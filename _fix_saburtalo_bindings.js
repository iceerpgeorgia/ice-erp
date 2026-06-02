// Check bank transaction bindings for the two non-bundle duplicate payments
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const J = (v) => JSON.stringify(v, (k, v) => typeof v === 'bigint' ? Number(v) : v, 2);

// Non-bundle duplicates to investigate:
// 1.1.1.2  non-bundle: b94197_21_95579c  (id=1137)  vs bundle: b9588e_96_cce31f (id=5867)
// 1.1.1.3  non-bundle: 67149c_44_8d4f7d  (id=630)   vs bundle: 8d9db8_5d_e91914 (id=5868)

const NON_BUNDLE_IDS = ['b94197_21_95579c', '67149c_44_8d4f7d'];
const BUNDLE_IDS     = ['b9588e_96_cce31f', '8d9db8_5d_e91914'];
const ALL_IDS = [...NON_BUNDLE_IDS, ...BUNDLE_IDS];

const idLit = ALL_IDS.map(id => `'${id}'`).join(', ');

async function main() {
  // Check raw BOG GEL table
  const bog = await p.$queryRawUnsafe(`
    SELECT id, raw_record_uuid, payment_id, nominal_amount, account_currency_amount,
           transaction_date, counteragent_processed, parsing_lock
    FROM "GE78BG0000000893486000_BOG_GEL"
    WHERE payment_id IN (${idLit})
    ORDER BY payment_id
  `);
  console.log('\n=== BOG GEL raw rows bound to these payment_ids ===\n' + J(bog));

  // Check raw TBC GEL table
  const tbc = await p.$queryRawUnsafe(`
    SELECT id, raw_record_uuid, payment_id, nominal_amount, account_currency_amount,
           transaction_date, counteragent_processed, parsing_lock
    FROM "GE65TB7856036050100002_TBC_GEL"
    WHERE payment_id IN (${idLit})
    ORDER BY payment_id
  `);
  console.log('\n=== TBC GEL raw rows bound to these payment_ids ===\n' + J(tbc));

  // Check BOG USD, TBC USD etc.
  const tables = await p.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name LIKE 'GE%'
    ORDER BY table_name
  `);
  console.log('\n=== All GE* raw tables ===\n' + J(tables.map(t => t.table_name)));

  for (const { table_name } of tables) {
    const rows = await p.$queryRawUnsafe(`
      SELECT id, raw_record_uuid, payment_id, nominal_amount
      FROM "${table_name}"
      WHERE payment_id IN (${idLit})
    `);
    if (rows.length > 0) {
      console.log(`\n=== ${table_name}: ${rows.length} bound row(s) ===\n` + J(rows));
    }
  }

  // Check bank_transaction_batches
  const batches = await p.$queryRawUnsafe(`
    SELECT id, batch_uuid, raw_record_uuid, payment_id, payment_uuid, partition_amount, partition_sequence
    FROM bank_transaction_batches
    WHERE payment_id IN (${idLit})
    ORDER BY payment_id, partition_sequence
  `);
  console.log('\n=== bank_transaction_batches for these payment_ids ===\n' + J(batches));

  // Check consolidated_bank_accounts (Supabase)
  try {
    const consol = await p.$queryRawUnsafe(`
      SELECT id, payment_id, nominal_amount, transaction_date
      FROM consolidated_bank_accounts
      WHERE payment_id IN (${idLit})
    `);
    console.log('\n=== consolidated_bank_accounts ===\n' + J(consol));
  } catch (e) {
    console.log('\n=== consolidated_bank_accounts: ' + e.message + ' ===');
  }

  console.log('\n=== DONE ===');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
