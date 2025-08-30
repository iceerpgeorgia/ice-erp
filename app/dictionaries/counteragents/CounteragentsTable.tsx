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