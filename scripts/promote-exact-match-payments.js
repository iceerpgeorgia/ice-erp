/**
 * promote-exact-match-payments.js
 *
 * Step 1 (always): Audit which payments exactly match their project parameters
 *                  but are NOT yet marked is_project_derived = true.
 *
 * Step 2 (--check): Report duplicates — projects that ALREADY have a
 *                   is_project_derived=true payment alongside a manual exact-match.
 *
 * Step 3 (--apply): For projects with NO existing derived payment, promote the
 *                   exact-match manual payment to is_project_derived = true.
 *
 * Usage:
 *   node scripts/promote-exact-match-payments.js            # dry-run / audit only
 *   node scripts/promote-exact-match-payments.js --check    # show duplicate detail
 *   node scripts/promote-exact-match-payments.js --apply    # apply promotion
 */

BigInt.prototype.toJSON = function () { return Number(this); };
const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const p = new PrismaClient();
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const CHECK = args.includes('--check') || APPLY; // always show duplicate details when applying

async function main() {
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Find all auto-project exact-match payments (active, any is_project_derived)
  // ─────────────────────────────────────────────────────────────────────────────
  const allExact = await p.$queryRawUnsafe(`
    SELECT
      pr.project_uuid,
      pr.project_index,
      pr.project_name,
      ca.name             AS counteragent_name,
      ca.identification_number AS counteragent_inn,
      fc.code             AS fc_code,
      cur.code            AS currency_code,
      pay.id              AS payment_id_pk,
      pay.payment_id,
      pay.is_active,
      pay.is_project_derived,
      pay.created_at
    FROM projects pr
    JOIN financial_codes fc  ON fc.uuid  = pr.financial_code_uuid AND fc.automated_payment_id = true
    LEFT JOIN counteragents ca  ON ca.counteragent_uuid = pr.counteragent_uuid
    LEFT JOIN currencies    cur ON cur.uuid = pr.currency_uuid
    JOIN payments pay ON
      pay.project_uuid        = pr.project_uuid
      AND pay.counteragent_uuid   = pr.counteragent_uuid
      AND pay.financial_code_uuid = pr.financial_code_uuid
      AND pay.job_uuid IS NULL
      AND pay.income_tax = false
      AND pay.currency_uuid       = pr.currency_uuid
      AND pay.is_active = true
    ORDER BY pr.project_index, pay.is_project_derived DESC, pay.created_at
  `);

  console.log(`\n══════════════════════════════════════════════════════`);
  console.log(`  Exact-match payments for auto-payment-FC projects`);
  console.log(`══════════════════════════════════════════════════════`);
  console.log(`Total exact-match active payments found: ${allExact.length}`);

  const alreadyDerived  = allExact.filter(r => r.is_project_derived);
  const manualExact     = allExact.filter(r => !r.is_project_derived);
  console.log(`  Already is_project_derived=true : ${alreadyDerived.length}`);
  console.log(`  Manual (is_project_derived=false): ${manualExact.length}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Detect duplicates: projects that have BOTH a derived AND a manual exact match
  // ─────────────────────────────────────────────────────────────────────────────
  const derivedProjectUuids = new Set(alreadyDerived.map(r => r.project_uuid));
  const duplicates   = manualExact.filter(r => derivedProjectUuids.has(r.project_uuid));
  const safeToPromote = manualExact.filter(r => !derivedProjectUuids.has(r.project_uuid));

  console.log(`\n──────────────────────────────────────────────────────`);
  console.log(`  Duplicate check`);
  console.log(`──────────────────────────────────────────────────────`);
  console.log(`  Projects with BOTH derived + manual exact match (DUPLICATES): ${duplicates.length}`);
  console.log(`  Manual exact-match payments SAFE to promote:                  ${safeToPromote.length}`);

  if (CHECK && duplicates.length > 0) {
    console.log(`\n  ⚠ Duplicate details (manual payment coexists with derived payment):`);
    for (const dup of duplicates) {
      const derived = alreadyDerived.find(r => r.project_uuid === dup.project_uuid);
      console.log(`    Project: [${dup.project_index}] ${dup.project_name}`);
      console.log(`      Counteragent : ${dup.counteragent_name} (INN ${dup.counteragent_inn})`);
      console.log(`      FC / Currency: ${dup.fc_code} / ${dup.currency_code}`);
      console.log(`      Derived  payment_id: ${derived?.payment_id}`);
      console.log(`      Manual   payment_id: ${dup.payment_id}  (created ${new Date(dup.created_at).toLocaleDateString('en-GB')})`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Write audit XLSX
  // ─────────────────────────────────────────────────────────────────────────────
  const excelRows = allExact.map(r => {
    const isDuplicate = r.is_project_derived
      ? manualExact.some(m => m.project_uuid === r.project_uuid)   // derived side of dupe
      : derivedProjectUuids.has(r.project_uuid);                   // manual side of dupe
    return {
      'Project Index'      : r.project_index,
      'Project Name'       : r.project_name,
      'Counteragent'       : r.counteragent_name,
      'INN'                : r.counteragent_inn,
      'FC'                 : r.fc_code,
      'Currency'           : r.currency_code,
      'Payment ID'         : r.payment_id,
      'Is Active'          : r.is_active ? 'Yes' : 'No',
      'Is Project Derived' : r.is_project_derived ? 'Yes' : 'No',
      'Duplicate Conflict' : isDuplicate ? 'DUPLICATE' : '',
      'Action'             : r.is_project_derived
                               ? 'already derived'
                               : (isDuplicate ? 'SKIP (duplicate)' : 'PROMOTE'),
      'Created At'         : new Date(r.created_at).toLocaleDateString('en-GB'),
    };
  });

  const outDir = 'exports';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const outPath = path.join(outDir, 'promote_exact_match_audit.xlsx');

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelRows);
  ws['!cols'] = [
    { wch: 14 }, { wch: 35 }, { wch: 30 }, { wch: 14 },
    { wch: 10 }, { wch: 10 }, { wch: 22 }, { wch: 10 },
    { wch: 20 }, { wch: 18 }, { wch: 22 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Audit');
  XLSX.writeFile(wb, outPath);
  console.log(`\nAudit XLSX written: ${outPath}  (${excelRows.length} rows)`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Apply promotion (only if --apply and no duplicates block)
  // ─────────────────────────────────────────────────────────────────────────────
  if (APPLY) {
    if (duplicates.length > 0) {
      console.log(`\n⛔  Cannot auto-promote: ${duplicates.length} duplicate conflict(s) must be resolved manually first.`);
      console.log(`    Review the XLSX and decide which payment_id to keep as the derived one.`);
    }

    if (safeToPromote.length === 0) {
      console.log(`\nNo safe-to-promote payments found. Nothing updated.`);
    } else {
      console.log(`\nPromoting ${safeToPromote.length} exact-match payments → is_project_derived=true ...`);
      const ids = safeToPromote.map(r => r.payment_id_pk);

      // Update in one batch using ANY(array)
      const updated = await p.$queryRawUnsafe(
        `UPDATE payments
         SET is_project_derived = true, updated_at = NOW()
         WHERE id = ANY($1::bigint[])
         RETURNING payment_id`,
        ids
      );

      console.log(`✅  Promoted ${updated.length} payments.`);
      updated.forEach(u => console.log(`    ${u.payment_id}`));
    }
  } else {
    if (safeToPromote.length > 0) {
      console.log(`\nDry-run: ${safeToPromote.length} payments would be promoted with --apply`);
      safeToPromote.forEach(r =>
        console.log(`    [${r.project_index}] ${r.payment_id}  (${r.project_name})`)
      );
    }
  }

  await p.$disconnect();
}

main().catch(e => { console.error(e); p.$disconnect(); process.exit(1); });
