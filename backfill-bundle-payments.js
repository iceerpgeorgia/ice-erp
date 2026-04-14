const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function run() {
  // 1. Find all bundle financial codes
  const bundleFCs = await p.$queryRawUnsafe(
    `SELECT uuid, code, name FROM financial_codes WHERE is_bundle = true AND is_active = true ORDER BY code`
  );
  console.log(`Found ${bundleFCs.length} bundle financial code(s):`, bundleFCs.map(fc => fc.code).join(", "));

  if (bundleFCs.length === 0) {
    console.log("No bundle FCs found. Exiting.");
    return;
  }

  let totalMarked = 0, totalCreated = 0;

  for (const bundleFC of bundleFCs) {
    console.log(`\n--- Processing bundle FC: ${bundleFC.code} (${bundleFC.name}) ---`);

    // 2. Get active child FCs
    const childFCs = await p.$queryRawUnsafe(
      `SELECT uuid, code, name FROM financial_codes WHERE parent_uuid = $1::uuid AND is_active = true ORDER BY sort_order, code`,
      bundleFC.uuid
    );
    console.log(`  Child FCs: ${childFCs.length}:`, childFCs.map(c => c.code).join(", "));

    if (childFCs.length === 0) {
      console.log("  No active children, skipping.");
      continue;
    }

    // 3. Find all projects that use this bundle FC
    const projects = await p.$queryRawUnsafe(
      `SELECT project_uuid, counteragent_uuid, currency_uuid, insider_uuid FROM projects WHERE financial_code_uuid = $1::uuid ORDER BY project_uuid`,
      bundleFC.uuid
    );
    console.log(`  Projects using this FC: ${projects.length}`);

    for (const proj of projects) {
      // 4a. Mark existing is_project_derived payments with child FC uuids as is_bundle_payment=true
      const childUuids = childFCs.map(c => c.uuid);
      const inList = childUuids.map((_, i) => `$${i + 2}::uuid`).join(", ");
      const marked = await p.$queryRawUnsafe(
        `UPDATE payments
         SET is_bundle_payment = true, updated_at = NOW()
         WHERE project_uuid = $1::uuid
           AND is_project_derived = true
           AND financial_code_uuid IN (${inList})
           AND is_bundle_payment = false
         RETURNING id, financial_code_uuid`,
        proj.project_uuid, ...childUuids
      );
      if (marked.length > 0) {
        console.log(`  Project ${proj.project_uuid}: marked ${marked.length} existing payment(s) as is_bundle_payment=true`);
        totalMarked += marked.length;
      }

      // 4b. For each child FC, create payment if it does not exist
      for (const childFC of childFCs) {
        const existing = await p.$queryRawUnsafe(
          `SELECT id FROM payments
           WHERE project_uuid = $1::uuid
             AND is_project_derived = true
             AND financial_code_uuid = $2::uuid
           LIMIT 1`,
          proj.project_uuid, childFC.uuid
        );
        if (existing.length === 0) {
          try {
            await p.$queryRawUnsafe(
              `INSERT INTO payments (
                project_uuid, counteragent_uuid, financial_code_uuid, job_uuid, income_tax,
                currency_uuid, payment_id, record_uuid, insider_uuid,
                is_project_derived, is_bundle_payment, updated_at
              ) VALUES ($1::uuid, $2::uuid, $3::uuid, NULL, false, $4::uuid, '', '', $5::uuid, true, true, NOW())`,
              proj.project_uuid,
              proj.counteragent_uuid,
              childFC.uuid,
              proj.currency_uuid,
              proj.insider_uuid
            );
            console.log(`  Project ${proj.project_uuid}: CREATED payment for child FC ${childFC.code}`);
            totalCreated++;
          } catch (e) {
            console.warn(`  Project ${proj.project_uuid}: could not create payment for child FC ${childFC.code}:`, e.message);
          }
        }
      }
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`  Existing payments marked is_bundle_payment=true: ${totalMarked}`);
  console.log(`  New bundle payments created: ${totalCreated}`);
}

run()
  .catch(e => { console.error("Fatal error:", e.message); })
  .finally(() => p.$disconnect());
