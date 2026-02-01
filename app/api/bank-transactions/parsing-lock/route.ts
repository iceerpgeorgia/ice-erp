import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const DECONSOLIDATED_TABLE = 'GE78BG0000000893486000_BOG_GEL';

export async function POST(req: NextRequest) {
  try {
    const { ids, parsing_lock } = await req.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "${DECONSOLIDATED_TABLE}" SET parsing_lock = $1, updated_at = NOW() WHERE id = ANY($2::bigint[])`,
      Boolean(parsing_lock),
      ids.map((id: any) => BigInt(id))
    );

    return NextResponse.json({ success: true, updated: ids.length, parsing_lock: Boolean(parsing_lock) });
  } catch (error: any) {
    console.error('[POST /api/bank-transactions/parsing-lock] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update parsing lock' },
      { status: 500 }
    );
  }
}
