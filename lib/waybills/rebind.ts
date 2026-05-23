import { prisma } from "@/lib/prisma";

/**
 * After a counteragent is created or updated, rebind matching waybill rows.
 * Finds rows in rs_waybills_in_api and rs_waybills_in where counteragent_inn
 * matches the given INN (including leading-zero variants) and counteragent_uuid
 * is still NULL, then sets counteragent_uuid to the provided value.
 */
export async function rebindWaybillsByInn(
  inn: string,
  counteragentUuid: string
): Promise<{ updatedApi: number; updatedLegacy: number }> {
  if (!inn || !counteragentUuid) return { updatedApi: 0, updatedLegacy: 0 };

  // Generate INN variants: with and without a leading zero
  const innVariants = Array.from(
    new Set([
      inn,
      inn.startsWith("0") ? inn.slice(1) : `0${inn}`,
    ])
  );

  const [apiResult, legacyResult] = await Promise.all([
    prisma.rs_waybills_in_api.updateMany({
      where: {
        counteragent_inn: { in: innVariants },
        counteragent_uuid: null,
      },
      data: { counteragent_uuid: counteragentUuid },
    }),
    prisma.rs_waybills_in.updateMany({
      where: {
        counteragent_inn: { in: innVariants },
        counteragent_uuid: null,
      },
      data: { counteragent_uuid: counteragentUuid },
    }),
  ]);

  return {
    updatedApi: apiResult.count,
    updatedLegacy: legacyResult.count,
  };
}
