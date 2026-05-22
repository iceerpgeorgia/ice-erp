// Migrate: change all მეპერსი (INN 402121887) projects from FC 1.1.1 to 1.1.3
// Steps:
//  1. DELETE 156 bundle/auto payments (no ledger/adjustments/batch links — safe)
//  2. UPDATE 26 projects: financial_code_uuid → 1.1.3
//  3. INSERT 26 new is_project_derived payments for FC 1.1.3
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CA_UUID  = '43eabc78-af64-4c14-9fef-c7e6a1b6f07e'; // მეპერსი INN 402121887
const FC111    = 'b59170ec-16cc-499a-9ff7-0428dcb8f727'; // 1.1.1
const FC113    = 'c491bff3-6f7b-4412-9df0-eaed6f3ee238'; // 1.1.3

async function main() {
  // 0. Load affected projects
  const projects = await prisma.$queryRawUnsafe(
    `SELECT project_uuid, project_name, counteragent_uuid, currency_uuid, insider_uuid
     FROM projects
     WHERE counteragent_uuid = $1::uuid AND financial_code_uuid = $2::uuid
     ORDER BY id`,
    CA_UUID, FC111
  );
  console.log(`Found ${projects.length} projects with FC 1.1.1`);

  const projUuids = projects.map(p => `'${p.project_uuid}'`).join(',');

  // 1. DELETE bundle/auto/recurring payments for these projects
  console.log('\n--- Step 1: DELETE bundle/auto payments ---');
  const deleted = await prisma.$queryRawUnsafe(
    `DELETE FROM payments
     WHERE project_uuid = ANY(ARRAY[${projUuids}]::uuid[])
       AND (is_project_derived = true OR is_bundle_payment = true OR is_recurring = true)
     RETURNING id, payment_id`
  );
  console.log(`Deleted ${deleted.length} payments`);

  // 2. UPDATE projects financial_code
  console.log('\n--- Step 2: UPDATE projects financial_code 1.1.1 → 1.1.3 ---');
  const updated = await prisma.$queryRawUnsafe(
    `UPDATE projects
     SET financial_code_uuid = $1::uuid,
         financial_code       = '1.1.3',
         updated_at           = NOW()
     WHERE counteragent_uuid = $2::uuid AND financial_code_uuid = $3::uuid
     RETURNING id, project_uuid, project_name`,
    FC113, CA_UUID, FC111
  );
  console.log(`Updated ${updated.length} projects`);

  // 3. INSERT new is_project_derived payment for each project
  console.log('\n--- Step 3: INSERT is_project_derived payments for FC 1.1.3 ---');
  let inserted = 0;
  for (const proj of projects) {
    try {
      await prisma.$queryRawUnsafe(
        `INSERT INTO payments
           (project_uuid, counteragent_uuid, financial_code_uuid, job_uuid, income_tax,
            currency_uuid, payment_id, record_uuid, insider_uuid, is_project_derived, is_bundle_payment, updated_at)
         VALUES
           ($1::uuid, $2::uuid, $3::uuid, NULL, false,
            $4::uuid, '', '', $5, true, false, NOW())`,
        proj.project_uuid,
        proj.counteragent_uuid,
        FC113,
        proj.currency_uuid,
        proj.insider_uuid || null
      );
      inserted++;
      console.log(`  ✓ ${proj.project_name}`);
    } catch (err) {
      console.error(`  ✗ ${proj.project_name}: ${err.message}`);
    }
  }
  console.log(`\nInserted ${inserted}/${projects.length} new payments`);

  // 4. Verify
  const verify = await prisma.$queryRawUnsafe(
    `SELECT p.project_name, pay.payment_id, pay.is_project_derived
     FROM projects p
     JOIN payments pay ON pay.project_uuid = p.project_uuid AND pay.is_project_derived = true
     WHERE p.counteragent_uuid = $1::uuid AND p.financial_code_uuid = $2::uuid
     ORDER BY p.id`,
    CA_UUID, FC113
  );
  console.log(`\n--- Verification: ${verify.length} is_project_derived payments for FC 1.1.3 ---`);
  for (const v of verify) console.log(`  ${v.project_name} → ${v.payment_id}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
