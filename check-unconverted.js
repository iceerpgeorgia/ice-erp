const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TABLES = [
  'GE78BG0000000893486000_BOG_GEL',
  'GE20BG0000000549486001_BOG_USD',
  'GE64BG0000000549486002_BOG_EUR',
  'GE78BG0000000549486000_BOG_GEL',
  'GE89BG0000000549486005_BOG_GBP',
];

(async () => {
  // First, get all payment currencies
  const payments = await prisma.$queryRaw`
    SELECT p.payment_id, c.code as currency_code, p.currency_uuid
    FROM payments p
    JOIN currencies c ON c.uuid = p.currency_uuid
    WHERE p.payment_id IS NOT NULL AND p.is_active = true
  `;
  const paymentCurrencyMap = new Map();
  for (const p of payments) {
    paymentCurrencyMap.set(p.payment_id, { code: p.currency_code, uuid: p.currency_uuid });
  }

  // Get all currencies
  const currencies = await prisma.$queryRaw`SELECT uuid::text, code FROM currencies`;
  const currCodeMap = new Map();
  for (const c of currencies) currCodeMap.set(c.uuid, c.code);

  const seen = new Set();
  let totalMismatch = 0;
  const mismatches = [];

  for (const table of TABLES) {
    if (seen.has(table)) continue;
    seen.add(table);
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT id, payment_id, account_currency_uuid, nominal_currency_uuid, 
                account_currency_amount, nominal_amount, exchange_rate, 
                transaction_date, correction_date
         FROM "${table}"
         WHERE payment_id IS NOT NULL 
           AND payment_id != ''
         ORDER BY id`
      );
      
      let tableMismatch = 0;
      for (const r of rows) {
        const paymentInfo = paymentCurrencyMap.get(r.payment_id);
        if (!paymentInfo) continue;
        
        const nominalCode = currCodeMap.get(r.nominal_currency_uuid);
        const accountCode = currCodeMap.get(r.account_currency_uuid);
        const paymentCode = paymentInfo.code;
        
        // Mismatch: nominal currency should be payment currency, but it's not
        if (nominalCode !== paymentCode) {
          tableMismatch++;
          mismatches.push({
            table,
            id: Number(r.id),
            paymentId: r.payment_id,
            accountCurrency: accountCode,
            nominalCurrency: nominalCode,
            paymentCurrency: paymentCode,
            accountAmount: r.account_currency_amount?.toString(),
            nominalAmount: r.nominal_amount?.toString(),
            exchangeRate: r.exchange_rate?.toString(),
            transactionDate: r.transaction_date,
            correctionDate: r.correction_date,
            paymentCurrencyUuid: paymentInfo.uuid,
          });
        }
      }
      
      console.log(`${table}: ${rows.length} with payment_id, ${tableMismatch} with wrong nominal currency`);
      totalMismatch += tableMismatch;
    } catch(e) {
      console.log(`${table}: error - ${e.message?.substring(0, 80)}`);
    }
  }

  console.log(`\nTotal mismatches: ${totalMismatch}`);
  if (mismatches.length > 0) {
    console.log('\nDetails:');
    for (const m of mismatches) {
      console.log(`  ${m.table} id=${m.id} payment=${m.paymentId} acct=${m.accountCurrency} nominal=${m.nominalCurrency} should_be=${m.paymentCurrency} amount=${m.accountAmount} nominal_amt=${m.nominalAmount} rate=${m.exchangeRate}`);
    }
  }

  // Output as JSON for the fix script
  if (mismatches.length > 0) {
    require('fs').writeFileSync('unconverted-records.json', JSON.stringify(mismatches, null, 2));
    console.log('\nSaved to unconverted-records.json');
  }

  await prisma.$disconnect();
})();
