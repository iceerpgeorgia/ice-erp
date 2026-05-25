import { NextRequest, NextResponse } from 'next/server';
import { getGoodsByWaybillId, getRsCredentialsMap } from '@/lib/integrations/rsge/client';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
// Backfill can take a while — allow up to 300 s on Vercel Pro
export const maxDuration = 300;

const CONCURRENCY = 3; // parallel SOAP calls per insider
const DELAY_BETWEEN_BATCHES_MS = 150;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function processBatch<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const slice = items.slice(i, i + concurrency);
    const batch = await Promise.allSettled(slice.map(fn));
    for (const r of batch) {
      if (r.status === 'fulfilled') results.push(r.value);
    }
    if (i + concurrency < items.length) await sleep(DELAY_BETWEEN_BATCHES_MS);
  }
  return results;
}

/**
 * POST /api/waybills/backfill-items
 *
 * Fetches goods/line-items from rs.ge for every waybill in rs_waybills_in_api
 * and inserts them into rs_waybills_in_items.
 *
 * Query params:
 *   ?skip_existing=true  (default) — skip waybills that already have items
 *   ?skip_existing=false           — re-fetch ALL waybills (overwrites existing)
 *   ?insider_uuid=<uuid>           — limit to a single insider
 *   ?limit=<n>                     — process at most N waybills (for testing)
 */
export async function POST(req: NextRequest) {
  const { requireAuthOrCron, isAuthError } = await import('@/lib/auth-guard');
  const auth = await requireAuthOrCron(req);
  if (isAuthError(auth)) return auth;

  const credMap = getRsCredentialsMap();
  if (credMap.length === 0) {
    return NextResponse.json(
      { error: 'No RS API credentials configured' },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const skipExisting = url.searchParams.get('skip_existing') !== 'false';
  const limitParam = url.searchParams.get('limit');
  const insiderFilter = url.searchParams.get('insider_uuid') ?? undefined;
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;

  // Build a map: insiderUuid → credentials
  const credsByInsider = new Map(credMap.map((c) => [c.insiderUuid, c]));

  // Fetch waybills from DB
  const waybills = await prisma.rs_waybills_in_api.findMany({
    where: insiderFilter ? { insider_uuid: insiderFilter } : undefined,
    select: { rs_id: true, waybill_no: true, insider_uuid: true },
    orderBy: { synced_at: 'asc' },
    ...(limit ? { take: limit } : {}),
  });

  if (waybills.length === 0) {
    return NextResponse.json({ inserted: 0, skipped: 0, errors: 0, message: 'No waybills found' });
  }

  // Optionally skip waybills that already have items
  let toProcess = waybills;
  if (skipExisting) {
    const existingRsIds = await prisma.rs_waybills_in_items.findMany({
      where: { rs_id: { not: null } },
      select: { rs_id: true },
      distinct: ['rs_id'],
    });
    const existingSet = new Set(existingRsIds.map((r) => r.rs_id));
    toProcess = waybills.filter((w) => !existingSet.has(w.rs_id));
  }

  if (toProcess.length === 0) {
    return NextResponse.json({
      inserted: 0,
      skipped: waybills.length,
      errors: 0,
      message: 'All waybills already have items (use ?skip_existing=false to re-fetch)',
    });
  }

  // Group by insider_uuid so we use the right credentials per call
  const byInsider = new Map<string, typeof toProcess>();
  for (const w of toProcess) {
    const key = w.insider_uuid ?? '__unknown__';
    if (!byInsider.has(key)) byInsider.set(key, []);
    byInsider.get(key)!.push(w);
  }

  const batchId = `backfill-${Date.now()}`;
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  const errorSamples: string[] = [];

  for (const [insiderUuid, group] of byInsider) {
    const cred = credsByInsider.get(insiderUuid);
    if (!cred) {
      console.warn(`[backfill-items] No credentials for insider ${insiderUuid} — skipping ${group.length} waybills`);
      totalSkipped += group.length;
      continue;
    }

    const results = await processBatch(group, CONCURRENCY, async (w) => {
      if (!w.rs_id) return { inserted: 0, error: null };
      try {
        const goods = await getGoodsByWaybillId(cred.su, cred.sp, w.rs_id);
        if (goods.length === 0) return { inserted: 0, error: null };

        // If overwriting, delete existing items for this rs_id first
        if (!skipExisting) {
          await prisma.rs_waybills_in_items.deleteMany({ where: { rs_id: w.rs_id } });
        }

        await prisma.rs_waybills_in_items.createMany({
          data: goods.map((g) => ({
            rs_id: w.rs_id,
            waybill_no: w.waybill_no,
            insider_uuid: insiderUuid === '__unknown__' ? null : insiderUuid,
            goods_name: g.goods_name,
            goods_code: g.goods_code,
            unit: g.unit,
            quantity: g.quantity ? parseFloat(g.quantity) : null,
            unit_price: g.unit_price ? parseFloat(g.unit_price) : null,
            total_price: g.total_price ? parseFloat(g.total_price) : null,
            taxation: g.taxation,
            import_batch_id: batchId,
          })),
          skipDuplicates: true,
        });

        return { inserted: goods.length, error: null };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[backfill-items] waybill ${w.rs_id}:`, msg);
        return { inserted: 0, error: msg };
      }
    });

    for (const r of results) {
      totalInserted += r.inserted;
      if (r.error) {
        totalErrors += 1;
        if (errorSamples.length < 3) errorSamples.push(r.error);
      }
    }
  }

  totalSkipped += waybills.length - toProcess.length;

  return NextResponse.json({
    inserted: totalInserted,
    skipped: totalSkipped,
    errors: totalErrors,
    total_waybills: waybills.length,
    processed_waybills: toProcess.length,
    batch_id: batchId,
    ...(errorSamples.length > 0 ? { error_samples: errorSamples } : {}),
  });
}
