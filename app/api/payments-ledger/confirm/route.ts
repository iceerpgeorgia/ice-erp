import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const revalidate = 0;

const isValidDate = (value: string | null) => {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const rawIds = Array.isArray(body?.paymentIds) ? body.paymentIds : [];
    const paymentIds = Array.from(new Set(rawIds.filter((id: unknown) => typeof id === 'string' && id.trim())));

    if (paymentIds.length === 0) {
      return NextResponse.json({ error: 'No payment IDs provided' }, { status: 400 });
    }

    const maxDate = typeof body?.maxDate === 'string' ? body.maxDate : null;
    if (maxDate && !isValidDate(maxDate)) {
      return NextResponse.json({ error: 'Invalid maxDate format' }, { status: 400 });
    }

    const updated = await prisma.$executeRawUnsafe(
      `UPDATE payments_ledger
       SET confirmed = true
       WHERE payment_id = ANY($1::text[])
         AND COALESCE(confirmed, false) = false
         AND (is_deleted = false OR is_deleted IS NULL)
         AND ($2::date IS NULL OR effective_date::date <= $2::date)`,
      paymentIds,
      maxDate
    );

    // Also update salary_accruals confirmed flag for matching payment_ids
    await prisma.$executeRawUnsafe(
      `UPDATE salary_accruals
       SET confirmed = true
       WHERE payment_id = ANY($1::text[])`,
      paymentIds
    );

    return NextResponse.json({ success: true, updated });
  } catch (error: any) {
    // DB check-constraint: due (total_order) exceeds balance (total_accrual)
    if (error?.code === 'P2010' && error?.meta?.code === '23514') {
      const dbMsg: string = error.meta.message ?? '';
      // Extract the human-readable part from the trigger message
      const match = dbMsg.match(/Cannot confirm payment_id=([^:]+): (.+)/);
      const cannotModifyMatch = dbMsg.match(/Confirmed entry can not be modified \(id=(\d+)\)/i);
      const userMessage = match
        ? `Cannot confirm payment ${match[1]}: ${match[2]}`
        : cannotModifyMatch
          ? `Cannot confirm: entry ${cannotModifyMatch[1]} is already confirmed.`
          : dbMsg
            ? `Cannot confirm: ${dbMsg}`
            : 'Cannot confirm due to a ledger validation rule.';
      return NextResponse.json({ error: userMessage }, { status: 422 });
    }

    console.error('Error confirming payment ledger entries:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
