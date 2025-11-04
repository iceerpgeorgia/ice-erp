// app/dictionaries/counteragents/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { logAudit } from "@/lib/audit";

export const revalidate = 0;
const prisma = new PrismaClient();

// Map Prisma (camelCase) to snake_case JSON keys your UI expects
function toApi(row: any) {
  return {
    id: Number(row.id),
    created_at: row.createdAt?.toISOString() ?? null,
    updated_at: row.updatedAt?.toISOString() ?? null,
    ts: row.ts?.toISOString() ?? null,

    name: row.name,
    identification_number: row.identification_number,
    birth_or_incorporation_date: row.birth_or_incorporation_date
      ? new Date(row.birth_or_incorporation_date).toISOString().slice(0, 10)
      : null,
    entity_type: row.entity_type,
    sex: row.sex,
    pension_scheme: row.pension_scheme,
    country: row.country,
    address_line_1: row.address_line_1,
    address_line_2: row.address_line_2,
    zip_code: row.zip_code,
    iban: row.iban,
    swift: row.swift,
    director: row.director,
    director_id: row.director_id,
    email: row.email,
    phone: row.phone,
    oris_id: row.oris_id,

    counteragent: row.counteragent,
    country_uuid: row.country_uuid,
    entity_type_uuid: row.entity_type_uuid,
    counteragent_uuid: row.counteragent_uuid,
    internal_number: row.internal_number ?? null,
    is_active: row.is_active ?? true,
  };
}

export async function GET() {
  try {
    const rows = await prisma.counteragent.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        createdAt: true, // Prisma uses camelCase in client
        updatedAt: true,
        ts: true,

        name: true,
        identification_number: true,
        birth_or_incorporation_date: true,
        entity_type: true,
        sex: true,
        pension_scheme: true,
        country: true,
        address_line_1: true,
        address_line_2: true,
        zip_code: true,
        iban: true,
        swift: true,
        director: true,
        director_id: true,
        email: true,
        phone: true,
        oris_id: true,

        counteragent: true,
        country_uuid: true,
        entity_type_uuid: true,
        counteragent_uuid: true,
        internal_number: true,
        is_active: true,
      },
    });
    return NextResponse.json(rows.map(toApi), { status: 200 });
  } catch (err: any) {
    console.error("GET /counteragents/api failed:", err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const created = await prisma.counteragent.create({
      data: {
        name: body.name?.trim(),
        identification_number: body.identification_number ?? null,
        birth_or_incorporation_date: body.birth_or_incorporation_date
          ? new Date(body.birth_or_incorporation_date)
          : null,
        entity_type: body.entity_type ?? null,
        sex: body.sex ?? null,
        pension_scheme: body.pension_scheme ?? null,
        country: body.country ?? null,
        address_line_1: body.address_line_1 ?? null,
        address_line_2: body.address_line_2 ?? null,
        zip_code: body.zip_code ?? null,
        iban: body.iban ?? null,
        swift: body.swift ?? null,
        director: body.director ?? null,
        director_id: body.director_id ?? null,
        email: body.email ?? null,
        phone: body.phone ?? null,
        oris_id: body.oris_id ?? null,

        counteragent: body.counteragent ?? null,
        country_uuid: body.country_uuid ?? null,
        entity_type_uuid: body.entity_type_uuid ?? null,
        internal_number: body.internal_number ?? null,
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        ts: true,

        name: true,
        identification_number: true,
        birth_or_incorporation_date: true,
        entity_type: true,
        sex: true,
        pension_scheme: true,
        country: true,
        address_line_1: true,
        address_line_2: true,
        zip_code: true,
        iban: true,
        swift: true,
        director: true,
        director_id: true,
        email: true,
        phone: true,
        oris_id: true,

        counteragent: true,
        country_uuid: true,
        entity_type_uuid: true,
        counteragent_uuid: true,
        internal_number: true,
      },
    });

    return NextResponse.json(toApi(created), { status: 201 });
  } catch (err: any) {
    console.error("POST /counteragents/api failed:", err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
    }

    const body = await req.json();
    
    // Fetch existing record for change tracking
    const existing = await prisma.counteragent.findUnique({
      where: { id: BigInt(id) },
    });

    if (!existing) {
      return NextResponse.json({ error: "Counteragent not found" }, { status: 404 });
    }

    // Build changes object for audit
    const changes: Record<string, { from: any; to: any }> = {};
    
    const fieldMap: Record<string, keyof typeof body> = {
      name: 'name',
      identification_number: 'identification_number',
      birth_or_incorporation_date: 'birth_or_incorporation_date',
      entity_type: 'entity_type',
      sex: 'sex',
      pension_scheme: 'pension_scheme',
      country: 'country',
      address_line_1: 'address_line_1',
      address_line_2: 'address_line_2',
      zip_code: 'zip_code',
      iban: 'iban',
      swift: 'swift',
      director: 'director',
      director_id: 'director_id',
      email: 'email',
      phone: 'phone',
      oris_id: 'oris_id',
      counteragent: 'counteragent',
      country_uuid: 'country_uuid',
      entity_type_uuid: 'entity_type_uuid',
      internal_number: 'internal_number',
      is_active: 'is_active',
    };

    Object.entries(fieldMap).forEach(([dbField, bodyField]) => {
      if (bodyField in body) {
        const oldVal = (existing as any)[dbField];
        const newVal = body[bodyField];
        
        // Convert dates for comparison
        const oldCompare = oldVal instanceof Date ? oldVal.toISOString().slice(0, 10) : oldVal;
        const newCompare = newVal;
        
        if (oldCompare !== newCompare) {
          changes[dbField] = { from: oldCompare, to: newCompare };
        }
      }
    });

    // Update the record
    const updated = await prisma.counteragent.update({
      where: { id: BigInt(id) },
      data: {
        name: body.name !== undefined ? body.name?.trim() : undefined,
        identification_number: body.identification_number !== undefined ? body.identification_number : undefined,
        birth_or_incorporation_date: body.birth_or_incorporation_date !== undefined 
          ? (body.birth_or_incorporation_date ? new Date(body.birth_or_incorporation_date) : null) 
          : undefined,
        entity_type: body.entity_type !== undefined ? body.entity_type : undefined,
        sex: body.sex !== undefined ? body.sex : undefined,
        pension_scheme: body.pension_scheme !== undefined ? body.pension_scheme : undefined,
        country: body.country !== undefined ? body.country : undefined,
        address_line_1: body.address_line_1 !== undefined ? body.address_line_1 : undefined,
        address_line_2: body.address_line_2 !== undefined ? body.address_line_2 : undefined,
        zip_code: body.zip_code !== undefined ? body.zip_code : undefined,
        iban: body.iban !== undefined ? body.iban : undefined,
        swift: body.swift !== undefined ? body.swift : undefined,
        director: body.director !== undefined ? body.director : undefined,
        director_id: body.director_id !== undefined ? body.director_id : undefined,
        email: body.email !== undefined ? body.email : undefined,
        phone: body.phone !== undefined ? body.phone : undefined,
        oris_id: body.oris_id !== undefined ? body.oris_id : undefined,
        counteragent: body.counteragent !== undefined ? body.counteragent : undefined,
        country_uuid: body.country_uuid !== undefined ? body.country_uuid : undefined,
        entity_type_uuid: body.entity_type_uuid !== undefined ? body.entity_type_uuid : undefined,
        internal_number: body.internal_number !== undefined ? body.internal_number : undefined,
        is_active: body.is_active !== undefined ? body.is_active : undefined,
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        ts: true,
        name: true,
        identification_number: true,
        birth_or_incorporation_date: true,
        entity_type: true,
        sex: true,
        pension_scheme: true,
        country: true,
        address_line_1: true,
        address_line_2: true,
        zip_code: true,
        iban: true,
        swift: true,
        director: true,
        director_id: true,
        email: true,
        phone: true,
        oris_id: true,
        counteragent: true,
        country_uuid: true,
        entity_type_uuid: true,
        counteragent_uuid: true,
        internal_number: true,
        is_active: true,
      },
    });

    console.log('[AUDIT DEBUG] Changes detected:', Object.keys(changes).length, changes);

    // Log audit if there were changes
    if (Object.keys(changes).length > 0) {
      const recordId = typeof updated.id === "bigint" ? updated.id : BigInt(updated.id);
      console.log('[AUDIT DEBUG] Calling logAudit with:', { table: "counteragents", recordId, action: "update" });
      await logAudit({ 
        table: "counteragents", 
        recordId, 
        action: "update",
        changes 
      });
      console.log('[AUDIT DEBUG] logAudit completed');
    } else {
      console.log('[AUDIT DEBUG] No changes detected, skipping audit log');
    }

    return NextResponse.json(toApi(updated), { status: 200 });
  } catch (err: any) {
    console.error("PATCH /counteragents failed:", err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}
