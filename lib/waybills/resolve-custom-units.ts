import { prisma } from '@/lib/prisma';
import { getBuyerWaybillGoodsByNumber, type RsCredential } from '@/lib/integrations/rsge/client';

// RS unit id 99 ("სხვ", custom): the bulk goods sync does not return the real unit text (UNIT_TXT).
// This asks RS per waybill and writes the real text into rs_waybills_in_items.unit. The items
// trigger then maps it to a dimension through rs_unit_dimension_map (unknown texts are added to the
// map unmapped, and those items get no dimension until someone maps them).
export type ResolveCustomUnitsResult = {
  processed: number;
  updated_items: number;
  skipped: number;
  has_more: boolean;
  next_offset: number | null;
  errors: string[];
};

export async function resolveCustomUnits(
  credentials: RsCredential[],
  options: {
    limit?: number;
    offset?: number;
    dryRun?: boolean;
    insiderUuid?: string;
    // Only items created at or after this time (the hourly cron looks at recent items only).
    createdSince?: Date;
    delayMs?: number;
  } = {}
): Promise<ResolveCustomUnitsResult> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  const credByInsider = new Map(credentials.map((c) => [c.insiderUuid, c]));

  const waybillRows = await prisma.rs_waybills_in_items.findMany({
    where: {
      unit_id: '99',
      unit: 'სხვ',
      waybill_no: { not: null },
      ...(options.insiderUuid ? { insider_uuid: options.insiderUuid } : {}),
      ...(options.createdSince ? { created_at: { gte: options.createdSince } } : {}),
    },
    select: { waybill_no: true, insider_uuid: true },
    distinct: ['waybill_no'],
    orderBy: { waybill_no: 'asc' },
    skip: offset,
    take: limit + 1,
  });

  const hasMore = waybillRows.length > limit;
  const result: ResolveCustomUnitsResult = {
    processed: 0,
    updated_items: 0,
    skipped: 0,
    has_more: hasMore,
    next_offset: hasMore ? offset + limit : null,
    errors: [],
  };

  for (const { waybill_no, insider_uuid } of waybillRows.slice(0, limit)) {
    const cred = insider_uuid ? credByInsider.get(insider_uuid) : credentials[0];
    if (!waybill_no || !cred) {
      result.skipped += 1;
      continue;
    }
    try {
      const { byCode, byName } = await getBuyerWaybillGoodsByNumber(cred.su, cred.sp, waybill_no);
      if (byCode.size > 0 || byName.size > 0) {
        const items = await prisma.rs_waybills_in_items.findMany({
          where: { waybill_no, unit_id: '99', unit: 'სხვ' },
          select: { id: true, goods_code: true, goods_name: true },
        });
        for (const item of items) {
          const unit =
            (item.goods_code ? byCode.get(item.goods_code) : undefined) ??
            (item.goods_name ? byName.get(item.goods_name) : undefined) ??
            null;
          if (!unit) continue;
          if (!options.dryRun) {
            await prisma.rs_waybills_in_items.update({ where: { id: item.id }, data: { unit } });
          }
          result.updated_items += 1;
        }
      }
      result.processed += 1;
    } catch (err) {
      result.errors.push(`${waybill_no}: ${err instanceof Error ? err.message : String(err)}`);
      result.skipped += 1;
    }
    await new Promise((resolve) => setTimeout(resolve, options.delayMs ?? 300));
  }

  result.errors = result.errors.slice(0, 10);
  return result;
}
