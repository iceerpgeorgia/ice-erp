/**
 * Run the backfill-unit-txt endpoint to resolution.
 * Call repeatedly (pagination) until all ID=99 items have real UNIT_TXT.
 *
 * Usage:
 *   node _run_unit_txt_backfill.js            # live run, all insiders
 *   node _run_unit_txt_backfill.js --dry-run  # preview only
 */
const fs = require('fs');
const envLines = fs.readFileSync('.env.rs.local', 'utf8').split('\n');
const cronLine = envLines.find(l => l.startsWith('CRON_SECRET='));
const CRON_SECRET = cronLine?.replace(/^CRON_SECRET=["']?/, '').replace(/["']?\s*$/, '');
if (!CRON_SECRET) { console.error('CRON_SECRET not found'); process.exit(1); }

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT   = 80;
const BASE    = 'https://ice-erp.vercel.app/api/waybills/backfill-unit-txt';

(async () => {
  let offset = 0;
  let totalUpdated = 0;
  let round = 1;

  while (true) {
    const url = `${BASE}?limit=${LIMIT}&offset=${offset}${DRY_RUN ? '&dry_run=true' : ''}`;
    console.log(`\n--- Round ${round} (offset=${offset}) ---`);
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    if (!res.ok) {
      console.error('HTTP', res.status, await res.text().then(t => t.slice(0, 300)));
      break;
    }
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2));
    totalUpdated += json.updated_items ?? 0;

    if (!json.has_more) break;
    offset = json.next_offset ?? (offset + LIMIT);
    round++;
  }

  console.log(`\n=== Total items updated: ${totalUpdated} ===`);
})();
