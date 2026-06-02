// Full historical backfill of rs_waybills_in_items with correct unit labels
// Calls production endpoint year-by-year to stay within 300s Vercel limit
const fs = require("fs");

const envLines = fs.readFileSync(".env.rs.local", "utf8").split("\n");
const cronLine = envLines.find(l => l.startsWith("CRON_SECRET="));
const CRON_SECRET = cronLine?.replace(/^CRON_SECRET=["']?/, "").replace(/["']?\s*$/, "");
if (!CRON_SECRET) { console.error("CRON_SECRET not found in .env.rs.local"); process.exit(1); }

const PROD = "https://ice-erp.vercel.app";

async function backfillYear(year) {
  const from = `${year}-01`;
  const to   = `${year}-12`;
  const url  = `${PROD}/api/waybills/backfill-items?skip_existing=false&from=${from}&to=${to}`;
  console.log(`\n[${year}] POST ${url}`);
  const start = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const json = await res.json().catch(() => ({ error: "non-JSON response" }));
  if (!res.ok) {
    console.error(`  HTTP ${res.status} after ${elapsed}s:`, JSON.stringify(json).slice(0, 300));
    return false;
  }
  const { processed, inserted, deleted, errors, months } = json;
  console.log(`  OK ${elapsed}s | months=${months ?? "?"} processed=${processed ?? "?"} inserted=${inserted ?? "?"} deleted=${deleted ?? "?"} errors=${errors ?? 0}`);
  return true;
}

(async () => {
  const years = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
  let allOk = true;
  for (const year of years) {
    const ok = await backfillYear(year);
    if (!ok) allOk = false;
  }
  console.log(allOk ? "\n✓ All years backfilled successfully." : "\n✗ Some years failed — check output above.");
})();
