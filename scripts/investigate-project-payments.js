const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Find all projects with financial codes that have automated_payment_id = true
  const projects = await prisma.$queryRawUnsafe(`
    SELECT 
      p.project_uuid,
      p.project_name,
      p.project_index,
      p.counteragent_uuid,
      p.financial_code_uuid,
      p.currency_uuid,
      p.counteragent,
      p.financial_code,
      p.currency,
      fc.code AS fc_code,
      fc.name AS fc_name,
      fc.automated_payment_id
    FROM projects p
    JOIN financial_codes fc ON fc.uuid = p.financial_code_uuid
    WHERE fc.automated_payment_id = true
    ORDER BY p.project_index
  `);

  console.log('=== PROJECTS WITH automated_payment_id=true FINANCIAL CODES ===');
  console.log('Total:', projects.length);
  console.log('');

  const unboundList = [];
  const alreadyBoundList = [];
  const noDerivedList = [];

  for (const proj of projects) {
    // 2. Check for derived payments already linked to this project
    const derivedPayments = await prisma.$queryRawUnsafe(`
      SELECT id, payment_id, record_uuid, is_project_derived, 
             counteragent_uuid, financial_code_uuid, currency_uuid, is_active
      FROM payments
      WHERE project_uuid = $1::uuid
    `, proj.project_uuid);

    // 3. Check for matching payments by composite key (counteragent + financial_code + currency)
    const matchingPayments = await prisma.$queryRawUnsafe(`
      SELECT id, payment_id, record_uuid, project_uuid, is_project_derived, is_active,
             counteragent_uuid, financial_code_uuid, currency_uuid, job_uuid, income_tax
      FROM payments
      WHERE counteragent_uuid = $1::uuid
        AND financial_code_uuid = $2::uuid
        AND currency_uuid = $3::uuid
        AND is_active = true
      ORDER BY id
    `, proj.counteragent_uuid, proj.financial_code_uuid, proj.currency_uuid);

    const hasDerived = derivedPayments.length > 0;
    const unboundMatches = matchingPayments.filter(mp => !mp.project_uuid);
    const boundMatches = matchingPayments.filter(mp => mp.project_uuid);

    console.log(`Project: ${proj.project_index} | ${proj.project_name}`);
    console.log(`  CA: ${proj.counteragent} | FC: ${proj.fc_code} ${proj.fc_name} | Currency: ${proj.currency}`);
    console.log(`  Project UUID: ${proj.project_uuid}`);

    if (derivedPayments.length > 0) {
      for (const d of derivedPayments) {
        console.log(`  Derived payment: id=${Number(d.id)} pid="${d.payment_id}" derived=${d.is_project_derived} active=${d.is_active}`);
      }
      alreadyBoundList.push(proj);
    } else {
      console.log(`  NO derived payment found for this project`);
    }

    if (matchingPayments.length > 0) {
      for (const m of matchingPayments) {
        const status = m.project_uuid ? `bound to ${m.project_uuid}` : 'UNBOUND';
        console.log(`  Matching payment: id=${Number(m.id)} pid="${m.payment_id}" status=${status} derived=${m.is_project_derived} job=${m.job_uuid || 'null'} income_tax=${m.income_tax}`);
      }
    } else {
      console.log(`  No matching payments in payments table`);
    }

    if (unboundMatches.length > 0) {
      for (const u of unboundMatches) {
        unboundList.push({
          projectUuid: proj.project_uuid,
          projectIndex: proj.project_index,
          projectName: proj.project_name,
          paymentId: Number(u.id),
          paymentPid: u.payment_id,
          counteragentUuid: u.counteragent_uuid,
          financialCodeUuid: u.financial_code_uuid,
          currencyUuid: u.currency_uuid,
          jobUuid: u.job_uuid,
          incomeTax: u.income_tax,
        });
      }
      console.log(`  >>> ${unboundMatches.length} UNBOUND matching payment(s) can be bound!`);
    }

    if (!hasDerived && unboundMatches.length === 0) {
      noDerivedList.push(proj);
    }

    console.log('');
  }

  console.log('========== SUMMARY ==========');
  console.log(`Total projects with auto-payment financial codes: ${projects.length}`);
  console.log(`Already have derived payment: ${alreadyBoundList.length}`);
  console.log(`Have UNBOUND matching payments to bind: ${unboundList.length}`);
  console.log(`No derived payment and no matching payments: ${noDerivedList.length}`);
  console.log('');

  if (unboundList.length > 0) {
    console.log('=== UNBOUND PAYMENTS THAT CAN BE BOUND ===');
    for (const u of unboundList) {
      console.log(`  Project ${u.projectIndex} (${u.projectName}) => payment id=${u.paymentId} pid="${u.paymentPid}" job=${u.jobUuid || 'null'} income_tax=${u.incomeTax}`);
    }
  }

  if (noDerivedList.length > 0) {
    console.log('');
    console.log('=== PROJECTS WITH NO PAYMENT AT ALL ===');
    for (const n of noDerivedList) {
      console.log(`  ${n.project_index} | ${n.project_name} | CA: ${n.counteragent} | FC: ${n.fc_code}`);
    }
  }

  // Write summary to JSON file
  const fs = require('fs');
  const summary = {
    totalProjects: projects.length,
    alreadyBound: alreadyBoundList.length,
    unboundCount: unboundList.length,
    noPaymentCount: noDerivedList.length,
    unboundDetails: unboundList,
    noPaymentDetails: noDerivedList.map(n => ({
      projectUuid: n.project_uuid,
      projectIndex: n.project_index,
      projectName: n.project_name,
      counteragent: n.counteragent,
      fcCode: n.fc_code,
      currency: n.currency,
    })),
  };
  fs.writeFileSync('scripts/investigation-summary.json', JSON.stringify(summary, null, 2));
  console.log('\nSummary written to scripts/investigation-summary.json');

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
