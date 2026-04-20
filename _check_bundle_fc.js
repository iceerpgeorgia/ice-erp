const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  // Bundle FC children
  const children = await p.$queryRawUnsafe(
    `SELECT uuid, code, name, parent_uuid, depth, is_bundle, is_active 
     FROM financial_codes WHERE parent_uuid = $1::uuid ORDER BY sort_order, code`,
    'b59170ec-16cc-499a-9ff7-0428dcb8f727'
  );
  console.log('Children of bundle FC 1.1.1:');
  console.log(JSON.stringify(children, null, 2));

  // Check if any of those have their own children (grandchildren)
  for (const child of children) {
    const grandchildren = await p.$queryRawUnsafe(
      `SELECT uuid, code, name FROM financial_codes WHERE parent_uuid = $1::uuid ORDER BY sort_order, code`,
      child.uuid
    );
    if (grandchildren.length > 0) {
      console.log(`\nGrandchildren of ${child.code} (${child.name}):`);
      console.log(JSON.stringify(grandchildren, null, 2));
    }
  }

  // Check existing payments for a sample project using this bundle FC
  const projects = await p.$queryRawUnsafe(
    `SELECT project_uuid, project_name, counteragent_uuid, financial_code_uuid 
     FROM projects WHERE financial_code_uuid = $1::uuid LIMIT 3`,
    'b59170ec-16cc-499a-9ff7-0428dcb8f727'
  );
  console.log('\nSample projects with bundle FC:');
  console.log(JSON.stringify(projects, null, 2));

  if (projects.length > 0) {
    const payments = await p.$queryRawUnsafe(
      `SELECT payment_id, financial_code_uuid, is_bundle_payment, is_project_derived
       FROM payments WHERE project_uuid = $1::uuid ORDER BY payment_id`,
      projects[0].project_uuid
    );
    console.log(`\nPayments for project ${projects[0].project_name}:`);
    console.log(JSON.stringify(payments, null, 2));
  }

  await p.$disconnect();
}
run().catch(e => { console.error(e); process.exit(1); });
