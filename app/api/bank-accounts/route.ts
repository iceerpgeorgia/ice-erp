import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const bankAccounts = await prisma.bankAccount.findMany({
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
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedAccounts = bankAccounts.map((account) => ({
      id: Number(account.id),
      uuid: account.uuid,
      accountNumber: account.accountNumber,
      currencyUuid: account.currencyUuid,
      currencyCode: account.currency.code,
      currencyName: account.currency.name,
      bankUuid: account.bankUuid,
      bankName: account.bank?.bankName,
      isActive: account.isActive,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
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
    const { accountNumber, currencyUuid, bankUuid } = body;

    if (!accountNumber || !currencyUuid) {
      return NextResponse.json(
        { error: "Account number and currency are required" },
        { status: 400 }
      );
    }

    const bankAccount = await prisma.bankAccount.create({
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
    console.error("Error creating bank account:", error);
    return NextResponse.json(
      { error: "Failed to create bank account" },
      { status: 500 }
    );
  }
}
