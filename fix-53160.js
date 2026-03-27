const { PrismaClient } = require('@prisma/client');
const Decimal = require('decimal.js');
const p = new PrismaClient();

(async () => {
  // Get the latest available rate before 2026-03-23
  const rates = await p.$queryRawUnsafe(
    `SELECT * FROM nbg_exchange_rates WHERE date <= $1::date ORDER BY date DESC LIMIT 1`,
    '2026-03-23'
  );
  
  if (rates.length === 0) {
    console.log('No rates found before 2026-03-23');
    await p.$disconnect();
    return;
  }

  console.log('Using rate date:', rates[0].date, 'USD rate:', rates[0].usd_rate);

  const amount = new Decimal('1686.96');
  const usdRate = new Decimal(rates[0].usd_rate.toString());
  const nominalAmount = amount.mul(new Decimal(1).div(usdRate)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const exchangeRate = usdRate;

  console.log(`Amount: ${amount} GEL / ${exchangeRate} = ${nominalAmount} USD`);

  // Update record 53160
  await p.$queryRawUnsafe(`
    UPDATE "GE78BG0000000893486000_BOG_GEL"
    SET exchange_rate = $1, nominal_amount = $2, updated_at = NOW()
    WHERE id = 53160
  `, exchangeRate.toNumber(), nominalAmount.toNumber());

  console.log('FIXED record 53160!');

  // Verify
  const verify = await p.$queryRawUnsafe(
    `SELECT id, account_currency_amount, nominal_amount, exchange_rate, nominal_currency_uuid
     FROM "GE78BG0000000893486000_BOG_GEL" WHERE id = 53160`
  );
  console.log('Verified:', verify[0]);

  await p.$disconnect();
})();
