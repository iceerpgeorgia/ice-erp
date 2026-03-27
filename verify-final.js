const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Check remaining unconverted records (Variant B)
  const remaining = await p.$queryRawUnsafe(`
    SELECT COUNT(*) as cnt FROM "GE78BG0000000893486000_BOG_GEL"
    WHERE payment_id IS NOT NULL 
      AND payment_id != ''
      AND nominal_currency_uuid != account_currency_uuid
      AND (exchange_rate IS NULL OR exchange_rate = 1 OR nominal_amount = account_currency_amount)
  `);
  console.log('Remaining unconverted (Variant B):', Number(remaining[0].cnt));

  // Check remaining wrong currency (Variant A)
  const variantA = await p.$queryRawUnsafe(`
    SELECT COUNT(*) as cnt FROM "GE78BG0000000893486000_BOG_GEL" d
    JOIN payments p2 ON d.payment_id = p2.payment_id
    WHERE d.nominal_currency_uuid = d.account_currency_uuid
      AND p2.currency_uuid != d.account_currency_uuid
  `);
  console.log('Remaining wrong currency (Variant A):', Number(variantA[0].cnt));

  // Verify record 53160 specifically
  const r53160 = await p.$queryRawUnsafe(`
    SELECT id, account_currency_amount, nominal_amount, exchange_rate
    FROM "GE78BG0000000893486000_BOG_GEL" WHERE id = 53160
  `);
  console.log('Record 53160:', {
    id: Number(r53160[0].id),
    account_amount: r53160[0].account_currency_amount,
    nominal_amount: r53160[0].nominal_amount,
    exchange_rate: r53160[0].exchange_rate,
    converted: r53160[0].nominal_amount !== r53160[0].account_currency_amount
  });

  await p.$disconnect();
})();
