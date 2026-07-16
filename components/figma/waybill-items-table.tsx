'use client';
/* eslint-disable react-hooks/exhaustive-deps */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Combobox } from '@/components/ui/combobox';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { Search, Eye, Edit2, Settings, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { ColumnFilterPopover } from './shared/column-filter-popover';
import { ClearFiltersButton } from './shared/clear-filters-button';
import { BLANK_FACET_TOKEN } from './shared/table-filters';
import type { ColumnFilter, ColumnFormat } from './shared/table-filters';
import * as XLSX from 'xlsx';

const CORRESPONDING_ACCOUNTS = [
  '1_4_30','1_6_10','1_6_20','1_6_30','1_6_55','1_6_70','2_1_50','2_1_60','2_1_70',
  '3_1_10','3_1_90','7_4_15','7_4_20','7_4_21','7_4_22','7_4_22_1','7_4_22_2','7_4_30',
  '7_4_41','7_4_42','7_4_45','7_4_56','7_4_60','7_4_65','7_4_70','7_4_85','7_4_90','7_4_91'
];
const NONE_OPTION_VALUE = '__none__';
const NON_BLANK_FILTER_TOKEN = '__NON_BLANK__';

type WaybillItem = {
  id: number;
  uuid?: string | null;
  rs_id?: string | null;
  waybill_no?: string | null;
  goods_code?: string | null;
  goods_name?: string | null;
  unit?: string | null;
  dimension_uuid?: string | null;
  dimension_name?: string | null;
  quantity?: string | null;
  unit_price?: string | null;
  total_price?: string | null;
  taxation?: string | null;
  inventory_uuid?: string | null;
  inventory_name?: string | null;
  project_uuid?: string | null;
  financial_code_uuid?: string | null;
  corresponding_account?: string | null;
  import_batch_id?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  insider_uuid?: string | null;
  insider_name?: string | null;
  // Waybill header columns (appendable)
  waybill_state?: string | null;
  waybill_condition?: string | null;
  waybill_category?: string | null;
  waybill_type?: string | null;
  waybill_counteragent_uuid?: string | null;
  waybill_counteragent_name?: string | null;
  waybill_counteragent_inn?: string | null;
  waybill_vat?: boolean | null;
  waybill_sum?: string | null;
  waybill_driver?: string | null;
  waybill_vehicle?: string | null;
  waybill_activation_time?: string | null;
  waybill_transportation_sum?: string | null;
  waybill_transportation_cost?: string | null;
  waybill_shipping_address?: string | null;
  waybill_departure_address?: string | null;
};

type ColumnKey = keyof WaybillItem;

type ColumnConfig = {
  key: ColumnKey;
  label: string;
  visible: boolean;
  sortable: boolean;
  filterable: boolean;
  format?: ColumnFormat;
  width: number;
};

const defaultColumns: ColumnConfig[] = [
  { key: 'waybill_no', label: 'Waybill', visible: true, sortable: true, filterable: true, width: 140 },
  { key: 'goods_code', label: 'Goods Code', visible: true, sortable: true, filterable: true, width: 140 },
  { key: 'goods_name', label: 'Goods Name', visible: true, sortable: true, filterable: true, width: 260 },
  { key: 'unit', label: 'Unit', visible: true, sortable: true, filterable: true, width: 100 },
  { key: 'quantity', label: 'Quantity', visible: true, sortable: true, filterable: true, format: 'number', width: 120 },
  { key: 'unit_price', label: 'Unit Price', visible: true, sortable: true, filterable: true, format: 'number', width: 120 },
  { key: 'total_price', label: 'Total Price', visible: true, sortable: true, filterable: true, format: 'number', width: 120 },
  { key: 'inventory_name', label: 'Inventory', visible: true, sortable: true, filterable: true, width: 200 },
  { key: 'taxation', label: 'Taxation', visible: true, sortable: true, filterable: true, width: 120 },
  { key: 'project_uuid', label: 'Project', visible: true, sortable: true, filterable: true, width: 200 },
  { key: 'financial_code_uuid', label: 'Financial Code', visible: true, sortable: true, filterable: true, width: 220 },
  { key: 'corresponding_account', label: 'Corresponding Account', visible: true, sortable: true, filterable: true, width: 180 },
  // Waybill header columns (hidden by default)
  { key: 'waybill_state', label: 'Waybill Status', visible: false, sortable: true, filterable: true, width: 120 },
  { key: 'waybill_condition', label: 'Condition', visible: false, sortable: true, filterable: true, width: 140 },
  { key: 'waybill_category', label: 'Category', visible: false, sortable: true, filterable: true, width: 140 },
  { key: 'waybill_type', label: 'Type', visible: false, sortable: true, filterable: true, width: 140 },
  { key: 'waybill_counteragent_name', label: 'Organization', visible: false, sortable: true, filterable: true, width: 240 },
  { key: 'waybill_counteragent_inn', label: 'INN', visible: false, sortable: true, filterable: true, width: 140 },
  { key: 'waybill_vat', label: 'VAT', visible: false, sortable: true, filterable: true, format: 'boolean', width: 80 },
  { key: 'waybill_sum', label: 'Waybill Amount', visible: false, sortable: true, filterable: true, format: 'number', width: 120 },
  { key: 'waybill_driver', label: 'Driver', visible: false, sortable: true, filterable: true, width: 200 },
  { key: 'waybill_vehicle', label: 'Auto', visible: false, sortable: true, filterable: true, width: 160 },
  { key: 'waybill_transportation_sum', label: 'Transport Amount', visible: false, sortable: true, filterable: true, format: 'number', width: 140 },
  { key: 'waybill_activation_time', label: 'Activation Date', visible: false, sortable: true, filterable: true, format: 'datetime', width: 190 },
  { key: 'waybill_departure_address', label: 'Departure Place', visible: false, sortable: true, filterable: true, width: 260 },
  { key: 'waybill_shipping_address', label: 'Delivery Address', visible: false, sortable: true, filterable: true, width: 260 },
];

const formatCell = (value: any, format?: ColumnConfig['format']) => {
  if (value === null || value === undefined || value === '') return '';
  if (format === 'boolean') return value ? 'Yes' : 'No';
  if (format === 'datetime') {
    const date = typeof value === 'string' || value instanceof Date ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '-';
    const dd = String(date.getDate()).padStart(2, '0');
    const MM = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${dd}.${MM}.${yyyy} ${hh}:${mm}:${ss}`;
  }
  if (format === 'date') {
    const date = typeof value === 'string' || value instanceof Date ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return String(value);
    const dd = String(date.getDate()).padStart(2, '0');
    const MM = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}.${MM}.${yyyy}`;
  }
  if (format === 'period') {
    const match = String(value).match(/^(\d{4})-(\d{2})$/);
    if (match) {
      const d = new Date(Number(match[1]), Number(match[2]) - 1, 1);
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
    return String(value);
  }
  if (format === 'number') {
    const num = Number(value);
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  return String(value);
};

export function WaybillItemsTable() {
  const filtersStorageKey = 'waybillItemsFiltersV1';
  const [data, setData] = useState<WaybillItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [selected, setSelected] = useState<WaybillItem | null>(null);
  const [editing, setEditing] = useState<WaybillItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkProjectUuid, setBulkProjectUuid] = useState('');
  const [bulkFinancialCodeUuid, setBulkFinancialCodeUuid] = useState('');
  const [bulkCorrespondingAccount, setBulkCorrespondingAccount] = useState('');
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [financialCodes, setFinancialCodes] = useState<any[]>([]);
  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);
  const [columnFilters, setColumnFilters] = useState<{ id: string; value: any[] }[]>([]);
  const [advancedFilters, setAdvancedFilters] = useState<Map<ColumnKey, ColumnFilter>>(new Map());
  const [sorting, setSorting] = useState<{ id: ColumnKey; desc: boolean }>({ id: 'waybill_no', desc: false });
  const [isResizing, setIsResizing] = useState<{
    column: ColumnKey;
    startX: number;
    startWidth: number;
    element: HTMLElement;
  } | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(200);
  const [isInitialized, setIsInitialized] = useState(false);
  const [filtersInitialized, setFiltersInitialized] = useState(false);

  // Logging utility for filter events
  const logFilter = useCallback((action: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, action, data, component: 'WaybillItemsTable' };
    console.log(`[WAYBILL_ITEMS_FILTER] ${action}:`, logEntry);
  }, []);

  const resizeRafRef = useRef<number | null>(null);
  const resizePendingRef = useRef<{ element: HTMLElement; width: number } | null>(null);

  const filtersMap = useMemo(
    () =>
      new Map<ColumnKey, Set<any>>(
        columnFilters
          .filter((filter) => 'id' in filter && 'value' in filter && typeof filter.id === 'string' && Array.isArray(filter.value))
          .map((filter) => [(filter as { id: ColumnKey; value: any[] }).id, new Set((filter as { id: any; value: any[] }).value)])
      ),
    [columnFilters]
  );

  const sortColumn = sorting.id || 'waybill_no';
  const sortDirection: 'asc' | 'desc' = sorting.desc ? 'desc' : 'asc';

  useEffect(() => {
    const versionKey = 'waybillItemsColumnsVersion';
    const currentVersion = '1';
    const savedVersion = localStorage.getItem(versionKey);
    const shouldLoadSavedColumns = savedVersion === currentVersion;
    if (!shouldLoadSavedColumns) {
      localStorage.setItem('waybillItemsColumns', JSON.stringify(defaultColumns));
      localStorage.setItem(versionKey, currentVersion);
      setColumns(defaultColumns);
    }

    const saved = shouldLoadSavedColumns ? localStorage.getItem('waybillItemsColumns') : null;
    if (saved) {
      try {
        const savedColumns = JSON.parse(saved) as ColumnConfig[];
        const defaultColumnsMap = new Map(defaultColumns.map((col) => [col.key, col]));
        const validSavedColumns = savedColumns.filter((savedCol) => defaultColumnsMap.has(savedCol.key));
        const updatedSavedColumns = validSavedColumns.map((savedCol) => {
          const defaultCol = defaultColumnsMap.get(savedCol.key);
          if (!defaultCol) return savedCol;
          return {
            ...defaultCol,
            visible: savedCol.visible,
            width: savedCol.width,
          };
        });
        const savedKeys = new Set(validSavedColumns.map((col) => col.key));
        const newColumns = defaultColumns.filter((col) => !savedKeys.has(col.key));
        setColumns([...updatedSavedColumns, ...newColumns]);
      } catch (error) {
        console.error('Failed to parse saved columns:', error);
        setColumns(defaultColumns);
      }
    }

    setIsInitialized(true);
  }, []);

  useEffect(() => {
    // First, try to read from URL parameters (for direct filter links)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlAdvancedFilters = params.get('advancedFilters');
      
      if (urlAdvancedFilters) {
        try {
          const parsed = JSON.parse(urlAdvancedFilters);
          const restoredAdvanced = new Map<ColumnKey, ColumnFilter>();
          if (Array.isArray(parsed)) {
            for (const [key, raw] of parsed as Array<[string, any]>) {
              if (raw?.mode === 'text' && raw.operator) {
                restoredAdvanced.set(key as ColumnKey, { mode: 'text', operator: raw.operator, value: raw.value });
              }
            }
          }
          if (restoredAdvanced.size > 0) {
            setAdvancedFilters(restoredAdvanced);
            setFiltersInitialized(true);
            return;
          }
        } catch (error) {
          console.error('Failed to parse URL advanced filters:', error);
        }
      }
    }
    
    // Fall back to localStorage if no URL filters
    const savedFilters = localStorage.getItem(filtersStorageKey);
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        if (typeof parsed.search === 'string') {
          setSearch(parsed.search);
        }
        if (typeof parsed.appliedSearch === 'string') {
          setAppliedSearch(parsed.appliedSearch);
        }
        if (typeof parsed.periodFrom === 'string') {
          setPeriodFrom(parsed.periodFrom);
        }
        if (typeof parsed.periodTo === 'string') {
          setPeriodTo(parsed.periodTo);
        }
        if (parsed.sortColumn && (parsed.sortDirection === 'asc' || parsed.sortDirection === 'desc')) {
          setSorting({ id: parsed.sortColumn as ColumnKey, desc: parsed.sortDirection === 'desc' });
        }
        if (typeof parsed.pageSize === 'number') setPageSize(parsed.pageSize);
        if (Array.isArray(parsed.filters)) {
          const restored: { id: string; value: any[] }[] = [];
          for (const item of parsed.filters as unknown[]) {
            if (
              Array.isArray(item) &&
              item.length === 2 &&
              typeof item[0] === 'string' &&
              Array.isArray(item[1])
            ) {
              restored.push({ id: item[0], value: item[1] });
            }
          }
          setColumnFilters(restored);
        }
        if (parsed.advancedFilters && typeof parsed.advancedFilters === 'object') {
          const restoredAdvanced = new Map<ColumnKey, ColumnFilter>();
          for (const [key, raw] of Object.entries(parsed.advancedFilters as Record<string, any>)) {
            if (raw?.mode === 'text' && raw.operator) {
              restoredAdvanced.set(key as ColumnKey, { mode: 'text', operator: raw.operator, value: raw.value });
            }
          }
          if (restoredAdvanced.size > 0) setAdvancedFilters(restoredAdvanced);
        }
      } catch (error) {
        console.error('Failed to parse saved filters:', error);
      }
    }
    setFiltersInitialized(true);
  }, [filtersStorageKey]);

  useEffect(() => {
    if (!filtersInitialized) return;
    const serialized = {
      search,
      appliedSearch,
      periodFrom,
      periodTo,
      sortColumn,
      sortDirection,
      pageSize,
      filters: columnFilters
        .filter((filter) => typeof filter.id === 'string' && Array.isArray(filter.value))
        .map((filter) => [filter.id, filter.value]),
      advancedFilters: advancedFilters.size > 0
        ? Object.fromEntries(Array.from(advancedFilters.entries()))
        : undefined,
    };
    localStorage.setItem(filtersStorageKey, JSON.stringify(serialized));
  }, [
    filtersInitialized,
    search,
    appliedSearch,
    periodFrom,
    periodTo,
    sortColumn,
    sortDirection,
    pageSize,
    columnFilters,
    advancedFilters,
    filtersStorageKey,
  ]);

  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
      localStorage.setItem('waybillItemsColumns', JSON.stringify(columns));
    }
  }, [columns, isInitialized]);

  const buildQueryParams = useCallback((options: {
    page?: number;
    pageSize?: number;
    includeFacets: boolean;
    includePagination?: boolean;
  }) => {
    const normalizeFilterValue = (value: any) => {
      if (value === BLANK_FACET_TOKEN) return '';
      return value === null || value === undefined ? '' : value;
    };

    const serializedFilters = columnFilters.reduce<Array<[string, any[]]>>((acc: Array<[string, any[]]>, filter: { id: string; value: any[] }) => {
      if (typeof filter.id !== 'string' || !Array.isArray(filter.value)) return acc;
      const key = filter.id as ColumnKey;
      const selectedValues = filter.value.map(normalizeFilterValue);
      if (selectedValues.length === 0) return acc;

      acc.push([key, selectedValues]);
      return acc;
    }, []);

    const params = new URLSearchParams();
    if (appliedSearch.trim()) params.set('search', appliedSearch.trim());
    if (periodFrom) params.set('periodFrom', periodFrom);
    if (periodTo) params.set('periodTo', periodTo);
    if (options.includePagination !== false) {
      const resolvedPage = options.page ?? currentPage;
      const resolvedSize = options.pageSize ?? pageSize;
      const offset = Math.max(resolvedPage - 1, 0) * resolvedSize;
      params.set('limit', String(resolvedSize));
      params.set('offset', String(offset));
    }
    params.set('includeFacets', options.includeFacets ? 'true' : 'false');
    if (sortColumn) params.set('sortColumn', sortColumn);
    if (sortDirection) params.set('sortDirection', sortDirection);
    if (serializedFilters.length > 0) {
      params.set('filters', JSON.stringify(serializedFilters));
    }
    if (advancedFilters.size > 0) {
      const advancedArr: Array<[string, any]> = [];
      advancedFilters.forEach((filter, key) => {
        advancedArr.push([key, filter]);
      });
      params.set('advancedFilters', JSON.stringify(advancedArr));
    }
    return params;
  }, [appliedSearch, periodFrom, periodTo, currentPage, pageSize, sortColumn, sortDirection, columnFilters, advancedFilters]);

  const fetchOptions = async () => {
    try {
      const [projectsRes, codesRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/financial-codes')
      ]);
      const [projectsData, codesData] = await Promise.all([
        projectsRes.json(),
        codesRes.json()
      ]);
      setProjects(Array.isArray(projectsData) ? projectsData : projectsData.data || []);
      setFinancialCodes(Array.isArray(codesData) ? codesData : codesData.data || []);
    } catch (err) {
      console.error('Failed to load options', err);
    }
  };

  useEffect(() => {
    fetchOptions();
  }, []);

  // Fetch ALL waybill items on mount, then do client-side filtering/sorting/pagination
  useEffect(() => {
    if (!filtersInitialized) return;
    
    const fetchAllItems = async () => {
      setLoading(true);
      logFilter('FETCH_ALL_ITEMS_START', {
        appliedSearch,
        periodFrom,
        periodTo,
        sortColumn,
        sortDirection,
        columnFiltersCount: columnFilters.length,
        advancedFiltersCount: advancedFilters.size
      });
      try {
        const requestParams = {
          limit: 10000,
          offset: 0,
          includeFacets: false,
          ...(appliedSearch.trim() && { search: appliedSearch.trim() }),
          ...(periodFrom && { periodFrom }),
          ...(periodTo && { periodTo }),
          ...(sortColumn && { sortColumn }),
          ...(sortDirection && { sortDirection }),
        };

        const serializedFilters = columnFilters.reduce<Array<[string, any[]]>>((acc: Array<[string, any[]]>, filter: { id: string; value: any[] }) => {
          if (typeof filter.id !== 'string' || !Array.isArray(filter.value)) return acc;
          const selectedValues = filter.value.map((v: any) => v === BLANK_FACET_TOKEN ? '' : (v === null || v === undefined ? '' : v));
          if (selectedValues.length === 0) return acc;
          acc.push([filter.id as ColumnKey, selectedValues]);
          return acc;
        }, []);
        
        if (serializedFilters.length > 0) {
          (requestParams as any).filters = serializedFilters;
        }
        
        if (advancedFilters.size > 0) {
          const advancedArr: Array<[string, any]> = [];
          advancedFilters.forEach((filter, key) => {
            advancedArr.push([key, filter]);
          });
          (requestParams as any).advancedFilters = advancedArr;
        }

        const queryString = new URLSearchParams();
        Object.entries(requestParams).forEach(([key, value]) => {
          if (value === undefined || value === null) return;
          if (typeof value === 'boolean') queryString.set(key, String(value));
          else if (typeof value === 'number') queryString.set(key, String(value));
          else if (typeof value === 'string') queryString.set(key, value);
          else queryString.set(key, JSON.stringify(value));
        });

        const urlLength = `/api/waybill-items?${queryString.toString()}`.length;
        const usePost = urlLength > 2000;

        let res;
        if (usePost) {
          res = await fetch('/api/waybill-items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestParams),
          });
        } else {
          res = await fetch(`/api/waybill-items?${queryString.toString()}`);
        }

        const body = await res.json();
        setData(body.data || []);
        setTotal(body.total || 0);
        logFilter('FETCH_ALL_ITEMS_SUCCESS', { 
          dataCount: (body.data || []).length,
          total: body.total || 0,
          usePost,
          urlLength,
          appliedFiltersCount: columnFilters.length + advancedFilters.size,
          hasSearch: !!appliedSearch,
          hasPeriodFrom: !!periodFrom,
          hasPeriodTo: !!periodTo
        });
        setCurrentPage(1);
      } catch (err) {
        logFilter('FETCH_ALL_ITEMS_ERROR', { error: err instanceof Error ? err.message : String(err) });
        console.error('Failed to load waybill items', err);
        alert('Failed to load waybill items');
      } finally {
        setLoading(false);
      }
    };

    fetchAllItems();
  }, [filtersInitialized, appliedSearch, periodFrom, periodTo, sortColumn, sortDirection, columnFilters, advancedFilters]);

  useEffect(() => {
    const applyPendingResize = () => {
      const pending = resizePendingRef.current;
      if (pending) {
        pending.element.style.width = `${pending.width}px`;
        pending.element.style.minWidth = `${pending.width}px`;
        pending.element.style.maxWidth = `${pending.width}px`;
      }
      resizeRafRef.current = null;
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizing) return;
      const delta = event.clientX - isResizing.startX;
      const nextWidth = Math.max(20, isResizing.startWidth + delta);
      resizePendingRef.current = { element: isResizing.element, width: nextWidth };
      if (resizeRafRef.current === null) {
        resizeRafRef.current = window.requestAnimationFrame(applyPendingResize);
      }
    };

    const handleMouseUp = () => {
      if (!isResizing) return;
      if (resizeRafRef.current !== null) {
        window.cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = null;
      }
      const pendingWidth = resizePendingRef.current?.width;
      const finalWidth = pendingWidth ?? parseInt(isResizing.element.style.width, 10);
      resizePendingRef.current = null;
      setColumns((prev) =>
        prev.map((col) => (col.key === isResizing.column ? { ...col, width: finalWidth } : col))
      );
      setIsResizing(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (resizeRafRef.current !== null) {
        window.cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = null;
      }
      resizePendingRef.current = null;
    };
  }, [isResizing]);

  const handleDragStart = (event: React.DragEvent<HTMLTableCellElement>, key: ColumnKey) => {
    setDraggedColumn(key);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (event: React.DragEvent<HTMLTableCellElement>, key: ColumnKey) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (draggedColumn && draggedColumn !== key) {
      setDragOverColumn(key);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (event: React.DragEvent<HTMLTableCellElement>, targetKey: ColumnKey) => {
    event.preventDefault();
    if (!draggedColumn || draggedColumn === targetKey) return;

    setColumns((prev) => {
      const fromIndex = prev.findIndex((col) => col.key === draggedColumn);
      const toIndex = prev.findIndex((col) => col.key === targetKey);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });

    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    try {
      const res = await fetch(`/api/waybill-items?id=${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_uuid: editing.project_uuid || null,
          financial_code_uuid: editing.financial_code_uuid || null,
          corresponding_account: editing.corresponding_account || null,
        })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Update failed');
      if (body?.data) {
        setData((prev) => prev.map((row) => (row.id === body.data.id ? body.data : row)));
      }
      setEditing(null);
    } catch (err: any) {
      console.error('Update error', err);
      alert(err?.message || 'Update failed');
    }
  };

  const projectOptions = useMemo(() => projects.map((p: any) => ({
    value: p.project_uuid,
    label: p.project_name || p.project_index || p.projectIndex || p.project_uuid,
    keywords: `${p.project_name || p.project_index || p.projectIndex || ''}`.trim()
  })), [projects]);

  const projectOptionsWithNone = useMemo(() => ([
    { value: NONE_OPTION_VALUE, label: 'No project', keywords: 'none no clear' },
    ...projectOptions,
  ]), [projectOptions]);

  const financialCodeOptions = useMemo(() => financialCodes.map((c: any) => ({
    value: c.uuid,
    label: c.validation || c.code || c.uuid,
    keywords: `${c.validation || ''} ${c.code || ''}`.trim()
  })), [financialCodes]);

  const financialCodeOptionsWithNone = useMemo(() => ([
    { value: NONE_OPTION_VALUE, label: 'No financial code', keywords: 'none no clear' },
    ...financialCodeOptions,
  ]), [financialCodeOptions]);

  const projectLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((project: any) => {
      if (!project?.project_uuid) return;
      const label = project.project_name || project.project_index || project.projectIndex || project.project_uuid;
      map.set(project.project_uuid, label);
    });
    return map;
  }, [projects]);

  const financialCodeLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    financialCodes.forEach((code: any) => {
      if (!code?.uuid) return;
      const label = code.validation || code.code || code.uuid;
      map.set(code.uuid, label);
    });
    return map;
  }, [financialCodes]);

  const getCellValue = useCallback((row: WaybillItem, columnKey: ColumnKey) => {
    if (columnKey === 'project_uuid') {
      if (!row.project_uuid) return '';
      const project = projects.find(p => p.project_uuid === row.project_uuid);
      if (!project) return projectLabelMap.get(row.project_uuid) || row.project_uuid || '';
      const projectName = project.project_name || '';
      const projectIndex = project.project_index || '';
      const currency = project.currency || '';
      const parts = [projectName, projectIndex, currency].filter(p => p);
      return parts.join(' | ');
    }
    if (columnKey === 'financial_code_uuid') {
      return financialCodeLabelMap.get(row.financial_code_uuid || '') || row.financial_code_uuid || '';
    }
    return (row as any)[columnKey];
  }, [financialCodeLabelMap, projectLabelMap, projects]);

  const visibleColumns = useMemo(() => columns.filter((col) => col.visible), [columns]);

  const getUniqueValues = useCallback((columnKey: ColumnKey): any[] => {
    const values = new Set<any>();
    data.forEach((row) => {
      const value = (row as any)[columnKey];
      values.add(value === null || value === undefined ? '' : value);
    });
    return Array.from(values).sort();
  }, [data]);

  const filteredData = useMemo(() => data, [data]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredData.slice(start, end);
  }, [filteredData, currentPage, pageSize]);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: paginatedData.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 44,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const renderFilterValue = useCallback((columnKey: ColumnKey, value: any) => {
    if (value === null || value === undefined || value === '') return '(Blank)';
    if (columnKey === 'project_uuid') {
      const project = projects.find(p => p.project_uuid === String(value));
      if (project) {
        const parts = [project.project_name, project.project_index].filter(p => p);
        return parts.join(' | ');
      }
      return projectLabelMap.get(String(value)) || String(value);
    }
    if (columnKey === 'financial_code_uuid') {
      return financialCodeLabelMap.get(String(value)) || String(value);
    }
    if (columnKey === 'waybill_vat') {
      return value ? 'Yes' : 'No';
    }
    return String(value);
  }, [financialCodeLabelMap, projectLabelMap, projects]);

  const runSearch = () => {
    const nextSearch = search.trim();
    logFilter('SEARCH_SUBMITTED', { searchTerm: nextSearch, previousPage: currentPage });
    setAppliedSearch(nextSearch);
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      setCurrentPage(1);
      await new Promise(resolve => setTimeout(resolve, 500));
    } finally {
      setIsRefreshing(false);
    }
  };

  const visibleIds = useMemo(
    () => paginatedData.map((row) => row.id).filter((id) => Number.isFinite(id)),
    [paginatedData]
  );
  const visibleSelectedCount = useMemo(
    () => visibleIds.filter((id) => selectedIds.has(id)).length,
    [visibleIds, selectedIds]
  );
  const allVisibleSelected = visibleIds.length > 0 && visibleSelectedCount === visibleIds.length;
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;

  const toggleSelectAllVisible = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        visibleIds.forEach((id) => next.add(id));
      } else {
        visibleIds.forEach((id) => next.delete(id));
      }
      return next;
    });
  };

  const toggleSelectRow = useCallback((id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const renderedRows = useMemo(() => {
    if (paginatedData.length === 0) {
      return (
        <tr style={{ display: 'table', width: '100%', tableLayout: 'fixed' }}>
          <td className="px-3 py-6 text-center text-muted-foreground" colSpan={visibleColumns.length + 2}>
            {loading ? 'Loading...' : 'No items found'}
          </td>
        </tr>
      );
    }

    return virtualRows.map((virtualRow) => {
      const row = paginatedData[virtualRow.index];
      if (!row) return null;
      return (
        <tr
          key={row.id}
          data-index={virtualRow.index}
          ref={rowVirtualizer.measureElement}
          className="border-t"
          style={{
            position: 'absolute',
            top: 0,
            transform: `translateY(${virtualRow.start}px)`,
            display: 'table',
            width: '100%',
            tableLayout: 'fixed',
          }}
        >
          <td className="px-3 py-2" style={{ width: 48, minWidth: 48, maxWidth: 48 }}>
            <Checkbox
              checked={selectedIds.has(row.id)}
              onCheckedChange={(checked) => toggleSelectRow(row.id, Boolean(checked))}
            />
          </td>
          {visibleColumns.map((col) => (
            <td
              key={col.key}
              className="overflow-hidden px-3 py-2"
              style={{ width: col.width, minWidth: col.width, maxWidth: col.width }}
            >
              <div
                className="truncate"
                title={String(formatCell(getCellValue(row, col.key), col.format))}
              >
                {formatCell(getCellValue(row, col.key), col.format)}
              </div>
            </td>
          ))}
          <td className="px-3 py-2" style={{ width: 96, minWidth: 96, maxWidth: 96 }}>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelected(row)}>
                <Eye className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditing(row)}>
                <Edit2 className="h-4 w-4" />
              </Button>
            </div>
          </td>
        </tr>
      );
    });
  }, [paginatedData, loading, selectedIds, setEditing, setSelected, toggleSelectRow, visibleColumns, getCellValue, virtualRows, rowVirtualizer]);

  const resetBulkEdit = () => {
    setBulkProjectUuid('');
    setBulkFinancialCodeUuid('');
    setBulkCorrespondingAccount('');
    setIsBulkSaving(false);
  };

  const handleBulkEditSave = async () => {
    if (!selectedIds.size) return;
    if (!bulkProjectUuid && !bulkFinancialCodeUuid && !bulkCorrespondingAccount) {
      alert('Select at least one field to update');
      return;
    }
    setIsBulkSaving(true);
    try {
      const payload: Record<string, any> = {
        ids: Array.from(selectedIds),
      };

      if (bulkProjectUuid !== '') {
        payload.project_uuid = bulkProjectUuid === NONE_OPTION_VALUE ? null : bulkProjectUuid;
      }

      if (bulkFinancialCodeUuid !== '') {
        payload.financial_code_uuid =
          bulkFinancialCodeUuid === NONE_OPTION_VALUE ? null : bulkFinancialCodeUuid;
      }

      if (bulkCorrespondingAccount !== '') {
        payload.corresponding_account =
          bulkCorrespondingAccount === NONE_OPTION_VALUE ? null : bulkCorrespondingAccount;
      }

      const response = await fetch('/api/waybill-items/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'Bulk update failed');
      }
      setData((prev) =>
        prev.map((row) => {
          if (!selectedIds.has(row.id)) return row;
          return {
            ...row,
            project_uuid: bulkProjectUuid !== ''
              ? (bulkProjectUuid === NONE_OPTION_VALUE ? null : bulkProjectUuid)
              : row.project_uuid || null,
            financial_code_uuid: bulkFinancialCodeUuid !== ''
              ? (bulkFinancialCodeUuid === NONE_OPTION_VALUE ? null : bulkFinancialCodeUuid)
              : row.financial_code_uuid || null,
            corresponding_account: bulkCorrespondingAccount !== ''
              ? (bulkCorrespondingAccount === NONE_OPTION_VALUE ? null : bulkCorrespondingAccount)
              : row.corresponding_account || null,
          };
        })
      );
      setSelectedIds(new Set());
      setIsBulkEditOpen(false);
      resetBulkEdit();
    } catch (err: any) {
      console.error('Bulk update error', err);
      alert(err?.message || 'Bulk update failed');
    } finally {
      setIsBulkSaving(false);
    }
  };

  const handleClearFilters = () => {
    logFilter('CLEAR_FILTERS_START', { 
      columnFiltersCount: columnFilters.length,
      advancedFiltersCount: advancedFilters.size,
      hasSearch: !!appliedSearch,
      periodFrom,
      periodTo,
    });
    setColumnFilters([]);
    setAdvancedFilters(new Map());
    setSearch('');
    setAppliedSearch('');
    setPeriodFrom('');
    setPeriodTo('');
    setCurrentPage(1);
    logFilter('CLEAR_FILTERS_COMPLETE', { timestamp: new Date().toISOString() });
  };

  const handleExportXlsx = async () => {
    if (filteredData.length === 0) {
      alert('No data to export');
      return;
    }
    try {
      setIsExporting(true);
      const params = new URLSearchParams();
      if (appliedSearch.trim()) params.set('search', appliedSearch.trim());
      if (periodFrom) params.set('periodFrom', periodFrom);
      if (periodTo) params.set('periodTo', periodTo);
      if (sortColumn) params.set('sortColumn', sortColumn);
      if (sortDirection) params.set('sortDirection', sortDirection);
      params.set('includeFacets', 'false');
      params.set('exportAll', 'true');
      const exportFilters = buildQueryParams({ includeFacets: false, includePagination: false }).get('filters');
      if (exportFilters) params.set('filters', exportFilters);

      const response = await fetch(`/api/waybill-items?${params.toString()}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'Failed to export items');
      const exportData: WaybillItem[] = Array.isArray(body.data) ? body.data : [];
      if (exportData.length === 0) {
        alert('No data to export');
        return;
      }

      const formatExportDate = (value: any) => {
        const date = typeof value === 'string' || value instanceof Date ? new Date(value) : null;
        if (!date || Number.isNaN(date.getTime())) return '';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear());
        return `${day}.${month}.${year}`;
      };

      const toExcelSerial = (value: string) => {
        if (!value) return null;
        const trimmed = value.trim();
        if (!trimmed) return null;
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(trimmed)) {
          const [dayStr, monthStr, yearStr] = trimmed.split('.');
          const day = Number(dayStr);
          const month = Number(monthStr);
          const year = Number(yearStr);
          if (!day || !month || !year) return null;
          const utc = Date.UTC(year, month - 1, day);
          return utc / 86400000 + 25569;
        }
        const parsed = new Date(trimmed);
        if (Number.isNaN(parsed.getTime())) return null;
        const utc = Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
        return utc / 86400000 + 25569;
      };

      const exportColumns = visibleColumns;
      const dateColumnIndexes = exportColumns
        .map((col, index) => ((col.format === 'date' || col.format === 'datetime') ? index : -1))
        .filter((index) => index >= 0);

      const header = exportColumns.map((col) => col.label);
      const rows = exportData.map((row) =>
        exportColumns.map((col) => {
          const rawValue = getCellValue(row, col.key);
          if (col.format === 'date' || col.format === 'datetime') {
            return formatExportDate(rawValue);
          }
          if (col.format === 'boolean') return rawValue ? 'Yes' : 'No';
          if (rawValue === null || rawValue === undefined) return '';
          return String(rawValue);
        })
      );

      const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
      if (dateColumnIndexes.length > 0) {
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
          for (const colIndex of dateColumnIndexes) {
            const value = rows[rowIndex][colIndex];
            const serial = toExcelSerial(String(value || ''));
            if (serial === null) continue;
            const cellAddress = XLSX.utils.encode_cell({ r: rowIndex + 1, c: colIndex });
            worksheet[cellAddress] = { t: 'n', v: serial, z: 'dd.mm.yyyy' };
          }
        }
      }
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Waybill Items');
      const dateStamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `waybill-items-${dateStamp}.xlsx`, { bookType: 'xlsx' });
    } catch (error: any) {
      alert(error?.message || 'Failed to export items');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                logFilter('SEARCH_INPUT_CHANGED', { searchTerm: e.target.value, length: e.target.value.length });
                setSearch(e.target.value);
              }}
              placeholder="Search items..."
              className="pl-9"
              onKeyDown={(e) => {
                if (e.key === 'Enter') runSearch();
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1">
              <Label htmlFor="itemsPeriodFrom" className="text-xs text-gray-600 whitespace-nowrap">From period</Label>
              <Input
                id="itemsPeriodFrom"
                type="month"
                value={periodFrom}
                onChange={(e) => {
                  logFilter('PERIOD_FROM_CHANGED', { newValue: e.target.value, oldValue: periodFrom });
                  setPeriodFrom(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 w-36"
              />
            </div>
            <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1">
              <Label htmlFor="itemsPeriodTo" className="text-xs text-gray-600 whitespace-nowrap">To period</Label>
              <Input
                id="itemsPeriodTo"
                type="month"
                value={periodTo}
                onChange={(e) => {
                  logFilter('PERIOD_TO_CHANGED', { newValue: e.target.value, oldValue: periodTo });
                  setPeriodTo(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 w-36"
              />
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            title="Refresh data"
          >
            <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64">
              <div className="space-y-3">
                <div className="text-sm font-medium">Show columns</div>
                <div className="space-y-2 max-h-64 overflow-auto">
                  {columns.map((col) => (
                    <label key={col.key} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={col.visible}
                        onCheckedChange={(checked) =>
                          setColumns((prev) =>
                            prev.map((item) =>
                              item.key === col.key ? { ...item, visible: Boolean(checked) } : item
                            )
                          )
                        }
                      />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <ClearFiltersButton
            activeCount={
              columnFilters.length +
              advancedFilters.size +
              (appliedSearch ? 1 : 0) +
              (periodFrom ? 1 : 0) +
              (periodTo ? 1 : 0)
            }
            onClear={handleClearFilters}
          />
          {selectedIds.size > 0 && (
            <Dialog open={isBulkEditOpen} onOpenChange={(open) => {
              setIsBulkEditOpen(open);
              if (!open) resetBulkEdit();
            }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Bulk Edit Items</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Project</Label>
                    <Combobox
                      options={projectOptionsWithNone}
                      value={bulkProjectUuid}
                      onValueChange={setBulkProjectUuid}
                      placeholder="Select project"
                      searchPlaceholder="Search projects..."
                      emptyText="No projects found"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Financial Code</Label>
                    <Combobox
                      options={financialCodeOptionsWithNone}
                      value={bulkFinancialCodeUuid}
                      onValueChange={setBulkFinancialCodeUuid}
                      placeholder="Select financial code"
                      searchPlaceholder="Search financial codes..."
                      emptyText="No financial codes found"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Corresponding Account</Label>
                    <select
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={bulkCorrespondingAccount}
                      onChange={(e) => setBulkCorrespondingAccount(e.target.value)}
                    >
                      <option value="">Select account</option>
                      <option value={NONE_OPTION_VALUE}>No corresponding account</option>
                      {CORRESPONDING_ACCOUNTS.map((acc) => (
                        <option key={acc} value={acc}>{acc}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsBulkEditOpen(false)} disabled={isBulkSaving}>
                    Cancel
                  </Button>
                  <Button onClick={handleBulkEditSave} disabled={isBulkSaving}>
                    {isBulkSaving ? 'Saving...' : 'Apply Updates'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportXlsx}
            disabled={isExporting || filteredData.length === 0}
          >
            {isExporting ? 'Exporting...' : 'Export XLSX'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <div>Total records: {filteredData.length}</div>
        <div className="flex items-center gap-2">
          <span>Rows per page</span>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={pageSize}
            onChange={(e) => {
              const nextSize = Number(e.target.value) || 200;
              setPageSize(nextSize);
              setCurrentPage(1);
            }}
          >
            {[100, 200, 300, 500, 1000].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
      </div>

      <div ref={tableContainerRef} className="overflow-auto border rounded max-h-[70vh]">
        <table style={{ tableLayout: 'fixed', width: '100%' }} className="min-w-full text-sm">
          <thead
            className="bg-background"
            style={{
              display: 'table',
              width: '100%',
              tableLayout: 'fixed',
              position: 'sticky',
              top: 0,
              zIndex: 20,
            }}
          >
            <tr>
              <th
                className="text-left px-3 py-2"
                style={{ width: 48, minWidth: 48, maxWidth: 48 }}
              >
                <Checkbox
                  checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                  onCheckedChange={(checked) => toggleSelectAllVisible(Boolean(checked))}
                  disabled={!visibleIds.length}
                />
              </th>
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  className={`text-left px-3 py-2 relative select-none cursor-move overflow-hidden ${
                    draggedColumn === col.key ? 'opacity-50' : ''
                  } ${
                    dragOverColumn === col.key ? 'border-l-4 border-blue-500' : ''
                  }`}
                  style={{ width: col.width, minWidth: col.width, maxWidth: col.width }}
                  draggable={!isResizing}
                  onDragStart={(event) => handleDragStart(event, col.key)}
                  onDragOver={(event) => handleDragOver(event, col.key)}
                  onDragLeave={handleDragLeave}
                  onDrop={(event) => handleDrop(event, col.key)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="flex items-center gap-2 pr-4 overflow-hidden">
                    <button
                      type="button"
                      className="flex items-center gap-1 min-w-0"
                      onClick={() => {
                        if (!col.sortable) return;
                        const current = sorting;
                        if (current?.id === col.key) {
                          setSorting({ id: col.key, desc: !current.desc });
                        } else {
                          setSorting({ id: col.key, desc: false });
                        }
                      }}
                    >
                      <span className="truncate font-medium">{col.label}</span>
                      {sortColumn === col.key && (sortDirection === 'asc' ? (
                        <ArrowUp className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-muted-foreground" />
                      ))}
                    </button>
                    {col.filterable && (
                      <ColumnFilterPopover
                        columnKey={col.key}
                        columnLabel={col.label}
                        values={getUniqueValues(col.key)}
                        activeFilters={filtersMap.get(col.key) || new Set()}
                        activeFilter={advancedFilters.get(col.key)}
                        onFilterChange={(values) => {
                          logFilter('COLUMN_FILTER_CHANGED', { columnKey: col.key, columnLabel: col.label, filterCount: values.size });
                          setColumnFilters((prev: { id: string; value: any[] }[]) => {
                            const existing = prev.find(f => f.id === col.key);
                            if (values.size === 0) {
                              return prev.filter(f => f.id !== col.key);
                            }
                            const newFilter = { id: col.key, value: Array.from(values) };
                            if (existing) {
                              return prev.map(f => f.id === col.key ? newFilter : f);
                            }
                            return [...prev, newFilter];
                          });
                          setCurrentPage(1);
                        }}
                        {...(!col.format || col.format === 'text' ? {
                          onAdvancedFilterChange: (filter: ColumnFilter | null) => {
                            logFilter('ADVANCED_FILTER_CHANGED', { columnKey: col.key, columnLabel: col.label });
                            setAdvancedFilters((prev: Map<ColumnKey, ColumnFilter>) => {
                              const next = new Map(prev);
                              if (filter) next.set(col.key, filter);
                              else next.delete(col.key);
                              return next;
                            });
                            setCurrentPage(1);
                          },
                        } : {})}
                        onSort={(direction) => {
                          logFilter('SORT_CHANGED', { columnKey: col.key, columnLabel: col.label, direction });
                          setSorting({ id: col.key, desc: direction === 'desc' });
                          setCurrentPage(1);
                        }}
                        columnFormat={col.format}
                        renderValue={(value) => renderFilterValue(col.key, value)}
                      />
                    )}
                  </div>
                  <div
                    className="absolute top-0 right-0 bottom-0 w-5 cursor-col-resize hover:bg-blue-500/20 active:bg-blue-600/40 z-10"
                    style={{ marginRight: '-10px' }}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      const thElement = event.currentTarget.parentElement as HTMLElement | null;
                      if (!thElement) return;
                      setIsResizing({
                        column: col.key,
                        startX: event.clientX,
                        startWidth: col.width,
                        element: thElement,
                      });
                    }}
                    title="Drag to resize"
                  >
                    <div className="absolute right-2 top-0 bottom-0 w-1 bg-gray-300 hover:bg-blue-500 transition-colors" />
                  </div>
                </th>
              ))}
              <th
                className="text-left px-3 py-2"
                style={{ width: 96, minWidth: 96, maxWidth: 96 }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody style={{ display: 'block', position: 'relative', height: totalSize, width: '100%' }}>
            {renderedRows}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div>
          Page {currentPage} of {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1 || loading}
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages || loading}
            onClick={() =>
              setCurrentPage((prev) => Math.min(totalPages || 1, prev + 1))
            }
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Item Details</DialogTitle>
          </DialogHeader>
          <pre className="text-xs bg-muted/50 p-3 rounded max-h-[60vh] overflow-auto">
            {selected ? JSON.stringify(selected, null, 2) : ''}
          </pre>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Project</Label>
                <Combobox
                  options={projectOptionsWithNone}
                  value={editing.project_uuid ?? NONE_OPTION_VALUE}
                  onValueChange={(value) =>
                    setEditing({
                      ...editing,
                      project_uuid: value === NONE_OPTION_VALUE ? null : value,
                    })
                  }
                  placeholder="Select project"
                  searchPlaceholder="Search projects..."
                  emptyText="No projects found"
                />
              </div>
              <div className="space-y-2">
                <Label>Financial Code</Label>
                <Combobox
                  options={financialCodeOptionsWithNone}
                  value={editing.financial_code_uuid ?? NONE_OPTION_VALUE}
                  onValueChange={(value) =>
                    setEditing({
                      ...editing,
                      financial_code_uuid: value === NONE_OPTION_VALUE ? null : value,
                    })
                  }
                  placeholder="Select financial code"
                  searchPlaceholder="Search financial codes..."
                  emptyText="No financial codes found"
                />
              </div>
              <div className="space-y-2">
                <Label>Corresponding Account</Label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={editing.corresponding_account ?? NONE_OPTION_VALUE}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      corresponding_account: e.target.value === NONE_OPTION_VALUE
                        ? null
                        : e.target.value,
                    })
                  }
                >
                  <option value={NONE_OPTION_VALUE}>No corresponding account</option>
                  {CORRESPONDING_ACCOUNTS.map((acc) => (
                    <option key={acc} value={acc}>{acc}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button onClick={handleSaveEdit}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
