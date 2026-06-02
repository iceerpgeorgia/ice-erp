// Fetch a specific waybill directly from RS.ge SOAP API and show ALL fields
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env.vercel.local', override: false });
const XLSX = require('xlsx');

// Get credentials
const credsRaw = process.env.RS_CREDENTIALS_MAP;
if (!credsRaw) { console.error('RS_CREDENTIALS_MAP not set'); process.exit(1); }
let creds;
try { creds = JSON.parse(credsRaw); } catch { console.error('bad RS_CREDENTIALS_MAP JSON'); process.exit(1); }
const { RS_API_SU: su, RS_API_SP: sp } = creds[0];

const SOAP_URL = 'https://services.rs.ge/WaybillService/WaybillService.asmx';

// --- Pick 5 xlsx rows with unit="მეტრი" ---
const wb = XLSX.readFile('RS.GE - WB_Items_IN.xlsx');
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
const meters = rows.filter(r => r['ზომის ერთეული'] === 'მეტრი');
// Pick a few unique waybill numbers
const picked = [];
const seen = new Set();
for (const r of meters) {
  const wbNo = String(r['ზედნადების ნომერი'] ?? '').trim();
  if (wbNo && !seen.has(wbNo)) {
    seen.add(wbNo);
    picked.push({ waybill_no: wbNo, goods_name: r['საქონლის დასახელება'], activate_date: r['გააქტიურების თარიღი'] });
    if (picked.length >= 5) break;
  }
}
console.log('Sample xlsx rows with unit=მეტრი:');
picked.forEach(r => console.log(`  WB:${r.waybill_no}  "${String(r.goods_name).slice(0,60)}"`));

// --- Call API for the first one ---
const target = picked[0];
const dateVal = target.activate_date;
// Excel serial date → JS date
const d = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
const from = new Date(d); from.setDate(from.getDate() - 1);
const to   = new Date(d); to.setDate(to.getDate() + 1);
const dt = (x) => x.toISOString().slice(0, 19);

const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <get_buyer_waybilll_goods_list xmlns="http://tempuri.org/">
      <su>${su}</su><sp>${sp}</sp>
      <itypes></itypes><seller_tin></seller_tin><statuses></statuses><car_number></car_number>
      <begin_date_s xsi:nil="true" /><begin_date_e xsi:nil="true" />
      <create_date_s>${dt(from)}</create_date_s>
      <create_date_e>${dt(to)}</create_date_e>
      <driver_tin></driver_tin>
      <delivery_date_s xsi:nil="true" /><delivery_date_e xsi:nil="true" />
      <full_amount xsi:nil="true" />
      <waybill_number>${target.waybill_no}</waybill_number>
      <close_date_s xsi:nil="true" /><close_date_e xsi:nil="true" />
      <s_user_ids></s_user_ids><comment></comment>
    </get_buyer_waybilll_goods_list>
  </soap:Body>
</soap:Envelope>`;

(async () => {
  console.log(`\nFetching WB ${target.waybill_no} from RS.ge SOAP API...`);
  const res = await fetch(SOAP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '"http://tempuri.org/get_buyer_waybilll_goods_list"' },
    body: envelope,
  });
  const text = await res.text();

  // Extract inner XML
  const m = text.match(/<get_buyer_waybilll_goods_listResult[^>]*>([\s\S]*?)<\/get_buyer_waybilll_goods_listResult>/);
  if (!m) { console.log('No result tag. Full response:\n', text.slice(0,1000)); return; }

  const inner = m[1].replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"');

  // Extract first WAYBILL block matching our target
  const waybills = [...inner.matchAll(/<WAYBILL>([\s\S]*?)<\/WAYBILL>/g)];
  const target_wb = waybills.find(w => w[1].includes(`<WAYBILL_NUMBER>${target.waybill_no}</WAYBILL_NUMBER>`));

  if (!target_wb) {
    console.log(`WB ${target.waybill_no} not found in response (${waybills.length} waybills returned)`);
    // Show first waybill anyway
    if (waybills.length > 0) {
      console.log('\nFirst waybill in response (raw XML):\n');
      console.log(waybills[0][0]);
    }
    return;
  }

  console.log(`\n=== ALL FIELDS from RS.ge API for WB ${target.waybill_no} ===\n`);
  // Parse all tags
  const tags = [...target_wb[1].matchAll(/<([A-Z_0-9]+)>([\s\S]*?)<\/\1>/g)];
  const maxLen = Math.max(...tags.map(t => t[1].length));
  for (const [, tag, val] of tags) {
    console.log(`  ${tag.padEnd(maxLen)}  ${val.trim()}`);
  }
})();
