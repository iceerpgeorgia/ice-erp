'use client';

// ─── Shared Filter Engine ───────────────────────────────────────────────────
// Universal filter logic for all tables.  Import once, use everywhere.
// Supports: text, number/currency/percent, boolean, date column formats
// with industry-standard operators (contains, equals, >, <, between, etc.)

// ─── Types ──────────────────────────────────────────────────────────────────

/** Superset of all format strings used across every table in the app. */
export type ColumnFormat =
  | 'text'
  | 'currency'
  | 'number'
  | 'percent'
  | 'boolean'
  | 'date'
  | 'datetime';

/** Operators for numeric columns (currency / number / percent). */
export type NumericOperator =
  | 'eq'      // = value
  | 'neq'     // ≠ value
  | 'gt'      // > value
  | 'gte'     // ≥ value
  | 'lt'      // < value
  | 'lte'     // ≤ value
  | 'between' // min ≤ x ≤ max
  | 'blank'   // null / undefined / NaN / empty-string
  | 'notBlank';

/** Operators for text columns. */
export type TextOperator =
  | 'contains'
  | 'notContains'
  | 'equals'
  | 'notEquals'
  | 'startsWith'
  | 'endsWith'
  | 'blank'
  | 'notBlank';

/** Operators for date columns. */
export type DateOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'blank'
  | 'notBlank';

/** A single column filter. Discriminated by `mode`. */
export type ColumnFilter =
  | FacetFilter
  | NumericFilter
  | TextFilter
  | DateFilter;

/** Classic facet / checkbox filter (pick from unique values). */
export interface FacetFilter {
  mode: 'facet';
  values: Set<any>;
}

/** Numeric condition filter. */
export interface NumericFilter {
  mode: 'numeric';
  operator: NumericOperator;
  value?: number;   // for single-value operators
  value2?: number;  // end of range for "between"
}

/** Text condition filter. */
export interface TextFilter {
  mode: 'text';
  operator: TextOperator;
  value?: string;
}

/** Date condition filter. */
export interface DateFilter {
  mode: 'date';
  operator: DateOperator;
  value?: string;   // ISO date string
  value2?: string;  // end of range for "between"
}

/** Map of columnKey → ColumnFilter.  This is the single filter state each table holds. */
export type FilterState = Map<string, ColumnFilter>;

// ─── Helpers ────────────────────────────────────────────────────────────────

const isBlank = (v: any): boolean =>
  v === null || v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v));

/** Coerce any value to a number; returns NaN when not numeric. */
const toNum = (v: any): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[,\s]/g, '');
    return cleaned === '' ? NaN : Number(cleaned);
  }
  return NaN;
};

/** Coerce any value to a comparable date string (ISO). */
const toDateStr = (v: any): string | null => {
  if (!v) return null;
  const s = String(v);
  // Already ISO-like
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // dd.mm.yyyy
  const dotMatch = s.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (dotMatch) return `${dotMatch[3]}-${dotMatch[2]}-${dotMatch[1]}`;
  // mm/dd/yyyy
  const slashMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (slashMatch) return `${slashMatch[3]}-${slashMatch[1]}-${slashMatch[2]}`;
  return null;
};

// ─── Predicates ─────────────────────────────────────────────────────────────

function matchesFacet(rowValue: any, filter: FacetFilter): boolean {
  if (filter.values.size === 0) return true; // no selection ⇒ show all
  return filter.values.has(rowValue);
}

function matchesNumeric(rowValue: any, filter: NumericFilter): boolean {
  if (filter.operator === 'blank') return isBlank(rowValue);
  if (filter.operator === 'notBlank') return !isBlank(rowValue);
  const n = toNum(rowValue);
  if (Number.isNaN(n)) return false;
  const v = filter.value ?? 0;
  switch (filter.operator) {
    case 'eq':  return n === v;
    case 'neq': return n !== v;
    case 'gt':  return n > v;
    case 'gte': return n >= v;
    case 'lt':  return n < v;
    case 'lte': return n <= v;
    case 'between': {
      const lo = Math.min(v, filter.value2 ?? v);
      const hi = Math.max(v, filter.value2 ?? v);
      return n >= lo && n <= hi;
    }
    default: return true;
  }
}

function matchesText(rowValue: any, filter: TextFilter): boolean {
  if (filter.operator === 'blank') return isBlank(rowValue);
  if (filter.operator === 'notBlank') return !isBlank(rowValue);
  const text = String(rowValue ?? '').toLowerCase();
  const q = (filter.value ?? '').toLowerCase();
  switch (filter.operator) {
    case 'contains':    return text.includes(q);
    case 'notContains': return !text.includes(q);
    case 'equals':      return text === q;
    case 'notEquals':   return text !== q;
    case 'startsWith':  return text.startsWith(q);
    case 'endsWith':    return text.endsWith(q);
    default: return true;
  }
}

function matchesDate(rowValue: any, filter: DateFilter): boolean {
  if (filter.operator === 'blank') return isBlank(rowValue);
  if (filter.operator === 'notBlank') return !isBlank(rowValue);
  const d = toDateStr(rowValue);
  if (!d) return false;
  const v = filter.value ?? '';
  switch (filter.operator) {
    case 'eq':  return d === v;
    case 'neq': return d !== v;
    case 'gt':  return d > v;
    case 'gte': return d >= v;
    case 'lt':  return d < v;
    case 'lte': return d <= v;
    case 'between': {
      const lo = v < (filter.value2 ?? v) ? v : (filter.value2 ?? v);
      const hi = v > (filter.value2 ?? v) ? v : (filter.value2 ?? v);
      return d >= lo && d <= hi;
    }
    default: return true;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Test whether a single row value passes a given ColumnFilter. */
export function matchesFilter(rowValue: any, filter: ColumnFilter): boolean {
  switch (filter.mode) {
    case 'facet':   return matchesFacet(rowValue, filter);
    case 'numeric': return matchesNumeric(rowValue, filter);
    case 'text':    return matchesText(rowValue, filter);
    case 'date':    return matchesDate(rowValue, filter);
    default:        return true;
  }
}

/**
 * Apply all column filters to a row set.
 * @param rows         Source data array
 * @param filters      Current filter state
 * @param getRowValue  Optional accessor; defaults to `row[columnKey]`
 * @param excludeColumn  Optional column to skip (for cross-filter facets)
 */
export function applyColumnFilters<T extends Record<string, any>>(
  rows: T[],
  filters: FilterState,
  getRowValue?: (row: T, columnKey: string) => any,
  excludeColumn?: string,
): T[] {
  if (filters.size === 0) return rows;
  const accessor = getRowValue ?? ((row: T, key: string) => row[key]);
  return rows.filter(row => {
    for (const [columnKey, filter] of filters.entries()) {
      if (excludeColumn && columnKey === excludeColumn) continue;
      const value = accessor(row, columnKey);
      if (!matchesFilter(value, filter)) return false;
    }
    return true;
  });
}

/**
 * Apply a global text search across all (or selected) columns.
 * Supports optional regex mode.
 */
export function applySearchFilter<T extends Record<string, any>>(
  rows: T[],
  searchTerm: string,
  options?: {
    columns?: string[];       // limit search to these columns
    getRowValue?: (row: T, columnKey: string) => any;
    regex?: boolean;          // attempt regex match
  },
): T[] {
  if (!searchTerm) return rows;
  const term = searchTerm.toLowerCase();
  let rx: RegExp | null = null;
  if (options?.regex) {
    try { rx = new RegExp(searchTerm, 'i'); } catch { /* fall back to includes */ }
  }

  return rows.filter(row => {
    const valuesToCheck = options?.columns
      ? options.columns.map(k => (options.getRowValue ? options.getRowValue(row, k) : row[k]))
      : Object.values(row);
    return valuesToCheck.some(val => {
      const s = String(val ?? '');
      if (rx) return rx.test(s);
      return s.toLowerCase().includes(term);
    });
  });
}

/**
 * Build a `getFacetBaseData` function — the standard cross-filter facet
 * value source used by `ColumnFilterPopover`.
 *
 * Returns unique values for a column *after* applying search + all other
 * column filters (excluding the column itself, so the user can still see
 * all values that exist given the other constraints).
 */
export function buildFacetBaseData<T extends Record<string, any>>(
  data: T[],
  searchTerm: string,
  filters: FilterState,
  getRowValue?: (row: T, columnKey: string) => any,
  searchOptions?: { columns?: string[]; regex?: boolean },
) {
  return (excludeColumn?: string): T[] => {
    let result = applySearchFilter(data, searchTerm, {
      ...searchOptions,
      getRowValue,
    });
    result = applyColumnFilters(result, filters, getRowValue, excludeColumn);
    return result;
  };
}

/**
 * Compute unique facet values for every filterable column.
 * Uses `getFacetBaseData(column)` to provide cross-filter semantics.
 */
export function buildUniqueValuesCache<T extends Record<string, any>>(
  filterableColumnKeys: string[],
  getFacetBaseData: (excludeColumn?: string) => T[],
  getRowValue?: (row: T, columnKey: string) => any,
): Map<string, any[]> {
  const cache = new Map<string, any[]>();
  const accessor = getRowValue ?? ((row: T, key: string) => row[key]);
  for (const key of filterableColumnKeys) {
    const baseData = getFacetBaseData(key);
    const seen = new Set<any>();
    for (const row of baseData) {
      seen.add(accessor(row, key));
    }
    cache.set(key, Array.from(seen).sort());
  }
  return cache;
}

// ─── Backward-compat converters ─────────────────────────────────────────────
// Tables that still use the old filter shapes can convert on the fly
// until they are migrated.

/** Convert old `Record<string, string[]>` → FilterState (facet mode). */
export function fromRecordFilters(old: Record<string, string[]>): FilterState {
  const m: FilterState = new Map();
  for (const [key, values] of Object.entries(old)) {
    if (values.length > 0) {
      m.set(key, { mode: 'facet', values: new Set(values) });
    }
  }
  return m;
}

/** Convert old `Map<string, Set<any>>` → FilterState (facet mode). */
export function fromMapFilters(old: Map<string, Set<any>>): FilterState {
  const m: FilterState = new Map();
  for (const [key, values] of old.entries()) {
    if (values.size > 0) {
      m.set(key, { mode: 'facet', values });
    }
  }
  return m;
}

/** Convert FilterState back to `Map<string, Set<any>>` (facet filters only). */
export function toMapFilters(state: FilterState): Map<string, Set<any>> {
  const m = new Map<string, Set<any>>();
  for (const [key, filter] of state.entries()) {
    if (filter.mode === 'facet') {
      m.set(key, filter.values);
    }
  }
  return m;
}

// ─── Persistence ────────────────────────────────────────────────────────────

/** Serialize FilterState to a JSON-safe object for localStorage. */
export function serializeFilterState(filters: FilterState): string {
  const obj: Record<string, any> = {};
  for (const [key, filter] of filters.entries()) {
    switch (filter.mode) {
      case 'facet':
        obj[key] = { mode: 'facet', values: Array.from(filter.values) };
        break;
      case 'numeric':
        obj[key] = { mode: 'numeric', operator: filter.operator, value: filter.value, value2: filter.value2 };
        break;
      case 'text':
        obj[key] = { mode: 'text', operator: filter.operator, value: filter.value };
        break;
      case 'date':
        obj[key] = { mode: 'date', operator: filter.operator, value: filter.value, value2: filter.value2 };
        break;
    }
  }
  return JSON.stringify(obj);
}

/** Deserialize FilterState from localStorage JSON. */
export function deserializeFilterState(json: string): FilterState {
  const m: FilterState = new Map();
  try {
    const obj = JSON.parse(json);
    for (const [key, raw] of Object.entries(obj as Record<string, any>)) {
      if (!raw || typeof raw !== 'object') continue;
      switch (raw.mode) {
        case 'facet':
          m.set(key, { mode: 'facet', values: new Set(raw.values ?? []) });
          break;
        case 'numeric':
          m.set(key, { mode: 'numeric', operator: raw.operator ?? 'eq', value: raw.value, value2: raw.value2 });
          break;
        case 'text':
          m.set(key, { mode: 'text', operator: raw.operator ?? 'contains', value: raw.value });
          break;
        case 'date':
          m.set(key, { mode: 'date', operator: raw.operator ?? 'eq', value: raw.value, value2: raw.value2 });
          break;
      }
    }
  } catch { /* ignore */ }
  return m;
}

export function loadFilterState(storageKey: string): FilterState {
  if (typeof window === 'undefined') return new Map();
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return new Map();
    return deserializeFilterState(raw);
  } catch {
    return new Map();
  }
}

export function saveFilterState(storageKey: string, filters: FilterState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey, serializeFilterState(filters));
  } catch { /* ignore */ }
}

/**
 * Infer the best filter mode for a column based on its format.
 * Tables that specify a `format` on their ColumnConfig can use this
 * to decide which filter UI to show.
 */
export function inferFilterMode(format?: ColumnFormat): ColumnFilter['mode'] {
  switch (format) {
    case 'currency':
    case 'number':
    case 'percent':
      return 'numeric';
    case 'date':
    case 'datetime':
      return 'date';
    default:
      return 'facet';
  }
}

/**
 * Check whether a FilterState has any active filter for display purposes.
 */
export function hasActiveFilter(filter: ColumnFilter | undefined): boolean {
  if (!filter) return false;
  switch (filter.mode) {
    case 'facet':   return filter.values.size > 0;
    case 'numeric': return true;
    case 'text':    return true;
    case 'date':    return true;
    default:        return false;
  }
}
