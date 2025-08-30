"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

type Row = {
  id: number;
  createdAt: string | null;
  updatedAt: string | null;
  ts: string | null;
  entity_type_uuid: string;
  code: string;
  name_en: string;
  name_ka: string;
  is_active: boolean;
};

export default function EntityTypesTable({ data }: { data: Row[] }) {
  const [rowsPerPage, setRowsPerPage] = useState<number>(50);
  const [page, setPage] = useState(1);

  // header filters
  const [fCode, setFCode] = useState("");
  const [fNameEn, setFNameEn] = useState("");
  const [fNameKa, setFNameKa] = useState("");
  const [fActive, setFActive] = useState<"" | "yes" | "no">("");

  const filtered = useMemo(() => {
    const code = fCode.trim().toLowerCase();
    const en = fNameEn.trim().toLowerCase();
    const ka = fNameKa.trim().toLowerCase();
    return data.filter((r) => {
      if (code && !r.code.toLowerCase().includes(code)) return false;
      if (en && !r.name_en.toLowerCase().includes(en)) return false;
      if (ka && !r.name_ka.toLowerCase().includes(ka)) return false;
      if (fActive === "yes" && !r.is_active) return false;
      if (fActive === "no" && r.is_active) return false;
      return true;
    });
  }, [data, fCode, fNameEn, fNameKa, fActive]);

  // paging
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * rowsPerPage;
  const pageRows = filtered.slice(start, start + rowsPerPage);

  // export ALL filtered rows (not just current page)
  const exportXlsxAllFiltered = () => {
    const exportRows = filtered.map((r) => ({
      ID: r.id,
      Code: r.code,
      "Name (EN)": r.name_en,
      "Name (KA)": r.name_ka,
      Active: r.is_active ? "Yes" : "No",
      UUID: r.entity_type_uuid,
      CreatedAt: r.createdAt ?? "",
      UpdatedAt: r.updatedAt ?? "",
      TS: r.ts ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "entity_types");
    XLSX.writeFile(wb, "entity_types.xlsx");
  };

  return (
    <div className="overflow-x-auto">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="text-sm text-gray-600">
          Showing {total ? `${start + 1}–${Math.min(start + rowsPerPage, total)}` : "0"} of {total}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <label className="text-sm">Rows per page</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setPage(1);
            }}
          >
            {[25, 50, 100, 250, 500].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>

          <div className="inline-flex border rounded overflow-hidden">
            <button
              className="px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-40"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
            >
              ‹
            </button>
            <div className="px-3 py-1 text-sm border-l border-r">
              Page {safePage} / {totalPages}
            </div>
            <button
              className="px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-40"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
            >
              ›
            </button>
          </div>

          <button
            className="border rounded px-3 py-1 text-sm hover:bg-gray-50"
            onClick={exportXlsxAllFiltered}
            title="Export all filtered rows"
          >
            Export XLSX (all filtered)
          </button>
        </div>
      </div>

      <table className="min-w-[1000px] w-full border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="border px-2 py-1 text-left w-20">ID</th>
            <th className="border px-2 py-1 text-left w-40">Code</th>
            <th className="border px-2 py-1 text-left">Name (EN)</th>
            <th className="border px-2 py-1 text-left">Name (KA)</th>
            <th className="border px-2 py-1 text-left w-24">Active</th>
          </tr>
          <tr>
            <th className="border px-2 py-1 text-left text-xs text-gray-500">—</th>
            <th className="border px-2 py-1">
              <input
                className="w-full border rounded px-2 py-1 text-sm"
                placeholder="Filter code…"
                value={fCode}
                onChange={(e) => { setFCode(e.target.value); setPage(1); }}
              />
            </th>
            <th className="border px-2 py-1">
              <input
                className="w-full border rounded px-2 py-1 text-sm"
                placeholder="Filter EN…"
                value={fNameEn}
                onChange={(e) => { setFNameEn(e.target.value); setPage(1); }}
              />
            </th>
            <th className="border px-2 py-1">
              <input
                className="w-full border rounded px-2 py-1 text-sm"
                placeholder="Filter KA…"
                value={fNameKa}
                onChange={(e) => { setFNameKa(e.target.value); setPage(1); }}
              />
            </th>
            <th className="border px-2 py-1">
              <select
                className="w-full border rounded px-2 py-1 text-sm"
                value={fActive}
                onChange={(e) => { setFActive(e.target.value as "" | "yes" | "no"); setPage(1); }}
              >
                <option value="">Any</option>
                <option value="yes">Active</option>
                <option value="no">Inactive</option>
              </select>
            </th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((r) => (
            <tr key={r.id} className="odd:bg-white even:bg-gray-50">
              <td className="border px-2 py-1">{r.id}</td>
              <td className="border px-2 py-1">{r.code}</td>
              <td className="border px-2 py-1">{r.name_en}</td>
              <td className="border px-2 py-1">{r.name_ka}</td>
              <td className="border px-2 py-1">{r.is_active ? "Yes" : "No"}</td>
            </tr>
          ))}
          {pageRows.length === 0 && (
            <tr>
              <td className="border px-2 py-6 text-center text-gray-500" colSpan={5}>
                No rows
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
