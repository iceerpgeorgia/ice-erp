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
import { Search, Eye, Edit2, Settings, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { ClearFiltersButton } from './shared/clear-filters-button';
import type { ColumnFormat } from './shared/table-filters';
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
  uuid: string;
  rs_id?: string | null;
  waybill_no?: string | null;
  goods_code?: string | null;
  goods_name?: string | null;
  unit?: string | null;
  dimension_uuid?: string | null;
  dimension_name?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  total_price?: number | null;
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
  // Item columns
  { key: 'waybill_no', label: 'Waybill', visible: true, sortable: true, filterable: true, width: 120 },
  { key: 'goods_code', label: 'Code', visible: true, sortable: true, filterable: true, width: 100 },
  { key: 'goods_name', label: 'Name', visible: true, sortable: true, filterable: true, width: 220 },
  { key: 'unit', label: 'Unit', visible: true, sortable: true, filterable: true, width: 80 },
  { key: 'quantity', label: 'Quantity', visible: true, sortable: true, filterable: true, format: 'number', width: 100 },
  { key: 'unit_price', label: 'Unit Price', visible: true, sortable: true, filterable: true, format: 'number', width: 120 },
  { key: 'total_price', label: 'Total Price', visible: true, sortable: true, filterable: true, format: 'number', width: 120 },
  { key: 'inventory_name', label: 'Inventory', visible: true, sortable: true, filterable: true, width: 200 },
  { key: 'taxation', label: 'Tax Type', visible: true, sortable: true, filterable: true, width: 100 },
  { key: 'project_uuid', label: 'Project', visible: true, sortable: true, filterable: true, width: 200 },
  { key: 'financial_code_uuid', label: 'Financial Code', visible: true, sortable: true, filterable: true, width: 220 },
  { key: 'corresponding_account', label: 'Account', visible: true, sortable: true, filterable: true, width: 140 },
  
  // Waybill header columns (appendable, initially hidden)
  { key: 'waybill_state', label: 'Waybill Status', visible: false, sortable: true, filterable: true, width: 140 },
  { key: 'waybill_condition', label: 'Condition', visible: false, sortable: true, filterable: true, width: 140 },
  { key: 'waybill_category', label: 'Category', visible: false, sortable: true, filterable: true, width: 140 },
  { key: 'waybill_type', label: 'Type', visible: false, sortable: true, filterable: true, width: 140 },
  { key: 'waybill_counteragent_name', label: 'Organization', visible: false, sortable: true, filterable: true, width: 240 },
  { key: 'waybill_counteragent_inn', label: 'INN', visible: false, sortable: true, filterable: true, width: 140 },
  { key: 'waybill_vat', label: 'VAT', visible: false, sortable: true, filterable: true, format: 'boolean', width: 80 },
  { key: 'waybill_sum', label: 'Amount', visible: false, sortable: true, filterable: true, format: 'number', width: 120 },
  { key: 'waybill_driver', label: 'Driver', visible: false, sortable: true, filterable: true, width: 200 },
  { key: 'waybill_vehicle', label: 'Auto', visible: false, sortable: true, filterable: true, width: 160 },
  { key: 'waybill_activation_time', label: 'Activation Date', visible: false, sortable: true, filterable: true, format: 'datetime', width: 190 },
  { key: 'waybill_transportation_sum', label: 'Transport Amount', visible: false, sortable: true, filterable: true, format: 'number', width: 140 },
  { key: 'waybill_shipping_address', label: 'Delivery Address', visible: false, sortable: true, filterable: true, width: 260 },
  { key: 'waybill_departure_address', label: 'Departure Place', visible: false, sortable: true, filterable: true, width: 260 },
  { key: 'waybill_transportation_cost', label: 'Transport Cost', visible: false, sortable: true, filterable: true, format: 'number', width: 140 },
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
  if (format === 'number') {
    const num = Number(value);
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  return String(value);
};

export function WaybillItemsTable() {
  const [data, setData] = useState<WaybillItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
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
  const [sorting, setSorting] = useState<{ id: ColumnKey; desc: boolean }>({ id: 'waybill_no', desc: true });
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

  const storageKey = 'waybillItemsColumnsV1';

  // Load columns from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setColumns(parsed);
      } catch {
        setColumns(defaultColumns);
      }
    }
    setFiltersInitialized(true);
  }, []);

  // Save columns to localStorage whenever they change
  useEffect(() => {
    if (filtersInitialized) {
      localStorage.setItem(storageKey, JSON.stringify(columns));
    }
  }, [columns, filtersInitialized]);

  // Fetch projects and financial codes on mount
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [projRes, fcRes] = await Promise.all([
          fetch('/api/projects'),
          fetch('/api/financial-codes'),
        ]);
        setProjects(await projRes.json());
        setFinancialCodes(await fcRes.json());
      } catch (err) {
        console.error('Failed to fetch metadata:', err);
      }
    };
    fetchMeta();
  }, []);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        page: String(currentPage),
        ...(appliedSearch && { q: appliedSearch }),
      });

      const res = await fetch(`/api/waybill-items?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const result = await res.json();
      setData(result.data || []);
      setTotal(result.total || 0);
    } catch (err) {
      console.error('Failed to fetch waybill items:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, appliedSearch]);

  useEffect(() => {
    if (filtersInitialized && !isInitialized) {
      fetchData();
      setIsInitialized(true);
    }
  }, [filtersInitialized, isInitialized, fetchData]);

  useEffect(() => {
    if (isInitialized) fetchData();
  }, [currentPage, pageSize, appliedSearch, isInitialized, fetchData]);

  const visibleColumns = useMemo(() => columns.filter(c => c.visible), [columns]);

  // Bulk update
  const handleBulkSave = async () => {
    const selectedArray = Array.from(selectedIds);
    if (!selectedArray.length) return;

    setIsBulkSaving(true);
    try {
      for (const id of selectedArray) {
        const item = data.find(d => d.id === id);
        if (!item) continue;
        const updates: any = {};
        if (bulkProjectUuid) updates.project_uuid = bulkProjectUuid === NONE_OPTION_VALUE ? null : bulkProjectUuid;
        if (bulkFinancialCodeUuid) updates.financial_code_uuid = bulkFinancialCodeUuid === NONE_OPTION_VALUE ? null : bulkFinancialCodeUuid;
        if (bulkCorrespondingAccount) updates.corresponding_account = bulkCorrespondingAccount;

        await fetch(`/api/waybill-items?id=${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
      }
      setIsBulkEditOpen(false);
      setBulkProjectUuid('');
      setBulkFinancialCodeUuid('');
      setBulkCorrespondingAccount('');
      setSelectedIds(new Set());
      await fetchData();
    } catch (err) {
      console.error('Bulk update failed:', err);
    } finally {
      setIsBulkSaving(false);
    }
  };

  // Export to XLSX
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const worksheet = XLSX.utils.json_to_sheet(data.map(row => {
        const obj: any = {};
        visibleColumns.forEach(col => {
          obj[col.label] = formatCell(row[col.key], col.format);
        });
        return obj;
      }));

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Waybill Items');
      XLSX.writeFile(workbook, 'waybill-items.xlsx');
    } finally {
      setIsExporting(false);
    }
  };

  // Column resizing
  const handleResizeStart = (e: React.MouseEvent, column: ColumnConfig) => {
    e.preventDefault();
    const element = (e.target as HTMLElement).closest('th');
    if (element) {
      setIsResizing({
        column: column.key,
        startX: e.clientX,
        startWidth: column.width,
        element,
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const delta = e.clientX - isResizing.startX;
      const newWidth = Math.max(80, isResizing.startWidth + delta);
      setColumns(cols =>
        cols.map(c => c.key === isResizing.column ? { ...c, width: newWidth } : c)
      );
    };

    const handleMouseUp = () => setIsResizing(null);

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Column visibility toggle
  const toggleColumnVisibility = (key: ColumnKey) => {
    setColumns(cols => cols.map(c => c.key === key ? { ...c, visible: !c.visible } : c));
  };

  // Render
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => document.querySelector('[data-table-scroll]') as HTMLElement,
    estimateSize: () => 40,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1">
          <Search className="w-4 h-4 text-gray-500" />
          <Input
            placeholder="Search by waybill, code, name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setAppliedSearch(search);
                setCurrentPage(1);
              }
            }}
            className="max-w-sm"
          />
          <Button onClick={() => { setAppliedSearch(search); setCurrentPage(1); }} variant="outline" size="sm">
            Search
          </Button>
          <ClearFiltersButton 
            onClear={() => { setSearch(''); setAppliedSearch(''); setCurrentPage(1); }}
            activeCount={appliedSearch ? 1 : 0}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleExport} disabled={isExporting} variant="outline" size="sm">
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>

          <Dialog open={isBulkEditOpen} onOpenChange={setIsBulkEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={selectedIds.size === 0}>
                Bulk Edit ({selectedIds.size})
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Edit {selectedIds.size} Items</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Project</Label>
                  <Combobox
                    options={[{ value: NONE_OPTION_VALUE, label: '- Clear -' }, ...projects.map(p => ({ value: p.uuid, label: p.name }))]}
                    value={bulkProjectUuid}
                    onValueChange={setBulkProjectUuid}
                    placeholder="Select project..."
                  />
                </div>
                <div>
                  <Label>Financial Code</Label>
                  <Combobox
                    options={[{ value: NONE_OPTION_VALUE, label: '- Clear -' }, ...financialCodes.map(fc => ({ value: fc.uuid, label: fc.name }))]}
                    value={bulkFinancialCodeUuid}
                    onValueChange={setBulkFinancialCodeUuid}
                    placeholder="Select code..."
                  />
                </div>
                <div>
                  <Label>Corresponding Account</Label>
                  <Combobox
                    options={CORRESPONDING_ACCOUNTS.map(acc => ({ value: acc, label: acc }))}
                    value={bulkCorrespondingAccount}
                    onValueChange={setBulkCorrespondingAccount}
                    placeholder="Select account..."
                  />
                </div>
                <Button onClick={handleBulkSave} disabled={isBulkSaving}>
                  {isBulkSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-3">
                <div className="font-semibold text-sm">Columns</div>
                {columns.map(col => (
                  <div key={col.key} className="flex items-center gap-2">
                    <Checkbox
                      checked={col.visible}
                      onCheckedChange={() => toggleColumnVisibility(col.key)}
                    />
                    <label className="text-sm cursor-pointer">{col.label}</label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto" data-table-scroll>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="w-12 p-2 border-r">
                  <Checkbox
                    checked={selectedIds.size > 0 && selectedIds.size === data.length}
                    onCheckedChange={(checked) => {
                      setSelectedIds(checked ? new Set(data.map(d => d.id)) : new Set());
                    }}
                  />
                </th>
                {visibleColumns.map(col => (
                  <th
                    key={col.key}
                    className="border-r px-4 py-2 text-left text-sm font-medium text-gray-700 whitespace-nowrap relative group"
                    style={{ width: `${col.width}px` }}
                    draggable
                    onDragStart={() => setDraggedColumn(col.key)}
                    onDragOver={() => setDragOverColumn(col.key)}
                    onDragEnd={() => { setDraggedColumn(null); setDragOverColumn(null); }}
                  >
                    <div className="flex items-center justify-between">
                      <span>{col.label}</span>
                      {col.sortable && (
                        <button
                          onClick={() => setSorting({ id: col.key, desc: sorting.id === col.key ? !sorting.desc : true })}
                          className="opacity-0 group-hover:opacity-100"
                        >
                          {sorting.id === col.key ? (sorting.desc ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />) : '-'}
                        </button>
                      )}
                    </div>
                    <div
                      onMouseDown={(e) => handleResizeStart(e, col)}
                      className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-500 bg-gray-300 opacity-0 hover:opacity-100"
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="p-4 text-center">Loading...</td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="p-4 text-center">No items found</td>
                </tr>
              ) : (
                virtualRows.map((virtualRow) => {
                  const row = data[virtualRow.index];
                  return (
                    <tr key={row.id} className="border-b hover:bg-gray-50">
                      <td className="w-12 p-2 border-r">
                        <Checkbox
                          checked={selectedIds.has(row.id)}
                          onCheckedChange={(checked) => {
                            const newIds = new Set(selectedIds);
                            if (checked) newIds.add(row.id);
                            else newIds.delete(row.id);
                            setSelectedIds(newIds);
                          }}
                        />
                      </td>
                      {visibleColumns.map(col => (
                        <td key={col.key} className="border-r px-4 py-2 text-sm text-gray-700" style={{ width: `${col.width}px` }}>
                          {formatCell(row[col.key], col.format)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Total: {total} | Page {currentPage} of {Math.ceil(total / pageSize)}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} variant="outline" size="sm">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button onClick={() => setCurrentPage(p => Math.min(Math.ceil(total / pageSize), p + 1))} disabled={currentPage >= Math.ceil(total / pageSize)} variant="outline" size="sm">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
