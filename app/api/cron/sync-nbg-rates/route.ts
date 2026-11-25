import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

const NBG_API_URL = 'https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Calendar date (YYYY-MM-DD) in Tbilisi, independent of the server's timezone.
function tbilisiDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tbilisi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

// Rates are stored under the effective date NBG returns, never under the run date.
function parseRates(currencies: any[]): Record<string, Prisma.Decimal> {
  const rates: Record<string, Prisma.Decimal> = {};
  for (const currency of currencies) {
    const code = currency.code?.toUpperCase();
    const quantity = parseFloat(currency.quantity || 1);
    const rate = parseFloat(currency.rate || 0);
    if (!code || !(rate > 0)) continue;
    const ratePerUnit = new Prisma.Decimal(rate / quantity);
    if (code === 'USD') rates.usd_rate = ratePerUnit;
    if (code === 'EUR') rates.eur_rate = ratePerUnit;
    if (code === 'CNY') rates.cny_rate = ratePerUnit;
    if (code === 'GBP') rates.gbp_rate = ratePerUnit;
    if (code === 'RUB') rates.rub_rate = ratePerUnit;
    if (code === 'TRY') rates.try_rate = ratePerUnit;
    if (code === 'AED') rates.aed_rate = ratePerUnit;
    if (code === 'KZT') rates.kzt_rate = ratePerUnit;
  }
  return rates;
}

async function fetchNbg(requestedDate?: string) {
  const url = requestedDate ? `${NBG_API_URL}?date=${requestedDate}` : NBG_API_URL;
  const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Failed to fetch from NBG API: HTTP ${response.status}`);
  const data = await response.json();
  if (!data || data.length === 0) throw new Error('No data received from NBG API');
  const ratesData = data[0];
  const effectiveDate = String(ratesData.date || '').split('T')[0];
  if (!effectiveDate) throw new Error('No effective date in NBG API response');
  return { effectiveDate, rates: parseRates(ratesData.currencies || []) };
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[NBG Sync] Starting NBG exchange rates sync...');

    // NBG returns the latest published rates; the date it returns is the effective date.
    const { effectiveDate, rates } = await fetchNbg(tbilisiDate());
    const saveDate = new Date(effectiveDate);

    const existing = await prisma.nbg_exchange_rates.findUnique({ where: { date: saveDate } });

    let result;
    if (existing) {
      result = await prisma.nbg_exchange_rates.update({ where: { date: saveDate }, data: rates });
      await logAudit({ table: 'nbg_exchange_rates', recordId: result.id, action: 'update' });
    } else {
      result = await prisma.nbg_exchange_rates.create({ data: { date: saveDate, ...rates } });
      await logAudit({ table: 'nbg_exchange_rates', recordId: result.id, action: 'create' });
    }

    return NextResponse.json({
      success: true,
      date: effectiveDate,
      message: 'NBG rates synced successfully',
    });
  } catch (error: any) {
    console.error('[NBG Sync] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
