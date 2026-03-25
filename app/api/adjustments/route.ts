import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const revalidate = 0;

const safeStringify = (value: unknown) =>
  JSON.stringify(value, (_key, val) => (typeof val === 'bigint' ? val.toString() : val));

const logAudit = async (params: {
  recordId: bigint;
  action: string;
  userEmail?: string | null;
  userId?: string | null;
  changes?: unknown;
}) => {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "AuditLog" ("table", record_id, action, user_email, user_id, changes)
     VALUES ($1, $2::bigint, $3, $4, $5, $6::jsonb)`,
    'payment_adjustments',
    params.recordId,
    params.action,
    params.userEmail || null,
    params.userId || null,
    safeStringify(params.changes ?? {})
  );
};

// Map currency code to nbg_exchange_rates column name
const RATE_COLUMN_MAP: Record<string, string> = {
  USD: 'usd_rate',
  EUR: 'eur_rate',
  CNY: 'cny_rate',
  GBP: 'gbp_rate',
  RUB: 'rub_rate',
  TRY: 'try_rate',
  AED: 'aed_rate',
  KZT: 'kzt_rate',
};

async function lookupNbgRate(date: string, currencyCode: string): Promise<number | null> {
  const col = RATE_COLUMN_MAP[currencyCode.toUpperCase()];
  if (!col) return null;
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT ${col} as rate FROM nbg_exchange_rates WHERE date <= $1::date ORDER BY date DESC LIMIT 1`,
    date
  );
  if (!rows?.length || rows[0].rate == null) return null;
  return parseFloat(rows[0].rate);
}

/**
 * Compute nominal amount from face amount.
 * NBG rates are GEL per 1 unit of foreign currency.
 * face→GEL: face * rate(face)
 * GEL→foreign: face / rate(nominal)
 * foreign→foreign: face * rate(face) / rate(nominal)
 */
async function computeNominalAmount(
  faceAmount: number,
  faceCurrencyCode: string,
  nominalCurrencyCode: string,
  date: string,
  manualRate?: number | null
): Promise<number> {
  const faceUpper = faceCurrencyCode.toUpperCase();
  const nomUpper = nominalCurrencyCode.toUpperCase();

  if (faceUpper === nomUpper) return faceAmount;
  if (manualRate && manualRate !== 0) return faceAmount / manualRate;

  if (faceUpper === 'GEL') {
    const rate = await lookupNbgRate(date, nominalCurrencyCode);
    if (!rate) throw new Error(`No NBG rate for ${nominalCurrencyCode} on ${date}`);
    return faceAmount / rate;
  }
  if (nomUpper === 'GEL') {
    const rate = await lookupNbgRate(date, faceCurrencyCode);
    if (!rate) throw new Error(`No NBG rate for ${faceCurrencyCode} on ${date}`);
    return faceAmount * rate;
  }
  const faceRate = await lookupNbgRate(date, faceCurrencyCode);
  const nomRate = await lookupNbgRate(date, nominalCurrencyCode);
  if (!faceRate) throw new Error(`No NBG rate for ${faceCurrencyCode} on ${date}`);
  if (!nomRate) throw new Error(`No NBG rate for ${nominalCurrencyCode} on ${date}`);
  return (faceAmount * faceRate) / nomRate;
}

function parseDateInput(effectiveDate?: string | null): string {
  if (!effectiveDate) return new Date().toISOString().split('T')[0];
  const m = effectiveDate.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : effectiveDate;
}

async function getPaymentNominalCurrency(paymentId: string): Promise<string> {
  const rows = await prisma.$queryRawUnsafe<Array<{ code: string }>>(
    `SELECT c.code FROM currencies c JOIN payments p ON p.currency_uuid = c.uuid WHERE p.payment_id = $1 LIMIT 1`,
    paymentId
  );
  return rows?.[0]?.code || 'GEL';
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');

    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
    }

    const adjustments = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
         pa.id,
         pa.payment_id,
         pa.effective_date,
         pa.amount,
         pa.face_currency_code,
         pa.face_amount,
         pa.manual_rate,
         pa.nominal_amount,
         pa.comment,
         pa.record_uuid,
         pa.user_email,
         pa.created_at,
         pa.updated_at,
         pa.is_deleted
       FROM payment_adjustments pa
       WHERE pa.payment_id = $1
         AND (pa.is_deleted = false OR pa.is_deleted IS NULL)
       ORDER BY pa.effective_date DESC, pa.created_at DESC`,
      paymentId
    );

    const formatted = adjustments.map(entry => ({
      id: Number(entry.id),
      paymentId: entry.payment_id,
      effectiveDate: entry.effective_date,
      amount: entry.amount ? parseFloat(entry.amount) : 0,
      faceCurrencyCode: entry.face_currency_code || null,
      faceAmount: entry.face_amount ? parseFloat(entry.face_amount) : null,
      manualRate: entry.manual_rate ? parseFloat(entry.manual_rate) : null,
      nominalAmount: entry.nominal_amount ? parseFloat(entry.nominal_amount) : (entry.amount ? parseFloat(entry.amount) : 0),
      comment: entry.comment,
      recordUuid: entry.record_uuid,
      userEmail: entry.user_email,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error('Error fetching payment adjustments:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { paymentId, effectiveDate, amount, comment, faceCurrencyCode, faceAmount, manualRate } = body;

    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
    }

    // Verify payment exists
    const paymentRows = await prisma.$queryRawUnsafe<Array<{ payment_id: string; insider_uuid: string | null }>>(
      `SELECT payment_id, insider_uuid
       FROM payments
       WHERE payment_id = $1 AND is_active = true
       LIMIT 1`,
      paymentId
    );

    if (!Array.isArray(paymentRows) || paymentRows.length === 0) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const insiderUuid = paymentRows[0]?.insider_uuid;
    if (!insiderUuid) {
      return NextResponse.json(
        { error: 'Payment insider UUID is missing; cannot create adjustment' },
        { status: 422 }
      );
    }

    const finalEffectiveDate = parseDateInput(effectiveDate);

    let finalAmount: number;
    let finalFaceCurrencyCode: string | null = null;
    let finalFaceAmount: number | null = null;
    let finalManualRate: number | null = manualRate ? parseFloat(manualRate) : null;
    let finalNominalAmount: number;

    if (faceCurrencyCode && faceAmount !== undefined && faceAmount !== null && parseFloat(faceAmount) !== 0) {
      // Face currency mode
      finalFaceCurrencyCode = faceCurrencyCode;
      finalFaceAmount = parseFloat(faceAmount);
      const nominalCurrencyCode = await getPaymentNominalCurrency(paymentId);

      finalNominalAmount = parseFloat(
        (await computeNominalAmount(finalFaceAmount, faceCurrencyCode as string, nominalCurrencyCode, finalEffectiveDate, finalManualRate)).toFixed(2)
      );
      finalAmount = finalNominalAmount;
    } else {
      // Direct amount mode (backward compatible)
      if (amount === undefined || amount === null || amount === 0) {
        return NextResponse.json({ error: 'Amount is required and cannot be zero' }, { status: 400 });
      }
      finalAmount = parseFloat(amount);
      finalNominalAmount = finalAmount;
    }

    const result = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO payment_adjustments (
         payment_id,
         effective_date,
         amount,
         face_currency_code,
         face_amount,
         manual_rate,
         nominal_amount,
         comment,
         user_email,
         insider_uuid
       ) VALUES ($1, $2::timestamp, $3, $4, $5, $6, $7, $8, $9, $10::uuid)
       RETURNING *`,
      paymentId,
      finalEffectiveDate,
      finalAmount,
      finalFaceCurrencyCode,
      finalFaceAmount,
      finalManualRate,
      finalNominalAmount,
      comment || null,
      session.user.email,
      insiderUuid
    );

    const formatted = result.map(entry => ({
      ...entry,
      id: Number(entry.id),
    }));

    if (formatted[0]) {
      await logAudit({
        recordId: BigInt(formatted[0].id),
        action: 'create',
        userEmail: session.user.email,
        changes: { after: formatted[0] },
      });
    }

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error('Error creating payment adjustment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create adjustment' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, effectiveDate, amount, comment, faceCurrencyCode, faceAmount, manualRate } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT pa.*, c.code as nominal_currency_code
       FROM payment_adjustments pa
       JOIN payments p ON p.payment_id = pa.payment_id
       LEFT JOIN currencies c ON c.uuid = p.currency_uuid
       WHERE pa.id = $1`,
      BigInt(id)
    );

    if (!existing?.length) {
      return NextResponse.json({ error: 'Adjustment not found' }, { status: 404 });
    }

    const sets: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    const finalDate = effectiveDate !== undefined ? parseDateInput(effectiveDate) : null;
    if (finalDate) {
      sets.push(`effective_date = $${paramIdx}::timestamp`);
      params.push(finalDate);
      paramIdx++;
    }

    if (comment !== undefined) {
      sets.push(`comment = $${paramIdx}`);
      params.push(comment || null);
      paramIdx++;
    }

    if (faceCurrencyCode !== undefined) {
      sets.push(`face_currency_code = $${paramIdx}`);
      params.push(faceCurrencyCode || null);
      paramIdx++;
    }
    if (faceAmount !== undefined) {
      sets.push(`face_amount = $${paramIdx}`);
      params.push(faceAmount !== null ? parseFloat(faceAmount) : null);
      paramIdx++;
    }
    if (manualRate !== undefined) {
      sets.push(`manual_rate = $${paramIdx}`);
      params.push(manualRate !== null ? parseFloat(manualRate) : null);
      paramIdx++;
    }

    // Recompute nominal if face currency fields changed
    const newFaceCurrency = faceCurrencyCode !== undefined ? faceCurrencyCode : existing[0].face_currency_code;
    const newFaceAmt = faceAmount !== undefined ? (faceAmount !== null ? parseFloat(faceAmount) : null) : (existing[0].face_amount ? parseFloat(existing[0].face_amount) : null);
    const newManual = manualRate !== undefined ? (manualRate !== null ? parseFloat(manualRate) : null) : (existing[0].manual_rate ? parseFloat(existing[0].manual_rate) : null);
    const dateForRate = finalDate || (existing[0].effective_date ? new Date(existing[0].effective_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);

    if (newFaceCurrency && newFaceAmt) {
      const nomCurrency = existing[0].nominal_currency_code || 'GEL';
      const nominalAmount = parseFloat(
        (await computeNominalAmount(newFaceAmt, newFaceCurrency, nomCurrency, dateForRate, newManual)).toFixed(2)
      );
      sets.push(`nominal_amount = $${paramIdx}`);
      params.push(nominalAmount);
      paramIdx++;
      sets.push(`amount = $${paramIdx}`);
      params.push(nominalAmount);
      paramIdx++;
    } else if (amount !== undefined) {
      sets.push(`amount = $${paramIdx}`);
      params.push(amount);
      paramIdx++;
      sets.push(`nominal_amount = $${paramIdx}`);
      params.push(amount);
      paramIdx++;
    }

    sets.push(`updated_at = NOW()`);

    if (sets.length === 1) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    params.push(BigInt(id));
    const query = `UPDATE payment_adjustments SET ${sets.join(', ')} WHERE id = $${paramIdx} RETURNING *`;
    const result = await prisma.$queryRawUnsafe<any[]>(query, ...params);

    const formatted = result.map(entry => ({
      ...entry,
      id: Number(entry.id),
    }));

    await logAudit({
      recordId: BigInt(id),
      action: 'update',
      userEmail: session.user.email,
      changes: { before: existing[0], after: formatted[0] },
    });

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error('Error updating payment adjustment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update adjustment' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM payment_adjustments WHERE id = $1`,
      BigInt(id)
    );

    await prisma.$executeRawUnsafe(
      `DELETE FROM payment_adjustments WHERE id = $1`,
      BigInt(id)
    );

    await logAudit({
      recordId: BigInt(id),
      action: 'delete',
      userEmail: session.user.email,
      changes: { before: existing?.[0] ?? null },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting payment adjustment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete adjustment' },
      { status: 500 }
    );
  }
}
