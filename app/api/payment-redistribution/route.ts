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

    return NextResponse.json({
      counteragentUuid,
      accruals: accruals.map(normalizeRow),
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
