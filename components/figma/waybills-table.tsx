'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getCoreRowModel,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Combobox } from '@/components/ui/combobox';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Search, Upload, Eye, Edit2, Settings, ArrowUp, ArrowDown, UserPlus } from 'lucide-react';
import { ColumnFilterPopover } from './shared/column-filter-popover';
import { ClearFiltersButton } from './shared/clear-filters-button';
import { RequiredInsiderBadge } from './shared/required-insider-badge';
import { useRequiredInsiderName } from './shared/use-required-insider';
import { BLANK_FACET_TOKEN } from './shared/table-filters';
import type { ColumnFilter, ColumnFormat } from './shared/table-filters';
import * as XLSX from 'xlsx';
import { CounteragentFormDialog } from './CounteragentFormDialog';

const CORRESPONDING_ACCOUNTS = [
  '1_4_30','1_6_10','1_6_20','1_6_30','1_6_55','1_6_70','2_1_50','2_1_60','2_1_70',
  '3_1_10','3_1_90','7_4_15','7_4_20','7_4_21','7_4_22','7_4_22_1','7_4_22_2','7_4_30',
  '7_4_41','7_4_42','7_4_45','7_4_56','7_4_60','7_4_65','7_4_70','7_4_85','7_4_90','7_4_91'
];
const NONE_OPTION_VALUE = '__none__';
const NON_BLANK_FILTER_TOKEN = '__NON_BLANK__';

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
  insiderName?: string | null;
};

type ColumnKey = keyof Waybill;

type ColumnConfig = {
  key: ColumnKey;
  label: string;
  visible: boolean;
  sortable?: boolean;
  filterable?: boolean;
  format?: ColumnFormat;
  width: number;
};

const defaultColumns: ColumnConfig[] = [
  { key: 'waybill_no', label: 'Waybill', visible: true, sortable: true, filterable: true, width: 140 },
  { key: 'state', label: 'Status', visible: true, sortable: true, filterable: true, width: 120 },
  { key: 'condition', label: 'Condition', visible: true, sortable: true, filterable: true, width: 140 },
  { key: 'category', label: 'Category', visible: true, sortable: true, filterable: true, width: 140 },
  { key: 'type', label: 'Type', visible: true, sortable: true, filterable: true, width: 140 },
  { key: 'counteragent_name', label: 'Organization', visible: true, sortable: true, filterable: true, width: 240 },
  { key: 'insiderName', label: 'Insider', visible: true, sortable: false, filterable: false, width: 180 },
  { key: 'counteragent_inn', label: 'INN', visible: true, sortable: true, filterable: true, width: 140 },
  { key: 'vat', label: 'VAT', visible: true, sortable: true, filterable: true, format: 'boolean', width: 80 },
  { key: 'sum', label: 'Amount', visible: true, sortable: true, filterable: true, format: 'number', width: 120 },
  { key: 'driver', label: 'Driver', visible: true, sortable: true, filterable: true, width: 200 },
  { key: 'vehicle', label: 'Auto', visible: true, sortable: true, filterable: true, width: 160 },
  { key: 'transportation_sum', label: 'Transport Amount', visible: true, sortable: true, filterable: true, format: 'number', width: 140 },
  { key: 'departure_address', label: 'Departure Place', visible: true, sortable: true, filterable: true, width: 260 },
  { key: 'shipping_address', label: 'Delivery Address', visible: true, sortable: true, filterable: true, width: 260 },
  { key: 'activation_time', label: 'Activation Date', visible: true, sortable: true, filterable: true, format: 'datetime', width: 190 },
  { key: 'transportation_beginning_time', label: 'Transport Start', visible: true, sortable: true, filterable: true, format: 'datetime', width: 190 },
  { key: 'submission_time', label: 'Submission Date', visible: true, sortable: true, filterable: true, format: 'datetime', width: 190 },
  { key: 'cancellation_time', label: 'Cancellation Date', visible: false, sortable: true, filterable: true, format: 'datetime', width: 190 },
  { key: 'note', label: 'Note', visible: false, sortable: true, filterable: true, width: 260 },
  { key: 'date', label: 'Date', visible: false, sortable: true, filterable: true, width: 120 },
  { key: 'period', label: 'Period', visible: false, sortable: true, filterable: true, format: 'period', width: 120 },
  { key: 'rs_id', label: 'RS ID', visible: true, sortable: true, filterable: true, width: 140 },
  { key: 'transportation_cost', label: 'Transport Cost', visible: false, sortable: true, filterable: true, format: 'number', width: 140 },
  { key: 'project_uuid', label: 'Project', visible: true, sortable: true, filterable: true, width: 200 },
  { key: 'financial_code_uuid', label: 'Financial Code', visible: true, sortable: true, filterable: true, width: 220 },
  { key: 'corresponding_account', label: 'Corresponding Account', visible: true, sortable: true, filterable: true, width: 180 },
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
  return String(value);
};

export function WaybillsTable() {
  const requiredInsiderName = useRequiredInsiderName();
  const filtersStorageKey = 'waybillsFiltersV1';
  const [data, setData] = useState<Waybill[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
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
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [advancedFilters, setAdvancedFilters] = useState<Map<ColumnKey, ColumnFilter>>(new Map());
  const [sorting, setSorting] = useState<SortingState>([{ id: 'activation_time', desc: true }]);
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

  // Waybill items dialog
  const [itemsWaybill, setItemsWaybill] = useState<Waybill | null>(null);
  const [waybillItems, setWaybillItems] = useState<any[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Project selector within the items dialog
  const [dialogProjectUuid, setDialogProjectUuid] = useState<string | null>(null);
  const [dialogProjectDirty, setDialogProjectDirty] = useState(false);
  const [dialogProjectSaving, setDialogProjectSaving] = useState(false);
  const [similarMatches, setSimilarMatches] = useState<any[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [checkedSimilarIds, setCheckedSimilarIds] = useState<Set<string>>(new Set());
  const [similarApplying, setSimilarApplying] = useState(false);
  const [similarView, setSimilarView] = useState<'waybills' | 'addresses'>('waybills');
  const [pdfLoading, setPdfLoading] = useState(false);

  // Drag state for the items dialog
  const [dialogPos, setDialogPos] = useState({ x: 0, y: 0 });
  const dialogDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const handleDialogDragStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Don't start drag on buttons/inputs inside the header
    if ((e.target as HTMLElement).closest('button,input,select,a')) return;
    e.preventDefault();
    dialogDragRef.current = { startX: e.clientX, startY: e.clientY, originX: dialogPos.x, originY: dialogPos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dialogDragRef.current) return;
      setDialogPos({
        x: dialogDragRef.current.originX + ev.clientX - dialogDragRef.current.startX,
        y: dialogDragRef.current.originY + ev.clientY - dialogDragRef.current.startY,
      });
    };
    const onUp = () => {
      dialogDragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [dialogPos]);

  const handleDownloadPdf = useCallback(async () => {
    if (!itemsWaybill?.rs_id) return;
    setPdfLoading(true);
    try {
      const res = await fetch(`/api/waybills/pdf?rs_id=${encodeURIComponent(itemsWaybill.rs_id)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? res.statusText);
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `waybill-${itemsWaybill.rs_id}.pdf`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      alert(`PDF download failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPdfLoading(false);
    }
  }, [itemsWaybill?.rs_id]);

  const fetchSimilarAddresses = useCallback(async (rsId: string, projectUuid: string) => {
    setSimilarMatches([]);
    setCheckedSimilarIds(new Set());
    setSimilarLoading(true);
    try {
      const res = await fetch('/api/waybills/similar-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rs_id: rsId, project_uuid: projectUuid }),
      });
      const body = await res.json();
      if (res.ok) {
        const matches: any[] = body.candidates ?? [];
        setSimilarMatches(matches);
        // Pre-check all matches with confidence >= 0.7
        const preChecked = new Set<string>(
          matches.filter((m) => (m.llm_score ?? m.trgm_score ?? 0) >= 0.7).map((m) => m.rs_id)
        );
        setCheckedSimilarIds(preChecked);
      }
    } catch (err) {
      console.error('similar-address error', err);
    } finally {
      setSimilarLoading(false);
    }
  }, []);

  const handleDialogProjectChange = useCallback((newProjectUuid: string | null, waybill: Waybill) => {
    const resolved = newProjectUuid === NONE_OPTION_VALUE ? null : newProjectUuid;
    setDialogProjectUuid(resolved);
    setDialogProjectDirty(true);
    setSimilarMatches([]);
    setCheckedSimilarIds(new Set());
    if (resolved && waybill.rs_id) {
      fetchSimilarAddresses(waybill.rs_id, resolved);
    }
  }, [fetchSimilarAddresses]);

  const handleSaveDialog = useCallback(async () => {
    if (!itemsWaybill?.id) return;
    setDialogProjectSaving(true);
    try {
      // 1. Save this waybill's project
      const res = await fetch(`/api/waybills?id=${itemsWaybill.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_uuid: dialogProjectUuid }),
      });
      const body = await res.json();
      if (res.ok && body?.data) {
        setData((prev) => prev.map((row) => (row.id === body.data.id ? body.data : row)));
        setItemsWaybill((prev) => prev ? { ...prev, project_uuid: dialogProjectUuid } : prev);
        setDialogProjectDirty(false);
      }
      // 2. Bulk-bind checked similar waybills
      if (checkedSimilarIds.size > 0 && dialogProjectUuid) {
        const idMap = new Map<string, number>();
        similarMatches.forEach((m) => { if (m.rs_id && m.id) idMap.set(m.rs_id, Number(m.id)); });
        data.forEach((row) => { if (row.rs_id && row.id) idMap.set(row.rs_id, row.id); });
        const numericIds = Array.from(checkedSimilarIds)
          .map((rid) => idMap.get(rid))
          .filter((id): id is number => id !== undefined);
        if (numericIds.length > 0) {
          setSimilarApplying(true);
          const bulkRes = await fetch('/api/waybills/bulk', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: numericIds, project_uuid: dialogProjectUuid }),
          });
          if (bulkRes.ok) {
            setData((prev) =>
              prev.map((row) =>
                numericIds.includes(row.id) ? { ...row, project_uuid: dialogProjectUuid } : row
              )
            );
            setSimilarMatches((prev) => prev.filter((m) => !checkedSimilarIds.has(m.rs_id)));
            setCheckedSimilarIds(new Set());
          }
          setSimilarApplying(false);
        }
      }
    } catch (err) {
      console.error('save error', err);
    } finally {
      setDialogProjectSaving(false);
    }
  }, [itemsWaybill, dialogProjectUuid, checkedSimilarIds, similarMatches, data, setData]);

  // Group similar matches by unique shipping address for the Addresses view
  const addressGroups = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const m of similarMatches) {
      const addr = m.shipping_address || '';
      if (!map.has(addr)) map.set(addr, []);
      map.get(addr)!.push(m);
    }
    return Array.from(map.entries())
      .map(([addr, waybills]) => ({
        address: addr,
        waybills,
        maxConfidence: Math.max(...waybills.map((m) => m.llm_score ?? m.trgm_score ?? 0)),
        checkedCount: waybills.filter((m) => checkedSimilarIds.has(m.rs_id)).length,
      }))
      .sort((a, b) => b.maxConfidence - a.maxConfidence);
  }, [similarMatches, checkedSimilarIds]);

  const fetchItemsForWaybill = useCallback(async (waybill: Waybill) => {
    setItemsWaybill(waybill);
    setWaybillItems([]);
    setItemsLoading(true);
    setDialogProjectUuid(waybill.project_uuid ?? null);
    setDialogProjectDirty(false);
    setSimilarMatches([]);
    setCheckedSimilarIds(new Set());
    setSimilarView('waybills');
    setDialogPos({ x: 0, y: 0 });
    try {
      const param = waybill.rs_id
        ? `rs_id=${encodeURIComponent(waybill.rs_id)}`
        : `waybill_no=${encodeURIComponent(waybill.waybill_no || '')}`;
      const res = await fetch(`/api/waybill-items?${param}&limit=500`);
      const body = await res.json();
      setWaybillItems(body.data || []);
    } catch (err) {
      console.error('Failed to load waybill items', err);
    } finally {
      setItemsLoading(false);
    }
  }, []);

  // Add Counteragent dialog
  const [addCaOpen, setAddCaOpen] = useState(false);
  const [addCaPrefill, setAddCaPrefill] = useState<{ name: string; identificationNumber: string } | null>(null);
  const [caEntityTypes, setCaEntityTypes] = useState<any[]>([]);
  const [caCountries, setCaCountries] = useState<any[]>([]);
  const [caInsiders, setCaInsiders] = useState<any[]>([]);
  const [caMetaLoaded, setCaMetaLoaded] = useState(false);
  const openAddCaDialog = useCallback(async (prefillName: string, prefillId: string) => {
    setAddCaPrefill({ name: prefillName, identificationNumber: prefillId });
    setAddCaOpen(true);
    if (!caMetaLoaded) {
      try {
        const [etRes, cRes, caRes] = await Promise.all([
          fetch('/api/entity-types'),
          fetch('/api/countries'),
          fetch('/api/counteragents'),
        ]);
        const etBody = await etRes.json();
        const cBody = await cRes.json();
        const caBody = await caRes.json();
        setCaEntityTypes(etBody.data || etBody || []);
        setCaCountries(cBody.data || cBody || []);
        const insiderList = (Array.isArray(caBody) ? caBody : []).filter((c: any) => c.insider);
        setCaInsiders(insiderList.map((c: any) => ({ counteragentUuid: c.counteragent_uuid, label: c.name })));
        setCaMetaLoaded(true);
      } catch (err) {
        console.error('Failed to load counteragent form meta', err);
      }
    }
  }, [caMetaLoaded]);

  const resizeRafRef = useRef<number | null>(null);
  const resizePendingRef = useRef<{ element: HTMLElement; width: number } | null>(null);
  const facetsRequestIdRef = useRef(0);

  const tableColumns = useMemo<ColumnDef<Waybill>[]>(
    () => defaultColumns.map((column) => ({
      id: column.key,
      accessorKey: column.key,
    })),
    []
  );

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      columnFilters,
      sorting,
    },
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    manualFiltering: true,
    manualSorting: true,
  });

  const filtersMap = useMemo(
    () =>
      new Map<ColumnKey, Set<any>>(
        columnFilters
          .filter(
            (filter): filter is { id: string; value: any[] } =>
              typeof filter.id === 'string' && Array.isArray(filter.value)
          )
          .map((filter) => [filter.id as ColumnKey, new Set(filter.value)])
      ),
    [columnFilters]
  );

  const activeSort = sorting[0];
  const sortColumn = (activeSort?.id as ColumnKey) || 'activation_time';
  const sortDirection: 'asc' | 'desc' = activeSort?.desc ? 'desc' : 'asc';

  useEffect(() => {
    const versionKey = 'waybillsColumnsVersion';
    const currentVersion = '3';
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
        if (typeof parsed.periodFrom === 'string') {
          setPeriodFrom(parsed.periodFrom);
        }
        if (typeof parsed.periodTo === 'string') {
          setPeriodTo(parsed.periodTo);
        }
        if (parsed.sortColumn && (parsed.sortDirection === 'asc' || parsed.sortDirection === 'desc')) {
          setSorting([{ id: parsed.sortColumn as string, desc: parsed.sortDirection === 'desc' }]);
        }
        if (typeof parsed.pageSize === 'number') setPageSize(parsed.pageSize);
        if (typeof parsed.missingCounteragents === 'boolean') {
          setShowMissingCounteragents(parsed.missingCounteragents);
        }
        if (Array.isArray(parsed.filters)) {
          const restored: ColumnFiltersState = [];
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
      missingCounteragents: showMissingCounteragents,
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
    showMissingCounteragents,
    columnFilters,
    advancedFilters,
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
    const normalizeFilterValue = (value: any) => {
      if (value === BLANK_FACET_TOKEN) return '';
      return value === null || value === undefined ? '' : value;
    };
    const filterValueKey = (value: any) => String(normalizeFilterValue(value));

    const serializedFilters = columnFilters.reduce<Array<[string, any[]]>>((acc, filter) => {
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
    if (showMissingCounteragents) params.set('missingCounteragents', 'true');
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
  }, [appliedSearch, periodFrom, periodTo, currentPage, pageSize, showMissingCounteragents, sortColumn, sortDirection, columnFilters, advancedFilters]);

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

  const handleAddCaSave = useCallback(async (payload: any) => {
    const res = await fetch('/api/counteragents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || 'Failed to create counteragent');
    }
    await fetchWaybills();
  }, [fetchWaybills]);

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

  const getCellValue = useCallback((row: Waybill, columnKey: ColumnKey) => {
    if (columnKey === 'insiderName') {
      return requiredInsiderName;
    }
    if (columnKey === 'project_uuid') {
      return projectLabelMap.get(row.project_uuid || '') || row.project_uuid || '';
    }
    if (columnKey === 'financial_code_uuid') {
      return financialCodeLabelMap.get(row.financial_code_uuid || '') || row.financial_code_uuid || '';
    }
    return (row as any)[columnKey];
  }, [financialCodeLabelMap, projectLabelMap, requiredInsiderName]);

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

  // Per-field: prefer server facet values when available and non-empty;
  // fall back to current-page values if server returned nothing for a field.
  const getUniqueValues = useCallback((columnKey: ColumnKey): any[] => {
    if (facetValues.size > 0) {
      const serverValues = facetValues.get(columnKey);
      if (serverValues && serverValues.length > 0) return serverValues;
    }
    return fallbackFacetValues.get(columnKey) ?? [];
  }, [facetValues, fallbackFacetValues]);

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
      const hasIdentifiedCounteragent = Boolean(row.counteragent_uuid);
      const canPrefillCounteragent = Boolean(
        (row.counteragent_name && String(row.counteragent_name).trim()) ||
        (row.counteragent && String(row.counteragent).trim()) ||
        (row.counteragent_inn && String(row.counteragent_inn).trim())
      );
      const addCounteragentParams = new URLSearchParams();
      const prefillName = (row.counteragent_name || row.counteragent || '').trim();
      const prefillId = (row.counteragent_inn || '').trim();
      if (prefillName) addCounteragentParams.set('name', prefillName);
      if (prefillId) addCounteragentParams.set('identification_number', prefillId);
      return (
        <tr
          key={row.id}
          data-index={virtualRow.index}
          ref={rowVirtualizer.measureElement}
          className={`border-t ${!hasIdentifiedCounteragent ? 'bg-red-50/50' : ''}`}
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
                title={String(
                  col.key === 'counteragent_name'
                    ? row.counteragent_name || row.counteragent || ''
                    : formatCell(getCellValue(row, col.key), col.format)
                )}
              >
                {col.key === 'waybill_no' ? (
                  <button
                    type="button"
                    className="text-blue-600 hover:underline font-medium truncate block w-full text-left"
                    onClick={() => fetchItemsForWaybill(row)}
                  >
                    {row.waybill_no || ''}
                  </button>
                ) : col.key === 'counteragent_name'
                  ? row.counteragent_name || row.counteragent || ''
                  : formatCell(getCellValue(row, col.key), col.format)}
              </div>
            </td>
          ))}
          <td className="px-3 py-2" style={{ width: 96, minWidth: 96, maxWidth: 96 }}>
            <div className="flex items-center gap-2">
              {!hasIdentifiedCounteragent && canPrefillCounteragent && (
                <Button
                  variant="outline"
                  size="sm"
                  title="Add Counteragent"
                  onClick={() => openAddCaDialog(prefillName, prefillId)}
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              )}
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
  }, [filteredData, loading, selectedIds, setEditing, setSelected, toggleSelectRow, visibleColumns, getCellValue, virtualRows, rowVirtualizer, fetchItemsForWaybill]);

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
    setColumnFilters([]);
    setAdvancedFilters(new Map());
    setSearch('');
    setAppliedSearch('');
    setPeriodFrom('');
    setPeriodTo('');
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
      if (periodFrom) params.set('periodFrom', periodFrom);
      if (periodTo) params.set('periodTo', periodTo);
      if (showMissingCounteragents) params.set('missingCounteragents', 'true');
      if (sortColumn) params.set('sortColumn', sortColumn);
      if (sortDirection) params.set('sortDirection', sortDirection);
      params.set('includeFacets', 'false');
      params.set('exportAll', 'true');
      const exportFilters = buildWaybillsQueryParams({ includeFacets: false, includePagination: false }).get('filters');
      if (exportFilters) params.set('filters', exportFilters);

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
          <RequiredInsiderBadge />
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
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1">
              <Label htmlFor="waybillPeriodFrom" className="text-xs text-gray-600 whitespace-nowrap">From period</Label>
              <Input
                id="waybillPeriodFrom"
                type="month"
                value={periodFrom}
                onChange={(e) => {
                  setPeriodFrom(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 w-36"
              />
            </div>
            <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1">
              <Label htmlFor="waybillPeriodTo" className="text-xs text-gray-600 whitespace-nowrap">To period</Label>
              <Input
                id="waybillPeriodTo"
                type="month"
                value={periodTo}
                onChange={(e) => {
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
              (periodTo ? 1 : 0) +
              (showMissingCounteragents ? 1 : 0)
            }
            onClear={handleClearFilters}
          />
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
                  <div className="flex items-center gap-2 pr-4 overflow-hidden">
                    <button
                      type="button"
                      className="flex items-center gap-1 min-w-0"
                      onClick={() => {
                        if (!col.sortable) return;
                        table.setSorting((prev) => {
                          const current = prev[0];
                          if (current?.id === col.key) {
                            return [{ id: col.key, desc: !current.desc }];
                          }
                          return [{ id: col.key, desc: false }];
                        });
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
                          table
                            .getColumn(col.key)
                            ?.setFilterValue(values.size === 0 ? undefined : Array.from(values));
                          setCurrentPage(1);
                        }}
                        {...(!col.format || col.format === 'text' ? {
                          onAdvancedFilterChange: (filter: ColumnFilter | null) => {
                            setAdvancedFilters((prev) => {
                              const next = new Map(prev);
                              if (filter) next.set(col.key, filter);
                              else next.delete(col.key);
                              return next;
                            });
                            setCurrentPage(1);
                          },
                        } : {})}
                        onSort={(direction) => {
                          table.setSorting([{ id: col.key, desc: direction === 'desc' }]);
                          setCurrentPage(1);
                        }}
                        columnFormat={col.format}
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

      <CounteragentFormDialog
        isOpen={addCaOpen}
        onClose={() => { setAddCaOpen(false); setAddCaPrefill(null); }}
        onSave={handleAddCaSave}
        editData={addCaPrefill ? { name: addCaPrefill.name, identificationNumber: addCaPrefill.identificationNumber } : undefined}
        entityTypes={caEntityTypes}
        countries={caCountries}
        insiders={caInsiders}
      />

      <Dialog open={!!itemsWaybill} onOpenChange={(open) => { if (!open) { setItemsWaybill(null); setWaybillItems([]); setSimilarMatches([]); setCheckedSimilarIds(new Set()); } }}>
        <DialogContent
          className="p-0 gap-0 [&>button]:text-white [&>button]:top-3 [&>button]:right-4 flex flex-col"
          style={{
            transform: `translate(calc(-50% + ${dialogPos.x}px), calc(-50% + ${dialogPos.y}px))`,
            resize: 'both',
            overflow: 'hidden',
            minWidth: '640px',
            minHeight: '300px',
            width: '1000px',
            maxWidth: '95vw',
            height: '80vh',
            maxHeight: '95vh',
          }}
        >
          {/* Header bar — dark teal, mirrors RS.ge popup title — doubles as drag handle */}
          <div
            className="bg-[#2e7d7d] text-white px-5 py-3 flex items-center justify-between min-h-[52px] cursor-grab active:cursor-grabbing select-none shrink-0"
            onMouseDown={handleDialogDragStart}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-base tracking-wide">{itemsWaybill?.waybill_no || itemsWaybill?.rs_id || ''}</span>
              {itemsWaybill?.state && (
                <span className="bg-white/20 rounded px-2 py-0.5 text-xs font-medium">{itemsWaybill.state}</span>
              )}
              {itemsWaybill?.condition && (
                <span className="bg-white/20 rounded px-2 py-0.5 text-xs font-medium">{itemsWaybill.condition}</span>
              )}
              {itemsWaybill?.type && (
                <span className="bg-white/10 rounded px-2 py-0.5 text-xs text-white/80">{itemsWaybill.type}</span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm shrink-0 ml-4">
              {itemsWaybill?.activation_time && (
                <span className="text-white/75">{itemsWaybill.activation_time}</span>
              )}
              {itemsWaybill?.sum && (
                <span className="font-bold tabular-nums">
                  {Number(itemsWaybill.sum).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₾
                </span>
              )}
              {itemsWaybill?.rs_id && (
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={pdfLoading}
                  className="text-white/80 hover:text-white transition-colors disabled:opacity-50 flex items-center gap-1"
                  title="Download PDF"
                >
                  {pdfLoading ? (
                    <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 8l-3-3m3 3l3-3M4 20h16" />
                    </svg>
                  )}
                  <span className="text-xs">PDF</span>
                </button>
              )}
            </div>
          </div>

          {/* Project selector row */}
          <div className="px-5 py-2.5 border-b bg-[#f8fafb] flex items-center gap-3 flex-wrap shrink-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide shrink-0">Project</span>
            <div className="w-64">
              <Combobox
                options={projectOptionsWithNone}
                value={dialogProjectUuid ?? NONE_OPTION_VALUE}
                onValueChange={(val) => itemsWaybill && handleDialogProjectChange(val, itemsWaybill)}
                placeholder="Select project…"
              />
            </div>
            {similarLoading && (
              <span className="text-xs text-muted-foreground animate-pulse">Finding similar…</span>
            )}
            <div className="ml-auto flex items-center gap-2 shrink-0">
              {(dialogProjectDirty || checkedSimilarIds.size > 0) && (
                <span className="text-xs text-amber-600 font-medium">
                  {checkedSimilarIds.size > 0
                    ? `${checkedSimilarIds.size} similar selected`
                    : 'Unsaved changes'}
                </span>
              )}
              <button
                type="button"
                onClick={handleSaveDialog}
                disabled={dialogProjectSaving || similarApplying || (!dialogProjectDirty && checkedSimilarIds.size === 0)}
                className="text-xs bg-[#2e7d7d] hover:bg-[#1d5959] text-white px-3 py-1.5 rounded font-medium disabled:opacity-40 transition-colors"
              >
                {dialogProjectSaving || similarApplying ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>

          {/* Counteragent section — amber title, matches RS.ge გამყიდველი block */}
          <div className="px-5 py-3 border-b bg-white shrink-0">
            <div className="inline-block bg-[#f59e0b] text-white text-[11px] font-bold px-2 py-0.5 rounded mb-2 uppercase tracking-wide">
              გამყიდველი (გამზხავნი)
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {itemsWaybill?.counteragent_inn && (
                <div><span className="text-muted-foreground text-xs">საიდენტ. №:</span> <span className="font-medium">{itemsWaybill.counteragent_inn}</span></div>
              )}
              {itemsWaybill?.counteragent_name && (
                <div className="font-medium">{itemsWaybill.counteragent_name}</div>
              )}
              {itemsWaybill?.departure_address && (
                <div><span className="text-muted-foreground text-xs">ტრანსპ. დაწყ.:</span> <span>{itemsWaybill.departure_address}</span></div>
              )}
              {itemsWaybill?.shipping_address && (
                <div><span className="text-muted-foreground text-xs">ტრანსპ. დასრ.:</span> <span>{itemsWaybill.shipping_address}</span></div>
              )}
            </div>
          </div>

          {/* Items table — Georgian column names matching RS.ge */}
          <DialogTitle className="sr-only">ზედნადები {itemsWaybill?.waybill_no}</DialogTitle>
          {itemsLoading ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">იტვირთება...</div>
          ) : waybillItems.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">საქონელი ვერ მოიძებნა.</div>
          ) : (
            <div className="overflow-auto flex-1 min-h-0">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#f0f4f4] text-left border-b-2 border-[#2e7d7d]/30">
                    <th className="px-3 py-2 font-semibold text-[#2e7d7d] w-8 text-center">№</th>
                    <th className="px-3 py-2 font-semibold text-[#2e7d7d] w-28">საქ. კოდი</th>
                    <th className="px-3 py-2 font-semibold text-[#2e7d7d]">საქონლის დასახელება</th>
                    <th className="px-3 py-2 font-semibold text-[#2e7d7d] w-24">ბოთ. ერთ.</th>
                    <th className="px-3 py-2 font-semibold text-[#2e7d7d] w-24 text-right">რაოდ.</th>
                    <th className="px-3 py-2 font-semibold text-[#2e7d7d] w-28 text-right">ერთ. ფასი</th>
                    <th className="px-3 py-2 font-semibold text-[#2e7d7d] w-28 text-right">საქ. ფასი</th>
                    <th className="px-3 py-2 font-semibold text-[#2e7d7d] w-28">დაბეგვრა</th>
                  </tr>
                </thead>
                <tbody>
                  {waybillItems.map((item, idx) => (
                    <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#f7fbfb]'}>
                      <td className="px-3 py-1.5 border-b border-gray-100 text-muted-foreground text-center">{idx + 1}</td>
                      <td className="px-3 py-1.5 border-b border-gray-100 text-muted-foreground text-xs truncate" title={item.goods_code}>{item.goods_code || '—'}</td>
                      <td className="px-3 py-1.5 border-b border-gray-100 font-medium" title={item.goods_name}>{item.goods_name}</td>
                      <td className="px-3 py-1.5 border-b border-gray-100">{item.dimension_name || item.unit || '—'}</td>
                      <td className="px-3 py-1.5 border-b border-gray-100 text-right tabular-nums">{item.quantity != null ? Number(item.quantity).toLocaleString('en-US', { maximumFractionDigits: 4 }) : '—'}</td>
                      <td className="px-3 py-1.5 border-b border-gray-100 text-right tabular-nums">{item.unit_price != null ? Number(item.unit_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '—'}</td>
                      <td className="px-3 py-1.5 border-b border-gray-100 text-right tabular-nums font-semibold">{item.total_price != null ? Number(item.total_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</td>
                      <td className="px-3 py-1.5 border-b border-gray-100 text-muted-foreground text-xs">{item.taxation || '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#e8f4f4] border-t-2 border-[#2e7d7d]/30 font-semibold">
                    <td className="px-3 py-2 text-[#2e7d7d] text-xs" colSpan={6}>
                      სულ: {waybillItems.length} დასახელება
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-[#2e7d7d]">
                      {waybillItems
                        .reduce((sum, item) => sum + (item.total_price != null ? Number(item.total_price) : 0), 0)
                        .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₾
                    </td>
                    <td className="px-3 py-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Similar-address suggestions panel — below the items table */}
          {(similarLoading || similarMatches.length > 0) && (
            <div className="px-5 py-3 border-t bg-[#f0f9f9] shrink-0">
              <div className="flex items-center justify-between mb-2 gap-2">
                <span className="text-xs font-semibold text-[#2e7d7d] uppercase tracking-wide">
                  Similar delivery addresses — not yet in this project
                </span>
                {/* View toggle */}
                <div className="flex items-center rounded overflow-hidden border border-[#2e7d7d]/30 text-xs shrink-0">
                  <button
                    type="button"
                    onClick={() => setSimilarView('waybills')}
                    className={`px-2.5 py-1 ${similarView === 'waybills' ? 'bg-[#2e7d7d] text-white' : 'bg-white text-[#2e7d7d] hover:bg-[#e0f2f2]'} transition-colors`}
                  >
                    Waybills
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimilarView('addresses')}
                    className={`px-2.5 py-1 border-l border-[#2e7d7d]/30 ${similarView === 'addresses' ? 'bg-[#2e7d7d] text-white' : 'bg-white text-[#2e7d7d] hover:bg-[#e0f2f2]'} transition-colors`}
                  >
                    Addresses
                  </button>
                </div>
              </div>
              {similarLoading ? (
                <div className="text-xs text-muted-foreground animate-pulse py-2">Analysing addresses with AI…</div>
              ) : similarView === 'waybills' ? (
                <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-1">
                  {similarMatches.map((match) => {
                    const checked = checkedSimilarIds.has(match.rs_id);
                    const confidence = match.llm_score ?? match.trgm_score ?? 0;
                    const confPct = Math.round(confidence * 100);
                    return (
                      <label
                        key={match.rs_id}
                        className={`flex items-start gap-2.5 cursor-pointer rounded px-2.5 py-1.5 text-xs border transition-colors ${
                          checked
                            ? 'bg-[#e0f2f2] border-[#2e7d7d]/40'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            setCheckedSimilarIds((prev) => {
                              const next = new Set(prev);
                              v ? next.add(match.rs_id) : next.delete(match.rs_id);
                              return next;
                            });
                          }}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-[#2e7d7d]">{match.waybill_no || match.rs_id}</span>
                            {match.counteragent_name && (
                              <span className="text-muted-foreground truncate">{match.counteragent_name}</span>
                            )}
                            <span className={`ml-auto shrink-0 font-semibold tabular-nums ${confPct >= 70 ? 'text-emerald-600' : confPct >= 40 ? 'text-amber-500' : 'text-red-400'}`}>
                              {confPct}%
                            </span>
                          </div>
                          <div className="text-muted-foreground truncate mt-0.5">{match.shipping_address}</div>
                          {match.llm_reason && (
                            <div className="text-[10px] text-muted-foreground/70 mt-0.5 italic">{match.llm_reason}</div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              ) : (
                /* Addresses view — unique addresses grouped, with individual waybill rows */
                <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
                  {addressGroups.map((group) => {
                    const allChecked = group.checkedCount === group.waybills.length;
                    const someChecked = group.checkedCount > 0 && !allChecked;
                    const confPct = Math.round(group.maxConfidence * 100);
                    return (
                      <div key={group.address} className="flex flex-col gap-1">
                        {/* Address group header with select-all checkbox */}
                        <div
                          className={`flex items-center gap-2.5 rounded px-2.5 py-1.5 text-xs border ${
                            allChecked
                              ? 'bg-[#e0f2f2] border-[#2e7d7d]/40'
                              : someChecked
                              ? 'bg-[#f0f9f9] border-[#2e7d7d]/25'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <Checkbox
                            checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                            onCheckedChange={(v) => {
                              setCheckedSimilarIds((prev) => {
                                const next = new Set(prev);
                                if (v) {
                                  group.waybills.forEach((m) => next.add(m.rs_id));
                                } else {
                                  group.waybills.forEach((m) => next.delete(m.rs_id));
                                }
                                return next;
                              });
                            }}
                            className="mt-0 shrink-0"
                          />
                          <div className="flex flex-1 items-center gap-2 min-w-0">
                            <span className="font-semibold text-[#2e7d7d] truncate">{group.address || '—'}</span>
                            <span className="shrink-0 text-muted-foreground ml-auto">
                              {group.waybills.length} waybill{group.waybills.length !== 1 ? 's' : ''}
                            </span>
                            <span className={`shrink-0 font-semibold tabular-nums ${confPct >= 70 ? 'text-emerald-600' : confPct >= 40 ? 'text-amber-500' : 'text-red-400'}`}>
                              {confPct}%
                            </span>
                          </div>
                        </div>
                        {/* Individual waybill rows within this address group */}
                        {group.waybills.map((match) => {
                          const checked = checkedSimilarIds.has(match.rs_id);
                          const matchConfPct = Math.round((match.llm_score ?? match.trgm_score ?? 0) * 100);
                          return (
                            <label
                              key={match.rs_id}
                              className={`ml-5 flex items-start gap-2.5 cursor-pointer rounded px-2.5 py-1.5 text-xs border transition-colors ${
                                checked
                                  ? 'bg-[#e0f2f2] border-[#2e7d7d]/40'
                                  : 'bg-white border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => {
                                  setCheckedSimilarIds((prev) => {
                                    const next = new Set(prev);
                                    v ? next.add(match.rs_id) : next.delete(match.rs_id);
                                    return next;
                                  });
                                }}
                                className="mt-0.5 shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-[#2e7d7d]">{match.waybill_no || match.rs_id}</span>
                                  {match.counteragent_name && (
                                    <span className="text-muted-foreground truncate">{match.counteragent_name}</span>
                                  )}
                                  <span className={`ml-auto shrink-0 font-semibold tabular-nums ${matchConfPct >= 70 ? 'text-emerald-600' : matchConfPct >= 40 ? 'text-amber-500' : 'text-red-400'}`}>
                                    {matchConfPct}%
                                  </span>
                                </div>
                                {match.llm_reason && (
                                  <div className="text-[10px] text-muted-foreground/70 mt-0.5 italic">{match.llm_reason}</div>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
