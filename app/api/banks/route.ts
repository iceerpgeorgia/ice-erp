import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const banks = await prisma.bank.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedBanks = banks.map((bank) => ({
      id: Number(bank.id),
      uuid: bank.uuid,
      bankName: bank.bankName,
      is_active: bank.isActive,
      createdAt: bank.createdAt.toISOString(),
      updatedAt: bank.updatedAt.toISOString(),
    }));

    return NextResponse.json(formattedBanks);
  } catch (error) {
    console.error("Error fetching banks:", error);
    return NextResponse.json(
      { error: "Failed to fetch banks" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bankName } = body;

    if (!bankName) {
      return NextResponse.json(
        { error: "Bank name is required" },
        { status: 400 }
      );
    }

    const bank = await prisma.bank.create({
      data: {
        bankName,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      id: Number(bank.id),
      uuid: bank.uuid,
      bankName: bank.bankName,
      is_active: bank.isActive,
      createdAt: bank.createdAt.toISOString(),
      updatedAt: bank.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Error creating bank:", error);
    return NextResponse.json(
      { error: "Failed to create bank" },
      { status: 500 }
    );
  }
}

