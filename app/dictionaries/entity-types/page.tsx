import { PrismaClient } from "@prisma/client";
import EntityTypesTable from "./EntityTypesTable";

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default async function EntityTypesPage() {
  const prisma = new PrismaClient();
  const items = await prisma.entityType.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
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
    createdAt: x.createdAt?.toISOString() ?? null,
    updatedAt: x.updatedAt?.toISOString() ?? null,
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
