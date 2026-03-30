const { PrismaClient } = require('../node_modules/@prisma/client');
const fs = require('fs');
const p = new PrismaClient();
const out = [];
function log(s) { out.push(s); }

(async () => {
  const uuids = [
    'bae4c9a4-0414-450a-b101-7fa6d78567cf',
    'f5634274-707d-4e4e-aba8-ec1c67a17bbd'
  ];

  for (const uuid of uuids) {
    log(`\n=== Job ${uuid} ===`);
    
    // Show bindings
    const bindings = await p.$queryRawUnsafe(`
      SELECT jp.project_uuid, pr.project_name 
      FROM job_projects jp 
      JOIN projects pr ON jp.project_uuid = pr.project_uuid 
      WHERE jp.job_uuid = $1::uuid
    `, uuid);
    log('Bindings: ' + bindings.map(b => b.project_name).join(', '));

    // Show payments with ledger sums
    const payments = await p.$queryRawUnsafe(`
      SELECT p.payment_id, p.record_uuid, p.project_uuid, pr2.project_name,
             c.name as counteragent_name, fc.code as financial_code, 
             cur.code as currency_code, p.label, p.income_tax, p.created_at,
             COALESCE(SUM(pl.amount), 0) as ledger_total,
             COUNT(pl.id) as ledger_entries
      FROM payments p
      LEFT JOIN projects pr2 ON p.project_uuid = pr2.project_uuid
      LEFT JOIN counteragents c ON p.counteragent_uuid = c.counteragent_uuid
      LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
      LEFT JOIN currencies cur ON p.currency_uuid = cur.uuid
      LEFT JOIN payments_ledger pl ON p.id = pl.payment_id
      WHERE p.job_uuid = $1::uuid
      GROUP BY p.id, p.payment_id, p.record_uuid, p.project_uuid, pr2.project_name,
               c.name, fc.code, cur.code, p.label, p.income_tax, p.created_at
      ORDER BY p.created_at
    `, uuid);
    
    if (payments.length === 0) {
      log('Payments: NONE');
    } else {
      log(`Payments (${payments.length}):`);
      for (const pay of payments) {
        log(`  PayID: ${pay.payment_id} | Project: ${pay.project_name} | Counteragent: ${pay.counteragent_name} | FC: ${pay.financial_code} | Currency: ${pay.currency_code} | Label: ${pay.label || '-'} | IncomeTax: ${pay.income_tax} | Ledger: ${pay.ledger_total} (${Number(pay.ledger_entries)} entries)`);
      }
    }
  }

  fs.writeFileSync('scripts/l0201-payments-report.txt', out.join('\n'), 'utf8');
  console.log('Written to scripts/l0201-payments-report.txt');
  await p.$disconnect();
})();
