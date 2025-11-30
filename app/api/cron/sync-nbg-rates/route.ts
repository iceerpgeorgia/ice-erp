import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

const NBG_API_URL = 'https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

function getLastBusinessDay(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  
  if (day === 0) { // Sunday
    result.setDate(result.getDate() - 2); // Go back to Friday
  } else if (day === 6) { // Saturday
    result.setDate(result.getDate() - 1); // Go back to Friday
  }
  
  return result;
}

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[NBG Sync] Starting NBG exchange rates sync...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let targetDate = today;

    // Weekend handling: fetch Friday's rates from NBG API
    if (isWeekend(today)) {
      targetDate = getLastBusinessDay(today);
      targetDate.setHours(0, 0, 0, 0);
      
      console.log(`[NBG Sync] Today is ${today.getDay() === 6 ? 'Saturday' : 'Sunday'}, fetching Friday's rates (${targetDate.toISOString().split('T')[0]}) from NBG API`);
    }

    // Fetch from NBG API (either today for weekdays, or Friday for weekends)
    console.log(`[NBG Sync] Fetching rates for ${targetDate.toISOString().split('T')[0]} from NBG API`);
    
    const response = await fetch(`${NBG_API_URL}?date=${targetDate.toISOString().split('T')[0]}`, { 
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch from NBG API');
    }

    const data = await response.json();
    
    if (!data || data.length === 0) {
      throw new Error('No data received from NBG API');
    }

    const ratesData = data[0];
    const currencies = ratesData.currencies || [];

    // Build rates object
    const rates: any = {};
    
    for (const currency of currencies) {
      const code = currency.code?.toUpperCase();
      const quantity = parseFloat(currency.quantity || 1);
      const rate = parseFloat(currency.rate || 0);

      if (code && rate > 0) {
        const ratePerUnit = rate / quantity;
        
        // Map to our database columns
        if (code === 'USD') rates.usdRate = new Prisma.Decimal(ratePerUnit);
        if (code === 'EUR') rates.eurRate = new Prisma.Decimal(ratePerUnit);
        if (code === 'CNY') rates.cnyRate = new Prisma.Decimal(ratePerUnit);
        if (code === 'GBP') rates.gbpRate = new Prisma.Decimal(ratePerUnit);
        if (code === 'RUB') rates.rubRate = new Prisma.Decimal(ratePerUnit);
        if (code === 'TRY') rates.tryRate = new Prisma.Decimal(ratePerUnit);
        if (code === 'AED') rates.aedRate = new Prisma.Decimal(ratePerUnit);
        if (code === 'KZT') rates.kztRate = new Prisma.Decimal(ratePerUnit);
      }
    }

    // If it's a weekend, save rates for TODAY (not Friday)
    const saveDate = today;

    // Check if today's date exists
    const existing = await prisma.nBGExchangeRate.findUnique({
      where: { date: saveDate },
    });

    let result;

    if (existing) {
      // Update existing
      result = await prisma.nBGExchangeRate.update({
        where: { date: saveDate },
        data: rates,
      });

      await logAudit({
        table: 'nbg_exchange_rates',
        recordId: result.id,
        action: 'update',
      });
    } else {
      // Create new
      result = await prisma.nBGExchangeRate.create({
        data: {
          date: saveDate,
          ...rates,
        },
      });

      await logAudit({
        table: 'nbg_exchange_rates',
        recordId: result.id,
        action: 'create',
      });
    }

    const message = isWeekend(today)
      ? `Weekend rates (from Friday ${targetDate.toISOString().split('T')[0]}) synced successfully`
      : 'NBG rates synced successfully';

    return NextResponse.json({
      success: true,
      date: result.date.toISOString().split('T')[0],
      message,
    });
  } catch (error: any) {
    console.error('[NBG Sync] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
