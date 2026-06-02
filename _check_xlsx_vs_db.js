// Compare RS.GE - WB_Items_IN.xlsx against rs_waybills_in_items in DB
require('dotenv').config({ path: '.env.vercel.local' });
const XLSX = require('xlsx');
const { Client } = require('pg');

const SAMPLE_SIZE = 40;

// xlsx stores full unit names; DB stores abbreviations from RS_UNIT_MAP
// Build reverse map: full name → abbreviation (from rs_unit_dimension_map labels)
const UNIT_FULL_TO_ABBR = {
  'ცალი':       'ც',
  'კილოგრამი':  'კგ',
  'გრამი':      'გ',
  'ლიტრი':      'ლ',
  'მილილიტრი':  'მლ',
  'მეტრი':      'მ',
  'კილომეტრი':  'კმ',
  'მილიმეტრი':  'მმ',
  'კვ. მეტრი':  'მ²',
  'კვ.მეტრი':   'მ²',
  'კუბ. მეტრი': 'მ³',
  'კუბ.მეტრი':  'მ³',
  'ტონა':       'ტ',
  'კომპლექტი':  'კომ',
  'ყუთი':       'ყ',
  'ბოთლი':      'ბ',
  'პარტია':     'პ',
  'სხვა':       'სხვ',
  'წყვილი':     'წყვილი',
};

(async () => {
  // --- 1. Read xlsx ---
  const wb = XLSX.readFile('RS.GE - WB_Items_IN.xlsx');
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
  console.log(`Total rows in xlsx: ${rows.length}\n`);

  // --- 2. Pick random sample ---
  const shuffled = [...rows].sort(() => Math.random() - 0.5);
  const sample = shuffled.slice(0, SAMPLE_SIZE);

  // --- 3. Query DB ---
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  let matched = 0, unitMismatch = 0, notFound = 0, wbMissing = 0;

  for (const row of sample) {
    const wbNo      = String(row['ზედნადების ნომერი'] ?? '').trim();
    const goodsName = String(row['საქონლის დასახელება'] ?? '').trim();
    const xlsxUnitFull = String(row['ზომის ერთეული'] ?? '').trim();
    const xlsxQty   = row['რაოდ.'];
    const xlsxPrice = row['ერთეულის ფასი'];
    const xlsxTotal = row['საქონლის ფასი'];
    const goodsCode = row['საქონლის კოდი'];

    if (!wbNo) continue;

    // Convert full unit name to expected abbreviation
    const xlsxUnitAbbr = UNIT_FULL_TO_ABBR[xlsxUnitFull] ?? xlsxUnitFull;

    const dbRes = await db.query(
      `SELECT waybill_no, goods_name, unit, unit_id, quantity, unit_price, total_price, goods_code
       FROM rs_waybills_in_items
       WHERE waybill_no = $1
         AND goods_name = $2
       LIMIT 1`,
      [wbNo, goodsName]
    );

    if (dbRes.rows.length === 0) {
      // Check if any item exists for this waybill
      const wbCheck = await db.query(
        `SELECT COUNT(*) as cnt FROM rs_waybills_in_items WHERE waybill_no = $1`, [wbNo]
      );
      const cnt = parseInt(wbCheck.rows[0].cnt);
      if (cnt === 0) {
        wbMissing++;
        console.log(`NO WB    | ${wbNo} | "${goodsName.slice(0,50)}"`);
      } else {
        notFound++;
        console.log(`NO ITEM  | ${wbNo} (${cnt} items) | "${goodsName.slice(0,50)}" | unit="${xlsxUnitFull}"`);
      }
    } else {
      const r = dbRes.rows[0];
      const dbUnit = r.unit ?? '';
      const dbQty  = parseFloat(r.quantity);
      const dbPrice = parseFloat(r.unit_price);

      const unitOk  = dbUnit === xlsxUnitAbbr;
      const qtyOk   = xlsxQty  == null || Math.abs(dbQty - xlsxQty)  < 0.001;
      const priceOk = xlsxPrice == null || Math.abs(dbPrice - xlsxPrice) < 0.01;

      if (unitOk && qtyOk && priceOk) {
        matched++;
        console.log(`OK       | ${wbNo} | "${goodsName.slice(0,45)}" | unit="${dbUnit}" qty=${dbQty} price=${dbPrice}`);
      } else {
        unitMismatch++;
        const issues = [];
        if (!unitOk)  issues.push(`unit: xlsx="${xlsxUnitFull}"(→"${xlsxUnitAbbr}") db="${dbUnit}"(id=${r.unit_id})`);
        if (!qtyOk)   issues.push(`qty: xlsx=${xlsxQty} db=${dbQty}`);
        if (!priceOk) issues.push(`price: xlsx=${xlsxPrice} db=${dbPrice}`);
        console.log(`MISMATCH | ${wbNo} | "${goodsName.slice(0,40)}" | ${issues.join(' | ')}`);
      }
    }
  }

  await db.end();
  console.log(`\n--- SUMMARY (random sample of ${SAMPLE_SIZE}) ---`);
  console.log(`  OK:           ${matched}`);
  console.log(`  Mismatch:     ${unitMismatch}`);
  console.log(`  Item not found: ${notFound}`);
  console.log(`  Waybill missing: ${wbMissing}`);
})().catch(e => { console.error(e.message); process.exit(1); });
