import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const DEFAULT_TABLE = 'GE78BG0000000893486000_BOG_GEL';
const ALLOWED_TABLES = new Set([
  'GE78BG0000000893486000_BOG_GEL',
  'GE78BG0000000893486000_BOG_USD',
  'GE65TB7856036050100002_TBC_GEL',
]);

function resolveTableName(searchParams: URLSearchParams): string {
  const sourceTable = searchParams.get('sourceTable');
  if (sourceTable && ALLOWED_TABLES.has(sourceTable)) {
    return sourceTable;
  }
  return DEFAULT_TABLE;
}

function resolveRecordId(paramId: string, searchParams: URLSearchParams): string {
  const sourceId = searchParams.get('sourceId');
  return sourceId && sourceId.trim() ? sourceId : paramId;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { parsing_lock } = await req.json();
    const searchParams = req.nextUrl.searchParams;
    const tableName = resolveTableName(searchParams);
    const recordId = resolveRecordId(params.id, searchParams);
    const idParam = /^\d+$/.test(recordId) ? BigInt(recordId) : recordId;

    await prisma.$executeRawUnsafe(
      `UPDATE "${tableName}" SET parsing_lock = $1, updated_at = NOW() WHERE id = $2`,
      Boolean(parsing_lock),
      idParam
    );

    return NextResponse.json({ success: true, id: recordId, parsing_lock: Boolean(parsing_lock) });
  } catch (error: any) {
    console.error('[PATCH /api/bank-transactions/parsing-lock/[id]] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update parsing lock' },
      { status: 500 }
    );
  }
}
