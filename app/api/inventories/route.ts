import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getRequiredInsider } from "@/lib/required-insider";
import { requireAuth, isAuthError } from "@/lib/auth-guard";

function formatDate(date: string | Date | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function validatePayload(body: any) {
  const errors: Record<string, string> = {};
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const producer_uuid = typeof body?.producer_uuid === "string" && body.producer_uuid.trim() ? body.producer_uuid.trim() : null;
  const inventory_group_uuid = typeof body?.inventory_group_uuid === "string" && body.inventory_group_uuid.trim() ? body.inventory_group_uuid.trim() : null;
  const dimension_uuid = typeof body?.dimension_uuid === "string" && body.dimension_uuid.trim() ? body.dimension_uuid.trim() : null;
  const internal_number = typeof body?.internal_number === "string" ? body.internal_number.trim() : null;
  const is_nonbalance = typeof body?.is_nonbalance === "boolean" ? body.is_nonbalance : false;
  const is_capex = typeof body?.is_capex === "boolean" ? body.is_capex : false;
  const is_active = typeof body?.is_active === "boolean" ? body.is_active : true;

  if (!name) errors.name = "Inventory name is required";

  return {
    errors,
    payload: { name, producer_uuid, inventory_group_uuid, dimension_uuid, internal_number, is_nonbalance, is_capex, is_active },
  } as const;
}

export async function GET() {
  try {
    const insider = await getRequiredInsider();
    const rows = await prisma.inventories.findMany({
      orderBy: { name: "asc" },
      include: {
        inventory_group: { select: { name: true } },
        dimension: { select: { dimension: true } },
      },
    });

    const data = rows.map((row) => ({
      id: Number(row.id),
      uuid: row.uuid,
      name: row.name,
      producer_uuid: row.producer_uuid,
      inventory_group_uuid: row.inventory_group_uuid,
      dimension_uuid: row.dimension_uuid,
      internal_number: row.internal_number,
      is_nonbalance: row.is_nonbalance,
      is_capex: row.is_capex,
      is_active: row.is_active,
      inventory_group_name: row.inventory_group?.name ?? "",
      dimension_name: row.dimension?.dimension ?? "",
      createdAt: formatDate(row.created_at),
      updatedAt: formatDate(row.updated_at),
      insider_uuid: (row as any).insider_uuid ?? insider.insiderUuid,
      insider_name: insider.insiderName,
    }));

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error("[inventories] GET error", error);
    return NextResponse.json({ error: error?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  try {
    const insider = await getRequiredInsider();
    const body = await req.json().catch(() => ({}));
    const { errors, payload } = validatePayload(body);

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 });
    }

    const created = await prisma.inventories.create({
      data: {
        uuid: crypto.randomUUID(),
        name: payload.name,
        producer_uuid: payload.producer_uuid,
        inventory_group_uuid: payload.inventory_group_uuid,
        dimension_uuid: payload.dimension_uuid,
        internal_number: payload.internal_number,
        is_nonbalance: payload.is_nonbalance,
        is_capex: payload.is_capex,
        is_active: payload.is_active,
        updated_at: new Date(),
      },
      include: {
        inventory_group: { select: { name: true } },
        dimension: { select: { dimension: true } },
      },
    });

    await logAudit({ table: "inventories", recordId: created.id, action: "create" });

    return NextResponse.json(
      {
        id: Number(created.id),
        uuid: created.uuid,
        name: created.name,
        producer_uuid: created.producer_uuid,
        inventory_group_uuid: created.inventory_group_uuid,
        dimension_uuid: created.dimension_uuid,
        internal_number: created.internal_number,
        is_nonbalance: created.is_nonbalance,
        is_capex: created.is_capex,
        is_active: created.is_active,
        inventory_group_name: created.inventory_group?.name ?? "",
        dimension_name: created.dimension?.dimension ?? "",
        createdAt: formatDate(created.created_at),
        updatedAt: formatDate(created.updated_at),
        insider_uuid: (created as any).insider_uuid ?? insider.insiderUuid,
        insider_name: insider.insiderName,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[inventories] POST error", error);
    return NextResponse.json({ error: error?.message || "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  try {
    const insider = await getRequiredInsider();
    const idParam = new URL(req.url).searchParams.get("id");
    if (!idParam) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const pk = BigInt(Number(idParam));

    const body = await req.json().catch(() => ({} as any));

    // Toggle active shortcut
    if (body.active !== undefined && Object.keys(body).length === 1) {
      const active = typeof body.active === "boolean" ? body.active : true;
      await prisma.inventories.update({ where: { id: pk }, data: { is_active: active } });
      await logAudit({ table: "inventories", recordId: pk, action: active ? "activate" : "deactivate" });
      return NextResponse.json({ id: Number(idParam) });
    }

    const { errors, payload } = validatePayload(body);
    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 });
    }

    const existing = await prisma.inventories.findUnique({ where: { id: pk } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.inventories.update({
      where: { id: pk },
      data: {
        name: payload.name,
        producer_uuid: payload.producer_uuid,
        inventory_group_uuid: payload.inventory_group_uuid,
        dimension_uuid: payload.dimension_uuid,
        internal_number: payload.internal_number,
        is_nonbalance: payload.is_nonbalance,
        is_capex: payload.is_capex,
        is_active: payload.is_active,
        updated_at: new Date(),
      },
      include: {
        inventory_group: { select: { name: true } },
        dimension: { select: { dimension: true } },
      },
    });

    await logAudit({ table: "inventories", recordId: pk, action: "update" });

    return NextResponse.json({
      id: Number(updated.id),
      uuid: updated.uuid,
      name: updated.name,
      producer_uuid: updated.producer_uuid,
      inventory_group_uuid: updated.inventory_group_uuid,
      dimension_uuid: updated.dimension_uuid,
      internal_number: updated.internal_number,
      is_nonbalance: updated.is_nonbalance,
      is_capex: updated.is_capex,
      is_active: updated.is_active,
      inventory_group_name: updated.inventory_group?.name ?? "",
      dimension_name: updated.dimension?.dimension ?? "",
      createdAt: formatDate(updated.created_at),
      updatedAt: formatDate(updated.updated_at),
      insider_uuid: (updated as any).insider_uuid ?? insider.insiderUuid,
      insider_name: insider.insiderName,
    });
  } catch (e: any) {
    console.error("[inventories] PATCH error", e);
    return NextResponse.json({ error: e.message ?? "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  try {
    const idParam = new URL(req.url).searchParams.get("id");
    if (!idParam) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const pk = BigInt(Number(idParam));

    await prisma.inventories.update({ where: { id: pk }, data: { is_active: false } });
    await logAudit({ table: "inventories", recordId: pk, action: "deactivate" });

    return NextResponse.json({ id: Number(idParam) });
  } catch (error: any) {
    console.error("[inventories] DELETE error", error);
    return NextResponse.json({ error: error?.message || "Server error" }, { status: 500 });
  }
}
