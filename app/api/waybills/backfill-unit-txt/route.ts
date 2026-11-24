import { NextRequest, NextResponse } from 'next/server';
import { getRsCredentialsMap } from '@/lib/integrations/rsge/client';
import { resolveCustomUnits } from '@/lib/waybills/resolve-custom-units';

export const dynamic   = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/waybills/backfill-unit-txt
 *
 * For every waybill that has at least one item with unit_id='99' and unit='სხვ',
 * calls get_buyer_waybilll_goods_list (with waybill_number filter) to fetch
 * UNIT_TXT and updates the `unit` column on matching items. The items trigger then
 * maps the new unit text to a dimension (see lib/waybills/resolve-custom-units.ts).
 *
 * Pagination:
 *   ?limit=N            (default 50, max 100) — waybills to process per request
 *   ?offset=N           (default 0)           — skip first N waybills
 *   ?dry_run=true                             — report without writing
 *   ?insider_uuid=<uuid>                      — limit to one insider
 *
 * Returns: { processed, updated_items, skipped, dry_run, has_more, next_offset, errors }
 */
export async function POST(req: NextRequest) {
  const { requireAuthOrCron, isAuthError } = await import('@/lib/auth-guard');
  const auth = await requireAuthOrCron(req);
  if (isAuthError(auth)) return auth;

  const credMap = getRsCredentialsMap();
  if (credMap.length === 0)
    return NextResponse.json({ error: 'No RS API credentials configured' }, { status: 503 });

  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dry_run') === 'true';
  const result = await resolveCustomUnits(credMap, {
    limit: parseInt(url.searchParams.get('limit') ?? '50', 10),
    offset: parseInt(url.searchParams.get('offset') ?? '0', 10),
    dryRun,
    insiderUuid: url.searchParams.get('insider_uuid') ?? undefined,
  });

  return NextResponse.json({ ...result, dry_run: dryRun });
}
