const { PrismaClient } = require('../node_modules/@prisma/client');
const fs = require('fs');
const p = new PrismaClient();
const out = [];

(async () => {
  const uuids = [
    'bae4c9a4-0414-450a-b101-7fa6d78567cf',
    'f5634274-707d-4e4e-aba8-ec1c67a17bbd'
  ];

  for (const uuid of uuids) {
    out.push(`\n=== Job ${uuid} ===`);
    
    const bindings = await p.$queryRawUnsafe(`
      SELECT jp.project_uuid, pr.project_name 
      FROM job_projects jp 
      JOIN projects pr ON jp.project_uuid = pr.project_uuid 
      WHERE jp.job_uuid = $1::uuid
    `, uuid);
    out.push('Bindings: ' + bindings.map(b => b.project_name).join(', '));

    const payments = await p.$queryRawUnsafe(`
      SELECT p.payment_id, p.project_uuid, pr2.project_name,
             c.name as counteragent_name, fc.code as financial_code, 
             cur.code as currency_code, p.label, p.income_tax, p.created_at
      FROM payments p
      LEFT JOIN projects pr2 ON p.project_uuid = pr2.project_uuid
      LEFT JOIN counteragents c ON p.counteragent_uuid = c.counteragent_uuid
      LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
      LEFT JOIN currencies cur ON p.currency_uuid = cur.uuid
      WHERE p.job_uuid = $1::uuid
      ORDER BY p.created_at
    `, uuid);
    
    if (payments.length === 0) {
      out.push('Payments: NONE');
    } else {
      out.push(`Payments (${payments.length}):`);
      for (const pay of payments) {
        // Get ledger sum for this payment
        const ledger = await p.$queryRawUnsafe(`
          SELECT COALESCE(SUM(accrual), 0) as total_accrual, 
                 COALESCE(SUM("order"), 0) as total_order,
                 COUNT(*) as entries
          FROM payments_ledger 
          WHERE payment_id = $1 AND is_deleted = false
        `, pay.payment_id);
        const l = ledger[0];
        out.push(`  PayID: ${pay.payment_id} | Project: ${pay.project_name} | CA: ${pay.counteragent_name} | FC: ${pay.financial_code} | ${pay.currency_code} | Label: ${pay.label || '-'} | Tax: ${pay.income_tax} | Accrual: ${l.total_accrual} | Order: ${l.total_order} (${Number(l.entries)} entries)`);
      }
    }
  }

  const report = out.join('\n');
  fs.writeFileSync('scripts/l0201-payments-report.txt', report, 'utf8');
  console.log(report);
  console.log('\n--- Written to scripts/l0201-payments-report.txt ---');
  await p.$disconnect();
})();
