// app/dictionaries/counteragents/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

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

