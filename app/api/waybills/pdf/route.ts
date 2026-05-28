import { NextRequest, NextResponse } from 'next/server';
import { getPrintPdf, getRsCredentialsMap } from '@/lib/integrations/rsge/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/waybills/pdf?rs_id=<id>
 *
 * Fetches the PDF for a waybill from RS.ge and returns it as application/pdf.
 * Uses the first matching entry in RS_CREDENTIALS_MAP.
 */
export async function GET(req: NextRequest) {
  const { requireAuthOrCron, isAuthError } = await import('@/lib/auth-guard');
  const auth = await requireAuthOrCron(req);
  if (isAuthError(auth)) return auth;

  const url = new URL(req.url);
  const rsIdRaw = url.searchParams.get('rs_id');
  if (!rsIdRaw) return NextResponse.json({ error: 'rs_id is required' }, { status: 400 });

  const waybillId = parseInt(rsIdRaw, 10);
  if (isNaN(waybillId)) return NextResponse.json({ error: 'rs_id must be a number' }, { status: 400 });

  const credMap = getRsCredentialsMap();
  if (credMap.length === 0)
    return NextResponse.json({ error: 'No RS API credentials configured' }, { status: 503 });

  const { su, sp } = credMap[0];

  try {
    const pdfBuffer = await getPrintPdf(su, sp, waybillId);
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="waybill-${waybillId}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
