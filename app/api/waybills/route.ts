import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const tableExists = async (tableName: string) => {
  const rows = await prisma.$queryRaw<{ regclass: string | null }[]>`
    SELECT to_regclass(${`public.${tableName}`})::text as regclass
  `;
  return Array.isArray(rows) && rows[0]?.regclass !== null;
};

const toNumber = (value: any) => (typeof value === 'bigint' ? Number(value) : value);

const serializeWaybill = (row: any) => ({
  ...row,
  id: toNumber(row.id),
  sum: row.sum?.toString() ?? null,
  transportation_sum: row.transportation_sum?.toString() ?? null,
  transportation_cost: row.transportation_cost?.toString() ?? null,
  activation_time: row.activation_time ? new Date(row.activation_time).toISOString() : null,
  transportation_beginning_time: row.transportation_beginning_time
    ? new Date(row.transportation_beginning_time).toISOString()
    : null,
  submission_time: row.submission_time ? new Date(row.submission_time).toISOString() : null,
  cancellation_time: row.cancellation_time ? new Date(row.cancellation_time).toISOString() : null,
  created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
  updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
});

export async function GET(req: NextRequest) {
  try {
    if (!(await tableExists('rs_waybills_in'))) {
      return NextResponse.json(
        { error: 'Waybills table is not available yet. Please run migrations.' },
        { status: 503 }
      );
    }
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit') || 200), 2000);
    const offset = Math.max(Number(searchParams.get('offset') || 0), 0);
    const search = (searchParams.get('search') || '').trim();

    const where: Prisma.rs_waybills_inWhereInput = search
      ? {
          OR: [
            { waybill_no: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { counteragent: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { counteragent_inn: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { counteragent_name: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { driver: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { driver_id: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { vehicle: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { rs_id: { contains: search, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {};

    const [rows, total] = await Promise.all([
      prisma.rs_waybills_in.findMany({
        where,
        orderBy: [{ activation_time: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.rs_waybills_in.count({ where }),
    ]);

    return NextResponse.json({
      data: rows.map(serializeWaybill),
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('[GET /api/waybills] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch waybills' },
      { status: 500 }
    );
  }
}

const allowedUpdateFields = new Set([
  'project_uuid',
  'financial_code_uuid',
  'corresponding_account',
  'counteragent_uuid',
  'driver_uuid',
  'note',
  'vat_doc_id',
  'stat',
  'transportation_cost',
  'transportation_sum',
  'departure_address',
  'shipping_address',
  'vehicle',
  'state',
  'condition',
  'category',
  'type',
]);

export async function PATCH(req: NextRequest) {
  try {
    if (!(await tableExists('rs_waybills_in'))) {
      return NextResponse.json(
        { error: 'Waybills table is not available yet. Please run migrations.' },
        { status: 503 }
      );
    }
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get('id');
    if (!idParam) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }
    const id = BigInt(Number(idParam));

    const body = await req.json().catch(() => ({}));
    const updates: Record<string, any> = {};

    for (const [key, value] of Object.entries(body || {})) {
      if (!allowedUpdateFields.has(key)) continue;
      if (
        key === 'project_uuid' ||
        key === 'financial_code_uuid' ||
        key === 'counteragent_uuid' ||
        key === 'driver_uuid'
      ) {
        updates[key] = value ? String(value) : null;
        continue;
      }
      if (key === 'transportation_cost' || key === 'transportation_sum') {
        updates[key] = value === null || value === '' ? null : String(value);
        continue;
      }
      updates[key] = value === '' ? null : value;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    updates.updated_at = new Date();

    const updated = await prisma.rs_waybills_in.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({ data: serializeWaybill(updated) });
  } catch (error: any) {
    console.error('[PATCH /api/waybills] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update waybill' },
      { status: 500 }
    );
  }
}
