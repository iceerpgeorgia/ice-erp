"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  updatedBy?: string;
};

export default function EntityTypesTable({ data, design }: { data: Row[]; design?: any }) {
  const router = useRouter();
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

  // Optional design-driven columns
  type RenderCol = { field: string; label: string; width?: number; align?: 'left'|'center'|'right'; render: (r: Row) => React.ReactNode };
  const renderCols = useMemo<RenderCol[] | null>(() => {
    if (!design) return null;
    const order: string[] = Array.isArray(design.ui?.visibleColumns) && design.ui.visibleColumns.length
      ? design.ui.visibleColumns
      : ["code","name_en","name_ka","is_active","updatedBy"];
    const colMap: Record<string, any> = {};
    if (Array.isArray(design.columns)) {
      for (const c of design.columns) {
        const key = (c && (c.name || c.field || c.key)) as string | undefined;
        if (key) colMap[key] = c;
      }
    }
    const toLabel = (f: string) => colMap[f]?.label || f;
    const toAlign = (f: string): any => (['left','center','right'].includes(colMap[f]?.align) ? colMap[f].align : undefined);
    const toWidth = (f: string) => (typeof colMap[f]?.width === 'number' ? colMap[f].width : undefined);
    const fmt = (f: string, r: Row) => {
      if (f === 'is_active') return r.is_active ? 'Yes' : 'No';
      return (r as any)[f] ?? '';
    };
    const cols: RenderCol[] = order.map((f) => ({ field: f, label: toLabel(f), width: toWidth(f), align: toAlign(f), render: (r: Row) => fmt(f, r) }));
    const actions: string[] | undefined = design.ui?.actions;
    if (Array.isArray(actions) && actions.length) {
      cols.push({ field: '__actions', label: 'Actions', width: 160, align: 'left', render: (r: Row) => (
        <div className="whitespace-nowrap">
          {actions.includes('edit') && (
            <a className="text-blue-600 hover:underline mr-2" href={`/dictionaries/entity-types/${r.id}/edit`}>Edit</a>
          )}
          {actions.includes('history') && (
            <a className="text-gray-700 hover:underline mr-2" href={`/dictionaries/entity-types/${r.id}/history`}>History</a>
          )}
          {actions.includes('delete') && (
            r.is_active ? (
              <button
                className="text-red-700 hover:underline"
                onClick={async () => {
                  if (!confirm('Deactivate this entity type?')) return;
                  await fetch(`/dictionaries/entity-types/api?id=${r.id}`, { method: 'DELETE' });
                  router.refresh();
                }}
              >Deactivate</button>
            ) : (
              <button
                className="text-green-700 hover:underline"
                onClick={async () => {
                  await fetch(`/dictionaries/entity-types/api?id=${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: true }) });
                  router.refresh();
                }}
              >Activate</button>
            )
          )}
        </div>
      )});
    }
    return cols;
  }, [design, router]);

  // Design tokens for styling
  const headerBg: string | undefined = design?.ui?.headerBg;
  const headerText: string | undefined = design?.ui?.headerText;
  const borderColor: string | undefined = design?.ui?.borderColor;
  const rowAltBg: string | undefined = design?.ui?.rowAltBg;
  const fontSize: string | undefined = design?.ui?.fontSize;
  const fontFamily: string | undefined = design?.ui?.fontFamily;
  const radius: number | string | undefined = design?.ui?.radius;
  const shadow: string | boolean | undefined = design?.ui?.shadow;
  const stickyHeader: boolean | undefined = design?.ui?.stickyHeader;
  const cellPaddingX: number | undefined = design?.ui?.cellPaddingX;
  const cellPaddingY: number | undefined = design?.ui?.cellPaddingY;
  const rowHeight: number | undefined = design?.ui?.rowHeight;

  return (
    <div className="overflow-x-auto" style={{ ...(radius ? { borderRadius: typeof radius === 'number' ? `${radius}px` : radius } : {}), ...(shadow ? { boxShadow: typeof shadow === 'string' ? shadow : '0 1px 2px rgba(0,0,0,0.06)' } : {}) }}>
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

      <table className="min-w-[1000px] w-full border-collapse" style={{ ...(fontSize ? { fontSize } : {}), ...(fontFamily ? { fontFamily } : {}) }}>
        <thead>
          <tr className={`bg-gray-50 ${stickyHeader ? 'sticky top-0 z-10' : ''}`}>
            {renderCols ? (
              renderCols.map((c) => (
                <th key={c.field} className={`border text-${c.align ?? 'left'}`} style={{ ...(c.width ? { width: c.width } : {}), ...(headerBg ? { backgroundColor: headerBg } : {}), ...(headerText ? { color: headerText } : {}), ...(borderColor ? { borderColor } : {}), paddingLeft: cellPaddingX ?? 8, paddingRight: cellPaddingX ?? 8, paddingTop: cellPaddingY ?? 6, paddingBottom: cellPaddingY ?? 6 }}>
                  {c.label}
                </th>
              ))
            ) : (
              <>
                <th className="border px-2 py-1 text-left w-20">ID</th>
                <th className="border px-2 py-1 text-left w-40">Code</th>
                <th className="border px-2 py-1 text-left">Name (EN)</th>
                <th className="border px-2 py-1 text-left">Name (KA)</th>
                <th className="border px-2 py-1 text-left w-24">Active</th>
                <th className="border px-2 py-1 text-left w-40">Updated By</th>
                <th className="border px-2 py-1 text-left w-24">Actions</th>
              </>
            )}
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
            <th className="border px-2 py-1"></th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((r, idx) => (
            <tr key={r.id} className="odd:bg-white even:bg-gray-50" style={rowAltBg && idx % 2 === 1 ? { backgroundColor: rowAltBg } : undefined}>
              {renderCols ? (
                renderCols.map((c) => (
                  <td key={c.field} className={`border text-${c.align ?? 'left'}`} style={{ ...(c.width ? { width: c.width } : {}), ...(borderColor ? { borderColor } : {}), paddingLeft: cellPaddingX ?? 8, paddingRight: cellPaddingX ?? 8, paddingTop: cellPaddingY ?? 4, paddingBottom: cellPaddingY ?? 4 }}>
                    {c.render(r)}
                  </td>
                ))
              ) : (
                <>
                  <td className="border px-2 py-1">{r.id}</td>
                  <td className="border px-2 py-1">{r.code}</td>
                  <td className="border px-2 py-1">{r.name_en}</td>
                  <td className="border px-2 py-1">{r.name_ka}</td>
                  <td className="border px-2 py-1">{r.is_active ? "Yes" : "No"}</td>
                  <td className="border px-2 py-1">{r.updatedBy ?? ""}</td>
                  <td className="border px-2 py-1">
                    <a className="text-blue-600 hover:underline mr-2" href={`/dictionaries/entity-types/${r.id}/edit`}>Edit</a>
                    <a className="text-gray-700 hover:underline mr-2" href={`/dictionaries/entity-types/${r.id}/history`}>History</a>
                    {r.is_active ? (
                      <button
                        className="text-red-700 hover:underline"
                        onClick={async () => {
                          if (!confirm('Deactivate this entity type?')) return;
                          await fetch(`/dictionaries/entity-types/api?id=${r.id}`, { method: 'DELETE' });
                          router.refresh();
                        }}
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        className="text-green-700 hover:underline"
                        onClick={async () => {
                          await fetch(`/dictionaries/entity-types/api?id=${r.id}`, { method: 'PATCH', headers: { 'Content': 'application/json' as any } as any, body: JSON.stringify({ active: true }) });
                          router.refresh();
                        }}
                      >
                        Activate
                      </button>
                    )}
                  </td>
                </>
              )}
            </tr>
          ))}
          {pageRows.length === 0 && (
            <tr>
              <td className="border px-2 py-6 text-center text-gray-500" colSpan={6}>
                No rows
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

