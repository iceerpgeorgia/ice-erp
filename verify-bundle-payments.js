const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function verify() {
  const totalBundle = await p.$queryRawUnsafe('SELECT COUNT(*) as count FROM payments WHERE is_bundle_payment = true');
  const byFC = await p.$queryRawUnsafe(\`
    SELECT fc.code, fc.name, COUNT(p.id) as payment_count 
    FROM payments p 
    JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid 
    WHERE p.is_bundle_payment = true 
    GROUP BY fc.code, fc.name 
    ORDER BY fc.code
  \\);
  console.log('Total bundle payments:', totalBundle[0].count.toString());
  console.log('\nBreakdown by child FC:');
  byFC.forEach(row => console.log(\`  \${row.code} (\${row.name}): \${row.payment_count.toString()} payments\\));
  await p.$disconnect();
}
verify().catch(e => { console.error(e.message); p.$disconnect(); });
