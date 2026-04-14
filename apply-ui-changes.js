const fs = require("fs");
let c1 = fs.readFileSync("app/api/payments-report/route.ts", "utf8");
c1 = c1.replace(
  "        p.currency_uuid,\n        p.is_active,\n        p.is_project_derived,\n        proj.project_index,",
  "        p.currency_uuid,\n        p.is_active,\n        p.is_project_derived,\n        p.is_bundle_payment,\n        proj.project_index,"
);
c1 = c1.replace(
  "      currencyUuid: row.currency_uuid,\n      isActive: row.is_active,\n      isProjectDerived: row.is_project_derived ?? false,\n      counteragent: row.counteragent_formatted || row.counteragent_name,",
  "      currencyUuid: row.currency_uuid,\n      isActive: row.is_active,\n      isProjectDerived: row.is_project_derived ?? false,\n      isBundlePayment: row.is_bundle_payment ?? false,\n      counteragent: row.counteragent_formatted || row.counteragent_name,"
);
fs.writeFileSync("app/api/payments-report/route.ts", c1, "utf8");
let c2 = fs.readFileSync("components/figma/payments-report-table.tsx", "utf8");
c2 = c2.replace(
  "  currencyUuid?: string | null;\n  isActive?: boolean;\n  isProjectDerived?: boolean;\n  counteragent: string;",
  "  currencyUuid?: string | null;\n  isActive?: boolean;\n  isProjectDerived?: boolean;\n  isBundlePayment?: boolean;\n  counteragent: string;"
);
c2 = c2.replace(
  "  { key: 'balance', label: 'Balance', visible: true, sortable: true, filterable: true, format: 'currency', width: 120 },\n  { key: 'isProjectDerived', label: 'Auto', visible: true, sortable: true, filterable: true, format: 'boolean', width: 90 },\n  { key: 'latestDate', label: 'Latest Date', visible: true, sortable: true, filterable: true, format: 'date', width: 120 },",
  "  { key: 'balance', label: 'Balance', visible: true, sortable: true, filterable: true, format: 'currency', width: 120 },\n  { key: 'isProjectDerived', label: 'Auto', visible: true, sortable: true, filterable: true, format: 'boolean', width: 90 },\n  { key: 'isBundlePayment', label: 'Bundle', visible: true, sortable: true, filterable: true, format: 'boolean', width: 90 },\n  { key: 'latestDate', label: 'Latest Date', visible: true, sortable: true, filterable: true, format: 'date', width: 120 },"
);
fs.writeFileSync("components/figma/payments-report-table.tsx", c2, "utf8");
console.log("Files updated");
