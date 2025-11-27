import { PrismaClient } from "@prisma/client";
import { EntityTypesTable } from "@/components/figma/entity-types-table";

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default async function EntityTypesPage() {
  const prisma = new PrismaClient();
  const items = await prisma.entity_types.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      created_at: true,
      updated_at: true,
      ts: true,
      entity_type_uuid: true, // ← correct field name
      code: true,
      name_en: true,
      name_ka: true,
      is_active: true,
    },
  });

  // Serialize BigInt & Date and transform to camelCase
  const data = items.map((x) => ({
    id: Number(x.id),
    createdAt: x.created_at?.toISOString() ?? '',
    updatedAt: x.updated_at?.toISOString() ?? '',
    ts: x.ts?.toISOString() ?? '',
    entityTypeUuid: x.entity_type_uuid ?? '',
    code: x.code ?? '',
    nameEn: x.name_en ?? '',
    nameKa: x.name_ka ?? '',
    isActive: x.is_active ?? true,
  }));

  return (
    <div className="w-full">
      <div className="mx-auto max-w-[1600px] px-6 py-8">
        <h1 className="text-2xl font-semibold mb-4">Entity Types</h1>
        <EntityTypesTable data={data} />
      </div>
    </div>
  );
}
