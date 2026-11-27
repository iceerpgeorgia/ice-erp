import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { getRequiredInsider } from '@/lib/required-insider';
import { requireAuth, isAuthError } from '@/lib/auth-guard';

export const revalidate = 0;

/**
 * New inventory from a waybill item (the + button on Waybill Items).
 * GET  ?id=<item id>  → what the dialog needs: goods name, the item's unit (dimension), the groups with
 *                       that unit (default: the "დაუხარისხებელი" one), the next internal number, and an
 *                       existing active inventory with the same name and unit, if any.
 * POST { id, name, inventory_group_uuid } → creates the inventory with the item's dimension and the next
 *                       internal number; the page then binds the item to it (bind-inventory).
 * Internal number = the highest numeric internal number of the insider's on-balance inventories
 * (is_nonbalance = false; off-balance ones use their own 100000+ range) plus one, 5 digits.
 */

type ItemRow = { id: bigint; goods_name: string | null; unit: string | null; dimension_uuid: string | null; dimension: string | null; inventory_uuid: string | null };

async function loadItem(id: number, insiderUuid: string) {
  const rows = await prisma.$queryRaw<ItemRow[]>`
    SELECT i.id, i.goods_name, i.unit, i.dimension_uuid::text AS dimension_uuid, d.dimension, i.inventory_uuid::text AS inventory_uuid
      FROM rs_waybills_in_items i
      LEFT JOIN dimensions d ON d.uuid = i.dimension_uuid
     WHERE i.id = ${BigInt(id)} AND i.insider_uuid = ${insiderUuid}::uuid`;
  return rows[0] ?? null;
}

async function nextInternalNumber(db: Pick<typeof prisma, '$queryRaw'>, insiderUuid: string) {
  const rows = await db.$queryRaw<Array<{ mx: bigint | null }>>`
    SELECT max(internal_number::bigint) AS mx
      FROM inventories
     WHERE insider_uuid = ${insiderUuid}::uuid
       AND is_nonbalance = false
       AND internal_number ~ '^[0-9]+$'`;
  return String(Number(rows[0]?.mx ?? 0) + 1).padStart(5, '0');
}

async function findSameName(name: string, dimensionUuid: string, insiderUuid: string) {
  const rows = await prisma.$queryRaw<Array<{ uuid: string; internal_number: string | null; name: string; group_name: string | null }>>`
    SELECT v.uuid::text AS uuid, v.internal_number, v.name, g.name AS group_name
      FROM inventories v
      LEFT JOIN inventory_groups g ON g.uuid = v.inventory_group_uuid
     WHERE v.insider_uuid = ${insiderUuid}::uuid
       AND v.is_active
       AND v.dimension_uuid = ${dimensionUuid}::uuid
       AND waybill_norm_name(v.name) = waybill_norm_name(${name})
     LIMIT 1`;
  return rows[0] ?? null;
}

const parseId = (value: unknown) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const id = parseId(new URL(req.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  try {
    const insider = await getRequiredInsider();
    const item = await loadItem(id, insider.insiderUuid);
    if (!item) return NextResponse.json({ error: 'Waybill item not found' }, { status: 404 });
    if (!item.dimension_uuid) {
      return NextResponse.json(
        { error: `Unit "${item.unit ?? ''}" is not mapped to a dimension. Map it in Unit Text → Dimension Mapping first.` },
        { status: 409 }
      );
    }
    const groups = await prisma.inventory_groups.findMany({
      where: { dimension_uuid: item.dimension_uuid, is_active: true },
      select: { uuid: true, name: true },
      orderBy: { name: 'asc' },
    });
    const defaultGroup = groups.find((g) => g.name.startsWith('დაუხარისხებელი')) ?? groups[0] ?? null;
    const name = (item.goods_name ?? '').trim();
    return NextResponse.json({
      name,
      unit: item.unit,
      dimension_uuid: item.dimension_uuid,
      dimension: item.dimension,
      groups,
      default_group_uuid: defaultGroup?.uuid ?? null,
      next_internal_number: await nextInternalNumber(prisma, insider.insiderUuid),
      existing: name ? await findSameName(name, item.dimension_uuid, insider.insiderUuid) : null,
    });
  } catch (error: any) {
    console.error('[waybill-items/create-inventory] GET error', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const body = await req.json().catch(() => null);
  const id = parseId(body?.id);
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  const groupUuid = typeof body?.inventory_group_uuid === 'string' ? body.inventory_group_uuid : '';
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  if (!name) return NextResponse.json({ error: 'Enter the inventory name' }, { status: 400 });
  if (!groupUuid) return NextResponse.json({ error: 'Choose the inventory group' }, { status: 400 });

  try {
    const insider = await getRequiredInsider();
    const item = await loadItem(id, insider.insiderUuid);
    if (!item) return NextResponse.json({ error: 'Waybill item not found' }, { status: 404 });
    if (!item.dimension_uuid) {
      return NextResponse.json({ error: `Unit "${item.unit ?? ''}" is not mapped to a dimension.` }, { status: 409 });
    }
    const group = await prisma.inventory_groups.findUnique({ where: { uuid: groupUuid }, select: { name: true, dimension_uuid: true, is_active: true } });
    if (!group || !group.is_active || group.dimension_uuid !== item.dimension_uuid) {
      return NextResponse.json({ error: 'The group must be an active group with the item\'s unit' }, { status: 400 });
    }
    const existing = await findSameName(name, item.dimension_uuid, insider.insiderUuid);
    if (existing) {
      return NextResponse.json(
        { error: `An inventory with this name and unit already exists: ${existing.internal_number ?? ''} ${existing.name}. Pick it in the Inventory column.`, existing },
        { status: 409 }
      );
    }

    // The lock keeps two people from taking the same internal number at the same time.
    const created = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('inventories_internal_number'))`;
      const internalNumber = await nextInternalNumber(tx, insider.insiderUuid);
      return tx.inventories.create({
        data: {
          uuid: crypto.randomUUID(),
          insider_uuid: insider.insiderUuid,
          name,
          inventory_group_uuid: groupUuid,
          dimension_uuid: item.dimension_uuid!,
          internal_number: internalNumber,
          is_nonbalance: false,
          is_capex: false,
          is_active: true,
          updated_at: new Date(),
        },
        select: { id: true, uuid: true, internal_number: true, name: true },
      });
    });
    await logAudit({ table: 'inventories', recordId: created.id, action: 'create', changes: { source: 'waybill item', waybill_item_id: id } });

    return NextResponse.json(
      {
        uuid: created.uuid,
        internal_number: created.internal_number,
        name: created.name,
        dimension_uuid: item.dimension_uuid,
        // Same "Internal # | Group | Dimension | Name" label as the Inventory column.
        label: [created.internal_number, group.name, item.dimension, created.name].filter(Boolean).join(' | '),
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[waybill-items/create-inventory] POST error', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
