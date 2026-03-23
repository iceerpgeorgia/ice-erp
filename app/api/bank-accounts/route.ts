import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getInsiderOptions, resolveInsiderSelection, sqlUuidInList } from "@/lib/insider-selection";
import { requireAuth, isAuthError } from "@/lib/auth-guard";

const prisma = new PrismaClient();
const TABLE_NAME_RE = /^[A-Za-z0-9_]+$/;

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

async function getLatestTransactionDate(tableName: string): Promise<string | null> {
  if (!TABLE_NAME_RE.test(tableName)) return null;
  const [row] = await prisma.$queryRawUnsafe<Array<{ latest_date: string | null }>>(
    `
      SELECT MAX(transaction_date::date)::text AS latest_date
      FROM "${tableName}"
    `
  );
  return row?.latest_date || null;
}

async function getRecordedBalanceForDate(accountUuid: string, latestDate: string): Promise<number | null> {
  const [row] = await prisma.$queryRawUnsafe<Array<{ recorded_balance: unknown }>>(
    `
      SELECT
        CASE
          WHEN $2::date = bab.opening_date THEN bab.closing_balance
          ELSE bab.opening_balance
        END AS recorded_balance
      FROM bank_account_balances bab
      WHERE bab.account_uuid = $1::uuid
        AND bab.opening_date <= $2::date
        AND bab.closing_date > $2::date
      ORDER BY bab.opening_date DESC
      LIMIT 1
    `,
    accountUuid,
    latestDate
  );

  if (!row || row.recorded_balance === null || row.recorded_balance === undefined) return null;
  const n = Number(row.recorded_balance);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: NextRequest) {
  try {
    const selection = await resolveInsiderSelection(request);
    const insiderUuidListSql = sqlUuidInList(selection.selectedUuids);
    const bankAccounts = await prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        ba.id,
        ba.uuid,
        ba.account_number,
        ba.currency_uuid,
        ba.bank_uuid,
        ba.balance,
        ba.balance_date,
        ba.parsing_scheme_uuid,
        ba.raw_table_name,
        ba.insider_uuid,
        ba.is_active,
        ba.created_at,
        ba.updated_at,
        c.code as currency_code,
        c.name as currency_name,
        b.bank_name,
        ps.scheme as parsing_scheme_name
      FROM bank_accounts ba
      LEFT JOIN currencies c ON ba.currency_uuid = c.uuid
      LEFT JOIN banks b ON ba.bank_uuid = b.uuid
      LEFT JOIN parsing_schemes ps ON ba.parsing_scheme_uuid = ps.uuid
      WHERE ba.insider_uuid IN (${insiderUuidListSql})
      ORDER BY ba.created_at DESC
    `);

    const formattedAccounts = await Promise.all(
      bankAccounts.map(async (account) => {
        const deconsolidatedTableName = deriveDeconsolidatedTableName({
          accountNumber: account.account_number,
          bankName: account.bank_name,
          currencyCode: account.currency_code,
          parsingSchemeName: account.parsing_scheme_name,
        });

        let latestDate: string | null = null;
        let recordedBalance: number | null = null;

        if (deconsolidatedTableName && TABLE_NAME_RE.test(deconsolidatedTableName)) {
          const exists = await tableExists(deconsolidatedTableName);
          if (exists) {
            latestDate = await getLatestTransactionDate(deconsolidatedTableName);
            if (latestDate) {
              recordedBalance = await getRecordedBalanceForDate(String(account.uuid), latestDate);
            }
          }
        }

        return {
          id: Number(account.id),
          uuid: account.uuid,
          accountNumber: account.account_number,
          currencyUuid: account.currency_uuid,
          currencyCode: account.currency_code,
          currencyName: account.currency_name,
          bankUuid: account.bank_uuid,
          bankName: account.bank_name,
          balance: account.balance ? Number(account.balance) : null,
          balanceDate: account.balance_date,
          parsingSchemeUuid: account.parsing_scheme_uuid,
          parsingSchemeName: account.parsing_scheme_name,
          rawTableName: account.raw_table_name,
          isActive: account.is_active,
          createdAt: account.created_at,
          updatedAt: account.updated_at,
          insiderUuid: account.insider_uuid,
          insiderName: selection.selectedInsiders.find((i) => i.insiderUuid === account.insider_uuid)?.insiderName || null,
          latestDate,
          recordedBalance,
        };
      })
    );

    return NextResponse.json(formattedAccounts);
  } catch (error) {
    console.error("Error fetching bank accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch bank accounts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  try {
    const selection = await resolveInsiderSelection(request);
    const body = await request.json();
    const { accountNumber, currencyUuid, bankUuid, balance, balanceDate, parsingSchemeUuid, rawTableName, insiderUuid, insider_uuid } = body;

    const requestedInsiderUuid = String(insiderUuid ?? insider_uuid ?? '').trim() || null;
    const insiderOptions = await getInsiderOptions();
    const insiderOptionSet = new Set(insiderOptions.map((option) => option.insiderUuid.toLowerCase()));
    if (requestedInsiderUuid && !insiderOptionSet.has(requestedInsiderUuid.toLowerCase())) {
      return NextResponse.json({ error: 'Invalid insider selection' }, { status: 400 });
    }
    const effectiveInsiderUuid = requestedInsiderUuid || selection.primaryInsider?.insiderUuid || null;
    if (!effectiveInsiderUuid) {
      return NextResponse.json({ error: "No insider configured" }, { status: 400 });
    }

    if (!accountNumber || !currencyUuid) {
      return NextResponse.json(
        { error: "Account number and currency are required" },
        { status: 400 }
      );
    }

    const result = await prisma.$queryRaw<any[]>`
      INSERT INTO bank_accounts (
        account_number, 
        currency_uuid, 
        bank_uuid, 
        balance, 
        balance_date, 
        parsing_scheme_uuid,
        raw_table_name,
        insider_uuid,
        created_at,
        updated_at
      )
      VALUES (
        ${accountNumber}, 
        ${currencyUuid}::uuid, 
        ${bankUuid || null}::uuid, 
        ${balance || null}::numeric, 
        ${balanceDate || null}::date, 
        ${parsingSchemeUuid || null}::uuid,
        ${rawTableName || null},
        ${effectiveInsiderUuid}::uuid,
        NOW(),
        NOW()
      )
      RETURNING uuid
    `;

    return NextResponse.json({ uuid: result[0].uuid });
  } catch (error) {
    console.error("Error creating bank account:", error);
    return NextResponse.json(
      { error: "Failed to create bank account" },
      { status: 500 }
    );
  }
}

