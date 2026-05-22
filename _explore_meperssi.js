// Explore: find counteragent מעפרסי (INN 402121887) and related projects/payments
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Find the counteragent
  const ca = await prisma.$queryRawUnsafe(
    `SELECT counteragent_uuid, name, identification_number FROM counteragents WHERE identification_number = $1 LIMIT 1`,
    '402121887'
  );
  if (!ca.length) { console.log('Counteragent 402121887 NOT FOUND'); return; }
  console.log('Counteragent:', JSON.stringify(ca[0]));

  const caUuid = ca[0].counteragent_uuid;

  // 2. Find financial codes 1.1.1 and 1.1.3
  const fcs = await prisma.$queryRawUnsafe(
    `SELECT uuid, code, name, automated_payment_id, is_bundle FROM financial_codes WHERE code IN ('1.1.1', '1.1.3')`
  );
  console.log('\nFinancial codes:', JSON.stringify(fcs));
  const fc111 = fcs.find(f => f.code === '1.1.1');
  const fc113 = fcs.find(f => f.code === '1.1.3');
  if (!fc111) { console.log('FC 1.1.1 NOT FOUND'); return; }
  if (!fc113) { console.log('FC 1.1.3 NOT FOUND'); return; }

  // 3. Find all projects for this counteragent with FC 1.1.1
  const projects = await prisma.$queryRawUnsafe(
    `SELECT id, project_uuid, project_name, financial_code_uuid, currency_uuid, state FROM projects WHERE counteragent_uuid = $1::uuid AND financial_code_uuid = $2::uuid ORDER BY id`,
    caUuid, fc111.uuid
  );
  console.log(`\nProjects with FC 1.1.1 (${projects.length} total):`);
  for (const p of projects) console.log(' -', p.id, p.project_uuid, p.project_name, p.state);

  // 4. Find all payments for those projects (bundle + automatic)
  if (projects.length === 0) return;
  const projUuids = projects.map(p => `'${p.project_uuid}'`).join(',');
  const payments = await prisma.$queryRawUnsafe(
    `SELECT id, payment_id, project_uuid, financial_code_uuid, is_project_derived, is_bundle_payment, is_recurring, is_active
     FROM payments
     WHERE project_uuid = ANY(ARRAY[${projUuids}]::uuid[])
     AND (is_project_derived = true OR is_bundle_payment = true OR is_recurring = true)
     ORDER BY project_uuid, id`
  );
  console.log(`\nBundle/automatic payments (${payments.length} total):`);
  for (const p of payments) {
    console.log(` - id=${p.id} payment_id=${p.payment_id} project=${p.project_uuid} fc=${p.financial_code_uuid} derived=${p.is_project_derived} bundle=${p.is_bundle_payment} recurring=${p.is_recurring} active=${p.is_active}`);
  }

  // 5. Also check if there are ANY payments for these projects
  const allPayments = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) as cnt FROM payments WHERE project_uuid = ANY(ARRAY[${projUuids}]::uuid[])`
  );
  console.log(`\nTotal payments for these projects: ${allPayments[0].cnt}`);

  // 6. Check FC 1.1.3 properties (for auto payment creation)
  console.log('\nFC 1.1.3 details:', JSON.stringify(fc113));
}

main().catch(console.error).finally(() => prisma.$disconnect());
