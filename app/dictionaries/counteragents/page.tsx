import { PrismaClient } from "@prisma/client";
import { CounteragentsTable } from "@/components/figma/counteragents-table";

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default async function CounteragentsPage() {
  const prisma = new PrismaClient();

  const rows = await prisma.counteragents.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      created_at: true,
      updated_at: true,
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

  const data = rows.map((r) => ({
    id: Number(r.id),
    createdAt: r.created_at?.toISOString() ?? '',
    updatedAt: r.updated_at?.toISOString() ?? '',
    ts: r.ts?.toISOString() ?? '',
    name: r.name ?? '',
    identificationNumber: r.identification_number,
    birthOrIncorporationDate: r.birth_or_incorporation_date
      ? new Date(r.birth_or_incorporation_date).toISOString().slice(0, 10)
      : null,
    entityType: r.entity_type,
    sex: r.sex,
    pensionScheme: r.pension_scheme,
    country: r.country,
    addressLine1: r.address_line_1,
    addressLine2: r.address_line_2,
    zipCode: r.zip_code,
    iban: r.iban,
    swift: r.swift,
    director: r.director,
    directorId: r.director_id,
    email: r.email,
    phone: r.phone,
    orisId: r.oris_id,
    counteragent: r.counteragent,
    countryUuid: r.country_uuid,
    entityTypeUuid: r.entity_type_uuid,
    counteragentUuid: r.counteragent_uuid ?? '',
    internalNumber: r.internal_number,
    isActive: r.is_active ?? true,
    isEmploye: r.is_emploee ?? false,
    wasEmploye: r.was_emploee ?? false,
  }));

  return (
    <div className="w-full p-6">
      <CounteragentsTable data={data} />
    </div>
  );
}
