import { NextRequest, NextResponse } from 'next/server';
import { getRsCredentialsMap } from '@/lib/integrations/rsge/client';
import { runWaybillSync, WaybillSyncResult } from '@/lib/waybills/run-waybill-sync';

export const dynamic = 'force-dynamic';
// Three months of data can be large — allow up to 5 min on Vercel Pro.
export const maxDuration = 300;

/**
 * Returns start of 3 months ago (first of that month, Tbilisi midnight) to
 * end of today (23:59:59 Tbilisi). Georgia does not observe DST (+04:00 always).
 */
function getTbilisiQuarterRange(): { from: Date; to: Date } {
  const now = new Date();
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tbilisi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now); // e.g. "2026-05-23"

  const [yearStr, monthStr] = ymd.split('-');
  let fromYear = Number(yearStr);
  let fromMonth = Number(monthStr) - 3;
  if (fromMonth <= 0) {
    fromMonth += 12;
    fromYear -= 1;
  }
  const fromYmd = `${fromYear}-${String(fromMonth).padStart(2, '0')}-01`;

  return {
    from: new Date(`${fromYmd}T00:00:00+04:00`),
    to: new Date(`${ymd}T23:59:59+04:00`),
  };
}

/**
 * Daily 3-month backcheck — runs at 04:00 Tbilisi time (00:00 UTC).
 * Iterates over all insiders configured in RS_CREDENTIALS_MAP, refetching the
 * last 3 months and applying any field-level corrections.
 * VAT payer status is never overwritten — locked at first insert.
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

  const { from, to } = getTbilisiQuarterRange();

  type InsiderResult = WaybillSyncResult & { insider_uuid: string };
  const results: InsiderResult[] = [];

  for (const cred of credMap) {
    try {
      const result = await runWaybillSync(
        { su: cred.su, sp: cred.sp },
        from,
        to,
        { insiderUuid: cred.insiderUuid },
      );
      results.push({ insider_uuid: cred.insiderUuid, ...result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[GET /api/cron/waybills-quarterly] insider ${cred.insiderUuid} error:`, msg);
      results.push({ insider_uuid: cred.insiderUuid, imported: 0, updated: 0, sync_batch_id: null, message: msg });
    }
  }

  const totals = results.reduce(
    (acc, r) => ({ imported: acc.imported + r.imported, updated: acc.updated + r.updated }),
    { imported: 0, updated: 0 },
  );

  return NextResponse.json({ mode: 'quarterly', range: { from, to }, ...totals, results });
}