import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const DECONSOLIDATED_TABLE = 'GE78BG0000000893486000_BOG_GEL';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { parsing_lock } = await req.json();
    const id = Number(params.id);

    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "${DECONSOLIDATED_TABLE}" SET parsing_lock = $1, updated_at = NOW() WHERE id = $2`,
      Boolean(parsing_lock),
      id
    );

    return NextResponse.json({ success: true, id, parsing_lock: Boolean(parsing_lock) });
  } catch (error: any) {
    console.error('[PATCH /api/bank-transactions/parsing-lock/[id]] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update parsing lock' },
      { status: 500 }
    );
  }
}
