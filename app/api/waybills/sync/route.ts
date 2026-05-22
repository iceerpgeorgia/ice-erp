import { NextRequest, NextResponse } from 'next/server';
import { getBuyerWaybillsXml, getRsCredentialsMap } from '@/lib/integrations/rsge/client';
import { parseStringPromise } from 'xml2js';
import { runWaybillSync } from '@/lib/waybills/run-waybill-sync';

export const dynamic = 'force-dynamic';
// Allow up to 60 s on Vercel for large date ranges
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { requireAuthOrCron, isAuthError } = await import('@/lib/auth-guard');
  const auth = await requireAuthOrCron(req);
  if (isAuthError(auth)) return auth;

  const credMap = getRsCredentialsMap();
  if (credMap.length === 0) {
    return NextResponse.json(
      { error: 'No RS API credentials configured (RS_CREDENTIALS_MAP or RS_API_SU/SP/INSIDER_UUID)' },
      { status: 503 },
    );
  }
  // Manual sync uses the first configured insider's credentials.
  const { insiderUuid, ...credentials } = credMap[0];

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // accept empty body — defaults to last 30 days
  }

  const { begin_date, end_date, statuses, itypes, raw } = body as {
    /** Filter start date — maps to create_date_s (portal Activation Period). ISO string. */
    begin_date?: string;
    /** Filter end date — maps to create_date_e. ISO string. */
    end_date?: string;
    statuses?: string;
    itypes?: string;
    /** Pass raw:true to return the parsed XML object for field inspection */
    raw?: boolean;
  };

  // rs.ge: use create_date_s/e which matches the portal's "Activation Period" filter.
  const createDateS = begin_date
    ? new Date(begin_date)
    : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();
  const createDateE = end_date ? new Date(end_date) : new Date();

  // Debug / field-inspection mode — fetches XML without writing to DB
  if (raw) {
    let innerXml: string;
    try {
      innerXml = await getBuyerWaybillsXml({ ...credentials, createDateS, createDateE, statuses, itypes });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[POST /api/waybills/sync] SOAP error:', msg);
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    let parsed: unknown;
    try {
      parsed = await parseStringPromise(innerXml, { explicitArray: true });
    } catch {
      parsed = innerXml;
    }
    return NextResponse.json({ raw: parsed });
  }

  try {
    const result = await runWaybillSync(credentials, createDateS, createDateE, { statuses, itypes });
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[POST /api/waybills/sync] error:', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}