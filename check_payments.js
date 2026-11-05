const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  try {
    // Get Alliance Highline project
    const project = await prisma.projects.findFirst({
      where: { project_name: { contains: "Alliance Highline", mode: "insensitive" } },
      select: { project_uuid: true }
    });

    // Get payments for this project
    const payments = await prisma.payments.findMany({
      where: { project_uuid: project.project_uuid },
      select: {
        id: true,
        payment_id: true,
        income_tax: true,
        currency_uuid: true
      }
    });

    console.log(`\nPayments for Alliance Highline project (${payments.length} total):\n`);
    payments.forEach(p => {
      console.log(`Payment ID: ${p.payment_id}, Income Tax: ${p.income_tax}`);
    });

    // Get ledger entries for these payments
    const ledger = await prisma.payments_ledger.findMany({
      where: {
        payment_id: { in: payments.map(p => p.id) }
      },
      select: {
        id: true,
        payment_id: true,
        accrual: true,
        order: true,
        effective_date: true,
        payments: {
          select: {
            payment_id: true,
            income_tax: true
          }
        }
      }
    });

    console.log(`\n\n=== Ledger Entries ===\n`);
    ledger.forEach(l => {
      const accrual = parseFloat(l.accrual || 0);
      const order = parseFloat(l.order || 0);
      console.log(`Payment ID: ${l.payments.payment_id}`);
      console.log(`  Accrual: ${accrual.toFixed(2)}, Order: ${order.toFixed(2)}`);
    });

    // Now get distributions and compare
    const distros = await prisma.payments_jobs.findMany({
      where: { project_uuid: project.project_uuid },
      select: {
        payment_uuid: true,
        amount: true,
        amount_account_curr: true
      }
    });

    console.log(`\n\n=== Distributions Summary ===\n`);
    const byPayment = {};
    distros.forEach(d => {
      if (!byPayment[d.payment_uuid]) {
        byPayment[d.payment_uuid] = { total: 0, count: 0 };
      }
      byPayment[d.payment_uuid].total += parseFloat(d.amount || 0);
      byPayment[d.payment_uuid].count++;
    });

    Object.entries(byPayment).forEach(([uuid, data]) => {
      console.log(`Payment UUID: ${uuid}`);
      console.log(`  Rows: ${data.count}, Total Nominal: ${data.total.toFixed(2)}`);
    });

    await prisma.$disconnect();
  } catch (e) {
    console.error("Error:", e.message);
    process.exit(1);
  }
})();
