const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const projectName = 'Alliance Highline';
    
    console.log(`\n=== ALLIANCE HIGHLINE RECONCILIATION ===\n`);

    // Get the project
    const project = await prisma.projects.findFirst({
      where: { project_name: { contains: projectName } },
      select: { project_uuid: true, project_name: true }
    });

    if (!project) {
      console.error('Project not found');
      process.exit(1);
    }

    // Get all income payments
    const paymentsData = await prisma.$queryRaw`
      SELECT 
        p.id,
        p.payment_id,
        p.record_uuid,
        COUNT(pl.id) as ledger_count,
        SUM(COALESCE(pl.accrual, 0)) as total_accrual,
        SUM(COALESCE(pl."order", 0)) as total_order,
        SUM(COALESCE(pl.accrual, 0) + COALESCE(pl."order", 0)) as total_amount
      FROM payments p
      LEFT JOIN payments_ledger pl ON p.payment_id = pl.payment_id
      WHERE p.project_uuid = ${project.project_uuid}::uuid AND p.income_tax = false
      GROUP BY p.id, p.payment_id, p.record_uuid
      ORDER BY p.payment_id
    `;

    console.log(`Found ${paymentsData.length} income payments for project`);

    // For each payment, get distributions
    let grandTotalLedger = 0;
    let grandTotalDistributed = 0;
    let mismatches = [];

    for (const payment of paymentsData) {
      const ledgerAmount = parseFloat(payment.total_amount || 0);
      
      const distData = await prisma.$queryRaw`
        SELECT 
          SUM(COALESCE(pj.amount, 0)) as total_nominal,
          SUM(COALESCE(pj.amount_account_curr, 0)) as total_account_curr,
          COUNT(*) as dist_count
        FROM payments_jobs pj
        WHERE pj.payment_uuid = ${payment.record_uuid} AND pj.project_uuid = ${project.project_uuid}::uuid
      `;

      const dist = distData[0];
      const distNominal = parseFloat(dist.total_nominal || 0);
      const distAccountCurr = parseFloat(dist.total_account_curr || 0);
      const diff = distNominal - ledgerAmount;
      const diffPct = ledgerAmount > 0 ? (diff / ledgerAmount * 100) : 0;

      grandTotalLedger += ledgerAmount;
      grandTotalDistributed += distNominal;

      if (Math.abs(diff) > 0.01) {
        mismatches.push({
          payment_id: payment.payment_id,
          ledger: ledgerAmount,
          distributed: distNominal,
          diff: diff,
          diffPct: diffPct,
          distCount: dist.dist_count || 0
        });
      }

      if (payment.ledger_count > 0 && (dist.dist_count > 0 || diff !== 0)) {
        console.log(`\n${payment.payment_id}`);
        console.log(`  Ledger Entries: ${payment.ledger_count}, Amount: ${ledgerAmount.toFixed(2)}`);
        if (dist.dist_count > 0) {
          console.log(`  Distributions: ${dist.dist_count}, Nominal: ${distNominal.toFixed(2)}`);
          if (Math.abs(diff) > 0.01) {
            console.log(`  ❌ MISMATCH: ${diff.toFixed(2)} (${diffPct.toFixed(2)}%)`);
          } else {
            console.log(`  ✓ OK`);
          }
        } else {
          console.log(`  No distributions found`);
        }
      }
    }

    // Summary
    console.log(`\n\n=== RECONCILIATION SUMMARY ===`);
    console.log(`\nTotal Ledger Amount: ${grandTotalLedger.toFixed(2)}`);
    console.log(`Total Distributed (Nominal): ${grandTotalDistributed.toFixed(2)}`);
    console.log(`Unaccounted For: ${(grandTotalLedger - grandTotalDistributed).toFixed(2)}`);

    if (mismatches.length > 0) {
      console.log(`\n\n${mismatches.length} payments with mismatches:`);
      mismatches.forEach(m => {
        console.log(`\n  ${m.payment_id}`);
        console.log(`    Ledger: ${m.ledger.toFixed(2)}`);
        console.log(`    Distributed: ${m.distributed.toFixed(2)}`);
        console.log(`    Mismatch: ${m.diff.toFixed(2)} (${m.diffPct.toFixed(2)}%)`);
        console.log(`    Dist rows: ${m.distCount}`);
      });
    }

    const netDiff = grandTotalLedger - grandTotalDistributed;
    if (Math.abs(netDiff) < 0.01) {
      console.log(`\n✓ PERFECT RECONCILIATION: All payments are fully distributed`);
    } else if (netDiff > 0) {
      console.log(`\n⚠️  UNDERDISTRIBUTED: ${netDiff.toFixed(2)} not allocated`);
    } else {
      console.log(`\n⚠️  OVERDISTRIBUTED: ${Math.abs(netDiff).toFixed(2)} over-allocated`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
})();
