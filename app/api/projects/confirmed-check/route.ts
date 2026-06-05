import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, isAuthError } from '@/lib/auth-guard';

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const { searchParams } = new URL(req.url);
  const projectUuid = searchParams.get('projectUuid');

  if (!projectUuid) {
    return NextResponse.json({ error: 'projectUuid is required' }, { status: 400 });
  }

  try {
    const projectRows = await prisma.$queryRawUnsafe<Array<{ financial_code_uuid: string | null }>>(
      `SELECT financial_code_uuid::text
       FROM projects
       WHERE project_uuid = $1::uuid
       LIMIT 1`,
      projectUuid
    );
    const projectFcUuid = projectRows[0]?.financial_code_uuid ?? null;

    const rows = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
      `SELECT COUNT(*) AS cnt
       FROM payments_ledger pl
       WHERE pl.payment_id IN (
         SELECT p.payment_id
         FROM payments p
         WHERE p.project_uuid = $1::uuid
           AND p.is_active = true
           AND (
             p.is_project_derived = true
             OR p.is_bundle_payment = true
             OR (
               p.waybill_derived = false
               AND p.job_uuid IS NULL
               AND p.income_tax = false
               AND (
                 p.financial_code_uuid = $2::uuid
                 OR EXISTS (
                   SELECT 1
                   FROM financial_codes fc
                   WHERE fc.parent_uuid = $2::uuid
                     AND fc.is_active = true
                     AND fc.uuid = p.financial_code_uuid
                 )
               )
             )
           )
       )
       AND pl.confirmed = true
       AND (pl.is_deleted = false OR pl.is_deleted IS NULL)`,
      projectUuid,
      projectFcUuid
    );

    const count = rows.length > 0 ? Number(rows[0].cnt) : 0;
    return NextResponse.json({ hasConfirmed: count > 0, count });
  } catch (error) {
    console.error('[confirmed-check] error:', error);
    return NextResponse.json({ error: 'Failed to check confirmed entries' }, { status: 500 });
  }
}
