const fs = require('fs');
const envLines = fs.readFileSync('.env.rs.local', 'utf8').split('\n');
const cronLine = envLines.find(l => l.startsWith('CRON_SECRET='));
const CRON_SECRET = cronLine?.replace(/^CRON_SECRET=["']?/, '').replace(/["']?\s*$/, '');
if (!CRON_SECRET) { console.error('CRON_SECRET not found'); process.exit(1); }

(async () => {
  const res = await fetch('https://ice-erp.vercel.app/api/waybills/debug-units', {
    method: 'POST',
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Body:', text.slice(0, 500));
  if (!res.ok) return;
  const json = JSON.parse(text);

  const xml = json.units_xml ?? '';
  if (!xml) { console.log('Empty units_xml. Full response:', JSON.stringify(json).slice(0, 500)); return; }

  // Protocol format: <WAYBILL_UNITS><WAYBILL_UNIT><ID>1</ID><NAME>ცალი</NAME></WAYBILL_UNIT>...</WAYBILL_UNITS>
  const units = [...xml.matchAll(/<WAYBILL_UNIT>([\.\s\S]*?)<\/WAYBILL_UNIT>/g)];
  if (!units.length) {
    // Fallback: try generic UNIT tags
    console.log('No <WAYBILL_UNIT> found. Raw XML (first 2000):\n', xml.slice(0, 2000));
    return;
  }

  console.log(`\n=== RS.ge Official Unit List (${units.length} entries) ===\n`);
  console.log('ID'.padEnd(6) + 'Name');
  console.log('-'.repeat(40));
  for (const [, block] of units) {
    const id   = (block.match(/<ID>(.*?)<\/ID>/)     ?? ['','?'])[1];
    const name = (block.match(/<NAME>(.*?)<\/NAME>/) ?? ['','?'])[1];
    console.log(id.padEnd(6) + name);
  }
})();
