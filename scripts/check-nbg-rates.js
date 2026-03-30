require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const rates = await p.$queryRawUnsafe(`
    SELECT date, usd_rate, eur_rate FROM nbg_exchange_rates 
    WHERE date BETWEEN '2026-03-25' AND '2026-03-27'
    ORDER BY date
  `);
  
  console.log('=== NBG RATES 2026-03-25 to 2026-03-27 ===');
  if (rates.length === 0) {
    console.log('NO RATES FOUND!');
  } else {
    rates.forEach(r => console.log(r.date, 'USD=' + r.usd_rate, 'EUR=' + r.eur_rate));
  }

  const latest = await p.$queryRawUnsafe(`
    SELECT date, usd_rate, eur_rate FROM nbg_exchange_rates ORDER BY date DESC LIMIT 1
  `);
  console.log('\nLatest available rate:', latest[0]?.date, 'USD=' + latest[0]?.usd_rate);

  await p.$disconnect();
})();
