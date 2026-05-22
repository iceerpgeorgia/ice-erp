const fs = require("fs");
const f = "components/figma/projects-report-table.tsx";
let s = fs.readFileSync(f, "utf8");
const CRLF = "\r\n";

function rep(old, nw, label) {
  if (!s.includes(old)) { console.error("MISS:", label); process.exit(1); }
  s = s.replace(old, nw);
  console.log("OK:", label);
}

const I = "                        "; // 24 spaces
const I1 = "                          "; // 26 spaces
const I2 = "                            "; // 28 spaces
const I3 = "                              "; // 30 spaces

// 1. Header th
const oldHeader =
  I + "{proj.waybillSum > 0 && proj.waybillPairedFcCode && (" + CRLF +
  I1 + "<th" + CRLF +
  I2 + "className=\"bg-amber-50 border-r border-amber-200 relative overflow-hidden\"" + CRLF +
  I2 + "style={{ width: 80, minWidth: 80 }}" + CRLF +
  I2 + "rowSpan={2}" + CRLF +
  I1 + ">" + CRLF +
  I2 + "<div className=\"px-2 py-1.5 text-center font-semibold text-amber-700 text-xs leading-tight\">" + CRLF +
  I3 + "<div>{proj.waybillPairedFcCode}</div>" + CRLF +
  I3 + "<div className=\"text-[9px] font-normal text-amber-500\">Waybill</div>" + CRLF +
  I2 + "</div>" + CRLF +
  I1 + "</th>" + CRLF +
  I + ")}";

const newHeader =
  I + "{proj.waybillSum > 0 && proj.waybillPairedFcCode && (" + CRLF +
  I1 + "<th" + CRLF +
  I2 + "className=\"px-2 py-1.5 text-center font-semibold text-gray-700 border-r border-gray-200 text-xs bg-gray-100 overflow-visible\"" + CRLF +
  I2 + "style={{ width: 80, minWidth: 80 }}" + CRLF +
  I2 + "rowSpan={2}" + CRLF +
  I1 + ">" + CRLF +
  I2 + "<div className=\"inline-flex items-center justify-center gap-1 w-full group/wbhdr\">" + CRLF +
  I3 + "<span className=\"truncate cursor-default\">{proj.waybillPairedFcCode}</span>" + CRLF +
  I3 + "<a" + CRLF +
  I3 + "  href={`/dictionaries/waybills?projectUuid=${encodeURIComponent(proj.projectUuid)}`}" + CRLF +
  I3 + "  target=\"_blank\"" + CRLF +
  I3 + "  rel=\"noopener noreferrer\"" + CRLF +
  I3 + "  title=\"Open waybills filtered by this project\"" + CRLF +
  I3 + "  className=\"opacity-0 group-hover/wbhdr:opacity-100 text-gray-300 hover:text-blue-500 transition-opacity shrink-0\"" + CRLF +
  I3 + ">" + CRLF +
  I3 + "  <Filter className=\"h-3 w-3\" />" + CRLF +
  I3 + "</a>" + CRLF +
  I2 + "</div>" + CRLF +
  I1 + "</th>" + CRLF +
  I + ")}";

rep(oldHeader, newHeader, "header gray");

// 2. Body dash td
const I4 = "                            "; // 28 spaces (inside job row)
rep(
  I4 + "<td className=\"px-2 py-2 text-center text-amber-200 bg-amber-50 border-r border-amber-100\" style={{ width: 80, minWidth: 80 }}>—</td>",
  I4 + "<td className=\"px-2 py-2 text-center text-gray-300 border-r border-gray-200\" style={{ width: 80, minWidth: 80 }}>—</td>",
  "body dash gray"
);

// 3. Totals td
const I5 = "                        "; // 24 spaces
rep(
  I5 + "{proj.waybillSum > 0 && proj.waybillPairedFcCode && (" + CRLF +
  I5 + "  <td className=\"px-2 py-2 text-right text-[11px] font-semibold text-amber-700 bg-amber-100 border-r border-amber-200\" style={{ width: 80, minWidth: 80 }}>" + CRLF +
  I5 + "    {formatMoney(proj.waybillSum)}" + CRLF +
  I5 + "  </td>" + CRLF +
  I5 + ")}",
  I5 + "{proj.waybillSum > 0 && proj.waybillPairedFcCode && (" + CRLF +
  I5 + "  <td className=\"px-3 py-2 text-right tabular-nums border-r border-gray-200 text-gray-800\" style={{ width: 80, minWidth: 80 }}>" + CRLF +
  I5 + "    {formatMoney(proj.waybillSum)}" + CRLF +
  I5 + "  </td>" + CRLF +
  I5 + ")}",
  "totals gray"
);

fs.writeFileSync(f, s, "utf8");
console.log("Done — 3 changes applied.");
