/**
 * Fix rs_unit_dimension_map entries to match the corrected official unit IDs.
 * Table columns: rs_unit_id (unique), rs_unit_label, dimension_uuid (optional)
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const fixes = [
  { rs_unit_id: '1',  rs_unit_label: 'ც' },
  { rs_unit_id: '2',  rs_unit_label: 'კგ' },
  { rs_unit_id: '3',  rs_unit_label: 'გ' },
  { rs_unit_id: '4',  rs_unit_label: 'ლ' },
  { rs_unit_id: '5',  rs_unit_label: 'ტ' },
  { rs_unit_id: '7',  rs_unit_label: 'სმ' },
  { rs_unit_id: '8',  rs_unit_label: 'მ' },
  { rs_unit_id: '9',  rs_unit_label: 'კმ' },
  { rs_unit_id: '10', rs_unit_label: 'კვ.სმ' },
  { rs_unit_id: '11', rs_unit_label: 'კვ.მ' },
  { rs_unit_id: '12', rs_unit_label: 'მ³' },
  { rs_unit_id: '13', rs_unit_label: 'მლ' },
  { rs_unit_id: '14', rs_unit_label: 'შეკვ' },
  { rs_unit_id: '99', rs_unit_label: 'სხვ' },
];

// Phantom IDs that don't exist in the official RS.ge unit list
const phantomIds = ['6', '15', '16', '17', '18', '19'];

async function main() {
  for (const f of fixes) {
    try {
      const result = await p.rs_unit_dimension_map.upsert({
        where:  { rs_unit_id: f.rs_unit_id },
        update: { rs_unit_label: f.rs_unit_label },
        create: { rs_unit_id: f.rs_unit_id, rs_unit_label: f.rs_unit_label },
      });
      console.log(`rs_unit_id=${f.rs_unit_id}: set rs_unit_label='${f.rs_unit_label}'`);
    } catch (e) {
      console.error(`rs_unit_id=${f.rs_unit_id}: ERROR — ${e.message.slice(0, 100)}`);
    }
  }

  // Remove phantom IDs (6, 15-19) that don't exist in the official RS.ge API
  for (const phantomId of phantomIds) {
    try {
      const deleted = await p.rs_unit_dimension_map.deleteMany({ where: { rs_unit_id: phantomId } });
      if (deleted.count > 0) console.log(`Deleted phantom rs_unit_id=${phantomId}`);
    } catch (e) {
      // ignore if not found
    }
  }

  console.log('\nDone.');
}

main().finally(() => p.$disconnect());
