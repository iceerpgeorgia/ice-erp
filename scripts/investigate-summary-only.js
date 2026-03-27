const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

// Fix BigInt serialization
BigInt.prototype.toJSON = function() { return Number(this); };

async function main() {
  const projects = await prisma.$queryRawUnsafe(`
    SELECT p.project_uuid, p.project_name, p.project_index,
           p.counteragent_uuid, p.financial_code_uuid, p.currency_uuid,
           p.counteragent, p.financial_code, p.currency,
           fc.code AS fc_code, fc.name AS fc_name
    FROM projects p
    JOIN financial_codes fc ON fc.uuid = p.financial_code_uuid
    WHERE fc.automated_payment_id = true
    ORDER BY p.project_index
  `);

  const unboundList = [];
  const alreadyBoundList = [];
  const noDerivedList = [];

  for (const proj of projects) {
    const derivedPayments = await prisma.$queryRawUnsafe(`
      SELECT id, payment_id, is_project_derived, is_active
      FROM payments WHERE project_uuid = $1::uuid
    `, proj.project_uuid);

    const matchingPayments = await prisma.$queryRawUnsafe(`
      SELECT id, payment_id, project_uuid, is_project_derived, is_active, job_uuid, income_tax
      FROM payments
      WHERE counteragent_uuid = $1::uuid
        AND financial_code_uuid = $2::uuid
        AND currency_uuid = $3::uuid
        AND is_active = true
    `, proj.counteragent_uuid, proj.financial_code_uuid, proj.currency_uuid);

    const hasDerived = derivedPayments.length > 0;
    const unboundMatches = matchingPayments.filter(mp => !mp.project_uuid);

    if (hasDerived) alreadyBoundList.push(proj);

    for (const u of unboundMatches) {
      unboundList.push({
        projectUuid: proj.project_uuid,
        projectIndex: proj.project_index,
        projectName: proj.project_name,
        counteragent: proj.counteragent,
        fcCode: proj.fc_code,
        currency: proj.currency,
        paymentId: Number(u.id),
        paymentPid: u.payment_id,
        jobUuid: u.job_uuid,
        incomeTax: u.income_tax,
      });
    }

    if (!hasDerived && unboundMatches.length === 0) {
      noDerivedList.push({
        projectUuid: proj.project_uuid,
        projectIndex: proj.project_index,
        projectName: proj.project_name,
        counteragent: proj.counteragent,
        fcCode: proj.fc_code,
        currency: proj.currency,
      });
    }
  }

  const summary = {
    totalProjects: projects.length,
    alreadyBound: alreadyBoundList.length,
    unboundCount: unboundList.length,
    noPaymentCount: noDerivedList.length,
    unboundDetails: unboundList,
    noPaymentDetails: noDerivedList,
  };

  const path = require('path');
  const outPath = path.join(__dirname, 'investigation-summary.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log('DONE');
  console.log('File:', outPath);
  console.log('Total projects:', projects.length);
  console.log('Already bound:', alreadyBoundList.length);
  console.log('Unbound matching:', unboundList.length);
  console.log('No payment at all:', noDerivedList.length);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
