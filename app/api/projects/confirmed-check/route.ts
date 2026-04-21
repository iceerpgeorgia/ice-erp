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
    const rows = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
      `SELECT COUNT(*) AS cnt
       FROM payments_ledger pl
       WHERE pl.payment_id IN (
         SELECT payment_id FROM payments
         WHERE project_uuid = $1::uuid
           AND (is_project_derived = true OR is_bundle_payment = true)
       )
       AND pl.confirmed = true
       AND (pl.is_deleted = false OR pl.is_deleted IS NULL)`,
      projectUuid
    );

    const count = rows.length > 0 ? Number(rows[0].cnt) : 0;
    return NextResponse.json({ hasConfirmed: count > 0, count });
  } catch (error) {
    console.error('[confirmed-check] error:', error);
    return NextResponse.json({ error: 'Failed to check confirmed entries' }, { status: 500 });
  }
}
