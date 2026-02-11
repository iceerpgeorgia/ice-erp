import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const revalidate = 0;
export const dynamic = "force-dynamic";

const SOURCE_TABLES = [
  "GE78BG0000000893486000_BOG_GEL",
  "GE65TB7856036050100002_TBC_GEL",
];

const normalizeBigInt = (value: any) =>
  typeof value === "bigint" ? Number(value) : value;

const normalizeRow = (row: Record<string, any>) =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, normalizeBigInt(value)])
  );

const updatePaymentIdForMonth = (paymentId: string, date: Date) => {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  if (/_PRL\d{2}\d{4}$/i.test(paymentId)) {
    return paymentId.replace(/_PRL\d{2}\d{4}$/i, `_PRL${mm}${yyyy}`);
  }
  if (paymentId.length >= 20) {
    return `${paymentId}_PRL${mm}${yyyy}`;
  }
  return paymentId;
};

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const counteragentUuid = searchParams.get("counteragentUuid");

    if (!counteragentUuid) {
      return NextResponse.json(
        { error: "counteragentUuid is required" },
        { status: 400 }
      );
    }

    const accruals = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
         p.payment_id,
         p.project_uuid,
         p.financial_code_uuid,
         p.job_uuid,
         p.income_tax,
         p.currency_uuid,
         curr.code as currency_code,
         proj.project_index,
         proj.project_name,
         fc.validation as financial_code,
         j.job_name,
         COALESCE(SUM(pl.accrual), 0) as accrual_sum,
         COALESCE(SUM(pl."order"), 0) as order_sum,
         COUNT(pl.id) as ledger_count
       FROM payments p
       LEFT JOIN payments_ledger pl
         ON p.payment_id = pl.payment_id
        AND (pl.is_deleted = false OR pl.is_deleted IS NULL)
       LEFT JOIN currencies curr ON p.currency_uuid = curr.uuid
       LEFT JOIN projects proj ON p.project_uuid = proj.project_uuid
       LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
       LEFT JOIN jobs j ON p.job_uuid = j.job_uuid
       WHERE p.counteragent_uuid = $1::uuid
         AND p.is_active = true
       GROUP BY
         p.payment_id,
         p.project_uuid,
         p.financial_code_uuid,
         p.job_uuid,
         p.income_tax,
         p.currency_uuid,
         curr.code,
         proj.project_index,
         proj.project_name,
         fc.validation,
         j.job_name
       ORDER BY p.payment_id`,
      counteragentUuid
    );

    const salaryAccruals = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
         sa.payment_id,
         NULL::uuid as project_uuid,
         sa.financial_code_uuid,
         NULL::uuid as job_uuid,
         NULL::boolean as income_tax,
         sa.nominal_currency_uuid as currency_uuid,
         sa.salary_month,
         curr.code as currency_code,
         NULL::text as project_index,
         NULL::text as project_name,
         fc.validation as financial_code,
         'Salary'::text as job_name,
         (sa.net_sum
           - COALESCE(sa.deducted_insurance, 0)
           - COALESCE(sa.deducted_fitness, 0)
           - COALESCE(sa.deducted_fine, 0)) as accrual_sum,
         0 as order_sum,
         0 as ledger_count
       FROM salary_accruals sa
       LEFT JOIN currencies curr ON sa.nominal_currency_uuid = curr.uuid
       LEFT JOIN financial_codes fc ON sa.financial_code_uuid = fc.uuid
       WHERE sa.counteragent_uuid = $1::uuid
         AND NOT EXISTS (
           SELECT 1
           FROM payments p
           WHERE p.payment_id = sa.payment_id
             AND p.counteragent_uuid = $1::uuid
             AND p.is_active = true
         )
       ORDER BY sa.payment_id`,
      counteragentUuid
    );

    const latestMonthResult = await prisma.$queryRawUnsafe<any[]>(
      `SELECT MAX(sa.salary_month) as latest_month
       FROM salary_accruals sa
       WHERE sa.counteragent_uuid = $1::uuid`,
      counteragentUuid
    );

    const latestMonthValue = latestMonthResult?.[0]?.latest_month as string | null;
    const projectionAccruals: any[] = [];
    if (latestMonthValue) {
      const latestMonthDate = new Date(latestMonthValue);
      const baseRows = salaryAccruals.filter(
        (row) => String(row.salary_month) === String(latestMonthValue)
      );
      for (let i = 1; i <= 36; i += 1) {
        const futureDate = new Date(
          latestMonthDate.getFullYear(),
          latestMonthDate.getMonth() + i,
          1
        );
        baseRows.forEach((row) => {
          const basePaymentId = row.payment_id as string;
          if (!basePaymentId) return;
          const projectedPaymentId = updatePaymentIdForMonth(basePaymentId, futureDate);
          projectionAccruals.push({
            ...row,
            payment_id: projectedPaymentId,
            job_name: "Salary (Planned)",
            salary_month: futureDate,
          });
        });
      }
    }

    const unionSql = SOURCE_TABLES.map(
      (table) => `SELECT
          '${table}'::text as source_table,
          id,
          uuid,
          payment_id,
          transaction_date,
          description,
          nominal_amount,
          account_currency_amount,
          nominal_currency_uuid,
          account_currency_uuid,
          parsing_lock
        FROM "${table}"
        WHERE counteragent_uuid = $1::uuid`
    ).join(" UNION ALL ");

    const transactions = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
         tx.*,
         curr_nom.code as nominal_currency_code,
         curr_acc.code as account_currency_code
       FROM (${unionSql}) tx
       LEFT JOIN currencies curr_nom ON tx.nominal_currency_uuid = curr_nom.uuid
       LEFT JOIN currencies curr_acc ON tx.account_currency_uuid = curr_acc.uuid
       ORDER BY tx.transaction_date DESC, tx.id DESC`,
      counteragentUuid
    );

    const combinedAccruals = new Map<string, any>();
    const addAccruals = (rows: any[]) => {
      rows.forEach((row) => {
        const key = String(row.payment_id || "").toLowerCase();
        if (!key) return;
        if (!combinedAccruals.has(key)) {
          combinedAccruals.set(key, row);
        }
      });
    };

    addAccruals(accruals);
    addAccruals(salaryAccruals);
    addAccruals(projectionAccruals);

    return NextResponse.json({
      counteragentUuid,
      accruals: Array.from(combinedAccruals.values()).map(normalizeRow),
      transactions: transactions.map(normalizeRow),
    });
  } catch (error: any) {
    console.error("GET /api/payment-redistribution failed:", error);
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
