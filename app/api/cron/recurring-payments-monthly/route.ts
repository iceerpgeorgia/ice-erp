import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { v5 as uuidv5 } from "uuid";

export const dynamic = "force-dynamic";

const DNS_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const SYSTEM_USER = "system@recurring-monthly";

interface RecurringPayment {
  payment_id: string;
  insider_uuid: string | null;
}

interface MonthSums {
  accrual_sum: string | number | null;
  order_sum: string | number | null;
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const vercelCronHeader = req.headers.get("x-vercel-cron");
    const userAgent = req.headers.get("user-agent") || "";

    const isAuthorized =
      vercelCronHeader ||
      userAgent.includes("vercel-cron") ||
      authHeader === `Bearer ${process.env.CRON_SECRET}`;

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    // Current month window (UTC)
    const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    // Last day of current month at 00:00 UTC
    const currentMonthLastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    // Previous month window
    const prevMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

    const currentMonthStartStr = currentMonthStart.toISOString().split("T")[0];

    const recurringPayments = await prisma.$queryRaw<RecurringPayment[]>(
      Prisma.sql`
        SELECT payment_id, insider_uuid
        FROM payments
        WHERE is_recurring = true
          AND COALESCE(is_active, true) = true
          AND payment_id IS NOT NULL
      `
    );

    let processed = 0;
    let inserted = 0;
    let skippedExists = 0;
    let skippedZero = 0;
    const errors: Array<{ payment_id: string; error: string }> = [];

    for (const payment of recurringPayments) {
      processed++;
      try {
        // Skip if a non-deleted ledger row already exists for this payment in current month
        const existing = await prisma.$queryRaw<Array<{ exists: number }>>(
          Prisma.sql`
            SELECT 1 AS exists
            FROM payments_ledger
            WHERE payment_id = ${payment.payment_id}
              AND effective_date >= ${currentMonthStart}
              AND effective_date < ${nextMonthStart}
              AND COALESCE(is_deleted, false) = false
            LIMIT 1
          `
        );

        if (existing.length > 0) {
          skippedExists++;
          continue;
        }

        // Sum previous month's accrual + order
        const sums = await prisma.$queryRaw<MonthSums[]>(
          Prisma.sql`
            SELECT
              COALESCE(SUM(COALESCE(accrual, 0)), 0) AS accrual_sum,
              COALESCE(SUM(COALESCE("order", 0)), 0) AS order_sum
            FROM payments_ledger
            WHERE payment_id = ${payment.payment_id}
              AND effective_date >= ${prevMonthStart}
              AND effective_date < ${currentMonthStart}
              AND COALESCE(is_deleted, false) = false
          `
        );

        const accrualSum = Number(sums[0]?.accrual_sum ?? 0);
        const orderSum = Number(sums[0]?.order_sum ?? 0);

        if (accrualSum === 0 && orderSum === 0) {
          skippedZero++;
          continue;
        }

        const recordUuid = uuidv5(
          `${payment.payment_id}_recurring_${currentMonthStartStr}`,
          DNS_NAMESPACE
        );

        const comment = `Auto-recurring carry-over from ${prevMonthStart
          .toISOString()
          .split("T")[0]} (prev-month accrual+order)`;

        const result = await prisma.$executeRaw(
          Prisma.sql`
            INSERT INTO payments_ledger (
              record_uuid,
              payment_id,
              effective_date,
              accrual,
              "order",
              user_email,
              comment,
              insider_uuid,
              is_deleted
            ) VALUES (
              ${recordUuid}::uuid,
              ${payment.payment_id},
              ${currentMonthLastDay},
              ${accrualSum}::numeric,
              ${orderSum}::numeric,
              ${SYSTEM_USER},
              ${comment},
              ${payment.insider_uuid}::uuid,
              false
            )
            ON CONFLICT (record_uuid) DO NOTHING
          `
        );

        if (result > 0) {
          inserted++;
        } else {
          skippedExists++;
        }
      } catch (err) {
        errors.push({
          payment_id: payment.payment_id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      processed,
      inserted,
      skippedExists,
      skippedZero,
      errors,
      currentMonthStart: currentMonthStartStr,
      effectiveDate: currentMonthLastDay.toISOString().split("T")[0],
      prevMonthStart: prevMonthStart.toISOString().split("T")[0],
    });
  } catch (error) {
    console.error("[recurring-payments-monthly] error", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
