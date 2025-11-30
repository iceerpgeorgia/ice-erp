export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");
    if (!idParam) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const body = await req.json();
    // Only allow fields in pick
    const allowed = Object.keys(pick);
    const updateData: any = {};
    for (const k of allowed) {
      if (k in body) updateData[k] = body[k];
    }
    // Special handling for booleans
    if ("is_emploee" in body) updateData.is_emploee = toBool(body.is_emploee);
    if ("was_emploee" in body) updateData.was_emploee = toBool(body.was_emploee);
    const updated = await prisma.counteragent.update({
      where: { id: BigInt(Number(idParam)) },
      data: updateData,
      select: pick,
    });
    console.log('[DEBUG] Counteragent updated:', updated);
    console.log('[DEBUG] Audit log params:', { table: "counteragents", recordId: BigInt(updated.id as any), action: "update", changes: updateData });
    await logAudit({ table: "counteragents", recordId: BigInt(updated.id as any), action: "update", changes: updateData });
    return NextResponse.json(toApi(updated));
  } catch (e: any) {
    console.error("PUT /counteragents/api", e);
    return NextResponse.json({ error: e.message ?? "Server error" }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { logAudit } from "@/lib/audit";
export const revalidate = 0;
const prisma = new PrismaClient();

const pick = {
  id: true, created_at: true, updated_at: true, ts: true,
  name: true, identification_number: true, birth_or_incorporation_date: true,
  entity_type: true, sex: true, pension_scheme: true, country: true,
  address_line_1: true, address_line_2: true, zip_code: true,
  iban: true, swift: true, director: true, director_id: true,
  email: true, phone: true, oris_id: true,
  counteragent: true, country_uuid: true, entity_type_uuid: true,
  counteragent_uuid: true, internal_number: true,

  // New boolean flags
  is_emploee: true,
  was_emploee: true,
};

function toApi(r: any) {
  return {
    id: Number(r.id),
    created_at: r.created_at?.toISOString() ?? null,
    updated_at: r.updated_at?.toISOString() ?? null,
    ts: r.ts?.toISOString() ?? null,
    name: r.name,
    identification_number: r.identification_number,
    birth_or_incorporation_date: r.birth_or_incorporation_date
      ? new Date(r.birth_or_incorporation_date).toISOString().slice(0, 10)
      : null,
    entity_type: r.entity_type,
    sex: r.sex,
    pension_scheme: r.pension_scheme,
    country: r.country,
    address_line_1: r.address_line_1,
    address_line_2: r.address_line_2,
    zip_code: r.zip_code,
    iban: r.iban,
    swift: r.swift,
    director: r.director,
    director_id: r.director_id,
    email: r.email,
    phone: r.phone,
    oris_id: r.oris_id,
    counteragent: r.counteragent,
    country_uuid: r.country_uuid,
    entity_type_uuid: r.entity_type_uuid,
    counteragent_uuid: r.counteragent_uuid,
    internal_number: r.internal_number ?? null,

    // boolean flags
    is_emploee: !!r.is_emploee,
    was_emploee: !!r.was_emploee,
  };
}

const toBool = (val: any): boolean | null => {
  if (val === null || typeof val === "undefined" || val === "") return null;
  if (typeof val === "boolean") return val;
  const s = String(val).toLowerCase();
  if (["true", "1", "yes", "on"].includes(s)) return true;
  if (["false", "0", "no", "off"].includes(s)) return false;
  return null;
};

// Helper to get current user email from session
async function getCurrentUser() {
  try {
    const session = await getServerSession();
    return session?.user?.email || "system";
  } catch {
    return "system";
  }
}

// Helper to log field changes
async function logFieldChange(
  counteragentId: bigint,
  fieldName: string,
  oldValue: any,
  newValue: any,
  operation: string,
  changedBy: string
) {
  const oldStr = oldValue != null ? String(oldValue) : null;
  const newStr = newValue != null ? String(newValue) : null;
  
  // Only log if values are different
  if (oldStr !== newStr) {
    await prisma.counteragent_audit_log.create({
      data: {
        counteragent_id: counteragentId,
        field_name: fieldName,
        old_value: oldStr,
        new_value: newStr,
        operation,
        changed_by: changedBy,
      },
    });
  }
}

export async function GET() {
  try {
    const rows = await prisma.counteragents.findMany({
      orderBy: { id: "asc" },
      select: pick,
    });
    return NextResponse.json(rows.map(toApi));
  } catch (e: any) {
    console.error("GET /counteragents/api", e);
    return NextResponse.json({ error: e.message ?? "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const isEmp = toBool(b.is_emploee);
    const wasEmp = toBool(b.was_emploee);

    const data = {
      updated_at: new Date(),
      name: b.name ?? null,
      identification_number: b.identification_number ?? null,
      birth_or_incorporation_date: b.birth_or_incorporation_date ? new Date(b.birth_or_incorporation_date) : null,
      entity_type: b.entity_type ?? null,
      sex: b.sex ?? null,
      pension_scheme: b.pension_scheme ?? null,
      country: b.country ?? null,
      address_line_1: b.address_line_1 ?? null,
      address_line_2: b.address_line_2 ?? null,
      zip_code: b.zip_code ?? null,
      iban: b.iban ?? null,
      swift: b.swift ?? null,
      director: b.director ?? null,
      director_id: b.director_id ?? null,
      email: b.email ?? null,
      phone: b.phone ?? null,
      oris_id: b.oris_id ?? null,
      counteragent: b.counteragent ?? null,
      country_uuid: b.country_uuid ?? null,
      entity_type_uuid: b.entity_type_uuid ?? null,
      counteragent_uuid: b.counteragent_uuid ?? crypto.randomUUID(),
      internal_number: b.internal_number ?? null,
      ...(isEmp === null ? {} : { is_emploee: isEmp }),
    };

        ...(isEmp === null ? {} : { is_emploee: isEmp }),
        ...(wasEmp === null ? {} : { was_emploee: wasEmp }),
      },
      select: pick,
    });
    await logAudit({ table: "counteragents", recordId: BigInt(created.id as any), action: "create" });
    return NextResponse.json(toApi(created), { status: 201 });
  } catch (e: any) {
    console.error("POST /counteragents/api", e);
    return NextResponse.json({ error: e.message ?? "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");
    if (!idParam) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await prisma.counteragent.delete({ where: { id: BigInt(Number(idParam)) } });
    await logAudit({ table: "counteragents", recordId: BigInt(Number(idParam)), action: "delete" });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("DELETE /counteragents/api", e);
    return NextResponse.json({ error: e.message ?? "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");
    if (!idParam) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const body = await req.json().catch(() => ({} as any));
    const active = typeof body.active === 'boolean' ? body.active : true;
    await prisma.counteragent.update({
      where: { id: BigInt(Number(idParam)) },
      data: { is_active: active },
    });
    await logAudit({ table: "counteragents", recordId: BigInt(Number(idParam)), action: active ? "activate" : "deactivate" });
    return NextResponse.json({ id: Number(idParam), is_active: active });
  } catch (e: any) {
    console.error("PATCH /counteragents/api", e);
    return NextResponse.json({ error: e.message ?? "Server error" }, { status: 500 });
  }
}
