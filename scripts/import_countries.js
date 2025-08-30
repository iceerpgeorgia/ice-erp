// scripts/import_countries.js
/* Import countries from an .xlsx file into Postgres via Prisma.
   Usage:
     node scripts/import_countries.js ./countries.xlsx
   Notes:
     - Reads the FIRST worksheet.
     - Unique key priority: iso3 -> iso2 -> country_uuid.
     - Columns supported (case/space-insensitive): 
       name_en, name_ka, iso2, iso3, un_code, ts, created_at, updated_at, country_uuid
     - id and country are handled by DB (id autoinc, country via trigger).
*/


// Allow regular spaces and normalize odd whitespace (NBSP, zero-width, etc.)
const normalizeSpaces = (s) =>
  typeof s !== "string"
    ? s
    : s
        .normalize("NFC")
        .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g, " ") // turn weird spaces into normal space
        .replace(/\s+/g, " ")                                           // collapse runs of spaces
        .trim();

// Optional: if you validate names, allow spaces and common punctuation.
const NAME_OK = /^[\p{L}\p{M} .,'()-]+$/u; // letters (all langs) + spaces + simple punctuation




const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function normKey(k) {
  return String(k).trim().toLowerCase().replace(/[^\w]+/g, "_");
}

function toDateMaybe(v) {
  if (v == null || v === "") return undefined;
  if (v instanceof Date) return v;
  if (typeof v === "number") {
    // Excel serial date to JS Date (UTC midnight)
    const ms = Math.round((v - 25569) * 86400 * 1000);
    return new Date(ms);
  }
  const d = new Date(v);
  return isNaN(d) ? undefined : d;
}

function sanitizeRow(raw) {
  // map normalized keys -> values
  const obj = {};
  for (const [k, v] of Object.entries(raw)) obj[normKey(k)] = v;

  const data = {};
  if (obj.name_en != null) data.name_en = String(obj.name_en).trim();
  if (obj.name_ka != null) data.name_ka = String(obj.name_ka).trim();

  if (obj.iso2 != null) data.iso2 = String(obj.iso2).trim().toUpperCase().slice(0, 2);
  if (obj.iso3 != null) data.iso3 = String(obj.iso3).trim().toUpperCase().slice(0, 3);

  if (obj.un_code != null && obj.un_code !== "")
    data.un_code = Number(obj.un_code);

  // optional timestamps/uuid if present
  const ts = toDateMaybe(obj.ts);
  if (ts) data.ts = ts;

  const createdAt = toDateMaybe(obj.created_at);
  if (createdAt) data.created_at = createdAt;

  const updatedAt = toDateMaybe(obj.updated_at);
  if (updatedAt) data.updated_at = updatedAt;

  if (obj.country_uuid) data.country_uuid = String(obj.country_uuid).trim();

  // empty strings -> undefined so Prisma skips them
  for (const k of Object.keys(data)) {
    if (data[k] === "" || data[k] == null) delete data[k];
  }
  return data;
}

function pickWhereUnique(data) {
  if (data.iso3) return { iso3: data.iso3 };
  if (data.iso2) return { iso2: data.iso2 };
  if (data.country_uuid) return { country_uuid: data.country_uuid };
  return null;
}

async function main() {
  const file = process.argv[2] || path.join(process.cwd(), "countries.xlsx");
  if (!fs.existsSync(file)) {
    console.error(`❌ File not found: ${file}`);
    process.exit(1);
  }

  console.log(`📖 Reading: ${file}`);
  const wb = XLSX.readFile(file, { cellDates: true });
  const wsName = wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null }); // array of objects

  console.log(`➡ Found ${rows.length} rows on sheet "${wsName}"`);
  let created = 0, updated = 0, skipped = 0, errors = 0;

  // Process in small batches to avoid long transactions on Windows
  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);

    await prisma.$transaction(async (tx) => {
      for (const r of slice) {
        const data = sanitizeRow(r);
        const where = pickWhereUnique(data);

        // Basic sanity: need at least the names + one unique key for upsert/create
        if (!data.name_ka && !data.name_en) {
          skipped++;
          continue;
        }

        try {
          if (where) {
            // Build update object without touching the unique key we used for WHERE
            const update = { ...data };
            if (where.iso3) delete update.iso3;
            if (where.iso2) delete update.iso2;
            if (where.country_uuid) delete update.country_uuid;

            // Never update id or computed "country"
            delete update.id;
            delete update.country;

            await tx.country.upsert({
              where,
              create: data,
              update,
            });
            // Decide created vs updated by probing once
            const exists = await tx.country.findUnique({ where });
            if (exists) updated++; else created++;
          } else {
            // No unique key -> create; relying on DB uniques to throw if dup
            await tx.country.create({ data });
            created++;
          }
        } catch (e) {
          errors++;
          // Most common: unique violation with conflicting values.
          console.warn(`⚠ Row failed (maybe unique conflict):`, {
            iso3: data.iso3, iso2: data.iso2, country_uuid: data.country_uuid, err: e.code || e.message
          });
        }
      }
    });
  }

  console.log(`\n✅ Done. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
  console.log(`ℹ️  The "country" label is filled by your DB trigger; no need to supply it in Excel.`);
}

main()
  .catch((e) => {
    console.error("❌ Fatal:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
