'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { ColumnFilter, ColumnFormat, FilterState } from './table-filters';
import {
  matchesFilter,
  applySearchFilter,
  loadFilterState,
  saveFilterState,
} from './table-filters';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Minimal column shape that every table's ColumnConfig must satisfy. */
export interface FilterableColumn<K extends string = string> {
  key: K;
  label: string;
  visible: boolean;
  sortable: boolean;
  filterable: boolean;
  format?: ColumnFormat;
  width: number;
}

export interface UseTableFiltersOptions<
  TRow extends Record<string, any>,
  K extends string = string,
> {
  /** The full (unfiltered) data set. */
  data: TRow[];

  /** Column definitions — used for format-aware sorting and search. */
  columns: FilterableColumn<K>[];

  /** Default sort column. */
  defaultSortColumn: K;

  /** Default sort direction (default: 'desc'). */
  defaultSortDirection?: 'asc' | 'desc';

  /** localStorage key for filter persistence (omit to disable). */
  filtersStorageKey?: string;

  /** Columns to limit global search to. If omitted, searches all visible columns. */
  searchColumns?: K[];

  /** Enable regex search support (default: false). */
  regexSearch?: boolean;

  /** Custom row accessor — useful when row keys don't match column keys directly. */
  getRowValue?: (row: TRow, columnKey: string) => any;

  /** Page size for pagination (default: 100). */
  pageSize?: number;
}

export interface UseTableFiltersResult<
  TRow extends Record<string, any>,
  K extends string = string,
> {
  // ── State ─────────────────────────────────────────────────────────────────
  filters: FilterState;
  searchTerm: string;
  sortColumn: K;
  sortDirection: 'asc' | 'desc';
  currentPage: number;
  pageSize: number;

  // ── Derived data ──────────────────────────────────────────────────────────
  /** Data after applying search + column filters. */
  filteredData: TRow[];
  /** Data after applying search + column filters + sort. */
  sortedData: TRow[];
  /** Data after applying search + column filters + sort + pagination. */
  paginatedData: TRow[];
  totalPages: number;

  // ── Facet helpers ─────────────────────────────────────────────────────────
  /**
   * Get unique values for a column with cross-filter semantics.
   * Excludes the requested column from active filters so users can
   * still see all possible values given other constraints.
   */
  getColumnValues: (columnKey: K) => any[];

  // ── Handlers ──────────────────────────────────────────────────────────────
  setSearchTerm: (term: string) => void;
  handleSort: (column: K) => void;
  setSortColumn: (column: K) => void;
  setSortDirection: (direction: 'asc' | 'desc') => void;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  handleFilterChange: (columnKey: K, filter: ColumnFilter | null) => void;
  clearFilters: () => void;
  /** Number of active column filters (for badge display). */
  activeFilterCount: number;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useTableFilters<
  TRow extends Record<string, any>,
  K extends string = string,
>(options: UseTableFiltersOptions<TRow, K>): UseTableFiltersResult<TRow, K> {
  const {
    data,
    columns,
    defaultSortColumn,
    defaultSortDirection = 'desc',
    filtersStorageKey,
    searchColumns,
    regexSearch = false,
    getRowValue,
    pageSize = 100,
  } = options;

  // ── State ───────────────────────────────────────────────────────────────

  const [filters, setFilters] = useState<FilterState>(() =>
    filtersStorageKey ? loadFilterState(filtersStorageKey) : new Map(),
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<K>(defaultSortColumn);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(defaultSortDirection);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSizeState, setPageSizeState] = useState(pageSize);

  // ── Persist filters to localStorage ──────────────────────────────────────

  useEffect(() => {
    if (filtersStorageKey) saveFilterState(filtersStorageKey, filters);
  }, [filters, filtersStorageKey]);

  // ── Visible columns (memoised) ───────────────────────────────────────────

  const visibleColumns = useMemo(
    () => columns.filter((c) => c.visible),
    [columns],
  );

  // ── Internal: apply search + column filters ──────────────────────────────

  const accessor = getRowValue ?? ((row: TRow, key: string) => (row as any)[key]);

  const applyFiltersInternal = useCallback(
    (rows: TRow[], excludeColumn?: string): TRow[] => {
      // 1. Global text search
      const term = searchTerm.trim();
      let result = rows;
      if (term) {
        const cols = searchColumns ?? visibleColumns.map((c) => c.key);
        result = applySearchFilter(result, term, {
          columns: cols as string[],
          getRowValue: getRowValue as any,
          regex: regexSearch,
        });
      }

      // 2. Column filters
      if (filters.size === 0) return result;
      return result.filter((row) => {
        for (const [columnKey, filter] of filters.entries()) {
          if (excludeColumn && columnKey === excludeColumn) continue;
          const value = accessor(row, columnKey);
          if (!matchesFilter(value, filter)) return false;
        }
        return true;
      });
    },
    [searchTerm, filters, visibleColumns, searchColumns, regexSearch, getRowValue, accessor],
  );

  // ── filteredData ─────────────────────────────────────────────────────────

  const filteredData = useMemo(
    () => applyFiltersInternal(data),
    [data, applyFiltersInternal],
  );

  // ── sortedData ───────────────────────────────────────────────────────────

  const sortedData = useMemo(() => {
    const sorted = [...filteredData];
    const colConfig = columns.find((c) => c.key === sortColumn);

    sorted.sort((a, b) => {
      const aVal = accessor(a, sortColumn);
      const bVal = accessor(b, sortColumn);

      // Nulls always sort to the end
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let cmp = 0;
      const fmt = colConfig?.format;

      if (fmt === 'number' || fmt === 'currency' || fmt === 'percent') {
        cmp = Number(aVal) - Number(bVal);
      } else if (fmt === 'date' || fmt === 'datetime') {
        cmp = new Date(aVal).getTime() - new Date(bVal).getTime();
      } else if (typeof aVal === 'boolean') {
        cmp = (aVal === bVal ? 0 : aVal ? -1 : 1);
      } else {
        cmp = String(aVal).localeCompare(String(bVal));
      }

      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [filteredData, sortColumn, sortDirection, columns, accessor]);

  // ── Pagination ───────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSizeState));

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSizeState;
    return sortedData.slice(start, start + pageSizeState);
  }, [sortedData, currentPage, pageSizeState]);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setCurrentPage(1);
  }, []);

  // Reset page when it exceeds total
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [currentPage, totalPages]);

  // ── Cross-filter facet values ────────────────────────────────────────────

  const getColumnValues = useCallback(
    (columnKey: K): any[] => {
      const baseData = applyFiltersInternal(data, columnKey);
      const seen = new Set<any>();
      for (const row of baseData) {
        seen.add(accessor(row, columnKey));
      }
      return Array.from(seen).sort();
    },
    [data, applyFiltersInternal, accessor],
  );

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSort = useCallback(
    (column: K) => {
      if (sortColumn === column) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortColumn(column);
        setSortDirection('asc');
      }
    },
    [sortColumn],
  );

  const handleFilterChange = useCallback(
    (columnKey: K, filter: ColumnFilter | null) => {
      setFilters((prev) => {
        const next = new Map(prev);
        if (filter) {
          next.set(columnKey, filter);
        } else {
          next.delete(columnKey);
        }
        return next;
      });
    },
    [],
  );

  const clearFilters = useCallback(() => {
    setFilters(new Map());
    if (filtersStorageKey) {
      try { localStorage.removeItem(filtersStorageKey); } catch { /* ignore */ }
    }
  }, [filtersStorageKey]);

  const activeFilterCount = filters.size;

  return {
    // State
    filters,
    searchTerm,
    sortColumn,
    sortDirection,
    currentPage,
    pageSize: pageSizeState,

    // Derived data
    filteredData,
    sortedData,
    paginatedData,
    totalPages,

    // Facet helpers
    getColumnValues,

    // Handlers
    setSearchTerm,
    handleSort,
    setSortColumn,
    setSortDirection,
    setCurrentPage,
    setPageSize,
    handleFilterChange,
    clearFilters,
    activeFilterCount,
  };
}
