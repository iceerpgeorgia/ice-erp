"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";

export type CountryRow = {
  id: number | string;
  name_en: string;
  name_ka?: string;
  iso2?: string;
  iso3?: string;
  un_code?: number | null;
  is_active?: boolean;
};

type Props = {
  initialRows?: CountryRow[];
  onAdd?: (row: CountryRow) => void;
};

const defaultColumns = [
  { key: "name_en", label: "English Name" },
  { key: "name_ka", label: "Georgian Name" },
  { key: "iso2", label: "ISO2" },
  { key: "iso3", label: "ISO3" },
  { key: "un_code", label: "UN Code" },
  { key: "is_active", label: "Status" },
];

export default function IceTable({ initialRows = [], onAdd }: Props) {
  const [rows, setRows] = useState<CountryRow[]>(initialRows);
  const [search, setSearch] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    defaultColumns.map((c) => c.key)
  );
  const [showColumns, setShowColumns] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  // Add row locally and call onAdd if provided
  function addRow(payload: Omit<CountryRow, "id">) {
    const next: CountryRow = { id: Date.now(), ...payload } as CountryRow;
    setRows((s) => [next, ...s]);
    onAdd?.(next);
  }

  // Search / filter logic (simple cross-field search)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      Object.values(r)
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, search]);

  // Accessibility: close modals on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowColumns(false);
        setShowAdd(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Column toggle helper
  function toggleColumn(key: string) {
    setVisibleColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  // Add form initial state
  const formRef = useRef<HTMLFormElement | null>(null);

  return (
    <section aria-labelledby="countries-title" className="px-6 py-8">
      <div className="max-w-[1100px] mx-auto">
        <header className="flex items-start justify-between mb-4">
          <div>
            <h2 id="countries-title" className="text-2xl font-semibold text-slate-900">
              Countries
            </h2>
            <p className="mt-1 text-sm text-slate-500">Manage country data with search, filters and dialogs</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded px-3 py-1">
              <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M10 20v-6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 4v12" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 10h12" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <button
                type="button"
                className="text-sm text-slate-800"
                onClick={() => setShowColumns(true)}
                aria-haspopup="dialog"
                aria-expanded={showColumns}
              >
                Columns
              </button>
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm px-3 py-2 rounded"
              onClick={() => setShowAdd(true)}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Add Country
            </button>
          </div>
        </header>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 w-[360px]">
            <label htmlFor="countries-search" className="sr-only">Search countries</label>
            <div className="relative flex-1">
              <input
                id="countries-search"
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white"
                placeholder="Search across all fields..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search countries"
              />
            </div>
          </div>

          <div className="text-sm text-slate-500">Showing {filtered.length} of {rows.length}</div>
        </div>

        {/* Table */}
        <div className="overflow-auto border border-slate-200 rounded-lg bg-white">
          <table className="min-w-full text-sm" role="table">
            <caption className="sr-only">Countries list</caption>
            <thead className="bg-slate-50">
              <tr>
                {defaultColumns.map((c) =>
                  visibleColumns.includes(c.key) ? (
                    <th key={c.key} scope="col" className="px-4 py-3 text-left text-slate-700 font-normal">
                      <div className="flex items-center gap-2">
                        <span>{c.label}</span>
                        <button aria-label={`Sort ${c.label}`} className="text-slate-400 hover:text-slate-600">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path d="M6 9l6-6 6 6" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    </th>
                  ) : null
                )}
                <th className="px-4 py-3 text-left text-slate-700 font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="px-4 py-10 text-center text-slate-400">
                    No rows match your search.
                  </td>
                </tr>
              )}

              {filtered.map((r) => (
                <tr key={r.id} className="border-t last:border-b-0">
                  {visibleColumns.includes("name_en") && (
                    <td className="px-4 py-3 align-top">{r.name_en}</td>
                  )}
                  {visibleColumns.includes("name_ka") && (
                    <td className="px-4 py-3 align-top">{r.name_ka ?? ""}</td>
                  )}
                  {visibleColumns.includes("iso2") && (
                    <td className="px-4 py-3 align-top">{r.iso2 ?? ""}</td>
                  )}
                  {visibleColumns.includes("iso3") && (
                    <td className="px-4 py-3 align-top">{r.iso3 ?? ""}</td>
                  )}
                  {visibleColumns.includes("un_code") && (
                    <td className="px-4 py-3 align-top">{r.un_code ?? ""}</td>
                  )}
                  {visibleColumns.includes("is_active") && (
                    <td className="px-4 py-3 align-top">
                      {r.is_active ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-100 text-green-800">Active</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-red-50 text-red-700">Inactive</span>
                      )}
                    </td>
                  )}

                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <button className="text-slate-600 hover:text-slate-900" aria-label={`Edit ${r.name_en}`}>
                        Edit
                      </button>
                      <button className="text-slate-600 hover:text-slate-900" aria-label={`Toggle ${r.name_en}`}>
                        {r.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Columns dialog (simple) */}
      {showColumns && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Column settings"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4"
        >
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h3 className="text-lg font-medium">Column settings</h3>
            <p className="text-sm text-slate-500 mt-1 mb-4">Toggle which columns are visible in the table.</p>
            <div className="flex flex-col gap-2">
              {defaultColumns.map((c) => (
                <label key={c.key} className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(c.key)}
                    onChange={() => toggleColumn(c.key)}
                    className="form-checkbox"
                  />
                  <span className="text-sm">{c.label}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-2 rounded bg-slate-100" onClick={() => setShowColumns(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Country dialog */}
      {showAdd && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add country"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4"
        >
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6">
            <h3 className="text-lg font-medium">Add Country</h3>
            <form
              ref={formRef}
              className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(formRef.current as HTMLFormElement);
                const payload = {
                  name_en: String(fd.get("name_en") ?? "").trim(),
                  name_ka: String(fd.get("name_ka") ?? "").trim(),
                  iso2: String(fd.get("iso2") ?? "").trim(),
                  iso3: String(fd.get("iso3") ?? "").trim(),
                  un_code: fd.get("un_code") ? Number(fd.get("un_code")) : undefined,
                  is_active: fd.get("is_active") === "on",
                } as Omit<CountryRow, "id">;
                addRow(payload);
                setShowAdd(false);
              }}
            >
              <label className="flex flex-col">
                <span className="text-sm text-slate-600">English Name</span>
                <input name="name_en" required className="mt-1 px-3 py-2 border rounded" />
              </label>
              <label className="flex flex-col">
                <span className="text-sm text-slate-600">Georgian Name</span>
                <input name="name_ka" className="mt-1 px-3 py-2 border rounded" />
              </label>

              <label className="flex flex-col">
                <span className="text-sm text-slate-600">ISO2</span>
                <input name="iso2" className="mt-1 px-3 py-2 border rounded" />
              </label>
              <label className="flex flex-col">
                <span className="text-sm text-slate-600">ISO3</span>
                <input name="iso3" className="mt-1 px-3 py-2 border rounded" />
              </label>

              <label className="flex flex-col">
                <span className="text-sm text-slate-600">UN Code</span>
                <input name="un_code" type="number" className="mt-1 px-3 py-2 border rounded" />
              </label>
              <label className="flex items-center gap-2 mt-6 md:mt-0">
                <input name="is_active" type="checkbox" className="w-4 h-4" defaultChecked />
                <span className="text-sm text-slate-600">Active</span>
              </label>

              <div className="col-span-1 md:col-span-2 flex justify-end gap-2 mt-3">
                <button type="button" className="px-4 py-2 rounded bg-slate-100" onClick={() => setShowAdd(false)}>
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded bg-slate-900 text-white">
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
