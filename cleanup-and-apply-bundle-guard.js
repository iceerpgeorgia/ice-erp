/**
 * Find and clean duplicate bundle payments, then apply unique index guard.
 * Run: node cleanup-and-apply-bundle-guard.js
 */
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DIRECT_DATABASE_URL;
if (!connectionString) {
  console.error('DIRECT_DATABASE_URL not found in .env.local');
  process.exit(1);
}

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected to Supabase.\n');

  try {
    // Find all duplicates
    console.log('[1/4] Finding duplicate bundle payments...');
    const { rows: dupes } = await client.query(`
      SELECT project_uuid, financial_code_uuid, COUNT(*) as cnt,
             array_agg(id ORDER BY id) as ids,
             array_agg(payment_id ORDER BY id) as payment_ids
      FROM payments
      WHERE is_bundle_payment = true
      GROUP BY project_uuid, financial_code_uuid
      HAVING COUNT(*) > 1
    `);

    if (dupes.length === 0) {
      console.log('  No duplicate bundle payments found.');
    } else {
      console.log(`  Found ${dupes.length} duplicate group(s):`);
      for (const d of dupes) {
        console.log(`    project=${d.project_uuid} fc=${d.financial_code_uuid} count=${d.cnt} ids=[${d.ids}] paymentIds=[${d.payment_ids}]`);
      }

      console.log('\n[2/4] Cleaning up duplicates (keeping payment with most ledger entries, else highest id)...');
      for (const d of dupes) {
        // Find which of the IDs has ledger entries (prefer that one)
        const { rows: ledgerCounts } = await client.query(`
          SELECT p.id, COUNT(pl.id) as ledger_count, p.payment_id
          FROM payments p
          LEFT JOIN payments_ledger pl ON pl.payment_id = p.payment_id
          WHERE p.id = ANY($1::bigint[])
          GROUP BY p.id, p.payment_id
          ORDER BY ledger_count DESC, p.id DESC
        `, [d.ids]);

        const keepId = ledgerCounts[0].id;
        const deleteIds = ledgerCounts.slice(1).map(r => r.id);

        console.log(`    Keeping id=${keepId} (paymentId=${ledgerCounts[0].payment_id}, ledger=${ledgerCounts[0].ledger_count}), deleting ids=[${deleteIds}]`);

        if (deleteIds.length > 0) {
          await client.query(`DELETE FROM payments WHERE id = ANY($1::bigint[])`, [deleteIds]);
          console.log(`    Deleted ${deleteIds.length} duplicate(s).`);
        }
      }
    }

    // Check project-derived duplicates too
    console.log('\n[3/4] Finding duplicate project-derived (non-bundle) payments...');
    const { rows: derivedDupes } = await client.query(`
      SELECT project_uuid, financial_code_uuid, COUNT(*) as cnt,
             array_agg(id ORDER BY id) as ids
      FROM payments
      WHERE is_project_derived = true AND is_bundle_payment = false
      GROUP BY project_uuid, financial_code_uuid
      HAVING COUNT(*) > 1
    `);

    if (derivedDupes.length === 0) {
      console.log('  No duplicate project-derived payments found.');
    } else {
      console.log(`  Found ${derivedDupes.length} duplicate group(s):`);
      for (const d of derivedDupes) {
        console.log(`    project=${d.project_uuid} fc=${d.financial_code_uuid} count=${d.cnt} ids=[${d.ids}]`);
        const keepId = d.ids[d.ids.length - 1]; // keep newest
        const deleteIds = d.ids.slice(0, -1);
        console.log(`    Keeping id=${keepId}, deleting ids=[${deleteIds}]`);
        await client.query(`DELETE FROM payments WHERE id = ANY($1::bigint[])`, [deleteIds]);
        console.log(`    Deleted ${deleteIds.length} duplicate(s).`);
      }
    }

    // Now create the indexes
    console.log('\n[4/4] Applying partial unique indexes...');

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS payments_bundle_child_unique
        ON payments (project_uuid, financial_code_uuid)
        WHERE is_bundle_payment = true
    `);
    console.log('  ✓ payments_bundle_child_unique');

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS payments_project_derived_unique
        ON payments (project_uuid, financial_code_uuid)
        WHERE is_project_derived = true AND is_bundle_payment = false
    `);
    console.log('  ✓ payments_project_derived_unique');

    console.log('\n✅ Database guards applied successfully. Duplicate bundle payments are now prevented at the DB level.');
  } catch (err) {
    console.error('Error:', err.message);
    throw err;
  } finally {
    await client.end();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
