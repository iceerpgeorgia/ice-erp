const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:fulebimojviT1985%25@db.fojbzghphznbslqwurrm.supabase.co:5432/postgres'
});

const PROJECT_UUID = 'edcb4fbb-6a57-4308-93aa-8a98f148a069';

client.connect().then(async () => {
  // Get the project info
  const projRes = await client.query(`SELECT * FROM projects WHERE project_uuid = $1`, [PROJECT_UUID]);
  console.log('=== PROJECT ===');
  if (projRes.rows.length === 0) { console.log('NOT FOUND'); }
  else {
    const r = projRes.rows[0];
    Object.keys(r).forEach(k => { if (r[k] !== null && r[k] !== undefined) console.log(`  ${k}: ${r[k]}`); });
  }

  // Count payments
  const pCnt = await client.query(`SELECT COUNT(*) FROM payments WHERE project_uuid = $1`, [PROJECT_UUID]);
  console.log(`\npayments: ${pCnt.rows[0].count}`);

  // Count ledger entries via payments
  const plCnt = await client.query(`
    SELECT COUNT(*) FROM payments_ledger pl
    WHERE pl.payment_id IN (SELECT payment_id FROM payments WHERE project_uuid = $1)
  `, [PROJECT_UUID]);
  console.log(`payments_ledger: ${plCnt.rows[0].count}`);

  // Check jobs
  const jobCnt = await client.query(`
    SELECT COUNT(*) FROM jobs WHERE project_uuid = $1
  `, [PROJECT_UUID]);
  console.log(`jobs: ${jobCnt.rows[0].count}`);

  // Check if project is referenced in consolidated_bank_accounts
  const cbaCnt = await client.query(`SELECT COUNT(*) FROM consolidated_bank_accounts WHERE project_uuid = $1`, [PROJECT_UUID]);
  console.log(`consolidated_bank_accounts: ${cbaCnt.rows[0].count}`);

  // Check all tables referencing project_uuid
  const fkRes = await client.query(`
    SELECT
      tc.table_name,
      kcu.column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'projects'
      AND ccu.column_name = 'project_uuid'
    ORDER BY tc.table_name
  `);
  console.log('\n=== TABLES WITH FK TO projects.project_uuid ===');
  fkRes.rows.forEach(r => console.log(`  ${r.table_name}.${r.column_name}`));

  // For each referencing table, count rows
  console.log('\n=== ROW COUNTS IN REFERENCING TABLES ===');
  for (const row of fkRes.rows) {
    try {
      const cnt = await client.query(`SELECT COUNT(*) FROM "${row.table_name}" WHERE "${row.column_name}" = $1`, [PROJECT_UUID]);
      if (cnt.rows[0].count > 0) {
        console.log(`  ${row.table_name}: ${cnt.rows[0].count} rows`);
      }
    } catch(e) {
      console.log(`  ${row.table_name}: error - ${e.message}`);
    }
  }

  await client.end();
}).catch(e => { console.error(e.message, e.stack); process.exit(1); });
