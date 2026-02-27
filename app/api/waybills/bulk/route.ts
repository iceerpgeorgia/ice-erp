import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeUuid = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const normalized = String(value).trim();
  return UUID_REGEX.test(normalized) ? normalized : null;
};

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
    const hasProject = Object.prototype.hasOwnProperty.call(body, 'project_uuid')
      || Object.prototype.hasOwnProperty.call(body, 'projectUuid');
    const hasFinancialCode = Object.prototype.hasOwnProperty.call(body, 'financial_code_uuid')
      || Object.prototype.hasOwnProperty.call(body, 'financialCodeUuid');
    const hasCorrespondingAccount = Object.prototype.hasOwnProperty.call(body, 'corresponding_account')
      || Object.prototype.hasOwnProperty.call(body, 'correspondingAccount');

    const projectUuid = hasProject ? (body?.project_uuid ?? body?.projectUuid ?? null) : null;
    const financialCodeUuid = hasFinancialCode
      ? (body?.financial_code_uuid ?? body?.financialCodeUuid ?? null)
      : null;
    const correspondingAccount = hasCorrespondingAccount
      ? (body?.corresponding_account ?? body?.correspondingAccount ?? null)
      : null;

    if (!ids.length) {
      return NextResponse.json({ error: 'No ids provided' }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (hasProject) {
      const normalized = normalizeUuid(projectUuid);
      if (projectUuid && !normalized) {
        return NextResponse.json({ error: 'Invalid UUID for project_uuid' }, { status: 400 });
      }
      updates.project_uuid = normalized;
    }
    if (hasFinancialCode) {
      const normalized = normalizeUuid(financialCodeUuid);
      if (financialCodeUuid && !normalized) {
        return NextResponse.json({ error: 'Invalid UUID for financial_code_uuid' }, { status: 400 });
      }
      updates.financial_code_uuid = normalized;
    }
    if (hasCorrespondingAccount) {
      updates.corresponding_account = correspondingAccount ? String(correspondingAccount) : null;
    }

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
