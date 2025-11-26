import { PrismaClient } from "@prisma/client";
import EntityTypesTable from "./EntityTypesTable";

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

  // Serialize BigInt & Date
  const data = items.map((x) => ({
    ...x,
    id: Number(x.id),
    created_at: x.created_at?.toISOString() ?? null,
    updated_at: x.updated_at?.toISOString() ?? null,
    ts: x.ts?.toISOString() ?? null,
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
