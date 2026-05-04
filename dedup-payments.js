/**
 * dedup-payments.js
 *
 * Finds duplicate payments (same logical key) and deduplicates them.
 * The logical key is: (project_uuid, counteragent_uuid, financial_code_uuid,
 *                       job_uuid, income_tax, currency_uuid)
 * with NULLs treated as equal (NULLS NOT DISTINCT).
 *
 * Strategy for each duplicate group:
 *   - Keep the row that has the MOST payments_ledger + payment_adjustments entries.
 *   - If tied, keep the LOWEST id (oldest).
 *   - Re-link all ledger + adjustment rows to the survivor payment_id.
 *   - Delete the losers.
 *
 * Usage:
 *   node dedup-payments.js           # dry-run (report only)
 *   node dedup-payments.js --fix     # actually deduplicate
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRY_RUN = !process.argv.includes('--fix');

async function main() {
  console.log(`=== Duplicate Payment Finder ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN (pass --fix to apply changes)' : 'FIX MODE'}\n`);

  // -----------------------------------------------------------------------
  // Step 1: Find all duplicate groups
  // We use COALESCE to normalise NULLs so they group together.
  // -----------------------------------------------------------------------
  const duplicateGroups = await prisma.$queryRawUnsafe(`
    SELECT
      COALESCE(project_uuid::text,        '00000000-0000-0000-0000-000000000000') AS grp_project,
      COALESCE(counteragent_uuid::text,   '00000000-0000-0000-0000-000000000000') AS grp_counteragent,
      COALESCE(financial_code_uuid::text, '00000000-0000-0000-0000-000000000000') AS grp_fc,
      COALESCE(job_uuid::text,            '00000000-0000-0000-0000-000000000000') AS grp_job,
      income_tax::text                                                             AS grp_tax,
      COALESCE(currency_uuid::text,       '00000000-0000-0000-0000-000000000000') AS grp_currency,
      COUNT(*) AS cnt,
      array_agg(id ORDER BY id) AS ids,
      array_agg(payment_id ORDER BY id) AS payment_ids
    FROM payments
    GROUP BY grp_project, grp_counteragent, grp_fc, grp_job, grp_tax, grp_currency
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC, grp_project
  `);

  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicate payments found. Nothing to do.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${duplicateGroups.length} duplicate group(s):\n`);

  let totalDeleted = 0;
  let totalLedgerMoved = 0;
  let totalAdjMoved = 0;

  for (const group of duplicateGroups) {
    const ids = group.ids;          // BigInt[] sorted ascending
    const paymentIds = group.payment_ids; // string[]

    console.log(`--- Group: project=${group.grp_project} | ca=${group.grp_counteragent} | fc=${group.grp_fc} | job=${group.grp_job} | tax=${group.grp_tax} | cur=${group.grp_currency}`);
    console.log(`    ${ids.length} duplicate rows, IDs: [${ids.map(String).join(', ')}]`);
    console.log(`    payment_ids: [${paymentIds.join(', ')}]`);

    // ------------------------------------------------------------------
    // Step 2: Get ledger + adjustment counts for each row in the group
    // ------------------------------------------------------------------
    const stats = await prisma.$queryRawUnsafe(`
      SELECT
        p.id,
        p.payment_id,
        p.is_bundle_payment,
        p.is_project_derived,
        p.created_at,
        COUNT(DISTINCT pl.id)  AS ledger_count,
        COUNT(DISTINCT pa.id)  AS adj_count
      FROM payments p
      LEFT JOIN payments_ledger pl ON pl.payment_id = p.payment_id
      LEFT JOIN payment_adjustments pa ON pa.payment_id = p.payment_id
      WHERE p.id = ANY($1::bigint[])
      GROUP BY p.id, p.payment_id, p.is_bundle_payment, p.is_project_derived, p.created_at
      ORDER BY (COUNT(DISTINCT pl.id) + COUNT(DISTINCT pa.id)) DESC, p.id ASC
    `, ids.map(BigInt));

    for (const s of stats) {
      console.log(`    id=${s.id} | payment_id=${s.payment_id} | ledger=${s.ledger_count} | adj=${s.adj_count} | bundle=${s.is_bundle_payment} | derived=${s.is_project_derived} | created=${s.created_at?.toISOString().slice(0,10)}`);
    }

    // Survivor = first after ordering (most ledger+adj DESC, id ASC)
    const survivor = stats[0];
    const losers = stats.slice(1);

    console.log(`    → KEEP  id=${survivor.id} (${survivor.payment_id})`);
    console.log(`    → DELETE ids=[${losers.map(s => s.id).join(', ')}]`);

    if (!DRY_RUN) {
      // ----------------------------------------------------------------
      // Step 3: Move ledger entries from losers to survivor payment_id
      // ----------------------------------------------------------------
      for (const loser of losers) {
        if (Number(loser.ledger_count) > 0) {
          const moved = await prisma.$queryRawUnsafe(
            `UPDATE payments_ledger SET payment_id = $1 WHERE payment_id = $2 RETURNING id`,
            survivor.payment_id,
            loser.payment_id
          );
          console.log(`      ✓ Moved ${moved.length} ledger row(s) from ${loser.payment_id} → ${survivor.payment_id}`);
          totalLedgerMoved += moved.length;
        }

        // ----------------------------------------------------------------
        // Step 4: Move payment_adjustments from losers to survivor
        // ----------------------------------------------------------------
        if (Number(loser.adj_count) > 0) {
          const movedAdj = await prisma.$queryRawUnsafe(
            `UPDATE payment_adjustments SET payment_id = $1 WHERE payment_id = $2 RETURNING id`,
            survivor.payment_id,
            loser.payment_id
          );
          console.log(`      ✓ Moved ${movedAdj.length} adjustment row(s) from ${loser.payment_id} → ${survivor.payment_id}`);
          totalAdjMoved += movedAdj.length;
        }

        // ----------------------------------------------------------------
        // Step 5: Repoint any bank consolidated_bank_accounts rows that
        //         reference the loser payment_id
        // ----------------------------------------------------------------
        await prisma.$queryRawUnsafe(
          `UPDATE consolidated_bank_accounts SET payment_id = $1 WHERE payment_id = $2`,
          survivor.payment_id,
          loser.payment_id
        ).catch(() => {}); // table may not exist in all envs

        // ----------------------------------------------------------------
        // Step 5b: Repoint raw bank table rows (BOG + TBC) to survivor.
        //          The trigger blocks deletion if ANY row has this payment_id.
        // ----------------------------------------------------------------
        for (const rawTable of [
          '"GE78BG0000000893486000_BOG_GEL"',
          '"GE65TB7856036050100002_TBC_GEL"',
        ]) {
          await prisma.$queryRawUnsafe(
            `UPDATE ${rawTable} SET payment_id = $1 WHERE payment_id = $2`,
            survivor.payment_id,
            loser.payment_id
          ).catch(() => {}); // table may not exist / no rows
        }

        // Repoint bank_transaction_batches.payment_id to survivor
        await prisma.$queryRawUnsafe(
          `UPDATE bank_transaction_batches SET payment_id = $1, payment_uuid = $2 WHERE payment_id = $3`,
          survivor.payment_id,
          survivor.payment_id,
          loser.payment_id
        ).catch(() => {});

        // ----------------------------------------------------------------
        // Step 6: Delete the loser payment row
        // ----------------------------------------------------------------
        await prisma.$queryRawUnsafe(
          `DELETE FROM payments WHERE id = $1`,
          loser.id
        );
        console.log(`      ✓ Deleted payment id=${loser.id} (${loser.payment_id})`);
        totalDeleted++;
      }
    }

    console.log('');
  }

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  console.log('=== Summary ===');
  console.log(`Duplicate groups found : ${duplicateGroups.length}`);
  if (DRY_RUN) {
    console.log(`No changes made (dry-run). Run with --fix to apply.`);
  } else {
    console.log(`Payments deleted       : ${totalDeleted}`);
    console.log(`Ledger rows re-linked  : ${totalLedgerMoved}`);
    console.log(`Adjustment rows re-linked: ${totalAdjMoved}`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
