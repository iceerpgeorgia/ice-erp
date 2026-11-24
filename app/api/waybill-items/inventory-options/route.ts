import { NextResponse } from 'next/server';
import { prisma, withRetry } from '@/lib/prisma';
import { getRequiredInsider } from '@/lib/required-insider';
import { requireAuth, isAuthError } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

// Every active inventory of the insider, compact, for the Waybill Items inventory picker.
// The page loads this once in the background and filters by the item's dimension in the browser.
// Rows: [uuid, label, dimension_uuid]; the label matches the Inventory column
// ("Internal # | Group | Dimension | Name").
export async function GET() {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  try {
    const insider = await getRequiredInsider();
    const rows = await withRetry(() =>
      prisma.$queryRaw<Array<{ uuid: string; label: string; dimension_uuid: string | null }>>`
        SELECT v.uuid::text AS uuid,
               concat_ws(' | ', nullif(v.internal_number, ''), nullif(g.name, ''), nullif(d.dimension, ''), v.name) AS label,
               v.dimension_uuid::text AS dimension_uuid
          FROM inventories v
          LEFT JOIN inventory_groups g ON g.uuid = v.inventory_group_uuid
          LEFT JOIN dimensions d ON d.uuid = v.dimension_uuid
         WHERE v.insider_uuid = ${insider.insiderUuid}::uuid
           AND v.is_active
         ORDER BY v.name, v.internal_number
      `
    );
    return NextResponse.json({ data: rows.map((row) => [row.uuid, row.label, row.dimension_uuid]) });
  } catch (error: any) {
    console.error('[waybill-items/inventory-options] GET error', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
