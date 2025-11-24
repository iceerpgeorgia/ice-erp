import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const revalidate = 0;
const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    
    if (!id) {
      return NextResponse.json({ error: "Missing counteragent id" }, { status: 400 });
    }

    const logs = await prisma.counteragentAuditLog.findMany({
      where: {
        counteragent_id: BigInt(id),
      },
      orderBy: {
        changed_at: "desc",
      },
    });

    const data = logs.map((log) => ({
      id: Number(log.id),
      counteragent_id: Number(log.counteragent_id),
      changed_at: log.changed_at.toISOString(),
      changed_by: log.changed_by,
      field_name: log.field_name,
      old_value: log.old_value,
      new_value: log.new_value,
      operation: log.operation,
    }));

    return NextResponse.json(data, { status: 200 });
  } catch (e: any) {
    console.error("GET /counteragents/audit-api", e);
    return NextResponse.json({ error: e.message ?? "Server error" }, { status: 500 });
  }
}
