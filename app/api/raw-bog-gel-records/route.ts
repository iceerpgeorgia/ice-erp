import { NextRequest, NextResponse } from 'next/server';
import { prisma, withRetry } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedLimit = parseInt(searchParams.get('limit') || '100', 10);
    const requestedOffset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 500) : 100;
    const offset = Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0;

    const result = await withRetry(() => prisma.$queryRawUnsafe(`
      SELECT 
        uuid,
        dockey,
        entriesid,
        docvaluedate,
        docnomination,
        entrydbamt,
        entrycramt,
        docinformation,
        bank_account_uuid
      FROM bog_gel_raw_893486000
      WHERE is_processed = false
      ORDER BY docvaluedate DESC
      LIMIT ${limit} OFFSET ${offset}
    `));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching raw records:', error);
    return NextResponse.json(
      { error: 'Failed to fetch records' },
      { status: 500 }
    );
  }
}
