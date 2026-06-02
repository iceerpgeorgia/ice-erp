# data-table

Advanced DataTable skill for this Next.js 14 + TanStack Table v8 + shadcn/ui codebase.
Covers every pattern used across the 20+ existing feature tables in `components/figma/`,
enriched with patterns from **sadmann7/tablecn** (focused shadcn+TanStack reference).

**Two implementation tiers:**
- **Tier 1 (this codebase's pattern):** `ColumnConfig[]` + `useTableFilters` hook — simpler, already used everywhere.
- **Tier 2 (tablecn pattern):** native `ColumnDef[]` + `ColumnMeta` augmentation — more composable, better for new standalone tables.

---

## Stack & Imports

```ts
// TanStack Table v8 — always import from '@tanstack/react-table'
import {
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type RowSelectionState,
} from '@tanstack/react-table';

// Virtual scrolling — use for rows >200
import { useVirtualizer } from '@tanstack/react-virtual';

// Shared filter engine (always re-use, never duplicate)
import { useTableFilters } from '@/components/figma/shared/use-table-filters';
import { ColumnFilterPopover } from '@/components/figma/shared/column-filter-popover';
import { ClearFiltersButton } from '@/components/figma/shared/clear-filters-button';
import type { ColumnFormat, ColumnFilter, FilterState } from '@/components/figma/shared/table-filters';
import { BLANK_FACET_TOKEN } from '@/components/figma/shared/table-filters';

// shadcn primitives
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// lucide icons
import { Search, ArrowUp, ArrowDown, ArrowUpDown, Settings, Eye, EyeOff, X } from 'lucide-react';
```

---

## Column Config Pattern

Every table defines a `ColumnConfig[]` — NOT TanStack `ColumnDef[]` directly. This is the canonical
pattern used across all existing tables. The shared `useTableFilters` hook consumes this shape.

```ts
type ColumnKey = keyof MyRow;

type ColumnConfig = {
  key: ColumnKey;
  label: string;
  width: number;          // pixel width for colgroup / sticky cells
  visible: boolean;       // default visibility
  sortable: boolean;
  filterable: boolean;
  format?: ColumnFormat;  // 'text' | 'currency' | 'number' | 'percent' | 'boolean' | 'date' | 'datetime' | 'period'
  responsive?: 'sm' | 'md' | 'lg' | 'xl'; // hide until breakpoint
};

const defaultColumns: ColumnConfig[] = [
  { key: 'id',        label: 'ID',      width: 80,  visible: false, sortable: true,  filterable: true },
  { key: 'name',      label: 'Name',    width: 240, visible: true,  sortable: true,  filterable: true },
  { key: 'amount',    label: 'Amount',  width: 140, visible: true,  sortable: true,  filterable: true,  format: 'currency' },
  { key: 'date',      label: 'Date',    width: 120, visible: true,  sortable: true,  filterable: true,  format: 'date' },
  { key: 'isActive',  label: 'Active',  width: 90,  visible: true,  sortable: true,  filterable: true,  format: 'boolean' },
];
```

---

## useTableFilters — The Core Hook

All sorting, filtering, pagination, and search are handled by ONE hook. Do NOT reimplement them.

```ts
const {
  filters,           // FilterState (Map<colKey, ColumnFilter>)
  searchTerm,
  setSearchTerm,
  sortColumn,
  sortDirection,
  currentPage,
  pageSize,
  filteredData,      // after search + column filters
  sortedData,        // after search + column filters + sort
  paginatedData,     // after everything + pagination
  totalPages,
  setFilter,         // (colKey, filter | null) => void
  clearAllFilters,
  setSort,           // (colKey) => void  (toggles asc/desc)
  setPage,
  getFacetValues,    // (colKey) => any[]  — unique values from filteredData
  hasActiveFilters,
} = useTableFilters({
  data,
  columns,
  defaultSortColumn: 'date',
  defaultSortDirection: 'desc',
  filtersStorageKey: 'my-table-filters',  // persists to localStorage
  searchColumns: ['name', 'description'],  // omit to search all visible cols
  pageSize: 100,
});
```

---

## Column Visibility Toggle

```ts
const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);

const toggleColumn = (key: ColumnKey) =>
  setColumns(cols => cols.map(c => c.key === key ? { ...c, visible: !c.visible } : c));

// Column visibility popover (Settings icon → list of checkboxes)
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline" size="sm"><Settings className="h-4 w-4" /></Button>
  </PopoverTrigger>
  <PopoverContent className="w-56 p-2">
    {columns.map(col => (
      <label key={col.key} className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-muted rounded text-sm">
        <Checkbox checked={col.visible} onCheckedChange={() => toggleColumn(col.key)} />
        {col.label}
      </label>
    ))}
  </PopoverContent>
</Popover>
```

---

## Sort Header Button

```tsx
function SortButton({ columnKey, label, sortColumn, sortDirection, onSort }) {
  const active = sortColumn === columnKey;
  return (
    <button
      onClick={() => onSort(columnKey)}
      className="flex items-center gap-1 font-medium text-xs uppercase tracking-wide hover:text-foreground"
    >
      {label}
      {active
        ? sortDirection === 'asc'
          ? <ArrowUp className="h-3 w-3" />
          : <ArrowDown className="h-3 w-3" />
        : <ArrowUpDown className="h-3 w-3 opacity-30" />
      }
    </button>
  );
}
```

---

## Column Filter Popover (ColumnFilterPopover)

Already built — always use it, never build a new one.

```tsx
<ColumnFilterPopover
  columnKey="amount"
  label="Amount"
  format="currency"             // drives operator UI (numeric ops vs text ops)
  filter={filters.get('amount') ?? null}
  facetValues={getFacetValues('amount')}  // only for 'text' format
  onFilterChange={(f) => setFilter('amount', f)}
  renderValue={(v) => String(v)} // optional display formatter
/>
```

Clear all button:
```tsx
<ClearFiltersButton
  hasActiveFilters={hasActiveFilters}
  onClear={clearAllFilters}
/>
```

---

## Table Shell (sticky header, scrollable body)

```tsx
const parentRef = useRef<HTMLDivElement>(null);

// Virtual rows (use when rows > 200)
const rowVirtualizer = useVirtualizer({
  count: sortedData.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 36,       // row height in px (compact density)
  overscan: 10,
});

return (
  <div className="flex flex-col h-full min-h-0">
    {/* Toolbar */}
    <div className="flex items-center gap-2 px-3 py-2 border-b bg-card shrink-0">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search…"
          className="pl-8 h-8 w-64 text-sm"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="absolute right-2 top-2">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
      <ClearFiltersButton hasActiveFilters={hasActiveFilters} onClear={clearAllFilters} />
      {/* ... other toolbar actions */}
    </div>

    {/* Scrollable table */}
    <div ref={parentRef} className="flex-1 overflow-auto min-h-0">
      <table className="ds-table w-full text-sm border-collapse">
        <colgroup>
          {columns.filter(c => c.visible).map(col => (
            <col key={col.key} style={{ width: col.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.filter(c => c.visible).map(col => (
              <th key={col.key} className="ds-table-th">
                <div className="flex items-center justify-between gap-1">
                  {col.sortable
                    ? <SortButton columnKey={col.key} label={col.label} sortColumn={sortColumn} sortDirection={sortDirection} onSort={setSort} />
                    : <span className="text-xs font-medium uppercase tracking-wide">{col.label}</span>
                  }
                  {col.filterable && (
                    <ColumnFilterPopover
                      columnKey={col.key}
                      label={col.label}
                      format={col.format}
                      filter={filters.get(col.key) ?? null}
                      facetValues={getFacetValues(col.key)}
                      onFilterChange={f => setFilter(col.key, f)}
                    />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody style={{ height: rowVirtualizer.getTotalSize() }}>
          {rowVirtualizer.getVirtualItems().map(virtualRow => {
            const row = sortedData[virtualRow.index];
            return (
              <tr
                key={row.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className="ds-table-tr"
              >
                {columns.filter(c => c.visible).map(col => (
                  <td key={col.key} className="ds-table-td">{renderCell(row, col)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    {/* Pagination (when NOT virtualizing) */}
    <div className="flex items-center justify-between px-3 py-2 border-t bg-card text-xs text-muted-foreground shrink-0">
      <span>{filteredData.length} rows</span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1}>‹</Button>
        <span>{currentPage} / {totalPages}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages}>›</Button>
      </div>
    </div>
  </div>
);
```

---

## Sticky First Column Pattern

Wrap the first `<td>` and `<th>` with `className="ds-table-sticky-left"`.

```tsx
<th className="ds-table-th ds-table-sticky-left">{/* ... */}</th>
// ...
<td className="ds-table-td ds-table-sticky-left">{/* ... */}</td>
```

The `.ds-table-sticky-left` class is defined in `app/globals.css`:
- `position: sticky; left: 0; z-index: 1; background: inherit;`

---

## Row Rendering — renderCell

Always write a `renderCell(row, col)` function. Keep cell logic here, not inline.

```tsx
function renderCell(row: MyRow, col: ColumnConfig): React.ReactNode {
  const value = row[col.key as keyof MyRow];

  // Boolean
  if (col.format === 'boolean') {
    return value
      ? <Badge variant="outline" className="text-success border-success/30 bg-success-soft text-xs">Yes</Badge>
      : <Badge variant="outline" className="text-muted-foreground text-xs">No</Badge>;
  }

  // Currency
  if (col.format === 'currency') {
    if (value == null) return <span className="text-muted-foreground">—</span>;
    const num = parseFloat(String(value));
    return <span className="tabular-nums">{num.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
  }

  // Date
  if (col.format === 'date') {
    if (!value) return <span className="text-muted-foreground">—</span>;
    const d = new Date(String(value));
    return <span className="tabular-nums">{d.toLocaleDateString('en-GB')}</span>;
  }

  // Default
  if (value == null || value === '') return <span className="text-muted-foreground">—</span>;
  return <span>{String(value)}</span>;
}
```

---

## XLSX Export

```ts
import { exportRowsToXlsx } from '@/lib/export-xlsx';

// Export visible columns only, from sorted filtered data
exportRowsToXlsx({
  rows: sortedData,
  columns: columns.filter(c => c.visible).map(c => ({ key: c.key, label: c.label })),
  filename: 'my-table-export.xlsx',
});
```

---

## CSS Design Tokens (ds-table)

All table tokens are defined in `app/globals.css`. Use these class names:

| Class | Purpose |
|---|---|
| `ds-table` | Table root — sticky header, border-collapse, full width |
| `ds-table-th` | Header cell — bg, font, padding, border |
| `ds-table-td` | Data cell — padding, border |
| `ds-table-tr` | Data row — hover highlight |
| `ds-table-sticky-left` | Sticky first column |
| `data-density="compact"` | 28px row height (set on `<table>`) |
| `data-density="cozy"` | 36px row height (default) |
| `data-density="comfortable"` | 48px row height |

Density toggle example:
```tsx
const [density, setDensity] = useState<'compact' | 'cozy' | 'comfortable'>('cozy');
// ...
<table className="ds-table" data-density={density}>
```

---

## Filter Persistence (localStorage)

Pass `filtersStorageKey` to `useTableFilters`. It auto-saves/restores the full `FilterState`.
Key naming convention: `<entity>-table-filters` e.g. `"payments-table-filters"`.

---

## Row Selection (checkboxes)

```tsx
const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

const toggleRow = (id: number) =>
  setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

const toggleAll = () =>
  setSelectedIds(prev =>
    prev.size === paginatedData.length ? new Set() : new Set(paginatedData.map(r => r.id))
  );

// In header
<th><Checkbox checked={selectedIds.size === paginatedData.length && paginatedData.length > 0} onCheckedChange={toggleAll} /></th>
// In row
<td><Checkbox checked={selectedIds.has(row.id)} onCheckedChange={() => toggleRow(row.id)} /></td>
```

---

## Cross-Filter Facets

`getFacetValues(colKey)` always returns unique values from the **currently filtered dataset**,
meaning facet counts update as other filters change (AG Grid / Excel behavior).

```tsx
// Show facet count alongside label in popover
const facets = getFacetValues('status');
// returns: ['active', 'inactive', '__BLANK__']
// Use BLANK_FACET_TOKEN === '__BLANK__' to represent null/empty values
```

---

## Inline Edit Pattern

Used in counteragents, projects tables.

```tsx
type EditingCell = { rowId: number; field: string } | null;
const [editingCell, setEditingCell] = useState<EditingCell>(null);

// In cell render
const isEditing = editingCell?.rowId === row.id && editingCell?.field === col.key;
return isEditing ? (
  <Input
    autoFocus
    defaultValue={String(value ?? '')}
    className="h-6 text-xs px-1"
    onBlur={e => { commitEdit(row.id, col.key, e.target.value); setEditingCell(null); }}
    onKeyDown={e => { if (e.key === 'Escape') setEditingCell(null); }}
  />
) : (
  <span
    onDoubleClick={() => setEditingCell({ rowId: row.id, field: col.key })}
    className="cursor-text min-h-[1rem] block"
  >
    {String(value ?? '')}
  </span>
);
```

---

## Global Search — Regex Mode

`useTableFilters` supports `regexSearch: true`. When enabled, the search term is compiled as a
JavaScript regex. Invalid regex silently falls back to plain text.

```ts
useTableFilters({ ..., regexSearch: true });
// User can type: "^WB-[0-9]+" to find payment IDs starting with WB-
```

---

## (Advanced) ColumnMeta Type Augmentation — tablecn pattern

When using native TanStack Table `ColumnDef[]` (not the `ColumnConfig[]` pattern above), drive filter
UI automatically via `column.columnDef.meta`. Augment the module once globally:

```ts
// types/data-table.ts — declare once, auto-applies to all ColumnDef
declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    label?: string;           // display label (falls back to column.id)
    placeholder?: string;     // filter input placeholder
    variant?: FilterVariant;  // drives which filter component renders
    options?: Option[];       // for 'select' / 'multiSelect' variants
    range?: [number, number]; // min/max override for 'range' slider
    unit?: string;            // unit suffix shown inside numeric inputs ("GEL", "kg")
    icon?: React.FC<React.SVGProps<SVGSVGElement>>;
  }
}

type FilterVariant =
  | 'text' | 'number' | 'range'
  | 'date' | 'dateRange'
  | 'boolean'
  | 'select' | 'multiSelect';

interface Option {
  label: string;
  value: string;
  count?: number;
  icon?: React.FC<React.SVGProps<SVGSVGElement>>;
}
```

Then in ColumnDef:
```ts
{
  accessorKey: 'status',
  meta: { label: 'Status', variant: 'multiSelect', options: STATUS_OPTIONS },
},
{
  accessorKey: 'amount',
  meta: { label: 'Amount', variant: 'range', unit: 'GEL' },
},
```

---

## (Advanced) Auto-Filter Toolbar — tablecn pattern

When using `ColumnMeta.variant`, the toolbar auto-renders the right filter UI per column:

```tsx
// Renders the right filter component based on meta.variant
function DataTableToolbarFilter<TData>({ column }: { column: Column<TData> }) {
  const meta = column.columnDef.meta;
  if (!meta?.variant) return null;

  switch (meta.variant) {
    case 'text':
    case 'number':
      return (
        <Input
          placeholder={meta.placeholder ?? meta.label}
          value={(column.getFilterValue() as string) ?? ''}
          onChange={e => column.setFilterValue(e.target.value)}
          className="h-8 w-40 lg:w-56"
        />
      );
    case 'range':
      return <DataTableSliderFilter column={column} title={meta.label} />;
    case 'date':
    case 'dateRange':
      return <DataTableDateFilter column={column} title={meta.label} multiple={meta.variant === 'dateRange'} />;
    case 'select':
    case 'multiSelect':
      return (
        <DataTableFacetedFilter
          column={column}
          title={meta.label}
          options={meta.options ?? []}
          multiple={meta.variant === 'multiSelect'}
        />
      );
    default:
      return null;
  }
}
```

---

## (Advanced) Faceted Filter Component — tablecn pattern

Command-based popover with checkboxes + count badges. Uses `getFacetedUniqueValues()` from TanStack
for live cross-filter counts (values update as other filters change).

```tsx
// Requires in useReactTable: getFacetedRowModel(), getFacetedUniqueValues()
function DataTableFacetedFilter<TData>({ column, title, options, multiple }) {
  const selectedValues = new Set(
    Array.isArray(column.getFilterValue()) ? (column.getFilterValue() as string[]) : []
  );

  const onSelect = (value: string, isSelected: boolean) => {
    const next = new Set(selectedValues);
    if (multiple) {
      isSelected ? next.delete(value) : next.add(value);
      column.setFilterValue(next.size ? Array.from(next) : undefined);
    } else {
      column.setFilterValue(isSelected ? undefined : [value]);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="border-dashed font-normal h-8">
          {selectedValues.size > 0
            ? <XCircle className="opacity-70" onClick={e => { e.stopPropagation(); column.setFilterValue(undefined); }} />
            : <PlusCircle />
          }
          {title}
          {selectedValues.size > 0 && (
            <Badge variant="secondary" className="rounded-sm px-1 font-normal">
              {selectedValues.size > 2 ? `${selectedValues.size} selected` : options.filter(o => selectedValues.has(o.value)).map(o => o.label).join(', ')}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-50 p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup className="max-h-[300px] overflow-y-auto">
              {options.map(option => {
                const isSelected = selectedValues.has(option.value);
                return (
                  <CommandItem key={option.value} onSelect={() => onSelect(option.value, isSelected)}>
                    <div className={cn('flex size-4 items-center justify-center rounded-sm border border-primary', isSelected ? 'bg-primary' : 'opacity-50 [&_svg]:invisible')}>
                      <Check />
                    </div>
                    {option.icon && <option.icon />}
                    <span className="truncate">{option.label}</span>
                    {option.count != null && <span className="ml-auto font-mono text-xs">{option.count}</span>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selectedValues.size > 0 && (
              <><CommandSeparator /><CommandGroup>
                <CommandItem onSelect={() => column.setFilterValue(undefined)} className="justify-center">Clear filters</CommandItem>
              </CommandGroup></>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

---

## (Advanced) Numeric Range Slider Filter — tablecn pattern

Uses `getFacetedMinMaxValues()` to auto-compute min/max from current data. Step size auto-scales.

```tsx
// Requires in useReactTable: getFacetedMinMaxValues()
function DataTableSliderFilter<TData>({ column, title }) {
  const [min, max] = column.getFacetedMinMaxValues() ?? [0, 100];
  const filterValue = (column.getFilterValue() as [number, number]) ?? [min, max];
  const rangeSize = max - min;
  const step = rangeSize <= 20 ? 1 : rangeSize <= 100 ? Math.ceil(rangeSize / 20) : Math.ceil(rangeSize / 50);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="border-dashed font-normal h-8">
          {filterValue[0] !== min || filterValue[1] !== max
            ? <XCircle className="opacity-70" onClick={e => { e.stopPropagation(); column.setFilterValue(undefined); }} />
            : <PlusCircle />
          }
          {title}
          {(filterValue[0] !== min || filterValue[1] !== max) && (
            <span className="ml-1 text-xs">{filterValue[0]} – {filterValue[1]}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto flex flex-col gap-4">
        <Slider min={min} max={max} step={step} value={filterValue} onValueChange={v => column.setFilterValue(v)} />
        <div className="flex gap-2">
          <Input type="number" value={filterValue[0]} onChange={e => column.setFilterValue([+e.target.value, filterValue[1]])} className="h-8 w-24" />
          <Input type="number" value={filterValue[1]} onChange={e => column.setFilterValue([filterValue[0], +e.target.value])} className="h-8 w-24" />
        </div>
        <Button variant="outline" size="sm" onClick={() => column.setFilterValue(undefined)}>Clear</Button>
      </PopoverContent>
    </Popover>
  );
}
```

---

## (Advanced) Date / Date-Range Filter — tablecn pattern

Uses `react-day-picker` Calendar. Stores timestamps as numbers in filter state.

```tsx
// Requires: npm install react-day-picker  (already installed in this project)
function DataTableDateFilter<TData>({ column, title, multiple = false }) {
  const raw = column.getFilterValue() as number[] | undefined;
  const from = raw?.[0] ? new Date(raw[0]) : undefined;
  const to   = raw?.[1] ? new Date(raw[1]) : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="border-dashed font-normal h-8">
          {raw ? <XCircle className="opacity-70" onClick={e => { e.stopPropagation(); column.setFilterValue(undefined); }} /> : <CalendarIcon />}
          {title}
          {raw && <span className="ml-1 text-xs">{from?.toLocaleDateString('en-GB')}{to ? ` – ${to.toLocaleDateString('en-GB')}` : ''}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {multiple ? (
          <Calendar
            mode="range"
            captionLayout="dropdown"
            selected={{ from, to }}
            onSelect={r => column.setFilterValue(r?.from || r?.to ? [r.from?.getTime(), r.to?.getTime()] : undefined)}
          />
        ) : (
          <Calendar
            mode="single"
            captionLayout="dropdown"
            selected={from}
            onSelect={d => column.setFilterValue(d ? [d.getTime()] : undefined)}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
```

---

## (Advanced) Column Pinning — tablecn getColumnPinningStyle

Replaces the CSS-class sticky approach when you need multiple pinned columns or right-pinning:

```ts
// lib/data-table.ts — utility for column pinning inline styles
import type { Column } from '@tanstack/react-table';

export function getColumnPinningStyle<TData>({
  column,
  withBorder = false,
}: {
  column: Column<TData>;
  withBorder?: boolean;
}): React.CSSProperties {
  const isPinned = column.getIsPinned();
  const isLastLeft = isPinned === 'left' && column.getIsLastColumn('left');
  const isFirstRight = isPinned === 'right' && column.getIsFirstColumn('right');
  return {
    position: isPinned ? 'sticky' : 'relative',
    left:  isPinned === 'left'  ? `${column.getStart('left')}px`  : undefined,
    right: isPinned === 'right' ? `${column.getAfter('right')}px` : undefined,
    zIndex: isPinned ? 1 : undefined,
    background: isPinned ? 'var(--background)' : undefined,
    width: column.getSize(),
    boxShadow: withBorder
      ? isLastLeft  ? '-4px 0 4px -4px var(--border) inset' : undefined
      : isFirstRight ? '4px 0 4px -4px var(--border) inset' : undefined,
  };
}

// Usage in <th> and <td>:
<th style={getColumnPinningStyle({ column: header.column, withBorder: true })}>
<td style={getColumnPinningStyle({ column: cell.column, withBorder: true })}>

// Enable in ColumnDef:
{ id: 'name', accessorKey: 'name', enablePinning: true }

// Enable in useReactTable:
{ columnPinning: { left: ['name'] } }  // in initialState
```

---

## (Advanced) Column Header with Sort Dropdown — tablecn pattern

Sort via DropdownMenu (Asc / Desc / Reset / Hide) — cleaner than inline sort button for wider columns:

```tsx
function DataTableColumnHeader<TData, TValue>({ column, label, className }) {
  if (!column.getCanSort() && !column.getCanHide()) return <div className={className}>{label}</div>;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn('-ml-1.5 flex h-8 items-center gap-1.5 rounded-md px-2 hover:bg-accent focus:outline-none', className)}>
        {label}
        {column.getIsSorted() === 'desc' ? <ChevronDown className="size-4 text-muted-foreground" />
          : column.getIsSorted() === 'asc' ? <ChevronUp className="size-4 text-muted-foreground" />
          : <ChevronsUpDown className="size-4 text-muted-foreground" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-28">
        {column.getCanSort() && <>
          <DropdownMenuCheckboxItem checked={column.getIsSorted() === 'asc'} onClick={() => column.toggleSorting(false)}>
            <ChevronUp /> Asc
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={column.getIsSorted() === 'desc'} onClick={() => column.toggleSorting(true)}>
            <ChevronDown /> Desc
          </DropdownMenuCheckboxItem>
          {column.getIsSorted() && (
            <DropdownMenuItem onClick={() => column.clearSorting()}><X /> Reset</DropdownMenuItem>
          )}
        </>}
        {column.getCanHide() && (
          <DropdownMenuCheckboxItem checked={!column.getIsVisible()} onClick={() => column.toggleVisibility(false)}>
            <EyeOff /> Hide
          </DropdownMenuCheckboxItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## (Advanced) Column Visibility — Command-based View Options

Searchable column visibility toggle (better UX than plain checkbox list for 10+ columns):

```tsx
function DataTableViewOptions<TData>({ table }) {
  const columns = table.getAllColumns().filter(c => typeof c.accessorFn !== 'undefined' && c.getCanHide());
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 font-normal">
          <Settings2 className="text-muted-foreground" /> View
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-0">
        <Command>
          <CommandInput placeholder="Search columns..." />
          <CommandList>
            <CommandEmpty>No columns found.</CommandEmpty>
            <CommandGroup>
              {columns.map(col => (
                <CommandItem key={col.id} onSelect={() => col.toggleVisibility(!col.getIsVisible())}>
                  <span className="truncate">{col.columnDef.meta?.label ?? col.id}</span>
                  <Check className={cn('ml-auto size-4', col.getIsVisible() ? 'opacity-100' : 'opacity-0')} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

---

## (Advanced) Pagination — Full Controls with Rows-per-Page Select

```tsx
function DataTablePagination<TData>({ table, pageSizeOptions = [10, 20, 50, 100] }) {
  return (
    <div className="flex w-full items-center justify-between gap-4 px-1 py-2 text-sm">
      <div className="flex-1 text-muted-foreground">
        {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s) selected
      </div>
      <div className="flex items-center gap-6">
        {/* Rows per page */}
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm whitespace-nowrap">Rows per page</span>
          <Select value={`${table.getState().pagination.pageSize}`} onValueChange={v => table.setPageSize(Number(v))}>
            <SelectTrigger className="h-8 w-18"><SelectValue /></SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map(n => <SelectItem key={n} value={`${n}`}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {/* Page indicator */}
        <span className="font-medium text-sm whitespace-nowrap">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </span>
        {/* Navigation */}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-8 hidden lg:flex" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}><ChevronsLeft /></Button>
          <Button variant="outline" size="icon" className="size-8" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}><ChevronLeft /></Button>
          <Button variant="outline" size="icon" className="size-8" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}><ChevronRight /></Button>
          <Button variant="outline" size="icon" className="size-8 hidden lg:flex" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}><ChevronsRight /></Button>
        </div>
      </div>
    </div>
  );
}
```

---

## (Advanced) Row Action Bar — Contextual Bulk Actions

Appears below pagination only when rows are selected. Used for bulk delete, export, assign, etc.

```tsx
<DataTable table={table}>
  {/* actionBar appears only when selectedRows.length > 0 */}
  <DataTableActionBar table={table}>
    <Button size="sm" variant="destructive" onClick={() => deleteSelected(table.getFilteredSelectedRowModel().rows)}>
      Delete {table.getFilteredSelectedRowModel().rows.length} rows
    </Button>
    <Button size="sm" variant="outline" onClick={() => exportSelected(...)}>Export</Button>
  </DataTableActionBar>
</DataTable>

// In DataTable shell:
{actionBar && table.getFilteredSelectedRowModel().rows.length > 0 && actionBar}
```

---

## (Advanced) URL State Persistence — nuqs (tablecn pattern)

For tables where page/sort/filter state should survive page refresh and be shareable via URL.
Uses `nuqs` library (already in Next.js app router). Prefer localStorage (`filtersStorageKey`) for
tables where URL sharing is not needed — it's simpler.

```ts
// Only use when URL-shareable filter state is explicitly required
import { useQueryState, useQueryStates, parseAsInteger, parseAsArrayOf, parseAsString } from 'nuqs';

const [page, setPage]     = useQueryState('page',    parseAsInteger.withDefault(1));
const [perPage, setPerPage] = useQueryState('perPage', parseAsInteger.withDefault(20));
// On filter change, always reset page to 1:
const debouncedSetFilter = useDebouncedCallback((values) => { setPage(1); setFilterValues(values); }, 300);
```

---

## (Advanced) useReactTable — Full Row Model Set

For complex tables (server-side paging + faceted filters + row selection + column pinning):

```ts
const table = useReactTable({
  data,
  columns,
  pageCount,              // total pages (server-driven)
  manualPagination: true, // tell TanStack not to paginate client-side
  manualSorting: true,    // tell TanStack not to sort client-side
  manualFiltering: true,  // tell TanStack not to filter client-side
  state: { pagination, sorting, columnFilters, columnVisibility, rowSelection, columnPinning },
  onPaginationChange,
  onSortingChange,
  onColumnFiltersChange,
  onColumnVisibilityChange: setColumnVisibility,
  onRowSelectionChange: setRowSelection,
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFacetedRowModel: getFacetedRowModel(),           // required for faceted filters
  getFacetedUniqueValues: getFacetedUniqueValues(),   // required for FacetedFilter counts
  getFacetedMinMaxValues: getFacetedMinMaxValues(),   // required for SliderFilter auto-range
  enableRowSelection: true,
  defaultColumn: { enableColumnFilter: false },       // opt-in per column
});
```

For **client-side** tables (all data in memory): drop `manual*: true` and `pageCount`, keep all row models.

---

## (Advanced) Filter Operator Reference — tablecn config

Full operator vocabulary for `ExtendedColumnFilter.operator`:

| Operator | Applies to | Meaning |
|---|---|---|
| `iLike` | text | contains (case-insensitive) |
| `notILike` | text | does not contain |
| `eq` | text, number, boolean, select, date | equals |
| `ne` | all | not equals |
| `lt` / `lte` | number, date | less than / less than or equal |
| `gt` / `gte` | number, date | greater than / greater than or equal |
| `isBetween` | number, date | inclusive range [a, b] |
| `isRelativeToToday` | date | today / yesterday / last 7d / last 30d |
| `inArray` | multiSelect | has any of |
| `notInArray` | multiSelect | has none of |
| `isEmpty` | all | null / undefined / empty string |
| `isNotEmpty` | all | not null, not empty |

AND / OR join between multiple column filters via `joinOperator: 'and' | 'or'`.

---

## Rules & Anti-Patterns

| ✅ DO | ❌ DON'T |
|---|---|
| Re-use `useTableFilters` hook for all sort/filter/page state | Duplicate filter logic per table |
| Re-use `ColumnFilterPopover` for all column filter UIs | Build a new filter popover per table |
| Use `renderCell()` function for all cell rendering | Inline complex cell logic in JSX |
| Export with `exportRowsToXlsx` from `lib/export-xlsx` | Write custom xlsx logic per table |
| Use `ds-table-*` CSS classes | Use Tailwind utility soup on every cell |
| Use `useVirtualizer` for >200 rows | Render all rows without virtualization |
| Pass `filtersStorageKey` to persist user filters | Let filter state reset on navigation |
| Use `BLANK_FACET_TOKEN` to represent null values in facets | Use `null` or `""` directly in filter sets |
| Use `format: 'currency'` / `'date'` in ColumnConfig | Use format props scattered in JSX |
| Keep density toggle in local component state | Store density in global state |
| Use `tabular-nums` on all numeric cells | Allow ragged number column widths |
| Use `text-muted-foreground` for null/empty dash (—) | Leave cells blank or show "null" |
| Use `getFacetedUniqueValues()` for live cross-filter facet counts | Compute facets from full data (stale counts) |
| Use `getFacetedMinMaxValues()` for slider auto-range | Hardcode min/max in slider |
| Use `border-dashed` outline style on filter trigger buttons | Use solid borders on filter buttons |
| Use `Command` + `CommandInput` for searchable column visibility (>10 cols) | Plain checkbox list for long column lists |
| Show row action bar only when `selectedRows.length > 0` | Always-visible bulk action toolbar |
| Use `manualPagination/Sorting/Filtering: true` for server-side tables | Let TanStack paginate server-fetched data client-side |
| Use `nuqs` for URL-shareable filter state | Use `useState` when URL persistence is needed |
| Use `getColumnPinningStyle()` for multi-column or right-side pinning | Use CSS class sticky only for single left-pin |
| Use `column.columnDef.meta.variant` to drive filter UI type | Duplicate filter switch logic per table |

---

## File Locations

| Purpose | Path |
|---|---|
| Filter engine | `components/figma/shared/table-filters.ts` |
| Filter hook | `components/figma/shared/use-table-filters.ts` |
| Filter popover component | `components/figma/shared/column-filter-popover.tsx` |
| Clear filters button | `components/figma/shared/clear-filters-button.tsx` |
| XLSX export utility | `lib/export-xlsx.ts` |
| CSS design tokens | `app/globals.css` (`.ds-table` family) |
| Reference table (TanStack + Virtual) | `components/figma/waybills-table.tsx` |
| Reference table (custom filter engine) | `components/figma/payments-table.tsx` |
| Column visibility pattern | `components/figma/counteragents-table.tsx` |
| Inline edit pattern | `components/figma/projects-table.tsx` |
