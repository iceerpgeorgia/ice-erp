'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Combobox } from '@/components/ui/combobox';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Search, Upload, Eye, Edit2, Settings, ArrowUp, ArrowDown } from 'lucide-react';
import { ColumnFilterPopover } from './shared/column-filter-popover';
import * as XLSX from 'xlsx';

const CORRESPONDING_ACCOUNTS = [
  '1_4_30','1_6_10','1_6_20','1_6_30','1_6_55','1_6_70','2_1_50','2_1_60','2_1_70',
  '3_1_10','3_1_90','7_4_15','7_4_20','7_4_21','7_4_22','7_4_22_1','7_4_22_2','7_4_30',
  '7_4_41','7_4_42','7_4_45','7_4_56','7_4_60','7_4_65','7_4_70','7_4_85','7_4_90','7_4_91'
];
const NONE_OPTION_VALUE = '__none__';

type Waybill = {
  id: number;
  waybill_no?: string | null;
  state?: string | null;
  condition?: string | null;
  category?: string | null;
  type?: string | null;
  counteragent?: string | null;
  counteragent_inn?: string | null;
  counteragent_name?: string | null;
  counteragent_uuid?: string | null;
  vat?: boolean | null;
  sum?: string | null;
  driver?: string | null;
  driver_id?: string | null;
  driver_uuid?: string | null;
  vehicle?: string | null;
  transportation_sum?: string | null;
  departure_address?: string | null;
  shipping_address?: string | null;
  activation_time?: string | null;
  transportation_beginning_time?: string | null;
  submission_time?: string | null;
  cancellation_time?: string | null;
  note?: string | null;
  vat_doc_id?: string | null;
  stat?: string | null;
  transportation_cost?: string | null;
  rs_id?: string | null;
  project_uuid?: string | null;
  financial_code_uuid?: string | null;
  corresponding_account?: string | null;
  date?: string | null;
  period?: string | null;
};

type ColumnKey = keyof Waybill;

type ColumnConfig = {
  key: ColumnKey;
  label: string;
  visible: boolean;
  sortable?: boolean;
  filterable?: boolean;
  format?: 'date' | 'datetime' | 'boolean' | 'number';
  width: number;
};

const defaultColumns: ColumnConfig[] = [
  { key: 'waybill_no', label: 'Waybill No', visible: true, sortable: true, filterable: true, width: 140 },
  { key: 'state', label: 'State', visible: true, sortable: true, filterable: true, width: 120 },
  { key: 'condition', label: 'Condition', visible: true, sortable: true, filterable: true, width: 140 },
  { key: 'category', label: 'Category', visible: true, sortable: true, filterable: true, width: 140 },
  { key: 'type', label: 'Type', visible: true, sortable: true, filterable: true, width: 140 },
  { key: 'counteragent_name', label: 'Counteragent', visible: true, sortable: true, filterable: true, width: 240 },
  { key: 'counteragent_inn', label: 'INN', visible: true, sortable: true, filterable: true, width: 140 },
  { key: 'vat', label: 'VAT', visible: true, sortable: true, filterable: true, format: 'boolean', width: 80 },
  { key: 'sum', label: 'Sum', visible: true, sortable: true, filterable: true, format: 'number', width: 120 },
  { key: 'driver', label: 'Driver', visible: true, sortable: true, filterable: true, width: 200 },
  { key: 'vehicle', label: 'Vehicle', visible: true, sortable: true, filterable: true, width: 160 },
  { key: 'activation_time', label: 'Activation Time', visible: true, sortable: true, filterable: true, format: 'datetime', width: 190 },
  { key: 'date', label: 'Date', visible: true, sortable: true, filterable: true, width: 120 },
  { key: 'period', label: 'Period', visible: true, sortable: true, filterable: true, width: 120 },
  { key: 'rs_id', label: 'RS ID', visible: true, sortable: true, filterable: true, width: 140 },
  { key: 'transportation_sum', label: 'Transport Sum', visible: true, sortable: true, filterable: true, format: 'number', width: 140 },
  { key: 'transportation_cost', label: 'Transport Cost', visible: true, sortable: true, filterable: true, format: 'number', width: 140 },
  { key: 'shipping_address', label: 'Shipping Address', visible: true, sortable: true, filterable: true, width: 260 },
  { key: 'departure_address', label: 'Departure Address', visible: true, sortable: true, filterable: true, width: 260 },
  { key: 'project_uuid', label: 'Project', visible: true, sortable: true, filterable: true, width: 200 },
  { key: 'financial_code_uuid', label: 'Financial Code', visible: true, sortable: true, filterable: true, width: 220 },
  { key: 'corresponding_account', label: 'Corresponding Account', visible: true, sortable: true, filterable: true, width: 180 },
];

const formatCell = (value: any, format?: ColumnConfig['format']) => {
  if (value === null || value === undefined || value === '') return '-';
  if (format === 'boolean') return value ? 'Yes' : 'No';
  if (format === 'datetime') {
    const date = typeof value === 'string' || value instanceof Date ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : '-';
  }
  if (format === 'date') {
    const date = typeof value === 'string' || value instanceof Date ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString() : '-';
  }
  return String(value);
};

export function WaybillsTable() {
  const filtersStorageKey = 'waybillsFiltersV1';
  const [data, setData] = useState<Waybill[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selected, setSelected] = useState<Waybill | null>(null);
  const [editing, setEditing] = useState<Waybill | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkProjectUuid, setBulkProjectUuid] = useState('');
  const [bulkFinancialCodeUuid, setBulkFinancialCodeUuid] = useState('');
  const [bulkCorrespondingAccount, setBulkCorrespondingAccount] = useState('');
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [financialCodes, setFinancialCodes] = useState<any[]>([]);
  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);
  const [filters, setFilters] = useState<Map<ColumnKey, Set<any>>>(new Map());
  const [sortColumn, setSortColumn] = useState<ColumnKey>('activation_time');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showMissingCounteragents, setShowMissingCounteragents] = useState(false);
  const [missingCounteragentCount, setMissingCounteragentCount] = useState(0);
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
  const [facetValues, setFacetValues] = useState<Map<ColumnKey, any[]>>(new Map());
  const [isInitialized, setIsInitialized] = useState(false);
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const resizeRafRef = useRef<number | null>(null);
  const resizePendingRef = useRef<{ element: HTMLElement; width: number } | null>(null);
  const facetsRequestIdRef = useRef(0);

  useEffect(() => {
    const versionKey = 'waybillsColumnsVersion';
    const currentVersion = '1';
    const savedVersion = localStorage.getItem(versionKey);
    const shouldLoadSavedColumns = savedVersion === currentVersion;
    if (!shouldLoadSavedColumns) {
      localStorage.setItem('waybillsColumns', JSON.stringify(defaultColumns));
      localStorage.setItem(versionKey, currentVersion);
      setColumns(defaultColumns);
    }

    const saved = shouldLoadSavedColumns ? localStorage.getItem('waybillsColumns') : null;
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
        if (parsed.sortColumn) setSortColumn(parsed.sortColumn as ColumnKey);
        if (parsed.sortDirection === 'asc' || parsed.sortDirection === 'desc') {
          setSortDirection(parsed.sortDirection);
        }
        if (typeof parsed.pageSize === 'number') setPageSize(parsed.pageSize);
        if (typeof parsed.missingCounteragents === 'boolean') {
          setShowMissingCounteragents(parsed.missingCounteragents);
        }
        if (Array.isArray(parsed.filters)) {
          const restored = new Map<ColumnKey, Set<any>>(
            parsed.filters.map(([key, values]: [ColumnKey, any[]]) => [key, new Set(values)])
          );
          setFilters(restored);
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
      sortColumn,
      sortDirection,
      pageSize,
      missingCounteragents: showMissingCounteragents,
      filters: Array.from(filters.entries()).map(([key, set]) => [key, Array.from(set)]),
    };
    localStorage.setItem(filtersStorageKey, JSON.stringify(serialized));
  }, [
    filtersInitialized,
    search,
    appliedSearch,
    sortColumn,
    sortDirection,
    pageSize,
    showMissingCounteragents,
    filters,
    filtersStorageKey,
  ]);

  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
      localStorage.setItem('waybillsColumns', JSON.stringify(columns));
    }
  }, [columns, isInitialized]);

  const buildWaybillsQueryParams = useCallback((options: {
    page?: number;
    pageSize?: number;
    includeFacets: boolean;
    includePagination?: boolean;
  }) => {
    const params = new URLSearchParams();
    if (appliedSearch.trim()) params.set('search', appliedSearch.trim());
    if (options.includePagination !== false) {
      const resolvedPage = options.page ?? currentPage;
      const resolvedSize = options.pageSize ?? pageSize;
      const offset = Math.max(resolvedPage - 1, 0) * resolvedSize;
      params.set('limit', String(resolvedSize));
      params.set('offset', String(offset));
    }
    params.set('includeFacets', options.includeFacets ? 'true' : 'false');
    if (showMissingCounteragents) params.set('missingCounteragents', 'true');
    if (sortColumn) params.set('sortColumn', sortColumn);
    if (sortDirection) params.set('sortDirection', sortDirection);
    if (filters.size > 0) {
      const serialized = Array.from(filters.entries()).map(([key, set]) => [key, Array.from(set)]);
      params.set('filters', JSON.stringify(serialized));
    }
    return params;
  }, [appliedSearch, currentPage, pageSize, showMissingCounteragents, sortColumn, sortDirection, filters]);

  const fetchWaybills = useCallback(async (options?: { page?: number; pageSize?: number }) => {
    setLoading(true);
    try {
      const params = buildWaybillsQueryParams({
        page: options?.page,
        pageSize: options?.pageSize,
        includeFacets: false,
      });
      const res = await fetch(`/api/waybills?${params.toString()}`);
      const body = await res.json();
      setData(body.data || []);
      setTotal(body.total || 0);
      setMissingCounteragentCount(Number(body.missingCounteragentCount || 0));
    } catch (err) {
      console.error('Failed to load waybills', err);
      alert('Failed to load waybills');
    } finally {
      setLoading(false);
    }
  }, [buildWaybillsQueryParams]);

  const fetchWaybillFacets = useCallback(async () => {
    const requestId = facetsRequestIdRef.current + 1;
    facetsRequestIdRef.current = requestId;
    try {
      const params = buildWaybillsQueryParams({ includeFacets: true, includePagination: false });
      const res = await fetch(`/api/waybills?${params.toString()}`);
      const body = await res.json();
      if (requestId !== facetsRequestIdRef.current) {
        return;
      }
      const nextFacets = new Map<ColumnKey, string[]>();
      if (body?.facets && typeof body.facets === 'object') {
        Object.entries(body.facets).forEach(([key, values]) => {
          if (Array.isArray(values)) {
            nextFacets.set(key as ColumnKey, values as any[]);
          }
        });
      }
      setFacetValues(nextFacets);
    } catch (err) {
      console.error('Failed to load waybills facets', err);
    }
  }, [buildWaybillsQueryParams]);

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

  useEffect(() => {
    fetchWaybills();
  }, [fetchWaybills]);

  useEffect(() => {
    fetchWaybillFacets();
  }, [fetchWaybillFacets]);

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

  const handleImport = async (file: File) => {
    setFileUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/waybills/import', { method: 'POST', body: formData });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Import failed');
      alert(`Imported ${body.imported || 0} waybill(s)`);
      await fetchWaybills();
    } catch (err: any) {
      console.error('Import error', err);
      alert(err?.message || 'Import failed');
    } finally {
      setFileUploading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    try {
      const res = await fetch(`/api/waybills?id=${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_uuid: editing.project_uuid || null,
          financial_code_uuid: editing.financial_code_uuid || null,
          corresponding_account: editing.corresponding_account || null,
          note: editing.note || null,
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
    label: p.project_index || p.projectIndex || p.project_uuid,
    keywords: `${p.project_index || p.projectIndex || ''}`.trim()
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
      const label = project.project_index || project.projectIndex || project.project_uuid;
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

  const getCellValue = (row: Waybill, columnKey: ColumnKey) => {
    if (columnKey === 'project_uuid') {
      return projectLabelMap.get(row.project_uuid || '') || row.project_uuid || '';
    }
    if (columnKey === 'financial_code_uuid') {
      return financialCodeLabelMap.get(row.financial_code_uuid || '') || row.financial_code_uuid || '';
    }
    return (row as any)[columnKey];
  };

  const visibleColumns = useMemo(() => columns.filter((col) => col.visible), [columns]);

  const fallbackFacetValues = useMemo(() => {
    const next = new Map<ColumnKey, any[]>();
    const filterableColumns = columns.filter((col) => col.filterable).map((col) => col.key);
    for (const key of filterableColumns) {
      const values = new Set<any>();
      data.forEach((row) => {
        const value = (row as any)[key];
        values.add(value === null || value === undefined ? '' : value);
      });
      next.set(key, Array.from(values));
    }
    return next;
  }, [columns, data]);

  const filterOptions = useMemo(() => {
    return facetValues.size > 0 ? facetValues : fallbackFacetValues;
  }, [facetValues, fallbackFacetValues]);

  const getUniqueValues = (columnKey: ColumnKey) => filterOptions.get(columnKey) || [];

  const filteredData = useMemo(() => data, [data]);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredData.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 44,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const renderFilterValue = useCallback((columnKey: ColumnKey, value: any) => {
    if (value === null || value === undefined || value === '') return '(Blank)';
    if (columnKey === 'project_uuid') {
      return projectLabelMap.get(String(value)) || String(value);
    }
    if (columnKey === 'financial_code_uuid') {
      return financialCodeLabelMap.get(String(value)) || String(value);
    }
    if (columnKey === 'vat') {
      return value ? 'Yes' : 'No';
    }
    if (columnKey === 'date') {
      return String(value);
    }
    return String(value);
  }, [financialCodeLabelMap, projectLabelMap]);

  const sortPeriodValues = useCallback((values: any[]) => {
    const parsePeriod = (value: any) => {
      if (!value) return 0;
      const text = String(value).trim();
      const monthMatch = Date.parse(`1 ${text}`);
      if (!Number.isNaN(monthMatch)) return monthMatch;
      const isoMatch = Date.parse(text.length === 7 ? `${text}-01` : text);
      if (!Number.isNaN(isoMatch)) return isoMatch;
      return 0;
    };
    return [...values].sort((a, b) => parsePeriod(b) - parsePeriod(a));
  }, []);

  const sortDateValues = useCallback((values: any[]) => {
    const parseDate = (value: any) => {
      if (!value) return 0;
      const text = String(value).trim();
      const parts = text.split('.');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        const parsed = Date.parse(`${year}-${month}-${day}`);
        return Number.isNaN(parsed) ? 0 : parsed;
      }
      const parsed = Date.parse(text);
      return Number.isNaN(parsed) ? 0 : parsed;
    };
    return [...values].sort((a, b) => parseDate(b) - parseDate(a));
  }, []);

  const runSearch = () => {
    const nextSearch = search.trim();
    setAppliedSearch(nextSearch);
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([fetchWaybills(), fetchWaybillFacets()]);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const visibleIds = useMemo(
    () => filteredData.map((row) => row.id).filter((id) => Number.isFinite(id)),
    [filteredData]
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

  const toggleSelectRow = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const renderedRows = useMemo(() => {
    if (filteredData.length === 0) {
      return (
        <tr style={{ display: 'table', width: '100%', tableLayout: 'fixed' }}>
          <td className="px-3 py-6 text-center text-muted-foreground" colSpan={visibleColumns.length + 2}>
            {loading ? 'Loading...' : 'No waybills found'}
          </td>
        </tr>
      );
    }

    return virtualRows.map((virtualRow) => {
      const row = filteredData[virtualRow.index];
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
              className="px-3 py-2 overflow-visible"
              style={{ width: col.width, minWidth: col.width, maxWidth: col.width }}
            >
              <div
                className="whitespace-nowrap"
                title={String(
                  col.key === 'counteragent_name'
                    ? row.counteragent_name || row.counteragent || '-'
                    : formatCell(getCellValue(row, col.key), col.format)
                )}
              >
                {col.key === 'counteragent_name'
                  ? row.counteragent_name || row.counteragent || '-'
                  : formatCell(getCellValue(row, col.key), col.format)}
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
  }, [filteredData, loading, selectedIds, setEditing, setSelected, toggleSelectRow, visibleColumns, getCellValue, virtualRows, rowVirtualizer]);

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

      const response = await fetch('/api/waybills/bulk', {
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
    setFilters(new Map());
    setSearch('');
    setAppliedSearch('');
    setCurrentPage(1);
    setShowMissingCounteragents(false);
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
      if (showMissingCounteragents) params.set('missingCounteragents', 'true');
      if (sortColumn) params.set('sortColumn', sortColumn);
      if (sortDirection) params.set('sortDirection', sortDirection);
      params.set('includeFacets', 'false');
      params.set('exportAll', 'true');
      if (filters.size > 0) {
        const serialized = Array.from(filters.entries()).map(([key, set]) => [key, Array.from(set)]);
        params.set('filters', JSON.stringify(serialized));
      }

      const response = await fetch(`/api/waybills?${params.toString()}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'Failed to export waybills');
      const exportData: Waybill[] = Array.isArray(body.data) ? body.data : [];
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
        .map((col, index) => ((col.format === 'date' || col.format === 'datetime' || col.key === 'date') ? index : -1))
        .filter((index) => index >= 0);

      const header = exportColumns.map((col) => col.label);
      const rows = exportData.map((row) =>
        exportColumns.map((col) => {
          const rawValue = col.key === 'counteragent_name'
            ? row.counteragent_name || row.counteragent || ''
            : getCellValue(row, col.key);
          if (col.format === 'date' || col.format === 'datetime' || col.key === 'date') {
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
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Waybills');
      const dateStamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `waybills-${dateStamp}.xlsx`, { bookType: 'xlsx' });
    } catch (error: any) {
      alert(error?.message || 'Failed to export waybills');
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
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search waybills..."
              className="pl-9"
              onKeyDown={(e) => {
                if (e.key === 'Enter') runSearch();
              }}
            />
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearFilters}
            disabled={filters.size === 0 && !appliedSearch && !showMissingCounteragents}
          >
            Clear Filters
            {(filters.size > 0 || appliedSearch) && (
              <Badge variant="secondary" className="ml-2">
                {filters.size}
              </Badge>
            )}
          </Button>
          {(missingCounteragentCount > 0 || showMissingCounteragents) && (
            <Button
              variant={showMissingCounteragents ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setShowMissingCounteragents((prev) => !prev);
                setCurrentPage(1);
              }}
            >
              Missing Counteragents
              {missingCounteragentCount > 0 && (
                <Badge variant={showMissingCounteragents ? 'secondary' : 'outline'} className="ml-2">
                  {missingCounteragentCount}
                </Badge>
              )}
            </Button>
          )}
          {selectedIds.size > 0 && (
            <Dialog open={isBulkEditOpen} onOpenChange={(open) => {
              setIsBulkEditOpen(open);
              if (!open) resetBulkEdit();
            }}>
              <DialogTrigger asChild>
                <Button size="sm">
                  Bulk Edit ({selectedIds.size})
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Bulk Edit Waybills</DialogTitle>
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
          <input
            id="waybills-import"
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
              e.currentTarget.value = '';
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => document.getElementById('waybills-import')?.click()}
            disabled={fileUploading}
          >
            <Upload className="h-4 w-4 mr-2" />
            {fileUploading ? 'Importing...' : 'Import CSV'}
          </Button>
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
        <div>Total records: {total}</div>
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
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="flex items-center gap-1 whitespace-nowrap"
                      onClick={() => {
                        if (!col.sortable) return;
                        if (sortColumn === col.key) {
                          setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                        } else {
                          setSortColumn(col.key);
                          setSortDirection('asc');
                        }
                      }}
                    >
                      <span>{col.label}</span>
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
                        activeFilters={filters.get(col.key) || new Set()}
                        onFilterChange={(values) => {
                          setFilters((prev) => {
                            const next = new Map(prev);
                            if (values.size === 0) {
                              next.delete(col.key);
                            } else {
                              next.set(col.key, values);
                            }
                            return next;
                          });
                          setCurrentPage(1);
                        }}
                        onSort={(direction) => {
                          setSortColumn(col.key);
                          setSortDirection(direction);
                          setCurrentPage(1);
                        }}
                        renderValue={(value) => renderFilterValue(col.key, value)}
                        sortValues={
                          col.key === 'period'
                            ? sortPeriodValues
                            : col.key === 'date'
                              ? sortDateValues
                              : undefined
                        }
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
          Page {currentPage} of {Math.max(1, Math.ceil(total / pageSize))}
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
            disabled={currentPage >= Math.ceil(total / pageSize) || loading}
            onClick={() =>
              setCurrentPage((prev) => Math.min(Math.ceil(total / pageSize) || 1, prev + 1))
            }
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Waybill Details</DialogTitle>
          </DialogHeader>
          <pre className="text-xs bg-muted/50 p-3 rounded max-h-[60vh] overflow-auto">
            {selected ? JSON.stringify(selected, null, 2) : ''}
          </pre>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Waybill</DialogTitle>
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
              <div className="space-y-2">
                <Label>Note</Label>
                <Input
                  value={editing.note || ''}
                  onChange={(e) => setEditing({ ...editing, note: e.target.value })}
                />
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
