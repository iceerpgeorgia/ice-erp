// scripts/import_counteragents.js
// Usage:
//   node scripts/import_counteragents.js ./counteragents.xlsx
//   node scripts/import_counteragents.js --write-template ./counteragents_template.xlsx
//
// Accepts either "Form Field" headers or DB field names. Works from any sheet (default Sheet1).
//
// Requires: xlsx, @prisma/client

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const UUIDS = {
  ID_NOT_REQUIRED: new Set([
    "f5c3c745-eaa4-4e27-a73b-badc9ebb49c0",
    "7766e9c2-0094-4090-adf4-ef017062457f",
  ]),
  SEX_REQUIRED: new Set([
    "bf4d83f9-5064-4958-af6e-e4c21b2e4880",
    "5747f8e6-a8a6-4a23-91cc-c427c3a22597",
    "ba538574-e93f-4ce8-a780-667b61fc970a",
  ]),
  PENSION_REQUIRED: new Set([
    "bf4d83f9-5064-4958-af6e-e4c21b2e4880",
  ]),
  ID_11_DIGIT: new Set([
    "bf4d83f9-5064-4958-af6e-e4c21b2e4880",
    "470412f4-e2c0-4f9d-91f1-1c0630a02364",
    "ba538574-e93f-4ce8-a780-667b61fc970a",
  ]),
};

// Friendly → DB field mapping (supports multiple header aliases)
const MAP = {
  name: ["name", "Name"],
  identification_number: ["identification_number", "ID"],
  birth_or_incorporation_date: [
    "birth_or_incorporation_date",
    "Birth or Incorporation Date",
  ],
  entity_type: ["entity_type", "Entity Type"],
  entity_type_uuid: ["entity_type_uuid", "Entity Type UUID"],
  sex: ["sex", "Sex"],
  pension_scheme: ["pension_scheme", "Pension Scheme"],
  country: ["country", "Country"],
  country_uuid: ["country_uuid", "Country UUID"],
  address_line_1: ["address_line_1", "Address Line 1"],
  address_line_2: ["address_line_2", "Address Line 2"],
  zip_code: ["zip_code", "ZIP Code"],
  iban: ["iban", "IBAN"],
  swift: ["swift", "SWIFT"],
  director: ["director", "Director"],
  director_id: ["director_id", "Director ID"],
  email: ["email", "Email"],
  phone: ["phone", "Phone"],
  oris_id: ["oris_id", "ORIS ID"],
  internal_number: ["internal_number", "Internal Number"],
  counteragent_uuid: ["counteragent_uuid", "Counteragent UUID"],
};

const args = process.argv.slice(2);
if (!args.length) {
  console.log(
    "Usage:\n  node scripts/import_counteragents.js <file.xlsx> [--sheet=Sheet1]\n  node scripts/import_counteragents.js --write-template <out.xlsx>"
  );
  process.exit(0);
}

if (args[0] === "--write-template") {
  const out = args[1] || "counteragents_template.xlsx";
  writeTemplate(out);
  console.log(`Template written: ${out}`);
  process.exit(0);
}

const file = args[0];
const sheetArg = args.find((a) => a.startsWith("--sheet="));
const SHEET = sheetArg ? sheetArg.split("=")[1] : "Sheet1";

function norm(s) {
  return (s ?? "").toString().trim().toLowerCase();
}

function firstNonEmpty(row, keys) {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).toString().trim() !== "") return row[k];
  }
  return null;
}

function parseDate(any) {
  if (any == null || any === "") return null;
  // Accept Excel dates, ISO, or dd/MM/yyyy & dd.MM.yyyy
  if (typeof any === "number") {
    // Excel serial
    const d = XLSX.SSF.parse_date_code(any);
    if (!d) return null;
    return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  const s = String(any).trim();
  const iso = new Date(s);
  if (!isNaN(iso.getTime())) return iso;
  const m = s.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{4})$/);
  if (m) {
    const [_, dd, mm, yyyy] = m;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function asMaleFemale(v) {
  const n = norm(v);
  if (n === "male" || n === "m") return "Male";
  if (n === "female" || n === "f") return "Female";
  return null;
}

function asTrueFalse(v) {
  const n = norm(v);
  if (["true", "1", "yes", "y"].includes(n)) return "True";
  if (["false", "0", "no", "n"].includes(n)) return "False";
  return null;
}

function padICE(id) {
  return "ICE" + String(id).padStart(4, "0");
}

async function writeTemplate(outPath) {
  const wb = XLSX.utils.book_new();
  const headers = [
    "Name",
    "ID",
    "Birth or Incorporation Date",
    "Entity Type", // (name_ka from entity_types)
    "Sex", // Male/Female
    "Pension Scheme", // True/False
    "Country", // (country from countries)
    "Address Line 1",
    "Address Line 2",
    "ZIP Code",
    "IBAN",
    "SWIFT",
    "Director",
    "Director ID",
    "Email",
    "Phone",
    "ORIS ID",
    // Optionally:
    "Entity Type UUID",
    "Country UUID",
    "Counteragent UUID",
    "Internal Number",
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, outPath);
}

async function main() {
  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }

  // Prefetch lookups
  const [etRows, cRows] = await Promise.all([
    prisma.entityType.findMany({
      select: { entity_type_uuid: true, name_ka: true },
    }),
    prisma.country.findMany({
      select: { country_uuid: true, country: true },
    }),
  ]);
  const etByName = new Map(etRows.map((e) => [norm(e.name_ka), e.entity_type_uuid]));
  const etUuidSet = new Set(etRows.map((e) => e.entity_type_uuid));
  const cByName = new Map(cRows.map((c) => [norm(c.country), c.country_uuid]));
  const cUuidSet = new Set(cRows.map((c) => c.country_uuid));

  const wb = XLSX.readFile(file);
  const ws = wb.Sheets[SHEET] || wb.Sheets[wb.SheetNames[0]];
  if (!ws) {
    console.error("No worksheet found.");
    process.exit(1);
  }
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
  console.log(`➡ Found ${rows.length} rows on sheet "${SHEET}"`);

  let created = 0,
    updated = 0,
    skipped = 0,
    errors = 0;

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];

    try {
      // Read values using aliases
      const name = firstNonEmpty(row, MAP.name) || "";
      let identification_number = firstNonEmpty(row, MAP.identification_number);
      const birthRaw = firstNonEmpty(row, MAP.birth_or_incorporation_date);
      const birth_or_incorporation_date = parseDate(birthRaw);

      let entity_type_label = firstNonEmpty(row, MAP.entity_type);
      let entity_type_uuid =
        firstNonEmpty(row, MAP.entity_type_uuid) ||
        (entity_type_label ? etByName.get(norm(entity_type_label)) : null);

      let sex = firstNonEmpty(row, MAP.sex);
      let pension_scheme = firstNonEmpty(row, MAP.pension_scheme);

      let country_label = firstNonEmpty(row, MAP.country);
      let country_uuid =
        firstNonEmpty(row, MAP.country_uuid) ||
        (country_label ? cByName.get(norm(country_label)) : null);

      const address_line_1 = firstNonEmpty(row, MAP.address_line_1);
      const address_line_2 = firstNonEmpty(row, MAP.address_line_2);
      const zip_code = firstNonEmpty(row, MAP.zip_code);
      const iban = firstNonEmpty(row, MAP.iban);
      const swift = firstNonEmpty(row, MAP.swift);
      const director = firstNonEmpty(row, MAP.director);
      const director_id = firstNonEmpty(row, MAP.director_id);
      const email = firstNonEmpty(row, MAP.email);
      const phone = firstNonEmpty(row, MAP.phone);
      const oris_id = firstNonEmpty(row, MAP.oris_id);
      let internal_number = firstNonEmpty(row, MAP.internal_number) || null;
      const counteragent_uuid = firstNonEmpty(row, MAP.counteragent_uuid);

      // Basic lookups / recover labels if only UUIDs were supplied
      if (!entity_type_label && entity_type_uuid && etUuidSet.has(entity_type_uuid)) {
        const match = etRows.find((e) => e.entity_type_uuid === entity_type_uuid);
        entity_type_label = match?.name_ka || null;
      }
      if (!country_label && country_uuid && cUuidSet.has(country_uuid)) {
        const match = cRows.find((c) => c.country_uuid === country_uuid);
        country_label = match?.country || null;
      }

      // Mandatory checks
      if (!name) {
        console.warn(`Row ${idx + 2}: missing Name → skipped`);
        skipped++;
        continue;
      }
      if (!entity_type_uuid || !etUuidSet.has(entity_type_uuid)) {
        console.warn(`Row ${idx + 2}: unknown Entity Type → skipped`);
        skipped++;
        continue;
      }
      if (!country_uuid || !cUuidSet.has(country_uuid)) {
        console.warn(`Row ${idx + 2}: unknown Country → skipped`);
        skipped++;
        continue;
      }

      // Conditional requirements & normalization
      const idRequired = !UUIDS.ID_NOT_REQUIRED.has(entity_type_uuid);
      if (idRequired && !identification_number) {
        console.warn(`Row ${idx + 2}: ID required but empty → skipped`);
        skipped++;
        continue;
      }
      if (identification_number) {
        const idStr = String(identification_number).trim();
        const is11 = UUIDS.ID_11_DIGIT.has(entity_type_uuid);
        const rx = is11 ? /^\d{11}$/ : /^\d{9}$/;
        if (!rx.test(idStr)) {
          console.warn(
            `Row ${idx + 2}: ID "${idStr}" invalid for entity type (expected ${
              is11 ? "11" : "9"
            } digits) → skipped`
          );
          skipped++;
          continue;
        }
        identification_number = idStr;
      }

      const sexRequired = UUIDS.SEX_REQUIRED.has(entity_type_uuid);
      sex = asMaleFemale(sex);
      if (sexRequired && !sex) {
        console.warn(`Row ${idx + 2}: Sex required (Male/Female) → skipped`);
        skipped++;
        continue;
      }
      if (!sexRequired) sex = null;

      const pensionRequired = UUIDS.PENSION_REQUIRED.has(entity_type_uuid);
      pension_scheme = asTrueFalse(pension_scheme);
      if (pensionRequired && !pension_scheme) {
        console.warn(`Row ${idx + 2}: Pension Scheme required (True/False) → skipped`);
        skipped++;
        continue;
      }
      if (!pensionRequired) pension_scheme = null;

      const data = {
        name,
        identification_number: identification_number ?? null,
        birth_or_incorporation_date,
        entity_type: entity_type_label ?? null,
        entity_type_uuid,
        sex,
        pension_scheme,
        country: country_label ?? null,
        country_uuid,
        address_line_1: address_line_1 ?? null,
        address_line_2: address_line_2 ?? null,
        zip_code: zip_code ?? null,
        iban: iban ?? null,
        swift: swift ?? null,
        director: director ?? null,
        director_id: director_id ?? null,
        email: email ?? null,
        phone: phone ?? null,
        oris_id: oris_id ?? null,
        internal_number, // may be null; we’ll backfill ICE#### after insert if ID is empty
      };

      // Create or update
      let existing = null;
      if (counteragent_uuid) {
        existing = await prisma.counteragent.findFirst({
          where: { counteragent_uuid },
        });
      } else if (identification_number && idRequired) {
        existing = await prisma.counteragent.findFirst({
          where: { identification_number },
        });
      }

      let rec;
      if (existing) {
        rec = await prisma.counteragent.update({
          where: { id: existing.id },
          data,
          select: { id: true, internal_number: true, identification_number: true },
        });
        updated++;
      } else {
        rec = await prisma.counteragent.create({
          data: counteragent_uuid ? { ...data, counteragent_uuid } : data,
          select: { id: true, internal_number: true, identification_number: true },
        });
        created++;
      }

      // If ID is empty, ensure internal_number = ICE#### (and re-run label trigger)
      if (!rec.identification_number) {
        const desired = internal_number || padICE(rec.id);
        if (rec.internal_number !== desired) {
          await prisma.counteragent.update({
            where: { id: rec.id },
            data: { internal_number: desired },
          });
        }
      }
    } catch (e) {
      errors++;
      console.error(`Row ${idx + 2}: ERROR →`, e.message || e);
    }
  }

  console.log(
    `\n✅ Done. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
