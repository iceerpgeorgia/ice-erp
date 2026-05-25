/**
 * Backfill rs_waybills_in_items from RS.ge API.
 *
 * Fetches goods/line-items for every waybill in rs_waybills_in_api that has
 * no items yet and inserts them into rs_waybills_in_items.
 *
 * Usage:
 *   node _backfill_waybill_items.js              # skip waybills already with items
 *   node _backfill_waybill_items.js --force       # overwrite all existing items
 *   node _backfill_waybill_items.js --limit 10    # test with 10 waybills only
 *   node _backfill_waybill_items.js --insider <uuid>  # one insider only
 */

const { Client } = require('pg');
const { parseStringPromise } = require('xml2js');
require('dotenv').config({ path: '.env.local' });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SOAP_URL = 'https://services.rs.ge/WaybillService/WaybillService.asmx';
const CONCURRENCY = 3;
const DELAY_MS = 150;

const args = process.argv.slice(2);
const force = args.includes('--force');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : null;
const insiderIdx = args.indexOf('--insider');
const insiderFilter = insiderIdx >= 0 ? args[insiderIdx + 1] : null;

// ---------------------------------------------------------------------------
// Parse credentials
// ---------------------------------------------------------------------------
function getCredMap() {
  const raw = process.env.RS_CREDENTIALS_MAP;
  if (!raw) {
    console.error('RS_CREDENTIALS_MAP not set in .env.local');
    process.exit(1);
  }
  try {
    const arr = JSON.parse(raw.replace(/^'|'$/g, ''));
    return arr.map((c) => ({
      insiderUuid: c.INSIDER_UUID || c.insiderUuid,
      su: (c.RS_API_SU || c.su || '').replace(/^[^:]+:/, ''),   // strip "iceapi:" prefix if present
      sp: c.RS_API_SP || c.sp,
      raw_su: c.RS_API_SU || c.su,  // full username as passed to SOAP
    }));
  } catch (e) {
    console.error('Failed to parse RS_CREDENTIALS_MAP:', e.message);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// SOAP helpers
// ---------------------------------------------------------------------------
function escapeXml(v) {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function getGoodsByWaybillId(su, sp, waybillId) {
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <get_goods_by_waybill_id xmlns="http://tempuri.org/">
      <su>${escapeXml(su)}</su>
      <sp>${escapeXml(sp)}</sp>
      <waybill_id>${escapeXml(String(waybillId))}</waybill_id>
    </get_goods_by_waybill_id>
  </soap:Body>
</soap:Envelope>`;

  const res = await fetch(SOAP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: '"http://tempuri.org/get_goods_by_waybill_id"',
    },
    body: envelope,
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();

  const faultMatch = text.match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/);
  if (faultMatch) throw new Error(`SOAP fault: ${faultMatch[1].trim()}`);

  const resultMatch = text.match(
    /<get_goods_by_waybill_idResult[^>]*>([\s\S]*?)<\/get_goods_by_waybill_idResult>/,
  );
  if (!resultMatch) return [];

  const inner = resultMatch[1]
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");

  if (/^-?\d+$/.test(inner.trim())) return []; // error code from rs.ge

  let parsed;
  try {
    parsed = await parseStringPromise(inner, { explicitArray: true });
  } catch {
    return [];
  }

  const rootKey = Object.keys(parsed)[0] ?? '';
  const rootObj = parsed[rootKey] ?? {};
  const childKey = Object.keys(rootObj).find((k) => Array.isArray(rootObj[k])) ?? '';
  const goodsArray = rootObj[childKey] ?? [];

  function pick(obj, ...keys) {
    for (const k of keys) {
      const v = obj[k];
      if (Array.isArray(v) && v.length > 0) return String(v[0]).trim() || null;
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return null;
  }

  return goodsArray.map((g) => ({
    goods_name: pick(g, 'PROD_NAME', 'prod_name', 'ProdName', 'NAME', 'name'),
    goods_code: pick(g, 'BAR_CODE', 'bar_code', 'BarCode', 'PROD_CODE', 'prod_code'),
    unit: pick(g, 'UNIT_OF_MEASURE', 'unit_of_measure', 'UnitOfMeasure', 'UNIT', 'unit'),
    quantity: pick(g, 'QUANTITY', 'quantity', 'Quantity'),
    unit_price: pick(g, 'PRICE', 'price', 'Price'),
    total_price: pick(g, 'AMOUNT', 'amount', 'Amount', 'TOTAL', 'total'),
    taxation: pick(g, 'EXCISE', 'excise', 'Excise', 'TAXATION', 'taxation'),
  }));
}

// ---------------------------------------------------------------------------
// Concurrency helper
// ---------------------------------------------------------------------------
async function processBatch(items, concurrency, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const slice = items.slice(i, i + concurrency);
    const batch = await Promise.allSettled(slice.map(fn));
    for (const r of batch) {
      results.push(r.status === 'fulfilled' ? r.value : { inserted: 0, error: r.reason?.message });
    }
    if (i + concurrency < items.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const credMap = getCredMap();
  const credsByInsider = new Map(credMap.map((c) => [c.insiderUuid, c]));

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  console.log('Connected to DB');

  // Fetch waybills
  let query = `SELECT rs_id, waybill_no, insider_uuid FROM rs_waybills_in_api WHERE rs_id IS NOT NULL`;
  const params = [];
  if (insiderFilter) {
    params.push(insiderFilter);
    query += ` AND insider_uuid = $${params.length}`;
  }
  query += ` ORDER BY synced_at ASC`;
  if (limit) {
    params.push(limit);
    query += ` LIMIT $${params.length}`;
  }

  const { rows: waybills } = await db.query(query, params);
  console.log(`Found ${waybills.length} waybills in rs_waybills_in_api`);

  // Skip those already with items (unless --force)
  let toProcess = waybills;
  if (!force) {
    const { rows: existing } = await db.query(
      `SELECT DISTINCT rs_id FROM rs_waybills_in_items WHERE rs_id IS NOT NULL`,
    );
    const existingSet = new Set(existing.map((r) => r.rs_id));
    toProcess = waybills.filter((w) => !existingSet.has(w.rs_id));
    console.log(`Skipping ${waybills.length - toProcess.length} already-backfilled. Processing ${toProcess.length}`);
  } else {
    console.log(`--force: processing all ${toProcess.length} waybills`);
  }

  if (toProcess.length === 0) {
    console.log('Nothing to do.');
    await db.end();
    return;
  }

  const batchId = `backfill-${Date.now()}`;
  let totalInserted = 0;
  let totalErrors = 0;
  let done = 0;

  // Group by insider
  const byInsider = new Map();
  for (const w of toProcess) {
    const key = w.insider_uuid ?? '__unknown__';
    if (!byInsider.has(key)) byInsider.set(key, []);
    byInsider.get(key).push(w);
  }

  for (const [insiderUuid, group] of byInsider) {
    const cred = credsByInsider.get(insiderUuid);
    if (!cred) {
      console.warn(`No credentials for insider ${insiderUuid} — skipping ${group.length} waybills`);
      done += group.length;
      continue;
    }
    console.log(`\nInsider ${insiderUuid}: ${group.length} waybills, user=${cred.raw_su}`);

    const results = await processBatch(group, CONCURRENCY, async (w) => {
      try {
        const goods = await getGoodsByWaybillId(cred.raw_su, cred.sp, w.rs_id);
        if (goods.length === 0) {
          process.stdout.write('.');
          return { inserted: 0, error: null };
        }

        // If force, delete existing items first
        if (force) {
          await db.query(`DELETE FROM rs_waybills_in_items WHERE rs_id = $1`, [w.rs_id]);
        }

        // Insert all goods for this waybill
        for (const g of goods) {
          await db.query(
            `INSERT INTO rs_waybills_in_items
               (rs_id, waybill_no, insider_uuid, goods_name, goods_code, unit,
                quantity, unit_price, total_price, taxation, import_batch_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
              w.rs_id,
              w.waybill_no,
              insiderUuid === '__unknown__' ? null : insiderUuid,
              g.goods_name,
              g.goods_code,
              g.unit,
              g.quantity ? parseFloat(g.quantity) : null,
              g.unit_price ? parseFloat(g.unit_price) : null,
              g.total_price ? parseFloat(g.total_price) : null,
              g.taxation,
              batchId,
            ],
          );
        }

        done++;
        process.stdout.write(`+${goods.length}`);
        return { inserted: goods.length, error: null };
      } catch (err) {
        done++;
        process.stdout.write('E');
        return { inserted: 0, error: err.message };
      }
    });

    for (const r of results) {
      totalInserted += r.inserted;
      if (r.error) {
        totalErrors++;
        console.error(`\n  Error: ${r.error}`);
      }
    }
  }

  console.log(`\n\nDone. Items inserted: ${totalInserted}, errors: ${totalErrors}`);
  console.log(`Batch ID: ${batchId}`);
  await db.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
