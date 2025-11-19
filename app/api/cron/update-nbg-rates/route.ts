import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const NBG_API_URL = "https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/";

// Force dynamic rendering for cron endpoint
export const dynamic = 'force-dynamic';

// This endpoint will be called by Vercel Cron daily at 19:00 UTC (equivalent to Georgian time)
export async function GET(req: NextRequest) {
  try {
    // Verify the request is from Vercel Cron (optional but recommended)
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log('[CRON] Starting NBG rates update...');

    // Fetch from NBG API
    const response = await fetch(NBG_API_URL, { 
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error("Failed to fetch from NBG API");
    }

    const data = await response.json();
    
    if (!data || data.length === 0) {
      throw new Error("No data received from NBG API");
    }

    const ratesData = data[0];
    const currencies = ratesData.currencies || [];
    const dateStr = ratesData.date || "";

    if (!dateStr) {
      throw new Error("No date in NBG API response");
    }

    // Parse date
    const rateDate = new Date(dateStr.split('T')[0]);

    console.log(`[CRON] Processing rates for date: ${rateDate.toISOString().split('T')[0]}`);

    // Build rates object
    const rates: any = {};
    let processedCount = 0;
    
    for (const currency of currencies) {
      const code = currency.code?.toUpperCase();
      const quantity = parseFloat(currency.quantity || 1);
      const rate = parseFloat(currency.rate || 0);

      if (code && rate > 0) {
        const ratePerUnit = rate / quantity;
        
        // Map to our database columns
        if (code === 'USD') {
          rates.usdRate = new Prisma.Decimal(ratePerUnit);
          processedCount++;
        }
        if (code === 'EUR') {
          rates.eurRate = new Prisma.Decimal(ratePerUnit);
          processedCount++;
        }
        if (code === 'CNY') {
          rates.cnyRate = new Prisma.Decimal(ratePerUnit);
          processedCount++;
        }
        if (code === 'GBP') {
          rates.gbpRate = new Prisma.Decimal(ratePerUnit);
          processedCount++;
        }
        if (code === 'RUB') {
          rates.rubRate = new Prisma.Decimal(ratePerUnit);
          processedCount++;
        }
        if (code === 'TRY') {
          rates.tryRate = new Prisma.Decimal(ratePerUnit);
          processedCount++;
        }
        if (code === 'AED') {
          rates.aedRate = new Prisma.Decimal(ratePerUnit);
          processedCount++;
        }
        if (code === 'KZT') {
          rates.kztRate = new Prisma.Decimal(ratePerUnit);
          processedCount++;
        }
      }
    }

    console.log(`[CRON] Processed ${processedCount} currency rates`);

    // Check if date exists
    const existing = await prisma.nBGExchangeRate.findUnique({
      where: { date: rateDate },
    });

    let result;
    let action;

    if (existing) {
      // Update existing
      result = await prisma.nBGExchangeRate.update({
        where: { date: rateDate },
        data: rates,
      });

      await logAudit({
        table: "nbg_exchange_rates",
        recordId: result.id,
        action: "update",
      });

      action = "updated";
      console.log(`[CRON] Updated existing rates for ${rateDate.toISOString().split('T')[0]}`);
    } else {
      // Create new
      result = await prisma.nBGExchangeRate.create({
        data: {
          date: rateDate,
          ...rates,
        },
      });

      await logAudit({
        table: "nbg_exchange_rates",
        recordId: result.id,
        action: "create",
      });

      action = "created";
      console.log(`[CRON] Created new rates for ${rateDate.toISOString().split('T')[0]}`);
    }

    // Backfill any missing dates between last DB date and today using NBG API
    const lastDbDate = await prisma.nBGExchangeRate.findFirst({
      orderBy: { date: 'desc' },
      select: { date: true }
    });

    let filledCount = 0;
    if (lastDbDate) {
      const daysBetween = Math.floor((rateDate.getTime() - lastDbDate.date.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysBetween > 1) {
        console.log(`[CRON] Found ${daysBetween - 1} missing date(s) between ${lastDbDate.date.toISOString().split('T')[0]} and ${rateDate.toISOString().split('T')[0]}`);
        
        // Fill missing dates by fetching from NBG API
        for (let i = 1; i < daysBetween; i++) {
          const fillDate = new Date(lastDbDate.date);
          fillDate.setDate(fillDate.getDate() + i);
          
          const dateStr = fillDate.toISOString().split('T')[0];

          const exists = await prisma.nBGExchangeRate.findUnique({
            where: { date: fillDate }
          });

          if (!exists) {
            try {
              // Fetch historical rate from NBG API using ?date= parameter
              const historicalResponse = await fetch(`${NBG_API_URL}?date=${dateStr}`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
              });

              if (historicalResponse.ok) {
                const historicalData = await historicalResponse.json();
                
                if (historicalData && historicalData.length > 0) {
                  const historicalRates = historicalData[0];
                  const historicalCurrencies = historicalRates.currencies || [];
                  
                  // Build rates object from API response
                  const fillRates: any = {};
                  
                  for (const currency of historicalCurrencies) {
                    const code = currency.code?.toUpperCase();
                    const quantity = parseFloat(currency.quantity || 1);
                    const rate = parseFloat(currency.rate || 0);

                    if (code && rate > 0) {
                      const ratePerUnit = rate / quantity;
                      
                      if (code === 'USD') fillRates.usdRate = new Prisma.Decimal(ratePerUnit);
                      if (code === 'EUR') fillRates.eurRate = new Prisma.Decimal(ratePerUnit);
                      if (code === 'CNY') fillRates.cnyRate = new Prisma.Decimal(ratePerUnit);
                      if (code === 'GBP') fillRates.gbpRate = new Prisma.Decimal(ratePerUnit);
                      if (code === 'RUB') fillRates.rubRate = new Prisma.Decimal(ratePerUnit);
                      if (code === 'TRY') fillRates.tryRate = new Prisma.Decimal(ratePerUnit);
                      if (code === 'AED') fillRates.aedRate = new Prisma.Decimal(ratePerUnit);
                      if (code === 'KZT') fillRates.kztRate = new Prisma.Decimal(ratePerUnit);
                    }
                  }
                  
                  // Insert the historical rate
                  await prisma.nBGExchangeRate.create({
                    data: {
                      date: fillDate,
                      ...fillRates,
                    }
                  });
                  
                  filledCount++;
                  console.log(`[CRON] Backfilled ${dateStr} from NBG API`);
                }
              }
            } catch (apiError: any) {
              console.error(`[CRON] Failed to backfill ${dateStr}:`, apiError.message);
              // Continue with other dates even if one fails
            }
          }
        }

        if (filledCount > 0) {
          console.log(`[CRON] Successfully backfilled ${filledCount} missing date(s) from NBG API`);
        }
      }
    }

    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      date: result.date.toISOString().split('T')[0],
      action,
      processedCurrencies: processedCount,
      filledMissingDates: filledCount,
      rates: {
        usd: result.usdRate ? Number(result.usdRate) : null,
        eur: result.eurRate ? Number(result.eurRate) : null,
        cny: result.cnyRate ? Number(result.cnyRate) : null,
        gbp: result.gbpRate ? Number(result.gbpRate) : null,
        rub: result.rubRate ? Number(result.rubRate) : null,
        try: result.tryRate ? Number(result.tryRate) : null,
        aed: result.aedRate ? Number(result.aedRate) : null,
        kzt: result.kztRate ? Number(result.kztRate) : null,
      },
    };

    console.log('[CRON] NBG rates update completed successfully', summary);

    // Trigger Google Sheets sync
    let sheetsSyncResult = null;
    try {
      console.log('[CRON] Starting Google Sheets sync...');
      
      const sheetsResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/cron/sync-to-sheets`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.CRON_SECRET}`
        }
      });

      if (sheetsResponse.ok) {
        sheetsSyncResult = await sheetsResponse.json();
        console.log('[CRON] Google Sheets sync completed', sheetsSyncResult);
      } else {
        console.error('[CRON] Google Sheets sync failed', await sheetsResponse.text());
      }
    } catch (sheetError: any) {
      console.error('[CRON] Google Sheets sync error', sheetError.message);
      // Don't fail the whole cron job if sheets sync fails
    }

    return NextResponse.json({
      ...summary,
      sheetsSync: sheetsSyncResult
    });
  } catch (error: any) {
    console.error("[CRON] NBG rates update error", error);
    return NextResponse.json(
      { 
        success: false,
        error: error?.message || "Failed to update NBG rates",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
