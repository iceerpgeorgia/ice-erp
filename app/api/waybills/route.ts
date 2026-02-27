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

const formatDate = (value: Date) => {
  const day = String(value.getUTCDate()).padStart(2, '0');
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const year = String(value.getUTCFullYear());
  return `${day}.${month}.${year}`;
};

const serializeWaybill = (row: any) => ({
  ...row,
  id: toNumber(row.id),
  sum: row.sum?.toString() ?? null,
  transportation_sum: row.transportation_sum?.toString() ?? null,
  transportation_cost: row.transportation_cost?.toString() ?? null,
  activation_time: row.activation_time ? new Date(row.activation_time).toISOString() : null,
  date: row.activation_time ? formatDate(new Date(row.activation_time)) : null,
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
    const missingCounteragents = searchParams.get('missingCounteragents') === 'true';
    const exportAll = searchParams.get('exportAll') === 'true';

    const allowedFilterFields = new Set([
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
      'date',
      'period',
      'rs_id',
      'transportation_sum',
      'transportation_cost',
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
      'date',
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

    let parsedFilterEntries: Array<[string, any[]]> = [];
    if (filtersParam) {
      try {
        const parsed = JSON.parse(filtersParam);
        parsedFilterEntries = (Array.isArray(parsed)
          ? parsed
          : Object.entries(parsed || {})) as Array<[string, any[]]>;
      } catch {
        parsedFilterEntries = [];
      }
    }

    const buildFilterClauses = async (
      excludeColumnKey?: string
    ): Promise<Prisma.rs_waybills_inWhereInput[]> => {
      const clauses: Prisma.rs_waybills_inWhereInput[] = [];

      const entries = parsedFilterEntries
        .filter(([key]) => allowedFilterFields.has(key))
        .map(([key, values]) => {
          const list = Array.isArray(values) ? values : [];
          const normalized = list
            .filter((value) => value !== null && value !== undefined)
            .map((value) => String(value));
          const includeBlank = normalized.some((value) => value === '');
          const nonBlank = normalized.filter((value) => value !== '');
          return [key, { nonBlank, includeBlank }] as const;
        })
        .filter(
          ([key, value]) => key !== excludeColumnKey && (value.nonBlank.length > 0 || value.includeBlank)
        );

      const counteragentFilter = entries.find(([key]) => key === 'counteragent_name');
      if (counteragentFilter) {
        const { nonBlank, includeBlank } = counteragentFilter[1];
        let uuids: string[] = [];
        if (nonBlank.length > 0) {
          const counteragents = await prisma.counteragents.findMany({
            where: {
              OR: [
                { counteragent: { in: nonBlank } },
                { name: { in: nonBlank } },
              ],
            },
            select: { counteragent_uuid: true },
          });
          uuids = counteragents.map((row) => row.counteragent_uuid).filter(Boolean);
        }

        if (uuids.length > 0 && includeBlank) {
          clauses.push({ OR: [{ counteragent_uuid: { in: uuids } }, { counteragent_uuid: null }] });
        } else if (uuids.length > 0) {
          clauses.push({ counteragent_uuid: { in: uuids } });
        } else if (includeBlank) {
          clauses.push({ counteragent_uuid: null });
        } else {
          clauses.push({ counteragent_uuid: { in: ['__none__'] } });
        }
      }

      entries.forEach(([key, value]) => {
        if (key === 'counteragent_name') return;
        const { nonBlank, includeBlank } = value;

        if (key === 'vat') {
          const boolValues = nonBlank
            .map((value) => value.toLowerCase())
            .filter((value) => value === 'true' || value === 'false')
            .map((value) => value === 'true');
          if (boolValues.length === 1) {
            clauses.push({ vat: { equals: boolValues[0] } });
          }
          return;
        }

        if (key === 'date') {
          const ranges = nonBlank
            .map((value) => value.trim())
            .map((value) => {
              const parts = value.split('.');
              if (parts.length !== 3) return null;
              const [day, month, year] = parts;
              const start = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
              if (Number.isNaN(start.getTime())) return null;
              const end = new Date(start);
              end.setUTCDate(start.getUTCDate() + 1);
              return { start, end };
            })
            .filter((range): range is { start: Date; end: Date } => Boolean(range));
          if (ranges.length > 0) {
            const dateOr: Prisma.rs_waybills_inWhereInput[] = ranges.map((range) => ({
              activation_time: {
                gte: range.start,
                lt: range.end,
              },
            }));
            if (includeBlank) {
              dateOr.push({ activation_time: null });
            }
            clauses.push({ OR: dateOr });
          } else if (includeBlank) {
            clauses.push({ activation_time: null });
          }
          return;
        }

        if (key === 'activation_time') {
          const dates = nonBlank
            .map((value) => new Date(value))
            .filter((date) => !Number.isNaN(date.getTime()));
          if (dates.length > 0 && includeBlank) {
            clauses.push({ OR: [{ activation_time: { in: dates } }, { activation_time: null }] });
          } else if (dates.length > 0) {
            clauses.push({ activation_time: { in: dates } });
          } else if (includeBlank) {
            clauses.push({ activation_time: null });
          }
          return;
        }

        if (['sum', 'transportation_sum', 'transportation_cost'].includes(key)) {
          const numbers = nonBlank.map((value) => Number(value)).filter((value) => !Number.isNaN(value));
          if (numbers.length > 0 && includeBlank) {
            clauses.push({ OR: [{ [key]: { in: numbers } }, { [key]: null }] } as Prisma.rs_waybills_inWhereInput);
          } else if (numbers.length > 0) {
            clauses.push({ [key]: { in: numbers } } as Prisma.rs_waybills_inWhereInput);
          } else if (includeBlank) {
            clauses.push({ [key]: null } as Prisma.rs_waybills_inWhereInput);
          }
          return;
        }

        if (nonBlank.length > 0 && includeBlank) {
          clauses.push({
            OR: [
              { [key]: { in: nonBlank } } as Prisma.rs_waybills_inWhereInput,
              { [key]: null } as Prisma.rs_waybills_inWhereInput,
              { [key]: '' } as Prisma.rs_waybills_inWhereInput,
            ],
          });
          return;
        }
        if (nonBlank.length > 0) {
          clauses.push({ [key]: { in: nonBlank } } as Prisma.rs_waybills_inWhereInput);
          return;
        }
        if (includeBlank) {
          clauses.push({ OR: [{ [key]: null } as Prisma.rs_waybills_inWhereInput, { [key]: '' } as Prisma.rs_waybills_inWhereInput] });
        }
      });

      return clauses;
    };

    const buildWhere = async (excludeColumnKey?: string): Promise<Prisma.rs_waybills_inWhereInput> => {
      const filterClauses = await buildFilterClauses(excludeColumnKey);
      return {
        AND: [
          baseSearch,
          ...filterClauses,
          ...(missingCounteragents
            ? [
                { counteragent_uuid: null },
                { counteragent_inn: { not: null } },
                { counteragent_inn: { not: '' } },
              ]
            : []),
        ],
      };
    };

    const filterClauses = await buildFilterClauses();

    const where: Prisma.rs_waybills_inWhereInput = await buildWhere();

    const missingCounteragentWhere: Prisma.rs_waybills_inWhereInput = {
      AND: [
        baseSearch,
        ...filterClauses,
        { counteragent_uuid: null },
        { counteragent_inn: { not: null } },
        { counteragent_inn: { not: '' } },
      ],
    };

    const orderBy: Prisma.rs_waybills_inOrderByWithRelationInput[] =
      allowedSortColumns.has(sortColumn)
        ? [
            sortColumn === 'date'
              ? ({ activation_time: sortDirection } as Prisma.rs_waybills_inOrderByWithRelationInput)
              : ({ [sortColumn]: sortDirection } as Prisma.rs_waybills_inOrderByWithRelationInput),
            { id: Prisma.SortOrder.desc },
          ]
        : [
            { activation_time: Prisma.SortOrder.desc },
            { id: Prisma.SortOrder.desc },
          ];

    const [rows, total, missingCounteragentCount] = await Promise.all([
      prisma.rs_waybills_in.findMany({
        where,
        orderBy,
        ...(exportAll ? {} : { take: limit, skip: offset }),
      }),
      prisma.rs_waybills_in.count({ where }),
      prisma.rs_waybills_in.count({ where: missingCounteragentWhere }),
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
          const facetWhere = await buildWhere(field);
          if (field === 'counteragent_name') {
            const uuids = await prisma.rs_waybills_in.findMany({
              where: facetWhere,
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
            const includeBlank = uuids.some((row: any) => row.counteragent_uuid === null);
            if (includeBlank) values.unshift('');
            return [field, Array.from(new Set(values))] as const;
          }
          if (field === 'date') {
            const rows = await prisma.rs_waybills_in.findMany({
              where: facetWhere,
              distinct: ['activation_time'],
              select: { activation_time: true },
            });
            const values = rows
              .map((row: any) => row.activation_time)
              .map((value) => (value ? formatDate(new Date(value)) : ''));
            return [field, Array.from(new Set(values))] as const;
          }
          const rows = await prisma.rs_waybills_in.findMany({
            where: facetWhere,
            distinct: [field as any],
            select: { [field]: true } as Prisma.rs_waybills_inSelect,
          });
          const values = rows
            .map((row: any) => row[field])
            .map((value) => (value === null || value === undefined ? '' : value));
          return [field, Array.from(new Set(values))] as const;
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
      missingCounteragentCount,
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
