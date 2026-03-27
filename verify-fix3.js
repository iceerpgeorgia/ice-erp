const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  try {
    const tableName = "GE78BG0000000893486000_BOG_GEL";
    const q1 = 'SELECT COUNT(*)::int as cnt FROM "' + tableName + '" WHERE payment_id IS NOT NULL AND nominal_currency_uuid != account_currency_uuid AND (exchange_rate IS NULL OR exchange_rate = 1 OR nominal_amount = account_currency_amount)';
    const r = await p.$queryRawUnsafe(q1);
    console.log("REMAINING=" + r[0].cnt);

    const q2 = 'SELECT id, account_currency_amount::text as a, nominal_amount::text as n, exchange_rate::text as r FROM "' + tableName + '" WHERE id = 53160';
    const r2 = await p.$queryRawUnsafe(q2);
    if (r2.length > 0) {
      var x = r2[0];
      console.log("REC53160 acct=" + x.a + " nom=" + x.n + " rate=" + x.r);
    } else {
      console.log("REC53160 not found");
    }
  } catch(e) {
    console.error("ERROR:", e.message);
  }
  await p.$disconnect();
})();
