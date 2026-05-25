import { prisma } from "@/lib/prisma";

/**
 * After a counteragent is created or updated, rebind matching waybill rows.
 * Finds rows in rs_waybills_in_api where counteragent_inn matches the given
 * INN (including leading-zero variants) and counteragent_uuid is still NULL,
 * then sets counteragent_uuid to the provided value.
 */
export async function rebindWaybillsByInn(
  inn: string,
  counteragentUuid: string
): Promise<{ updated: number }> {
  if (!inn || !counteragentUuid) return { updated: 0 };

  // Generate INN variants: with and without a leading zero
  const innVariants = Array.from(
    new Set([
      inn,
      inn.startsWith("0") ? inn.slice(1) : `0${inn}`,
    ])
  );

  const result = await prisma.rs_waybills_in_api.updateMany({
    where: {
      counteragent_inn: { in: innVariants },
      counteragent_uuid: null,
    },
    data: { counteragent_uuid: counteragentUuid },
  });

  return { updated: result.count };
}
