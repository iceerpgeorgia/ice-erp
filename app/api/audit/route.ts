import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const table = searchParams.get("table");
    const recordId = searchParams.get("recordId");
    const limit = parseInt(searchParams.get("limit") || "100");
    
    const where: any = {};
    if (table) where.table = table;
  if (recordId) where.recordId = recordId;
    
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        table: true,
        recordId: true,
        action: true,
        userEmail: true,
        userId: true,
        changes: true,
        createdAt: true,
      },
    });
    
    // Convert BigInt to number for JSON serialization
    const serialized = logs.map(log => ({
      ...log,
      id: Number(log.id),
      recordId: Number(log.recordId),
      userId: log.userId ? Number(log.userId) : null,
      createdAt: log.createdAt.toISOString(),
    }));
    
    return NextResponse.json(serialized);
  } catch (error: any) {
    console.error("[audit] GET error", error);
    return NextResponse.json(
      { error: error?.message || "Server error" },
      { status: 500 }
    );
  }
}
