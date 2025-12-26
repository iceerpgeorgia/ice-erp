import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function PUT(
  request: Request,
  { params }: { params: { uuid: string } }
) {
  try {
    const body = await request.json();
    const { bankName } = body;

    if (!bankName) {
      return NextResponse.json(
        { error: "Bank name is required" },
        { status: 400 }
      );
    }

    const bank = await prisma.bank.update({
      where: { uuid: params.uuid },
      data: {
        bankName,
      },
    });

    return NextResponse.json({
      id: Number(bank.id),
      uuid: bank.uuid,
      bankName: bank.bankName,
      isActive: bank.isActive,
      createdAt: bank.createdAt.toISOString(),
      updatedAt: bank.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Error updating bank:", error);
    return NextResponse.json(
      { error: "Failed to update bank" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { uuid: string } }
) {
  try {
    await prisma.bank.delete({
      where: { uuid: params.uuid },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting bank:", error);
    return NextResponse.json(
      { error: "Failed to delete bank" },
      { status: 500 }
    );
  }
}
