// scripts/apply-countries-ui.js
// Usage:
//   npm run apply:countries-ui
//   npm run apply:countries-ui:route -- --route countries
// Writes/updates: app/<route>/page.tsx and app/<route>/CountriesTable.tsx

const fs = require("fs");
const path = require("path");

function parseArgs() {
  const out = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--route") out.route = args[++i];
  }
  return out;
}

const { route = "dictionaries/countries" } = parseArgs();
const routeDir = path.join(process.cwd(), "app", route);
const pagePath = path.join(routeDir, "page.tsx");
const tablePath = path.join(routeDir, "CountriesTable.tsx");

fs.mkdirSync(routeDir, { recursive: true });

function backupIfExists(p) {
  if (fs.existsSync(p)) {
    const bak = p + ".bak";
    fs.copyFileSync(p, bak);
    console.log("• backup:", path.relative(process.cwd(), bak));
  }
}

const pageTsx = `// app/${route}/page.tsx
import { PrismaClient } from "@prisma/client";
import CountriesTable from "./CountriesTable";

type SP = { [k: string]: string | string[] | undefined };

function getParam(sp: SP, key: string, fallback = "") {
  const v = sp?.[key];
  return Array.isArray(v) ? v[0] ?? fallback : (v ?? fallback);
}

function getInt(sp: SP, key: string, fallback: number) {
  const raw = getParam(sp, key, String(fallback));
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams?: SP }) {
  const prisma = new PrismaClient();
  const sp = searchParams ?? {};

  const page = Math.max(1, getInt(sp, "page", 1));
  const allowed = [10, 25, 50, 100, 250];
  const pageSizeRaw = getInt(sp, "pageSize", 25);
  const pageSize = allowed.includes(pageSizeRaw) ? pageSizeRaw : 25;

  const filters = {
    name_en: getParam(sp, "name_en"),
    name_ka: getParam(sp, "name_ka"),
    iso2: getParam(sp, "iso2"),
    iso3: getParam(sp, "iso3"),
    un_code: getParam(sp, "un_code"),
  };

  const where: any = {};
  if (filters.name_en) where.name_en = { contains: filters.name_en, mode: "insensitive" };
  if (filters.name_ka) where.name_ka = { contains: filters.name_ka, mode: "insensitive" };
  if (filters.iso2) where.iso2 = { startsWith: filters.iso2.toUpperCase() };
  if (filters.iso3) where.iso3 = { startsWith: filters.iso3.toUpperCase() };
  if (filters.un_code && /^\\d+$/.test(filters.un_code)) where.un_code = parseInt(filters.un_code, 10);

  const [rows, total] = await Promise.all([
    prisma.countries.findMany({
      where,
      select: { id: true, name_en: true, name_ka: true, iso2: true, iso3: true, un_code: true },
      orderBy: [{ name_en: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.countries.count({ where }),
  ]);

  const safeRows = rows.map((r) => ({ ...r, id: Number(r.id) }));

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <h1 className="text-3xl font-semibold mb-4">Countries</h1>
      <a href="/dictionaries/countries/new" className="text-blue-600 hover:underline inline-block mb-4">
        + New country
      </a>

      <CountriesTable
        rows={safeRows}
        total={total}
        page={page}
        pageSize={pageSize}
        filters={filters}
      />
    </div>
  );
}
`;

const tableTsx = `// app/${route}/CountriesTable.tsx
"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as XLSX from "xlsx";

type Row = {
  id: number;
  name_en: string;
  name_ka: string;
  iso2: string;
  iso3: string;
  un_code: number | null;
};

const PAGE_SIZES = [10, 25, 50, 100, 250];

export default function CountriesTable({
  rows,
  total,
  page,
  pageSize,
  filters,
}: {
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  filters: { [k: string]: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState({
    name_en: filters.name_en ?? "",
    name_ka: filters.name_ka ?? "",
    iso2: filters.iso2 ?? "",
    iso3: filters.iso3 ?? "",
    un_code: filters.un_code ?? "",
  });

  useEffect(() => {
    setQ({
      name_en: filters.name_en ?? "",
      name_ka: filters.name_ka ?? "",
      iso2: filters.iso2 ?? "",
      iso3: filters.iso3 ?? "",
      un_code: filters.un_code ?? "",
    });
  }, [filters.name_en, filters.name_ka, filters.iso2, filters.iso3, filters.un_code]);

  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(total, page * pageSize);

  const buildUrl = useCallback(
    (patch: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      Object.entries(patch).forEach(([k, v]) => {
        if (v === undefined || v === "") params.delete(k);
        else params.set(k, String(v));
      });
      if ("name_en" in patch || "name_ka" in patch || "iso2" in patch || "iso3" in patch || "un_code" in patch || "pageSize" in patch) {
        params.set("page", "1");
      }
      return \`\${pathname}?\${params.toString()}\`;
    },
    [pathname, searchParams]
  );

  // Debounce filter updates
  useEffect(() => {
    const t = setTimeout(() => {
      router.push(
        buildUrl({
          name_en: q.name_en || undefined,
          name_ka: q.name_ka || undefined,
          iso2: q.iso2 || undefined,
          iso3: q.iso3 || undefined,
          un_code: q.un_code || undefined,
        })
      );
    }, 300);
    return () => clearTimeout(t);
  }, [q, buildUrl, router]);

  const onPageSizeChange = (n: number) => {
    router.push(buildUrl({ pageSize: n }));
  };

  const go = (p: number) =>
    router.push(buildUrl({ page: Math.min(Math.max(1, p), lastPage) }));

  const headerInput = (name: keyof typeof q, placeholder: string) => (
    <input
      className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
      value={q[name]}
      placeholder={placeholder}
      onChange={(e) => setQ((old) => ({ ...old, [name]: e.target.value }))}
    />
  );

  const exportXlsx = () => {
    const data = rows.map(r => ({
      ID: r.id,
      "Name (EN)": r.name_en,
      "Name (KA)": r.name_ka,
      ISO2: r.iso2,
      ISO3: r.iso3,
      "UN Code": r.un_code ?? ""
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Countries");
    XLSX.writeFile(wb, \`countries_page-\${page}_size-\${pageSize}.xlsx\`);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Top controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="text-sm text-gray-600">
          Showing <span className="font-medium">{showingFrom}</span>–
          <span className="font-medium">{showingTo}</span> of{" "}
          <span className="font-medium">{total}</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Rows per page:</label>
          <select
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            value={pageSize}
            onChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>

          <div className="ml-3 flex items-center gap-1">
            <button className="rounded border px-2 py-1 text-sm disabled:opacity-50"
                    onClick={() => go(1)} disabled={page <= 1} aria-label="First page">«</button>
            <button className="rounded border px-2 py-1 text-sm disabled:opacity-50"
                    onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Prev">‹</button>
            <span className="px-2 text-sm text-gray-700">Page <b>{page}</b> / {lastPage}</span>
            <button className="rounded border px-2 py-1 text-sm disabled:opacity-50"
                    onClick={() => go(page + 1)} disabled={page >= lastPage} aria-label="Next">›</button>
            <button className="rounded border px-2 py-1 text-sm disabled:opacity-50"
                    onClick={() => go(lastPage)} disabled={page >= lastPage} aria-label="Last">»</button>
          </div>

          <button onClick={exportXlsx}
                  className="ml-3 rounded border px-3 py-1 text-sm hover:bg-gray-50">
            Export XLSX (this page)
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-t border-gray-200">
          <thead className="sticky top-0 bg-gray-50">
            <tr className="text-left text-sm">
              <th className="px-3 py-2 w-20">ID</th>
              <th className="px-3 py-2">Name (EN)</th>
              <th className="px-3 py-2">Name (KA)</th>
              <th className="px-3 py-2 w-24">ISO2</th>
              <th className="px-3 py-2 w-28">ISO3</th>
              <th className="px-3 py-2 w-24">UN</th>
            </tr>
            <tr className="text-left text-sm border-y">
              <th className="px-3 py-2">{/* no filter for id */}</th>
              <th className="px-3 py-2">{headerInput("name_en", "Filter EN…")}</th>
              <th className="px-3 py-2">{headerInput("name_ka", "ფილტრი (KA)…")}</th>
              <th className="px-3 py-2">{headerInput("iso2", "Filter ISO2…")}</th>
              <th className="px-3 py-2">{headerInput("iso3", "Filter ISO3…")}</th>
              <th className="px-3 py-2">{headerInput("un_code", "Filter UN…")}</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-3 py-2 tabular-nums">{r.id}</td>
                <td className="px-3 py-2">{r.name_en}</td>
                <td className="px-3 py-2">{r.name_ka}</td>
                <td className="px-3 py-2">{r.iso2}</td>
                <td className="px-3 py-2">{r.iso3}</td>
                <td className="px-3 py-2">{r.un_code ?? ""}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-gray-500">
                  No countries match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
`;

function writeFile(p, contents) {
  backupIfExists(p);
  fs.writeFileSync(p, contents, "utf8");
  console.log("✓ wrote", path.relative(process.cwd(), p));
}

writeFile(pagePath, pageTsx);
writeFile(tablePath, tableTsx);

console.log("");
console.log("✅ Countries UI applied.");
console.log("Route:", "app/" + route);
console.log("Files:");
console.log("  -", path.relative(process.cwd(), pagePath));
console.log("  -", path.relative(process.cwd(), tablePath));
console.log("  (Backups created with .bak when originals existed.)");
