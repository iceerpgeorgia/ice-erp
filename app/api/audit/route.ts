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
    if (recordId) {
      where.record_id = recordId.trim();
    }
    
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: limit,
      select: {
        id: true,
        table: true,
        record_id: true,
        action: true,
        user_email: true,
        user_id: true,
        changes: true,
        created_at: true,
      },
    });
    
    // Convert BigInt to number for JSON serialization
    const serialized = logs.map(log => ({
      id: Number(log.id),
      table: log.table,
      recordId: log.record_id,
      action: log.action,
      userId: log.user_id ? Number(log.user_id) : null,
      userEmail: log.user_email,
      changes: log.changes ? JSON.parse(JSON.stringify(log.changes, (_, v) => typeof v === 'bigint' ? Number(v) : v)) : null,
      createdAt: log.created_at.toISOString(),
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
