// app/api/countries/export/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

function pick(search: URLSearchParams, ...keys: string[]) {
  for (const k of keys) {
    const v = search.get(k);
    if (v !== null && v !== "") return v;
  }
  return "";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Accept multiple possible param names so this works with your current page
  const q_en  = pick(searchParams, "en", "name_en", "q_en");
  const q_ka  = pick(searchParams, "ka", "name_ka", "q_ka");
  const q_i2  = pick(searchParams, "iso2", "q_iso2");
  const q_i3  = pick(searchParams, "iso3", "q_iso3");
  const q_un  = pick(searchParams, "un", "un_code", "q_un");

  const where: any = { AND: [] as any[] };
  if (q_en) where.AND.push({ name_en: { contains: q_en, mode: "insensitive" } });
  if (q_ka) where.AND.push({ name_ka: { contains: q_ka, mode: "insensitive" } });
  if (q_i2) where.AND.push({ iso2: { startsWith: q_i2.toUpperCase() } });
  if (q_i3) where.AND.push({ iso3: { startsWith: q_i3.toUpperCase() } });
  if (q_un && !Number.isNaN(Number(q_un))) where.AND.push({ un_code: Number(q_un) });
  if (where.AND.length === 0) delete where.AND;

  // IMPORTANT: no pagination here — we export ALL rows matching filters
  const rows = await prisma.countries.findMany({
    where,
    orderBy: { id: "asc" },
    select: {
      id: true,
      name_en: true,
      name_ka: true,
      iso2: true,
      iso3: true,
      un_code: true,
    },
  });

  const data = rows.map(r => ({
    ID: r.id,
    "Name (EN)": r.name_en,
    "Name (KA)": r.name_ka,
    ISO2: r.iso2,
    ISO3: r.iso3,
    UN: r.un_code ?? "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Countries");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="countries_filtered.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
