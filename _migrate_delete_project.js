const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:fulebimojviT1985%25@db.fojbzghphznbslqwurrm.supabase.co:5432/postgres' });

const OLD_PROJECT = 'edcb4fbb-6a57-4308-93aa-8a98f148a069'; // Doors Repair
const NEW_PROJECT = '6489cc6b-71ea-46f0-8165-5a6db0bdca47'; // Holiday Inn Oth

client.connect().then(async () => {
  // Verify target project exists
  const tgt = await client.query(`SELECT project_name, project_index FROM projects WHERE project_uuid = $1`, [NEW_PROJECT]);
  console.log(`Target project: ${tgt.rows[0]?.project_name} (${tgt.rows[0]?.project_index})`);

  // Step 1: Move all payments to new project
  const pmtUpd = await client.query(
    `UPDATE payments SET project_uuid = $1::uuid, updated_at = NOW() WHERE project_uuid = $2::uuid RETURNING id, payment_id`,
    [NEW_PROJECT, OLD_PROJECT]
  );
  console.log(`\nMoved ${pmtUpd.rows.length} payments to new project:`);
  pmtUpd.rows.forEach(r => console.log(`  id=${r.id} | payment_id=${r.payment_id}`));

  // Step 2: Update consolidated_bank_accounts
  const cbaUpd = await client.query(
    `UPDATE consolidated_bank_accounts SET project_uuid = $1::uuid WHERE project_uuid = $2::uuid RETURNING id`,
    [NEW_PROJECT, OLD_PROJECT]
  );
  console.log(`\nUpdated ${cbaUpd.rows.length} consolidated_bank_accounts rows`);

  // Step 3: Delete project_employees (project-specific, don't migrate)
  const peUpd = await client.query(
    `DELETE FROM project_employees WHERE project_uuid = $1::uuid RETURNING id`,
    [OLD_PROJECT]
  );
  console.log(`Deleted ${peUpd.rows.length} project_employees rows`);

  // Step 4: Verify old project now has no payments / blocking data
  const remaining = await client.query(`SELECT COUNT(*) FROM payments WHERE project_uuid = $1::uuid`, [OLD_PROJECT]);
  console.log(`\nPayments remaining on old project: ${remaining.rows[0].count}`);

  // Step 5: Delete the old project
  const delProj = await client.query(
    `DELETE FROM projects WHERE project_uuid = $1::uuid RETURNING id, project_name`,
    [OLD_PROJECT]
  );
  console.log(`\nDeleted project: id=${delProj.rows[0]?.id} | name=${delProj.rows[0]?.project_name}`);

  console.log('\nDone.');
  await client.end();
}).catch(e => { console.error(e.message, e.stack); process.exit(1); });
