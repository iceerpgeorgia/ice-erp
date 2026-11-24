import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { getRequiredInsider } from '@/lib/required-insider';
import { requireAuth, isAuthError } from '@/lib/auth-guard';
import { UNIT_MISMATCH_MESSAGE, isUnitMismatchError } from '@/lib/waybills/unit-mismatch';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Binds one waybill item to an inventory from the inline Inventory picker.
// Body: { id, inventory_uuid: string | null, dryRun?: boolean }
// * The inventory's dimension must equal the item's (strict units; the DB trigger enforces it too).
// * Binding also fills every unbound item with the same insider, normalised goods name and unit.
//   Items that already have an inventory are never changed by the group.
// * inventory_uuid null clears only the clicked item.
// * dryRun returns how many other items the group would fill, without writing.
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  const inventoryUuid = typeof body?.inventory_uuid === 'string' && body.inventory_uuid.trim() ? body.inventory_uuid.trim() : null;
  const dryRun = body?.dryRun === true;
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'id must be an item id' }, { status: 400 });
  }
  if (inventoryUuid && !UUID_REGEX.test(inventoryUuid)) {
    return NextResponse.json({ error: 'inventory_uuid must be a UUID or null' }, { status: 400 });
  }

  try {
    const insider = await getRequiredInsider();
    const item = await prisma.rs_waybills_in_items.findFirst({
      where: { id: BigInt(id), insider_uuid: insider.insiderUuid },
      select: { id: true, goods_name: true, unit: true, dimension_uuid: true, inventory_uuid: true },
    });
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    if (!inventoryUuid) {
      if (dryRun) return NextResponse.json({ groupCount: 0 });
      if (item.inventory_uuid) {
        await prisma.rs_waybills_in_items.update({
          where: { id: item.id },
          data: { inventory_uuid: null, updated_at: new Date() },
        });
        await logAudit({ table: 'rs_waybills_in_items', recordId: item.id, action: 'update' });
      }
      return NextResponse.json({ updated: [id], groupUpdated: 0 });
    }

    const inventory = await prisma.inventories.findFirst({
      where: { uuid: inventoryUuid, insider_uuid: insider.insiderUuid },
      select: { uuid: true, dimension_uuid: true, is_active: true },
    });
    if (!inventory) return NextResponse.json({ error: 'Inventory not found' }, { status: 404 });
    if (!item.dimension_uuid) {
      return NextResponse.json(
        { error: `Unit "${item.unit ?? ''}" is not mapped to a dimension. Map it in Unit Text → Dimension Mapping first.` },
        { status: 409 }
      );
    }
    if (inventory.dimension_uuid !== item.dimension_uuid) {
      return NextResponse.json({ error: UNIT_MISMATCH_MESSAGE }, { status: 409 });
    }

    if (dryRun) {
      const [row] = await prisma.$queryRaw<Array<{ n: number }>>`
        SELECT count(*)::int AS n
          FROM rs_waybills_in_items
         WHERE insider_uuid = ${insider.insiderUuid}::uuid
           AND inventory_uuid IS NULL
           AND waybill_norm_name(goods_name) = waybill_norm_name(${item.goods_name})
           AND unit IS NOT DISTINCT FROM ${item.unit}
           AND id <> ${item.id}
      `;
      return NextResponse.json({ groupCount: row?.n ?? 0 });
    }

    const updated = await prisma.$queryRaw<Array<{ id: bigint }>>`
      UPDATE rs_waybills_in_items
         SET inventory_uuid = ${inventoryUuid}::uuid,
             updated_at = now()
       WHERE insider_uuid = ${insider.insiderUuid}::uuid
         AND (
           id = ${item.id}
           OR (
             inventory_uuid IS NULL
             AND waybill_norm_name(goods_name) = waybill_norm_name(${item.goods_name})
             AND unit IS NOT DISTINCT FROM ${item.unit}
           )
         )
      RETURNING id
    `;
    for (const row of updated) {
      await logAudit({ table: 'rs_waybills_in_items', recordId: row.id, action: 'update' });
    }
    const updatedIds = updated.map((row) => Number(row.id));
    return NextResponse.json({ updated: updatedIds, groupUpdated: updatedIds.filter((value) => value !== id).length });
  } catch (error: any) {
    if (isUnitMismatchError(error)) {
      return NextResponse.json({ error: UNIT_MISMATCH_MESSAGE }, { status: 409 });
    }
    console.error('[waybill-items/bind-inventory] POST error', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
