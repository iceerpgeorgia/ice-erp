// Read CRON_SECRET from pulled env
const fs = require("fs");
const envLines = fs.readFileSync(".env.rs.local", "utf8").split("\n");
const cronLine = envLines.find(l => l.startsWith("CRON_SECRET="));
const CRON_SECRET = cronLine?.replace(/^CRON_SECRET=["']?/, "").replace(/["']?\s*$/, "");
if (!CRON_SECRET) { console.error("CRON_SECRET not found"); process.exit(1); }

const PROD = "https://ice-erp.vercel.app";

(async () => {
  const res = await fetch(`${PROD}/api/waybills/backfill-items?raw=true&from=2026-05&to=2026-05`, {
    method: "POST",
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  const json = await res.json();
  if (!res.ok) { console.error("HTTP", res.status, json); return; }

  // Show first 3000 chars of raw XML to inspect field names
  const raw = typeof json.raw === "string" ? json.raw : JSON.stringify(json);
  console.log("Month:", json.month, "Insider:", json.insider_uuid);
  console.log("\nRaw XML (first 3000 chars):\n", raw.slice(0, 3000));
})().catch(e => console.error(e.message));


