import Link from "next/link";
import { PrismaClient } from "@prisma/client";
import CounteragentsTable from "./CounteragentsTable";

export const revalidate = 0;

export default async function CounteragentsPage() {
  const prisma = new PrismaClient();

  const rows = await prisma.counteragent.findMany({
    orderBy: { id: "asc" },
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

  const data = rows.map((r) => ({
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
  }));

  return (
    <div className="w-full">
      <div className="mx-auto max-w-[1800px] px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Counteragents</h1>

          <Link
            href="/dictionaries/counteragents/new"
            className="inline-flex items-center rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            + Add new
          </Link>
        </div>

        {/* horizontal scroll if user makes columns wider than viewport */}
        <div className="overflow-x-auto">
          <CounteragentsTable data={data} />
        </div>
      </div>
    </div>
  );
}
