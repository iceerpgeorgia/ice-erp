import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
export const revalidate = 0;
const prisma = new PrismaClient();

const pick = {
  id: true, createdAt: true, updatedAt: true, ts: true,
  name: true, identification_number: true, birth_or_incorporation_date: true,
  entity_type: true, sex: true, pension_scheme: true, country: true,
  address_line_1: true, address_line_2: true, zip_code: true,
  iban: true, swift: true, director: true, director_id: true,
  email: true, phone: true, oris_id: true,
  counteragent: true, country_uuid: true, entity_type_uuid: true,
  counteragent_uuid: true, internal_number: true,

  // ⬇️ NEW
  is_emploee: true,
};

function toApi(r: any) {
  return {
    id: Number(r.id),
    created_at: r.createdAt?.toISOString() ?? null,
    updated_at: r.updatedAt?.toISOString() ?? null,
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

    // ⬇️ NEW
    is_emploee: !!r.is_emploee,
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
    await prisma.counteragentAuditLog.create({
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
    const rows = await prisma.counteragent.findMany({
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
    const changedBy = await getCurrentUser();

    const data = {
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
      counteragent_uuid: b.counteragent_uuid ?? null,
      internal_number: b.internal_number ?? null,
      ...(isEmp === null ? {} : { is_emploee: isEmp }),
    };

    const created = await prisma.counteragent.create({
      data,
      select: pick,
    });

    // Log creation for all non-null fields
    for (const [key, value] of Object.entries(data)) {
      if (value !== null) {
        await logFieldChange(created.id, key, null, value, "INSERT", changedBy);
      }
    }

    return NextResponse.json(toApi(created), { status: 201 });
  } catch (e: any) {
    console.error("POST /counteragents/api", e);
    return NextResponse.json({ error: e.message ?? "Server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const b = await req.json();
    if (!b.id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const id = BigInt(b.id);
    const changedBy = await getCurrentUser();

    // Get existing record
    const existing = await prisma.counteragent.findUnique({
      where: { id },
      select: pick,
    });

    if (!existing) {
      return NextResponse.json({ error: "Counteragent not found" }, { status: 404 });
    }

    const isEmp = toBool(b.is_emploee);

    const data = {
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
      counteragent_uuid: b.counteragent_uuid ?? null,
      internal_number: b.internal_number ?? null,
      ...(isEmp === null ? {} : { is_emploee: isEmp }),
    };

    const updated = await prisma.counteragent.update({
      where: { id },
      data,
      select: pick,
    });

    // Log changes for modified fields
    const fieldsToTrack = [
      'name', 'identification_number', 'birth_or_incorporation_date',
      'entity_type', 'sex', 'pension_scheme', 'country',
      'address_line_1', 'address_line_2', 'zip_code',
      'iban', 'swift', 'director', 'director_id',
      'email', 'phone', 'oris_id', 'is_emploee',
    ];

    for (const field of fieldsToTrack) {
      const oldVal = (existing as any)[field];
      const newVal = (updated as any)[field];
      await logFieldChange(id, field, oldVal, newVal, "UPDATE", changedBy);
    }

    return NextResponse.json(toApi(updated), { status: 200 });
  } catch (e: any) {
    console.error("PUT /counteragents/api", e);
    const msg = String(e?.message || "");
    const status = msg.includes("uq_counteragents_identification_number_filtered") ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
