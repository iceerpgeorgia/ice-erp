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

/** GET — list all unit_text entries with item counts and dimension bindings */
export async function GET() {
  try {
    const [rows, unitCounts] = await Promise.all([
      prisma.rs_unit_dimension_map.findMany({
        orderBy: [{ unit_text: "asc" }],
        include: { dimension: { select: { uuid: true, dimension: true } } },
      }),
      prisma.rs_waybills_in_items.groupBy({
        by: ["unit"],
        _count: { unit: true },
      }),
    ]);

    const countMap: Record<string, number> = {};
    for (const c of unitCounts) {
      if (c.unit != null) countMap[c.unit] = c._count.unit;
    }

    const data = rows.map((r) => ({
      id: Number(r.id),
      uuid: r.uuid,
      unit_text: r.unit_text,
      dimension_uuid: r.dimension_uuid,
      dimension_name: r.dimension?.dimension ?? null,
      is_active: r.is_active,
      item_count: countMap[r.unit_text] ?? 0,
      createdAt: formatDate(r.created_at),
      updatedAt: formatDate(r.updated_at),
    }));

    return NextResponse.json({ data });
  } catch (e: any) {
    console.error("[rs-unit-dimension-map] GET error", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

/** PATCH ?id=<id> — update dimension_uuid binding or is_active */
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  try {
    const idParam = new URL(req.url).searchParams.get("id");
    if (!idParam) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const body = await req.json().catch(() => ({} as any));

    // Toggle active only
    if (body.active !== undefined && Object.keys(body).length === 1) {
      await prisma.rs_unit_dimension_map.update({
        where: { id: BigInt(Number(idParam)) },
        data: { is_active: typeof body.active === "boolean" ? body.active : true, updated_at: new Date() },
      });
      return NextResponse.json({ id: Number(idParam) });
    }

    // Update dimension_uuid binding
    const dimension_uuid = body.dimension_uuid === "" ? null : (body.dimension_uuid ?? undefined);

    const updated = await prisma.rs_unit_dimension_map.update({
      where: { id: BigInt(Number(idParam)) },
      data: {
        ...(dimension_uuid !== undefined && { dimension_uuid }),
        updated_at: new Date(),
      },
      include: { dimension: { select: { uuid: true, dimension: true } } },
    });

    await logAudit({ table: "rs_unit_dimension_map", recordId: updated.id, action: "update" });

    return NextResponse.json({
      id: Number(updated.id),
      uuid: updated.uuid,
      unit_text: updated.unit_text,
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

/**
 * POST — sync: insert any unit text values from rs_waybills_in_items
 * that are not yet in the map. Never deletes existing entries.
 */
export async function POST() {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  try {
    const itemUnits = await prisma.rs_waybills_in_items.groupBy({
      by: ["unit"],
      _count: { unit: true },
    });

    const distinctTexts = itemUnits
      .map((r) => r.unit)
      .filter((u): u is string => !!u && u.trim() !== "");

    const existing = await prisma.rs_unit_dimension_map.findMany({
      select: { unit_text: true },
    });
    const existingSet = new Set(existing.map((r) => r.unit_text));

    const newTexts = distinctTexts.filter((t) => !existingSet.has(t));

    if (newTexts.length === 0) {
      return NextResponse.json({ added: 0, message: "Already up to date" });
    }

    await prisma.rs_unit_dimension_map.createMany({
      data: newTexts.map((unit_text) => ({ unit_text })),
      skipDuplicates: true,
    });

    return NextResponse.json({ added: newTexts.length, new_texts: newTexts });
  } catch (e: any) {
    console.error("[rs-unit-dimension-map] POST error", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
