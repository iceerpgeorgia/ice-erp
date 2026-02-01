import { PrismaClient } from "@prisma/client";
import ClientForm from "./ClientForm";

export const revalidate = 0;

type Opt = { id: string; label: string; isNaturalPerson?: boolean; isIdExempt?: boolean };

export default async function NewCounteragentPage() {
  const prisma = new PrismaClient();

  const [entityTypes, countries] = await Promise.all([
    prisma.entity_types.findMany({
      select: { entity_type_uuid: true, name_ka: true, is_natural_person: true, is_id_exempt: true },
      orderBy: { name_ka: "asc" },
    }),
    prisma.countries.findMany({
      select: { country_uuid: true, country: true },
      orderBy: { country: "asc" },
    }),
  ]);

  const entityOptions: Opt[] = entityTypes.map(e => ({
    id: e.entity_type_uuid,
    label: e.name_ka,
    isNaturalPerson: e.is_natural_person,
    isIdExempt: e.is_id_exempt,
  }));
  const countryOptions: Opt[] = countries
    .filter(c => c.country !== null)
    .map(c => ({ id: c.country_uuid, label: c.country! }));

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8">
      <h1 className="text-2xl font-semibold mb-6">New Counteragent</h1>
      <ClientForm entityOptions={entityOptions} countryOptions={countryOptions} />
    </div>
  );
}