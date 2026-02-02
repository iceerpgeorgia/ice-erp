import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const DEFAULT_TABLE = 'GE78BG0000000893486000_BOG_GEL';
const ALLOWED_TABLES = new Set([
  'GE78BG0000000893486000_BOG_GEL',
  'GE65TB7856036050100002_TBC_GEL',
]);

function resolveTableName(searchParams: URLSearchParams): string {
  const sourceTable = searchParams.get('sourceTable');
  if (sourceTable && ALLOWED_TABLES.has(sourceTable)) {
    return sourceTable;
  }
  return DEFAULT_TABLE;
}

export async function POST(req: NextRequest) {
  try {
    const { ids, parsing_lock } = await req.json();
    const tableName = resolveTableName(req.nextUrl.searchParams);

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
    }

    const parsedIds = ids
      .map((id: any) => String(id))
      .filter((id: string) => /^\d+$/.test(id))
      .map((id: string) => BigInt(id));

    await prisma.$executeRawUnsafe(
      `UPDATE "${tableName}" SET parsing_lock = $1, updated_at = NOW() WHERE id = ANY($2::bigint[])`,
      Boolean(parsing_lock),
      parsedIds
    );

    return NextResponse.json({ success: true, updated: parsedIds.length, parsing_lock: Boolean(parsing_lock) });
  } catch (error: any) {
    console.error('[POST /api/bank-transactions/parsing-lock] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update parsing lock' },
      { status: 500 }
    );
  }
}
