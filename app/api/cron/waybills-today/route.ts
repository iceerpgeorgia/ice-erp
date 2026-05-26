import { NextRequest, NextResponse } from 'next/server';
import { getRsCredentialsMap } from '@/lib/integrations/rsge/client';
import { runWaybillSync, WaybillSyncResult } from '@/lib/waybills/run-waybill-sync';
import { runWaybillItemsSync, WaybillItemsSyncResult } from '@/lib/waybills/run-waybill-items-sync';

export const dynamic = 'force-dynamic';
// Waybills + items sync: allow 2 min to accommodate the extra items API call.
export const maxDuration = 120;

/**
 * Returns midnight-to-midnight for the current calendar day in Tbilisi (UTC+4).
 * Georgia does not observe DST, so the offset is always +04:00.
 */
function getTbilisiTodayRange(): { from: Date; to: Date } {
  const now = new Date();
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tbilisi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now); // e.g. "2026-05-23"
  return {
    from: new Date(`${ymd}T00:00:00+04:00`),
    to: new Date(`${ymd}T23:59:59+04:00`),
  };
}

/**
 * Hourly waybill sync — runs every hour from 08:00 to 20:00 Tbilisi time.
 * Iterates over all insiders configured in RS_CREDENTIALS_MAP, fetching and
 * upserting each insider's waybills for today.
 * VAT payer status is locked at first insert and never overwritten.
 */
export async function GET(req: NextRequest) {
  const cronSecret = String(process.env.CRON_SECRET ?? '').trim();
  const authHeader = req.headers.get('authorization');
  const hasVercelCron = req.headers.get('x-vercel-cron') !== null;
  const hasValidSecret = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;

  if (!hasVercelCron && !hasValidSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const credMap = getRsCredentialsMap();
  if (credMap.length === 0) {
    return NextResponse.json(
      { error: 'No RS API credentials configured (RS_CREDENTIALS_MAP or RS_API_SU/SP/INSIDER_UUID)' },
      { status: 503 },
    );
  }

  const { from, to } = getTbilisiTodayRange();

  type InsiderResult = WaybillSyncResult & WaybillItemsSyncResult & { insider_uuid: string };
  const results: InsiderResult[] = [];

  for (const cred of credMap) {
    let waybillResult: WaybillSyncResult = { imported: 0, updated: 0, sync_batch_id: null };
    let itemsResult: WaybillItemsSyncResult = { items_inserted: 0, items_skipped: 0, items_errors: 0 };

    try {
      waybillResult = await runWaybillSync(
        { su: cred.su, sp: cred.sp },
        from,
        to,
        { insiderUuid: cred.insiderUuid },
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[GET /api/cron/waybills-today] insider ${cred.insiderUuid} waybills error:`, msg);
      waybillResult = { imported: 0, updated: 0, sync_batch_id: null, message: msg };
    }

    try {
      itemsResult = await runWaybillItemsSync(
        { su: cred.su, sp: cred.sp },
        from,
        to,
        { insiderUuid: cred.insiderUuid },
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[GET /api/cron/waybills-today] insider ${cred.insiderUuid} items error:`, msg);
      itemsResult = { items_inserted: 0, items_skipped: 0, items_errors: 0, message: msg };
    }

    results.push({ insider_uuid: cred.insiderUuid, ...waybillResult, ...itemsResult });
  }

  const totals = results.reduce(
    (acc, r) => ({
      imported: acc.imported + r.imported,
      updated: acc.updated + r.updated,
      items_inserted: acc.items_inserted + r.items_inserted,
      items_skipped: acc.items_skipped + r.items_skipped,
    }),
    { imported: 0, updated: 0, items_inserted: 0, items_skipped: 0 },
  );

  return NextResponse.json({ mode: 'today', range: { from, to }, ...totals, results });
}