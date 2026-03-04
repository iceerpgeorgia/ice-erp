const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const uuids = await p.$queryRawUnsafe(
    'SELECT DISTINCT counteragent_uuid FROM salary_accruals WHERE counteragent_uuid IS NOT NULL LIMIT 3'
  );
  console.log('Sample counteragent UUIDs:', JSON.stringify(uuids));

  if (uuids.length > 0) {
    const uuid = uuids[0].counteragent_uuid;
    console.log('\nTesting API for counteragent:', uuid);

    // Simulate what the API does
    const counteragentRows = await p.$queryRawUnsafe(
      `SELECT counteragent_uuid, counteragent as counteragent_name FROM counteragents WHERE counteragent_uuid = $1::uuid LIMIT 1`,
      uuid
    );
    console.log('Counteragent:', JSON.stringify(counteragentRows));

    const paymentRows = await p.$queryRawUnsafe(
      `SELECT p.payment_id FROM payments p WHERE p.counteragent_uuid = $1::uuid AND p.is_active = true`,
      uuid
    );
    console.log('Payment rows:', paymentRows.length);

    const salaryRows = await p.$queryRawUnsafe(
      `SELECT sa.payment_id FROM salary_accruals sa WHERE sa.counteragent_uuid = $1::uuid`,
      uuid
    );
    console.log('Salary rows:', salaryRows.length);

    const paymentIds = [...new Set([
      ...paymentRows.map(r => r.payment_id),
      ...salaryRows.map(r => r.payment_id),
    ].filter(Boolean))];
    console.log('Combined payment_ids:', paymentIds.length);

    // Test bank transactions
    const bankCount = await p.$queryRawUnsafe(
      `SELECT COUNT(*) as cnt FROM "GE78BG0000000893486000_BOG_GEL" WHERE counteragent_uuid = $1::uuid`,
      uuid
    );
    console.log('BOG GEL bank rows for this counteragent:', bankCount[0].cnt.toString());

    // Test HTTP call to the running server
    try {
      const resp = await fetch(`http://localhost:3000/api/counteragent-statement?counteragentUuid=${uuid}`);
      console.log('\nHTTP Response status:', resp.status);
      if (resp.ok) {
        const data = await resp.json();
        console.log('Response paymentIds:', data.paymentIds?.length ?? 0);
        console.log('Response ledgerEntries:', data.ledgerEntries?.length ?? 0);
        console.log('Response bankTransactions:', data.bankTransactions?.length ?? 0);
      } else {
        const text = await resp.text();
        console.log('Error response:', text.substring(0, 300));
      }
    } catch (e) {
      console.log('HTTP error:', e.message);
    }
  }

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
