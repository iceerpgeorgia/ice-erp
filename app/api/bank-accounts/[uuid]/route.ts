import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function PUT(
  request: Request,
  { params }: { params: { uuid: string } }
) {
  try {
    const body = await request.json();
    const { accountNumber, currencyUuid, bankUuid, balance, balanceDate, parsingSchemeUuid, rawTableName } = body;

    if (!accountNumber || !currencyUuid) {
      return NextResponse.json(
        { error: "Account number and currency are required" },
        { status: 400 }
      );
    }

    await prisma.$executeRaw`
      UPDATE bank_accounts
      SET 
        account_number = ${accountNumber},
        currency_uuid = ${currencyUuid}::uuid,
        bank_uuid = ${bankUuid || null}::uuid,
        balance = ${balance || null}::numeric,
        balance_date = ${balanceDate || null}::date,
        parsing_scheme_uuid = ${parsingSchemeUuid || null}::uuid,
        raw_table_name = ${rawTableName || null},
        updated_at = NOW()
      WHERE uuid = ${params.uuid}::uuid
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating bank account:", error);
    return NextResponse.json(
      { error: "Failed to update bank account" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { uuid: string } }
) {
  try {
    await prisma.bankAccount.delete({
      where: { uuid: params.uuid },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting bank account:", error);
    return NextResponse.json(
      { error: "Failed to delete bank account" },
      { status: 500 }
    );
  }
}
