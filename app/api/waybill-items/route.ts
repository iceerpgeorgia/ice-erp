import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma, withRetry } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getRequiredInsider } from "@/lib/required-insider";
import { requireAuth, isAuthError } from "@/lib/auth-guard";
import { formatActivationDate, parseActivationDateRange } from '@/lib/waybills/activation-date';
import { UNIT_MISMATCH_MESSAGE, isUnitMismatchError } from '@/lib/waybills/unit-mismatch';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_FILTER_FIELDS = new Set(['project_uuid', 'financial_code_uuid', 'dimension_uuid', 'inventory_uuid']);
const NON_BLANK_FILTER_TOKEN = '__NON_BLANK__';
// Columns shown as inventory labels and the UUID column each one filters on.
const INVENTORY_LABEL_COLUMNS: Record<string, 'inventory_uuid' | 'suggested_inventory_uuid'> = {
  inventory_name: 'inventory_uuid',
  suggested_inventory_name: 'suggested_inventory_uuid',
};

// Waybill header columns (waybill_<field> = rs_waybills_in_api.<field>): every column of the Waybills
// page is available on Waybill Items. waybill_check and waybill_activation_date are derived.
const WAYBILL_COLUMNS = [
  'state', 'condition', 'category', 'type', 'counteragent_name', 'counteragent_inn', 'vat', 'sum',
  'driver', 'vehicle', 'transportation_sum', 'transportation_cost', 'departure_address', 'shipping_address',
  'activation_time', 'transportation_beginning_time', 'submission_time', 'cancellation_time', 'note',
  'period', 'project_uuid', 'financial_code_uuid', 'corresponding_account',
].map((field) => `waybill_${field}`);
const EXTRA_WAYBILL_COLUMNS = [...WAYBILL_COLUMNS, 'waybill_check'];
const SORTABLE_WAYBILL_COLUMNS = WAYBILL_COLUMNS;
const WAYBILL_UUID_FIELDS = new Set(['project_uuid', 'financial_code_uuid']);
// Not text: "not blank" is only "not null", and text operators (contains…) do not apply.
const NON_TEXT_WAYBILL_FIELDS = new Set([
  'vat', 'sum', 'transportation_sum', 'transportation_cost', 'activation_time',
  'transportation_beginning_time', 'submission_time', 'cancellation_time', 'project_uuid', 'financial_code_uuid',
]);
const WAYBILL_CHECKED: Prisma.rs_waybills_in_apiWhereInput = {
  OR: [
    { project_uuid: { not: null } },
    { financial_code_uuid: { not: null } },
    { AND: [{ corresponding_account: { not: null } }, { corresponding_account: { not: '' } }] },
  ],
};
const WAYBILL_UNCHECKED: Prisma.rs_waybills_in_apiWhereInput = {
  project_uuid: null,
  financial_code_uuid: null,
  OR: [{ corresponding_account: null }, { corresponding_account: '' }],
};

const isValidUuid = (value: string) => UUID_REGEX.test(value.trim());

const formatInventoryLabel = (inventory: any) =>
  [
    inventory?.internal_number,
    inventory?.inventory_group?.name,
    inventory?.dimension?.dimension,
    inventory?.name,
  ]
    .filter(Boolean)
    .map(String)
    .join(' | ');

// Same month-boundary parsing as /api/waybills so both pages share one date filter.
const parseMonthBoundary = (value: string | null, mode: 'start' | 'endExclusive') => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}$/.test(trimmed)) return null;
  const [yearStr, monthStr] = trimmed.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  if (mode === 'start') {
    return new Date(Date.UTC(year, month - 1, 1));
  }
  return new Date(Date.UTC(year, month, 1));
};

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
    const limit = Math.min(Number(searchParams.get('limit') || 200), 50000);
    const offset = Math.max(Number(searchParams.get('offset') || 0), 0);
    const search = (searchParams.get('search') || '').trim();
    const sortColumn = searchParams.get('sortColumn') || 'waybill_no';
    const sortDirection = searchParams.get('sortDirection') === 'asc' ? 'asc' : 'desc';
    const filtersParam = searchParams.get('filters');
    const advancedFiltersParam = searchParams.get('advancedFilters');
    const includeFacets = searchParams.get('includeFacets') === 'true';
    const facetField = searchParams.get('facetField') || '';
    const facetOnly = searchParams.get('facetOnly') === 'true';
    const countOnly = searchParams.get('countOnly') === 'true';
    const skipCount = searchParams.get('skipCount') === 'true';
    const facetSearch = (searchParams.get('facetSearch') || '').trim();
    const facetLimit = Math.min(
      Math.max(Number(searchParams.get('facetLimit') || 250), 1),
      50000
    );

    const allowedFilterFields = new Set([
      'waybill_no', 'goods_code', 'goods_name', 'unit', 'quantity', 'unit_price', 'total_price',
      'taxation', 'inventory_uuid', 'inventory_name', 'project_uuid', 'financial_code_uuid',
      'corresponding_account', 'import_batch_id', 'dimension_uuid', 'dimension_name', 
      'waybill_state', 'waybill_condition', 'waybill_category', 'waybill_type',
      'waybill_counteragent_name', 'waybill_counteragent_inn', 'waybill_vat', 'waybill_sum',
      'waybill_driver', 'waybill_vehicle', 'waybill_activation_time', 'waybill_activation_date',
      'inventory_match_status', 'inventory_match_method', 'suggested_inventory_name',
      'rs_id', ...EXTRA_WAYBILL_COLUMNS,
    ]);

    const allowedSortColumns = new Set([
      'waybill_no', 'goods_code', 'goods_name', 'unit', 'quantity', 'unit_price', 'total_price',
      'taxation', 'inventory_name', 'project_uuid', 'financial_code_uuid', 'corresponding_account',
      'dimension_name', 'waybill_activation_time', 'waybill_activation_date', 'id', 'created_at',
      'rs_id', ...SORTABLE_WAYBILL_COLUMNS,
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
    // excludeField drops one column's own filter so its facet options show every other active filter.
    const buildFilterClauses = async (excludeField?: string): Promise<Prisma.rs_waybills_in_itemsWhereInput[]> => {
      const clauses: Prisma.rs_waybills_in_itemsWhereInput[] = [];
      let inventoryLabels: Array<{ uuid: string; label: string }> | null = null;
      const getInventoryLabels = async () => {
        if (inventoryLabels) return inventoryLabels;
        const inventories = await prisma.inventories.findMany({
          where: { insider_uuid: insider.insiderUuid },
          select: {
            uuid: true,
            name: true,
            internal_number: true,
            inventory_group: { select: { name: true } },
            dimension: { select: { dimension: true } },
          },
        });
        inventoryLabels = inventories.map((inventory) => ({
          uuid: inventory.uuid,
          label: formatInventoryLabel(inventory),
        }));
        return inventoryLabels;
      };
      const entries = parsedFilterEntries
        .filter(([key]) => allowedFilterFields.has(key) && key !== excludeField)
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

        // Activation Date is the Tbilisi day of activation_time; each dd.mm.yyyy value is a day range.
        if (fieldName === 'activation_date') {
          const dayClauses: Prisma.rs_waybills_in_itemsWhereInput[] = nonBlank
            .map((day) => parseActivationDateRange(day))
            .filter((range): range is { start: Date; end: Date } => Boolean(range))
            .map((range) => ({ waybill: { activation_time: { gte: range.start, lt: range.end } } }));
          if (includeBlank) dayClauses.push({ waybill: { activation_time: null } });
          if (dayClauses.length > 0) {
            clauses.push({ OR: dayClauses });
          } else if (requireNonBlank) {
            clauses.push({ waybill: { activation_time: { not: null } } });
          }
          return;
        }

        // Check = the waybill has a project, financial code or corresponding account (as on Waybills).
        if (fieldName === 'check') {
          const boolValues = new Set(nonBlank.map((v) => v.toLowerCase()).filter((v) => v === 'true' || v === 'false'));
          if (boolValues.size === 1) clauses.push({ waybill: boolValues.has('true') ? WAYBILL_CHECKED : WAYBILL_UNCHECKED });
          return;
        }

        if (requireNonBlank && nonBlank.length === 0 && !includeBlank) {
          if (fieldName === 'vat') return;
          if (NON_TEXT_WAYBILL_FIELDS.has(fieldName)) {
            clauses.push({ waybill: { [fieldName]: { not: null } } } as Prisma.rs_waybills_in_itemsWhereInput);
            return;
          }
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

        // Generic field (UUID columns only take valid UUIDs)
        const inValues = WAYBILL_UUID_FIELDS.has(fieldName) ? nonBlank.filter((v) => isValidUuid(v)) : nonBlank;
        if (inValues.length > 0 && includeBlank) {
          clauses.push({ OR: [{ waybill: { [fieldName]: { in: inValues } } }, { waybill: { [fieldName]: null } }] } as Prisma.rs_waybills_in_itemsWhereInput);
        } else if (inValues.length > 0) {
          clauses.push({ waybill: { [fieldName]: { in: inValues } } } as Prisma.rs_waybills_in_itemsWhereInput);
        } else if (includeBlank) {
          clauses.push({ waybill: { [fieldName]: null } } as Prisma.rs_waybills_in_itemsWhereInput);
        }
      });

      // Process item-level filters
      for (const [key, value] of itemFilters) {
        const { nonBlank, includeBlank, requireNonBlank } = value;

        // dimension_name lives on the dimensions relation, not on the items table.
        if (key === 'dimension_name') {
          if (requireNonBlank && nonBlank.length === 0 && !includeBlank) {
            clauses.push({ dimension_uuid: { not: null } } as Prisma.rs_waybills_in_itemsWhereInput);
          } else if (nonBlank.length > 0 && includeBlank) {
            clauses.push({ OR: [{ dimension: { dimension: { in: nonBlank } } }, { dimension_uuid: null }] } as Prisma.rs_waybills_in_itemsWhereInput);
          } else if (nonBlank.length > 0) {
            clauses.push({ dimension: { dimension: { in: nonBlank } } } as Prisma.rs_waybills_in_itemsWhereInput);
          } else if (includeBlank) {
            clauses.push({ dimension_uuid: null } as Prisma.rs_waybills_in_itemsWhereInput);
          }
          continue;
        }

        // Inventory label columns: resolve the shown "Internal # | Group | Dimension | Name" label
        // back to the UUID column (inventory_uuid or suggested_inventory_uuid).
        const labelColumn = INVENTORY_LABEL_COLUMNS[key];
        if (labelColumn === 'suggested_inventory_uuid') {
          // A suggestion is only shown (and filtered) while the item is unbound.
          const shown: Prisma.rs_waybills_in_itemsWhereInput = { suggested_inventory_uuid: { not: null }, inventory_uuid: null };
          const blank: Prisma.rs_waybills_in_itemsWhereInput = { OR: [{ suggested_inventory_uuid: null }, { inventory_uuid: { not: null } }] };
          if (requireNonBlank && nonBlank.length === 0 && !includeBlank) {
            clauses.push(shown);
            continue;
          }
          const selected = new Set(nonBlank);
          const matchingUuids = (await getInventoryLabels())
            .filter((inventory) => selected.has(inventory.label))
            .map((inventory) => inventory.uuid);
          const picked: Prisma.rs_waybills_in_itemsWhereInput = { suggested_inventory_uuid: { in: matchingUuids }, inventory_uuid: null };
          clauses.push(includeBlank ? { OR: [picked, blank] } : picked);
          continue;
        }
        if (labelColumn) {
          if (requireNonBlank && nonBlank.length === 0 && !includeBlank) {
            clauses.push({ [labelColumn]: { not: null } } as Prisma.rs_waybills_in_itemsWhereInput);
            continue;
          }
          const selected = new Set(nonBlank);
          const matchingUuids = (await getInventoryLabels())
            .filter((inventory) => selected.has(inventory.label))
            .map((inventory) => inventory.uuid);
          if (matchingUuids.length > 0 && includeBlank) {
            clauses.push({ OR: [{ [labelColumn]: { in: matchingUuids } }, { [labelColumn]: null }] } as Prisma.rs_waybills_in_itemsWhereInput);
          } else if (matchingUuids.length > 0) {
            clauses.push({ [labelColumn]: { in: matchingUuids } } as Prisma.rs_waybills_in_itemsWhereInput);
          } else if (includeBlank) {
            clauses.push({ [labelColumn]: null } as Prisma.rs_waybills_in_itemsWhereInput);
          } else {
            clauses.push({ [labelColumn]: { in: [] } } as Prisma.rs_waybills_in_itemsWhereInput);
          }
          continue;
        }

        if (requireNonBlank && nonBlank.length === 0 && !includeBlank) {
          if (UUID_FILTER_FIELDS.has(key)) {
            clauses.push({ [key]: { not: null } } as Prisma.rs_waybills_in_itemsWhereInput);
            continue;
          }
          clauses.push({
            AND: [
              { [key]: { not: null } } as Prisma.rs_waybills_in_itemsWhereInput,
              { [key]: { not: '' } } as Prisma.rs_waybills_in_itemsWhereInput,
            ],
          });
          continue;
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
          continue;
        }

        // Generic string field
        if (nonBlank.length > 0 && includeBlank) {
          clauses.push({ OR: [{ [key]: { in: nonBlank } }, { [key]: null }] } as Prisma.rs_waybills_in_itemsWhereInput);
        } else if (nonBlank.length > 0) {
          clauses.push({ [key]: { in: nonBlank } } as Prisma.rs_waybills_in_itemsWhereInput);
        } else if (includeBlank) {
          clauses.push({ [key]: null } as Prisma.rs_waybills_in_itemsWhereInput);
        }
      }

      // Handle advanced text filters
      for (const [key, filter] of parsedAdvancedFilters) {
        if (!allowedFilterFields.has(key) || key === excludeField) continue;
        const val = String(filter.value || '').trim();
        if (!val) continue;
        const op = filter.operator || 'contains';

        const advancedLabelColumn = INVENTORY_LABEL_COLUMNS[key];
        if (advancedLabelColumn) {
          const matches = (label: string) => {
            const normalized = label.toLowerCase();
            const needle = val.toLowerCase();
            switch (op) {
              case 'notContains': return !normalized.includes(needle);
              case 'equals': return normalized === needle;
              case 'notEquals': return normalized !== needle;
              case 'startsWith': return normalized.startsWith(needle);
              case 'endsWith': return normalized.endsWith(needle);
              case 'contains':
              default: return normalized.includes(needle);
            }
          };
          const matchingUuids = (await getInventoryLabels())
            .filter((inventory) => matches(inventory.label))
            .map((inventory) => inventory.uuid);
          clauses.push({
            [advancedLabelColumn]: { in: matchingUuids },
            ...(advancedLabelColumn === 'suggested_inventory_uuid' ? { inventory_uuid: null } : {}),
          } as Prisma.rs_waybills_in_itemsWhereInput);
          continue;
        }

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

        if (key === 'waybill_activation_date' || key === 'waybill_check' || NON_TEXT_WAYBILL_FIELDS.has(key.replace('waybill_', ''))) {
          // Derived columns, dates, numbers and UUIDs: text operators cannot run on them in the database.
          continue;
        } else if (key.startsWith('waybill_')) {
          const fieldName = key.replace('waybill_', '');
          clauses.push({ waybill: { [fieldName]: prismaOp } } as Prisma.rs_waybills_in_itemsWhereInput);
        } else if (key === 'dimension_name') {
          clauses.push({ dimension: { dimension: prismaOp } } as Prisma.rs_waybills_in_itemsWhereInput);
        } else {
          clauses.push({ [key]: prismaOp } as Prisma.rs_waybills_in_itemsWhereInput);
        }
      }

      return clauses;
    };

    // Period filter applies to the waybill activation time, as on the Waybills page.
    const periodFromDate = parseMonthBoundary(searchParams.get('periodFrom'), 'start');
    const periodToExclusiveDate = parseMonthBoundary(searchParams.get('periodTo'), 'endExclusive');
    const periodClause: Prisma.rs_waybills_in_itemsWhereInput | null =
      periodFromDate && periodToExclusiveDate
        ? { waybill: { activation_time: { gte: periodFromDate, lt: periodToExclusiveDate } } }
        : periodFromDate
          ? { waybill: { activation_time: { gte: periodFromDate } } }
          : periodToExclusiveDate
            ? { waybill: { activation_time: { lt: periodToExclusiveDate } } }
            : null;

    // Build WHERE clause - only use AND if there are actual conditions.
    // excludeField omits that column's own filter (used for facet options).
    const buildWhere = async (excludeField?: string): Promise<Prisma.rs_waybills_in_itemsWhereInput> => {
      const filterClauses = await buildFilterClauses(excludeField);
      const conditions: Prisma.rs_waybills_in_itemsWhereInput[] = [];
      if (Object.keys(baseSearch).length > 0) conditions.push(baseSearch);
      if (periodClause) conditions.push(periodClause);
      if (filterClauses.length > 0) conditions.push(...filterClauses);
      return conditions.length > 0
        ? { AND: [...conditions, { insider_uuid: insider.insiderUuid }] }
        : { insider_uuid: insider.insiderUuid };
    };
    const where = await buildWhere();

    // Build order by
    const orderBy: any = {};
    if (allowedSortColumns.has(sortColumn)) {
      if (sortColumn === 'waybill_activation_date') {
        orderBy['waybill'] = { activation_time: sortDirection };
      } else if (sortColumn.startsWith('waybill_') && sortColumn !== 'waybill_no') {
        const fieldName = sortColumn.replace('waybill_', '');
        // Blanks last in both directions (most waybill columns are often empty); vat is never null.
        orderBy['waybill'] = { [fieldName]: fieldName === 'vat' ? sortDirection : { sort: sortDirection, nulls: 'last' } };
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

    const rows = facetOnly || countOnly ? [] : await withRetry(() => prisma.rs_waybills_in_items.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        include: { 
          inventory: {
            select: {
              name: true,
              internal_number: true,
              dimension_uuid: true,
              inventory_group: { select: { name: true } },
              dimension: { select: { dimension: true } },
            },
          },
          dimension: { select: { dimension: true } },
          suggested_inventory: {
            select: {
              name: true,
              internal_number: true,
              inventory_group: { select: { name: true } },
              dimension: { select: { dimension: true } },
            },
          },
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
              transportation_beginning_time: true,
              submission_time: true,
              cancellation_time: true,
              note: true,
              period: true,
              project_uuid: true,
              financial_code_uuid: true,
              corresponding_account: true,
            }
          }
        },
      }));
    const total = facetOnly || skipCount ? 0 : await withRetry(() => prisma.rs_waybills_in_items.count({ where }));

    let facets: Record<string, any[]> | undefined;
    if (includeFacets && allowedFilterFields.has(facetField)) {
      // Options follow the search, period and every active filter except this column's own filter.
      const facetWhere = await buildWhere(facetField);
      const directFields = new Set([
        'waybill_no', 'goods_code', 'goods_name', 'unit', 'quantity', 'unit_price',
        'total_price', 'taxation', 'inventory_uuid', 'project_uuid', 'financial_code_uuid',
        'corresponding_account', 'import_batch_id', 'dimension_uuid',
        'inventory_match_status', 'inventory_match_method', 'rs_id',
      ]);
      const matchesSearch = (value: string) =>
        !facetSearch || value.toLowerCase().includes(facetSearch.toLowerCase());
      const toFacetValue = (value: any) => {
        if (value === null || value === undefined) return '';
        // Dates must stay ISO so the filter can match them back in the database.
        if (value instanceof Date) return value.toISOString();
        return typeof value === 'object' ? value.toString() : value;
      };
      let values: any[] = [];

      if (facetField === 'inventory_name' || facetField === 'suggested_inventory_name') {
        const inventorySelect = {
          select: {
            name: true,
            internal_number: true,
            inventory_group: { select: { name: true } },
            dimension: { select: { dimension: true } },
          },
        };
        const isSuggested = facetField === 'suggested_inventory_name';
        const itemRows = await withRetry(() => prisma.rs_waybills_in_items.findMany({
          // Suggestions of bound items are not shown, so they are not offered either.
          where: isSuggested ? { AND: [facetWhere, { inventory_uuid: null }] } : facetWhere,
          distinct: [isSuggested ? 'suggested_inventory_uuid' : 'inventory_uuid'],
          select: isSuggested ? { suggested_inventory: inventorySelect } : { inventory: inventorySelect },
        }));
        values = itemRows.map((row: any) => {
          const inventory = isSuggested ? row.suggested_inventory : row.inventory;
          return inventory ? formatInventoryLabel(inventory) : '';
        });
        if (isSuggested && !values.includes('')) {
          const anyBound = await withRetry(() => prisma.rs_waybills_in_items.findFirst({
            where: { AND: [facetWhere, { inventory_uuid: { not: null } }] },
            select: { id: true },
          }));
          if (anyBound) values.push('');
        }
        values = Array.from(new Set(values))
          .filter((value) => matchesSearch(value))
          .sort((a, b) => a.localeCompare(b))
          .slice(0, facetLimit);
      } else if (facetField === 'dimension_name') {
        const itemRows = await withRetry(() => prisma.rs_waybills_in_items.findMany({
          where: facetWhere,
          distinct: ['dimension_uuid'],
          select: { dimension: { select: { dimension: true } } },
        }));
        values = itemRows.map((row) => row.dimension?.dimension ?? '');
        values = Array.from(new Set(values))
          .filter((value) => matchesSearch(value))
          .sort((a, b) => a.localeCompare(b))
          .slice(0, facetLimit);
      } else if (directFields.has(facetField)) {
        const itemRows = await withRetry(() => prisma.rs_waybills_in_items.findMany({
          where: facetWhere,
          distinct: [facetField as any],
          select: { [facetField]: true } as Prisma.rs_waybills_in_itemsSelect,
          take: 50000,
        }));
        values = itemRows.map((row: any) => toFacetValue(row[facetField]));
        values = Array.from(new Set(values))
          .filter((value) => matchesSearch(String(value)))
          .sort((a, b) => String(a).localeCompare(String(b)))
          .slice(0, facetLimit);
      } else if (facetField === 'waybill_check') {
        values = [true, false];
      } else if (facetField === 'waybill_activation_date') {
        const waybillRows = await withRetry(() => prisma.rs_waybills_in_api.findMany({
          where: { waybill_items: { some: facetWhere } },
          distinct: ['activation_time'],
          select: { activation_time: true },
          orderBy: { activation_time: 'desc' },
        }));
        values = Array.from(new Set(waybillRows.map((row) => formatActivationDate(row.activation_time) ?? '')))
          .filter((value) => matchesSearch(value))
          .slice(0, facetLimit);
      } else {
        // waybill_* columns: distinct values from waybills that have items matching the facet scope.
        const fieldName = facetField.startsWith('waybill_')
          ? facetField.slice('waybill_'.length)
          : facetField;
        if (fieldName && /^[a-z_]+$/.test(fieldName)) {
          const waybillRows = await withRetry(() => prisma.rs_waybills_in_api.findMany({
            where: { waybill_items: { some: facetWhere } },
            distinct: [fieldName as any],
            select: { [fieldName]: true } as Prisma.rs_waybills_in_apiSelect,
            take: 50000,
          }));
          values = waybillRows.map((row: any) => toFacetValue(row[fieldName]));
          values = Array.from(new Set(values))
            .filter((value) => matchesSearch(String(value)))
            .sort((a, b) => String(a).localeCompare(String(b)))
            .slice(0, facetLimit);
        }
      }
      facets = { [facetField]: Array.from(new Set(values)) };
    }

    // Identical pending suggestions (same insider, goods name and suggested inventory) for the
    // suggested rows on this page; confirming one confirms the whole group.
    const suggestedIds = rows.filter((row) => row.inventory_match_status === 'suggested').map((row) => row.id);
    const groupCounts = new Map<string, number>();
    if (suggestedIds.length > 0) {
      const counts = await withRetry(() => prisma.$queryRaw<Array<{ id: bigint; n: number }>>`
        SELECT i.id, (
          SELECT count(*)::int FROM rs_waybills_in_items j
           WHERE j.insider_uuid = i.insider_uuid
             AND j.inventory_match_status = 'suggested'
             AND j.inventory_uuid IS NULL
             AND j.suggested_inventory_uuid = i.suggested_inventory_uuid
             AND waybill_norm_name(j.goods_name) = waybill_norm_name(i.goods_name)
        ) AS n
          FROM rs_waybills_in_items i
         WHERE i.id IN (${Prisma.join(suggestedIds)})`);
      counts.forEach((row) => groupCounts.set(String(row.id), Number(row.n)));
    }

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
      inventory_name: formatInventoryLabel(row.inventory),
      // Once the item is bound (confirmed, auto or manual) the suggestion is no longer shown.
      suggested_inventory_uuid: row.inventory_uuid ? null : row.suggested_inventory_uuid,
      suggestion_group_count: groupCounts.get(String(row.id)) ?? 0,
      suggested_inventory_name: !row.inventory_uuid && row.suggested_inventory ? formatInventoryLabel(row.suggested_inventory) : '',
      inventory_match_method: row.inventory_match_method,
      inventory_match_score: row.inventory_match_score === null ? null : Number(row.inventory_match_score),
      inventory_match_status: row.inventory_match_status,
      inventory_matched_at: row.inventory_matched_at ? row.inventory_matched_at.toISOString() : null,
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
      waybill_activation_date: formatActivationDate(row.waybill?.activation_time),
      waybill_transportation_sum: row.waybill?.transportation_sum ? row.waybill.transportation_sum.toString() : null,
      waybill_transportation_cost: row.waybill?.transportation_cost ? row.waybill.transportation_cost.toString() : null,
      waybill_shipping_address: row.waybill?.shipping_address ?? null,
      waybill_departure_address: row.waybill?.departure_address ?? null,
      waybill_check: Boolean(row.waybill && (row.waybill.project_uuid || row.waybill.financial_code_uuid || row.waybill.corresponding_account)),
      waybill_transportation_beginning_time: row.waybill?.transportation_beginning_time?.toISOString() ?? null,
      waybill_submission_time: row.waybill?.submission_time?.toISOString() ?? null,
      waybill_cancellation_time: row.waybill?.cancellation_time?.toISOString() ?? null,
      waybill_note: row.waybill?.note ?? null,
      waybill_period: row.waybill?.period ?? null,
      waybill_project_uuid: row.waybill?.project_uuid ?? null,
      waybill_financial_code_uuid: row.waybill?.financial_code_uuid ?? null,
      waybill_corresponding_account: row.waybill?.corresponding_account ?? null,
    }));

    return NextResponse.json({ data, total, facets });
  } catch (error: any) {
    console.error("[waybill-items] GET error", error);
    return NextResponse.json({ error: error?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    
    // Check if this is a query request (when GET URL is too long)
    if (body.limit !== undefined || body.offset !== undefined) {
      // Build query parameters from body to reuse GET handler logic
      const params = new URLSearchParams();
      
      if (body.limit !== undefined) params.set('limit', String(body.limit));
      if (body.offset !== undefined) params.set('offset', String(body.offset));
      if (body.search) params.set('search', body.search);
      if (body.sortColumn) params.set('sortColumn', body.sortColumn);
      if (body.sortDirection) params.set('sortDirection', body.sortDirection);
      if (body.filters) params.set('filters', JSON.stringify(body.filters));
      if (body.advancedFilters) params.set('advancedFilters', JSON.stringify(body.advancedFilters));
      
      // Create a GET request with query parameters to avoid URL length limits
      const url = new URL(req.url);
      url.search = params.toString();
      const getRequest = new NextRequest(url, { 
        method: 'GET',
        headers: req.headers,
      });
      
      return GET(getRequest);
    }

    // Otherwise, this is a creation request
    const auth = await requireAuth();
    if (isAuthError(auth)) return auth;
    
    const insider = await getRequiredInsider();
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
        inventory: {
          select: {
            name: true,
            internal_number: true,
            inventory_group: { select: { name: true } },
            dimension: { select: { dimension: true } },
          },
        },
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
        inventory_name: formatInventoryLabel(created.inventory),
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
        waybill_activation_date: formatActivationDate(created.waybill?.activation_time),
        waybill_transportation_sum: created.waybill?.transportation_sum ? created.waybill.transportation_sum.toString() : null,
        waybill_transportation_cost: created.waybill?.transportation_cost ? created.waybill.transportation_cost.toString() : null,
        waybill_shipping_address: created.waybill?.shipping_address ?? null,
        waybill_departure_address: created.waybill?.departure_address ?? null,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (isUnitMismatchError(error)) {
      return NextResponse.json({ error: UNIT_MISMATCH_MESSAGE }, { status: 409 });
    }
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
        inventory: {
          select: {
            name: true,
            internal_number: true,
            inventory_group: { select: { name: true } },
            dimension: { select: { dimension: true } },
          },
        },
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
      inventory_name: formatInventoryLabel(updated.inventory),
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
      waybill_activation_date: formatActivationDate(updated.waybill?.activation_time),
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
    if (isUnitMismatchError(error)) {
      return NextResponse.json({ error: UNIT_MISMATCH_MESSAGE }, { status: 409 });
    }
    console.error("[waybill-items] DELETE error", error);
    return NextResponse.json({ error: error?.message || "Server error" }, { status: 500 });
  }
}
