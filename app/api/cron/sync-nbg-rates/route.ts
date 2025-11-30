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

    // Backfill missing dates (copy from exchange-rates/update)
    await backfillMissingDates(saveDate, rates);

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

async function backfillMissingDates(currentDate: Date, currentRates: any) {
  try {
    const lastRecord = await prisma.nBGExchangeRate.findFirst({
      where: { date: { lt: currentDate } },
      orderBy: { date: 'desc' },
    });

    if (!lastRecord) return;

    const lastDate = new Date(lastRecord.date);
    lastDate.setHours(0, 0, 0, 0);
    
    const today = new Date(currentDate);
    today.setHours(0, 0, 0, 0);

    const daysToBackfill = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysToBackfill <= 1) return;

    console.log(`[NBG Sync] Backfilling ${daysToBackfill - 1} missing dates`);

    for (let i = 1; i < daysToBackfill; i++) {
      const missingDate = new Date(lastDate);
      missingDate.setDate(missingDate.getDate() + i);
      missingDate.setHours(0, 0, 0, 0);

      const exists = await prisma.nBGExchangeRate.findUnique({ where: { date: missingDate } });
      if (exists) continue;

      let ratesToUse = currentRates;
      const fetchDate = isWeekend(missingDate) ? getLastBusinessDay(missingDate) : missingDate;
      
      try {
        const response = await fetch(`${NBG_API_URL}?date=${fetchDate.toISOString().split('T')[0]}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            const currencies = data[0].currencies || [];
            ratesToUse = {};
            
            for (const currency of currencies) {
              const code = currency.code?.toUpperCase();
              const quantity = parseFloat(currency.quantity || 1);
              const rate = parseFloat(currency.rate || 0);

              if (code && rate > 0) {
                const ratePerUnit = rate / quantity;
                if (code === 'USD') ratesToUse.usdRate = new Prisma.Decimal(ratePerUnit);
                if (code === 'EUR') ratesToUse.eurRate = new Prisma.Decimal(ratePerUnit);
                if (code === 'CNY') ratesToUse.cnyRate = new Prisma.Decimal(ratePerUnit);
                if (code === 'GBP') ratesToUse.gbpRate = new Prisma.Decimal(ratePerUnit);
                if (code === 'RUB') ratesToUse.rubRate = new Prisma.Decimal(ratePerUnit);
                if (code === 'TRY') ratesToUse.tryRate = new Prisma.Decimal(ratePerUnit);
                if (code === 'AED') ratesToUse.aedRate = new Prisma.Decimal(ratePerUnit);
                if (code === 'KZT') ratesToUse.kztRate = new Prisma.Decimal(ratePerUnit);
              }
            }
          }
        }
      } catch (error) {
        console.error(`[NBG Sync] Failed to fetch rates for ${missingDate.toISOString().split('T')[0]}`);
        continue;
      }

      await prisma.nBGExchangeRate.create({
        data: { date: missingDate, ...ratesToUse },
      });

      console.log(`[NBG Sync] Backfilled ${missingDate.toISOString().split('T')[0]}`);
    }
  } catch (error) {
    console.error('[NBG Sync] Backfill error:', error);
  }
}
