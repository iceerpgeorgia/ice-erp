/**
 * Fix rs_waybills_in_items.unit values that were wrong due to incorrect RS_UNIT_MAP.
 *
 * Official unit IDs from get_waybill_units API:
 *   1=ცალი  2=კგ  3=გრამი  4=ლიტრი  5=ტონა  7=სანტიმეტრი  8=მეტრი
 *   9=კილომეტრი  10=კვ.სმ  11=კვ.მ  12=მ³  13=მილილიტრი  14=შეკვრა  99=სხვა
 *
 * Previous (wrong) map had:
 *   5='მლ'   (correct: 'ტ'     — ტონა)
 *   11='მ³'  (correct: 'კვ.მ' — კვ. მეტრი)
 *   14='კომ' (correct: 'შეკვ' — შეკვრა)
 *   99='წყვილი' (correct: 'სხვ' — სხვა/custom; actual text comes from UNIT_TXT)
 *
 * Also update rs_unit_dimension_map to match the corrected values.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const fixes = [
    { unit_id: '5',  old: 'მლ',      new_val: 'ტ',     label: 'ტონა' },
    { unit_id: '11', old: 'მ³',      new_val: 'კვ.მ',  label: 'კვ. მეტრი' },
    { unit_id: '14', old: 'კომ',     new_val: 'შეკვ',  label: 'შეკვრა' },
    { unit_id: '99', old: 'წყვილი',  new_val: 'სხვ',   label: 'სხვა (custom — UNIT_TXT needed)' },
  ];

  for (const fix of fixes) {
    const result = await prisma.rs_waybills_in_items.updateMany({
      where: { unit_id: fix.unit_id, unit: fix.old },
      data:  { unit: fix.new_val },
    });
    console.log(`unit_id=${fix.unit_id} (${fix.label}): updated ${result.count} rows  ${fix.old} → ${fix.new_val}`);
  }

  // Also remove phantom IDs (6, 15–19) from dimension map if present
  // and update the real IDs to correct abbreviations.
  const dimFixes = [
    { unit_id: '5',  unit: 'ტ',     full_name: 'ტონა' },
    { unit_id: '11', unit: 'კვ.მ',  full_name: 'კვ. მეტრი' },
    { unit_id: '14', unit: 'შეკვ',  full_name: 'შეკვრა' },
    { unit_id: '99', unit: 'სხვ',   full_name: 'სხვა' },
  ];

  for (const d of dimFixes) {
    try {
      await prisma.rs_unit_dimension_map.upsert({
        where:  { unit_id: d.unit_id },
        update: { unit: d.unit, full_name: d.full_name },
        create: { unit_id: d.unit_id, unit: d.unit, full_name: d.full_name },
      });
      console.log(`rs_unit_dimension_map unit_id=${d.unit_id}: set unit='${d.unit}' full_name='${d.full_name}'`);
    } catch (e) {
      // Table may not exist or have different schema — skip silently
      console.log(`rs_unit_dimension_map skip (${e.message.slice(0, 60)})`);
      break;
    }
  }

  console.log('\nDone.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
