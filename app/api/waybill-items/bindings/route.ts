import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { getRequiredInsider } from '@/lib/required-insider';
import { requireAuth, isAuthError } from '@/lib/auth-guard';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PATCH /api/waybill-items/bindings  { ids, project_uuid?, financial_code_uuid? }
 * Splits waybills at item level: sets the project and/or financial code of the given items (a field
 * left out is not changed; null clears it). The corresponding account is not accepted: the
 * trg_waybill_items_inherit_waybill trigger sets it from the item's financial code. Setting a project or
 * code on the waybill itself (Waybills page) applies it to all its items again.
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const body = await req.json().catch(() => null);
  const ids = (Array.isArray(body?.ids) ? body.ids : [])
    .map((value: unknown) => Number(value))
    .filter((value: number) => Number.isInteger(value) && value > 0);
  if (ids.length === 0) return NextResponse.json({ error: 'ids must be a non-empty list of item ids' }, { status: 400 });
  if (ids.length > 5000) return NextResponse.json({ error: 'At most 5000 items per request' }, { status: 400 });

  const data: Prisma.rs_waybills_in_itemsUpdateManyMutationInput = {};
  for (const field of ['project_uuid', 'financial_code_uuid'] as const) {
    if (!body || !(field in body)) continue;
    const raw = body[field];
    if (raw === null || raw === '') {
      data[field] = null;
      continue;
    }
    const value = String(raw).trim();
    if (!UUID_RE.test(value)) return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
    data[field] = value;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Give project_uuid and/or financial_code_uuid' }, { status: 400 });
  }

  try {
    if (typeof data.project_uuid === 'string') {
      const found = await prisma.projects.findFirst({ where: { project_uuid: data.project_uuid }, select: { project_uuid: true } });
      if (!found) return NextResponse.json({ error: 'Project not found' }, { status: 400 });
    }
    if (typeof data.financial_code_uuid === 'string') {
      const found = await prisma.financial_codes.findFirst({ where: { uuid: data.financial_code_uuid }, select: { uuid: true } });
      if (!found) return NextResponse.json({ error: 'Financial code not found' }, { status: 400 });
    }

    const insider = await getRequiredInsider();
    const where = { id: { in: ids.map((id: number) => BigInt(id)) }, insider_uuid: insider.insiderUuid };
    const result = await prisma.rs_waybills_in_items.updateMany({ where, data: { ...data, updated_at: new Date() } });

    await logAudit({
      table: 'rs_waybills_in_items',
      recordId: ids[0],
      action: 'update',
      changes: { itemSplit: true, ids, ...data },
    });

    return NextResponse.json({ updated: result.count });
  } catch (error: any) {
    console.error('[waybill-items/bindings] PATCH error', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
