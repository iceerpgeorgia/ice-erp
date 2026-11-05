const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    // Get Alliance Highline project
    const project = await prisma.projects.findFirst({
      where: { project_name: { contains: 'Alliance Highline' } },
      select: { project_uuid: true, project_name: true }
    });

    if (!project) {
      console.error('Project not found');
      process.exit(1);
    }

    console.log(`\n=== ALLIANCE HIGHLINE PROJECT ===`);
    console.log(`UUID: ${project.project_uuid}`);
    console.log(`Name: ${project.project_name}`);

    // Get all payments for this project
    const payments = await prisma.payments.findMany({
      where: { project_uuid: project.project_uuid },
      select: {
        id: true,
        payment_id: true,
        income_tax: true
      }
    });

    console.log(`\n=== PAYMENTS FOR THIS PROJECT ===`);
    console.log(`Total payments: ${payments.length}`);
    
    const paymentIdStrings = payments.map(p => p.payment_id);
    const paymentIds = payments.map(p => Number(p.id));

    // Get ledger entries for all these payments to see the actual payment amounts
    console.log(`\n=== LEDGER ENTRIES (Payment Amounts) ===`);
    
    const ledgerEntries = await prisma.payments_ledger.findMany({
      where: {
        payment_id: { in: paymentIdStrings }
      },
      include: {
        payments: {
          select: {
            id: true,
            payment_id: true,
            income_tax: true
          }
        }
      }
    });

    const paymentsByIdNum = {};
    const processedPayments = new Set();
    
    ledgerEntries.forEach(entry => {
      if (!processedPayments.has(entry.payment_id)) {
        processedPayments.add(entry.payment_id);
        if (!paymentsByIdNum[entry.payment_id]) {
          paymentsByIdNum[entry.payment_id] = {
            payment_id_num: entry.payment_id,
            payment_id: entry.payments.payment_id,
            total_accrual: 0,
            total_order: 0,
            total_payment: 0,
            ledger_entries: 0
          };
        }
      }
      paymentsByIdNum[entry.payment_id].total_accrual += parseFloat(entry.accrual || 0);
      paymentsByIdNum[entry.payment_id].total_order += parseFloat(entry.order || 0);
      paymentsByIdNum[entry.payment_id].total_payment += parseFloat(entry.accrual || 0) + parseFloat(entry.order || 0);
      paymentsByIdNum[entry.payment_id].ledger_entries += 1;
    });

    Object.values(paymentsByIdNum).forEach(row => {
      console.log(`\nPayment ID: ${row.payment_id}`);
      console.log(`  Ledger Entries: ${row.ledger_entries}`);
      console.log(`  Total Accrual: ${row.total_accrual.toFixed(2)}`);
      console.log(`  Total Order: ${row.total_order.toFixed(2)}`);
      console.log(`  TOTAL PAYMENT: ${row.total_payment.toFixed(2)}`);
    });

    // Get distributions for this project only
    console.log(`\n\n=== DISTRIBUTIONS FOR ALLIANCE HIGHLINE PROJECT ===`);
    const distributionsThisProject = await prisma.payments_jobs.findMany({
      where: { project_uuid: project.project_uuid },
      select: {
        id: true,
        payment_id: true,
        amount: true,
        amount_account_curr: true,
        job_uuid: true,
        job: { select: { job_name: true } }
      }
    });

    console.log(`Total distributions: ${distributionsThisProject.length}`);

    const distByPayment = {};
    distributionsThisProject.forEach(d => {
      if (!distByPayment[d.payment_id]) {
        distByPayment[d.payment_id] = {
          nominalTotal: 0,
          accountCurrTotal: 0,
          rows: []
        };
      }
      const amt = parseFloat(d.amount || 0);
      const amtAcct = parseFloat(d.amount_account_curr || 0);
      distByPayment[d.payment_id].nominalTotal += amt;
      distByPayment[d.payment_id].accountCurrTotal += amtAcct;
      distByPayment[d.payment_id].rows.push({
        jobName: d.job.job_name,
        nominal: amt,
        accountCurr: amtAcct
      });
    });

    // Get distributions for ALL projects for these payment IDs (to compare)
    console.log(`\n=== DISTRIBUTIONS ACROSS ALL PROJECTS ===`);
    const distributionsAllProjects = await prisma.payments_jobs.findMany({
      where: { payment_id: { in: paymentIds } },
      select: {
        id: true,
        payment_id: true,
        project_uuid: true,
        amount: true,
        amount_account_curr: true,
        job_uuid: true,
        job: { select: { job_name: true } }
      }
    });

    console.log(`Total distributions across all projects: ${distributionsAllProjects.length}`);

    const distByPaymentAllProjects = {};
    
    distributionsAllProjects.forEach(d => {
      if (!distByPaymentAllProjects[d.payment_id]) {
        distByPaymentAllProjects[d.payment_id] = {
          nominalTotal: 0,
          accountCurrTotal: 0,
          byProject: {},
          rows: []
        };
      }
      const amt = parseFloat(d.amount || 0);
      const amtAcct = parseFloat(d.amount_account_curr || 0);
      distByPaymentAllProjects[d.payment_id].nominalTotal += amt;
      distByPaymentAllProjects[d.payment_id].accountCurrTotal += amtAcct;
      
      if (!distByPaymentAllProjects[d.payment_id].byProject[d.project_uuid]) {
        distByPaymentAllProjects[d.payment_id].byProject[d.project_uuid] = {
          nominalTotal: 0,
          accountCurrTotal: 0,
          count: 0
        };
      }
      distByPaymentAllProjects[d.payment_id].byProject[d.project_uuid].nominalTotal += amt;
      distByPaymentAllProjects[d.payment_id].byProject[d.project_uuid].accountCurrTotal += amtAcct;
      distByPaymentAllProjects[d.payment_id].byProject[d.project_uuid].count += 1;
    });

    // Generate comparison report
    console.log(`\n\n=== RECONCILIATION REPORT ===\n`);

    paymentIds.forEach(pId => {
      const ledger = paymentsByIdNum[pId];
      const distThisProj = distByPayment[pId];
      const distAllProj = distByPaymentAllProjects[pId];

      if (!ledger) return;

      const paymentAmount = parseFloat(ledger.total_payment || 0);
      const distThisProjNominal = distThisProj ? distThisProj.nominalTotal : 0;
      const distAllProjNominal = distAllProj ? distAllProj.nominalTotal : 0;
      
      const diffThisProj = distThisProjNominal - paymentAmount;
      const diffAllProj = distAllProjNominal - paymentAmount;

      console.log(`\nPayment: ${ledger.payment_id}`);
      console.log(`  Payment Amount (Ledger): ${paymentAmount.toFixed(2)}`);
      console.log(`  Distributed (This Project): ${distThisProjNominal.toFixed(2)}`);
      console.log(`  Difference (This): ${diffThisProj.toFixed(2)} ${Math.abs(diffThisProj) > 0.01 ? '❌ MISMATCH' : '✓ OK'}`);
      console.log(`  `);
      console.log(`  Distributed (ALL Projects): ${distAllProjNominal.toFixed(2)}`);
      console.log(`  Difference (All): ${diffAllProj.toFixed(2)} ${Math.abs(diffAllProj) > 0.01 ? '❌ MISMATCH' : '✓ OK'}`);
      
      // Show distribution by project
      if (distAllProj && Object.keys(distAllProj.byProject).length > 0) {
        console.log(`  Breakdown by Project:`);
        Object.entries(distAllProj.byProject).forEach(([projUuid, projData]) => {
          const isThisProject = projUuid === project.project_uuid ? ' ← THIS PROJECT' : '';
          console.log(`    Rows: ${projData.count}, Nominal: ${projData.nominalTotal.toFixed(2)}${isThisProject}`);
        });
      }
    });

    // Final summary
    console.log(`\n\n=== SUMMARY ===`);
    const totalLedgerAmount = Object.values(paymentsByIdNum).reduce((sum, p) => sum + parseFloat(p.total_payment || 0), 0);
    const totalDistThisProj = Object.values(distByPayment).reduce((sum, d) => sum + d.nominalTotal, 0);
    const totalDistAllProj = Object.values(distByPaymentAllProjects).reduce((sum, d) => sum + d.nominalTotal, 0);

    console.log(`\nTotal Ledger Amount (ALL payments): ${totalLedgerAmount.toFixed(2)}`);
    console.log(`Total Distributed (This Project): ${totalDistThisProj.toFixed(2)}`);
    console.log(`Total Distributed (All Projects): ${totalDistAllProj.toFixed(2)}`);
    console.log(`Missing from All Projects: ${(totalLedgerAmount - totalDistAllProj).toFixed(2)}`);
    console.log(`Missing from This Project: ${(totalLedgerAmount - totalDistThisProj).toFixed(2)}`);

    if (Math.abs(totalLedgerAmount - totalDistAllProj) > 0.01) {
      console.log(`\n⚠️  WARNING: Not all payment amounts are distributed!`);
      console.log(`   ${(totalLedgerAmount - totalDistAllProj).toFixed(2)} is unallocated across all projects.`);
    } else {
      console.log(`\n✓ All payments are fully distributed across all projects`);
    }

    if (Math.abs(totalDistThisProj - totalDistAllProj) > 0.01 && totalDistAllProj > 0) {
      const pctThisProj = (totalDistThisProj / totalDistAllProj) * 100;
      console.log(`\n📊 NOTE: This project receives ${pctThisProj.toFixed(1)}% of distributions.`);
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
})();
