import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getRequiredInsider } from "@/lib/required-insider";
import { requireAuth, isAuthError } from "@/lib/auth-guard";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_FILTER_FIELDS = new Set(['project_uuid', 'financial_code_uuid', 'dimension_uuid', 'inventory_uuid']);
const NON_BLANK_FILTER_TOKEN = '__NON_BLANK__';

const isValidUuid = (value: string) => UUID_REGEX.test(value.trim());

function formatDate(date: string | Date | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function validatePayload(body: any) {
  const errors: Record<string, string> = {};
  const waybill_no = typeof body?.waybill_no === "string" ? body.waybill_no.trim() : null;  const rsId = typeof body?.rs_id === "string" ? body.rs_id.trim() : null;  const goods_code = typeof body?.goods_code === "string" ? body.goods_code.trim() : null;
  const goods_name = typeof body?.goods_name === "string" ? body.goods_name.trim() : null;
  const unit = typeof body?.unit === "string" ? body.unit.trim() : null;
  const quantity = body?.quantity != null && body.quantity !== "" ? Number(body.quantity) : null;
  const unit_price = body?.unit_price != null && body.unit_price !== "" ? Number(body.unit_price) : null;
  const total_price = body?.total_price != null && body.total_price !== "" ? Number(body.total_price) : null;
  const taxation = typeof body?.taxation === "string" ? body.taxation.trim() : null;
  const inventory_uuid = typeof body?.inventory_uuid === "string" && body.inventory_uuid.trim() ? body.inventory_uuid.trim() : null;
  const project_uuid = typeof body?.project_uuid === "string" && body.project_uuid.trim() ? body.project_uuid.trim() : null;
  const financial_code_uuid = typeof body?.financial_code_uuid === "string" && body.financial_code_uuid.trim() ? body.financial_code_uuid.trim() : null;
  const corresponding_account = typeof body?.corresponding_account === "string" ? body.corresponding_account.trim() : null;
  const import_batch_id = typeof body?.import_batch_id === "string" ? body.import_batch_id.trim() : null;

  if (!goods_name) errors.goods_name = "Goods name is required";

  return {
    errors,
    payload: {
      waybill_no, rs_id: rsId, goods_code, goods_name, unit,
      quantity, unit_price, total_price, taxation,
      inventory_uuid, project_uuid, financial_code_uuid,
      corresponding_account, import_batch_id,
    },
  } as const;
}

export async function GET(req: NextRequest) {
  try {
    const insider = await getRequiredInsider();
    const url = new URL(req.url);
    const { searchParams } = url;

    // Parse core parameters
    const limit = Math.min(Number(searchParams.get('limit') || 200), 2000);
    const offset = Math.max(Number(searchParams.get('offset') || 0), 0);
    const search = (searchParams.get('search') || '').trim();
    const sortColumn = searchParams.get('sortColumn') || 'waybill_no';
    const sortDirection = searchParams.get('sortDirection') === 'asc' ? 'asc' : 'desc';
    const filtersParam = searchParams.get('filters');
    const advancedFiltersParam = searchParams.get('advancedFilters');

    const allowedFilterFields = new Set([
      'waybill_no', 'goods_code', 'goods_name', 'unit', 'quantity', 'unit_price', 'total_price',
      'taxation', 'inventory_uuid', 'inventory_name', 'project_uuid', 'financial_code_uuid',
      'corresponding_account', 'import_batch_id', 'dimension_uuid', 'dimension_name', 
      'waybill_state', 'waybill_condition', 'waybill_category', 'waybill_type',
      'waybill_counteragent_name', 'waybill_counteragent_inn', 'waybill_vat', 'waybill_sum',
      'waybill_driver', 'waybill_vehicle', 'waybill_activation_time'
    ]);

    const allowedSortColumns = new Set([
      'waybill_no', 'goods_code', 'goods_name', 'unit', 'quantity', 'unit_price', 'total_price',
      'taxation', 'inventory_name', 'project_uuid', 'financial_code_uuid', 'corresponding_account',
      'dimension_name', 'waybill_activation_time', 'id', 'created_at'
    ]);

    // Build base search
    const baseSearch: Prisma.rs_waybills_in_itemsWhereInput = search
      ? {
          OR: [
            { rs_id: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { waybill_no: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { goods_name: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { goods_code: { contains: search, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {};

    // Parse filter entries
    let parsedFilterEntries: Array<[string, unknown]> = [];
    if (filtersParam) {
      try {
        const parsed = JSON.parse(filtersParam);
        parsedFilterEntries = (Array.isArray(parsed)
          ? parsed
          : Object.entries(parsed || {})) as Array<[string, unknown]>;
      } catch {
        parsedFilterEntries = [];
      }
    }

    // Parse advanced filters
    type ParsedAdvancedFilter = { mode: string; operator: string; value?: string };
    let parsedAdvancedFilters: Array<[string, ParsedAdvancedFilter]> = [];
    if (advancedFiltersParam) {
      try {
        const parsed = JSON.parse(advancedFiltersParam);
        parsedAdvancedFilters = (Array.isArray(parsed) ? parsed : []) as Array<[string, ParsedAdvancedFilter]>;
      } catch {
        parsedAdvancedFilters = [];
      }
    }

    // Build filter clauses
    const buildFilterClauses = async (): Promise<Prisma.rs_waybills_in_itemsWhereInput[]> => {
      const clauses: Prisma.rs_waybills_in_itemsWhereInput[] = [];

      const entries = parsedFilterEntries
        .filter(([key]) => allowedFilterFields.has(key))
        .map(([key, values]) => {
          const list = Array.isArray(values) ? values : [];
          const normalized = list
            .filter((value) => value !== null && value !== undefined)
            .map((value) => String(value));
          const requireNonBlank = normalized.some((value) => value === NON_BLANK_FILTER_TOKEN);
          const includeBlank = normalized.some((value) => value === '');
          const nonBlank = normalized.filter((value) => value !== '' && value !== NON_BLANK_FILTER_TOKEN);
          return [key, { nonBlank, includeBlank, requireNonBlank }] as const;
        })
        .filter(
          ([key, value]) => value.nonBlank.length > 0 || value.includeBlank || value.requireNonBlank
        );

      // Handle waybill state filters (these come from waybill table joins)
      const waybillStateFilters = entries.filter(([key]) => key.startsWith('waybill_'));
      const itemFilters = entries.filter(([key]) => !key.startsWith('waybill_'));

      // Process waybill filters
      waybillStateFilters.forEach(([key, value]) => {
        const { nonBlank, includeBlank, requireNonBlank } = value;
        const fieldName = key.replace('waybill_', '');

        if (requireNonBlank && nonBlank.length === 0 && !includeBlank) {
          if (fieldName === 'vat') return;
          clauses.push({
            AND: [
              { waybill: { [fieldName]: { not: null } } } as Prisma.rs_waybills_in_itemsWhereInput,
              { waybill: { [fieldName]: { not: '' } } } as Prisma.rs_waybills_in_itemsWhereInput,
            ],
          });
          return;
        }

        if (fieldName === 'vat') {
          const boolValues = nonBlank
            .map((v) => v.toLowerCase())
            .filter((v) => v === 'true' || v === 'false')
            .map((v) => v === 'true');
          if (boolValues.length === 1) {
            clauses.push({ waybill: { vat: { equals: boolValues[0] } } } as Prisma.rs_waybills_in_itemsWhereInput);
          }
          return;
        }

        if (fieldName === 'counteragent_name' || fieldName === 'counteragent_inn') {
          if (nonBlank.length > 0 && includeBlank) {
            clauses.push({ OR: [{ waybill: { [fieldName]: { in: nonBlank } } }, { waybill: { [fieldName]: null } }] } as Prisma.rs_waybills_in_itemsWhereInput);
          } else if (nonBlank.length > 0) {
            clauses.push({ waybill: { [fieldName]: { in: nonBlank } } } as Prisma.rs_waybills_in_itemsWhereInput);
          } else if (includeBlank) {
            clauses.push({ waybill: { [fieldName]: null } } as Prisma.rs_waybills_in_itemsWhereInput);
          }
          return;
        }

        // Generic string field
        if (nonBlank.length > 0 && includeBlank) {
          clauses.push({ OR: [{ waybill: { [fieldName]: { in: nonBlank } } }, { waybill: { [fieldName]: null } }] } as Prisma.rs_waybills_in_itemsWhereInput);
        } else if (nonBlank.length > 0) {
          clauses.push({ waybill: { [fieldName]: { in: nonBlank } } } as Prisma.rs_waybills_in_itemsWhereInput);
        } else if (includeBlank) {
          clauses.push({ waybill: { [fieldName]: null } } as Prisma.rs_waybills_in_itemsWhereInput);
        }
      });

      // Process item-level filters
      itemFilters.forEach(([key, value]) => {
        const { nonBlank, includeBlank, requireNonBlank } = value;

        if (requireNonBlank && nonBlank.length === 0 && !includeBlank) {
          if (UUID_FILTER_FIELDS.has(key)) {
            clauses.push({ [key]: { not: null } } as Prisma.rs_waybills_in_itemsWhereInput);
            return;
          }
          clauses.push({
            AND: [
              { [key]: { not: null } } as Prisma.rs_waybills_in_itemsWhereInput,
              { [key]: { not: '' } } as Prisma.rs_waybills_in_itemsWhereInput,
            ],
          });
          return;
        }

        if (UUID_FILTER_FIELDS.has(key)) {
          const uuidValues = nonBlank.filter((item) => isValidUuid(item));
          if (uuidValues.length > 0 && includeBlank) {
            clauses.push({ OR: [{ [key]: { in: uuidValues } }, { [key]: null }] } as Prisma.rs_waybills_in_itemsWhereInput);
          } else if (uuidValues.length > 0) {
            clauses.push({ [key]: { in: uuidValues } } as Prisma.rs_waybills_in_itemsWhereInput);
          } else if (includeBlank) {
            clauses.push({ [key]: null } as Prisma.rs_waybills_in_itemsWhereInput);
          }
          return;
        }

        // Generic string field
        if (nonBlank.length > 0 && includeBlank) {
          clauses.push({ OR: [{ [key]: { in: nonBlank } }, { [key]: null }] } as Prisma.rs_waybills_in_itemsWhereInput);
        } else if (nonBlank.length > 0) {
          clauses.push({ [key]: { in: nonBlank } } as Prisma.rs_waybills_in_itemsWhereInput);
        } else if (includeBlank) {
          clauses.push({ [key]: null } as Prisma.rs_waybills_in_itemsWhereInput);
        }
      });

      // Handle advanced text filters
      parsedAdvancedFilters.forEach(([key, filter]) => {
        if (!allowedFilterFields.has(key)) return;
        const val = String(filter.value || '').trim();
        if (!val) return;
        const op = filter.operator || 'contains';

        const prismaOp: Prisma.StringFilter = (() => {
          switch (op) {
            case 'contains':    return { contains: val, mode: Prisma.QueryMode.insensitive };
            case 'notContains': return { not: { contains: val, mode: Prisma.QueryMode.insensitive } };
            case 'equals':      return { equals: val, mode: Prisma.QueryMode.insensitive };
            case 'notEquals':   return { not: { equals: val, mode: Prisma.QueryMode.insensitive } };
            case 'startsWith':  return { startsWith: val, mode: Prisma.QueryMode.insensitive };
            case 'endsWith':    return { endsWith: val, mode: Prisma.QueryMode.insensitive };
            default:            return { contains: val, mode: Prisma.QueryMode.insensitive };
          }
        })();

        if (key.startsWith('waybill_')) {
          const fieldName = key.replace('waybill_', '');
          clauses.push({ waybill: { [fieldName]: prismaOp } } as Prisma.rs_waybills_in_itemsWhereInput);
        } else {
          clauses.push({ [key]: prismaOp } as Prisma.rs_waybills_in_itemsWhereInput);
        }
      });

      return clauses;
    };

    const filterClauses = await buildFilterClauses();

    // Build WHERE clause - only use AND if there are actual conditions
    const conditions: Prisma.rs_waybills_in_itemsWhereInput[] = [];
    if (Object.keys(baseSearch).length > 0) conditions.push(baseSearch);
    if (filterClauses.length > 0) conditions.push(...filterClauses);

    const where: Prisma.rs_waybills_in_itemsWhereInput = 
      conditions.length > 0 
        ? { AND: conditions }
        : {};

    // Build order by
    const orderBy: any = {};
    if (allowedSortColumns.has(sortColumn)) {
      if (sortColumn.startsWith('waybill_')) {
        const fieldName = sortColumn.replace('waybill_', '');
        orderBy['waybill'] = { [fieldName]: sortDirection };
      } else if (sortColumn === 'inventory_name') {
        orderBy['inventory'] = { name: sortDirection };
      } else if (sortColumn === 'dimension_name') {
        orderBy['dimension'] = { dimension: sortDirection };
      } else {
        orderBy[sortColumn] = sortDirection;
      }
    } else {
      orderBy['waybill_no'] = 'asc';
      orderBy['id'] = 'asc';
    }

    const [rows, total] = await Promise.all([
      prisma.rs_waybills_in_items.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        include: { 
          inventory: { select: { name: true } }, 
          dimension: { select: { dimension: true } },
          waybill: {
            select: {
              rs_id: true,
              waybill_no: true,
              state: true,
              condition: true,
              category: true,
              type: true,
              counteragent_uuid: true,
              counteragent_name: true,
              counteragent_inn: true,
              vat: true,
              sum: true,
              driver: true,
              vehicle: true,
              activation_time: true,
              transportation_sum: true,
              transportation_cost: true,
              shipping_address: true,
              departure_address: true,
            }
          }
        },
      }),
      prisma.rs_waybills_in_items.count({ where }),
    ]);

    const data = rows.map((row) => ({
      // Item fields
      id: Number(row.id),
      uuid: row.uuid,
      rs_id: row.rs_id,
      waybill_no: row.waybill_no,
      goods_code: row.goods_code,
      goods_name: row.goods_name,
      unit: row.unit,
      dimension_uuid: row.dimension_uuid,
      dimension_name: row.dimension?.dimension ?? null,
      quantity: row.quantity ? Number(row.quantity) : null,
      unit_price: row.unit_price ? Number(row.unit_price) : null,
      total_price: row.total_price ? Number(row.total_price) : null,
      taxation: row.taxation,
      inventory_uuid: row.inventory_uuid,
      inventory_name: row.inventory?.name ?? "",
      project_uuid: row.project_uuid,
      financial_code_uuid: row.financial_code_uuid,
      corresponding_account: row.corresponding_account,
      import_batch_id: row.import_batch_id,
      createdAt: formatDate(row.created_at),
      updatedAt: formatDate(row.updated_at),
      insider_uuid: (row as any).insider_uuid ?? insider.insiderUuid,
      insider_name: insider.insiderName,
      // Waybill header fields (appendable)
      waybill_state: row.waybill?.state ?? null,
      waybill_condition: row.waybill?.condition ?? null,
      waybill_category: row.waybill?.category ?? null,
      waybill_type: row.waybill?.type ?? null,
      waybill_counteragent_uuid: row.waybill?.counteragent_uuid ?? null,
      waybill_counteragent_name: row.waybill?.counteragent_name ?? null,
      waybill_counteragent_inn: row.waybill?.counteragent_inn ?? null,
      waybill_vat: row.waybill?.vat ?? null,
      waybill_sum: row.waybill?.sum ? row.waybill.sum.toString() : null,
      waybill_driver: row.waybill?.driver ?? null,
      waybill_vehicle: row.waybill?.vehicle ?? null,
      waybill_activation_time: row.waybill?.activation_time ? new Date(row.waybill.activation_time).toISOString() : null,
      waybill_transportation_sum: row.waybill?.transportation_sum ? row.waybill.transportation_sum.toString() : null,
      waybill_transportation_cost: row.waybill?.transportation_cost ? row.waybill.transportation_cost.toString() : null,
      waybill_shipping_address: row.waybill?.shipping_address ?? null,
      waybill_departure_address: row.waybill?.departure_address ?? null,
    }));

    return NextResponse.json({ data, total });
  } catch (error: any) {
    console.error("[waybill-items] GET error", error);
    return NextResponse.json({ error: error?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  try {
    const insider = await getRequiredInsider();
    const body = await req.json().catch(() => ({}));
    const { errors, payload } = validatePayload(body);

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 });
    }

    const created = await prisma.rs_waybills_in_items.create({
      data: {
        uuid: crypto.randomUUID(),
        insider_uuid: insider.insiderUuid,
        waybill_no: payload.waybill_no,
        rs_id: payload.rs_id,
        goods_code: payload.goods_code,
        goods_name: payload.goods_name!,
        unit: payload.unit,
        quantity: payload.quantity,
        unit_price: payload.unit_price,
        total_price: payload.total_price,
        taxation: payload.taxation,
        inventory_uuid: payload.inventory_uuid,
        project_uuid: payload.project_uuid,
        financial_code_uuid: payload.financial_code_uuid,
        corresponding_account: payload.corresponding_account,
        import_batch_id: payload.import_batch_id,
        updated_at: new Date(),
      },
      include: { 
        inventory: { select: { name: true } },
        waybill: {
          select: {
            rs_id: true,
            waybill_no: true,
            state: true,
            condition: true,
            category: true,
            type: true,
            counteragent_uuid: true,
            counteragent_name: true,
            counteragent_inn: true,
            vat: true,
            sum: true,
            driver: true,
            vehicle: true,
            activation_time: true,
            transportation_sum: true,
            transportation_cost: true,
            shipping_address: true,
            departure_address: true,
          }
        }
      },
    });

    await logAudit({ table: "rs_waybills_in_items", recordId: created.id, action: "create" });

    return NextResponse.json(
      {
        id: Number(created.id),
        uuid: created.uuid,
        rs_id: created.rs_id,
        waybill_no: created.waybill_no,
        goods_code: created.goods_code,
        goods_name: created.goods_name,
        unit: created.unit,
        quantity: created.quantity ? Number(created.quantity) : null,
        unit_price: created.unit_price ? Number(created.unit_price) : null,
        total_price: created.total_price ? Number(created.total_price) : null,
        taxation: created.taxation,
        inventory_uuid: created.inventory_uuid,
        inventory_name: created.inventory?.name ?? "",
        project_uuid: created.project_uuid,
        financial_code_uuid: created.financial_code_uuid,
        corresponding_account: created.corresponding_account,
        import_batch_id: created.import_batch_id,
        createdAt: formatDate(created.created_at),
        updatedAt: formatDate(created.updated_at),
        insider_uuid: (created as any).insider_uuid ?? insider.insiderUuid,
        insider_name: insider.insiderName,
        // Waybill header fields
        waybill_state: created.waybill?.state ?? null,
        waybill_condition: created.waybill?.condition ?? null,
        waybill_category: created.waybill?.category ?? null,
        waybill_type: created.waybill?.type ?? null,
        waybill_counteragent_uuid: created.waybill?.counteragent_uuid ?? null,
        waybill_counteragent_name: created.waybill?.counteragent_name ?? null,
        waybill_counteragent_inn: created.waybill?.counteragent_inn ?? null,
        waybill_vat: created.waybill?.vat ?? null,
        waybill_sum: created.waybill?.sum ? created.waybill.sum.toString() : null,
        waybill_driver: created.waybill?.driver ?? null,
        waybill_vehicle: created.waybill?.vehicle ?? null,
        waybill_activation_time: created.waybill?.activation_time ? new Date(created.waybill.activation_time).toISOString() : null,
        waybill_transportation_sum: created.waybill?.transportation_sum ? created.waybill.transportation_sum.toString() : null,
        waybill_transportation_cost: created.waybill?.transportation_cost ? created.waybill.transportation_cost.toString() : null,
        waybill_shipping_address: created.waybill?.shipping_address ?? null,
        waybill_departure_address: created.waybill?.departure_address ?? null,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[waybill-items] POST error", error);
    return NextResponse.json({ error: error?.message || "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  try {
    const insider = await getRequiredInsider();
    const idParam = new URL(req.url).searchParams.get("id");
    if (!idParam) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const pk = BigInt(Number(idParam));

    const body = await req.json().catch(() => ({} as any));
    const { errors, payload } = validatePayload(body);
    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 });
    }

    const existing = await prisma.rs_waybills_in_items.findUnique({ where: { id: pk } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.rs_waybills_in_items.update({
      where: { id: pk },
      data: {
        waybill_no: payload.waybill_no,
        rs_id: payload.rs_id,
        goods_code: payload.goods_code,
        goods_name: payload.goods_name!,
        unit: payload.unit,
        quantity: payload.quantity,
        unit_price: payload.unit_price,
        total_price: payload.total_price,
        taxation: payload.taxation,
        inventory_uuid: payload.inventory_uuid,
        project_uuid: payload.project_uuid,
        financial_code_uuid: payload.financial_code_uuid,
        corresponding_account: payload.corresponding_account,
        import_batch_id: payload.import_batch_id,
        updated_at: new Date(),
      },
      include: { 
        inventory: { select: { name: true } },
        waybill: {
          select: {
            rs_id: true,
            waybill_no: true,
            state: true,
            condition: true,
            category: true,
            type: true,
            counteragent_uuid: true,
            counteragent_name: true,
            counteragent_inn: true,
            vat: true,
            sum: true,
            driver: true,
            vehicle: true,
            activation_time: true,
            transportation_sum: true,
            transportation_cost: true,
            shipping_address: true,
            departure_address: true,
          }
        }
      },
    });

    await logAudit({ table: "rs_waybills_in_items", recordId: pk, action: "update" });

    return NextResponse.json({
      id: Number(updated.id),
      uuid: updated.uuid,
      rs_id: updated.rs_id,
      waybill_no: updated.waybill_no,
      goods_code: updated.goods_code,
      goods_name: updated.goods_name,
      unit: updated.unit,
      quantity: updated.quantity ? Number(updated.quantity) : null,
      unit_price: updated.unit_price ? Number(updated.unit_price) : null,
      total_price: updated.total_price ? Number(updated.total_price) : null,
      taxation: updated.taxation,
      inventory_uuid: updated.inventory_uuid,
      inventory_name: updated.inventory?.name ?? "",
      project_uuid: updated.project_uuid,
      financial_code_uuid: updated.financial_code_uuid,
      corresponding_account: updated.corresponding_account,
      import_batch_id: updated.import_batch_id,
      createdAt: formatDate(updated.created_at),
      updatedAt: formatDate(updated.updated_at),
      insider_uuid: (updated as any).insider_uuid ?? insider.insiderUuid,
      insider_name: insider.insiderName,
      // Waybill header fields
      waybill_state: updated.waybill?.state ?? null,
      waybill_condition: updated.waybill?.condition ?? null,
      waybill_category: updated.waybill?.category ?? null,
      waybill_type: updated.waybill?.type ?? null,
      waybill_counteragent_uuid: updated.waybill?.counteragent_uuid ?? null,
      waybill_counteragent_name: updated.waybill?.counteragent_name ?? null,
      waybill_counteragent_inn: updated.waybill?.counteragent_inn ?? null,
      waybill_vat: updated.waybill?.vat ?? null,
      waybill_sum: updated.waybill?.sum ? updated.waybill.sum.toString() : null,
      waybill_driver: updated.waybill?.driver ?? null,
      waybill_vehicle: updated.waybill?.vehicle ?? null,
      waybill_activation_time: updated.waybill?.activation_time ? new Date(updated.waybill.activation_time).toISOString() : null,
      waybill_transportation_sum: updated.waybill?.transportation_sum ? updated.waybill.transportation_sum.toString() : null,
      waybill_transportation_cost: updated.waybill?.transportation_cost ? updated.waybill.transportation_cost.toString() : null,
      waybill_shipping_address: updated.waybill?.shipping_address ?? null,
      waybill_departure_address: updated.waybill?.departure_address ?? null,
    });
  } catch (e: any) {
    console.error("[waybill-items] PATCH error", e);
    return NextResponse.json({ error: e.message ?? "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  try {
    const idParam = new URL(req.url).searchParams.get("id");
    if (!idParam) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const pk = BigInt(Number(idParam));

    await prisma.rs_waybills_in_items.delete({ where: { id: pk } });
    await logAudit({ table: "rs_waybills_in_items", recordId: pk, action: "delete" });

    return NextResponse.json({ id: Number(idParam) });
  } catch (error: any) {
    console.error("[waybill-items] DELETE error", error);
    return NextResponse.json({ error: error?.message || "Server error" }, { status: 500 });
  }
}
