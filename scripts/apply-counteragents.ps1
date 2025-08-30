param(
  [switch]$SkipMigrate  # use -SkipMigrate to only write files without running prisma
)

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
function Write-Utf8NoBom {
  param([string]$Path, [string]$Content)
  $dir = Split-Path -Parent $Path
  if ($dir -and !(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
  Write-Host ("`u2713 wrote {0}" -f (Resolve-Path $Path).Path)
}

function Replace-Prisma-Model {
  param(
    [string]$SchemaPath,
    [string]$ModelName,
    [string]$ModelText
  )
  if (!(Test-Path $SchemaPath)) { throw "Prisma schema not found at $SchemaPath" }
  $schema = Get-Content $SchemaPath -Raw
  # Safer regex: use (?s) for singleline instead of [\s\S]
  $pattern = "model\s+" + [regex]::Escape($ModelName) + "\s*\{(?s).*?\}"
  if ([regex]::IsMatch($schema, $pattern)) {
    $schema = [regex]::Replace($schema, $pattern, $ModelText)
  } else {
    if ($schema -notmatch "\S") { $schema = "" }
    $schema = $schema.TrimEnd() + "`r`n`r`n" + $ModelText + "`r`n"
  }
  Write-Utf8NoBom $SchemaPath $schema
}

# -----------------------------------------------------------------------------
# Paths
# -----------------------------------------------------------------------------
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$AppDir = Join-Path $Root "app"
$CounteragentsDir   = Join-Path $Root "app\dictionaries\counteragents"
$CountriesApiDir    = Join-Path $Root "app\dictionaries\countries\api"
$EntityTypesApiDir  = Join-Path $Root "app\dictionaries\entity-types\api"
$PrismaDir  = Join-Path $Root "prisma"
$SchemaPath = Join-Path $PrismaDir "schema.prisma"

New-Item -ItemType Directory -Path $CounteragentsDir -Force | Out-Null
New-Item -ItemType Directory -Path $CountriesApiDir -Force | Out-Null
New-Item -ItemType Directory -Path $EntityTypesApiDir -Force | Out-Null

# -----------------------------------------------------------------------------
# 1) SQL migration - drop & recreate counteragents (exact column order)
#    WARNING: this drops the table (data loss).
# -----------------------------------------------------------------------------
$stamp = (Get-Date).ToString("yyyyMMddHHmmss")
$MigDir = Join-Path $PrismaDir ("migrations\{0}_counteragents_reset" -f $stamp)
New-Item -ItemType Directory -Path $MigDir -Force | Out-Null

$migrationSql = @'
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS public.counteragents CASCADE;

CREATE TABLE public.counteragents (
  id                           BIGSERIAL PRIMARY KEY,
  created_at                   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMP NOT NULL DEFAULT NOW(),
  ts                           TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  name                         TEXT NOT NULL,
  identification_number        TEXT,
  birth_or_incorporation_date  DATE,
  entity_type                  TEXT,
  sex                          TEXT,
  pension_scheme               TEXT,
  country                      TEXT,
  address_line_1               TEXT,
  address_line_2               TEXT,
  zip_code                     TEXT,
  iban                         TEXT,
  swift                        TEXT,
  director                     TEXT,
  director_id                  TEXT,
  email                        TEXT,
  phone                        TEXT,
  oris_id                      TEXT,
  counteragent                 TEXT,
  country_uuid                 UUID,
  entity_type_uuid             UUID,
  counteragent_uuid            UUID NOT NULL DEFAULT gen_random_uuid(),
  internal_number              TEXT
);

ALTER TABLE public.counteragents
  ADD CONSTRAINT fk_counteragents_country_uuid
  FOREIGN KEY (country_uuid) REFERENCES public.countries(country_uuid)
  ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.counteragents
  ADD CONSTRAINT fk_counteragents_entity_type_uuid
  FOREIGN KEY (entity_type_uuid) REFERENCES public.entity_types(entity_type_uuid)
  ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_counteragents_country_uuid ON public.counteragents(country_uuid);
CREATE INDEX IF NOT EXISTS ix_counteragents_entity_type_uuid ON public.counteragents(entity_type_uuid);
CREATE UNIQUE INDEX IF NOT EXISTS ux_counteragents_counteragent_uuid ON public.counteragents(counteragent_uuid);
'@
Write-Utf8NoBom (Join-Path $MigDir "migration.sql") $migrationSql

# -----------------------------------------------------------------------------
# 2) Prisma model: Counteragent (matches SQL and column order)
# -----------------------------------------------------------------------------
$counteragentModel = @'
model Counteragent {
  id          BigInt   @id @default(autoincrement())
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt
  ts          DateTime @default(now()) @db.Timestamptz(6)

  name                         String  @db.Text
  identification_number        String? @db.Text
  birth_or_incorporation_date  DateTime?
  entity_type                  String? @db.Text
  sex                          String? @db.Text
  pension_scheme               String? @db.Text
  country                      String? @db.Text
  address_line_1               String? @db.Text
  address_line_2               String? @db.Text
  zip_code                     String? @db.Text
  iban                         String? @db.Text
  swift                        String? @db.Text
  director                     String? @db.Text
  director_id                  String? @db.Text
  email                        String? @db.Text
  phone                        String? @db.Text
  oris_id                      String? @db.Text
  counteragent                 String? @db.Text
  country_uuid                 String? @db.Uuid
  entity_type_uuid             String? @db.Uuid
  counteragent_uuid            String  @db.Uuid @default(uuid()) @unique
  internal_number              String? @db.Text

  countryRow     Country?    @relation(fields: [country_uuid], references: [country_uuid])
  entityTypeRow  EntityType? @relation(fields: [entity_type_uuid], references: [entity_type_uuid])

  @@map("counteragents")
  @@index([country_uuid])
  @@index([entity_type_uuid])
}
'@
Replace-Prisma-Model -SchemaPath $SchemaPath -ModelName "Counteragent" -ModelText $counteragentModel

# -----------------------------------------------------------------------------
# 3) API route: /dictionaries/counteragents (GET/POST/PUT/DELETE)
# -----------------------------------------------------------------------------
$counteragentsRouteTs = @'
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function toDateOrNull(v: any) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export async function GET() {
  const rows = await prisma.counteragent.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true, created_at: true, updated_at: true, ts: true,
      name: true, identification_number: true, birth_or_incorporation_date: true,
      entity_type: true, sex: true, pension_scheme: true, country: true,
      address_line_1: true, address_line_2: true, zip_code: true, iban: true, swift: true,
      director: true, director_id: true, email: true, phone: true, oris_id: true,
      counteragent: true, country_uuid: true, entity_type_uuid: true, counteragent_uuid: true, internal_number: true,
    },
  });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const b = await req.json();
  const created = await prisma.counteragent.create({
    data: {
      name: b.name,
      identification_number: b.identification_number ?? null,
      birth_or_incorporation_date: toDateOrNull(b.birth_or_incorporation_date),
      entity_type: b.entity_type ?? null,
      sex: b.sex ?? null,
      pension_scheme: b.pension_scheme ?? null,
      country: b.country ?? null,
      address_line_1: b.address_line_1 ?? null,
      address_line_2: b.address_line_2 ?? null,
      zip_code: b.zip_code ?? null,
      iban: b.iban ?? null,
      swift: b.swift ?? null,
      director: b.director ?? null,
      director_id: b.director_id ?? null,
      email: b.email ?? null,
      phone: b.phone ?? null,
      oris_id: b.oris_id ?? null,
      counteragent: b.counteragent ?? null,
      country_uuid: b.country_uuid ?? null,
      entity_type_uuid: b.entity_type_uuid ?? null,
      internal_number: b.internal_number ?? null,
    },
  });
  return NextResponse.json(created, { status: 201 });
}

export async function PUT(req: Request) {
  const b = await req.json();
  if (!b.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const updated = await prisma.counteragent.update({
    where: { id: BigInt(b.id) },
    data: {
      name: b.name,
      identification_number: b.identification_number ?? null,
      birth_or_incorporation_date: toDateOrNull(b.birth_or_incorporation_date),
      entity_type: b.entity_type ?? null,
      sex: b.sex ?? null,
      pension_scheme: b.pension_scheme ?? null,
      country: b.country ?? null,
      address_line_1: b.address_line_1 ?? null,
      address_line_2: b.address_line_2 ?? null,
      zip_code: b.zip_code ?? null,
      iban: b.iban ?? null,
      swift: b.swift ?? null,
      director: b.director ?? null,
      director_id: b.director_id ?? null,
      email: b.email ?? null,
      phone: b.phone ?? null,
      oris_id: b.oris_id ?? null,
      counteragent: b.counteragent ?? null,
      country_uuid: b.country_uuid ?? null,
      entity_type_uuid: b.entity_type_uuid ?? null,
      internal_number: b.internal_number ?? null,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.counteragent.delete({ where: { id: BigInt(id) } });
  return NextResponse.json({ ok: true });
}
'@
Write-Utf8NoBom (Join-Path $CounteragentsDir "route.ts") $counteragentsRouteTs

# -----------------------------------------------------------------------------
# 4) Lookup routes: countries & entity-types
# -----------------------------------------------------------------------------
$countriesApiTs = @'
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function GET() {
  const rows = await prisma.country.findMany({
    orderBy: { name_en: "asc" },
    select: { country_uuid: true, country: true, name_en: true, iso2: true },
  });
  return NextResponse.json(rows);
}
'@
Write-Utf8NoBom (Join-Path $CountriesApiDir "route.ts") $countriesApiTs

$entityTypesApiTs = @'
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function GET() {
  const rows = await prisma.entityType.findMany({
    orderBy: { name_en: "asc" },
    select: { entity_type_uuid: true, code: true, name_en: true, name_ka: true },
  });
  return NextResponse.json(rows);
}
'@
Write-Utf8NoBom (Join-Path $EntityTypesApiDir "route.ts") $entityTypesApiTs

# -----------------------------------------------------------------------------
# 5) Page: /dictionaries/counteragents
# -----------------------------------------------------------------------------
$pageTsx = @'
import { PrismaClient } from "@prisma/client";
import CounteragentForm from "./CounteragentForm";
import CounteragentsTable from "./CounteragentsTable";

export const revalidate = 0;

export default async function CounteragentsPage() {
  const prisma = new PrismaClient();
  const rows = await prisma.counteragent.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true, created_at: true, updated_at: true, ts: true,
      name: true, identification_number: true, birth_or_incorporation_date: true,
      entity_type: true, sex: true, pension_scheme: true, country: true,
      address_line_1: true, address_line_2: true, zip_code: true, iban: true, swift: true,
      director: true, director_id: true, email: true, phone: true, oris_id: true,
      counteragent: true, country_uuid: true, entity_type_uuid: true, counteragent_uuid: true, internal_number: true,
    },
  });

  const data = rows.map((r) => ({
    ...r,
    id: Number(r.id),
    created_at: r.created_at?.toISOString() ?? null,
    updated_at: r.updated_at?.toISOString() ?? null,
    ts: r.ts?.toISOString() ?? null,
    birth_or_incorporation_date: r.birth_or_incorporation_date
      ? new Date(r.birth_or_incorporation_date).toISOString()
      : null,
  }));

  return (
    <div className="w-full">
      <div className="mx-auto max-w-[1400px] px-6 py-8">
        <h1 className="text-2xl font-semibold mb-4">Counteragents</h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="lg:max-w-[640px]">
            <CounteragentForm />
          </div>
          <div className="lg:col-span-1">
            <CounteragentsTable data={data} />
          </div>
        </div>
      </div>
    </div>
  );
}
'@
Write-Utf8NoBom (Join-Path $CounteragentsDir "page.tsx") $pageTsx

# -----------------------------------------------------------------------------
# 6) Form: only required fields (labels exactly as specified)
# -----------------------------------------------------------------------------
$formTsx = @'
"use client";
import React, { useEffect, useState } from "react";

type Option = { value: string; label: string };

type Payload = {
  name: string;                             // Name
  identification_number?: string | null;    // ID
  birth_or_incorporation_date?: string | null; // Birth or Incorporation Date
  entity_type?: string | null;              // Entity Type (display label)
  entity_type_uuid?: string | null;         // FK
  sex?: string | null;                      // Sex
  pension_scheme?: string | null;           // Pension Scheme
  country?: string | null;                  // Country (display label)
  country_uuid?: string | null;             // FK
  address_line_1?: string | null;           // Address Line 1
  address_line_2?: string | null;           // Address Line 2
  zip_code?: string | null;                 // ZIP Code
  iban?: string | null;                     // IBAN
  swift?: string | null;                    // SWIFT
  director?: string | null;                 // Director
  director_id?: string | null;              // Director ID
  email?: string | null;                    // Email
  phone?: string | null;                    // Phone
  oris_id?: string | null;                  // ORIS ID
};

export default function CounteragentForm() {
  const [saving, setSaving] = useState(false);
  const [countries, setCountries] = useState<Option[]>([]);
  const [entityTypes, setEntityTypes] = useState<Option[]>([]);
  const [values, setValues] = useState<Payload>({
    name: "",
    identification_number: "",
    birth_or_incorporation_date: "",
    entity_type: "",
    entity_type_uuid: "",
    sex: "",
    pension_scheme: "",
    country: "",
    country_uuid: "",
    address_line_1: "",
    address_line_2: "",
    zip_code: "",
    iban: "",
    swift: "",
    director: "",
    director_id: "",
    email: "",
    phone: "",
    oris_id: "",
  });

  useEffect(() => {
    (async () => {
      const r1 = await fetch("/dictionaries/countries/api");
      const cs = r1.ok ? await r1.json() : [];
      setCountries((cs || []).map((c: any) => ({
        value: c.country_uuid, label: c.country ?? c.name_en ?? c.iso2 ?? c.country_uuid
      })));

      const r2 = await fetch("/dictionaries/entity-types/api");
      const es = r2.ok ? await r2.json() : [];
      setEntityTypes((es || []).map((e: any) => ({
        value: e.entity_type_uuid, label: e.name_en ?? e.code ?? e.entity_type_uuid
      })));
    })();
  }, []);

  function set<K extends keyof Payload>(k: K, v: Payload[K]) {
    setValues((s) => ({ ...s, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const resp = await fetch("/dictionaries/counteragents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setSaving(false);
    if (!resp.ok) {
      const t = await resp.text();
      alert("Save failed: " + t);
      return;
    }
    setValues({
      name: "",
      identification_number: "",
      birth_or_incorporation_date: "",
      entity_type: "",
      entity_type_uuid: "",
      sex: "",
      pension_scheme: "",
      country: "",
      country_uuid: "",
      address_line_1: "",
      address_line_2: "",
      zip_code: "",
      iban: "",
      swift: "",
      director: "",
      director_id: "",
      email: "",
      phone: "",
      oris_id: "",
    });
    alert("Saved");
  }

  return (
    <form onSubmit={submit} className="space-y-3 border rounded p-4">
      {([
        { key: "name", label: "Name", type: "text" },
        { key: "identification_number", label: "ID", type: "text" },
      ] as const).map((f) => (
        <label key={f.key} className="flex flex-col">
          <span className="text-sm text-gray-600">{f.label}</span>
          <input
            type={f.type}
            className="border rounded px-2 py-1"
            value={(values[f.key] as any) ?? ""}
            onChange={(e) => set(f.key, e.target.value)}
            required={f.key === "name"}
          />
        </label>
      ))}

      <label className="flex flex-col">
        <span className="text-sm text-gray-600">Birth or Incorporation Date</span>
        <input
          type="date"
          className="border rounded px-2 py-1"
          value={values.birth_or_incorporation_date ?? ""}
          onChange={(e) => set("birth_or_incorporation_date", e.target.value || "")}
        />
      </label>

      <label className="flex flex-col">
        <span className="text-sm text-gray-600">Entity Type</span>
        <select
          className="border rounded px-2 py-1"
          value={values.entity_type_uuid ?? ""}
          onChange={(e) => {
            const uuid = e.target.value || "";
            const label = entityTypes.find((x) => x.value === uuid)?.label || "";
            set("entity_type_uuid", uuid);
            set("entity_type", label);
          }}
        >
          <option value="">—</option>
          {entityTypes.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>

      {([
        { key: "sex", label: "Sex" },
        { key: "pension_scheme", label: "Pension Scheme" },
      ] as const).map((f) => (
        <label key={f.key} className="flex flex-col">
          <span className="text-sm text-gray-600">{f.label}</span>
          <input
            className="border rounded px-2 py-1"
            value={(values[f.key] as any) ?? ""}
            onChange={(e) => set(f.key, e.target.value)}
          />
        </label>
      ))}

      <label className="flex flex-col">
        <span className="text-sm text-gray-600">Country</span>
        <select
          className="border rounded px-2 py-1"
          value={values.country_uuid ?? ""}
          onChange={(e) => {
            const uuid = e.target.value || "";
            const label = countries.find((x) => x.value === uuid)?.label || "";
            set("country_uuid", uuid);
            set("country", label);
          }}
        >
          <option value="">—</option>
        {countries.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>

      {([
        { key: "address_line_1", label: "Address Line 1" },
        { key: "address_line_2", label: "Address Line 2" },
        { key: "zip_code", label: "ZIP Code" },
        { key: "iban", label: "IBAN" },
        { key: "swift", label: "SWIFT" },
        { key: "director", label: "Director" },
        { key: "director_id", label: "Director ID" },
        { key: "email", label: "Email", type: "email" },
        { key: "phone", label: "Phone" },
        { key: "oris_id", label: "ORIS ID" },
      ] as const).map((f) => (
        <label key={f.key} className="flex flex-col">
          <span className="text-sm text-gray-600">{f.label}</span>
          <input
            type={(f as any).type ?? "text"}
            className="border rounded px-2 py-1"
            value={(values[f.key] as any) ?? ""}
            onChange={(e) => set(f.key, e.target.value)}
          />
        </label>
      ))}

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          className="border rounded px-3 py-1 bg-blue-600 text-white disabled:opacity-50"
          disabled={saving}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
'@
Write-Utf8NoBom (Join-Path $CounteragentsDir "CounteragentForm.tsx") $formTsx

# -----------------------------------------------------------------------------
# 7) Table: wide, filter/sort/paginate, export XLSX of filtered set
# -----------------------------------------------------------------------------
$tableTsx = @'
"use client";
import React from "react";
import {
  ColumnDef, flexRender, getCoreRowModel, getSortedRowModel,
  getFilteredRowModel, getPaginationRowModel, useReactTable,
} from "@tanstack/react-table";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

type Row = {
  id: number;
  created_at: string | null;
  updated_at: string | null;
  ts: string | null;

  name: string;
  identification_number?: string | null;
  birth_or_incorporation_date?: string | null;
  entity_type?: string | null;
  sex?: string | null;
  pension_scheme?: string | null;
  country?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  zip_code?: string | null;
  iban?: string | null;
  swift?: string | null;
  director?: string | null;
  director_id?: string | null;
  email?: string | null;
  phone?: string | null;
  oris_id?: string | null;

  counteragent?: string | null;
  country_uuid?: string | null;
  entity_type_uuid?: string | null;
  counteragent_uuid?: string | null;
  internal_number?: string | null;
};

function d8(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export default function CounteragentsTable({ data }: { data: Row[] }) {
  const columns = React.useMemo<ColumnDef<Row>[]>(
    () => [
      { accessorKey: "id", header: "id" },
      { accessorKey: "name", header: "Name" },
      { accessorKey: "identification_number", header: "ID" },
      {
        accessorKey: "birth_or_incorporation_date",
        header: "Birth or Incorporation Date",
        cell: ({ getValue }) => d8(getValue<string | null>()),
      },
      { accessorKey: "entity_type", header: "Entity Type" },
      { accessorKey: "sex", header: "Sex" },
      { accessorKey: "pension_scheme", header: "Pension Scheme" },
      { accessorKey: "country", header: "Country" },
      { accessorKey: "address_line_1", header: "Address Line 1" },
      { accessorKey: "address_line_2", header: "Address Line 2" },
      { accessorKey: "zip_code", header: "ZIP Code" },
      { accessorKey: "iban", header: "IBAN" },
      { accessorKey: "swift", header: "SWIFT" },
      { accessorKey: "director", header: "Director" },
      { accessorKey: "director_id", header: "Director ID" },
      { accessorKey: "email", header: "Email" },
      { accessorKey: "phone", header: "Phone" },
      { accessorKey: "oris_id", header: "ORIS ID" },
    ],
    []
  );

  const [sorting, setSorting] = React.useState([]);
  const [globalFilter, setGlobalFilter] = React.useState("");

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting as any,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  function exportXlsxAll() {
    const rows = table.getFilteredRowModel().rows.map((r) => r.original);
    const ws = XLSX.utils.json_to_sheet(
      rows.map((r) => ({
        id: r.id,
        Name: r.name ?? "",
        ID: r.identification_number ?? "",
        "Birth or Incorporation Date": d8(r.birth_or_incorporation_date),
        "Entity Type": r.entity_type ?? "",
        Sex: r.sex ?? "",
        "Pension Scheme": r.pension_scheme ?? "",
        Country: r.country ?? "",
        "Address Line 1": r.address_line_1 ?? "",
        "Address Line 2": r.address_line_2 ?? "",
        "ZIP Code": r.zip_code ?? "",
        IBAN: r.iban ?? "",
        SWIFT: r.swift ?? "",
        Director: r.director ?? "",
        "Director ID": r.director_id ?? "",
        Email: r.email ?? "",
        Phone: r.phone ?? "",
        "ORIS ID": r.oris_id ?? "",
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Counteragents");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `counteragents_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-3 mb-3">
        <input
          className="border rounded px-2 py-1 w-72"
          placeholder="Filter..."
          value={globalFilter ?? ""}
          onChange={(e) => setGlobalFilter(e.target.value)}
        />
        <button className="border rounded px-3 py-1" onClick={exportXlsxAll}>
          Export XLSX
        </button>
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="min-w-[1200px] w-full text-sm">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="text-left font-medium px-3 py-2 cursor-pointer select-none"
                    onClick={h.column.getToggleSortingHandler()}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {{
                      asc: " ▲",
                      desc: " ▼",
                    }[h.column.getIsSorted() as string] ?? null}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr key={r.id} className="odd:bg-white even:bg-gray-50">
                {r.getVisibleCells().map((c) => (
                  <td key={c.id} className="px-3 py-2">
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-3 text-sm">
        <div>
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </div>
        <div className="flex items-center gap-2">
          <button className="border rounded px-2 py-1"
            onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Prev</button>
          <button className="border rounded px-2 py-1"
            onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</button>
          <select
            className="border rounded px-2 py-1"
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
          >
            {[10, 25, 50, 100, 250, 500].map((n) => (
              <option key={n} value={n}>Show {n}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
'@
Write-Utf8NoBom (Join-Path $CounteragentsDir "CounteragentsTable.tsx") $tableTsx

# -----------------------------------------------------------------------------
# -----------------------------------------------------------------------------
# 8) Prisma migrate & generate (Windows-safe: call local prisma.cmd directly)
# -----------------------------------------------------------------------------
if (-not $SkipMigrate) {
  $PrismaBin = Join-Path $Root "node_modules\.bin\prisma.cmd"
  if (!(Test-Path $PrismaBin)) {
    throw "Prisma binary not found at $PrismaBin. Run 'npm install' first."
  }

  Write-Host "`n=> Running: prisma migrate dev -n counteragents_reset" -ForegroundColor Cyan
  & $PrismaBin migrate dev -n "counteragents_reset"
  if ($LASTEXITCODE -ne 0) { throw "prisma migrate failed" }

  Write-Host "=> Running: prisma generate" -ForegroundColor Cyan
  & $PrismaBin generate
  if ($LASTEXITCODE -ne 0) { throw "prisma generate failed" }
}

Write-Host "`n`u2705 Counteragents dictionary applied." -ForegroundColor Green
Write-Host "Open: http://localhost:3000/dictionaries/counteragents"
