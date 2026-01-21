import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const bankAccounts = await prisma.$queryRaw<any[]>`
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
      ORDER BY ba.created_at DESC
    `;

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
      balance_date: account.balance_date,
      parsingSchemeUuid: account.parsing_scheme_uuid,
      parsingSchemeName: account.parsing_scheme_name,
      rawTableName: account.raw_table_name,
      is_active: account.is_active,
      createdAt: account.created_at,
      updatedAt: account.updated_at,
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { accountNumber, currencyUuid, bankUuid, balance, balanceDate, parsingSchemeUuid, rawTableName } = body;

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

