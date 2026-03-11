import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getInsiderOptions, resolveInsiderSelection, sqlUuidInList } from "@/lib/insider-selection";

const prisma = new PrismaClient();

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

    const formattedAccounts = bankAccounts.map((account) => ({
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
    }));

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

