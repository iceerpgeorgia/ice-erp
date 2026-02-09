import { NextRequest, NextResponse } from 'next/server';
import { reparseByPaymentId, reparseBySourceId } from '@/lib/bank-import/reparse';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const paymentId = typeof body?.paymentId === 'string' ? body.paymentId.trim() : '';
    const sourceTable = typeof body?.sourceTable === 'string' ? body.sourceTable.trim() : '';
    const sourceId = Number.isFinite(Number(body?.sourceId)) ? Number(body?.sourceId) : null;

    if (paymentId) {
      const result = await reparseByPaymentId(paymentId);
      return NextResponse.json({ success: true, ...result });
    }

    if (sourceTable && sourceId !== null) {
      const updated = await reparseBySourceId(sourceTable, sourceId);
      return NextResponse.json({ success: true, updated });
    }

    return NextResponse.json(
      { error: 'paymentId or sourceTable/sourceId required' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[POST /api/bank-transactions/reparse] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to reparse' },
      { status: 500 }
    );
  }
}
