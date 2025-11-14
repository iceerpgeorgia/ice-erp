import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

function validateRatePayload(body: any) {
  const errors: Record<string, string> = {};
  const date = body?.date ? new Date(body.date) : null;

  if (!date || isNaN(date.getTime())) {
    errors.date = "Valid date is required";
  }

  // Validate rates if provided
  const rateFields = ['usd', 'eur', 'cny', 'gbp', 'rub', 'try', 'aed', 'kzt'];
  for (const field of rateFields) {
    if (body[field] !== undefined && body[field] !== null && body[field] !== "") {
      const rate = parseFloat(body[field]);
      if (isNaN(rate) || rate < 0) {
        errors[field] = `Invalid ${field.toUpperCase()} rate`;
      }
    }
  }

  return { errors, date };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const currencyParam = searchParams.get("currency");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // If specific date and currency requested
    if (dateParam && currencyParam) {
      const date = new Date(dateParam);
      const currency = currencyParam.toUpperCase();
      
      const rate = await prisma.nBGExchangeRate.findUnique({
        where: { date },
      });

      if (!rate) {
        return NextResponse.json(
          { error: "No rate found for this date" },
          { status: 404 }
        );
      }

      const rateValue = (rate as any)[`${currency.toLowerCase()}Rate`];

      return NextResponse.json({
        date: rate.date.toISOString().split('T')[0],
        currency,
        rate: rateValue ? Number(rateValue) : null,
      });
    }

    // If date range requested
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      const rates = await prisma.nBGExchangeRate.findMany({
        where: {
          date: {
            gte: start,
            lte: end,
          },
        },
        orderBy: { date: "desc" },
      });

      const formattedRates = rates.map(rate => ({
        id: Number(rate.id),
        date: rate.date.toISOString().split('T')[0],
        usd: rate.usdRate ? Number(rate.usdRate) : null,
        eur: rate.eurRate ? Number(rate.eurRate) : null,
        cny: rate.cnyRate ? Number(rate.cnyRate) : null,
        gbp: rate.gbpRate ? Number(rate.gbpRate) : null,
        rub: rate.rubRate ? Number(rate.rubRate) : null,
        try: rate.tryRate ? Number(rate.tryRate) : null,
        aed: rate.aedRate ? Number(rate.aedRate) : null,
        kzt: rate.kztRate ? Number(rate.kztRate) : null,
      }));

      return NextResponse.json(formattedRates);
    }

    // Default: return all rates
    const rates = await prisma.nBGExchangeRate.findMany({
      orderBy: { date: "desc" },
    });

    const formattedRates = rates.map(rate => ({
      id: Number(rate.id),
      date: rate.date.toISOString().split('T')[0],
      usd: rate.usdRate ? Number(rate.usdRate) : null,
      eur: rate.eurRate ? Number(rate.eurRate) : null,
      cny: rate.cnyRate ? Number(rate.cnyRate) : null,
      gbp: rate.gbpRate ? Number(rate.gbpRate) : null,
      rub: rate.rubRate ? Number(rate.rubRate) : null,
      try: rate.tryRate ? Number(rate.tryRate) : null,
      aed: rate.aedRate ? Number(rate.aedRate) : null,
      kzt: rate.kztRate ? Number(rate.kztRate) : null,
    }));

    return NextResponse.json(formattedRates);
  } catch (error: any) {
    console.error("[exchange-rates] GET error", error);
    return NextResponse.json(
      { error: error?.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { errors, date } = validateRatePayload(body);

    if (Object.keys(errors).length > 0) {
      return NextResponse.json(
        { error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    if (!date) {
      return NextResponse.json(
        { error: "Date is required" },
        { status: 400 }
      );
    }

    // Check if date already exists
    const existing = await prisma.nBGExchangeRate.findUnique({
      where: { date },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Validation failed", details: { date: "Exchange rate for this date already exists" } },
        { status: 400 }
      );
    }

    // Build data object
    const data: any = { date };
    
    if (body.usd !== undefined && body.usd !== null && body.usd !== "") {
      data.usdRate = new Prisma.Decimal(body.usd);
    }
    if (body.eur !== undefined && body.eur !== null && body.eur !== "") {
      data.eurRate = new Prisma.Decimal(body.eur);
    }
    if (body.cny !== undefined && body.cny !== null && body.cny !== "") {
      data.cnyRate = new Prisma.Decimal(body.cny);
    }
    if (body.gbp !== undefined && body.gbp !== null && body.gbp !== "") {
      data.gbpRate = new Prisma.Decimal(body.gbp);
    }
    if (body.rub !== undefined && body.rub !== null && body.rub !== "") {
      data.rubRate = new Prisma.Decimal(body.rub);
    }
    if (body.try !== undefined && body.try !== null && body.try !== "") {
      data.tryRate = new Prisma.Decimal(body.try);
    }
    if (body.aed !== undefined && body.aed !== null && body.aed !== "") {
      data.aedRate = new Prisma.Decimal(body.aed);
    }
    if (body.kzt !== undefined && body.kzt !== null && body.kzt !== "") {
      data.kztRate = new Prisma.Decimal(body.kzt);
    }

    const created = await prisma.nBGExchangeRate.create({
      data,
    });

    await logAudit({
      table: "nbg_exchange_rates",
      recordId: created.id,
      action: "create",
    });

    return NextResponse.json(
      {
        id: Number(created.id),
        date: created.date.toISOString().split('T')[0],
        usd: created.usdRate ? Number(created.usdRate) : null,
        eur: created.eurRate ? Number(created.eurRate) : null,
        cny: created.cnyRate ? Number(created.cnyRate) : null,
        gbp: created.gbpRate ? Number(created.gbpRate) : null,
        rub: created.rubRate ? Number(created.rubRate) : null,
        try: created.tryRate ? Number(created.tryRate) : null,
        aed: created.aedRate ? Number(created.aedRate) : null,
        kzt: created.kztRate ? Number(created.kztRate) : null,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[exchange-rates] POST error", error);
    return NextResponse.json(
      { error: error?.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");

    if (!idParam) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { errors, date } = validateRatePayload(body);

    if (Object.keys(errors).length > 0) {
      return NextResponse.json(
        { error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    // Build update data
    const data: any = {};
    
    if (date) data.date = date;
    
    if (body.usd !== undefined && body.usd !== null && body.usd !== "") {
      data.usdRate = new Prisma.Decimal(body.usd);
    }
    if (body.eur !== undefined && body.eur !== null && body.eur !== "") {
      data.eurRate = new Prisma.Decimal(body.eur);
    }
    if (body.cny !== undefined && body.cny !== null && body.cny !== "") {
      data.cnyRate = new Prisma.Decimal(body.cny);
    }
    if (body.gbp !== undefined && body.gbp !== null && body.gbp !== "") {
      data.gbpRate = new Prisma.Decimal(body.gbp);
    }
    if (body.rub !== undefined && body.rub !== null && body.rub !== "") {
      data.rubRate = new Prisma.Decimal(body.rub);
    }
    if (body.try !== undefined && body.try !== null && body.try !== "") {
      data.tryRate = new Prisma.Decimal(body.try);
    }
    if (body.aed !== undefined && body.aed !== null && body.aed !== "") {
      data.aedRate = new Prisma.Decimal(body.aed);
    }
    if (body.kzt !== undefined && body.kzt !== null && body.kzt !== "") {
      data.kztRate = new Prisma.Decimal(body.kzt);
    }

    const updated = await prisma.nBGExchangeRate.update({
      where: { id: BigInt(idParam) },
      data,
    });

    await logAudit({
      table: "nbg_exchange_rates",
      recordId: updated.id,
      action: "update",
    });

    return NextResponse.json({
      id: Number(updated.id),
      date: updated.date.toISOString().split('T')[0],
      usd: updated.usdRate ? Number(updated.usdRate) : null,
      eur: updated.eurRate ? Number(updated.eurRate) : null,
      cny: updated.cnyRate ? Number(updated.cnyRate) : null,
      gbp: updated.gbpRate ? Number(updated.gbpRate) : null,
      rub: updated.rubRate ? Number(updated.rubRate) : null,
      try: updated.tryRate ? Number(updated.tryRate) : null,
      aed: updated.aedRate ? Number(updated.aedRate) : null,
      kzt: updated.kztRate ? Number(updated.kztRate) : null,
    });
  } catch (error: any) {
    console.error("[exchange-rates] PATCH error", error);
    return NextResponse.json(
      { error: error?.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");

    if (!idParam) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    await prisma.nBGExchangeRate.delete({
      where: { id: BigInt(idParam) },
    });

    await logAudit({
      table: "nbg_exchange_rates",
      recordId: BigInt(idParam),
      action: "delete",
    });

    return NextResponse.json({ id: Number(idParam) });
  } catch (error: any) {
    console.error("[exchange-rates] DELETE error", error);
    return NextResponse.json(
      { error: error?.message || "Server error" },
      { status: 500 }
    );
  }
}
