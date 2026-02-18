'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search, Settings } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { ColumnFilterPopover } from './shared/column-filter-popover';

const columnsStorageKey = 'conversionsTableColumnsV1';
const filtersStorageKey = 'conversionsTableFiltersV1';

export type ConversionRow = {
  id: number;
  uuid: string;
  date: string;
  keyValue: string;
  bankUuid: string | null;
  bankName: string | null;
  accountOutUuid: string;
  accountOutNumber: string | null;
  currencyOutUuid: string;
  currencyOutCode: string | null;
  amountOut: number;
  accountInUuid: string;
  accountInNumber: string | null;
  currencyInUuid: string;
  currencyInCode: string | null;
  amountIn: number;
  fee: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type ColumnKey = keyof ConversionRow;

type ColumnConfig = {
  key: ColumnKey;
  label: string;
  visible: boolean;
  sortable: boolean;
  filterable: boolean;
  format?: 'number' | 'date';
  width: number;
};

const defaultColumns: ColumnConfig[] = [
  { key: 'id', label: 'ID', visible: false, sortable: true, filterable: true, format: 'number', width: 90 },
  { key: 'date', label: 'Date', visible: true, sortable: true, filterable: true, format: 'date', width: 120 },
  { key: 'keyValue', label: 'DocKey', visible: true, sortable: true, filterable: true, width: 180 },
  { key: 'bankName', label: 'Bank', visible: true, sortable: true, filterable: true, width: 160 },
  { key: 'uuid', label: 'UUID', visible: false, sortable: true, filterable: true, width: 260 },
  { key: 'bankUuid', label: 'Bank UUID', visible: false, sortable: true, filterable: true, width: 260 },
  { key: 'accountOutNumber', label: 'Account Out', visible: true, sortable: true, filterable: true, width: 200 },
  { key: 'accountOutUuid', label: 'Account Out UUID', visible: false, sortable: true, filterable: true, width: 260 },
  { key: 'currencyOutCode', label: 'Currency Out', visible: true, sortable: true, filterable: true, width: 120 },
  { key: 'currencyOutUuid', label: 'Currency Out UUID', visible: false, sortable: true, filterable: true, width: 260 },
  { key: 'amountOut', label: 'Amount Out', visible: true, sortable: true, filterable: true, format: 'number', width: 140 },
  { key: 'accountInNumber', label: 'Account In', visible: true, sortable: true, filterable: true, width: 200 },
  { key: 'accountInUuid', label: 'Account In UUID', visible: false, sortable: true, filterable: true, width: 260 },
  { key: 'currencyInCode', label: 'Currency In', visible: true, sortable: true, filterable: true, width: 120 },
  { key: 'currencyInUuid', label: 'Currency In UUID', visible: false, sortable: true, filterable: true, width: 260 },
  { key: 'amountIn', label: 'Amount In', visible: true, sortable: true, filterable: true, format: 'number', width: 140 },
  { key: 'fee', label: 'Fee', visible: true, sortable: true, filterable: true, format: 'number', width: 120 },
  { key: 'createdAt', label: 'Created At', visible: false, sortable: true, filterable: true, format: 'date', width: 160 },
  { key: 'updatedAt', label: 'Updated At', visible: false, sortable: true, filterable: true, format: 'date', width: 160 },
];

export function ConversionsTable() {
  const [data, setData] = useState<ConversionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<ColumnKey>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);
  const [filters, setFilters] = useState<Map<string, Set<any>>>(new Map());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(100);
  const [isResizing, setIsResizing] = useState<{
    column: ColumnKey;
    startX: number;
    startWidth: number;
    element: HTMLElement;
  } | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);

  useEffect(() => {
    const savedColumns = localStorage.getItem(columnsStorageKey);
    if (savedColumns) {
      try {
        const parsed = JSON.parse(savedColumns) as ColumnConfig[];
        if (parsed?.length) {
          setColumns(parsed);
        }
      } catch {
        setColumns(defaultColumns);
      }
    }

    const savedFilters = localStorage.getItem(filtersStorageKey);
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters) as Record<string, any[]>;
        const restored = new Map<string, Set<any>>();
        Object.entries(parsed).forEach(([key, values]) => {
          restored.set(key, new Set(values));
        });
        setFilters(restored);
      } catch {
        setFilters(new Map());
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(columnsStorageKey, JSON.stringify(columns));
  }, [columns]);

  useEffect(() => {
    const serializable: Record<string, any[]> = {};
    filters.forEach((value, key) => {
      serializable[key] = Array.from(value);
    });
    localStorage.setItem(filtersStorageKey, JSON.stringify(serializable));
  }, [filters]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/conversions');
        const json = await response.json();
        setData(Array.isArray(json) ? json : []);
      } catch {
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizing) return;
      const deltaX = event.clientX - isResizing.startX;
      const newWidth = Math.max(60, isResizing.startWidth + deltaX);
      isResizing.element.style.width = `${newWidth}px`;
      isResizing.element.style.minWidth = `${newWidth}px`;
      isResizing.element.style.maxWidth = `${newWidth}px`;
    };

    const handleMouseUp = () => {
      if (!isResizing) return;
      const finalWidth = parseInt(isResizing.element.style.width, 10);
      setColumns((prev) =>
        prev.map((col) => (col.key === isResizing.column ? { ...col, width: finalWidth } : col))
      );
      setIsResizing(null);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const visibleColumns = useMemo(() => columns.filter((col) => col.visible), [columns]);

  const columnValues = useMemo(() => {
    const map = new Map<ColumnKey, any[]>();
    visibleColumns.forEach((col) => map.set(col.key, []));
    data.forEach((row) => {
      visibleColumns.forEach((col) => {
        const arr = map.get(col.key);
        if (!arr) return;
        arr.push((row as any)[col.key]);
      });
    });
    return map;
  }, [data, visibleColumns]);

  const applyFilters = useCallback(
    (rows: ConversionRow[]) => {
      return rows.filter((row) => {
        for (const [key, selected] of filters.entries()) {
          if (selected.size === 0) continue;
          const value = (row as any)[key];
          if (!selected.has(value)) return false;
        }
        return true;
      });
    },
    [filters]
  );

  const filteredData = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const searched = term
      ? data.filter((row) =>
          visibleColumns.some((col) =>
            String((row as any)[col.key] ?? '')
              .toLowerCase()
              .includes(term)
          )
        )
      : data;

    return applyFilters(searched);
  }, [data, searchTerm, visibleColumns, applyFilters]);

  const sortedData = useMemo(() => {
    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      const aValue = (a as any)[sortColumn];
      const bValue = (b as any)[sortColumn];

      if (aValue === null || aValue === undefined) return sortDirection === 'asc' ? -1 : 1;
      if (bValue === null || bValue === undefined) return sortDirection === 'asc' ? 1 : -1;

      const columnConfig = columns.find((col) => col.key === sortColumn);
      if (columnConfig?.format === 'number') {
        return sortDirection === 'asc' ? Number(aValue) - Number(bValue) : Number(bValue) - Number(aValue);
      }

      if (columnConfig?.format === 'date') {
        const aDate = new Date(aValue).getTime();
        const bDate = new Date(bValue).getTime();
        return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
      }

      return sortDirection === 'asc'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });
    return sorted;
  }, [filteredData, sortColumn, sortDirection, columns]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [currentPage, totalPages]);

  const handleSort = (column: ColumnKey) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleFilterChange = (key: ColumnKey, values: Set<any>) => {
    setFilters((prev) => {
      const next = new Map(prev);
      next.set(String(key), values);
      return next;
    });
  };

  const handleDragStart = (key: ColumnKey) => {
    setDraggedColumn(key);
  };

  const handleDragOver = (event: React.DragEvent, key: ColumnKey) => {
    event.preventDefault();
    if (draggedColumn && draggedColumn !== key) {
      setDragOverColumn(key);
    }
  };

  const handleDrop = (targetKey: ColumnKey) => {
    if (!draggedColumn || draggedColumn === targetKey) return;
    setColumns((prev) => {
      const newColumns = [...prev];
      const draggedIndex = newColumns.findIndex((col) => col.key === draggedColumn);
      const targetIndex = newColumns.findIndex((col) => col.key === targetKey);
      if (draggedIndex === -1 || targetIndex === -1) return prev;
      const [dragged] = newColumns.splice(draggedIndex, 1);
      newColumns.splice(targetIndex, 0, dragged);
      return newColumns;
    });
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const formatValue = (value: any, format?: ColumnConfig['format']) => {
    if (value === null || value === undefined) return '';
    if (format === 'number') {
      const num = Number(value);
      return Number.isNaN(num) ? String(value) : num.toLocaleString('en-US', { maximumFractionDigits: 4 });
    }
    if (format === 'date') {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
    }
    return String(value);
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search conversions..."
            className="w-[280px]"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <Settings className="h-4 w-4" />
              Columns
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56">
            <div className="space-y-2">
              {columns.map((col) => (
                <label key={col.key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={col.visible}
                    onCheckedChange={(value) =>
                      setColumns((prev) =>
                        prev.map((c) =>
                          c.key === col.key ? { ...c, visible: Boolean(value) } : c
                        )
                      )
                    }
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="rounded-md border overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {visibleColumns.map((col) => {
                  const isSorted = sortColumn === col.key;
                  const values = columnValues.get(col.key as ColumnKey) ?? [];
                  const activeFilters = filters.get(String(col.key)) ?? new Set();

                  return (
                    <th
                      key={col.key}
                      style={{ width: col.width, minWidth: col.width, maxWidth: col.width }}
                      className={`relative px-3 py-2 text-left font-medium border-r last:border-r-0 ${
                        dragOverColumn === col.key ? 'bg-muted' : ''
                      }`}
                      draggable={!isResizing}
                      onDragStart={() => handleDragStart(col.key)}
                      onDragOver={(event) => handleDragOver(event, col.key)}
                      onDrop={() => handleDrop(col.key)}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          className="flex items-center gap-1"
                          onClick={() => handleSort(col.key)}
                        >
                          {col.label}
                          {isSorted ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                          )}
                        </button>
                        {col.filterable && (
                          <ColumnFilterPopover
                            columnKey={String(col.key)}
                            columnLabel={col.label}
                            values={values}
                            activeFilters={activeFilters}
                            onFilterChange={(value) => handleFilterChange(col.key, value)}
                            onSort={(direction) => {
                              setSortColumn(col.key);
                              setSortDirection(direction);
                            }}
                          />
                        )}
                      </div>
                      <div
                        className="absolute top-0 right-0 h-full w-1 cursor-col-resize"
                        onMouseDown={(event) => {
                          setIsResizing({
                            column: col.key,
                            startX: event.clientX,
                            startWidth: col.width,
                            element: event.currentTarget.parentElement as HTMLElement,
                          });
                        }}
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-3 py-6 text-center text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-3 py-6 text-center text-muted-foreground">
                    No conversion records found.
                  </td>
                </tr>
              ) : (
                paginatedData.map((row) => (
                  <tr key={row.uuid} className="border-t">
                    {visibleColumns.map((col) => (
                      <td key={`${row.uuid}-${col.key}`} className="px-3 py-2 border-r last:border-r-0">
                        {formatValue((row as any)[col.key], col.format)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
        <div>
          Showing {paginatedData.length} of {sortedData.length} records
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Prev
          </Button>
          <span>
            Page {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
