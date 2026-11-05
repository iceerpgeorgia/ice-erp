const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  try {
    // Get Alliance Highline project
    const project = await prisma.projects.findFirst({
      where: { project_name: { contains: "Alliance Highline", mode: "insensitive" } },
      select: { project_uuid: true, project_name: true }
    });

    if (!project) {
      console.log("Project not found");
      process.exit(1);
    }

    console.log(`\n=== Job Distributions for: ${project.project_name} ===\n`);

    // Get distributions for this project
    const distributions = await prisma.payments_jobs.findMany({
      where: {
        project_uuid: project.project_uuid
      },
      select: {
        id: true,
        amount: true,
        amount_account_curr: true,
        payment_uuid: true,
        job: { select: { job_name: true } }
      },
      orderBy: { payment_uuid: 'asc' }
    });

    console.log(`Found ${distributions.length} distributions for this project\n`);

    if (distributions.length === 0) {
      console.log("No distributions found");
      await prisma.$disconnect();
      return;
    }

    // Group by payment_uuid
    const byPayment = {};
    distributions.forEach(d => {
      const amt = parseFloat(d.amount || 0);
      const amtAcct = parseFloat(d.amount_account_curr || 0);
      
      if (!byPayment[d.payment_uuid]) {
        byPayment[d.payment_uuid] = {
          totalNominal: 0,
          totalAccountCurr: 0,
          items: []
        };
      }
      byPayment[d.payment_uuid].totalNominal += amt;
      byPayment[d.payment_uuid].totalAccountCurr += amtAcct;
      byPayment[d.payment_uuid].items.push({
        jobName: d.job.job_name,
        nominal: amt,
        accountCurr: amtAcct
      });
    });

    // Display results
    Object.entries(byPayment).forEach(([paymentUuid, data]) => {
      console.log(`\nPayment UUID: ${paymentUuid}`);
      data.items.forEach(item => {
        console.log(`  - ${item.jobName}: nominal=${item.nominal.toFixed(2)}, account_curr=${item.accountCurr.toFixed(2)}`);
      });
      console.log(`  ───────────────────────────────────`);
      console.log(`  Total Nominal:      ${data.totalNominal.toFixed(2)}`);
      console.log(`  Total Account Curr: ${data.totalAccountCurr.toFixed(2)}`);
    });

    // Get related payment records
    console.log(`\n=== Income Payments (Ledger) ===\n`);
    const incomePayments = await prisma.payments_ledger.findMany({
      where: {
        payments: {
          project_uuid: project.project_uuid
        }
      },
      select: {
        payment_uuid: true,
        accrual_or_order: true,
        payments: {
          select: {
            payment_id: true,
            income_tax: true
          }
        }
      }
    });

    console.log(`Found ${incomePayments.length} ledger entries for this project\n`);
    incomePayments.slice(0, 10).forEach(ledger => {
      console.log(`Payment ID: ${ledger.payments.payment_id}, Income: ${ledger.payments.income_tax}`);
      console.log(`  Ledger Amount: ${(ledger.accrual_or_order || 0).toFixed(2)}`);
    });

    await prisma.$disconnect();
  } catch (e) {
    console.error("Error:", e.message);
    process.exit(1);
  }
})();
