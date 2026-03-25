import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const revalidate = 0;

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
 * GET /api/adjustments/preview-nominal?paymentId=...&faceCurrency=...&faceAmount=...&date=...&manualRate=...
 * Returns { nominalAmount, nominalCurrency, rate } for live preview in the dialog.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const paymentId = searchParams.get('paymentId');
  const faceCurrency = searchParams.get('faceCurrency');
  const faceAmountStr = searchParams.get('faceAmount');
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const manualRateStr = searchParams.get('manualRate');

  if (!paymentId || !faceCurrency || !faceAmountStr) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  const faceAmount = parseFloat(faceAmountStr);
  if (!Number.isFinite(faceAmount) || faceAmount === 0) {
    return NextResponse.json({ error: 'Invalid face amount' }, { status: 400 });
  }

  const manualRate = manualRateStr ? parseFloat(manualRateStr) : null;

  // Get payment's nominal currency
  const rows = await prisma.$queryRawUnsafe<Array<{ code: string }>>(
    `SELECT c.code FROM currencies c JOIN payments p ON p.currency_uuid = c.uuid WHERE p.payment_id = $1 LIMIT 1`,
    paymentId
  );
  const nominalCurrency = rows?.[0]?.code || 'GEL';

  const faceUpper = faceCurrency.toUpperCase();
  const nomUpper = nominalCurrency.toUpperCase();

  if (faceUpper === nomUpper) {
    return NextResponse.json({ nominalAmount: faceAmount, nominalCurrency, rate: 1 });
  }

  if (manualRate && manualRate !== 0) {
    return NextResponse.json({
      nominalAmount: Math.round((faceAmount / manualRate) * 100) / 100,
      nominalCurrency,
      rate: manualRate,
      rateSource: 'manual',
    });
  }

  try {
    let nominalAmount: number;
    let rate: number;

    if (faceUpper === 'GEL') {
      const r = await lookupNbgRate(date, nominalCurrency);
      if (!r) return NextResponse.json({ error: `No NBG rate for ${nominalCurrency} on ${date}` }, { status: 404 });
      nominalAmount = faceAmount / r;
      rate = r;
    } else if (nomUpper === 'GEL') {
      const r = await lookupNbgRate(date, faceCurrency);
      if (!r) return NextResponse.json({ error: `No NBG rate for ${faceCurrency} on ${date}` }, { status: 404 });
      nominalAmount = faceAmount * r;
      rate = r;
    } else {
      const faceRate = await lookupNbgRate(date, faceCurrency);
      const nomRate = await lookupNbgRate(date, nominalCurrency);
      if (!faceRate) return NextResponse.json({ error: `No NBG rate for ${faceCurrency} on ${date}` }, { status: 404 });
      if (!nomRate) return NextResponse.json({ error: `No NBG rate for ${nominalCurrency} on ${date}` }, { status: 404 });
      nominalAmount = (faceAmount * faceRate) / nomRate;
      rate = faceRate / nomRate;
    }

    return NextResponse.json({
      nominalAmount: Math.round(nominalAmount * 100) / 100,
      nominalCurrency,
      rate: Math.round(rate * 1000000) / 1000000,
      rateSource: 'nbg',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Rate lookup failed' }, { status: 500 });
  }
}
