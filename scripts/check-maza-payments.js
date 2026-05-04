const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const projects = await p.$queryRawUnsafe(`
    SELECT pr.id, pr.project_uuid::text AS project_uuid, pr.project_name, pr.value,
           pr.counteragent_uuid::text AS counteragent_uuid, pr.currency_uuid::text AS currency_uuid,
           pr.financial_code_uuid::text AS fc_uuid,
           fc.code AS fc_code, fc.name AS fc_name, fc.is_bundle,
           c.name AS cur
    FROM projects pr
    LEFT JOIN financial_codes fc ON fc.uuid = pr.financial_code_uuid
    LEFT JOIN currencies c ON c.uuid = pr.currency_uuid
    WHERE pr.project_name ILIKE '%მაზა%' OR pr.project_name ILIKE '%maza%'
  `);

  console.log('=== Projects ===');
  console.log(JSON.stringify(projects, (k, v) => typeof v === 'bigint' ? Number(v) : v, 2));

  for (const proj of projects) {
    console.log(`\n=== Payments for project ${proj.project_name} (${proj.project_uuid}) ===`);
    const payments = await p.$queryRawUnsafe(`
      SELECT pmt.id, pmt.payment_id, pmt.is_bundle_payment, pmt.is_project_derived,
             pmt.financial_code_uuid::text AS fc_uuid,
             fc.code AS fc_code, fc.name AS fc_name,
             pmt.counteragent_uuid::text AS counteragent_uuid,
             pmt.currency_uuid::text AS currency_uuid,
             pmt.created_at, pmt.updated_at
      FROM payments pmt
      LEFT JOIN financial_codes fc ON fc.uuid = pmt.financial_code_uuid
      WHERE pmt.project_uuid = $1::uuid
      ORDER BY fc.code, pmt.created_at
    `, proj.project_uuid);

    console.log(JSON.stringify(payments, (k, v) => typeof v === 'bigint' ? Number(v) : v, 2));

    // Group by FC to detect duplicates
    const byFc = {};
    for (const pm of payments) {
      const key = pm.fc_uuid;
      byFc[key] = (byFc[key] || 0) + 1;
    }
    const dups = Object.entries(byFc).filter(([_, n]) => n > 1);
    if (dups.length > 0) {
      console.log('\n*** DUPLICATES BY FC ***');
      console.log(dups);
    } else {
      console.log('\n(no FC-level duplicates)');
    }

    // Children FCs of the project's bundle FC
    if (proj.is_bundle) {
      console.log(`\n--- Child FCs of bundle ${proj.fc_code} ---`);
      const children = await p.$queryRawUnsafe(`
        SELECT uuid::text, code, name FROM financial_codes WHERE parent_uuid = $1::uuid AND is_active = true ORDER BY sort_order, code
      `, proj.fc_uuid);
      console.log(JSON.stringify(children, null, 2));
    }
  }

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
