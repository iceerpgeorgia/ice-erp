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
  const dimension = typeof body?.dimension === "string" ? body.dimension.trim() : "";
  const is_active = typeof body?.is_active === "boolean" ? body.is_active : true;

  if (!dimension) {
    errors.dimension = "Dimension name is required";
  }

  return { errors, payload: { dimension, is_active } } as const;
}

export async function GET() {
  try {
    const rows = await prisma.dimensions.findMany({
      orderBy: { dimension: "asc" },
    });

    const data = rows.map((row) => ({
      id: Number(row.id),
      uuid: row.uuid,
      dimension: row.dimension,
      is_active: row.is_active,
      createdAt: formatDate(row.created_at),
      updatedAt: formatDate(row.updated_at),
    }));

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error("[dimensions] GET error", error);
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

    const existing = await prisma.dimensions.findUnique({ where: { dimension: payload.dimension } });
    if (existing) {
      return NextResponse.json(
        { error: "Validation failed", details: { dimension: "Dimension already exists" } },
        { status: 400 }
      );
    }

    const created = await prisma.dimensions.create({
      data: {
        uuid: crypto.randomUUID(),
        dimension: payload.dimension,
        is_active: payload.is_active,
        updated_at: new Date(),
      },
    });

    await logAudit({ table: "dimensions", recordId: created.id, action: "create" });

    return NextResponse.json(
      {
        id: Number(created.id),
        uuid: created.uuid,
        dimension: created.dimension,
        is_active: created.is_active,
        createdAt: formatDate(created.created_at),
        updatedAt: formatDate(created.updated_at),
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[dimensions] POST error", error);
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
      await prisma.dimensions.update({ where: { id: BigInt(Number(idParam)) }, data: { is_active: active } });
      await logAudit({ table: "dimensions", recordId: BigInt(Number(idParam)), action: active ? "activate" : "deactivate" });
      return NextResponse.json({ id: Number(idParam) });
    }

    const { errors, payload } = validatePayload(body);
    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 });
    }

    const existing = await prisma.dimensions.findUnique({ where: { id: BigInt(Number(idParam)) } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (payload.dimension !== existing.dimension) {
      const dup = await prisma.dimensions.findUnique({ where: { dimension: payload.dimension } });
      if (dup) {
        return NextResponse.json(
          { error: "Validation failed", details: { dimension: "Dimension already exists" } },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.dimensions.update({
      where: { id: BigInt(Number(idParam)) },
      data: { dimension: payload.dimension, is_active: payload.is_active, updated_at: new Date() },
    });

    await logAudit({ table: "dimensions", recordId: BigInt(Number(idParam)), action: "update" });

    return NextResponse.json({
      id: Number(updated.id),
      uuid: updated.uuid,
      dimension: updated.dimension,
      is_active: updated.is_active,
      createdAt: formatDate(updated.created_at),
      updatedAt: formatDate(updated.updated_at),
    });
  } catch (e: any) {
    console.error("[dimensions] PATCH error", e);
    return NextResponse.json({ error: e.message ?? "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const idParam = new URL(req.url).searchParams.get("id");
    if (!idParam) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await prisma.dimensions.update({ where: { id: BigInt(Number(idParam)) }, data: { is_active: false } });
    await logAudit({ table: "dimensions", recordId: BigInt(Number(idParam)), action: "deactivate" });

    return NextResponse.json({ id: Number(idParam) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Server error" }, { status: 500 });
  }
}
