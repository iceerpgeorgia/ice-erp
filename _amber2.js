const fs=require("fs");
const f="components/figma/projects-report-table.tsx";
let s=fs.readFileSync(f,"utf8");

s=s.replace(
  'className="px-2 py-2 text-center text-gray-300 border-r border-gray-200" style={{ width: 80, minWidth: 80 }}>—</td>',
  'className="px-2 py-2 text-center text-amber-200 bg-amber-50 border-r border-amber-100" style={{ width: 80, minWidth: 80 }}>—</td>'
);

s=s.replace(
  'className="px-3 py-2 text-right tabular-nums border-r border-gray-200 text-gray-800" style={{ width: 80, minWidth: 80 }}>',
  'className="px-2 py-2 text-right text-[11px] font-semibold text-amber-700 bg-amber-100 border-r border-amber-200" style={{ width: 80, minWidth: 80 }}>'
);

console.log("body amber:", s.includes("bg-amber-50 border-r border-amber-100"));
console.log("totals amber:", s.includes("bg-amber-100 border-r border-amber-200"));
fs.writeFileSync(f,s,"utf8");
console.log("Done.");
