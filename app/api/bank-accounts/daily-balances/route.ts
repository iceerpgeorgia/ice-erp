import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { resolveInsiderSelection, sqlUuidInList } from "@/lib/insider-selection";

const prisma = new PrismaClient();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

class BadRequestError extends Error {}

function parseDateParam(value: string | null, fallback: string): string {
  const raw = (value || "").trim();
  if (!raw) return fallback;
  if (!DATE_RE.test(raw)) {
    throw new BadRequestError(`Invalid date '${raw}', expected YYYY-MM-DD`);
  }
  return raw;
}

export async function GET(request: NextRequest) {
  try {
    const selection = await resolveInsiderSelection(request);
    const insiderUuidListSql = sqlUuidInList(selection.selectedUuids);

    const from = parseDateParam(request.nextUrl.searchParams.get("from"), "2018-01-01");
    const to = parseDateParam(
      request.nextUrl.searchParams.get("to"),
      new Date().toISOString().slice(0, 10)
    );

    if (from > to) {
      return NextResponse.json(
        { error: "Invalid range: 'from' must be less than or equal to 'to'" },
        { status: 400 }
      );
    }

    const accountUuid = (request.nextUrl.searchParams.get("accountUuid") || "").trim() || null;
    if (accountUuid && !/^[0-9a-fA-F-]{36}$/.test(accountUuid)) {
      return NextResponse.json({ error: "Invalid accountUuid" }, { status: 400 });
    }

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      WITH selected_accounts AS (
        SELECT
          ba.uuid,
          ba.account_number,
          c.code AS currency_code,
          b.bank_name,
          ba.insider_uuid
        FROM bank_accounts ba
        LEFT JOIN currencies c ON c.uuid = ba.currency_uuid
        LEFT JOIN banks b ON b.uuid = ba.bank_uuid
        WHERE ba.insider_uuid IN (${insiderUuidListSql})
          AND ($1::uuid IS NULL OR ba.uuid = $1::uuid)
      ),
      selected_periods AS (
        SELECT
          bab.id,
          bab.account_uuid,
          bab.opening_date,
          bab.closing_date,
          bab.opening_balance,
          bab.inflow,
          bab.outflow
        FROM bank_account_balances bab
        INNER JOIN selected_accounts sa ON sa.uuid = bab.account_uuid
        WHERE bab.opening_date <= $3::date
          AND bab.closing_date > $2::date
      )
      SELECT
        sa.uuid AS account_uuid,
        sa.account_number,
        sa.currency_code,
        sa.bank_name,
        gs.day::date AS date,
        sp.opening_date,
        sp.closing_date,
        CASE
          WHEN gs.day::date = sp.opening_date THEN sp.opening_balance
          ELSE sp.opening_balance
        END AS opening_balance,
        CASE
          WHEN gs.day::date = sp.opening_date THEN sp.inflow
          ELSE 0::numeric
        END AS inflow,
        CASE
          WHEN gs.day::date = sp.opening_date THEN sp.outflow
          ELSE 0::numeric
        END AS outflow,
        CASE
          WHEN gs.day::date = sp.opening_date THEN sp.opening_balance + sp.inflow - sp.outflow
          ELSE sp.opening_balance
        END AS closing_balance,
        (sp.inflow <> 0 OR sp.outflow <> 0) AS has_turnover
      FROM selected_periods sp
      INNER JOIN selected_accounts sa ON sa.uuid = sp.account_uuid
      CROSS JOIN LATERAL generate_series(
        GREATEST(sp.opening_date, $2::date),
        LEAST(sp.closing_date - INTERVAL '1 day', $3::date),
        INTERVAL '1 day'
      ) AS gs(day)
      ORDER BY sa.account_number, sa.currency_code, gs.day
      `,
      accountUuid,
      from,
      to
    );

    const formattedRows = rows.map((row) => ({
      accountUuid: row.account_uuid,
      accountNumber: row.account_number,
      currencyCode: row.currency_code,
      bankName: row.bank_name,
      date: String(row.date).slice(0, 10),
      openingDate: String(row.opening_date).slice(0, 10),
      closingDate: String(row.closing_date).slice(0, 10),
      openingBalance: Number(row.opening_balance || 0),
      inflow: Number(row.inflow || 0),
      outflow: Number(row.outflow || 0),
      closingBalance: Number(row.closing_balance || 0),
      hasTurnover: Boolean(row.has_turnover),
    }));

    return NextResponse.json({
      range: { from, to },
      accountUuid,
      count: formattedRows.length,
      rows: formattedRows,
    });
  } catch (error: any) {
    console.error("Error fetching daily balances:", error);
    if (error instanceof BadRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: error?.message || "Failed to fetch daily balances" },
      { status: 500 }
    );
  }
}
