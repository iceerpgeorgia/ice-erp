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

    // Get payments for this project through job distributions
    const payments = await prisma.payments.findMany({
      select: { payment_uuid: true, payment_id: true }
    });

    console.log(`Found ${payments.length} total payments in system`);

    // Get distributions for this project
    const distributions = await prisma.payments_jobs.findMany({
      where: {
        jobs: {
          job_projects: {
            some: { project_uuid: project.project_uuid }
          }
        }
      },
      select: {
        payment_uuid: true,
        amount_nominal: true,
        amount_account_curr: true,
        jobs: { select: { job_name: true } },
        payments: { select: { payment_id: true } }
      }
    });

    console.log(`Found ${distributions.length} distributions for this project\n`);

    console.log(`Found ${distributions.length} distributions for this project\n`);

    // Group by payment_id and sum amounts
    const byPayment = {};
    distributions.forEach(d => {
      if (!byPayment[d.payments.payment_id]) {
        byPayment[d.payments.payment_id] = {
          totalNominal: 0,
          totalAccountCurr: 0,
          items: []
        };
      }
      byPayment[d.payments.payment_id].totalNominal += d.amount_nominal || 0;
      byPayment[d.payments.payment_id].totalAccountCurr += d.amount_account_curr || 0;
      byPayment[d.payments.payment_id].items.push({
        jobName: d.jobs.job_name,
        nominal: d.amount_nominal,
        accountCurr: d.amount_account_curr
      });
    });

    // Display results
    Object.entries(byPayment).forEach(([paymentId, data]) => {
      console.log(`Payment ID: ${paymentId}`);
      data.items.forEach(item => {
        console.log(`  - ${item.jobName}: nominal=${item.nominal?.toFixed(2) || 'NULL'}, account_curr=${item.accountCurr?.toFixed(2) || 'NULL'}`);
      });
      console.log(`  Total Nominal Distributed: ${data.totalNominal.toFixed(2)}`);
      console.log(`  Total Account Curr Distributed: ${data.totalAccountCurr.toFixed(2)}`);
      console.log();
    });

    // Get income payment records to compare
    const incomePayments = await prisma.payments_ledger.findMany({
      where: {
        payments: {
          project_uuid: project.project_uuid,
          income_tax: true
        }
      },
      select: {
        payment_uuid: true,
        accrual_or_order: true,
        payments: {
          select: {
            payment_id: true
          }
        }
      }
    });

    console.log(`\n=== Income Payments (Ledger Entries) ===\n`);
    incomePayments.forEach(ledger => {
      console.log(`Payment ID: ${ledger.payments.payment_id}`);
      console.log(`  Ledger Amount: ${ledger.accrual_or_order?.toFixed(2) || 'NULL'}`);
    });

    await prisma.$disconnect();
  } catch (e) {
    console.error("Error:", e.message);
    console.error(e);
    process.exit(1);
  }
})();
