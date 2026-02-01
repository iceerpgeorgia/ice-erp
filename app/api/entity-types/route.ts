import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

function validatePayload(body: any) {
  const errors: Record<string, string> = {};
  const name_en = typeof body?.name_en === "string" ? body.name_en.trim() : "";
  const name_ka = typeof body?.name_ka === "string" ? body.name_ka.trim() : "";
  const is_active = typeof body?.is_active === "boolean" ? body.is_active : true;
  const is_natural_person = typeof body?.is_natural_person === "boolean" ? body.is_natural_person : false;
  const is_id_exempt = typeof body?.is_id_exempt === "boolean" ? body.is_id_exempt : false;

  if (!name_en) errors.name_en = "English name is required";
  if (!name_ka) errors.name_ka = "Georgian name is required";

  return {
    errors,
    payload: { name_en, name_ka, is_active, is_natural_person, is_id_exempt },
  } as const;
}

export async function GET() {
  let rows: any[] = [];
  try {
    rows = await prisma.entity_types.findMany({
      orderBy: { name_en: "asc" },
      select: {
        id: true,
        created_at: true,
        updated_at: true,
        ts: true,
        entity_type_uuid: true,
        name_en: true,
        name_ka: true,
        is_natural_person: true,
        is_id_exempt: true,
        is_active: true,
      },
    });
  } catch (error: any) {
    console.error("[entity-types] GET fallback", error?.message || error);
    rows = await prisma.entity_types.findMany({
      orderBy: { name_en: "asc" },
      select: {
        id: true,
        created_at: true,
        updated_at: true,
        ts: true,
        entity_type_uuid: true,
        name_en: true,
        name_ka: true,
        is_active: true,
      },
    });
  }
  
  console.log(`[API] Entity types fetched: ${rows.length}`);
  
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
    entity_type_uuid: row.entity_type_uuid,
    name_en: row.name_en,
    name_ka: row.name_ka,
    nameEn: row.name_en,
    nameKa: row.name_ka,
    is_natural_person: row.is_natural_person ?? false,
    is_id_exempt: row.is_id_exempt ?? false,
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

    // Generate UUID for entity_type_uuid
    const { randomUUID } = await import('crypto');
    let newEntityType;
    try {
      newEntityType = await prisma.entity_types.create({
        data: {
          entity_type_uuid: randomUUID(),
          name_en: payload.name_en,
          name_ka: payload.name_ka,
          is_natural_person: payload.is_natural_person,
          is_id_exempt: payload.is_id_exempt,
          is_active: payload.is_active,
          updated_at: new Date(),
        },
      });
    } catch (error: any) {
      console.error("[entity-types] POST fallback", error?.message || error);
      newEntityType = await prisma.entity_types.create({
        data: {
          entity_type_uuid: randomUUID(),
          name_en: payload.name_en,
          name_ka: payload.name_ka,
          is_active: payload.is_active,
          updated_at: new Date(),
        },
      });
    }

    const recordId = typeof newEntityType.id === "bigint" ? newEntityType.id : BigInt(newEntityType.id);
    await logAudit({ table: "entity_types", recordId, action: "create" });

    return NextResponse.json({ id: Number(recordId) }, { status: 201 });
  } catch (error: any) {
    console.error("[entity-types] POST error", error);
    return NextResponse.json(
      { error: error?.message || "Server error" },
      { status: 500 }
    );
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
      await prisma.entity_types.update({ 
        where: { id: BigInt(Number(idParam)) }, 
        data: { is_active: active } 
      });
      await logAudit({ 
        table: "entity_types", 
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

    // Get existing record for change tracking
    let existing: any = null;
    try {
      existing = await prisma.entity_types.findUnique({
        where: { id: BigInt(Number(idParam)) },
        select: { name_en: true, name_ka: true, is_natural_person: true, is_id_exempt: true, is_active: true },
      });
    } catch (error: any) {
      console.error("[entity-types] PATCH existing fallback", error?.message || error);
      existing = await prisma.entity_types.findUnique({
        where: { id: BigInt(Number(idParam)) },
        select: { name_en: true, name_ka: true, is_active: true },
      });
    }

    let updated;
    try {
      updated = await prisma.entity_types.update({
        where: { id: BigInt(Number(idParam)) },
        data: {
          name_en: payload.name_en,
          name_ka: payload.name_ka,
          is_natural_person: payload.is_natural_person,
          is_id_exempt: payload.is_id_exempt,
          is_active: payload.is_active,
        },
        select: {
          id: true,
          created_at: true,
          updated_at: true,
          ts: true,
          entity_type_uuid: true,
          name_en: true,
          name_ka: true,
          is_natural_person: true,
          is_id_exempt: true,
          is_active: true,
        },
      });
    } catch (error: any) {
      console.error("[entity-types] PATCH fallback", error?.message || error);
      updated = await prisma.entity_types.update({
        where: { id: BigInt(Number(idParam)) },
        data: {
          name_en: payload.name_en,
          name_ka: payload.name_ka,
          is_active: payload.is_active,
        },
        select: {
          id: true,
          created_at: true,
          updated_at: true,
          ts: true,
          entity_type_uuid: true,
          name_en: true,
          name_ka: true,
          is_active: true,
        },
      });
    }

    // Track what changed
    const changes: Record<string, { from: any; to: any }> = {};
    if (existing) {
      if (existing.name_en !== payload.name_en) changes.name_en = { from: existing.name_en, to: payload.name_en };
      if (existing.name_ka !== payload.name_ka) changes.name_ka = { from: existing.name_ka, to: payload.name_ka };
      if (existing.is_natural_person !== payload.is_natural_person) changes.is_natural_person = { from: existing.is_natural_person, to: payload.is_natural_person };
      if (existing.is_id_exempt !== payload.is_id_exempt) changes.is_id_exempt = { from: existing.is_id_exempt, to: payload.is_id_exempt };
      if (existing.is_active !== payload.is_active) changes.is_active = { from: existing.is_active, to: payload.is_active };
    }

    await logAudit({ 
      table: "entity_types", 
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

    const updatedAny = updated as any;
    return NextResponse.json({
      id: typeof updatedAny.id === 'bigint' ? Number(updatedAny.id) : updatedAny.id,
      createdAt: formatDate(updatedAny.created_at),
      updatedAt: formatDate(updatedAny.updated_at),
      ts: formatDate(updatedAny.ts),
      entity_type_uuid: updatedAny.entity_type_uuid,
      name_en: updatedAny.name_en,
      name_ka: updatedAny.name_ka,
      nameEn: updatedAny.name_en,
      nameKa: updatedAny.name_ka,
      is_natural_person: updatedAny.is_natural_person ?? false,
      is_id_exempt: updatedAny.is_id_exempt ?? false,
      is_active: updatedAny.is_active,
    });
  } catch (e: any) {
    console.error("[entity-types] PATCH error", e);
    return NextResponse.json({ error: e.message ?? "Server error" }, { status: 500 });
  }
}

