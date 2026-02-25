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
    const includeFacets = searchParams.get('includeFacets') === 'true';
    const sortColumn = searchParams.get('sortColumn') || '';
    const sortDirection = searchParams.get('sortDirection') === 'asc' ? 'asc' : 'desc';
    const filtersParam = searchParams.get('filters');

    const allowedFilterFields = new Set([
      'waybill_no',
      'state',
      'condition',
      'category',
      'type',
      'counteragent_name',
      'counteragent_inn',
      'vat',
      'driver',
      'vehicle',
      'period',
      'rs_id',
      'shipping_address',
      'departure_address',
      'project_uuid',
      'financial_code_uuid',
      'corresponding_account',
    ]);

    const allowedSortColumns = new Set([
      'waybill_no',
      'state',
      'condition',
      'category',
      'type',
      'counteragent_name',
      'counteragent_inn',
      'vat',
      'sum',
      'driver',
      'vehicle',
      'activation_time',
      'period',
      'rs_id',
      'transportation_sum',
      'transportation_cost',
      'shipping_address',
      'departure_address',
      'project_uuid',
      'financial_code_uuid',
      'corresponding_account',
      'id',
    ]);

    const baseSearch: Prisma.rs_waybills_inWhereInput = search
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

    const filterClauses: Prisma.rs_waybills_inWhereInput[] = [];
    if (filtersParam) {
      try {
        const parsed = JSON.parse(filtersParam);
        const entries: Array<[string, string[]]> = Array.isArray(parsed)
          ? parsed
          : Object.entries(parsed || {});

        const counteragentFilter = entries.find(([key]) => key === 'counteragent_name');
        if (counteragentFilter) {
          const values = Array.isArray(counteragentFilter[1]) ? counteragentFilter[1] : [];
          const cleaned = values.filter((value) => value !== null && value !== undefined && String(value) !== '');
          if (cleaned.length > 0) {
            const counteragents = await prisma.counteragents.findMany({
              where: {
                OR: [
                  { counteragent: { in: cleaned } },
                  { name: { in: cleaned } },
                ],
              },
              select: { counteragent_uuid: true },
            });
            const uuids = counteragents.map((row) => row.counteragent_uuid).filter(Boolean);
            if (uuids.length > 0) {
              filterClauses.push({ counteragent_uuid: { in: uuids } });
            } else {
              filterClauses.push({ counteragent_uuid: { in: ['__none__'] } });
            }
          }
        }

        entries.forEach(([key, values]) => {
          if (!allowedFilterFields.has(key)) return;
          if (key === 'counteragent_name') return;
          const list = Array.isArray(values) ? values : [];
          const cleaned = list.filter((value) => value !== null && value !== undefined && String(value) !== '');
          if (cleaned.length === 0) return;
          if (key === 'vat') {
            const boolValues = cleaned
              .map((value) => String(value).toLowerCase())
              .filter((value) => value === 'true' || value === 'false')
              .map((value) => value === 'true');
            if (boolValues.length === 1) {
              filterClauses.push({ vat: { equals: boolValues[0] } });
            }
            return;
          }
          filterClauses.push({ [key]: { in: cleaned } } as Prisma.rs_waybills_inWhereInput);
        });
      } catch {
        // ignore invalid filters
      }
    }

    const where: Prisma.rs_waybills_inWhereInput = {
      AND: [baseSearch, ...filterClauses],
    };

    const orderBy: Prisma.rs_waybills_inOrderByWithRelationInput[] =
      allowedSortColumns.has(sortColumn)
        ? [
            { [sortColumn]: sortDirection } as Prisma.rs_waybills_inOrderByWithRelationInput,
            { id: Prisma.SortOrder.desc },
          ]
        : [
            { activation_time: Prisma.SortOrder.desc },
            { id: Prisma.SortOrder.desc },
          ];

    const [rows, total] = await Promise.all([
      prisma.rs_waybills_in.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
      }),
      prisma.rs_waybills_in.count({ where }),
    ]);

    const counteragentUuids = Array.from(
      new Set(rows.map((row: any) => row.counteragent_uuid).filter(Boolean))
    );
    const counteragentMap = new Map<string, string>();
    if (counteragentUuids.length > 0) {
      const counteragents = await prisma.counteragents.findMany({
        where: { counteragent_uuid: { in: counteragentUuids } },
        select: { counteragent_uuid: true, counteragent: true, name: true },
      });
      counteragents.forEach((row) => {
        const label = row.counteragent || row.name || '';
        if (row.counteragent_uuid && label) {
          counteragentMap.set(row.counteragent_uuid, label);
        }
      });
    }

    let facets: Record<string, any[]> | undefined;
    if (includeFacets) {
      const facetFields = Array.from(allowedFilterFields);
      const facetResults = await Promise.all(
        facetFields.map(async (field) => {
          if (field === 'counteragent_name') {
            const uuids = await prisma.rs_waybills_in.findMany({
              where,
              distinct: ['counteragent_uuid'],
              select: { counteragent_uuid: true },
            });
            const ids = uuids
              .map((row: any) => row.counteragent_uuid)
              .filter((value: any) => value !== null && value !== undefined);
            if (ids.length === 0) {
              return [field, []] as const;
            }
            const counteragents = await prisma.counteragents.findMany({
              where: { counteragent_uuid: { in: ids } },
              select: { counteragent: true, name: true },
            });
            const values = counteragents
              .map((row) => row.counteragent || row.name)
              .filter((value) => value !== null && value !== undefined && String(value).trim() !== '');
            return [field, values] as const;
          }
          const rows = await prisma.rs_waybills_in.findMany({
            where,
            distinct: [field as any],
            select: { [field]: true } as Prisma.rs_waybills_inSelect,
          });
          const values = rows
            .map((row: any) => row[field])
            .filter((value) => value !== null && value !== undefined && String(value).trim() !== '');
          return [field, values] as const;
        })
      );
      facets = Object.fromEntries(facetResults);
    }

    return NextResponse.json({
      data: rows.map((row: any) => {
        const resolved = counteragentMap.get(row.counteragent_uuid) || row.counteragent_name || row.counteragent;
        return serializeWaybill({
          ...row,
          counteragent_name: resolved,
        });
      }),
      total,
      limit,
      offset,
      facets,
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
