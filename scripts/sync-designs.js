"use strict";

// Fetch table design(s) from Supabase and write to local design/*.table.json
// Usage:
//   node scripts/sync-designs.js countries
//   node scripts/sync-designs.js countries entity_types counteragents

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function getEnv(name, required = false) {
  const v = process.env[name];
  if (required && !v) throw new Error(`${name} is required`);
  return v;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: node scripts/sync-designs.js <slug> [slug2] ...");
    process.exit(1);
  }

  const url = getEnv("SUPABASE_URL", true);
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("SUPABASE_ANON_KEY", true);
  const table = getEnv("SUPABASE_DESIGNS_TABLE") || "table_designs";
  const slugField = getEnv("SUPABASE_DESIGNS_SLUG_FIELD") || "slug";
  const configField = getEnv("SUPABASE_DESIGNS_CONFIG_FIELD") || "config";

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const outDir = path.join(process.cwd(), "design");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const slug of args) {
    const { data, error } = await supabase
      .from(table)
      .select(`${slugField}, ${configField}`)
      .eq(slugField, slug)
      .single();
    if (error || !data) {
      console.error(`[skip] ${slug}: not found (${error?.message || "no row"})`);
      continue;
    }
    let cfg = data[configField];
    if (!cfg) {
      console.error(`[skip] ${slug}: row has no ${configField}`);
      continue;
    }
    if (typeof cfg === "string") {
      try { cfg = JSON.parse(cfg); } catch {}
    }
    const file = path.join(outDir, `${slug}.table.json`);
    fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
    console.log(`[ok] wrote ${file}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

