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
  const waybill_no = typeof body?.waybill_no === "string" ? body.waybill_no.trim() : null;
  const goods_code = typeof body?.goods_code === "string" ? body.goods_code.trim() : null;
  const goods_name = typeof body?.goods_name === "string" ? body.goods_name.trim() : null;
  const unit = typeof body?.unit === "string" ? body.unit.trim() : null;
  const quantity = body?.quantity != null && body.quantity !== "" ? Number(body.quantity) : null;
  const unit_price = body?.unit_price != null && body.unit_price !== "" ? Number(body.unit_price) : null;
  const total_price = body?.total_price != null && body.total_price !== "" ? Number(body.total_price) : null;
  const taxation = typeof body?.taxation === "string" ? body.taxation.trim() : null;
  const inventory_uuid = typeof body?.inventory_uuid === "string" && body.inventory_uuid.trim() ? body.inventory_uuid.trim() : null;
  const project_uuid = typeof body?.project_uuid === "string" && body.project_uuid.trim() ? body.project_uuid.trim() : null;
  const financial_code_uuid = typeof body?.financial_code_uuid === "string" && body.financial_code_uuid.trim() ? body.financial_code_uuid.trim() : null;
  const corresponding_account = typeof body?.corresponding_account === "string" ? body.corresponding_account.trim() : null;
  const import_batch_id = typeof body?.import_batch_id === "string" ? body.import_batch_id.trim() : null;

  if (!goods_name) errors.goods_name = "Goods name is required";

  return {
    errors,
    payload: {
      waybill_no, goods_code, goods_name, unit,
      quantity, unit_price, total_price, taxation,
      inventory_uuid, project_uuid, financial_code_uuid,
      corresponding_account, import_batch_id,
    },
  } as const;
}

export async function GET(req: NextRequest) {
  try {
    const insider = await getRequiredInsider();
    const url = new URL(req.url);
    const waybillNo = url.searchParams.get("waybill_no");
    const batchId = url.searchParams.get("import_batch_id");

    const where: any = {};
    if (waybillNo) where.waybill_no = waybillNo;
    if (batchId) where.import_batch_id = batchId;

    const rows = await prisma.rs_waybills_in_items.findMany({
      where,
      orderBy: [{ waybill_no: "asc" }, { id: "asc" }],
      include: {
        inventory: { select: { name: true } },
      },
    });

    const data = rows.map((row) => ({
      id: Number(row.id),
      uuid: row.uuid,
      waybill_no: row.waybill_no,
      goods_code: row.goods_code,
      goods_name: row.goods_name,
      unit: row.unit,
      quantity: row.quantity ? Number(row.quantity) : null,
      unit_price: row.unit_price ? Number(row.unit_price) : null,
      total_price: row.total_price ? Number(row.total_price) : null,
      taxation: row.taxation,
      inventory_uuid: row.inventory_uuid,
      inventory_name: row.inventory?.name ?? "",
      project_uuid: row.project_uuid,
      financial_code_uuid: row.financial_code_uuid,
      corresponding_account: row.corresponding_account,
      import_batch_id: row.import_batch_id,
      createdAt: formatDate(row.created_at),
      updatedAt: formatDate(row.updated_at),
      insider_uuid: (row as any).insider_uuid ?? insider.insiderUuid,
      insider_name: insider.insiderName,
    }));

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error("[waybill-items] GET error", error);
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

    const created = await prisma.rs_waybills_in_items.create({
      data: {
        uuid: crypto.randomUUID(),
        waybill_no: payload.waybill_no,
        goods_code: payload.goods_code,
        goods_name: payload.goods_name!,
        unit: payload.unit,
        quantity: payload.quantity,
        unit_price: payload.unit_price,
        total_price: payload.total_price,
        taxation: payload.taxation,
        inventory_uuid: payload.inventory_uuid,
        project_uuid: payload.project_uuid,
        financial_code_uuid: payload.financial_code_uuid,
        corresponding_account: payload.corresponding_account,
        import_batch_id: payload.import_batch_id,
        updated_at: new Date(),
      },
      include: { inventory: { select: { name: true } } },
    });

    await logAudit({ table: "rs_waybills_in_items", recordId: created.id, action: "create" });

    return NextResponse.json(
      {
        id: Number(created.id),
        uuid: created.uuid,
        waybill_no: created.waybill_no,
        goods_code: created.goods_code,
        goods_name: created.goods_name,
        unit: created.unit,
        quantity: created.quantity ? Number(created.quantity) : null,
        unit_price: created.unit_price ? Number(created.unit_price) : null,
        total_price: created.total_price ? Number(created.total_price) : null,
        taxation: created.taxation,
        inventory_uuid: created.inventory_uuid,
        inventory_name: created.inventory?.name ?? "",
        project_uuid: created.project_uuid,
        financial_code_uuid: created.financial_code_uuid,
        corresponding_account: created.corresponding_account,
        import_batch_id: created.import_batch_id,
        createdAt: formatDate(created.created_at),
        updatedAt: formatDate(created.updated_at),
        insider_uuid: (created as any).insider_uuid ?? insider.insiderUuid,
        insider_name: insider.insiderName,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[waybill-items] POST error", error);
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
    const { errors, payload } = validatePayload(body);
    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 });
    }

    const existing = await prisma.rs_waybills_in_items.findUnique({ where: { id: pk } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.rs_waybills_in_items.update({
      where: { id: pk },
      data: {
        waybill_no: payload.waybill_no,
        goods_code: payload.goods_code,
        goods_name: payload.goods_name!,
        unit: payload.unit,
        quantity: payload.quantity,
        unit_price: payload.unit_price,
        total_price: payload.total_price,
        taxation: payload.taxation,
        inventory_uuid: payload.inventory_uuid,
        project_uuid: payload.project_uuid,
        financial_code_uuid: payload.financial_code_uuid,
        corresponding_account: payload.corresponding_account,
        import_batch_id: payload.import_batch_id,
        updated_at: new Date(),
      },
      include: { inventory: { select: { name: true } } },
    });

    await logAudit({ table: "rs_waybills_in_items", recordId: pk, action: "update" });

    return NextResponse.json({
      id: Number(updated.id),
      uuid: updated.uuid,
      waybill_no: updated.waybill_no,
      goods_code: updated.goods_code,
      goods_name: updated.goods_name,
      unit: updated.unit,
      quantity: updated.quantity ? Number(updated.quantity) : null,
      unit_price: updated.unit_price ? Number(updated.unit_price) : null,
      total_price: updated.total_price ? Number(updated.total_price) : null,
      taxation: updated.taxation,
      inventory_uuid: updated.inventory_uuid,
      inventory_name: updated.inventory?.name ?? "",
      project_uuid: updated.project_uuid,
      financial_code_uuid: updated.financial_code_uuid,
      corresponding_account: updated.corresponding_account,
      import_batch_id: updated.import_batch_id,
      createdAt: formatDate(updated.created_at),
      updatedAt: formatDate(updated.updated_at),
      insider_uuid: (updated as any).insider_uuid ?? insider.insiderUuid,
      insider_name: insider.insiderName,
    });
  } catch (e: any) {
    console.error("[waybill-items] PATCH error", e);
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

    await prisma.rs_waybills_in_items.delete({ where: { id: pk } });
    await logAudit({ table: "rs_waybills_in_items", recordId: pk, action: "delete" });

    return NextResponse.json({ id: Number(idParam) });
  } catch (error: any) {
    console.error("[waybill-items] DELETE error", error);
    return NextResponse.json({ error: error?.message || "Server error" }, { status: 500 });
  }
}
