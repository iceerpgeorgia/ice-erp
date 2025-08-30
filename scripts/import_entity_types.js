// scripts/import_entity_types.js
/* Usage:
   node scripts/import_entity_types.js ./entity_types.xlsx
*/
const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function cleanStr(v) {
  if (v == null) return "";
  return String(v)
    .replace(/\u00A0/g, " ")         // NBSP -> space
    .replace(/\u200B|\u200C|\u200D/g, "") // zero-width chars
    .replace(/\s+/g, " ")            // collapse whitespace
    .trim();
}

function toCode(nameEn, fallback = "ET") {
  const base = cleanStr(nameEn) || fallback;
  let code = base
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")   // drop punctuation/diacritics leftovers
    .replace(/\s+/g, "_")       // spaces -> underscore
    .toUpperCase();
  code = code.replace(/^_+|_+$|_{2,}/g, "_");
  return code || fallback;
}

function truthy(v) {
  if (v == null) return true; // default true
  const s = String(v).trim().toLowerCase();
  return ["1", "true", "yes", "y", "t"].includes(s);
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj[k] != null) out[k] = obj[k];
  return out;
}

async function main() {
  const inputPathArg = process.argv[2] || "./entity_types.xlsx";
  const inputPath = path.resolve(process.cwd(), inputPathArg);
  if (!fs.existsSync(inputPath)) {
    console.error(`✖ File not found: ${inputPath}`);
    process.exit(1);
  }

  console.log(`📖 Reading: ${path.relative(process.cwd(), inputPath)}`);
  const wb = XLSX.readFile(inputPath);
  const wsName = wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  const rowsRaw = XLSX.utils.sheet_to_json(ws, { defval: "" });

  // Normalize headers we care about
  const rows = rowsRaw.map((r) => {
    // Accept a few header spellings just in case
    const name_en = cleanStr(r.name_en ?? r["nameEn"] ?? r["NameEN"] ?? r["Name (EN)"]);
    const name_ka = cleanStr(r.name_ka ?? r["nameKa"] ?? r["NameKA"] ?? r["Name (KA)"]);
    const entity_type_uuid = cleanStr(
      r.entity_type_uuid ?? r.entity_uuid ?? r["EntityUUID"] ?? r["entityUuid"]
    );
    const code = cleanStr(r.code ?? r.Code ?? "");
    const is_active = truthy(r.is_active ?? r.active ?? r.Active ?? "");
    return { name_en, name_ka, entity_type_uuid, code, is_active };
  });

  console.log(`➡ Found ${rows.length} rows on sheet "${wsName}"`);

  let created = 0, updated = 0, skipped = 0, errors = 0;
  const seenCodes = new Set();

  await prisma.$transaction(async (tx) => {
    for (const [i, row] of rows.entries()) {
      try {
        const name_en = row.name_en;
        const name_ka = row.name_ka;
        const uuid = row.entity_type_uuid || null;

        // require at least a name
        if (!name_en && !name_ka) {
          skipped++;
          continue;
        }

        // code (generate if missing)
        let code = row.code || toCode(name_en || name_ka, "ET");
        // Avoid duplicate codes within the same import batch
        let codeCandidate = code;
        let bump = 2;
        while (seenCodes.has(codeCandidate)) {
          codeCandidate = `${code}_${bump++}`;
        }
        code = codeCandidate;
        seenCodes.add(code);

        const dataToWrite = {
          code,
          name_en,
          name_ka,
          is_active: !!row.is_active,
        };

        // Prefer stable upsert by unique UUID if present; else by unique code
        if (uuid) {
          await tx.entityType.upsert({
            where: { entity_type_uuid: uuid },
            update: pick(dataToWrite, ["code", "name_en", "name_ka", "is_active"]),
            create: { ...dataToWrite, entity_type_uuid: uuid },
          });
        } else {
          await tx.entityType.upsert({
            where: { code },
            update: pick(dataToWrite, ["name_en", "name_ka", "is_active"]),
            create: dataToWrite, // Prisma will generate uuid default
          });
        }

        // If it existed already we can't easily tell from upsert alone; do a light check:
        const exists = await tx.entityType.findFirst({
          where: uuid ? { entity_type_uuid: uuid } : { code },
          select: { id: true, createdAt: true, updatedAt: true },
        });
        // Heuristic: if createdAt === updatedAt it was likely created just now
        if (exists && exists.createdAt.getTime() === exists.updatedAt.getTime()) {
          created++;
        } else {
          updated++;
        }
      } catch (err) {
        errors++;
        console.warn("⚠ Row failed:", {
          i,
          entity_type_uuid: row.entity_type_uuid,
          code: row.code,
          err: String(err),
        });
      }
    }
  });

  console.log(`\n✅ Done. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
