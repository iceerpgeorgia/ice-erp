// app/dictionaries/counteragents/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export const revalidate = 0;

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
    is_emploee: row.is_emploee ?? null,
    was_emploee: row.was_emploee ?? null,
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
        is_emploee: true,
        was_emploee: true,
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
        sex: body.sex ?? null,
        pension_scheme: body.pension_scheme ?? null,
        // Don't set entity_type or country - they are auto-populated by trigger from UUIDs
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

        // Only set UUIDs - triggers will populate the name fields
        country_uuid: body.country_uuid ?? null,
        entity_type_uuid: body.entity_type_uuid ?? null,
        is_active: body.is_active ?? true,
        is_emploee: body.is_emploee ?? null,
        was_emploee: body.was_emploee ?? null,
      },
      select: {
        id: true,
      },
    });

    // Auto-generate internal_number based on ID (format: ICE000001, ICE000002, etc.)
    const idStr = created.id.toString();
    const zeros = '0'.repeat(Math.max(0, 6 - idStr.length));
    const internalNumber = `ICE${zeros}${idStr}`;

    // Update the record with internal_number and fetch complete data
    const updated = await prisma.counteragent.update({
      where: { id: created.id },
      data: { internal_number: internalNumber },
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
        is_emploee: true,
        was_emploee: true,
      },
    });

    // Log audit for the creation
    await logAudit({
      table: "counteragents",
      recordId: updated.id,
      action: "create",
    });

    return NextResponse.json(toApi(updated), { status: 201 });
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
    
    // Track changes only for fields we actually update
    // Note: entity_type, country, counteragent are auto-populated by triggers from UUIDs
    const fieldMap: Record<string, keyof typeof body> = {
      name: 'name',
      identification_number: 'identification_number',
      birth_or_incorporation_date: 'birth_or_incorporation_date',
      sex: 'sex',
      pension_scheme: 'pension_scheme',
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
      country_uuid: 'country_uuid',
      entity_type_uuid: 'entity_type_uuid',
      internal_number: 'internal_number',
      is_active: 'is_active',
      is_emploee: 'is_emploee',
      was_emploee: 'was_emploee',
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

    // Add human-readable labels for UUID changes
    if (changes.country_uuid) {
      changes.country_uuid_label = {
        from: existing.country || 'N/A',
        to: body.country || 'N/A'
      };
    }
    if (changes.entity_type_uuid) {
      changes.entity_type_uuid_label = {
        from: existing.entity_type || 'N/A',
        to: body.entity_type || 'N/A'
      };
    }

    // Update the record
    const updated = await prisma.counteragent.update({
      where: { id: BigInt(id) },
      data: {
        name: body.name !== undefined ? body.name?.trim() : undefined,
        identification_number: body.identification_number !== undefined ? body.identification_number : undefined,
        birth_or_incorporation_date: body.birth_or_incorporation_date !== undefined 
          ? (body.birth_or_incorporation_date ? new Date(body.birth_or_incorporation_date) : null) 
          : undefined,
        sex: body.sex !== undefined ? body.sex : undefined,
        pension_scheme: body.pension_scheme !== undefined ? body.pension_scheme : undefined,
        // Don't update entity_type or country - they are auto-populated by trigger from UUIDs
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
        // Only update UUIDs - triggers will populate the name fields
        country_uuid: body.country_uuid !== undefined ? body.country_uuid : undefined,
        entity_type_uuid: body.entity_type_uuid !== undefined ? body.entity_type_uuid : undefined,
        internal_number: body.internal_number !== undefined ? body.internal_number : undefined,
        is_active: body.is_active !== undefined ? body.is_active : undefined,
        is_emploee: body.is_emploee !== undefined ? body.is_emploee : undefined,
        was_emploee: body.was_emploee !== undefined ? body.was_emploee : undefined,
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
        is_emploee: true,
        was_emploee: true,
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
