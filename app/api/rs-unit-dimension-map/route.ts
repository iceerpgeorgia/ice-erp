import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireAuth, isAuthError } from "@/lib/auth-guard";

function formatDate(date: string | Date | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export async function GET() {
  try {
    const [rows, unitCounts] = await Promise.all([
      prisma.rs_unit_dimension_map.findMany({
        orderBy: [{ rs_unit_id: "asc" }],
        include: { dimension: { select: { uuid: true, dimension: true } } },
      }),
      prisma.rs_waybills_in_items.groupBy({
        by: ["unit_id"],
        _count: { unit_id: true },
      }),
    ]);

    const countMap: Record<string, number> = {};
    for (const c of unitCounts) {
      if (c.unit_id != null) countMap[String(c.unit_id)] = c._count.unit_id;
    }

    const data = rows.map((r) => ({
      id: Number(r.id),
      uuid: r.uuid,
      rs_unit_id: r.rs_unit_id,
      rs_unit_label: r.rs_unit_label,
      dimension_uuid: r.dimension_uuid,
      dimension_name: r.dimension?.dimension ?? null,
      is_active: r.is_active,
      item_count: countMap[r.rs_unit_id] ?? 0,
      createdAt: formatDate(r.created_at),
      updatedAt: formatDate(r.updated_at),
    }));

    return NextResponse.json({ data });
  } catch (e: any) {
    console.error("[rs-unit-dimension-map] GET error", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  try {
    const idParam = new URL(req.url).searchParams.get("id");
    if (!idParam) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const body = await req.json().catch(() => ({} as any));

    // Toggle active only
    if (body.active !== undefined && Object.keys(body).length === 1) {
      const active = typeof body.active === "boolean" ? body.active : true;
      await prisma.rs_unit_dimension_map.update({
        where: { id: BigInt(Number(idParam)) },
        data: { is_active: active, updated_at: new Date() },
      });
      return NextResponse.json({ id: Number(idParam) });
    }

    // Update dimension_uuid binding
    const dimension_uuid = body.dimension_uuid === "" ? null : (body.dimension_uuid ?? undefined);
    const rs_unit_label = typeof body.rs_unit_label === "string" ? body.rs_unit_label.trim() : undefined;

    const updated = await prisma.rs_unit_dimension_map.update({
      where: { id: BigInt(Number(idParam)) },
      data: {
        ...(rs_unit_label !== undefined && { rs_unit_label }),
        ...(dimension_uuid !== undefined && { dimension_uuid }),
        updated_at: new Date(),
      },
      include: { dimension: { select: { uuid: true, dimension: true } } },
    });

    await logAudit({ table: "rs_unit_dimension_map", recordId: updated.id, action: "update" });

    return NextResponse.json({
      id: Number(updated.id),
      uuid: updated.uuid,
      rs_unit_id: updated.rs_unit_id,
      rs_unit_label: updated.rs_unit_label,
      dimension_uuid: updated.dimension_uuid,
      dimension_name: updated.dimension?.dimension ?? null,
      is_active: updated.is_active,
      updatedAt: formatDate(updated.updated_at),
    });
  } catch (e: any) {
    console.error("[rs-unit-dimension-map] PATCH error", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
