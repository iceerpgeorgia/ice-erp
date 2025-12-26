import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function PUT(
  request: Request,
  { params }: { params: { uuid: string } }
) {
  try {
    const body = await request.json();
    const { accountNumber, currencyUuid, bankUuid } = body;

    if (!accountNumber || !currencyUuid) {
      return NextResponse.json(
        { error: "Account number and currency are required" },
        { status: 400 }
      );
    }

    const bankAccount = await prisma.bankAccount.update({
      where: { uuid: params.uuid },
      data: {
        accountNumber,
        currencyUuid,
        bankUuid: bankUuid || null,
      },
      include: {
        currency: {
          select: {
            code: true,
            name: true,
          },
        },
        bank: {
          select: {
            bankName: true,
          },
        },
      },
    });

    return NextResponse.json({
      id: Number(bankAccount.id),
      uuid: bankAccount.uuid,
      accountNumber: bankAccount.accountNumber,
      currencyUuid: bankAccount.currencyUuid,
      currencyCode: bankAccount.currency.code,
      currencyName: bankAccount.currency.name,
      bankUuid: bankAccount.bankUuid,
      bankName: bankAccount.bank?.bankName,
      isActive: bankAccount.isActive,
      createdAt: bankAccount.createdAt.toISOString(),
      updatedAt: bankAccount.updatedAt.toISOString(),
    });
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
