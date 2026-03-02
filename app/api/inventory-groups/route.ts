import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

function formatDate(date: string | Date | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function validatePayload(body: any) {
  const errors: Record<string, string> = {};
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const dimension_uuid = typeof body?.dimension_uuid === "string" ? body.dimension_uuid.trim() : "";
  const is_active = typeof body?.is_active === "boolean" ? body.is_active : true;

  if (!name) errors.name = "Group name is required";
  if (!dimension_uuid) errors.dimension_uuid = "Dimension is required";

  return { errors, payload: { name, dimension_uuid, is_active } } as const;
}

export async function GET() {
  try {
    const rows = await prisma.inventory_groups.findMany({
      orderBy: { name: "asc" },
      include: { dimension: { select: { uuid: true, dimension: true } } },
    });

    const data = rows.map((row) => ({
      id: Number(row.id),
      uuid: row.uuid,
      name: row.name,
      dimension_uuid: row.dimension_uuid,
      dimension_name: row.dimension?.dimension ?? "",
      is_active: row.is_active,
      createdAt: formatDate(row.created_at),
      updatedAt: formatDate(row.updated_at),
    }));

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error("[inventory-groups] GET error", error);
    return NextResponse.json({ error: error?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { errors, payload } = validatePayload(body);
    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 });
    }

    const existing = await prisma.inventory_groups.findUnique({ where: { name: payload.name } });
    if (existing) {
      return NextResponse.json({ error: "Validation failed", details: { name: "Group name already exists" } }, { status: 400 });
    }

    const created = await prisma.inventory_groups.create({
      data: {
        uuid: crypto.randomUUID(),
        name: payload.name,
        dimension_uuid: payload.dimension_uuid,
        is_active: payload.is_active,
        updated_at: new Date(),
      },
      include: { dimension: { select: { dimension: true } } },
    });

    await logAudit({ table: "inventory_groups", recordId: created.id, action: "create" });

    return NextResponse.json({
      id: Number(created.id),
      uuid: created.uuid,
      name: created.name,
      dimension_uuid: created.dimension_uuid,
      dimension_name: created.dimension?.dimension ?? "",
      is_active: created.is_active,
      createdAt: formatDate(created.created_at),
      updatedAt: formatDate(created.updated_at),
    }, { status: 201 });
  } catch (error: any) {
    console.error("[inventory-groups] POST error", error);
    return NextResponse.json({ error: error?.message || "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const idParam = new URL(req.url).searchParams.get("id");
    if (!idParam) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const body = await req.json().catch(() => ({} as any));

    if (body.active !== undefined && Object.keys(body).length === 1) {
      const active = typeof body.active === "boolean" ? body.active : true;
      await prisma.inventory_groups.update({ where: { id: BigInt(Number(idParam)) }, data: { is_active: active } });
      await logAudit({ table: "inventory_groups", recordId: BigInt(Number(idParam)), action: active ? "activate" : "deactivate" });
      return NextResponse.json({ id: Number(idParam) });
    }

    const { errors, payload } = validatePayload(body);
    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 });
    }

    const existing = await prisma.inventory_groups.findUnique({ where: { id: BigInt(Number(idParam)) } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (payload.name !== existing.name) {
      const dup = await prisma.inventory_groups.findUnique({ where: { name: payload.name } });
      if (dup) {
        return NextResponse.json({ error: "Validation failed", details: { name: "Group name already exists" } }, { status: 400 });
      }
    }

    const updated = await prisma.inventory_groups.update({
      where: { id: BigInt(Number(idParam)) },
      data: { name: payload.name, dimension_uuid: payload.dimension_uuid, is_active: payload.is_active, updated_at: new Date() },
      include: { dimension: { select: { dimension: true } } },
    });

    await logAudit({ table: "inventory_groups", recordId: BigInt(Number(idParam)), action: "update" });

    return NextResponse.json({
      id: Number(updated.id),
      uuid: updated.uuid,
      name: updated.name,
      dimension_uuid: updated.dimension_uuid,
      dimension_name: updated.dimension?.dimension ?? "",
      is_active: updated.is_active,
      createdAt: formatDate(updated.created_at),
      updatedAt: formatDate(updated.updated_at),
    });
  } catch (e: any) {
    console.error("[inventory-groups] PATCH error", e);
    return NextResponse.json({ error: e.message ?? "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const idParam = new URL(req.url).searchParams.get("id");
    if (!idParam) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await prisma.inventory_groups.update({ where: { id: BigInt(Number(idParam)) }, data: { is_active: false } });
    await logAudit({ table: "inventory_groups", recordId: BigInt(Number(idParam)), action: "deactivate" });

    return NextResponse.json({ id: Number(idParam) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Server error" }, { status: 500 });
  }
}
