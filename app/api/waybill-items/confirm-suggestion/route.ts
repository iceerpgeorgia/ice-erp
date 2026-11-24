import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { getRequiredInsider } from '@/lib/required-insider';
import { requireAuth, isAuthError } from '@/lib/auth-guard';
import { UNIT_MISMATCH_MESSAGE, isUnitMismatchError } from '@/lib/waybills/unit-mismatch';

// Binds items to their suggested inventory. Confirming an item also confirms every identical pending
// suggestion: same insider, same normalised goods name and same suggested inventory.
// Only rows still in 'suggested' status change; the trg_waybill_items_inventory_match trigger then
// marks them 'confirmed' and records the binding time.
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
    const confirmed = await prisma.$queryRaw<Array<{ id: bigint }>>`
      WITH chosen AS (
        SELECT DISTINCT suggested_inventory_uuid, waybill_norm_name(goods_name) AS norm_name
          FROM rs_waybills_in_items
         WHERE id IN (${Prisma.join(ids.map((id) => BigInt(id)))})
           AND insider_uuid = ${insider.insiderUuid}::uuid
           AND inventory_match_status = 'suggested'
           AND inventory_uuid IS NULL
           AND suggested_inventory_uuid IS NOT NULL
      )
      UPDATE rs_waybills_in_items t
         SET inventory_uuid = t.suggested_inventory_uuid,
             updated_at = now()
        FROM chosen c
       WHERE t.insider_uuid = ${insider.insiderUuid}::uuid
         AND t.inventory_match_status = 'suggested'
         AND t.inventory_uuid IS NULL
         AND t.suggested_inventory_uuid = c.suggested_inventory_uuid
         AND waybill_norm_name(t.goods_name) = c.norm_name
      RETURNING t.id
    `;

    for (const row of confirmed) {
      await logAudit({ table: 'rs_waybills_in_items', recordId: row.id, action: 'update' });
    }

    const confirmedIds = confirmed.map((row) => Number(row.id));
    const confirmedSet = new Set(confirmedIds);
    return NextResponse.json({
      confirmed: confirmedIds,
      // Requested items that were not confirmed (already bound or no longer suggested).
      skipped: ids.filter((id) => !confirmedSet.has(id)).length,
      // Identical items confirmed along with the requested ones.
      identicalConfirmed: confirmedIds.filter((id) => !ids.includes(id)).length,
    });
  } catch (error: any) {
    if (isUnitMismatchError(error)) {
      return NextResponse.json({ error: UNIT_MISMATCH_MESSAGE }, { status: 409 });
    }
    console.error('[waybill-items/confirm-suggestion] POST error', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
