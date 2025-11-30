// scripts/import_counteragents.js
// Usage:
//   node scripts/import_counteragents.js <file.xlsx> [--sheet=Sheet1] [--dry-run]
//   node scripts/import_counteragents.js --write-template <out.xlsx>
//
// Accepts either friendly headers or DB field names.
// Requires deps: xlsx, @prisma/client

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
  PENSION_REQUIRED: new Set(["bf4d83f9-5064-4958-af6e-e4c21b2e4880"]),
  ID_11_DIGIT: new Set([
    "bf4d83f9-5064-4958-af6e-e4c21b2e4880",
    "470412f4-e2c0-4f9d-91f1-1c0630a02364",
    "ba538574-e93f-4ce8-a780-667b61fc970a",
  ]),
};

// Header aliases
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
  // New booleans
  is_emploee: ["is_emploee", "Is Employee"],
  was_emploee: ["was_emploee", "Was Employee"],
  is_active: ["is_active", "Is Active"],
};

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const SHEET_ARG = args.find((a) => a.startsWith("--sheet="));
const EXPORT_ARG = args.find((a) => a.startsWith("--export-errors"));
const EXPORT_ERRORS = EXPORT_ARG
  ? (EXPORT_ARG.includes("=") ? EXPORT_ARG.split("=")[1] : (args[args.indexOf(EXPORT_ARG)+1] || "counteragent_import_errors.csv"))
  : null;
const WRITE_TEMPLATE = args[0] === "--write-template";
const FILE_ARG = args.find((a) => !a.startsWith("--"));

if (!args.length || (!WRITE_TEMPLATE && !FILE_ARG)) {
  console.log(
    "Usage:\n  node scripts/import_counteragents.js <file.xlsx> [--sheet=Sheet1] [--dry-run] [--export-errors <csv>]\n  node scripts/import_counteragents.js --write-template <out.xlsx>"
  );
  process.exit(0);
}

if (WRITE_TEMPLATE) {
  const out = args[1] || "counteragents_template.xlsx";
  writeTemplate(out);
  console.log(`Template written: ${out}`);
  process.exit(0);
}

const file = FILE_ARG;
const SHEET = SHEET_ARG ? SHEET_ARG.split("=")[1] : "Sheet1";

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
  if (any instanceof Date) return any;
  if (typeof any === "number") {
    const d = XLSX.SSF.parse_date_code(any);
    if (!d) return null;
    return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  const s = String(any).trim();
  const iso = new Date(s);
  if (!isNaN(iso.getTime())) return iso;
  const m = s.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
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

function toBool(v) {
  const n = norm(v);
  if (["true", "1", "yes", "y"].includes(n)) return true;
  if (["false", "0", "no", "n"].includes(n)) return false;
  return null;
}

async function writeTemplate(outPath) {
  const wb = XLSX.utils.book_new();
  const headers = [
    "Name",
    "ID",
    "Birth or Incorporation Date",
    "Entity Type",
    "Sex",
    "Pension Scheme",
    "Country",
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
    // Optional
    "Entity Type UUID",
    "Country UUID",
    "Counteragent UUID",
    "Internal Number",
    // New optional booleans
    "Is Employee",
    "Was Employee",
    "Is Active",
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, outPath);
}

async function main() {
  const errorsOut = [];
  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }

  // Prefetch lookups
  const [etRows, cRows] = await Promise.all([
    prisma.entityType.findMany({ select: { entity_type_uuid: true, name_ka: true } }),
    prisma.country.findMany({ select: { country_uuid: true, country: true } }),
  ]);
  const etByName = new Map(etRows.map((e) => [norm(e.name_ka), e.entity_type_uuid]));
  const etUuidSet = new Set(etRows.map((e) => e.entity_type_uuid));
  const cByName = new Map(cRows.map((c) => [norm(c.country), c.country_uuid]));
  const cUuidSet = new Set(cRows.map((c) => c.country_uuid));

  const wb = XLSX.readFile(file, { cellDates: true });
  const ws = wb.Sheets[SHEET] || wb.Sheets[wb.SheetNames[0]];
  if (!ws) {
    console.error("No worksheet found.");
    process.exit(1);
  }
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
  console.log(`Found ${rows.length} rows on sheet "${SHEET}"`);

  let created = 0, updated = 0, skipped = 0, errors = 0;

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    let errName, errIdentification, errDirector, errDirectorId, errOrisId, errEntityTypeUuid, errCountryUuid;
    try {
      const name = firstNonEmpty(row, MAP.name) || "";
      let identification_number = firstNonEmpty(row, MAP.identification_number);
      const birthRaw = firstNonEmpty(row, MAP.birth_or_incorporation_date);
      const birth_or_incorporation_date = parseDate(birthRaw);

      let entity_type_label = firstNonEmpty(row, MAP.entity_type);
      let entity_type_uuid = firstNonEmpty(row, MAP.entity_type_uuid) || (entity_type_label ? etByName.get(norm(entity_type_label)) : null);

      let sex = asMaleFemale(firstNonEmpty(row, MAP.sex));
      let pension_bool = toBool(firstNonEmpty(row, MAP.pension_scheme));

      let country_label = firstNonEmpty(row, MAP.country);
      let country_uuid = firstNonEmpty(row, MAP.country_uuid) || (country_label ? cByName.get(norm(country_label)) : null);

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

      // New booleans
      const is_emploee = toBool(firstNonEmpty(row, MAP.is_emploee));
      const was_emploee = toBool(firstNonEmpty(row, MAP.was_emploee));
      const is_active = toBool(firstNonEmpty(row, MAP.is_active));

      // Stash for error reporting
      errName = name;
      errIdentification = identification_number;
      errDirector = director;
      errDirectorId = director_id;
      errOrisId = oris_id;
      errEntityTypeUuid = entity_type_uuid;
      errCountryUuid = country_uuid;

      // Mandatory checks
      if (!name) { console.warn(`Row ${idx + 2}: missing Name — skipped`); skipped++; continue; }
      if (!entity_type_uuid || !etUuidSet.has(entity_type_uuid)) { console.warn(`Row ${idx + 2}: unknown Entity Type — skipped`); skipped++; continue; }
      if (!country_uuid || !cUuidSet.has(country_uuid)) { console.warn(`Row ${idx + 2}: unknown Country — skipped`); skipped++; continue; }

      // Conditional checks
      const idRequired = !UUIDS.ID_NOT_REQUIRED.has(entity_type_uuid);
      if (idRequired && !identification_number) { console.warn(`Row ${idx + 2}: ID required but empty — skipped`); skipped++; continue; }
      if (identification_number) {
        const idStr = String(identification_number).trim();
        const is11 = UUIDS.ID_11_DIGIT.has(entity_type_uuid);
        const rx = is11 ? /^\d{11}$/ : /^\d{9}$/;
        if (!rx.test(idStr)) { console.warn(`Row ${idx + 2}: ID "${idStr}" invalid (expected ${is11 ? "11" : "9"} digits) — skipped`); skipped++; continue; }
        identification_number = idStr;
      }

      const sexRequired = UUIDS.SEX_REQUIRED.has(entity_type_uuid);
      if (sexRequired && !sex) { console.warn(`Row ${idx + 2}: Sex required (Male/Female) — skipped`); skipped++; continue; }
      if (!sexRequired) sex = null;

      const pensionRequired = UUIDS.PENSION_REQUIRED.has(entity_type_uuid);
      if (pensionRequired && pension_bool === null) { console.warn(`Row ${idx + 2}: Pension Scheme required (True/False) — skipped`); skipped++; continue; }
      if (!pensionRequired) pension_bool = null;

      // Build data
      const data = {
        name,
        identification_number: identification_number ?? null,
        birth_or_incorporation_date,
        entity_type: entity_type_label ?? null,
        entity_type_uuid,
        sex,
        ...(pension_bool === null ? {} : { pension_scheme: pension_bool }),
        country: country_label ?? null,
        country_uuid,
        address_line_1: address_line_1 ?? null,
        address_line_2: address_line_2 ?? null,
        zip_code: zip_code ?? null,
        iban: iban ?? null,
        swift: swift ?? null,
        director: director ?? null,
        director_id: director_id == null ? null : String(director_id),
        email: email ?? null,
        phone: phone ?? null,
        oris_id: oris_id == null ? null : String(oris_id),
        ...(is_emploee === null ? {} : { is_emploee }),
        ...(was_emploee === null ? {} : { was_emploee }),
        ...(is_active === null ? {} : { is_active }),
        internal_number,
      };

      // Type validations similar to Prisma (for dry-run and early catch)
      if (data.name != null && typeof data.name !== 'string') {
        throw new Error('name must be a string');
      }
      if (data.director != null && typeof data.director !== 'string') {
        throw new Error('director must be a string');
      }

      // Upsert or simulate
      let existing = null;
      if (counteragent_uuid) {
        existing = await prisma.counteragent.findFirst({ where: { counteragent_uuid } });
      } else if (identification_number && idRequired) {
        existing = await prisma.counteragent.findFirst({ where: { identification_number } });
      }

      let rec;
      if (DRY_RUN) {
        if (existing) { updated++; rec = existing; } else { created++; rec = { id: 0n, internal_number, identification_number }; }
      } else {
        if (existing) {
          rec = await prisma.counteragent.update({ where: { id: existing.id }, data, select: { id: true, internal_number: true, identification_number: true } });
          updated++;
        } else {
          rec = await prisma.counteragent.create({ data: counteragent_uuid ? { ...data, counteragent_uuid } : data, select: { id: true, internal_number: true, identification_number: true } });
          created++;
        }
      }

      // If ID is empty, ensure internal_number = ICE####
      if (!DRY_RUN && !rec.identification_number) {
        const desired = internal_number || padICE(rec.id);
        if (rec.internal_number !== desired) {
          await prisma.counteragent.update({ where: { id: rec.id }, data: { internal_number: desired } });
        }
      }
    } catch (e) {
      errors++;
      const msg = e && e.message ? e.message : String(e);
      console.error(`Row ${idx + 2}: ERROR`, msg);
      if (EXPORT_ERRORS) {
        errorsOut.push({
          row: idx + 2,
          error: msg,
          name: errName,
          identification_number: errIdentification,
          director: errDirector,
          director_id: errDirectorId,
          oris_id: errOrisId,
          entity_type_uuid: errEntityTypeUuid,
          country_uuid: errCountryUuid,
        });
      }
    }
  }

  console.log(`\nDone${DRY_RUN ? " (dry-run)" : ""}. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);

  if (EXPORT_ERRORS) {
    const outPath = path.isAbsolute(EXPORT_ERRORS) ? EXPORT_ERRORS : path.join(process.cwd(), EXPORT_ERRORS);
    const rowsCsv = [
      ['row','error','name','identification_number','director','director_id','oris_id','entity_type_uuid','country_uuid'],
      ...errorsOut.map(r => [r.row, r.error, r.name, r.identification_number, r.director, r.director_id, r.oris_id, r.entity_type_uuid, r.country_uuid])
    ];
    const csv = rowsCsv.map(line => line.map(v => {
      if (v == null) return '';
      const s = String(v);
      return '"' + s.replace(/"/g,'""') + '"';
    }).join(',')).join('\n');
    fs.writeFileSync(outPath, csv, 'utf8');
    console.log(`Error CSV written: ${outPath}`);
  }
}

function padICE(id) { return "ICE" + String(id).padStart(4, "0"); }

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
