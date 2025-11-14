import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const NBG_API_URL = "https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/";

export async function POST(req: NextRequest) {
  try {
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

    // Check if date exists
    const existing = await prisma.nBGExchangeRate.findUnique({
      where: { date: rateDate },
    });

    let result;

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
    }

    // Trigger Google Sheets sync after successful DB update
    let sheetsSyncResult = null;
    try {
      const sheetsResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/cron/sync-to-sheets`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.CRON_SECRET}`
        }
      });
      
      if (sheetsResponse.ok) {
        sheetsSyncResult = await sheetsResponse.json();
      } else {
        console.error("[exchange-rates/update] Sheets sync failed", await sheetsResponse.text());
      }
    } catch (sheetError: any) {
      console.error("[exchange-rates/update] Sheets sync error", sheetError.message);
      // Don't fail the whole request if sheets sync fails
    }

    return NextResponse.json({
      success: true,
      date: result.date.toISOString().split('T')[0],
      message: existing ? "Updated existing rates" : "Created new rates",
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
      sheetsSync: sheetsSyncResult,
    });
  } catch (error: any) {
    console.error("[exchange-rates/update] POST error", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update from NBG API" },
      { status: 500 }
    );
  }
}
