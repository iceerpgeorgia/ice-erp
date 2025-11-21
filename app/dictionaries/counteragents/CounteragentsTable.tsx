"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
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
  is_active?: boolean;
  updated_by?: string;
};

export default function CounteragentsTable({ data, design }: { data: Row[]; design?: any }) {
  const router = useRouter();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [globalFilter, setGlobalFilter] = React.useState("");

  // Build columns from design
  type RenderCol = {
    field: string;
    label: string;
    width?: number;
    align?: 'left' | 'center' | 'right';
    render: (r: Row) => React.ReactNode;
  };

  const renderCols: RenderCol[] = React.useMemo(() => {
    const fallback = [
      'name','identification_number','birth_or_incorporation_date','entity_type','sex','pension_scheme',
      'country','address_line_1','address_line_2','zip_code','iban','swift','director','director_id',
      'email','phone','oris_id','is_active','updated_by'
    ];
    const order: string[] = (design?.ui?.visibleColumns?.length ? design.ui.visibleColumns : fallback) as string[];

    const colMap: Record<string, any> = {};
    if (Array.isArray(design?.columns)) {
      for (const c of design.columns) {
        const key = (c && (c.name || c.field)) as string | undefined;
        if (key) colMap[key] = c;
      }
    }

    const toLabel = (f: string) => colMap[f]?.label || f;
    const toAlign = (f: string) => (['left','center','right'].includes(colMap[f]?.align) ? colMap[f]?.align : undefined) as any;
    const toWidth = (f: string) => (typeof colMap[f]?.width === 'number' ? colMap[f]?.width : undefined);

    const fmt = (f: string, r: Row) => {
      if (f === 'is_active') return r.is_active ? 'Yes' : 'No';
      return (r as any)[f] ?? '';
    };

    const cols = order.map((f) => ({ field: f, label: toLabel(f), align: toAlign(f), width: toWidth(f), render: (r: Row) => fmt(f, r) }));

    const actions: string[] | undefined = design?.ui?.actions;
    if (Array.isArray(actions) && actions.length) {
      cols.push({
        field: '__actions',
        label: 'Actions',
        width: 160,
        align: 'left',
        render: (r: Row) => (
          <div className="whitespace-nowrap">
            {actions.includes('edit') && (
              <a className="text-blue-600 hover:underline mr-2" href={`/dictionaries/counteragents/${r.id}`}>Edit</a>
            )}
            {actions.includes('history') && (
              <a className="text-gray-700 hover:underline mr-2" href={`/dictionaries/counteragents/${r.id}/history`}>History</a>
            )}
            {actions.includes('delete') && (
              <button
                className="text-red-700 hover:underline"
                onClick={async () => {
                  if (r.is_active) {
                    if (!confirm('Deactivate this counteragent?')) return;
                    await fetch(`/dictionaries/counteragents/api?id=${r.id}`, { method: 'DELETE' });
                  } else {
                    await fetch(`/dictionaries/counteragents/api?id=${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: true }) });
                  }
                  router.refresh();
                }}
              >
                {r.is_active ? 'Deactivate' : 'Activate'}
              </button>
            )}
          </div>
        )
      });
    }
    return cols;
  }, [design, router]);

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

  const filtered = React.useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    if (!q) return data;
    return data.filter((r) =>
      renderCols.some((c) => {
        if (c.field === '__actions') return false;
        const v = (r as any)[c.field];
        return v != null && String(v).toLowerCase().includes(q);
      })
    );
  }, [data, globalFilter, renderCols]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageClamped = Math.min(page, totalPages);
  const start = (pageClamped - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  function exportXlsx() {
    const exportCols = renderCols.filter((c) => c.field !== '__actions');
    const header = exportCols.map((c) => c.label);
    const rows = filtered.map((r) => exportCols.map((c) => (r as any)[c.field] ?? ''));
    const ws = utils.aoa_to_sheet([header, ...rows]);
    const wb = utils.book_new(); utils.book_append_sheet(wb, ws, "Counteragents");
    writeFileXLSX(wb, "counteragents.xlsx");
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-2">
        <input value={globalFilter} onChange={(e) => { setGlobalFilter(e.target.value); setPage(1); }} placeholder="Filter..." className="border rounded px-2 py-1" />
        <button onClick={exportXlsx} className="ml-auto px-3 py-1.5 border rounded">Export XLSX (filtered)</button>
      </div>

      <div className="overflow-x-auto border rounded" style={{ ...(radius ? { borderRadius: typeof radius === 'number' ? `${radius}px` : radius } : {}), ...(shadow ? { boxShadow: typeof shadow === 'string' ? shadow : '0 1px 2px rgba(0,0,0,0.06)' } : {}) }}>
        <table className="min-w-full table-fixed" style={{ ...(fontSize ? { fontSize } : {}), ...(fontFamily ? { fontFamily } : {}) }}>
          <thead>
            <tr className={`bg-gray-50 ${stickyHeader ? 'sticky top-0 z-10' : ''}`}>
              {renderCols.map((c) => (
                <th key={c.field} className={`border-b text-${c.align ?? 'left'}`} style={{ ...(c.width ? { width: c.width } : {}), ...(headerBg ? { backgroundColor: headerBg } : {}), ...(headerText ? { color: headerText } : {}), ...(borderColor ? { borderColor } : {}), paddingLeft: cellPaddingX ?? 8, paddingRight: cellPaddingX ?? 8, paddingTop: cellPaddingY ?? 6, paddingBottom: cellPaddingY ?? 6 }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, idx) => (
              <tr key={r.id} className="odd:bg-white even:bg-gray-50" style={{ ...(rowAltBg && idx % 2 === 1 ? { backgroundColor: rowAltBg } : {}), ...(rowHeight ? { height: rowHeight } : {}) }}>
                {renderCols.map((c) => (
                  <td key={c.field} className={`border-b text-${c.align ?? 'left'}`} style={{ ...(c.width ? { width: c.width } : {}), ...(borderColor ? { borderColor } : {}), paddingLeft: cellPaddingX ?? 8, paddingRight: cellPaddingX ?? 8, paddingTop: cellPaddingY ?? 4, paddingBottom: cellPaddingY ?? 4 }}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td className="px-3 py-4 text-gray-500" colSpan={renderCols.length}>No rows</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pageClamped === 1} className="px-2 py-1 border rounded">Prev</button>
        <span>Page {pageClamped} of {totalPages}</span>
        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={pageClamped === totalPages} className="px-2 py-1 border rounded">Next</button>
        <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="ml-2 border rounded px-2 py-1">
          {[10,25,50,100].map(n => <option key={n} value={n}>Show {n}</option>)}
        </select>
      </div>
    </div>
  );
}
