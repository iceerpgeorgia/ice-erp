import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { getRequiredInsider } from '@/lib/required-insider';
import { requireAuth, isAuthError } from '@/lib/auth-guard';

// Declines items' suggested inventory. Like confirming, declining an item also declines every
// identical pending suggestion: same insider, same normalised goods name and same suggested inventory.
// Only unbound rows still in 'suggested' status change: they become 'declined' with no suggestion,
// and get no automatic suggestion afterwards; a person binds them from the Inventory picker.
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const body = await req.json().catch(() => null);
  const rawIds: unknown[] = Array.isArray(body?.ids) ? body.ids : [];
  const ids = rawIds
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids must be a non-empty list of item ids' }, { status: 400 });
  }
  if (ids.length > 5000) {
    return NextResponse.json({ error: 'At most 5000 items per request' }, { status: 400 });
  }

  try {
    const insider = await getRequiredInsider();
    const declined = await prisma.$queryRaw<Array<{ id: bigint; declined_inventory_uuid: string }>>`
      WITH chosen AS (
        SELECT DISTINCT suggested_inventory_uuid, waybill_norm_name(goods_name) AS norm_name
          FROM rs_waybills_in_items
         WHERE id IN (${Prisma.join(ids.map((id) => BigInt(id)))})
           AND insider_uuid = ${insider.insiderUuid}::uuid
           AND inventory_match_status = 'suggested'
           AND inventory_uuid IS NULL
           AND suggested_inventory_uuid IS NOT NULL
      ),
      targets AS (
        SELECT t.id, t.suggested_inventory_uuid
          FROM rs_waybills_in_items t
          JOIN chosen c
            ON t.suggested_inventory_uuid = c.suggested_inventory_uuid
           AND waybill_norm_name(t.goods_name) = c.norm_name
         WHERE t.insider_uuid = ${insider.insiderUuid}::uuid
           AND t.inventory_match_status = 'suggested'
           AND t.inventory_uuid IS NULL
      )
      UPDATE rs_waybills_in_items t
         SET suggested_inventory_uuid = NULL,
             inventory_match_status = 'declined',
             updated_at = now()
        FROM targets x
       WHERE t.id = x.id
      RETURNING t.id, x.suggested_inventory_uuid::text AS declined_inventory_uuid
    `;

    for (const row of declined) {
      await logAudit({
        table: 'rs_waybills_in_items',
        recordId: row.id,
        action: 'update',
        changes: { suggestion_declined: row.declined_inventory_uuid },
      });
    }

    const declinedIds = declined.map((row) => Number(row.id));
    const declinedSet = new Set(declinedIds);
    return NextResponse.json({
      declined: declinedIds,
      // Requested items that were not declined (already bound or no longer suggested).
      skipped: ids.filter((id) => !declinedSet.has(id)).length,
      // Identical items declined along with the requested ones.
      identicalDeclined: declinedIds.filter((id) => !ids.includes(id)).length,
    });
  } catch (error: any) {
    console.error('[waybill-items/decline-suggestion] POST error', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
