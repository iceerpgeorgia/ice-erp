const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const rows = await p.$queryRawUnsafe(
    `SELECT id, payment_id, account_currency_uuid, nominal_currency_uuid, 
            account_currency_amount, nominal_amount, exchange_rate, 
            transaction_date, correction_date 
     FROM "GE78BG0000000893486000_BOG_GEL" WHERE id = 53160`
  );
  if (rows.length === 0) { console.log('Not found'); await p.$disconnect(); return; }
  const r = rows[0];
  const uuids = [r.account_currency_uuid, r.nominal_currency_uuid].filter(Boolean);
  const curs = await p.$queryRawUnsafe(
    `SELECT uuid::text, code FROM currencies WHERE uuid IN (${uuids.map((_, i) => `$${i + 1}::uuid`).join(',')})`,
    ...uuids
  );
  const codeOf = Object.fromEntries(curs.map(c => [c.uuid, c.code]));
  let paymentCurrency = null;
  if (r.payment_id) {
    const pay = await p.$queryRawUnsafe(
      `SELECT p.currency_uuid, c.code FROM payments p JOIN currencies c ON c.uuid = p.currency_uuid WHERE p.payment_id = $1`,
      r.payment_id
    );
    if (pay.length > 0) paymentCurrency = pay[0].code;
  }
  console.log(JSON.stringify({
    id: Number(r.id),
    payment_id: r.payment_id,
    account_currency: codeOf[r.account_currency_uuid],
    nominal_currency: codeOf[r.nominal_currency_uuid],
    payment_currency: paymentCurrency,
    account_amount: r.account_currency_amount?.toString(),
    nominal_amount: r.nominal_amount?.toString(),
    exchange_rate: r.exchange_rate?.toString(),
    transaction_date: r.transaction_date,
    correction_date: r.correction_date,
    status: codeOf[r.nominal_currency_uuid] === paymentCurrency ? 'OK' : 'MISMATCH'
  }, null, 2));
  await p.$disconnect();
})();
