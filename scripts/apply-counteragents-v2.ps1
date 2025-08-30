# scripts/apply-counteragents-v2.ps1
# One-shot: counteragents DB + API + Grid + Forms (edit/new)
# Run:
#   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
#   powershell -ExecutionPolicy Bypass -File .\scripts\apply-counteragents-v2.ps1

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

function Write-Utf8NoBom($Path, [string]$Content) {
  $full = Join-Path $Root $Path
  $dir = Split-Path $full
  if ($dir) { New-Item -ItemType Directory -Force $dir | Out-Null }
  [System.IO.File]::WriteAllText($full, $Content, [System.Text.UTF8Encoding]::new($false))
}

function Replace-Or-Insert-CounteragentModel {
  $schemaPath = Join-Path $Root 'prisma\schema.prisma'
  $txt = Get-Content $schemaPath -Raw

  $model = @'
model Counteragent {
  id                          BigInt    @id @default(autoincrement())
  createdAt                   DateTime  @default(now())   @map("created_at")
  updatedAt                   DateTime  @updatedAt        @map("updated_at")
  ts                          DateTime  @default(now())   @db.Timestamptz(6)

  name                        String?   @db.Text
  identification_number       String?   @db.Text
  birth_or_incorporation_date DateTime?

  entity_type                 String?   @db.Text
  sex                         String?   @db.Text
  pension_scheme              Boolean?

  country                     String?   @db.Text

  address_line_1              String?   @db.Text
  address_line_2              String?   @db.Text
  zip_code                    String?   @db.Text
  iban                        String?   @db.Text
  swift                       String?   @db.Text
  director                    String?   @db.Text
  director_id                 String?   @db.Text
  email                       String?   @db.Text
  phone                       String?   @db.Text
  oris_id                     String?   @db.Text

  counteragent                String?   @db.Text

  country_uuid                String?   @db.Uuid
  entity_type_uuid            String?   @db.Uuid
  counteragent_uuid           String     @db.Uuid @default(uuid())
  internal_number             String?   @db.Text

  @@map("counteragents")
}
'@

  if ($txt -match 'model\s+Counteragent\s*\{[\s\S]*?\}') {
    $txt = [System.Text.RegularExpressions.Regex]::Replace(
      $txt,
      'model\s+Counteragent\s*\{[\s\S]*?\}',
      $model,
      [System.Text.RegularExpressions.RegexOptions]::Singleline
    )
  } else {
    # Append near the end (before last closing brace of file if any)
    $txt = "$txt`r`n`r`n$model"
  }

  Write-Utf8NoBom 'prisma\schema.prisma' $txt
}

function New-MigrationSql {
  $stamp = (Get-Date).ToString('yyyyMMddHHmmss')
  $migDir = "prisma\migrations\${stamp}_counteragents_rules"
  New-Item -ItemType Directory -Force $migDir | Out-Null

$mig = @'
-- Ensure supporting extensions (safe if already present)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table may already exist from Prisma; add constraints/triggers idempotently
-- Column-level rules depend on entity_type_uuid sets:

-- Sets (hard-coded UUIDs from spec)
-- person_like_for_11:  bf4d83f9-5064-4958-af6e-e4c21b2e4880, 470412f4-e2c0-4f9d-91f1-1c0630a02364, ba538574-e93f-4ce8-a780-667b61fc970a
-- exempt_types (ID optional + uniqueness exemption): f5c3c745-eaa4-4e27-a73b-badc9ebb49c0, 7766e9c2-0094-4090-adf4-ef017062457f
-- sex_required: bf4d83f9-5064-4958-af6e-e4c21b2e4880, 5747f8e6-a8a6-4a23-91cc-c427c3a22597, ba538574-e93f-4ce8-a780-667b61fc970a
-- pension_required: bf4d83f9-5064-4958-af6e-e4c21b2e4880

DO $$
BEGIN
  -- filtered unique index for identification_number (skip exempt types)
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
     JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relname = 'uq_counteragents_identification_number_filtered'
      AND n.nspname = 'public'
  ) THEN
    EXECUTE $SQL$
      CREATE UNIQUE INDEX uq_counteragents_identification_number_filtered
      ON public.counteragents(identification_number)
      WHERE identification_number IS NOT NULL
        AND (
          entity_type_uuid IS NULL OR
          entity_type_uuid NOT IN (
            'f5c3c745-eaa4-4e27-a73b-badc9ebb49c0',
            '7766e9c2-0094-4090-adf4-ef017062457f'
          )
        );
    $SQL$;
  END IF;

  -- Drop old checks if exist (names are fixed here so we can replace)
  PERFORM 1 FROM pg_constraint WHERE conname='ck_counteragents_id_format';
  IF FOUND THEN EXECUTE 'ALTER TABLE public.counteragents DROP CONSTRAINT ck_counteragents_id_format'; END IF;

  PERFORM 1 FROM pg_constraint WHERE conname='ck_counteragents_birth_required';
  IF FOUND THEN EXECUTE 'ALTER TABLE public.counteragents DROP CONSTRAINT ck_counteragents_birth_required'; END IF;

  PERFORM 1 FROM pg_constraint WHERE conname='ck_counteragents_sex_rules';
  IF FOUND THEN EXECUTE 'ALTER TABLE public.counteragents DROP CONSTRAINT ck_counteragents_sex_rules'; END IF;

  PERFORM 1 FROM pg_constraint WHERE conname='ck_counteragents_pension_rules';
  IF FOUND THEN EXECUTE 'ALTER TABLE public.counteragents DROP CONSTRAINT ck_counteragents_pension_rules'; END IF;

  -- ID length rules (11 / 9 / exempt)
  EXECUTE $SQL$
    ALTER TABLE public.counteragents
    ADD CONSTRAINT ck_counteragents_id_format CHECK (
      identification_number IS NULL OR
      CASE
        WHEN entity_type_uuid IN ('bf4d83f9-5064-4958-af6e-e4c21b2e4880','470412f4-e2c0-4f9d-91f1-1c0630a02364','ba538574-e93f-4ce8-a780-667b61fc970a')
          THEN identification_number ~ '^[0-9]{11}$'
        WHEN entity_type_uuid IN ('f5c3c745-eaa4-4e27-a73b-badc9ebb49c0','7766e9c2-0094-4090-adf4-ef017062457f')
          THEN TRUE
        ELSE identification_number ~ '^[0-9]{9}$'
      END
    );
  $SQL$;

  -- Birth/incorporation date required except exempt types
  EXECUTE $SQL$
    ALTER TABLE public.counteragents
    ADD CONSTRAINT ck_counteragents_birth_required CHECK (
      CASE
        WHEN entity_type_uuid IN ('f5c3c745-eaa4-4e27-a73b-badc9ebb49c0','7766e9c2-0094-4090-adf4-ef017062457f')
          THEN TRUE
        ELSE birth_or_incorporation_date IS NOT NULL
      END
    );
  $SQL$;

  -- Sex rules: required & within enum for sex_required; otherwise must be NULL
  EXECUTE $SQL$
    ALTER TABLE public.counteragents
    ADD CONSTRAINT ck_counteragents_sex_rules CHECK (
      (entity_type_uuid IN ('bf4d83f9-5064-4958-af6e-e4c21b2e4880','5747f8e6-a8a6-4a23-91cc-c427c3a22597','ba538574-e93f-4ce8-a780-667b61fc970a') AND sex IN ('Male','Female'))
      OR
      (entity_type_uuid NOT IN ('bf4d83f9-5064-4958-af6e-e4c21b2e4880','5747f8e6-a8a6-4a23-91cc-c427c3a22597','ba538574-e93f-4ce8-a780-667b61fc970a') AND sex IS NULL)
    );
  $SQL$;

  -- Pension scheme rules: required for one type, otherwise must be NULL
  EXECUTE $SQL$
    ALTER TABLE public.counteragents
    ADD CONSTRAINT ck_counteragents_pension_rules CHECK (
      (entity_type_uuid = 'bf4d83f9-5064-4958-af6e-e4c21b2e4880' AND pension_scheme IS NOT NULL)
      OR
      (entity_type_uuid <> 'bf4d83f9-5064-4958-af6e-e4c21b2e4880' AND pension_scheme IS NULL)
      OR
      (entity_type_uuid IS NULL AND pension_scheme IS NULL)
    );
  $SQL$;

END$$;

-- BEFORE trigger: keep *_uuid columns synced from human-readable fields
CREATE OR REPLACE FUNCTION public.fn_sync_counteragent_uuids()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.country IS DISTINCT FROM OLD.country OR TG_OP='INSERT' THEN
    SELECT c.country_uuid INTO NEW.country_uuid
    FROM public.countries c
    WHERE c.country = NEW.country
    LIMIT 1;
  END IF;

  IF NEW.entity_type IS DISTINCT FROM OLD.entity_type OR TG_OP='INSERT' THEN
    SELECT e.entity_type_uuid INTO NEW.entity_type_uuid
    FROM public.entity_types e
    WHERE e.name_ka = NEW.entity_type
    LIMIT 1;
  END IF;

  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_sync_counteragent_uuids ON public.counteragents;
CREATE TRIGGER trg_sync_counteragent_uuids
BEFORE INSERT OR UPDATE ON public.counteragents
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_counteragent_uuids();

-- AFTER trigger: derive internal_number & counteragent label
CREATE OR REPLACE FUNCTION public.fn_counteragent_derived()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_name_ka text;
BEGIN
  -- internal_number = ICE + zero-padded id (4)
  UPDATE public.counteragents
    SET internal_number = 'ICE' || lpad(NEW.id::text, 4, '0')
  WHERE id = NEW.id;

  SELECT name_ka INTO v_name_ka
  FROM public.entity_types WHERE entity_type_uuid = NEW.entity_type_uuid LIMIT 1;

  UPDATE public.counteragents
    SET counteragent = coalesce(NEW.name,'') || ' (ს.კ. ' ||
                       coalesce(NEW.identification_number, NEW.internal_number, '') ||
                       ' - ' || coalesce(v_name_ka,'') || ')'
  WHERE id = NEW.id;

  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_counteragent_derived_aiu ON public.counteragents;
CREATE TRIGGER trg_counteragent_derived_aiu
AFTER INSERT OR UPDATE ON public.counteragents
FOR EACH ROW EXECUTE FUNCTION public.fn_counteragent_derived();
'@

  Write-Utf8NoBom "$migDir\migration.sql" $mig
}

# ==== Write Prisma model ====
Replace-Or-Insert-CounteragentModel

# ==== Migration (constraints + triggers) ====
New-MigrationSql

# ==== API ====
$api = @'
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
export const revalidate = 0;

const prisma = new PrismaClient();
const PICK = {
  id: true, createdAt: true, updatedAt: true, ts: true,
  name: true, identification_number: true, birth_or_incorporation_date: true,
  entity_type: true, sex: true, pension_scheme: true, country: true,
  address_line_1: true, address_line_2: true, zip_code: true,
  iban: true, swift: true, director: true, director_id: true,
  email: true, phone: true, oris_id: true,
  counteragent: true, country_uuid: true, entity_type_uuid: true,
  counteragent_uuid: true, internal_number: true,
};

function toApi(r: any) {
  return {
    id: Number(r.id),
    created_at: r.createdAt?.toISOString() ?? null,
    updated_at: r.updatedAt?.toISOString() ?? null,
    ts: r.ts?.toISOString() ?? null,
    name: r.name,
    identification_number: r.identification_number,
    birth_or_incorporation_date: r.birth_or_incorporation_date ? new Date(r.birth_or_incorporation_date).toISOString().slice(0,10) : null,
    entity_type: r.entity_type,
    sex: r.sex,
    pension_scheme: r.pension_scheme,
    country: r.country,
    address_line_1: r.address_line_1,
    address_line_2: r.address_line_2,
    zip_code: r.zip_code,
    iban: r.iban,
    swift: r.swift,
    director: r.director,
    director_id: r.director_id,
    email: r.email,
    phone: r.phone,
    oris_id: r.oris_id,
    counteragent: r.counteragent,
    country_uuid: r.country_uuid,
    entity_type_uuid: r.entity_type_uuid,
    counteragent_uuid: r.counteragent_uuid,
    internal_number: r.internal_number ?? null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      const row = await prisma.counteragent.findFirst({ where: { id: BigInt(id) }, select: PICK });
      return NextResponse.json(row ? toApi(row) : null);
    }
    const rows = await prisma.counteragent.findMany({ orderBy: { id: "asc" }, select: PICK });
    return NextResponse.json(rows.map(toApi));
  } catch (e: any) {
    console.error("GET /counteragents/api", e);
    return NextResponse.json({ error: e.message ?? "Server error" }, { status: 500 });
  }
}

function cleanse(body: any) {
  const b: any = { ...body };
  for (const k of Object.keys(b)) if (b[k] === "") b[k] = null;

  // Sex + Pension conditional blanking (in case client forgets)
  const sexRequired = ['bf4d83f9-5064-4958-af6e-e4c21b2e4880','5747f8e6-a8a6-4a23-91cc-c427c3a22597','ba538574-e93f-4ce8-a780-667b61fc970a'];
  if (!b.entity_type_uuid || !sexRequired.includes(b.entity_type_uuid)) b.sex = null;

  if (b.entity_type_uuid !== 'bf4d83f9-5064-4958-af6e-e4c21b2e4880') b.pension_scheme = null;

  return b;
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const b = cleanse(raw);
    const created = await prisma.counteragent.create({ data: b, select: PICK });
    return NextResponse.json(toApi(created), { status: 201 });
  } catch (e: any) {
    const msg = String(e?.message || "");
    const status = msg.includes("uq_counteragents_identification_number_filtered") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const raw = await req.json();
    if (!raw?.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const b = cleanse(raw);
    const updated = await prisma.counteragent.update({
      where: { id: BigInt(raw.id) },
      data: b,
      select: PICK,
    });
    return NextResponse.json(toApi(updated));
  } catch (e: any) {
    const msg = String(e?.message || "");
    const status = msg.includes("uq_counteragents_identification_number_filtered") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
'@
Write-Utf8NoBom 'app/dictionaries/counteragents/api/route.ts' $api

# remove any old page-level route that could shadow the page
if (Test-Path 'app/dictionaries/counteragents/route.ts') { Remove-Item -Force 'app/dictionaries/counteragents/route.ts' }

# ==== Grid page (server) ====
$page = @'
import Link from "next/link";
import { PrismaClient } from "@prisma/client";
import CounteragentsTable from "./CounteragentsTable";
export const revalidate = 0;

export default async function CounteragentsPage() {
  const prisma = new PrismaClient();
  const rows = await prisma.counteragent.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true, createdAt: true, updatedAt: true, ts: true,
      name: true, identification_number: true, birth_or_incorporation_date: true,
      entity_type: true, sex: true, pension_scheme: true, country: true,
      address_line_1: true, address_line_2: true, zip_code: true,
      iban: true, swift: true, director: true, director_id: true,
      email: true, phone: true, oris_id: true,
      counteragent: true, country_uuid: true, entity_type_uuid: true,
      counteragent_uuid: true, internal_number: true,
    },
  });

  const data = rows.map(r => ({
    id: Number(r.id),
    created_at: r.createdAt?.toISOString() ?? null,
    updated_at: r.updatedAt?.toISOString() ?? null,
    ts: r.ts?.toISOString() ?? null,
    name: r.name,
    identification_number: r.identification_number,
    birth_or_incorporation_date: r.birth_or_incorporation_date ? new Date(r.birth_or_incorporation_date).toISOString().slice(0,10) : null,
    entity_type: r.entity_type,
    sex: r.sex,
    pension_scheme: r.pension_scheme,
    country: r.country,
    address_line_1: r.address_line_1,
    address_line_2: r.address_line_2,
    zip_code: r.zip_code,
    iban: r.iban,
    swift: r.swift,
    director: r.director,
    director_id: r.director_id,
    email: r.email,
    phone: r.phone,
    oris_id: r.oris_id,
    counteragent: r.counteragent,
    country_uuid: r.country_uuid,
    entity_type_uuid: r.entity_type_uuid,
    counteragent_uuid: r.counteragent_uuid,
    internal_number: r.internal_number ?? null,
  }));

  return (
    <div className="w-full">
      <div className="mx-auto max-w-[1800px] px-6 py-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Counteragents</h1>
          <Link href="/dictionaries/counteragents/new" className="px-3 py-2 rounded bg-blue-600 text-white">+ New</Link>
        </div>
        <CounteragentsTable data={data} />
      </div>
    </div>
  );
}
'@
Write-Utf8NoBom 'app/dictionaries/counteragents/page.tsx' $page

# ==== Grid (client) ====
$table = @'
"use client";
import * as React from "react";
import { flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, useReactTable, ColumnDef } from "@tanstack/react-table";
import { utils, writeFileXLSX } from "xlsx";

type Row = {
  id: number;
  name: string | null;
  identification_number: string | null;
  birth_or_incorporation_date: string | null;
  entity_type: string | null;
  sex: string | null;
  pension_scheme: boolean | null;
  country: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  zip_code: string | null;
  iban: string | null;
  swift: string | null;
  director: string | null;
  director_id: string | null;
  email: string | null;
  phone: string | null;
  oris_id: string | null;
  counteragent: string | null;
};

function usePersistedColumnSizing(key: string) {
  const [sizing, setSizing] = React.useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; }
  });
  React.useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(sizing));
  }, [key, sizing]);
  return [sizing, setSizing] as const;
}

export default function CounteragentsTable({ data }: { data: Row[] }) {
  const STORAGE_KEY = "tbl.counteragents.columnSizing.v1";
  const [columnSizing, setColumnSizing] = usePersistedColumnSizing(STORAGE_KEY);
  const [globalFilter, setGlobalFilter] = React.useState("");

  const cols = React.useMemo<ColumnDef<Row>[]>(() => [
    { header: "ID", accessorKey: "id", size: 80 },
    { header: "Name", accessorKey: "name", size: 240 },
    { header: "ID", accessorKey: "identification_number", size: 150 },
    { header: "Birth/Inc.", accessorKey: "birth_or_incorporation_date", size: 140 },
    { header: "Entity Type", accessorKey: "entity_type", size: 200 },
    { header: "Sex", accessorKey: "sex", size: 100 },
    { header: "Pens.", accessorKey: "pension_scheme", size: 90,
      cell: (c) => c.getValue() === true ? "True" : c.getValue() === false ? "False" : "" },
    { header: "Country", accessorKey: "country", size: 180 },
    { header: "Address 1", accessorKey: "address_line_1", size: 220 },
    { header: "Address 2", accessorKey: "address_line_2", size: 220 },
    { header: "ZIP", accessorKey: "zip_code", size: 100 },
    { header: "IBAN", accessorKey: "iban", size: 200 },
    { header: "SWIFT", accessorKey: "swift", size: 120 },
    { header: "Director", accessorKey: "director", size: 180 },
    { header: "Director ID", accessorKey: "director_id", size: 160 },
    { header: "Email", accessorKey: "email", size: 220 },
    { header: "Phone", accessorKey: "phone", size: 160 },
    { header: "ORIS ID", accessorKey: "oris_id", size: 140 },
    {
      header: "Edit", size: 90,
      cell: (c) => <a className="text-blue-600 underline" href={`/dictionaries/counteragents/${c.row.original.id}`}>Edit</a>,
      enableResizing: false,
    },
  ], []);

  const table = useReactTable({
    data,
    columns: cols,
    state: { columnSizing, globalFilter },
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
  });

  function exportXlsx() {
    const rows = table.getFilteredRowModel().rows.map(r => r.original);
    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new(); utils.book_append_sheet(wb, ws, "Counteragents");
    writeFileXLSX(wb, "counteragents.xlsx");
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-2">
        <input
          value={globalFilter ?? ""}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Filter..."
          className="border rounded px-2 py-1"
        />
        <button onClick={exportXlsx} className="ml-auto px-3 py-1.5 border rounded">
          Export XLSX (filtered)
        </button>
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="min-w-full table-fixed">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => (
                  <th key={h.id} style={{ width: h.getSize() }} className="border-b px-2 py-2 text-left relative">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {h.column.getCanResize() && (
                      <div
                        onMouseDown={h.getResizeHandler()}
                        onTouchStart={h.getResizeHandler()}
                        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none"
                      />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(r => (
              <tr key={r.id} className="odd:bg-white even:bg-gray-50">
                {r.getVisibleCells().map(c => (
                  <td key={c.id} style={{ width: c.column.getSize() }} className="border-b px-2 py-1.5">
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr><td className="px-3 py-4 text-gray-500" colSpan={cols.length}>No rows</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="px-2 py-1 border rounded">Prev</button>
        <span>Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</span>
        <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="px-2 py-1 border rounded">Next</button>
        <select
          value={table.getState().pagination.pageSize}
          onChange={e => table.setPageSize(Number(e.target.value))}
          className="ml-2 border rounded px-2 py-1"
        >
          {[10,25,50,100].map(n => <option key={n} value={n}>Show {n}</option>)}
        </select>
      </div>
    </div>
  );
}
'@
Write-Utf8NoBom 'app/dictionaries/counteragents/CounteragentsTable.tsx' $table

# ==== New + Edit pages & Form (client) ====
$newPage = @'
import { PrismaClient } from "@prisma/client";
import CounteragentForm from "../CounteragentForm";
export const revalidate = 0;

export default async function NewCounteragent() {
  const prisma = new PrismaClient();
  const countries = await prisma.country.findMany({ orderBy: { country: "asc" }, select: { country: true }});
  const entityTypes = await prisma.entityType.findMany({ orderBy: { name_ka: "asc" }, select: { name_ka: true, entity_type_uuid: true }});
  return (
    <div className="mx-auto max-w-[1100px] px-6 py-8">
      <h1 className="text-2xl font-semibold mb-6">New Counteragent</h1>
      <CounteragentForm mode="create" countries={countries.map(c=>c.country)} entityTypes={entityTypes} />
    </div>
  );
}
'@
Write-Utf8NoBom 'app/dictionaries/counteragents/new/page.tsx' $newPage

$editPage = @'
import { PrismaClient } from "@prisma/client";
import CounteragentForm from "../CounteragentForm";
export const revalidate = 0;

export default async function EditCounteragent({ params }: { params: { id: string }}) {
  const prisma = new PrismaClient();
  const id = Number(params.id);
  const row = await prisma.counteragent.findFirst({ where: { id: BigInt(id) }});
  const countries = await prisma.country.findMany({ orderBy: { country: "asc" }, select: { country: true }});
  const entityTypes = await prisma.entityType.findMany({ orderBy: { name_ka: "asc" }, select: { name_ka: true, entity_type_uuid: true }});
  return (
    <div className="mx-auto max-w-[1100px] px-6 py-8">
      <h1 className="text-2xl font-semibold mb-6">Edit Counteragent #{id}</h1>
      <CounteragentForm
        mode="edit"
        initial={row ? {
          id,
          name: row.name ?? "",
          identification_number: row.identification_number ?? "",
          birth_or_incorporation_date: row.birth_or_incorporation_date ? row.birth_or_incorporation_date.toISOString().slice(0,10) : "",
          entity_type: row.entity_type ?? "",
          entity_type_uuid: row.entity_type_uuid ?? "",
          sex: row.sex ?? "",
          pension_scheme: row.pension_scheme,
          country: row.country ?? "",
          address_line_1: row.address_line_1 ?? "",
          address_line_2: row.address_line_2 ?? "",
          zip_code: row.zip_code ?? "",
          iban: row.iban ?? "",
          swift: row.swift ?? "",
          director: row.director ?? "",
          director_id: row.director_id ?? "",
          email: row.email ?? "",
          phone: row.phone ?? "",
          oris_id: row.oris_id ?? ""
        } : null}
        countries={countries.map(c=>c.country)}
        entityTypes={entityTypes}
      />
    </div>
  );
}
'@
Write-Utf8NoBom 'app/dictionaries/counteragents/[id]/page.tsx' $editPage

$form = @'
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";

type ET = { name_ka: string; entity_type_uuid: string };
type Props = {
  mode: "create" | "edit";
  initial?: any | null;
  countries: string[];
  entityTypes: ET[];
};

const PERSON_11 = new Set(["bf4d83f9-5064-4958-af6e-e4c21b2e4880","470412f4-e2c0-4f9d-91f1-1c0630a02364","ba538574-e93f-4ce8-a780-667b61fc970a"]);
const EXEMPT    = new Set(["f5c3c745-eaa4-4e27-a73b-badc9ebb49c0","7766e9c2-0094-4090-adf4-ef017062457f"]);
const SEX_REQ   = new Set(["bf4d83f9-5064-4958-af6e-e4c21b2e4880","5747f8e6-a8a6-4a23-91cc-c427c3a22597","ba538574-e93f-4ce8-a780-667b61fc970a"]);
const PENS_REQ  = "bf4d83f9-5064-4958-af6e-e4c21b2e4880";

export default function CounteragentForm({ mode, initial, countries, entityTypes }: Props) {
  const r = useRouter();
  const [v, setV] = React.useState<any>(() => initial ?? {});
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const etUuid = v.entity_type_uuid || "";
  const mandatory = {
    name: true,
    identification_number: !EXEMPT.has(etUuid),
    birth_or_incorporation_date: !EXEMPT.has(etUuid),
    entity_type: true,
    sex: SEX_REQ.has(etUuid),
    pension_scheme: etUuid === PENS_REQ,
    country: true,
  };

  // auto-fill entity_type text when UUID changes
  React.useEffect(() => {
    const found = entityTypes.find(e => e.entity_type_uuid === etUuid);
    setV((s:any)=>({ ...s, entity_type: found?.name_ka ?? s.entity_type }));
  }, [etUuid]); // eslint-disable-line

  // clear conditionals when not applicable
  React.useEffect(() => {
    setV((s:any)=>({
      ...s,
      sex: SEX_REQ.has(etUuid) ? s.sex : "",
      pension_scheme: etUuid === PENS_REQ ? (s.pension_scheme ?? null) : null
    }));
  }, [etUuid]);

  function field(label:string, name:string, input:React.ReactNode, req=false) {
    return (
      <label className="block mb-3">
        <span className="block text-sm font-medium mb-1">{label}{req && <span className="text-red-600"> *</span>}</span>
        {input}
      </label>
    );
  }

  function inputText(name:string, disabled=false, type="text") {
    return (
      <input
        className="w-full border rounded px-3 py-2"
        type={type}
        disabled={disabled}
        value={v[name] ?? ""}
        onChange={(e)=>setV((s:any)=>({ ...s, [name]: e.target.value }))}
      />
    );
  }

  async function submit(nextNew=false) {
    setSaving(true); setErr(null);
    try {
      // validations
      if (mandatory.name && !v.name?.trim()) throw new Error("Name is required");
      if (mandatory.entity_type && !etUuid) throw new Error("Entity Type is required");
      if (mandatory.country && !v.country) throw new Error("Country is required");
      if (mandatory.birth_or_incorporation_date && !v.birth_or_incorporation_date) throw new Error("Birth or Incorporation Date is required");

      if (!EXEMPT.has(etUuid) && v.identification_number) {
        const re = PERSON_11.has(etUuid) ? /^[0-9]{11}$/ : /^[0-9]{9}$/;
        if (!re.test(v.identification_number)) throw new Error("ID format is invalid");
      }
      if (mandatory.identification_number && !v.identification_number) throw new Error("ID is required");

      if (SEX_REQ.has(etUuid)) {
        if (v.sex !== "Male" && v.sex !== "Female") throw new Error("Sex must be Male or Female");
      } else {
        v.sex = "";
      }
      if (etUuid === PENS_REQ) {
        if (v.pension_scheme !== true && v.pension_scheme !== false) throw new Error("Pension Scheme must be True or False");
      } else {
        v.pension_scheme = null;
      }

      const payload = { ...v };
      const method = mode === "create" ? "POST" : "PUT";
      const res = await fetch("/dictionaries/counteragents/api", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 409) throw new Error("A counteragent with the same ID already exists");
      if (!res.ok) throw new Error((await res.json())?.error ?? "Save failed");

      if (nextNew) {
        // reset minimal fields
        setV({ entity_type_uuid: v.entity_type_uuid, entity_type: v.entity_type });
      } else {
        r.push("/dictionaries/counteragents");
      }
    } catch (e:any) {
      setErr(e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  // Build 3 columns: left = mandatory fields only
  const mandatoryFields = [
    field("Name","name", inputText("name"), mandatory.name),
    field("ID","identification_number", inputText("identification_number"), mandatory.identification_number),
    field("Birth or Incorporation Date","birth_or_incorporation_date",
      <input className="w-full border rounded px-3 py-2" type="date"
        value={v.birth_or_incorporation_date ?? ""} onChange={(e)=>setV((s:any)=>({ ...s, birth_or_incorporation_date:e.target.value }))} />,
      mandatory.birth_or_incorporation_date),
    field("Entity Type","entity_type",
      <select className="w-full border rounded px-3 py-2" value={etUuid}
        onChange={(e)=>setV((s:any)=>({ ...s, entity_type_uuid:e.target.value }))}>
        <option value="">-- select --</option>
        {entityTypes.map(et => <option key={et.entity_type_uuid} value={et.entity_type_uuid}>{et.name_ka}</option>)}
      </select>,
      mandatory.entity_type),
    field("Sex","sex",
      <select className="w-full border rounded px-3 py-2" disabled={!SEX_REQ.has(etUuid)} value={v.sex ?? ""}
        onChange={(e)=>setV((s:any)=>({ ...s, sex:e.target.value }))}>
        <option value="">--</option>
        <option value="Male">Male</option>
        <option value="Female">Female</option>
      </select>,
      mandatory.sex),
    field("Pension Scheme","pension_scheme",
      <select className="w-full border rounded px-3 py-2" disabled={etUuid!==PENS_REQ} value={v.pension_scheme ?? ""} onChange={(e)=>setV((s:any)=>({ ...s, pension_scheme: e.target.value===''? null : e.target.value==='true' }))}>
        <option value="">--</option>
        <option value="true">True</option>
        <option value="false">False</option>
      </select>,
      mandatory.pension_scheme),
    field("Country","country",
      <select className="w-full border rounded px-3 py-2" value={v.country ?? ""} onChange={(e)=>setV((s:any)=>({ ...s, country:e.target.value }))}>
        <option value="">-- select --</option>
        {countries.map(c => <option key={c} value={c}>{c}</option>)}
      </select>,
      mandatory.country),
  ];

  const optionalFields = [
    field("Address Line 1","address_line_1", inputText("address_line_1")),
    field("Address Line 2","address_line_2", inputText("address_line_2")),
    field("ZIP Code","zip_code", inputText("zip_code")),
    field("IBAN","iban", inputText("iban")),
    field("SWIFT","swift", inputText("swift")),
    field("Director","director", inputText("director")),
    field("Director ID","director_id", inputText("director_id")),
    field("Email","email", inputText("email","text" as any)),
    field("Phone","phone", inputText("phone")),
    field("ORIS ID","oris_id", inputText("oris_id")),
  ];

  // split optional to two columns roughly matching mandatory count
  const leftOpt = optionalFields.slice(0, Math.ceil(optionalFields.length/2));
  const rightOpt = optionalFields.slice(Math.ceil(optionalFields.length/2));

  return (
    <div>
      {err && <div className="mb-3 text-red-600">{err}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>{mandatoryFields}</div>
        <div>{leftOpt}</div>
        <div>{rightOpt}</div>
      </div>

      <div className="mt-6 flex gap-2">
        <button disabled={saving} onClick={()=>submit(false)} className="px-4 py-2 rounded bg-blue-600 text-white">{saving?"Saving…":"Save"}</button>
        <button disabled={saving} onClick={()=>submit(true)} className="px-4 py-2 rounded border">Save and New</button>
        <a href="/dictionaries/counteragents" className="px-4 py-2 rounded border ml-auto">Back</a>
      </div>
    </div>
  );
}
'@
Write-Utf8NoBom 'app/dictionaries/counteragents/CounteragentForm.tsx' $form

# ==== Run prisma generate + migrate (local binary for Windows-safe) ====
$prisma = '.\node_modules\.bin\prisma.cmd'
if (!(Test-Path $prisma)) { throw "Prisma binary not found. Run npm install first." }

Write-Host "`n=> Running: prisma generate"
& $prisma generate

Write-Host "`n=> Running: prisma migrate dev -n counteragents_rules"
& $prisma migrate dev -n counteragents_rules

Write-Host "`n✅ Done. Open http://localhost:3000/dictionaries/counteragents"
