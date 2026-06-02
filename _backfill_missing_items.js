/**
 * _backfill_missing_items.js
 *
 * Backfills waybill items for the 16 waybills that were missed by the bulk sync.
 * Uses the per-waybill get_waybill SOAP API (more reliable for specific waybills).
 *
 * Usage: node --require dotenv/config _backfill_missing_items.js
 */

const { PrismaClient } = require('./node_modules/@prisma/client');
const { parseStringPromise } = require('./node_modules/xml2js');

const prisma = new PrismaClient();

const SOAP_URL = 'https://services.rs.ge/WaybillService/WaybillService.asmx';

const MISSING_RS_IDS = [
  '658299815',  // 0626162613 - 2021-10
  '686995278',  // 0653652852 - 2022-03
  '690075930',  // 0656588340 - 2022-03
  '703657779',  // 0669638771 - 2022-06
  '705429418',  // 0671345125 - 2022-06
  '709628638',  // 0675388881 - 2022-06
  '753677464',  // 0718076065 - 2023-01
  '809813913',  // 0772402169 - 2023-10
  '810755990',  // 0773329299 - 2023-10
  '827087233',  // 0789142546 - 2023-12
  '850845148',  // 0812109702 - 2024-04
  '899938850',  // 0860384031 - 2024-11
  '902771907',  // 0863155083 - 2024-11
  '902772452',  // 0863155627 - 2024-11
  '985243762',  // 0945097554 - 2025-12
  '986803615',  // 0946645721 - 2025-12
];

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function getWaybillGoods(su, sp, waybillId) {
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <get_waybill xmlns="http://tempuri.org/">
      <su>${escapeXml(su)}</su>
      <sp>${escapeXml(sp)}</sp>
      <waybill_id>${escapeXml(waybillId)}</waybill_id>
    </get_waybill>
  </soap:Body>
</soap:Envelope>`;

  const res = await fetch(SOAP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: '"http://tempuri.org/get_waybill"',
    },
    body: envelope,
  });

  if (!res.ok) throw new Error(`RS.ge HTTP ${res.status}`);
  const text = await res.text();

  const faultMatch = text.match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/);
  if (faultMatch) throw new Error(`RS.ge SOAP fault: ${faultMatch[1].trim()}`);

  const resultMatch = text.match(/<get_waybillResult[^>]*>([\s\S]*?)<\/get_waybillResult>/);
  if (!resultMatch) return [];

  const innerXml = resultMatch[1]
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");

  let parsed;
  try { parsed = await parseStringPromise(innerXml, { explicitArray: true }); }
  catch { return []; }

  const rootKey = Object.keys(parsed)[0] ?? '';
  const rootObj = parsed[rootKey] ?? {};
  const waybillArr = rootObj['WAYBILL'] ?? [];
  if (!waybillArr.length) return [];
  const waybill = waybillArr[0] ?? {};
  const goodsList = waybill['GOODS_LIST']?.[0]?.['GOODS'] ?? [];

  const pick = (obj, ...keys) => {
    for (const k of keys) {
      const v = obj[k];
      if (Array.isArray(v) && v.length > 0) return String(v[0]).trim() || null;
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return null;
  };

  return goodsList.map((g) => ({
    goods_name: pick(g, 'W_NAME'),
    goods_code: pick(g, 'BAR_CODE'),
    unit_id: pick(g, 'UNIT_ID'),
    unit_txt: pick(g, 'UNIT_TXT'),
    quantity: pick(g, 'QUANTITY'),
    unit_price: pick(g, 'PRICE'),
    total_price: pick(g, 'AMOUNT'),
  }));
}

function getRsCredentials() {
  // Try multi-credential map first
  const mapJson = process.env.RS_CREDENTIALS_MAP;
  if (mapJson) {
    try {
      const arr = JSON.parse(mapJson);
      if (Array.isArray(arr) && arr.length > 0) return arr[0];
    } catch { /* fall through */ }
  }
  // Fallback to single credential env vars
  const su = process.env.RS_API_SU;
  const sp = process.env.RS_API_SP;
  if (su && sp) return { su, sp, insiderUuid: null };
  throw new Error('No RS API credentials found in environment');
}

async function main() {
  const cred = getRsCredentials();
  console.log(`Using credentials: ${cred.su?.split(':')[0]}:*** insiderUuid=${cred.insiderUuid}`);

  // Load waybill metadata for all missing rs_ids
  const waybillMeta = await prisma.rs_waybills_in_api.findMany({
    where: { rs_id: { in: MISSING_RS_IDS } },
    select: {
      rs_id: true,
      waybill_no: true,
      insider_uuid: true,
      type: true,
      create_date: true,
      activation_time: true,
      transportation_beginning_time: true,
      cancellation_time: true,
      counteragent_inn: true,
      counteragent_name: true,
      departure_address: true,
      shipping_address: true,
      driver: true,
      driver_id: true,
      vehicle: true,
      transportation_sum: true,
      sum: true,
    },
  });

  const metaMap = new Map(waybillMeta.map((w) => [w.rs_id, w]));

  // Load unit→dimension_uuid map
  const unitDimRows = await prisma.rs_unit_dimension_map.findMany({
    where: { dimension_uuid: { not: null } },
    select: { unit_text: true, dimension_uuid: true },
  });
  const unitDimMap = new Map(
    unitDimRows.filter(r => r.dimension_uuid).map(r => [r.unit_text, r.dimension_uuid])
  );

  const batchId = `per-waybill-${Date.now()}`;
  let totalInserted = 0;
  let totalSkipped = 0;
  const errors = [];

  for (const rsId of MISSING_RS_IDS) {
    const meta = metaMap.get(rsId);
    if (!meta) {
      console.log(`  [SKIP] rs_id=${rsId}: not found in DB`);
      totalSkipped++;
      continue;
    }

    console.log(`Processing rs_id=${rsId} (waybill_no=${meta.waybill_no})...`);

    try {
      const goods = await getWaybillGoods(cred.su, cred.sp, rsId);
      console.log(`  -> ${goods.length} goods items from RS.ge`);

      if (goods.length === 0) {
        console.log(`  [SKIP] No goods returned by RS.ge`);
        totalSkipped++;
        continue;
      }

      const records = goods.map((g) => ({
        rs_id: rsId,
        waybill_no: meta.waybill_no ?? null,
        insider_uuid: meta.insider_uuid ?? null,
        import_batch_id: batchId,
        // Waybill-level fields from rs_waybills_in_api
        type: meta.type ?? null,
        create_date: meta.create_date ?? null,
        activate_date: meta.activation_time ?? null,
        begin_date: meta.transportation_beginning_time ?? null,
        cancel_date: meta.cancellation_time ?? null,
        seller_tin: meta.counteragent_inn ?? null,
        seller_name: meta.counteragent_name ?? null,
        start_address: meta.departure_address ?? null,
        end_address: meta.shipping_address ?? null,
        driver_name: meta.driver ?? null,
        driver_tin: meta.driver_id ?? null,
        car_number: meta.vehicle ?? null,
        transport_cost: meta.transportation_sum ? Number(meta.transportation_sum) : null,
        full_amount: meta.sum ? Number(meta.sum) : null,
        // Goods-level fields from getWaybill
        goods_name: g.goods_name,
        goods_code: g.goods_code,
        unit_id: g.unit_id,
        unit: g.unit_txt ?? null,
        quantity: g.quantity ? parseFloat(g.quantity) : null,
        unit_price: g.unit_price ? parseFloat(g.unit_price) : null,
        total_price: g.total_price ? parseFloat(g.total_price) : null,
        dimension_uuid: g.unit_txt ? (unitDimMap.get(g.unit_txt) ?? null) : null,
      }));

      const result = await prisma.rs_waybills_in_items.createMany({
        data: records,
        skipDuplicates: true,
      });

      console.log(`  [OK] Inserted ${result.count} items`);
      totalInserted += result.count;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  [ERROR] rs_id=${rsId}: ${msg}`);
      errors.push(`${rsId}: ${msg}`);
      totalSkipped++;
    }

    // Small delay to be polite to RS.ge
    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total inserted: ${totalInserted}`);
  console.log(`Skipped: ${totalSkipped}`);
  if (errors.length) {
    console.log(`Errors (${errors.length}):`);
    errors.forEach(e => console.log(`  ${e}`));
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
