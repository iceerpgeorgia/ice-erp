const fs = require("fs");
const f = "components/figma/projects-report-table.tsx";
let s = fs.readFileSync(f, "utf8");

function rep(old, nw, label) {
  if (!s.includes(old)) { console.error("MISS:", label); process.exit(1); }
  s = s.replace(old, nw);
  console.log("OK:", label);
}

// 1. Header th class
rep(
  'className="px-2 py-1.5 text-center font-semibold text-gray-700 border-r border-gray-200 text-xs bg-gray-100 overflow-visible"',
  'className="px-2 py-1.5 text-center font-semibold text-amber-700 border-r border-amber-200 text-xs bg-amber-50 overflow-visible"',
  "header th amber"
);

// 2. Filter icon link color
rep(
  'className="opacity-0 group-hover/wbhdr:opacity-100 text-gray-300 hover:text-blue-500 transition-opacity shrink-0"',
  'className="opacity-0 group-hover/wbhdr:opacity-100 text-amber-300 hover:text-amber-600 transition-opacity shrink-0"',
  "filter icon amber"
);

// 3. Body dash td
rep(
  '<td className="px-2 py-2 text-center text-gray-300 border-r border-gray-200" style={{ width: 80, minWidth: 80 }}>—</td>',
  '<td className="px-2 py-2 text-center text-amber-200 bg-amber-50 border-r border-amber-100" style={{ width: 80, minWidth: 80 }}>—</td>',
  "body dash amber"
);

// 4. Totals td
rep(
  '<td className="px-3 py-2 text-right tabular-nums border-r border-gray-200 text-gray-800" style={{ width: 80, minWidth: 80 }}>',
  '<td className="px-2 py-2 text-right text-[11px] font-semibold text-amber-700 bg-amber-100 border-r border-amber-200" style={{ width: 80, minWidth: 80 }}>',
  "totals td amber"
);

fs.writeFileSync(f, s, "utf8");
console.log("Done.");
