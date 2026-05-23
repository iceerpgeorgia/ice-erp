/**
 * Backfill rs_waybills_in_api from RS.ge API year-by-year.
 * Calls the local dev server sync endpoint for each year 2020–2026.
 *
 * Usage: node _backfill_waybills_from_api.js
 * Requires: dev server running on localhost:3001 (or 3000)
 */

require('dotenv').config({ path: '.env.local' });

const PORT = process.env.PORT || 3001;
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.error('CRON_SECRET not found in .env.local');
  process.exit(1);
}

// Build monthly ranges. Only process months not already covered in rs_waybills_in_api.
// Pass --from YYYY-MM and/or --to YYYY-MM args to restrict the range.
function buildMonthlyRanges(fromYear, fromMonth, toYear, toMonth) {
  const ranges = [];
  let y = fromYear, m = fromMonth;
  while (y < toYear || (y === toYear && m <= toMonth)) {
    const lastDay = new Date(y, m, 0).getDate(); // day 0 of next month = last day of this month
    const mm = String(m).padStart(2, '0');
    ranges.push({
      label: `${y}-${mm}`,
      begin: `${y}-${mm}-01T00:00:00`,
      end:   `${y}-${mm}-${String(lastDay).padStart(2, '0')}T23:59:59`,
    });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return ranges;
}

// Override via env: FROM_YEAR_MONTH=2020-01 TO_YEAR_MONTH=2026-05
const [fromY, fromM] = (process.env.FROM_YEAR_MONTH || '2020-01').split('-').map(Number);
const [toY, toM]     = (process.env.TO_YEAR_MONTH   || '2026-05').split('-').map(Number);

const RANGES = buildMonthlyRanges(fromY, fromM, toY, toM);

async function syncYear(range) {
  const url = `http://localhost:${PORT}/api/waybills/sync`;
  console.log(`\n[${range.label}] Calling sync: ${range.begin} → ${range.end}`);
  const start = Date.now();

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CRON_SECRET}`,
    },
    body: JSON.stringify({ begin_date: range.begin, end_date: range.end }),
    signal: AbortSignal.timeout(10 * 60 * 1000), // 10 min timeout per month
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} for ${range.label}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  console.log(`[${range.label}] Done in ${elapsed}s — imported: ${data.imported}, updated: ${data.updated}, message: ${data.message ?? '-'}`);
  return data;
}

async function main() {
  console.log(`\nStarting backfill on port ${PORT} — ${RANGES.length} monthly batches`);

  let totalImported = 0;
  let totalUpdated = 0;

  for (const range of RANGES) {
    try {
      const result = await syncYear(range);
      totalImported += result.imported ?? 0;
      totalUpdated += result.updated ?? 0;
    } catch (err) {
      console.error(`[${range.label}] ERROR:`, err.message);
      console.log(`[${range.label}] Continuing with next year...`);
    }
  }

  console.log(`\n=== Backfill complete ===`);
  console.log(`Total imported into rs_waybills_in: ${totalImported}`);
  console.log(`Total updated in rs_waybills_in:    ${totalUpdated}`);
  console.log(`(rs_waybills_in_api upserts are counted separately by the sync route)`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
