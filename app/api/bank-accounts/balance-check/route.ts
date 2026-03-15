import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { resolveInsiderSelection, sqlUuidInList } from "@/lib/insider-selection";
import { bogApiRequest } from "@/lib/integrations/bog/client";

const prisma = new PrismaClient();

const TABLE_NAME_RE = /^[A-Za-z0-9_]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeCurrencyCode(code: string | null): string {
  return String(code || "").trim().toUpperCase();
}

function deriveDeconsolidatedTableName(params: {
  accountNumber: string;
  bankName: string | null;
  currencyCode: string | null;
  parsingSchemeName: string | null;
}): string | null {
  const accountNumber = String(params.accountNumber || "").trim();
  const bankName = String(params.bankName || "").trim().toUpperCase();
  const currencyCode = normalizeCurrencyCode(params.currencyCode);
  const parsingSchemeName = String(params.parsingSchemeName || "").trim().toUpperCase();

  if (!accountNumber || !currencyCode) return null;

  if (bankName.includes("BOG") || parsingSchemeName.includes("BOG")) {
    const schemeSuffix = currencyCode === "GEL" ? "BOG_GEL" : `BOG_${currencyCode}`;
    return `${accountNumber}_${schemeSuffix}`;
  }

  if (bankName.includes("TBC") || parsingSchemeName.includes("TBC")) {
    return `${accountNumber}_TBC_${currencyCode}`;
  }

  return null;
}

function isBogAccount(params: { bankName: string | null; parsingSchemeName: string | null }): boolean {
  const bankName = String(params.bankName || "").trim().toUpperCase();
  const parsingSchemeName = String(params.parsingSchemeName || "").trim().toUpperCase();
  return bankName.includes("BOG") || parsingSchemeName.includes("BOG");
}

function detectStatementItems(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const source = payload as Record<string, unknown>;
  const data = source.data && typeof source.data === "object" ? (source.data as Record<string, unknown>) : null;
  const result = source.result && typeof source.result === "object" ? (source.result as Record<string, unknown>) : null;
  const statement = source.statement && typeof source.statement === "object" ? (source.statement as Record<string, unknown>) : null;

  const candidates = [
    source.Records,
    source.records,
    source.transactions,
    source.items,
    source.statementItems,
    data?.Records,
    data?.records,
    data?.transactions,
    data?.items,
    result?.Records,
    result?.records,
    result?.transactions,
    result?.items,
    statement?.Records,
    statement?.records,
    statement?.transactions,
    statement?.items,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
    }
  }

  return [];
}

function parseNumericBalance(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function extractBogBalance(payload: unknown): number | null {
  if (payload && typeof payload === "object") {
    const root = payload as Record<string, unknown>;
    const rootCandidates = [
      root.balance,
      root.outBalance,
      root.OutBalance,
      root.closingBalance,
      root.ClosingBalance,
      root.availableBalance,
      root.AvailableBalance,
    ];
    for (const candidate of rootCandidates) {
      const parsed = parseNumericBalance(candidate);
      if (parsed !== null) return parsed;
    }
  }

  const items = detectStatementItems(payload);
  if (items.length === 0) return null;

  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    const candidates = [
      item.OutBalance,
      item.outBalance,
      item.balance,
      item.closingBalance,
      item.runningBalance,
      item.AvailableBalance,
      item.availableBalance,
    ];

    for (const candidate of candidates) {
      const parsed = parseNumericBalance(candidate);
      if (parsed !== null) return parsed;
    }
  }

  return null;
}

async function fetchBogApiBalance(params: {
  accountNumber: string;
  currencyCode: string | null;
  insiderUuid: string | null;
  asOfDate: string;
}): Promise<{ bogApiBalance: number | null; bogBalanceStatus: string; bogCorrelationId: string | null }> {
  const accountNumber = String(params.accountNumber || "").trim().toUpperCase();
  const currencyCode = normalizeCurrencyCode(params.currencyCode);
  if (!accountNumber || !currencyCode) {
    return { bogApiBalance: null, bogBalanceStatus: "skipped_missing_account_or_currency", bogCorrelationId: null };
  }

  const asOfDate = new Date(`${params.asOfDate}T00:00:00Z`);
  const firstOfMonth = `${asOfDate.getUTCFullYear()}-${String(asOfDate.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const minus30 = new Date(asOfDate);
  minus30.setUTCDate(minus30.getUTCDate() - 30);
  const minus30Date = minus30.toISOString().slice(0, 10);

  const paths = [
    `/statement/${accountNumber}/${currencyCode}/${params.asOfDate}/${params.asOfDate}`,
    `/statement/${accountNumber}/${currencyCode}/${firstOfMonth}/${params.asOfDate}`,
    `/statement/${accountNumber}/${currencyCode}/${minus30Date}/${params.asOfDate}`,
  ];

  let lastStatus = "bog_no_data";
  let lastCorrelationId: string | null = null;

  for (const path of paths) {
    const response = await bogApiRequest<unknown>({
      method: "GET",
      path,
      insiderUuid: params.insiderUuid || undefined,
    });

    lastCorrelationId = response.correlationId;

    if (!response.ok) {
      lastStatus = `bog_error_${response.status}`;
      continue;
    }

    const extracted = extractBogBalance(response.data);
    if (extracted !== null) {
      return {
        bogApiBalance: extracted,
        bogBalanceStatus: "ok",
        bogCorrelationId: response.correlationId,
      };
    }

    lastStatus = "bog_balance_not_found_in_payload";
  }

  return {
    bogApiBalance: null,
    bogBalanceStatus: lastStatus,
    bogCorrelationId: lastCorrelationId,
  };
}

async function tableExists(tableName: string): Promise<boolean> {
  const [row] = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      ) AS exists
    `,
    tableName
  );

  return !!row?.exists;
}

async function getMovementStats(tableName: string, asOfDate: string, balanceDate: string | null) {
  let whereClause = `transaction_date::date <= $1::date`;
  const params: Array<string> = [asOfDate];

  if (balanceDate && DATE_RE.test(balanceDate)) {
    whereClause = `transaction_date::date > $1::date AND transaction_date::date <= $2::date`;
    params[0] = balanceDate;
    params.push(asOfDate);
  }

  const sql = `
    SELECT
      COALESCE(SUM(CASE WHEN account_currency_amount > 0 THEN account_currency_amount ELSE 0 END), 0)::numeric AS income,
      COALESCE(SUM(CASE WHEN account_currency_amount < 0 THEN ABS(account_currency_amount) ELSE 0 END), 0)::numeric AS expense,
      COALESCE(SUM(account_currency_amount), 0)::numeric AS net
    FROM "${tableName}"
    WHERE ${whereClause}
  `;

  const [row] = await prisma.$queryRawUnsafe<Array<{ income: unknown; expense: unknown; net: unknown }>>(sql, ...params);

  return {
    income: toNumber(row?.income),
    expense: toNumber(row?.expense),
    net: toNumber(row?.net),
  };
}

export async function GET(request: NextRequest) {
  try {
    const selection = await resolveInsiderSelection(request);
    const insiderUuidListSql = sqlUuidInList(selection.selectedUuids);

    const asOfDateRaw = request.nextUrl.searchParams.get("asOfDate") || new Date().toISOString().slice(0, 10);
    if (!DATE_RE.test(asOfDateRaw)) {
      return NextResponse.json({ error: "Invalid asOfDate, expected YYYY-MM-DD" }, { status: 400 });
    }

    const accounts = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        ba.uuid,
        ba.account_number,
        ba.insider_uuid,
        ba.balance,
        ba.balance_date,
        c.code AS currency_code,
        b.bank_name,
        ps.scheme AS parsing_scheme_name
      FROM bank_accounts ba
      LEFT JOIN currencies c ON ba.currency_uuid = c.uuid
      LEFT JOIN banks b ON ba.bank_uuid = b.uuid
      LEFT JOIN parsing_schemes ps ON ba.parsing_scheme_uuid = ps.uuid
      WHERE ba.insider_uuid IN (${insiderUuidListSql})
      ORDER BY ba.created_at DESC
    `);

    const rows = await Promise.all(
      accounts.map(async (account) => {
        const openingBalance = account.balance === null || account.balance === undefined ? null : toNumber(account.balance);
        const balanceDate = account.balance_date ? String(account.balance_date).slice(0, 10) : null;
        const tableName = deriveDeconsolidatedTableName({
          accountNumber: account.account_number,
          bankName: account.bank_name,
          currencyCode: account.currency_code,
          parsingSchemeName: account.parsing_scheme_name,
        });

        const bogAccount = isBogAccount({
          bankName: account.bank_name,
          parsingSchemeName: account.parsing_scheme_name,
        });

        let bogApiBalance: number | null = null;
        let bogBalanceStatus = "not_applicable";
        let bogCorrelationId: string | null = null;

        if (bogAccount) {
          try {
            const bog = await fetchBogApiBalance({
              accountNumber: account.account_number,
              currencyCode: account.currency_code,
              insiderUuid: account.insider_uuid ? String(account.insider_uuid) : null,
              asOfDate: asOfDateRaw,
            });
            bogApiBalance = bog.bogApiBalance;
            bogBalanceStatus = bog.bogBalanceStatus;
            bogCorrelationId = bog.bogCorrelationId;
          } catch {
            bogApiBalance = null;
            bogBalanceStatus = "bog_fetch_failed";
            bogCorrelationId = null;
          }
        }

        if (!tableName || !TABLE_NAME_RE.test(tableName)) {
          return {
            bankAccountUuid: account.uuid,
            deconsolidatedTable: null,
            openingBalance,
            openingBalanceDate: balanceDate,
            income: 0,
            expense: 0,
            netChange: 0,
            computedCurrentBalance: openingBalance,
            storedBalance: openingBalance,
            deltaFromStored: 0,
            deltaFromBogApi: bogApiBalance === null ? null : (openingBalance ?? 0) - bogApiBalance,
            bogApiBalance,
            bogBalanceStatus,
            bogCorrelationId,
            asOfDate: asOfDateRaw,
            status: "skipped_table_unknown",
          };
        }

        const exists = await tableExists(tableName);
        if (!exists) {
          return {
            bankAccountUuid: account.uuid,
            deconsolidatedTable: tableName,
            openingBalance,
            openingBalanceDate: balanceDate,
            income: 0,
            expense: 0,
            netChange: 0,
            computedCurrentBalance: openingBalance,
            storedBalance: openingBalance,
            deltaFromStored: 0,
            deltaFromBogApi: bogApiBalance === null ? null : (openingBalance ?? 0) - bogApiBalance,
            bogApiBalance,
            bogBalanceStatus,
            bogCorrelationId,
            asOfDate: asOfDateRaw,
            status: "skipped_table_missing",
          };
        }

        const movement = await getMovementStats(tableName, asOfDateRaw, balanceDate);
        const base = openingBalance ?? 0;
        const computedCurrentBalance = base + movement.net;

        return {
          bankAccountUuid: account.uuid,
          deconsolidatedTable: tableName,
          openingBalance,
          openingBalanceDate: balanceDate,
          income: movement.income,
          expense: movement.expense,
          netChange: movement.net,
          computedCurrentBalance,
          storedBalance: openingBalance,
          deltaFromStored: openingBalance === null ? null : computedCurrentBalance - openingBalance,
          deltaFromBogApi: bogApiBalance === null ? null : computedCurrentBalance - bogApiBalance,
          bogApiBalance,
          bogBalanceStatus,
          bogCorrelationId,
          asOfDate: asOfDateRaw,
          status: "ok",
        };
      })
    );

    return NextResponse.json({ asOfDate: asOfDateRaw, rows });
  } catch (error) {
    console.error("Error computing bank account balances:", error);
    return NextResponse.json({ error: "Failed to compute bank account balances" }, { status: 500 });
  }
}
