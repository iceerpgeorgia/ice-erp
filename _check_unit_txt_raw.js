/**
 * Call production backfill-items with raw=true to inspect if UNIT_TXT
 * appears in get_buyer_waybilll_goods_list response.
 */
const fs = require('fs');
const envLines = fs.readFileSync('.env.rs.local', 'utf8').split('\n');
const cronLine = envLines.find(l => l.startsWith('CRON_SECRET='));
const CRON_SECRET = cronLine?.replace(/^CRON_SECRET=["']?/, '').replace(/["']?\s*$/, '');

(async () => {
  // Use a month we know has ID=99 items
  const url = 'https://ice-erp.vercel.app/api/waybills/backfill-items?raw=true&from=2024-01&to=2024-01';
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  const json = await res.json();
  const raw = json.raw ?? '';
  console.log('Status:', res.status);
  console.log('Month:', json.month);

  // Look for UNIT_TXT in response
  const hasTxt = raw.includes('UNIT_TXT');
  console.log('Has UNIT_TXT?', hasTxt);

  // Find first goods item with any unit info
  const firstGoods = raw.match(/<DETAIL>([\s\S]*?)<\/DETAIL>/);
  if (firstGoods) {
    console.log('\nFirst DETAIL block:');
    // Print just unit-related fields
    const block = firstGoods[1];
    const fields = ['UNIT_ID', 'UNIT_TXT', 'W_NAME', 'QUANTITY', 'PRICE'];
    for (const f of fields) {
      const m = block.match(new RegExp(`<${f}>(.*?)<\/${f}>`));
      if (m) console.log(`  ${f} = ${m[1]}`);
      else console.log(`  ${f} = (not found)`);
    }
  } else {
    // Maybe different tag name
    console.log('\nNo <DETAIL> tag. First 1500 chars of raw XML:');
    console.log(raw.slice(0, 1500));
  }
})();
