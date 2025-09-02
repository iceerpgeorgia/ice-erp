import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function GET() {
  const rows = await prisma.entityType.findMany({
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
    const updated = await prisma.entityType.update({
      where: { id: Number(idParam) },
      data: { is_active: false },
      select: { id: true, is_active: true },
    });
    return NextResponse.json(updated);
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
    const updated = await prisma.entityType.update({
      where: { id: Number(idParam) },
      data: { is_active: active },
      select: { id: true, is_active: true },
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Server error" }, { status: 500 });
  }
}
