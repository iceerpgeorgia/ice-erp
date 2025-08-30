// scripts/apply-entity-types-ui.js
// Usage:
//   npm run apply:entity-types-ui
//   npm run apply:entity-types-ui:route -- --route dictionaries/entity-types
// Writes/updates: app/<route>/page.tsx and EntityTypesTable.tsx

const fs = require("fs");
const path = require("path");

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--route") out.route = args[++i];
  }
  return out;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeFile(p, content) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content, "utf8");
  console.log("✓ wrote", path.relative(process.cwd(), p));
}

const { route = "dictionaries/entity-types" } = parseArgs();
const dir = path.join("app", route);
const pagePath = path.join(dir, "page.tsx");
const tablePath = path.join(dir, "EntityTypesTable.tsx");

const pageTsx = `import { PrismaClient } from "@prisma/client";
import EntityTypesTable from "./EntityTypesTable";

export const revalidate = 0;

export default async function EntityTypesPage() {
  const prisma = new PrismaClient();
  const rows = await prisma.entityType.findMany({
    orderBy: { code: "asc" },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      ts: true,
      entity_type_uuid: true,
      code: true,
      name_en: true,
      name_ka: true,
      is_active: true,
    },
  });

  const data = rows.map(r => ({
    ...r,
    id: Number(r.id),
    createdAt: r.createdAt?.toISOString() ?? null,
    updatedAt: r.updatedAt?.toISOString() ?? null,
    ts: r.ts?.toISOString() ?? null,
  }));

  return (
    <div className="w-full">
      <div className="mx-auto max-w-[1600px] px-6 py-8">
        <h1 className="text-2xl font-semibold mb-4">Entity Types</h1>
        <p className="text-sm text-gray-500 mb-6">
          Wide table with header filters, sorting, rows-per-page, and full Excel export (respects filters).
        </p>
        <EntityTypesTable data={data} />
      </div>
    </div>
  );
}
`;

const tableTsx = `/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { DataGridPro, GridToolbar, gridFilteredSortedRowIdsSelector, useGridApiRef } from "@mui/x-data-grid-pro";
import { Button, Stack } from "@mui/material";
import * as XLSX from "xlsx";

type Row = {
  id: number;
  createdAt: string | null;
  updatedAt: string | null;
  ts: string | null;
  entity_type_uuid: string;
  code: string;
  name_en: string;
  name_ka: string;
  is_active: boolean;
};

export default function EntityTypesTable({ data }: { data: Row[] }) {
  const apiRef = useGridApiRef();

  const columns = [
    { field: "id", headerName: "ID", width: 90 },
    { field: "code", headerName: "Code", width: 140, filterable: true },
    { field: "name_en", headerName: "Name (EN)", width: 240, filterable: true },
    { field: "name_ka", headerName: "Name (KA)", width: 240, filterable: true },
    { field: "is_active", headerName: "Active", type: "boolean", width: 120, filterable: true },
    { field: "entity_type_uuid", headerName: "UUID", width: 300, filterable: true },
    { field: "createdAt", headerName: "Created", width: 200, filterable: true },
    { field: "updatedAt", headerName: "Updated", width: 200, filterable: true },
    { field: "ts", headerName: "TS (TZ)", width: 200, filterable: true },
  ];

  function exportFilteredToXlsx() {
    const ids = gridFilteredSortedRowIdsSelector(apiRef);
    const visible = apiRef.current.getVisibleColumns().map(c => c.field);
    const rows = ids.map((id: any) => {
      const model = apiRef.current.getRow(id);
      const obj: Record<string, any> = {};
      for (const f of visible) obj[f] = model[f];
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "entity_types");
    XLSX.writeFile(wb, "entity_types.xlsx");
  }

  return (
    <div className="w-full">
      <Stack direction="row" spacing={1} className="mb-2">
        <Button variant="outlined" onClick={exportFilteredToXlsx}>
          Export (filtered)
        </Button>
      </Stack>
      <div style={{ height: 700, width: "100%" }}>
        <DataGridPro
          apiRef={apiRef}
          rows={data}
          columns={columns}
          density="compact"
          disableRowSelectionOnClick
          slots={{ toolbar: GridToolbar }}
          slotProps={{
            toolbar: {
              showQuickFilter: true,
              printOptions: { disableToolbarButton: true },
            },
          }}
          initialState={{
            pagination: { paginationModel: { pageSize: 50, page: 0 } },
            columns: { columnVisibilityModel: {} },
          }}
          pageSizeOptions={[25, 50, 100, 200]}
        />
      </div>
    </div>
  );
}
`;

writeFile(pagePath, pageTsx);
writeFile(tablePath, tableTsx);

console.log("");
console.log("✅ Entity Types UI applied.");
console.log("Route:", "app/" + route);
console.log("Files:");
console.log("  -", path.relative(process.cwd(), pagePath));
console.log("  -", path.relative(process.cwd(), tablePath));
