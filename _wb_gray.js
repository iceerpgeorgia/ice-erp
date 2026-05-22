const fs = require("fs");
const f = "components/figma/projects-report-table.tsx";
let s = fs.readFileSync(f, "utf8");

function rep(old, nw, label) {
  if (!s.includes(old)) { console.error("MISS:", label); process.exit(1); }
  s = s.replace(old, nw);
  console.log("OK:", label);
}

// 1. Header th — amber -> same class as regular FC th, add filter link pointing to waybills
rep(
  `{proj.waybillSum > 0 && proj.waybillPairedFcCode && (
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
  `{proj.waybillSum > 0 && proj.waybillPairedFcCode && (
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
  "header gray"
);

// 2. Body dash td — amber -> gray
rep(
  `<td className="px-2 py-2 text-center text-amber-200 bg-amber-50 border-r border-amber-100" style={{ width: 80, minWidth: 80 }}>—</td>`,
  `<td className="px-2 py-2 text-center text-gray-300 border-r border-gray-200" style={{ width: 80, minWidth: 80 }}>—</td>`,
  "body dash gray"
);

// 3. Totals td — amber -> gray matching other totals cells
rep(
  `<td className="px-2 py-2 text-right text-[11px] font-semibold text-amber-700 bg-amber-100 border-r border-amber-200" style={{ width: 80, minWidth: 80 }}>
                            {formatMoney(proj.waybillSum)}
                          </td>`,
  `<td className="px-3 py-2 text-right tabular-nums border-r border-gray-200 text-gray-800" style={{ width: 80, minWidth: 80 }}>
                            {formatMoney(proj.waybillSum)}
                          </td>`,
  "totals gray"
);

fs.writeFileSync(f, s, "utf8");
console.log("Done — 3 changes applied.");
