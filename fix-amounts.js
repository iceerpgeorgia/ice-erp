const { PrismaClient } = require('@prisma/client');
const Decimal = require('decimal.js');
const p = new PrismaClient();

(async () => {
  // Find records where payment_id is set, nominal_currency differs from account_currency,
  // but nominal_amount still equals account_amount (conversion was skipped)
  const rows = await p.$queryRawUnsafe(`
    SELECT id, payment_id, account_currency_uuid, nominal_currency_uuid, 
           account_currency_amount, nominal_amount, exchange_rate, 
           transaction_date, correction_date
    FROM "GE78BG0000000893486000_BOG_GEL"
    WHERE payment_id IS NOT NULL 
      AND payment_id != ''
      AND nominal_currency_uuid != account_currency_uuid
      AND (
        exchange_rate IS NULL 
        OR exchange_rate = 1 
        OR nominal_amount = account_currency_amount
      )
    ORDER BY id
  `);

  console.log(`Found ${rows.length} records with currency set but amount not converted\n`);

  if (rows.length === 0) {
    await p.$disconnect();
    return;
  }

  // Load currencies
  const currencies = await p.$queryRaw`SELECT uuid::text, code FROM currencies`;
  const codeOf = new Map();
  for (const c of currencies) codeOf.set(c.uuid, c.code);
  const getRateField = (code) => `${code.toLowerCase()}_rate`;

  for (const r of rows) {
    const accountCode = codeOf.get(r.account_currency_uuid);
    const nominalCode = codeOf.get(r.nominal_currency_uuid);
    const amount = new Decimal(r.account_currency_amount.toString());

    const txDate = r.transaction_date instanceof Date
      ? r.transaction_date.toISOString().split('T')[0]
      : new Date(r.transaction_date).toISOString().split('T')[0];
    const corrDate = r.correction_date
      ? (r.correction_date instanceof Date
          ? r.correction_date.toISOString().split('T')[0]
          : new Date(r.correction_date).toISOString().split('T')[0])
      : null;
    const effectiveDate = (corrDate && corrDate !== txDate) ? corrDate : txDate;

    console.log(`id=${Number(r.id)} payment=${r.payment_id} ${accountCode}->${nominalCode} amount=${amount} date=${effectiveDate}`);

    const rates = await p.$queryRawUnsafe(
      `SELECT * FROM nbg_exchange_rates WHERE date = $1::date LIMIT 1`,
      effectiveDate
    );

    if (rates.length === 0) {
      console.log(`  SKIP: No rate for ${effectiveDate}\n`);
      continue;
    }

    let exchangeRate, nominalAmount;

    if (accountCode === 'GEL') {
      const rate = rates[0][getRateField(nominalCode)];
      if (!rate) { console.log(`  SKIP: No ${nominalCode} rate\n`); continue; }
      exchangeRate = new Decimal(rate.toString());
      nominalAmount = amount.mul(new Decimal(1).div(exchangeRate)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    } else if (nominalCode === 'GEL') {
      const rate = rates[0][getRateField(accountCode)];
      if (!rate) { console.log(`  SKIP: No ${accountCode} rate\n`); continue; }
      exchangeRate = new Decimal(rate.toString());
      nominalAmount = amount.mul(exchangeRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    } else {
      const aRate = rates[0][getRateField(accountCode)];
      const nRate = rates[0][getRateField(nominalCode)];
      if (!aRate || !nRate) { console.log(`  SKIP: Missing cross rates\n`); continue; }
      exchangeRate = new Decimal(aRate.toString()).div(new Decimal(nRate.toString()));
      nominalAmount = amount.mul(new Decimal(1).div(exchangeRate)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    console.log(`  Rate: ${exchangeRate} => ${amount} ${accountCode} -> ${nominalAmount} ${nominalCode}`);

    await p.$queryRawUnsafe(
      `UPDATE "GE78BG0000000893486000_BOG_GEL" 
       SET exchange_rate = $1::numeric,
           nominal_amount = $2::numeric,
           updated_at = NOW()
       WHERE id = $3`,
      exchangeRate.toString(),
      nominalAmount.toString(),
      BigInt(Number(r.id))
    );
    console.log(`  FIXED!\n`);
  }

  console.log('Done.');
  await p.$disconnect();
})();
