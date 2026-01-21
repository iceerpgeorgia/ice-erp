import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const NBG_API_URL = "https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch from NBG API for today
    console.log(`[exchange-rates/update] Fetching rates for ${today.toISOString().split('T')[0]} from NBG API`);
    
    const response = await fetch(`${NBG_API_URL}?date=${today.toISOString().split('T')[0]}`, { 
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

    // Build rates object
    const rates: any = {};
    
    for (const currency of currencies) {
      const code = currency.code?.toUpperCase();
      const quantity = parseFloat(currency.quantity || 1);
      const rate = parseFloat(currency.rate || 0);

      if (code && rate > 0) {
        const ratePerUnit = rate / quantity;
        
        // Map to our database columns
        if (code === 'USD') rates.usd_rate = new Prisma.Decimal(ratePerUnit);
        if (code === 'EUR') rates.eur_rate = new Prisma.Decimal(ratePerUnit);
        if (code === 'CNY') rates.cny_rate = new Prisma.Decimal(ratePerUnit);
        if (code === 'GBP') rates.gbp_rate = new Prisma.Decimal(ratePerUnit);
        if (code === 'RUB') rates.rub_rate = new Prisma.Decimal(ratePerUnit);
        if (code === 'TRY') rates.try_rate = new Prisma.Decimal(ratePerUnit);
        if (code === 'AED') rates.aed_rate = new Prisma.Decimal(ratePerUnit);
        if (code === 'KZT') rates.kzt_rate = new Prisma.Decimal(ratePerUnit);
      }
    }

    // Check if today's date exists
    const existing = await prisma.nbg_exchange_rates.findUnique({
      where: { date: today },
    });

    let result;

    if (existing) {
      // Update existing
      result = await prisma.nbg_exchange_rates.update({
        where: { date: today },
        data: rates,
      });

      await logAudit({
        table: "nbg_exchange_rates",
        recordId: result.id,
        action: "update",
      });
    } else {
      // Create new
      result = await prisma.nbg_exchange_rates.create({
        data: {
          date: today,
          ...rates,
        },
      });

      await logAudit({
        table: "nbg_exchange_rates",
        recordId: result.id,
        action: "create",
      });
    }

    // Backfill missing dates
    await backfillMissingDates(today);

    return NextResponse.json({
      success: true,
      date: result.date.toISOString().split('T')[0],
      message: existing ? "Updated existing rates" : "Created new rates",
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
    });
  } catch (error: any) {
    console.error("[exchange-rates/update] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update from NBG API" },
      { status: 500 }
    );
  }
}

async function backfillMissingDates(currentDate: Date) {
  try {
    // Get the last date before today
    const lastRecord = await prisma.nbg_exchange_rates.findFirst({
      where: {
        date: {
          lt: currentDate,
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    if (!lastRecord) {
      console.log('[exchange-rates/update] No previous records to backfill from');
      return;
    }

    const lastDate = new Date(lastRecord.date);
    lastDate.setHours(0, 0, 0, 0);
    
    const today = new Date(currentDate);
    today.setHours(0, 0, 0, 0);

    // Calculate dates to backfill
    const daysToBackfill = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysToBackfill <= 1) {
      console.log('[exchange-rates/update] No missing dates to backfill');
      return;
    }

    console.log(`[exchange-rates/update] Backfilling ${daysToBackfill - 1} missing dates`);

    // Get all existing dates in one query to reduce database calls
    const existingDates = await prisma.nbg_exchange_rates.findMany({
      where: {
        date: {
          gt: lastDate,
          lt: today,
        },
      },
      select: {
        date: true,
      },
    });

    const existingDateSet = new Set(
      existingDates.map(r => r.date.toISOString().split('T')[0])
    );

    for (let i = 1; i < daysToBackfill; i++) {
      const missingDate = new Date(lastDate);
      missingDate.setDate(missingDate.getDate() + i);
      missingDate.setHours(0, 0, 0, 0);

      const dateStr = missingDate.toISOString().split('T')[0];

      // Check if this date already exists
      if (existingDateSet.has(dateStr)) {
        console.log(`[exchange-rates/update] Date ${dateStr} already exists, skipping`);
        continue;
      }

      // Fetch rates for this specific date from NBG API
      try {
        const response = await fetch(`${NBG_API_URL}?date=${dateStr}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
          console.error(`[exchange-rates/update] Failed to fetch rates for ${dateStr}, skipping`);
          continue;
        }

        const data = await response.json();
        if (!data || data.length === 0) {
          console.error(`[exchange-rates/update] No data received for ${dateStr}, skipping`);
          continue;
        }

        const currencies = data[0].currencies || [];
        const ratesToUse: any = {};
        
        for (const currency of currencies) {
          const code = currency.code?.toUpperCase();
          const quantity = parseFloat(currency.quantity || 1);
          const rate = parseFloat(currency.rate || 0);

          if (code && rate > 0) {
            const ratePerUnit = rate / quantity;
            if (code === 'USD') ratesToUse.usd_rate = new Prisma.Decimal(ratePerUnit);
            if (code === 'EUR') ratesToUse.eur_rate = new Prisma.Decimal(ratePerUnit);
            if (code === 'CNY') ratesToUse.cny_rate = new Prisma.Decimal(ratePerUnit);
            if (code === 'GBP') ratesToUse.gbp_rate = new Prisma.Decimal(ratePerUnit);
            if (code === 'RUB') ratesToUse.rub_rate = new Prisma.Decimal(ratePerUnit);
            if (code === 'TRY') ratesToUse.try_rate = new Prisma.Decimal(ratePerUnit);
            if (code === 'AED') ratesToUse.aed_rate = new Prisma.Decimal(ratePerUnit);
            if (code === 'KZT') ratesToUse.kzt_rate = new Prisma.Decimal(ratePerUnit);
          }
        }

        // Insert the missing date
        await prisma.nbg_exchange_rates.create({
          data: {
            date: missingDate,
            ...ratesToUse,
          },
        });

        console.log(`[exchange-rates/update] Backfilled ${dateStr}`);
      } catch (error) {
        console.error(`[exchange-rates/update] Error processing ${dateStr}:`, error);
        continue;
      }
    }

    console.log('[exchange-rates/update] Backfill complete');
  } catch (error) {
    console.error('[exchange-rates/update] Backfill error:', error);
    // Don't throw - backfill is not critical
  }
}
