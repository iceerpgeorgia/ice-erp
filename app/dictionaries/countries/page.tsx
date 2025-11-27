import { PrismaClient } from "@prisma/client";
import { CountriesTable } from "@/components/figma/countries-table";

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default async function CountriesPage() {
  const prisma = new PrismaClient();

  const countries = await prisma.countries.findMany({
    orderBy: { id: "asc" },
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
      country: true, // <- important
    },
  });

  const data = countries.map((c) => ({
    id: Number(c.id),
    createdAt: c.created_at?.toISOString() ?? '',
    updatedAt: c.updated_at?.toISOString() ?? '',
    ts: c.ts?.toISOString() ?? '',
    countryUuid: c.country_uuid ?? '',
    nameEn: c.name_en ?? '',
    nameKa: c.name_ka ?? '',
    iso2: c.iso2 ?? '',
    iso3: c.iso3 ?? '',
    unCode: c.un_code ?? 0,
    country: c.country ?? '',
    isActive: true,
  }));

  return (
    <div className="w-full p-6">
      <CountriesTable data={data} />
    </div>
  );
}
