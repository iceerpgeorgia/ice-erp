// Fix Step 3: INSERT is_project_derived payments for FC 1.1.3 (cast insider_uuid properly)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CA_UUID = '43eabc78-af64-4c14-9fef-c7e6a1b6f07e';
const FC113   = 'c491bff3-6f7b-4412-9df0-eaed6f3ee238'; // 1.1.3

async function main() {
  // Get all projects now at FC 1.1.3 for this counteragent
  const projects = await prisma.$queryRawUnsafe(
    `SELECT project_uuid, project_name, counteragent_uuid, currency_uuid, insider_uuid
     FROM projects
     WHERE counteragent_uuid = $1::uuid AND financial_code_uuid = $2::uuid
     ORDER BY id`,
    CA_UUID, FC113
  );
  console.log(`Found ${projects.length} projects at FC 1.1.3`);

  // Find which ones already have is_project_derived payment
  const existing = await prisma.$queryRawUnsafe(
    `SELECT project_uuid FROM payments
     WHERE project_uuid = ANY(ARRAY[${projects.map(p => `'${p.project_uuid}'`).join(',')}]::uuid[])
       AND is_project_derived = true AND financial_code_uuid = $1::uuid`,
    FC113
  );
  const existingSet = new Set(existing.map(e => e.project_uuid));
  const missing = projects.filter(p => !existingSet.has(p.project_uuid));
  console.log(`Already have is_project_derived payment: ${existing.length}`);
  console.log(`Need to create: ${missing.length}`);

  let inserted = 0;
  for (const proj of missing) {
    try {
      // Use CASE to handle nullable insider_uuid — cast only when not null
      await prisma.$queryRawUnsafe(
        `INSERT INTO payments
           (project_uuid, counteragent_uuid, financial_code_uuid, job_uuid, income_tax,
            currency_uuid, payment_id, record_uuid, insider_uuid, is_project_derived, is_bundle_payment, updated_at)
         VALUES
           ($1::uuid, $2::uuid, $3::uuid, NULL, false,
            $4::uuid, '', '', $5::uuid, true, false, NOW())`,
        proj.project_uuid,
        proj.counteragent_uuid,
        FC113,
        proj.currency_uuid,
        proj.insider_uuid  // null is OK for ::uuid cast
      );
      inserted++;
      console.log(`  ✓ ${proj.project_name}`);
    } catch (err) {
      console.error(`  ✗ ${proj.project_name}: ${err.message}`);
    }
  }
  console.log(`\nInserted ${inserted}/${missing.length} new payments`);

  // Final verification
  const verify = await prisma.$queryRawUnsafe(
    `SELECT p.project_name, pay.payment_id
     FROM projects p
     JOIN payments pay ON pay.project_uuid = p.project_uuid
       AND pay.is_project_derived = true
       AND pay.financial_code_uuid = $1::uuid
     WHERE p.counteragent_uuid = $2::uuid AND p.financial_code_uuid = $1::uuid
     ORDER BY p.id`,
    FC113, CA_UUID
  );
  console.log(`\n--- Final: ${verify.length}/26 projects have is_project_derived payment for 1.1.3 ---`);
  for (const v of verify) console.log(`  ${v.project_name} → ${v.payment_id}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
