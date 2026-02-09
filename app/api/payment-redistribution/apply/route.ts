import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const revalidate = 0;
export const dynamic = "force-dynamic";

const ALLOWED_TABLES = new Set([
  "GE78BG0000000893486000_BOG_GEL",
  "GE65TB7856036050100002_TBC_GEL",
]);

type UpdateItem = {
  source_table: string;
  id: number;
  to_payment_id: string;
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const updates: UpdateItem[] = Array.isArray(body.updates) ? body.updates : [];

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No updates provided." },
        { status: 400 }
      );
    }

    const queries = updates.map((update) => {
      if (!ALLOWED_TABLES.has(update.source_table)) {
        throw new Error(`Unsupported source table: ${update.source_table}`);
      }
      return prisma.$executeRawUnsafe(
        `UPDATE "${update.source_table}"
         SET payment_id = $1,
             parsing_lock = true,
             updated_at = NOW()
         WHERE id = $2`,
        update.to_payment_id,
        BigInt(update.id)
      );
    });

    const results = await prisma.$transaction(queries);

    return NextResponse.json({ updated: results.length });
  } catch (error: any) {
    console.error("POST /api/payment-redistribution/apply failed:", error);
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
