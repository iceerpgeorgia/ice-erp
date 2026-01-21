import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

function validatePayload(body: any) {
  const errors: Record<string, string> = {};
  const name_en = typeof body?.name_en === "string" ? body.name_en.trim() : "";
  const name_ka = typeof body?.name_ka === "string" ? body.name_ka.trim() : "";
  const iso2 = typeof body?.iso2 === "string" ? body.iso2.trim().toUpperCase() : "";
  const iso3 = typeof body?.iso3 === "string" ? body.iso3.trim().toUpperCase() : "";
  const country = typeof body?.country === "string" ? body.country.trim() : "";
  const is_active = typeof body?.is_active === "boolean" ? body.is_active : true;
  const un_code = body?.un_code === null || body?.un_code === undefined ? null : Number(body.un_code);

  if (!name_en) errors.name_en = "Enter English country name";
  if (!iso2) errors.iso2 = "ISO2 code is required";
  else if (!/^[A-Z]{2}$/.test(iso2)) errors.iso2 = "Must be 2 uppercase letters";
  if (!iso3) errors.iso3 = "ISO3 code is required";
  else if (!/^[A-Z]{3}$/.test(iso3)) errors.iso3 = "Must be 3 uppercase letters";
  if (un_code !== null && (Number.isNaN(un_code) || un_code < 1 || un_code > 999)) {
    errors.un_code = "Must be a valid UN numeric code";
  }
  if (!country) errors.country = "Country field is required";

  return {
    errors,
    payload: {
      name_en,
      name_ka,
      iso2,
      iso3,
      un_code: un_code === null ? null : un_code,
      country,
      is_active,
    },
  } as const;
}

export async function GET() {
  const rows = await prisma.countries.findMany({
    orderBy: { name_en: "asc" },
    select: {
      id: true,
      created_at: true,
      updated_at: true,
      ts: true,
      country_uuid: true,
      name_en: true,
      name_ka: true,
      iso2: true,
      iso3: true,
      un_code: true,
      country: true,
      is_active: true,
    },
  });
  console.log(`[API] Countries fetched: ${rows.length}`);
  // Map snake_case to camelCase for frontend
  function formatDate(date: string | Date | undefined): string {
    if (!date) return "";
    const d = new Date(date);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  const camelRows = rows.map(row => ({
    id: typeof row.id === 'bigint' ? Number(row.id) : row.id,
    createdAt: formatDate(row.created_at),
    updatedAt: formatDate(row.updated_at),
    ts: formatDate(row.ts),
    country_uuid: row.country_uuid,
    nameEn: row.name_en,
    nameKa: row.name_ka,
    iso2: row.iso2,
    iso3: row.iso3,
    unCode: row.un_code,
    country: row.country,
    is_active: row.is_active,
  }));
  return NextResponse.json(camelRows);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { errors, payload } = validatePayload(body);
    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 });
    }

    const created = await prisma.countries.create({
      data: {
        country_uuid: crypto.randomUUID(),
        name_en: payload.name_en,
        name_ka: payload.name_ka,
        iso2: payload.iso2,
        iso3: payload.iso3,
        un_code: payload.un_code ?? undefined,
        country: payload.country,
        is_active: payload.is_active,
        updated_at: new Date(),
      },
      select: {
        id: true,
        name_en: true,
        name_ka: true,
        iso2: true,
        iso3: true,
        un_code: true,
        country: true,
        is_active: true,
      },
    });

    const recordId = typeof created.id === "bigint" ? created.id : BigInt(created.id);
    await logAudit({ table: "countries", recordId, action: "create" });

    const { id, ...rest } = (created as any);
    return NextResponse.json({ id: Number(recordId), ...rest }, { status: 201 });
  } catch (error: any) {
    console.error("[countries] POST error", error);
    return NextResponse.json(
      { error: error?.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");
    if (!idParam) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await prisma.countries.update({ where: { id: BigInt(Number(idParam)) }, data: { is_active: false } });
    await logAudit({ table: "countries", recordId: BigInt(Number(idParam)), action: "deactivate" });
    return NextResponse.json({ id: Number(idParam) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");
    if (!idParam) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    
    const body = await req.json().catch(() => ({} as any));
    
    // If only toggling active status
    if (body.active !== undefined && Object.keys(body).length === 1) {
      const active = typeof body.active === "boolean" ? body.active : true;
      await prisma.countries.update({ 
        where: { id: BigInt(Number(idParam)) }, 
        data: { is_active: active } 
      });
      await logAudit({ 
        table: "countries", 
        recordId: BigInt(Number(idParam)), 
        action: active ? "activate" : "deactivate" 
      });
      return NextResponse.json({ id: Number(idParam) });
    }
    
    // Full update
    const { errors, payload } = validatePayload(body);
    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 });
    }

    // Get the existing record to track changes
    const existing = await prisma.countries.findUnique({
      where: { id: BigInt(Number(idParam)) },
      select: {
        name_en: true,
        name_ka: true,
        iso2: true,
        iso3: true,
        un_code: true,
        country: true,
        is_active: true,
      },
    });

    const updated = await prisma.countries.update({
      where: { id: BigInt(Number(idParam)) },
      data: {
        name_en: payload.name_en,
        name_ka: payload.name_ka,
        iso2: payload.iso2,
        iso3: payload.iso3,
        un_code: payload.un_code ?? undefined,
        country: payload.country,
        is_active: payload.is_active,
      },
      select: {
        id: true,
        created_at: true,
        updated_at: true,
        ts: true,
        country_uuid: true,
        name_en: true,
        name_ka: true,
        iso2: true,
        iso3: true,
        un_code: true,
        country: true,
        is_active: true,
      },
    });

    // Track what changed
    const changes: Record<string, { from: any; to: any }> = {};
    if (existing) {
      if (existing.name_en !== payload.name_en) changes.name_en = { from: existing.name_en, to: payload.name_en };
      if (existing.name_ka !== payload.name_ka) changes.name_ka = { from: existing.name_ka, to: payload.name_ka };
      if (existing.iso2 !== payload.iso2) changes.iso2 = { from: existing.iso2, to: payload.iso2 };
      if (existing.iso3 !== payload.iso3) changes.iso3 = { from: existing.iso3, to: payload.iso3 };
      if (existing.un_code !== payload.un_code) changes.un_code = { from: existing.un_code, to: payload.un_code };
      if (existing.country !== payload.country) changes.country = { from: existing.country, to: payload.country };
      if (existing.is_active !== payload.is_active) changes.is_active = { from: existing.is_active, to: payload.is_active };
    }

    await logAudit({ 
      table: "countries", 
      recordId: BigInt(Number(idParam)), 
      action: "update",
      changes: Object.keys(changes).length > 0 ? changes : undefined
    });

    function formatDate(date: string | Date | undefined): string {
      if (!date) return "";
      const d = new Date(date);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    return NextResponse.json({
      id: typeof updated.id === 'bigint' ? Number(updated.id) : updated.id,
      createdAt: formatDate(updated.created_at),
      updatedAt: formatDate(updated.updated_at),
      ts: formatDate(updated.ts),
      country_uuid: updated.country_uuid,
      nameEn: updated.name_en,
      nameKa: updated.name_ka,
      iso2: updated.iso2,
      iso3: updated.iso3,
      unCode: updated.un_code,
      country: updated.country,
      is_active: updated.is_active,
    });
  } catch (e: any) {
    console.error("[countries] PATCH error", e);
    return NextResponse.json({ error: e.message ?? "Server error" }, { status: 500 });
  }
}

