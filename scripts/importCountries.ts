// scripts/importCountries.ts
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Row = {
  name_ka?: string;
  name_en?: string;
  iso2?: string;
  iso3?: string;
  un_code?: number | string | null;
};

// Expected headers in Excel (case-insensitive, can be in any order):
// Name KA, Name EN, ISO2, ISO3, UN code
const HEADER_MAP: Record<string, keyof Row> = {
  "name ka": "name_ka",
  "name_ka": "name_ka",
  "სახელი ka": "name_ka",
  "name en": "name_en",
  "name_en": "name_en",
  "iso2": "iso2",
  "iso 2": "iso2",
  "iso3": "iso3",
  "iso 3": "iso3",
  "un code": "un_code",
  "un_code": "un_code",
};

function normalizeHeader(h: string) {
  return h.trim().toLowerCase();
}

function parseWorkbook(filePath: string): Row[] {
  const buf = fs.readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer" });
  const wsName = wb.SheetNames[0];
  if (!wsName) throw new Error("Excel file has no sheets.");
  const ws = wb.Sheets[wsName];

  // Get raw rows
  const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

  if (raw.length === 0) return [];

  // Build a header map for this file
  const fileHeaders = Object.keys(raw[0]).map(normalizeHeader);
  const colKeys = Object.keys(raw[0]);

  const headerToField: Record<string, keyof Row | undefined> = {};
  colKeys.forEach((key, i) => {
    const norm = fileHeaders[i];
    headerToField[key] = HEADER_MAP[norm];
  });

  // Map each row to our Row type
  const out: Row[] = raw.map((r) => {
    const row: Row = {};
    for (const [key, val] of Object.entries(r)) {
      const field = headerToField[key];
      if (!field) continue;
      row[field] = typeof val === "string" ? val.trim() : val;
    }
    return row;
  });

  return out;
}

function cleanAndValidate(rows: Row[]) {
  const errors: string[] = [];
  const cleaned: Required<Pick<Row, "name_ka" | "name_en" | "iso2" | "iso3">> &
    Partial<Pick<Row, "un_code">>[] = [];

  rows.forEach((r, idx) => {
    const line = idx + 2; // +2 because Excel headers are line 1
    const name_ka = (r.name_ka ?? "").toString().trim();
    const name_en = (r.name_en ?? "").toString().trim();
    const iso2 = (r.iso2 ?? "").toString().trim().toUpperCase();
    const iso3 = (r.iso3 ?? "").toString().trim().toUpperCase();
    const un_code_raw = r.un_code;

    if (!name_ka) errors.push(`Row ${line}: "Name KA" is required`);
    if (!name_en) errors.push(`Row ${line}: "Name EN" is required`);
    if (!/^[A-Z]{2}$/.test(iso2)) errors.push(`Row ${line}: ISO2 must be 2 letters`);
    if (!/^[A-Z]{3}$/.test(iso3)) errors.push(`Row ${line}: ISO3 must be 3 letters`);

    let un_code: number | null = null;
    if (un_code_raw !== undefined && un_code_raw !== null && un_code_raw !== "") {
      const n = Number(un_code_raw);
      if (Number.isFinite(n)) un_code = Math.trunc(n);
      else errors.push(`Row ${line}: UN code must be a number`);
    }

    cleaned.push({ name_ka, name_en, iso2, iso3, un_code });
  });

  return { cleaned, errors };
}

async function upsertCountries(rows: ReturnType<typeof cleanAndValidate>["cleaned"]) {
  let ok = 0;
  let fail = 0;
  const failures: string[] = [];

  // De-dupe by iso3 inside the file (last one wins)
  const byIso3 = new Map<string, (typeof rows)[number]>();
  rows.forEach((r) => byIso3.set(r.iso3, r));

  const items = Array.from(byIso3.values());

  // Chunk to avoid overloading the DB
  const CHUNK = 100;
  for (let i = 0; i < items.length; i += CHUNK) {
    const slice = items.slice(i, i + CHUNK);
    await Promise.all(
      slice.map(async (r) => {
        try {
          await prisma.country.upsert({
            where: { iso3: r.iso3 }, // unique
            update: {
              name_ka: r.name_ka,
              name_en: r.name_en,
              iso2: r.iso2,
              un_code: r.un_code ?? null,
              // DO NOT set `country`; DB trigger keeps it in sync
            },
            create: {
              name_ka: r.name_ka,
              name_en: r.name_en,
              iso2: r.iso2,
              iso3: r.iso3,
              un_code: r.un_code ?? null,
            },
          });
          ok++;
        } catch (e: any) {
          fail++;
          failures.push(`${r.iso3}: ${e?.message ?? e}`);
        }
      })
    );
    process.stdout.write(`\rUpserted ${Math.min(i + CHUNK, items.length)} / ${items.length}…`);
  }

  console.log(""); // newline
  return { ok, fail, failures };
}

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: npx tsx scripts/importCountries.ts <path-to-excel.xlsx>");
    process.exit(1);
  }
  const filePath = path.resolve(process.cwd(), input);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`Reading: ${filePath}`);
  const parsed = parseWorkbook(filePath);
  if (parsed.length === 0) {
    console.log("No rows found.");
    process.exit(0);
  }

  const { cleaned, errors } = cleanAndValidate(parsed);
  if (errors.length) {
    console.error("Validation errors:");
    errors.forEach((e) => console.error(" - " + e));
    process.exit(1);
  }

  console.log(`Importing ${cleaned.length} countries (upsert by ISO3)…`);
  const { ok, fail, failures } = await upsertCountries(cleaned);

  console.log(`Done. Success: ${ok}, Failed: ${fail}`);
  if (failures.length) {
    console.log("Failures:");
    failures.forEach((f) => console.log(" - " + f));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
