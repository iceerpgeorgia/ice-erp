import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const tableExists = async (tableName: string) => {
  const rows = await prisma.$queryRaw<{ regclass: string | null }[]>`
    SELECT to_regclass(${`public.${tableName}`})::text as regclass
  `;
  return Array.isArray(rows) && rows[0]?.regclass !== null;
};

export async function PATCH(req: NextRequest) {
  try {
    if (!(await tableExists('rs_waybills_in'))) {
      return NextResponse.json(
        { error: 'Waybills table is not available yet. Please run migrations.' },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? body.ids : [];
    const projectUuid = body?.project_uuid ?? body?.projectUuid ?? null;
    const financialCodeUuid = body?.financial_code_uuid ?? body?.financialCodeUuid ?? null;
    const correspondingAccount = body?.corresponding_account ?? body?.correspondingAccount ?? null;

    if (!ids.length) {
      return NextResponse.json({ error: 'No ids provided' }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (projectUuid) updates.project_uuid = String(projectUuid);
    if (financialCodeUuid) updates.financial_code_uuid = String(financialCodeUuid);
    if (correspondingAccount) updates.corresponding_account = String(correspondingAccount);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    updates.updated_at = new Date();

    const normalizedIds = ids
      .map((id: any) => Number(id))
      .filter((id: number) => Number.isFinite(id));

    if (!normalizedIds.length) {
      return NextResponse.json({ error: 'No valid ids provided' }, { status: 400 });
    }

    const result = await prisma.rs_waybills_in.updateMany({
      where: { id: { in: normalizedIds } },
      data: updates,
    });

    return NextResponse.json({ updated: result.count });
  } catch (error: any) {
    console.error('[PATCH /api/waybills/bulk] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update waybills' },
      { status: 500 }
    );
  }
}
