import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getInsiderOptions, resolveInsiderSelection } from "@/lib/insider-selection";

const prisma = new PrismaClient();

export async function PUT(
  request: NextRequest,
  { params }: { params: { uuid: string } }
) {
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
        insider_uuid = ${effectiveInsiderUuid}::uuid,
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
