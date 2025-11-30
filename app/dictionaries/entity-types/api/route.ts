import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { logAudit } from "@/lib/audit";
const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await prisma.entity_types.findMany({
    orderBy: { name_en: "asc" },
    select: { entity_type_uuid: true, code: true, name_en: true, name_ka: true },
  });
  return NextResponse.json(rows);
}

// Soft-delete: set is_active=false by id
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");
    if (!idParam) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await prisma.entityType.update({
      where: { id: BigInt(Number(idParam)) },
      data: { is_active: false },
    });
    await logAudit({ table: "entity_types", recordId: BigInt(Number(idParam)), action: "deactivate" });
    return NextResponse.json({ id: Number(idParam) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");
    if (!idParam) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const body = await req.json().catch(() => ({} as any));
    const active = typeof body.active === 'boolean' ? body.active : true;
    await prisma.entityType.update({
      where: { id: BigInt(Number(idParam)) },
      data: { is_active: active },
    });
    await logAudit({ table: "entity_types", recordId: BigInt(Number(idParam)), action: active ? "activate" : "deactivate" });
    return NextResponse.json({ id: Number(idParam) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Server error" }, { status: 500 });
  }
}
