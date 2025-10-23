import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { logAudit } from "@/lib/audit";

const prisma = new PrismaClient();

function validatePayload(body: any) {
  const errors: Record<string, string> = {};
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  const name_en = typeof body?.name_en === "string" ? body.name_en.trim() : "";
  const name_ka = typeof body?.name_ka === "string" ? body.name_ka.trim() : "";
  const is_active = typeof body?.is_active === "boolean" ? body.is_active : true;

  if (!code) errors.code = "Code is required";
  else if (!/^[A-Z0-9_]+$/.test(code)) errors.code = "Code must be uppercase alphanumeric with underscores";
  if (!name_en) errors.name_en = "English name is required";
  if (!name_ka) errors.name_ka = "Georgian name is required";

  return {
    errors,
    payload: { code, name_en, name_ka, is_active },
  } as const;
}

export async function GET() {
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
  
  console.log(`[API] Entity types fetched: ${rows.length}`);
  
  function formatDate(date: string | Date | undefined): string {
    if (!date) return "";
    const d = new Date(date);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  const camelRows = rows.map(row => ({
    id: typeof row.id === 'bigint' ? Number(row.id) : row.id,
    createdAt: formatDate(row.createdAt),
    updatedAt: formatDate(row.updatedAt),
    ts: formatDate(row.ts),
    entityTypeUuid: row.entity_type_uuid,
    code: row.code,
    nameEn: row.name_en,
    nameKa: row.name_ka,
    isActive: row.is_active,
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
    const newEntityType = await prisma.entityType.create({
      data: {
        entity_type_uuid: randomUUID(),
        code: payload.code,
        name_en: payload.name_en,
        name_ka: payload.name_ka,
        is_active: payload.is_active,
      },
    });

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
      await prisma.entityType.update({ 
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
    const existing = await prisma.entityType.findUnique({
      where: { id: BigInt(Number(idParam)) },
      select: { code: true, name_en: true, name_ka: true, is_active: true },
    });

    const updated = await prisma.entityType.update({
      where: { id: BigInt(Number(idParam)) },
      data: {
        code: payload.code,
        name_en: payload.name_en,
        name_ka: payload.name_ka,
        is_active: payload.is_active,
      },
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

    // Track what changed
    const changes: Record<string, { from: any; to: any }> = {};
    if (existing) {
      if (existing.code !== payload.code) changes.code = { from: existing.code, to: payload.code };
      if (existing.name_en !== payload.name_en) changes.name_en = { from: existing.name_en, to: payload.name_en };
      if (existing.name_ka !== payload.name_ka) changes.name_ka = { from: existing.name_ka, to: payload.name_ka };
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

    return NextResponse.json({
      id: typeof updated.id === 'bigint' ? Number(updated.id) : updated.id,
      createdAt: formatDate(updated.createdAt),
      updatedAt: formatDate(updated.updatedAt),
      ts: formatDate(updated.ts),
      entityTypeUuid: updated.entity_type_uuid,
      code: updated.code,
      nameEn: updated.name_en,
      nameKa: updated.name_ka,
      isActive: updated.is_active,
    });
  } catch (e: any) {
    console.error("[entity-types] PATCH error", e);
    return NextResponse.json({ error: e.message ?? "Server error" }, { status: 500 });
  }
}
