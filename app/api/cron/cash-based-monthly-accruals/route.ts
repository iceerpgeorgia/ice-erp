import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { v5 as uuidv5 } from "uuid";
import { getSourceTables } from "@/lib/source-tables";

export const dynamic = "force-dynamic";

const DNS_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const SYSTEM_LEDGER_USER = "system@bank-import";
const MONTHLY_SOURCE = "cash_based_monthly";



const toDateOnly = (date: Date) => date.toISOString().split("T")[0];

const getMonthEnd = (monthStart: Date) =>
  new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0));

const buildMonthlyAggregationQuery = (tables: string[]) => {
  const unionParts = tables.map(
    (table) =>
      `SELECT payment_id, transaction_date::date AS transaction_date, nominal_amount
       FROM "${table}"
       WHERE payment_id IS NOT NULL
         AND transaction_date IS NOT NULL`
  );

  return `
    SELECT
      t.payment_id,
      p.insider_uuid,
      DATE_TRUNC('month', t.transaction_date)::date AS month_start,
      SUM(ABS(COALESCE(t.nominal_amount, 0))) AS total_amount
    FROM (
      ${unionParts.join(" UNION ALL ")}
    ) t
    INNER JOIN payments p ON p.payment_id = t.payment_id
    WHERE p.accrual_source = $1
      AND DATE_TRUNC('month', t.transaction_date) < DATE_TRUNC('month', NOW())
    GROUP BY t.payment_id, p.insider_uuid, DATE_TRUNC('month', t.transaction_date)::date
  `;
};

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

    const sourceTables = await getSourceTables();
    const query = buildMonthlyAggregationQuery(sourceTables);
    const aggregates = (await prisma.$queryRawUnsafe(query, MONTHLY_SOURCE)) as Array<{
      payment_id: string;
      insider_uuid: string | null;
      month_start: Date;
      total_amount: Prisma.Decimal | number | null;
    }>;

    let upserted = 0;

    for (const row of aggregates) {
      const totalAmount = Number(row.total_amount || 0);
      if (Number.isNaN(totalAmount)) continue;

      const monthStart = new Date(row.month_start);
      const monthStartStr = toDateOnly(monthStart);
      const monthEndStr = toDateOnly(getMonthEnd(monthStart));
      const recordKey = `${row.payment_id}_${monthStartStr}`;
      const recordUuid = uuidv5(recordKey, DNS_NAMESPACE);

      if (!row.insider_uuid) {
        continue;
      }

      await prisma.$executeRawUnsafe(
        `
          INSERT INTO payments_ledger (
            payment_id,
            effective_date,
            accrual,
            "order",
            record_uuid,
            user_email,
            comment,
            insider_uuid,
            updated_at
          ) VALUES ($1, $2::timestamp, $3, $4, $5::uuid, $6, $7, $8::uuid, NOW())
          ON CONFLICT (record_uuid)
          DO UPDATE SET
            accrual = EXCLUDED.accrual,
            "order" = EXCLUDED."order",
            comment = EXCLUDED.comment,
            insider_uuid = EXCLUDED.insider_uuid,
            updated_at = NOW()
        `,
        row.payment_id,
        `${monthEndStr}T00:00:00.000Z`,
        totalAmount,
        totalAmount,
        recordUuid,
        SYSTEM_LEDGER_USER,
        `Auto accrual/order monthly for ${monthStartStr} - ${monthEndStr}`,
        row.insider_uuid
      );

      upserted += 1;
    }

    return NextResponse.json({
      success: true,
      rows: aggregates.length,
      upserted,
    });
  } catch (error: any) {
    console.error("[CRON] Cash based monthly accruals error", error);
    return NextResponse.json(
      { error: error.message || "Failed to run monthly accruals" },
      { status: 500 }
    );
  }
}