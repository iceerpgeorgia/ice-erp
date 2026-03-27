BigInt.prototype.toJSON = function() { return Number(this); };
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // 1. Find all projects whose financial code has automated_payment_id = true
  const projects = await p.$queryRawUnsafe(`
    SELECT 
      pr.project_uuid,
      pr.project_index,
      pr.project_name,
      pr.counteragent_uuid,
      pr.financial_code_uuid,
      pr.currency_uuid,
      ca.name as counteragent_name,
      fc.code as financial_code,
      fc.description as fc_description,
      cur.code as currency_code
    FROM projects pr
    JOIN financial_codes fc ON fc.uuid = pr.financial_code_uuid
    LEFT JOIN counteragents ca ON ca.counteragent_uuid = pr.counteragent_uuid
    LEFT JOIN currencies cur ON cur.uuid = pr.currency_uuid
    WHERE fc.automated_payment_id = true
    ORDER BY pr.project_index
  `);

  console.log(`=== Projects with automated_payment_id FC: ${projects.length} ===\n`);

  // 2. For each project, check if a matching payment exists using the composite key logic
  const matches = [];
  const noMatches = [];
  const alreadyDerived = [];

  for (const proj of projects) {
    const payments = await p.$queryRawUnsafe(`
      SELECT 
        payment_id,
        is_project_derived,
        is_active,
        project_uuid,
        counteragent_uuid,
        financial_code_uuid,
        job_uuid,
        income_tax,
        currency_uuid
      FROM payments
      WHERE project_uuid = $1::uuid
        AND counteragent_uuid = $2::uuid
        AND financial_code_uuid = $3::uuid
        AND (job_uuid IS NULL)
        AND income_tax = false
        AND currency_uuid = $4::uuid
    `, proj.project_uuid, proj.counteragent_uuid, proj.financial_code_uuid, proj.currency_uuid);

    if (payments.length > 0) {
      const pay = payments[0];
      if (pay.is_project_derived) {
        alreadyDerived.push({
          projectIndex: proj.project_index,
          projectName: proj.project_name,
          counteragent: proj.counteragent_name,
          financialCode: proj.financial_code,
          currency: proj.currency_code,
          paymentId: pay.payment_id,
          isActive: pay.is_active,
        });
      } else {
        matches.push({
          projectIndex: proj.project_index,
          projectName: proj.project_name,
          counteragent: proj.counteragent_name,
          financialCode: proj.financial_code,
          currency: proj.currency_code,
          paymentId: pay.payment_id,
          isActive: pay.is_active,
          isProjectDerived: pay.is_project_derived,
        });
      }
    } else {
      noMatches.push({
        projectIndex: proj.project_index,
        projectName: proj.project_name,
        counteragent: proj.counteragent_name,
        financialCode: proj.financial_code,
        currency: proj.currency_code,
      });
    }
  }

  // Summary
  console.log(`SUMMARY:`);
  console.log(`  Total projects (active, auto-payment FC): ${projects.length}`);
  console.log(`  Already marked is_project_derived=true:   ${alreadyDerived.length}`);
  console.log(`  Manually created match (composite key):   ${matches.length}`);
  console.log(`  No matching payment exists:               ${noMatches.length}`);
  console.log();

  if (alreadyDerived.length > 0) {
    console.log(`\n--- Already project-derived (${alreadyDerived.length}) ---`);
    alreadyDerived.forEach(m => {
      console.log(`  ${m.projectIndex} | ${m.counteragent} | ${m.financialCode} | ${m.currency} | payment=${m.paymentId} | active=${m.isActive}`);
    });
  }

  if (matches.length > 0) {
    console.log(`\n--- Manually created payments matching composite key (${matches.length}) ---`);
    console.log(`  These would CONFLICT if auto-create ran (same composite key exists)`);
    matches.forEach(m => {
      console.log(`  ${m.projectIndex} | ${m.counteragent} | ${m.financialCode} | ${m.currency} | payment=${m.paymentId} | active=${m.isActive} | derived=${m.isProjectDerived}`);
    });
  }

  if (noMatches.length > 0) {
    console.log(`\n--- No matching payment (${noMatches.length}) ---`);
    console.log(`  These would get a NEW auto-created payment`);
    noMatches.slice(0, 20).forEach(m => {
      console.log(`  ${m.projectIndex} | ${m.counteragent} | ${m.financialCode} | ${m.currency}`);
    });
    if (noMatches.length > 20) {
      console.log(`  ... and ${noMatches.length - 20} more`);
    }
  }

  await p.$disconnect();
}

main().catch(e => { console.error(e); p.$disconnect(); });
