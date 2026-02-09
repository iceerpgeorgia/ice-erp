import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const NBG_API_URL = "https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/";

// Force dynamic rendering for cron endpoint
export const dynamic = 'force-dynamic';

// This endpoint will be called by Vercel Cron every hour at the top of the hour
export async function GET(req: NextRequest) {
  try {
    // Verify the request is from Vercel Cron or has valid authorization
    const authHeader = req.headers.get('authorization');
    const vercelCronHeader = req.headers.get('x-vercel-cron');
    const userAgent = req.headers.get('user-agent') || '';
    
    // Allow if: 1) Vercel Cron header present, 2) Valid CRON_SECRET, or 3) Vercel user agent
    const isAuthorized = 
      vercelCronHeader || 
      userAgent.includes('vercel-cron') ||
      authHeader === `Bearer ${process.env.CRON_SECRET}`;
    
    if (!isAuthorized) {
      console.log('[CRON] Unauthorized request:', {
        hasVercelCronHeader: !!vercelCronHeader,
        userAgent: userAgent,
        hasAuthHeader: !!authHeader,
      });
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
          rates.usd_rate = new Prisma.Decimal(ratePerUnit);
          processedCount++;
        }
        if (code === 'EUR') {
          rates.eur_rate = new Prisma.Decimal(ratePerUnit);
          processedCount++;
        }
        if (code === 'CNY') {
          rates.cny_rate = new Prisma.Decimal(ratePerUnit);
          processedCount++;
        }
        if (code === 'GBP') {
          rates.gbp_rate = new Prisma.Decimal(ratePerUnit);
          processedCount++;
        }
        if (code === 'RUB') {
          rates.rub_rate = new Prisma.Decimal(ratePerUnit);
          processedCount++;
        }
        if (code === 'TRY') {
          rates.try_rate = new Prisma.Decimal(ratePerUnit);
          processedCount++;
        }
        if (code === 'AED') {
          rates.aed_rate = new Prisma.Decimal(ratePerUnit);
          processedCount++;
        }
        if (code === 'KZT') {
          rates.kzt_rate = new Prisma.Decimal(ratePerUnit);
          processedCount++;
        }
      }
    }

    console.log(`[CRON] Processed ${processedCount} currency rates`);

    // Check if date exists
    const existing = await prisma.nbg_exchange_rates.findUnique({
      where: { date: rateDate },
    });

    let result;
    let action;

    if (existing) {
      // Update existing
      result = await prisma.nbg_exchange_rates.update({
        where: { date: rateDate },
        data: {
          ...rates,
          updated_at: new Date(),
        },
      });

      action = "updated";
      console.log(`[CRON] Updated existing rates for ${rateDate.toISOString().split('T')[0]}`);
    } else {
      // Create new
      result = await prisma.nbg_exchange_rates.create({
        data: {
          uuid: uuidv4(),
          date: rateDate,
          ...rates,
          updated_at: new Date(),
        },
      });

      action = "created";
      console.log(`[CRON] Created new rates for ${rateDate.toISOString().split('T')[0]}`);
    }

    // Backfill any missing dates between last DB date and today using NBG API
    const lastDbDate = await prisma.nbg_exchange_rates.findFirst({
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

          const exists = await prisma.nbg_exchange_rates.findUnique({
            where: { date: fillDate }
          });

          // Check if date is missing OR has incomplete/invalid data (e.g., any rate is null or 0)
          const needsRefetch = !exists || 
            !exists.usd_rate || exists.usd_rate.toNumber() === 0 ||
            !exists.eur_rate || exists.eur_rate.toNumber() === 0 ||
            !exists.cny_rate || exists.cny_rate.toNumber() === 0 ||
            !exists.gbp_rate || exists.gbp_rate.toNumber() === 0 ||
            !exists.rub_rate || exists.rub_rate.toNumber() === 0 ||
            !exists.try_rate || exists.try_rate.toNumber() === 0 ||
            !exists.aed_rate || exists.aed_rate.toNumber() === 0 ||
            !exists.kzt_rate || exists.kzt_rate.toNumber() === 0;

          if (needsRefetch) {
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
                      
                      if (code === 'USD') fillRates.usd_rate = new Prisma.Decimal(ratePerUnit);
                      if (code === 'EUR') fillRates.eur_rate = new Prisma.Decimal(ratePerUnit);
                      if (code === 'CNY') fillRates.cny_rate = new Prisma.Decimal(ratePerUnit);
                      if (code === 'GBP') fillRates.gbp_rate = new Prisma.Decimal(ratePerUnit);
                      if (code === 'RUB') fillRates.rub_rate = new Prisma.Decimal(ratePerUnit);
                      if (code === 'TRY') fillRates.try_rate = new Prisma.Decimal(ratePerUnit);
                      if (code === 'AED') fillRates.aed_rate = new Prisma.Decimal(ratePerUnit);
                      if (code === 'KZT') fillRates.kzt_rate = new Prisma.Decimal(ratePerUnit);
                    }
                  }
                  
                  // Use upsert to insert or update the historical rate
                  await prisma.nbg_exchange_rates.upsert({
                    where: { date: fillDate },
                    create: {
                      uuid: uuidv4(),
                      date: fillDate,
                      ...fillRates,
                      updated_at: new Date(),
                    },
                    update: {
                      ...fillRates,
                      updated_at: new Date(),
                    },
                  });
                  
                  filledCount++;
                  const action = exists ? 'updated' : 'created';
                  console.log(`[CRON] Backfilled (${action}) ${dateStr} from NBG API`);
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
        usd: result.usd_rate ? Number(result.usd_rate) : null,
        eur: result.eur_rate ? Number(result.eur_rate) : null,
        cny: result.cny_rate ? Number(result.cny_rate) : null,
        gbp: result.gbp_rate ? Number(result.gbp_rate) : null,
        rub: result.rub_rate ? Number(result.rub_rate) : null,
        try: result.try_rate ? Number(result.try_rate) : null,
        aed: result.aed_rate ? Number(result.aed_rate) : null,
        kzt: result.kzt_rate ? Number(result.kzt_rate) : null,
      },
    };

    console.log('[CRON] NBG rates update completed successfully', summary);

    return NextResponse.json({
      ...summary
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
