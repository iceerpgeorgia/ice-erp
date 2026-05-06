const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:fulebimojviT1985%25@db.fojbzghphznbslqwurrm.supabase.co:5432/postgres' });

const ORPHAN_IDS = [7162, 7163, 7164, 7165, 7166, 7167];

client.connect().then(async () => {
  // Safety check: confirm zero ledger entries
  const chk = await client.query(`
    SELECT p.id, p.payment_id, fc.code as fc_code,
           (SELECT COUNT(*) FROM payments_ledger pl WHERE pl.payment_id = p.payment_id) as ledger_cnt
    FROM payments p
    JOIN financial_codes fc ON fc.uuid = p.financial_code_uuid
    WHERE p.id = ANY($1)
  `, [ORPHAN_IDS]);
  console.log('Pre-delete check:');
  chk.rows.forEach(r => console.log(`  id=${r.id} | payment_id=${r.payment_id} | fc=${r.fc_code} | ledger_cnt=${r.ledger_cnt}`));

  const hasLedger = chk.rows.some(r => Number(r.ledger_cnt) > 0);
  if (hasLedger) { console.error('ABORT: some payments have ledger entries!'); process.exit(1); }

  const del = await client.query(
    `DELETE FROM payments WHERE id = ANY($1) RETURNING id, payment_id`,
    [ORPHAN_IDS]
  );
  console.log(`\nDeleted ${del.rows.length} orphaned bundle payments:`);
  del.rows.forEach(r => console.log(`  id=${r.id} | payment_id=${r.payment_id}`));

  await client.end();
}).catch(e => { console.error(e.message, e.stack); process.exit(1); });
