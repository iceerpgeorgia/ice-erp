const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const uuids = [
    "9f39081e-da54-4b36-8e76-a61025d8a505",  // Shartava (shows)
    "70a35471-a9c1-45d1-bfaf-a8c98abeaed7",  // Alliance Privilege (doesn't)
    "9518b3a0-051a-4732-b24d-e59f121af873",  // Bagrationi
  ];
  for (const uuid of uuids) {
    const rows = await p.$queryRawUnsafe(`
      SELECT fc.code, fc.uuid::text, fc.is_income, COUNT(*)::text AS cnt
      FROM payments pay
      JOIN financial_codes fc ON fc.uuid = pay.financial_code_uuid
      WHERE pay.project_uuid = $1::uuid
      GROUP BY fc.uuid, fc.code, fc.is_income
      ORDER BY fc.code
    `, uuid);
    const name = rows.length ? 'uuid:'+uuid.slice(0,8) : '(no payments)';
    console.log("\nPayment FCs for", uuid.slice(0,8));
    rows.forEach(r => console.log("  ", r.code, r.is_income ? '(income)' : '(cost)', "count:", r.cnt, "uuid:", r.uuid));
  }
  await p.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
