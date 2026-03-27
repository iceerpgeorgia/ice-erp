const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const r = await p.$queryRawUnsafe(`SELECT COUNT(*)::int as cnt FROM "GE78BG0000000893486000_BOG_GEL" WHERE payment_id IS NOT NULL AND payment_id != '' AND nominal_currency_uuid != account_currency_uuid AND (exchange_rate IS NULL OR exchange_rate = 1 OR nominal_amount = account_currency_amount)`);
  console.log("REMAINING=" + r[0].cnt);
  const r53 = await p.$queryRawUnsafe(`SELECT id, payment_id, account_currency_amount::text as a, nominal_amount::text as n, exchange_rate::text as r FROM "GE78BG0000000893486000_BOG_GEL" WHERE id = 53160`);
  if(r53.length>0){const x=r53[0];console.log("REC53160=id=" + Number(x.id) + " acct_amt=" + x.a + " nom_amt=" + x.n + " rate=" + x.r);}
  await p.$disconnect();
})();
