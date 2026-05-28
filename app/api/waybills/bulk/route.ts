import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, isAuthError } from '@/lib/auth-guard';
import { syncWaybillPayment } from '@/lib/waybills/sync-waybill-payment';

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
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  try {
    if (!(await tableExists('rs_waybills_in_api'))) {
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

    const normalizedIds = ids
      .map((id: any) => Number(id))
      .filter((id: number) => Number.isFinite(id));

    if (!normalizedIds.length) {
      return NextResponse.json({ error: 'No valid ids provided' }, { status: 400 });
    }

    const result = await prisma.rs_waybills_in_api.updateMany({
      where: { id: { in: normalizedIds } },
      data: updates,
    });

    // Sync waybill-derived payments when project or counteragent binding changes in bulk
    if (hasProject || 'counteragent_uuid' in updates) {
      try {
        const updatedWaybills = await prisma.rs_waybills_in_api.findMany({
          where: { id: { in: normalizedIds } },
          select: {
            rs_id: true, sum: true, type: true, waybill_no: true,
            project_uuid: true, counteragent_uuid: true,
            activation_time: true, insider_uuid: true,
          },
        });
        await Promise.allSettled(
          updatedWaybills
            .filter((w) => w.rs_id)
            .map((w) =>
              syncWaybillPayment(
                {
                  rs_id: String(w.rs_id),
                  sum: w.sum,
                  type: w.type,
                  waybill_no: w.waybill_no,
                  project_uuid: w.project_uuid,
                  counteragent_uuid: w.counteragent_uuid,
                  activation_time: w.activation_time,
                  insider_uuid: w.insider_uuid,
                },
                auth.user.email
              ).catch((err) =>
                console.error(`[PATCH /api/waybills/bulk] syncWaybillPayment error for ${w.rs_id}:`, err)
              )
            )
        );
      } catch (syncErr) {
        console.error('[PATCH /api/waybills/bulk] Payment sync error:', syncErr);
      }
    }

    return NextResponse.json({ updated: result.count });
  } catch (error: any) {
    console.error('[PATCH /api/waybills/bulk] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update waybills' },
      { status: 500 }
    );
  }
}
