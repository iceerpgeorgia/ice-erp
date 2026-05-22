const fs = require("fs");

function rep(file, old, nw, label) {
  let s = fs.readFileSync(file, "utf8");
  if (!s.includes(old)) { console.error("MISS [" + file + "]:", label); process.exit(1); }
  s = s.replace(old, nw);
  fs.writeFileSync(file, s, "utf8");
  console.log("OK:", label);
}

// ── 1. projects-report-table.tsx ─────────────────────────────────────────────
const PR = "components/figma/projects-report-table.tsx";

// 1a. Update standalone waybill <th> — remove amber, add gray + filter link
rep(PR,
  `                        {proj.waybillSum > 0 && proj.waybillPairedFcCode && (
                          <th
                            className="bg-amber-50 border-r border-amber-200 relative overflow-hidden"
                            style={{ width: 80, minWidth: 80 }}
                            rowSpan={2}
                          >
                            <div className="px-2 py-1.5 text-center font-semibold text-amber-700 text-xs leading-tight">
                              <div>{proj.waybillPairedFcCode}</div>
                              <div className="text-[9px] font-normal text-amber-500">Waybill</div>
                            </div>
                          </th>
                        )}`,
  `                        {proj.waybillSum > 0 && proj.waybillPairedFcCode && (
                          <th
                            className="px-2 py-1.5 text-center font-semibold text-gray-700 border-r border-gray-200 text-xs bg-gray-100 overflow-visible"
                            style={{ width: 80, minWidth: 80 }}
                            rowSpan={2}
                          >
                            <div className="inline-flex items-center justify-center gap-1 w-full group/wbhdr">
                              <span className="truncate cursor-default">{proj.waybillPairedFcCode}</span>
                              <a
                                href={\`/dictionaries/waybills?projectUuid=\${encodeURIComponent(proj.projectUuid)}\`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open waybills filtered by this project"
                                className="opacity-0 group-hover/wbhdr:opacity-100 text-gray-300 hover:text-blue-500 transition-opacity shrink-0"
                              >
                                <Filter className="h-3 w-3" />
                              </a>
                            </div>
                          </th>
                        )}`,
  "waybill th gray + filter link"
);

// 1b. Body row dash td — remove amber
rep(PR,
  `                              <td className="px-2 py-2 text-center text-amber-200 bg-amber-50 border-r border-amber-100" style={{ width: 80, minWidth: 80 }}>—</td>`,
  `                              <td className="px-2 py-2 text-center text-gray-300 border-r border-gray-200" style={{ width: 80, minWidth: 80 }}>—</td>`,
  "body dash td gray"
);

// 1c. Totals row td — remove amber
rep(PR,
  `                          <td className="px-2 py-2 text-right text-[11px] font-semibold text-amber-700 bg-amber-100 border-r border-amber-200" style={{ width: 80, minWidth: 80 }}>
                            {formatMoney(proj.waybillSum)}
                          </td>`,
  `                          <td className="px-3 py-2 text-right tabular-nums border-r border-gray-200 text-gray-800" style={{ width: 80, minWidth: 80 }}>
                            {formatMoney(proj.waybillSum)}
                          </td>`,
  "totals td gray"
);

// ── 2. waybills-table.tsx ─────────────────────────────────────────────────────
const WT = "components/figma/waybills-table.tsx";

// 2a. Add URL param support after localStorage restore effect
rep(WT,
  `    setFiltersInitialized(true);
  }, [filtersStorageKey]);

  useEffect(() => {
    if (!filtersInitialized) return;
    const serialized = {`,
  `    setFiltersInitialized(true);
  }, [filtersStorageKey]);

  // Apply URL query parameters as initial column filters (overrides localStorage state)
  useEffect(() => {
    if (!filtersInitialized) return;
    const urlParams = new URLSearchParams(window.location.search);
    const projectUuidParam = urlParams.get('projectUuid');
    if (projectUuidParam) {
      setColumnFilters([{ id: 'project_uuid', value: [projectUuidParam] }]);
      window.history.replaceState({}, '', window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersInitialized]);

  useEffect(() => {
    if (!filtersInitialized) return;
    const serialized = {`,
  "waybills-table URL param filter"
);

console.log("\nAll patches applied.");
