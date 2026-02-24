import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const revalidate = 0;

const excelSerialToIso = (value: number) => {
  const epoch = Date.UTC(1899, 11, 30);
  const ms = Math.round(value * 86400000);
  return new Date(epoch + ms).toISOString().split('T')[0];
};

const parseEffectiveDate = (effectiveDate?: string | number | Date | null) => {
  if (effectiveDate === null || effectiveDate === undefined || effectiveDate === '') {
    return null;
  }

  if (effectiveDate instanceof Date && !Number.isNaN(effectiveDate.getTime())) {
    return effectiveDate.toISOString().split('T')[0];
  }

  if (typeof effectiveDate === 'number' && Number.isFinite(effectiveDate)) {
    return excelSerialToIso(effectiveDate);
  }

  const raw = String(effectiveDate).trim();
  if (!raw) return null;

  if (/^\d+(\.\d+)?$/.test(raw)) {
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) {
      return excelSerialToIso(numeric);
    }
  }

  const ddmmyyyyPattern = /^(\d{2})\.(\d{2})\.(\d{4})$/;
  const ddMatch = raw.match(ddmmyyyyPattern);
  if (ddMatch) {
    const [, day, month, year] = ddMatch;
    return `${year}-${month}-${day}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const mmddyyyyPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const mdMatch = raw.match(mmddyyyyPattern);
  if (mdMatch) {
    const [, month, day, year] = mdMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const entries = Array.isArray(body?.entries) ? body.entries : [];

    if (entries.length === 0) {
      return NextResponse.json({ error: 'No entries provided' }, { status: 400 });
    }

    const normalized = entries.map((entry: any) => ({
      paymentId: entry.paymentId || entry.payment_id,
      effectiveDate: parseEffectiveDate(entry.effectiveDate || entry.effective_date),
      accrual: entry.accrual !== undefined && entry.accrual !== null ? Number(entry.accrual) : 0,
      order: entry.order !== undefined && entry.order !== null ? Number(entry.order) : 0,
      comment: entry.comment || null,
    }));

    for (const entry of normalized) {
      if (!entry.paymentId) {
        return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
      }

      if (!entry.effectiveDate) {
        return NextResponse.json(
          { error: `Effective date is required (payment ${entry.paymentId})` },
          { status: 400 }
        );
      }

      if ((!entry.accrual || entry.accrual === 0) && (!entry.order || entry.order === 0)) {
        return NextResponse.json(
          { error: `Either accrual or order must be provided and cannot be zero (payment ${entry.paymentId})` },
          { status: 400 }
        );
      }
    }

    const paymentIds = Array.from(new Set(normalized.map((entry: { paymentId: string }) => entry.paymentId)));
    const totals = await prisma.$queryRawUnsafe<
      Array<{ payment_id: string; accrual_total: any; order_total: any }>
    >(
      `SELECT payment_id,
              COALESCE(SUM(accrual), 0) AS accrual_total,
              COALESCE(SUM("order"), 0) AS order_total
       FROM payments_ledger
       WHERE payment_id = ANY($1::text[])
         AND (is_deleted = false OR is_deleted IS NULL)
       GROUP BY payment_id`,
      paymentIds
    );

    const totalsMap = new Map<string, { accrual: number; order: number }>();
    for (const row of totals) {
      totalsMap.set(row.payment_id, {
        accrual: Number(row.accrual_total || 0),
        order: Number(row.order_total || 0),
      });
    }

    const orderAdditions = new Map<string, number>();
    const accrualAdditions = new Map<string, number>();
    for (const entry of normalized) {
      orderAdditions.set(
        entry.paymentId,
        (orderAdditions.get(entry.paymentId) || 0) + Number(entry.order || 0)
      );
      accrualAdditions.set(
        entry.paymentId,
        (accrualAdditions.get(entry.paymentId) || 0) + Number(entry.accrual || 0)
      );
    }

    for (const [paymentId, addedOrder] of orderAdditions.entries()) {
      const existing = totalsMap.get(paymentId) || { accrual: 0, order: 0 };
      const toCents = (value: number) => Math.round(value * 100);
      const currentExcessCents = Math.max(0, toCents(existing.order) - toCents(existing.accrual));
      const nextExcessCents = Math.max(
        0,
        (toCents(existing.order) + toCents(addedOrder)) -
          (toCents(existing.accrual) + toCents(accrualAdditions.get(paymentId) || 0))
      );

      if (nextExcessCents > currentExcessCents) {
        return NextResponse.json(
          {
            error: `Total order cannot exceed total accrual for payment ${paymentId}`,
          },
          { status: 400 }
        );
      }
    }

    await prisma.$transaction(
      normalized.map((entry: { paymentId: string; effectiveDate: string; accrual: number; order: number; comment: string | null }) =>
        prisma.$executeRawUnsafe(
          `INSERT INTO payments_ledger (
             payment_id,
             effective_date,
             accrual,
             "order",
             comment,
             user_email
           ) VALUES ($1, $2::timestamp, $3, $4, $5, $6)`,
          entry.paymentId,
          entry.effectiveDate,
          entry.accrual || null,
          entry.order || null,
          entry.comment || null,
          session.user.email
        )
      )
    );

    return NextResponse.json({ success: true, inserted: normalized.length });
  } catch (error: any) {
    console.error('Error creating bulk payment ledger entries:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}