import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { getRequiredInsider } from '@/lib/required-insider';
import { requireAuth, isAuthError } from '@/lib/auth-guard';

// Binds items to their suggested inventory. Only rows still in 'suggested' status change;
// the trg_waybill_items_inventory_match trigger then marks them 'confirmed' and records the binding time.
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
      UPDATE rs_waybills_in_items
         SET inventory_uuid = suggested_inventory_uuid,
             updated_at = now()
       WHERE id IN (${Prisma.join(ids.map((id) => BigInt(id)))})
         AND insider_uuid = ${insider.insiderUuid}::uuid
         AND inventory_match_status = 'suggested'
         AND inventory_uuid IS NULL
         AND suggested_inventory_uuid IS NOT NULL
      RETURNING id
    `;

    for (const row of confirmed) {
      await logAudit({ table: 'rs_waybills_in_items', recordId: row.id, action: 'update' });
    }

    return NextResponse.json({
      confirmed: confirmed.map((row) => Number(row.id)),
      skipped: ids.length - confirmed.length,
    });
  } catch (error: any) {
    console.error('[waybill-items/confirm-suggestion] POST error', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
