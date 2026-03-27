const { PrismaClient } = require('@prisma/client');
const Decimal = require('decimal.js');
const prisma = new PrismaClient();

(async () => {
  const records = require('./unconverted-records.json');
  
  console.log(`Fixing ${records.length} records with wrong nominal currency...\n`);

  // Load currencies
  const currencies = await prisma.$queryRaw`SELECT uuid::text, code FROM currencies`;
  const codeOf = new Map();
  for (const c of currencies) codeOf.set(c.uuid, c.code);

  const getRateField = (code) => `${code.toLowerCase()}_rate`;

  for (const rec of records) {
    const accountCode = rec.accountCurrency;
    const nominalCode = rec.paymentCurrency;
    const amount = new Decimal(rec.accountAmount);

    // Get effective date
    const txDate = rec.transactionDate instanceof Date 
      ? rec.transactionDate.toISOString().split('T')[0]
      : new Date(rec.transactionDate).toISOString().split('T')[0];
    const corrDate = rec.correctionDate 
      ? (rec.correctionDate instanceof Date 
          ? rec.correctionDate.toISOString().split('T')[0]
          : new Date(rec.correctionDate).toISOString().split('T')[0])
      : null;
    const effectiveDate = (corrDate && corrDate !== txDate) ? corrDate : txDate;

    console.log(`Record ${rec.table} id=${rec.id}: ${accountCode} -> ${nominalCode} on ${effectiveDate}`);

    // Get NBG rate
    const rates = await prisma.$queryRawUnsafe(
      `SELECT * FROM nbg_exchange_rates WHERE date = $1::date LIMIT 1`,
      effectiveDate
    );

    if (rates.length === 0) {
      console.log(`  SKIP: No exchange rate for ${effectiveDate}`);
      continue;
    }

    let exchangeRate, nominalAmount;

    if (accountCode === 'GEL') {
      const rateField = getRateField(nominalCode);
      const rate = rates[0][rateField];
      if (!rate) {
        console.log(`  SKIP: No ${rateField} in rates`);
        continue;
      }
      exchangeRate = new Decimal(rate.toString());
      nominalAmount = amount.mul(new Decimal(1).div(exchangeRate)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    } else if (nominalCode === 'GEL') {
      const rateField = getRateField(accountCode);
      const rate = rates[0][rateField];
      if (!rate) {
        console.log(`  SKIP: No ${rateField} in rates`);
        continue;
      }
      exchangeRate = new Decimal(rate.toString());
      nominalAmount = amount.mul(exchangeRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    } else {
      // Cross rate
      const accountRate = rates[0][getRateField(accountCode)];
      const nominalRate = rates[0][getRateField(nominalCode)];
      if (!accountRate || !nominalRate) {
        console.log(`  SKIP: Missing cross rates`);
        continue;
      }
      exchangeRate = new Decimal(accountRate.toString()).div(new Decimal(nominalRate.toString()));
      nominalAmount = amount.mul(new Decimal(1).div(exchangeRate)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    console.log(`  Rate: ${exchangeRate}, ${rec.accountAmount} ${accountCode} -> ${nominalAmount} ${nominalCode}`);

    // Apply the fix
    await prisma.$queryRawUnsafe(
      `UPDATE "${rec.table}" 
       SET nominal_currency_uuid = $1::uuid,
           exchange_rate = $2::numeric,
           nominal_amount = $3::numeric,
           updated_at = NOW()
       WHERE id = $4`,
      rec.paymentCurrencyUuid,
      exchangeRate.toString(),
      nominalAmount.toString(),
      BigInt(rec.id)
    );

    console.log(`  FIXED!\n`);
  }

  console.log('Done.');
  await prisma.$disconnect();
})();
