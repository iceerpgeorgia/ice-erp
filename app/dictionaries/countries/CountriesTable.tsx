'use client';

import React, { useMemo, useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

export type CountryRow = {
  id: number;
  name_en: string;
  name_ka: string;
  iso2: string;
  iso3: string;
  un_code: number | null;
  country?: string | null; // label from DB trigger
};

type Props = {
  rows: CountryRow[];
};

export default function CountriesTable({ rows }: Props) {
  // ---- DEBUG (client) -------------------------------------------
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    console.log('[CountriesTable] rows length:', rows.length);
    console.log('[CountriesTable] first row keys:', rows[0] ? Object.keys(rows[0]) : []);
    console.table(
      rows.slice(0, 10).map((r) => ({
        id: r.id,
        iso2: r.iso2,
        name_en: r.name_en,
        country: r.country,
      }))
    );
  }, [rows]);

  const rowsMissingCountry = useMemo(
    () => rows.filter((r) => !(r.country ?? '').trim()),
    [rows]
  );
  // ---------------------------------------------------------------

  // filters
  const [fEN, setFEN] = useState('');
  const [fKA, setFKA] = useState('');
  const [fISO2, setFISO2] = useState('');
  const [fISO3, setFISO3] = useState('');
  const [fUN, setFUN] = useState('');
  const [fCountry, setFCountry] = useState('');

  // paging
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(250);

  const filtered = useMemo(() => {
    const en = fEN.trim().toLowerCase();
    const ka = fKA.trim().toLowerCase();
    const iso2 = fISO2.trim().toLowerCase();
    const iso3 = fISO3.trim().toLowerCase();
    const un = fUN.trim().toLowerCase();
    const country = fCountry.trim().toLowerCase();

    return rows.filter((r) => {
      if (en && !(`${r.name_en ?? ''}`.toLowerCase().includes(en))) return false;
      if (ka && !(`${r.name_ka ?? ''}`.toLowerCase().includes(ka))) return false;
      if (iso2 && !(`${r.iso2 ?? ''}`.toLowerCase().includes(iso2))) return false;
      if (iso3 && !(`${r.iso3 ?? ''}`.toLowerCase().includes(iso3))) return false;
      if (un && !(`${r.un_code ?? ''}`.toString().toLowerCase().includes(un))) return false;
      if (country && !(`${r.country ?? ''}`.toLowerCase().includes(country))) return false;
      return true;
    });
  }, [rows, fEN, fKA, fISO2, fISO3, fUN, fCountry]);

  // paging derived
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageClamped = Math.min(page, totalPages);
  const start = (pageClamped - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  // export ALL filtered rows (not just current page)
  const exportFilteredToXlsx = () => {
    const header = ['ID', 'Name (EN)', 'Name (KA)', 'ISO2', 'ISO3', 'UN', 'Country'];
    const data = filtered.map((r) => [
      r.id,
      r.name_en ?? '',
      r.name_ka ?? '',
      r.iso2 ?? '',
      r.iso3 ?? '',
      r.un_code ?? '',
      r.country ?? '',
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Countries');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'countries.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full">
      {/* Controls / Toolbar */}
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-gray-600">
          Showing {start + 1}-{Math.min(start + pageSize, total)} of {total}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportFilteredToXlsx}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
            type="button"
          >
            Export XLSX (filtered)
          </button>

          <label className="text-sm text-gray-600 ml-2">Rows per page</label>
          <select
            className="rounded border px-2 py-1 text-sm"
            value={pageSize}
            onChange={(e) => {
              setPageSize(parseInt(e.target.value, 10));
              setPage(1);
            }}
          >
            {[25, 50, 100, 250, 500, 1000].map((n) => (
              <option value={n} key={n}>
                {n}
              </option>
            ))}
          </select>

          <div className="ml-2 flex items-center gap-1">
            <button
              className="rounded border px-2 py-1 text-sm disabled:opacity-40"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pageClamped === 1}
              type="button"
              aria-label="Previous page"
              title="Previous page"
            >
              ‹
            </button>
            <span className="text-sm">
              Page {pageClamped} / {totalPages}
            </span>
            <button
              className="rounded border px-2 py-1 text-sm disabled:opacity-40"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={pageClamped === totalPages}
              type="button"
              aria-label="Next page"
              title="Next page"
            >
              ›
            </button>
          </div>

          {/* Debug toggle */}
          <button
            onClick={() => setShowDebug((s) => !s)}
            className="ml-2 rounded border px-3 py-1 text-sm hover:bg-gray-50"
            type="button"
          >
            {showDebug ? 'Hide Debug' : 'Show Debug'}
          </button>
        </div>
      </div>

      {/* Client-side debug panel */}
      {showDebug && (
        <div className="mb-3 rounded border bg-blue-50 p-3 text-blue-900">
          <div className="font-medium">Client Debug</div>
          <ul className="text-sm list-disc pl-5">
            <li>Total rows received: <b>{rows.length}</b></li>
            <li>Rows missing <code>country</code>: <b>{rowsMissingCountry.length}</b></li>
          </ul>
          <details className="mt-2">
            <summary className="cursor-pointer text-sm underline">First 10 rows (id, iso2, country)</summary>
            <pre className="mt-2 overflow-x-auto text-xs">
{JSON.stringify(
  rows.slice(0, 10).map((r) => ({ id: r.id, iso2: r.iso2, country: r.country })),
  null,
  2
)}
            </pre>
          </details>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1 text-left w-20">ID</th>
              <th className="border px-2 py-1 text-left min-w-[220px]">Name (EN)</th>
              <th className="border px-2 py-1 text-left min-w-[240px]">Name (KA)</th>
              <th className="border px-2 py-1 text-left w-24">ISO2</th>
              <th className="border px-2 py-1 text-left w-28">ISO3</th>
              <th className="border px-2 py-1 text-left w-24">UN</th>
              <th className="border px-2 py-1 text-left min-w-[260px]">Country</th>
            </tr>
            <tr>
              <th className="border px-2 py-1"></th>
              <th className="border px-2 py-1">
                <input
                  placeholder="Filter EN..."
                  className="w-full rounded border px-2 py-1"
                  value={fEN}
                  onChange={(e) => {
                    setFEN(e.target.value);
                    setPage(1);
                  }}
                />
              </th>
              <th className="border px-2 py-1">
                <input
                  placeholder="ფილტრი KA..."
                  className="w-full rounded border px-2 py-1"
                  value={fKA}
                  onChange={(e) => {
                    setFKA(e.target.value);
                    setPage(1);
                  }}
                />
              </th>
              <th className="border px-2 py-1">
                <input
                  placeholder="Filter ISO2..."
                  className="w-full rounded border px-2 py-1"
                  value={fISO2}
                  onChange={(e) => {
                    setFISO2(e.target.value);
                    setPage(1);
                  }}
                />
              </th>
              <th className="border px-2 py-1">
                <input
                  placeholder="Filter ISO3..."
                  className="w-full rounded border px-2 py-1"
                  value={fISO3}
                  onChange={(e) => {
                    setFISO3(e.target.value);
                    setPage(1);
                  }}
                />
              </th>
              <th className="border px-2 py-1">
                <input
                  placeholder="Filter UN..."
                  className="w-full rounded border px-2 py-1"
                  value={fUN}
                  onChange={(e) => {
                    setFUN(e.target.value);
                    setPage(1);
                  }}
                />
              </th>
              <th className="border px-2 py-1">
                <input
                  placeholder="Filter Country..."
                  className="w-full rounded border px-2 py-1"
                  value={fCountry}
                  onChange={(e) => {
                    setFCountry(e.target.value);
                    setPage(1);
                  }}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const missing = !(r.country ?? '').trim();
              return (
                <tr key={r.id} className={`even:bg-gray-50 ${missing ? 'bg-red-50' : ''}`}>
                  <td className="border px-2 py-1">{r.id}</td>
                  <td className="border px-2 py-1">{r.name_en}</td>
                  <td className="border px-2 py-1">{r.name_ka}</td>
                  <td className="border px-2 py-1">{r.iso2}</td>
                  <td className="border px-2 py-1">{r.iso3}</td>
                  <td className="border px-2 py-1">{r.un_code ?? ''}</td>
                  <td className="border px-2 py-1" title={r.country ?? ''}>
                    {missing ? <span className="text-red-700 italic">[missing]</span> : r.country}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="border px-2 py-8 text-center text-gray-500">
                  No rows match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
