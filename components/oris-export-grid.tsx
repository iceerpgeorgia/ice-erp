'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ColumnFilterPopover } from '@/components/figma/shared/column-filter-popover';
import { useTableFilters } from '@/components/figma/shared/use-table-filters';
import type { ColumnFormat } from '@/components/figma/shared/table-filters';

// A client-side grid for the ORIS Export page: per-column filters (the app's shared filter popover),
// sorting, global search, column resizing, drag-to-reorder and show/hide. The layout (order, widths,
// visibility) is saved per grid in localStorage.

export type GridColumn<K extends string> = {
  key: K;
  label: string;
  width: number;
  format?: ColumnFormat;
  align?: 'left' | 'right';
  mono?: boolean;
  /** Text shown in the cell; defaults to the raw value. */
  render?: (value: any) => string;
};

type LayoutColumn<K extends string> = { key: K; width: number; visible: boolean };

const MIN_WIDTH = 50;

function loadLayout<K extends string>(storageKey: string, columns: GridColumn<K>[]): LayoutColumn<K>[] {
  const defaults = columns.map((c) => ({ key: c.key, width: c.width, visible: true }));
  if (typeof window === 'undefined') return defaults;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as LayoutColumn<K>[] | null;
    if (!Array.isArray(saved)) return defaults;
    const known = new Set(columns.map((c) => c.key));
    const kept = saved.filter((c) => known.has(c.key));
    // Columns added since the layout was saved go to the end.
    const missing = defaults.filter((d) => !kept.some((c) => c.key === d.key));
    return [...kept, ...missing];
  } catch {
    return defaults;
  }
}

export function OrisExportGrid<K extends string, TRow extends Record<K, any>>({
  storageKey,
  columns,
  rows,
  defaultSort,
  rowTitle,
}: {
  storageKey: string;
  columns: GridColumn<K>[];
  rows: TRow[];
  defaultSort: K;
  /** Tooltip for a whole row (e.g. the full comment). */
  rowTitle?: (row: TRow) => string | undefined;
}) {
  const byKey = useMemo(() => new Map(columns.map((c) => [c.key, c])), [columns]);
  const [layout, setLayout] = useState<LayoutColumn<K>[]>(() => columns.map((c) => ({ key: c.key, width: c.width, visible: true })));
  useEffect(() => setLayout(loadLayout(storageKey, columns)), [storageKey, columns]);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(layout));
    } catch {
      /* storage full or blocked: the layout just is not remembered */
    }
  }, [storageKey, layout]);

  const filterColumns = useMemo(
    () =>
      layout.map((l) => {
        const c = byKey.get(l.key)!;
        return { key: c.key, label: c.label, visible: l.visible, sortable: true, filterable: true, format: c.format, width: l.width };
      }),
    [layout, byKey]
  );

  const {
    filters,
    searchTerm,
    setSearchTerm,
    sortColumn,
    sortDirection,
    handleSort,
    setSortColumn,
    setSortDirection,
    handleFilterChange,
    clearFilters,
    activeFilterCount,
    getColumnValues,
    sortedData,
    paginatedData,
    currentPage,
    totalPages,
    setCurrentPage,
  } = useTableFilters<TRow, K>({
    data: rows,
    columns: filterColumns,
    defaultSortColumn: defaultSort,
    defaultSortDirection: 'asc',
    filtersStorageKey: `${storageKey}-filters`,
    pageSize: 300,
  });

  const visible = layout.filter((l) => l.visible);

  // ── Resize ────────────────────────────────────────────────────────────────
  const resizing = useRef<{ key: K; startX: number; startWidth: number } | null>(null);
  const onResizeMove = useCallback((event: MouseEvent) => {
    const state = resizing.current;
    if (!state) return;
    const width = Math.max(MIN_WIDTH, state.startWidth + event.clientX - state.startX);
    setLayout((current) => current.map((c) => (c.key === state.key ? { ...c, width } : c)));
  }, []);
  const onResizeEnd = useCallback(() => {
    resizing.current = null;
    document.body.style.cursor = '';
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);
  }, [onResizeMove]);
  const startResize = (event: React.MouseEvent, column: LayoutColumn<K>) => {
    event.preventDefault();
    event.stopPropagation();
    resizing.current = { key: column.key, startX: event.clientX, startWidth: column.width };
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', onResizeEnd);
  };
  useEffect(() => onResizeEnd, [onResizeEnd]);

  // ── Reorder (drag a header onto another) ─────────────────────────────────
  const [dragKey, setDragKey] = useState<K | null>(null);
  const [overKey, setOverKey] = useState<K | null>(null);
  const moveColumn = (from: K, to: K) => {
    if (from === to) return;
    setLayout((current) => {
      const next = [...current];
      const fromIndex = next.findIndex((c) => c.key === from);
      const [moved] = next.splice(fromIndex, 1);
      next.splice(next.findIndex((c) => c.key === to), 0, moved);
      return next;
    });
  };

  const sortIcon = (key: K) =>
    sortColumn !== key ? (
      <ArrowUpDown className="h-3 w-3 opacity-40" />
    ) : sortDirection === 'asc' ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );

  const cellText = (column: GridColumn<K>, value: any) => {
    if (column.render) return column.render(value);
    if (value === null || value === undefined) return '';
    return String(value);
  };

  const tableWidth = visible.reduce((sum, c) => sum + c.width, 0);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search all columns…"
          className="h-8 w-64"
        />
        {activeFilterCount > 0 && (
          <Button variant="outline" size="sm" className="h-8" onClick={clearFilters}>
            Clear filters ({activeFilterCount})
          </Button>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1">
              <Columns3 className="h-3.5 w-3.5" /> Columns
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="space-y-1">
              {layout.map((l) => (
                <label key={l.key} className="flex items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted">
                  <Checkbox
                    checked={l.visible}
                    onCheckedChange={(checked) =>
                      setLayout((current) => current.map((c) => (c.key === l.key ? { ...c, visible: checked === true } : c)))
                    }
                  />
                  {byKey.get(l.key)?.label}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-muted-foreground"
          title="Restore the default column order, widths and visibility"
          onClick={() => setLayout(columns.map((c) => ({ key: c.key, width: c.width, visible: true })))}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset layout
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          {sortedData.length.toLocaleString('en-US')} of {rows.length.toLocaleString('en-US')} rows
        </span>
      </div>

      <div className="overflow-auto max-h-[60vh] border rounded">
        <table className="text-xs border-collapse" style={{ width: tableWidth, tableLayout: 'fixed' }}>
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              {visible.map((l) => {
                const column = byKey.get(l.key)!;
                return (
                  <th
                    key={l.key}
                    draggable
                    onDragStart={(e) => {
                      setDragKey(l.key);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      if (!dragKey) return;
                      e.preventDefault();
                      setOverKey(l.key);
                    }}
                    onDragLeave={() => setOverKey((k) => (k === l.key ? null : k))}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragKey) moveColumn(dragKey, l.key);
                      setDragKey(null);
                      setOverKey(null);
                    }}
                    onDragEnd={() => {
                      setDragKey(null);
                      setOverKey(null);
                    }}
                    className={`relative select-none px-2 py-1.5 text-left font-medium border-r border-border/60 cursor-grab ${
                      overKey === l.key && dragKey !== l.key ? 'bg-primary/10' : ''
                    } ${dragKey === l.key ? 'opacity-50' : ''}`}
                    style={{ width: l.width }}
                    title="Drag to move this column"
                  >
                    <div className={`flex items-center gap-1 ${column.align === 'right' ? 'justify-end' : ''}`}>
                      <button
                        type="button"
                        className="flex min-w-0 items-center gap-1 hover:text-primary"
                        onClick={() => handleSort(l.key)}
                      >
                        <span className="truncate">{column.label}</span>
                        {sortIcon(l.key)}
                      </button>
                      <ColumnFilterPopover
                        columnKey={l.key}
                        columnLabel={column.label}
                        values={getColumnValues(l.key)}
                        activeFilter={filters.get(l.key)}
                        onAdvancedFilterChange={(filter) => handleFilterChange(l.key, filter)}
                        onFilterChange={(values) => handleFilterChange(l.key, values.size > 0 ? { mode: 'facet', values } : null)}
                        columnFormat={column.format}
                        renderValue={column.render}
                        onSort={(direction) => {
                          setSortColumn(l.key);
                          setSortDirection(direction);
                        }}
                      />
                    </div>
                    <div
                      className="absolute top-0 -right-1 z-20 h-full w-2 cursor-col-resize hover:bg-primary/30"
                      onMouseDown={(e) => startResize(e, l)}
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                      title="Drag to resize"
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, index) => (
              <tr key={index} className="border-t align-top hover:bg-muted/40" title={rowTitle?.(row)}>
                {visible.map((l) => {
                  const column = byKey.get(l.key)!;
                  const text = cellText(column, row[l.key]);
                  return (
                    <td
                      key={l.key}
                      className={`px-2 py-1 truncate border-r border-border/40 ${column.align === 'right' ? 'text-right tabular-nums' : ''} ${
                        column.mono ? 'font-mono' : ''
                      }`}
                      style={{ width: l.width, maxWidth: l.width }}
                      title={text}
                    >
                      {text}
                    </td>
                  );
                })}
              </tr>
            ))}
            {paginatedData.length === 0 && (
              <tr>
                <td colSpan={visible.length} className="px-2 py-6 text-center text-muted-foreground">
                  No rows match the filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs">
          <Button variant="outline" size="sm" className="h-7" disabled={currentPage <= 1} onClick={() => setCurrentPage(currentPage - 1)}>
            Previous
          </Button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <Button variant="outline" size="sm" className="h-7" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(currentPage + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
