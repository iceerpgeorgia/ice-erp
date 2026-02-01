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
    const is_active = truthy(r.is_active ?? r.active ?? r.Active ?? "");
    return { name_en, name_ka, entity_type_uuid, is_active };
  });

  console.log(`➡ Found ${rows.length} rows on sheet "${wsName}"`);

  let created = 0, updated = 0, skipped = 0, errors = 0;
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

        const dataToWrite = {
          name_en,
          name_ka,
          is_active: !!row.is_active,
        };

        // Prefer stable upsert by unique UUID if present; else by name fields
        if (uuid) {
          await tx.entityType.upsert({
            where: { entity_type_uuid: uuid },
            update: pick(dataToWrite, ["name_en", "name_ka", "is_active"]),
            create: { ...dataToWrite, entity_type_uuid: uuid },
          });
        } else {
          const existing = await tx.entityType.findFirst({
            where: { name_en, name_ka },
            select: { id: true },
          });
          if (existing) {
            await tx.entityType.update({
              where: { id: existing.id },
              data: pick(dataToWrite, ["name_en", "name_ka", "is_active"]),
            });
          } else {
            await tx.entityType.create({
              data: dataToWrite,
            });
          }
        }

        // If it existed already we can't easily tell from upsert alone; do a light check:
        const exists = await tx.entityType.findFirst({
          where: uuid ? { entity_type_uuid: uuid } : { name_en, name_ka },
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
