'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Combobox } from '@/components/ui/combobox';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Search, Upload, RefreshCw, Eye, Edit2, Settings, ArrowUp, ArrowDown } from 'lucide-react';
import { ColumnFilterPopover } from './shared/column-filter-popover';

const CORRESPONDING_ACCOUNTS = [
  '1_4_30','1_6_10','1_6_20','1_6_30','1_6_55','1_6_70','2_1_50','2_1_60','2_1_70',
  '3_1_10','3_1_90','7_4_15','7_4_20','7_4_21','7_4_22','7_4_22_1','7_4_22_2','7_4_30',
  '7_4_41','7_4_42','7_4_45','7_4_56','7_4_60','7_4_65','7_4_70','7_4_85','7_4_90','7_4_91'
];

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
  { key: 'sum', label: 'Sum', visible: true, sortable: true, filterable: false, format: 'number', width: 120 },
  { key: 'driver', label: 'Driver', visible: true, sortable: true, filterable: true, width: 200 },
  { key: 'vehicle', label: 'Vehicle', visible: true, sortable: true, filterable: true, width: 160 },
  { key: 'activation_time', label: 'Activation Time', visible: true, sortable: true, filterable: false, format: 'datetime', width: 190 },
  { key: 'period', label: 'Period', visible: true, sortable: true, filterable: true, width: 120 },
  { key: 'rs_id', label: 'RS ID', visible: true, sortable: true, filterable: true, width: 140 },
  { key: 'transportation_sum', label: 'Transport Sum', visible: true, sortable: true, filterable: false, format: 'number', width: 140 },
  { key: 'transportation_cost', label: 'Transport Cost', visible: true, sortable: true, filterable: false, format: 'number', width: 140 },
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
  const [projects, setProjects] = useState<any[]>([]);
  const [financialCodes, setFinancialCodes] = useState<any[]>([]);
  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);
  const [filters, setFilters] = useState<Map<ColumnKey, Set<any>>>(new Map());
  const [sortColumn, setSortColumn] = useState<ColumnKey>('activation_time');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isResizing, setIsResizing] = useState<{ key: ColumnKey; startX: number; startWidth: number } | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(200);
  const [facetValues, setFacetValues] = useState<Map<ColumnKey, any[]>>(new Map());

  const fetchWaybills = async (options?: { page?: number; pageSize?: number }) => {
    setLoading(true);
    try {
      const resolvedPage = options?.page ?? currentPage;
      const resolvedSize = options?.pageSize ?? pageSize;
      const offset = Math.max(resolvedPage - 1, 0) * resolvedSize;
      const params = new URLSearchParams();
      if (appliedSearch.trim()) params.set('search', appliedSearch.trim());
      params.set('limit', String(resolvedSize));
      params.set('offset', String(offset));
      params.set('includeFacets', 'true');
      if (sortColumn) params.set('sortColumn', sortColumn);
      if (sortDirection) params.set('sortDirection', sortDirection);
      if (filters.size > 0) {
        const serialized = Array.from(filters.entries()).map(([key, set]) => [key, Array.from(set)]);
        params.set('filters', JSON.stringify(serialized));
      }
      const res = await fetch(`/api/waybills?${params.toString()}`);
      const body = await res.json();
      setData(body.data || []);
      setTotal(body.total || 0);
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
      console.error('Failed to load waybills', err);
      alert('Failed to load waybills');
    } finally {
      setLoading(false);
    }
  };

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
  }, [currentPage, pageSize, appliedSearch, sortColumn, sortDirection, filters]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMove = (event: MouseEvent) => {
      const delta = event.clientX - isResizing.startX;
      const nextWidth = Math.max(80, isResizing.startWidth + delta);
      setColumns((prev) =>
        prev.map((col) => (col.key === isResizing.key ? { ...col, width: nextWidth } : col))
      );
    };
    const handleUp = () => setIsResizing(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isResizing]);

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
      setEditing(null);
      await fetchWaybills();
    } catch (err: any) {
      console.error('Update error', err);
      alert(err?.message || 'Update failed');
    }
  };

  const projectOptions = useMemo(() => projects.map((p: any) => ({
    value: p.project_uuid,
    label: p.project_name || p.project_index || p.project_uuid,
    keywords: `${p.project_name || ''} ${p.project_index || ''}`.trim()
  })), [projects]);

  const financialCodeOptions = useMemo(() => financialCodes.map((c: any) => ({
    value: c.uuid,
    label: `${c.code} — ${c.name}`,
    keywords: `${c.code} ${c.name}`
  })), [financialCodes]);

  const projectLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((project: any) => {
      if (!project?.project_uuid) return;
      const label = project.project_name || project.project_index || project.project_uuid;
      map.set(project.project_uuid, label);
    });
    return map;
  }, [projects]);

  const financialCodeLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    financialCodes.forEach((code: any) => {
      if (!code?.uuid) return;
      const label = code.code && code.name ? `${code.code} — ${code.name}` : (code.code || code.name || code.uuid);
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

  const filterOptions = useMemo(() => {
    return facetValues;
  }, [facetValues]);

  const getUniqueValues = (columnKey: ColumnKey) => filterOptions.get(columnKey) || [];

  const filteredData = useMemo(() => data, [data]);

  const renderFilterValue = useCallback((columnKey: ColumnKey, value: any) => {
    if (value === null || value === undefined || value === '') return '';
    if (columnKey === 'project_uuid') {
      return projectLabelMap.get(String(value)) || String(value);
    }
    if (columnKey === 'financial_code_uuid') {
      return financialCodeLabelMap.get(String(value)) || String(value);
    }
    if (columnKey === 'vat') {
      return value ? 'Yes' : 'No';
    }
    return String(value);
  }, [financialCodeLabelMap, projectLabelMap]);

  const runSearch = () => {
    const nextSearch = search.trim();
    setAppliedSearch(nextSearch);
    if (currentPage !== 1) {
      setCurrentPage(1);
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
      const response = await fetch('/api/waybills/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          project_uuid: bulkProjectUuid || null,
          financial_code_uuid: bulkFinancialCodeUuid || null,
          corresponding_account: bulkCorrespondingAccount || null,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'Bulk update failed');
      }
      await fetchWaybills();
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
          <Button variant="outline" size="sm" onClick={runSearch} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
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
          {filters.size > 0 && (
            <Button variant="outline" size="sm" onClick={() => setFilters(new Map())}>
              Clear Filters
              <Badge variant="secondary" className="ml-2">
                {filters.size}
              </Badge>
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
                      options={projectOptions}
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
                      options={financialCodeOptions}
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

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2">
                <Checkbox
                  checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                  onCheckedChange={(checked) => toggleSelectAllVisible(Boolean(checked))}
                  disabled={!visibleIds.length}
                />
              </th>
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  className="text-left px-3 py-2 relative select-none"
                  style={{ width: col.width }}
                  draggable
                  onDragStart={() => setDraggedColumn(col.key)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverColumn(col.key);
                  }}
                  onDrop={() => {
                    if (!draggedColumn || draggedColumn === col.key) return;
                    setColumns((prev) => {
                      const next = [...prev];
                      const fromIndex = next.findIndex((c) => c.key === draggedColumn);
                      const toIndex = next.findIndex((c) => c.key === col.key);
                      if (fromIndex === -1 || toIndex === -1) return prev;
                      const [moved] = next.splice(fromIndex, 1);
                      next.splice(toIndex, 0, moved);
                      return next;
                    });
                    setDraggedColumn(null);
                    setDragOverColumn(null);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="flex items-center gap-1"
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
                    {dragOverColumn === col.key && draggedColumn !== col.key && (
                      <span className="text-xs text-primary">•</span>
                    )}
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
                      />
                    )}
                  </div>
                  <div
                    className="absolute top-0 right-0 h-full w-1 cursor-col-resize"
                    onMouseDown={(event) => {
                      setIsResizing({ key: col.key, startX: event.clientX, startWidth: col.width });
                    }}
                  />
                </th>
              ))}
              <th className="text-left px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2">
                  <Checkbox
                    checked={selectedIds.has(row.id)}
                    onCheckedChange={(checked) => toggleSelectRow(row.id, Boolean(checked))}
                  />
                </td>
                {visibleColumns.map((col) => (
                  <td key={col.key} className="px-3 py-2" style={{ width: col.width }}>
                    {col.key === 'counteragent_name'
                      ? row.counteragent_name || row.counteragent || '-'
                      : formatCell(getCellValue(row, col.key), col.format)}
                  </td>
                ))}
                <td className="px-3 py-2">
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
            ))}
            {filteredData.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-muted-foreground" colSpan={visibleColumns.length + 2}>
                  {loading ? 'Loading...' : 'No waybills found'}
                </td>
              </tr>
            )}
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
                  options={projectOptions}
                  value={editing.project_uuid || ''}
                  onValueChange={(value) => setEditing({ ...editing, project_uuid: value })}
                  placeholder="Select project"
                  searchPlaceholder="Search projects..."
                  emptyText="No projects found"
                />
              </div>
              <div className="space-y-2">
                <Label>Financial Code</Label>
                <Combobox
                  options={financialCodeOptions}
                  value={editing.financial_code_uuid || ''}
                  onValueChange={(value) => setEditing({ ...editing, financial_code_uuid: value })}
                  placeholder="Select financial code"
                  searchPlaceholder="Search financial codes..."
                  emptyText="No financial codes found"
                />
              </div>
              <div className="space-y-2">
                <Label>Corresponding Account</Label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={editing.corresponding_account || ''}
                  onChange={(e) => setEditing({ ...editing, corresponding_account: e.target.value })}
                >
                  <option value="">Select account</option>
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
