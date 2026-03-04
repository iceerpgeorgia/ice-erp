'use client';

import React, { useMemo, useState } from 'react';
import { Filter, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import type {
  ColumnFilter,
  ColumnFormat,
  NumericOperator,
  TextOperator,
  DateOperator,
} from './table-filters';
import { inferFilterMode, hasActiveFilter } from './table-filters';

// ─── Value helpers ──────────────────────────────────────────────────────────

const isBlankValue = (value: any, renderValue?: (value: any) => string) => {
  if (value === null || value === undefined) return true;
  const text = (renderValue ? renderValue(value) : String(value)).trim().toLowerCase();
  return text === '' || text === 'blank' || text === '(blank)';
};

const defaultSortValues = (values: any[], renderValue?: (value: any) => string) =>
  [...values].sort((a, b) => {
    const aBlank = isBlankValue(a, renderValue);
    const bBlank = isBlankValue(b, renderValue);
    if (aBlank && !bBlank) return -1;
    if (!aBlank && bBlank) return 1;

    const aLabel = renderValue ? renderValue(a) : String(a);
    const bLabel = renderValue ? renderValue(b) : String(b);
    const aIsNum = !Number.isNaN(Number(aLabel));
    const bIsNum = !Number.isNaN(Number(bLabel));

    if (aIsNum && bIsNum) {
      return Number(aLabel) - Number(bLabel);
    }
    if (aIsNum && !bIsNum) return -1;
    if (!aIsNum && bIsNum) return 1;
    return aLabel.localeCompare(bLabel);
  });

// ─── Operator labels ────────────────────────────────────────────────────────

const NUMERIC_OPERATORS: { value: NumericOperator; label: string }[] = [
  { value: 'eq', label: 'Equals (=)' },
  { value: 'neq', label: 'Not equals (≠)' },
  { value: 'gt', label: 'Greater than (>)' },
  { value: 'gte', label: 'Greater or equal (≥)' },
  { value: 'lt', label: 'Less than (<)' },
  { value: 'lte', label: 'Less or equal (≤)' },
  { value: 'between', label: 'Between' },
  { value: 'blank', label: 'Is blank' },
  { value: 'notBlank', label: 'Is not blank' },
];

const TEXT_OPERATORS: { value: TextOperator; label: string }[] = [
  { value: 'contains', label: 'Contains' },
  { value: 'notContains', label: 'Does not contain' },
  { value: 'equals', label: 'Equals' },
  { value: 'notEquals', label: 'Not equals' },
  { value: 'startsWith', label: 'Starts with' },
  { value: 'endsWith', label: 'Ends with' },
  { value: 'blank', label: 'Is blank' },
  { value: 'notBlank', label: 'Is not blank' },
];

const DATE_OPERATORS: { value: DateOperator; label: string }[] = [
  { value: 'eq', label: 'Equals' },
  { value: 'neq', label: 'Not equals' },
  { value: 'gt', label: 'After' },
  { value: 'gte', label: 'On or after' },
  { value: 'lt', label: 'Before' },
  { value: 'lte', label: 'On or before' },
  { value: 'between', label: 'Between' },
  { value: 'blank', label: 'Is blank' },
  { value: 'notBlank', label: 'Is not blank' },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function ColumnFilterPopover({
  columnKey,
  columnLabel,
  values,
  activeFilter,
  activeFilters,
  onFilterChange,
  onAdvancedFilterChange,
  onSort,
  columnFormat,
  maxOptions = 250,
  renderValue,
  sortValues,
}: {
  columnKey: string;
  columnLabel: string;
  values: any[];
  /** New unified filter – takes precedence when provided */
  activeFilter?: ColumnFilter;
  /** Legacy facet filter (backward compat) */
  activeFilters?: Set<any>;
  /** Legacy facet callback */
  onFilterChange?: (values: Set<any>) => void;
  /** New unified callback */
  onAdvancedFilterChange?: (filter: ColumnFilter | null) => void;
  onSort: (direction: 'asc' | 'desc') => void;
  /** Column format hint – controls which filter modes are available */
  columnFormat?: ColumnFormat;
  maxOptions?: number;
  renderValue?: (value: any) => string;
  sortValues?: (values: any[], renderValue?: (value: any) => string) => any[];
}) {
  const [open, setOpen] = useState(false);

  // Determine available modes based on column format
  const inferredMode = inferFilterMode(columnFormat);
  const showAdvanced = Boolean(onAdvancedFilterChange) && inferredMode !== 'facet';

  // ── Facet state ───────────────────────────────────────────────────────────
  const resolvedActiveFilters = activeFilter?.mode === 'facet'
    ? activeFilter.values
    : (activeFilters ?? new Set<any>());

  const [tempSelected, setTempSelected] = useState<Set<any>>(new Set(resolvedActiveFilters));
  const [filterSearchTerm, setFilterSearchTerm] = useState('');

  // ── Mode switching ────────────────────────────────────────────────────────
  type FilterTab = 'facet' | 'condition';
  const [tab, setTab] = useState<FilterTab>(
    activeFilter && activeFilter.mode !== 'facet' ? 'condition' : 'facet'
  );

  // ── Condition state ───────────────────────────────────────────────────────
  const [numOp, setNumOp] = useState<NumericOperator>(
    activeFilter?.mode === 'numeric' ? activeFilter.operator : 'gt'
  );
  const [numVal, setNumVal] = useState<string>(
    activeFilter?.mode === 'numeric' && activeFilter.value != null ? String(activeFilter.value) : ''
  );
  const [numVal2, setNumVal2] = useState<string>(
    activeFilter?.mode === 'numeric' && activeFilter.value2 != null ? String(activeFilter.value2) : ''
  );

  const [textOp, setTextOp] = useState<TextOperator>(
    activeFilter?.mode === 'text' ? activeFilter.operator : 'contains'
  );
  const [textVal, setTextVal] = useState<string>(
    activeFilter?.mode === 'text' ? (activeFilter.value ?? '') : ''
  );

  const [dateOp, setDateOp] = useState<DateOperator>(
    activeFilter?.mode === 'date' ? activeFilter.operator : 'eq'
  );
  const [dateVal, setDateVal] = useState<string>(
    activeFilter?.mode === 'date' ? (activeFilter.value ?? '') : ''
  );
  const [dateVal2, setDateVal2] = useState<string>(
    activeFilter?.mode === 'date' ? (activeFilter.value2 ?? '') : ''
  );

  // ── Facet filtering ───────────────────────────────────────────────────────
  const filteredValues = useMemo(() => {
    if (!filterSearchTerm) return values;
    return values.filter((value) =>
      (renderValue ? renderValue(value) : String(value))
        .toLowerCase()
        .includes(filterSearchTerm.toLowerCase())
    );
  }, [values, filterSearchTerm, renderValue]);

  const sortedFilteredValues = useMemo(() => {
    if (sortValues) {
      return sortValues(filteredValues, renderValue);
    }
    return defaultSortValues(filteredValues, renderValue);
  }, [filteredValues, renderValue, sortValues]);

  const visibleValues = useMemo(
    () => sortedFilteredValues.slice(0, maxOptions),
    [sortedFilteredValues, maxOptions]
  );

  // ── Open / close ──────────────────────────────────────────────────────────
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      const resolved = activeFilter?.mode === 'facet'
        ? activeFilter.values
        : (activeFilters ?? new Set<any>());
      setTempSelected(new Set(resolved));
      setFilterSearchTerm('');
      setTab(activeFilter && activeFilter.mode !== 'facet' ? 'condition' : 'facet');
      // Reset condition state from activeFilter
      if (activeFilter?.mode === 'numeric') {
        setNumOp(activeFilter.operator);
        setNumVal(activeFilter.value != null ? String(activeFilter.value) : '');
        setNumVal2(activeFilter.value2 != null ? String(activeFilter.value2) : '');
      }
      if (activeFilter?.mode === 'text') {
        setTextOp(activeFilter.operator);
        setTextVal(activeFilter.value ?? '');
      }
      if (activeFilter?.mode === 'date') {
        setDateOp(activeFilter.operator);
        setDateVal(activeFilter.value ?? '');
        setDateVal2(activeFilter.value2 ?? '');
      }
    }
  };

  // ── Apply ─────────────────────────────────────────────────────────────────
  const handleApply = () => {
    if (tab === 'facet') {
      if (onAdvancedFilterChange) {
        if (tempSelected.size === 0) {
          onAdvancedFilterChange(null);
        } else {
          onAdvancedFilterChange({ mode: 'facet', values: tempSelected });
        }
      } else if (onFilterChange) {
        onFilterChange(tempSelected);
      }
    } else if (tab === 'condition' && onAdvancedFilterChange) {
      if (inferredMode === 'numeric') {
        if (numOp === 'blank' || numOp === 'notBlank') {
          onAdvancedFilterChange({ mode: 'numeric', operator: numOp });
        } else {
          const v = parseFloat(numVal);
          if (Number.isNaN(v)) {
            onAdvancedFilterChange(null);
          } else {
            const v2 = numOp === 'between' ? parseFloat(numVal2) : undefined;
            onAdvancedFilterChange({
              mode: 'numeric',
              operator: numOp,
              value: v,
              value2: numOp === 'between' && !Number.isNaN(v2!) ? v2 : undefined,
            });
          }
        }
      } else if (inferredMode === 'date') {
        if (dateOp === 'blank' || dateOp === 'notBlank') {
          onAdvancedFilterChange({ mode: 'date', operator: dateOp });
        } else {
          onAdvancedFilterChange({
            mode: 'date',
            operator: dateOp,
            value: dateVal || undefined,
            value2: dateOp === 'between' ? (dateVal2 || undefined) : undefined,
          });
        }
      } else if (inferredMode === 'text') {
        if (textOp === 'blank' || textOp === 'notBlank') {
          onAdvancedFilterChange({ mode: 'text', operator: textOp });
        } else if (!textVal) {
          onAdvancedFilterChange(null);
        } else {
          onAdvancedFilterChange({ mode: 'text', operator: textOp, value: textVal });
        }
      }
    }
    setOpen(false);
  };

  const handleCancel = () => {
    setOpen(false);
  };

  const handleClear = () => {
    if (onAdvancedFilterChange) {
      onAdvancedFilterChange(null);
    } else if (onFilterChange) {
      onFilterChange(new Set());
    }
    setOpen(false);
  };

  const handleSelectAll = () => {
    setTempSelected(new Set(sortedFilteredValues));
  };

  const handleClearAll = () => {
    setTempSelected(new Set());
  };

  const handleToggle = (value: any) => {
    const nextSelected = new Set(tempSelected);
    if (nextSelected.has(value)) {
      nextSelected.delete(value);
    } else {
      nextSelected.add(value);
    }
    setTempSelected(nextSelected);
  };

  // ── Is active? ────────────────────────────────────────────────────────────
  const isActive = activeFilter
    ? hasActiveFilter(activeFilter)
    : (activeFilters ? activeFilters.size > 0 : false);

  const activeCount = activeFilter?.mode === 'facet'
    ? activeFilter.values.size
    : (activeFilters ? activeFilters.size : 0);

  const showCount = (tab === 'facet' || !activeFilter || activeFilter.mode === 'facet') && activeCount > 0;

  // ── Needs value input? ────────────────────────────────────────────────────
  const numNeedsValue = numOp !== 'blank' && numOp !== 'notBlank';
  const textNeedsValue = textOp !== 'blank' && textOp !== 'notBlank';
  const dateNeedsValue = dateOp !== 'blank' && dateOp !== 'notBlank';

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-6 px-1 ${isActive ? 'text-blue-600' : ''}`}
        >
          <Filter className="h-3 w-3" />
          {showCount && (
            <span className="ml-1 text-xs">{activeCount}</span>
          )}
          {isActive && !showCount && (
            <span className="ml-1 text-xs">●</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-2">
            <div className="font-medium text-sm">{columnLabel}</div>
            <div className="text-xs text-muted-foreground">
              {tab === 'facet' ? `${filteredValues.length} values` : 'Condition'}
            </div>
          </div>

          {/* Sort */}
          <div className="space-y-1">
            <button
              className="w-full text-left text-sm py-1 px-2 hover:bg-muted rounded"
              onClick={() => { onSort('asc'); setOpen(false); }}
            >
              Sort A to Z
            </button>
            <button
              className="w-full text-left text-sm py-1 px-2 hover:bg-muted rounded"
              onClick={() => { onSort('desc'); setOpen(false); }}
            >
              Sort Z to A
            </button>
          </div>

          {/* Tab selector (only when advanced modes available) */}
          {showAdvanced && (
            <div className="flex gap-1 border-t pt-2">
              <button
                className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${
                  tab === 'facet'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => setTab('facet')}
              >
                Values
              </button>
              <button
                className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${
                  tab === 'condition'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => setTab('condition')}
              >
                Condition
              </button>
            </div>
          )}

          <div className="border-t pt-3">
            {/* ── FACET TAB ──────────────────────────────────────────── */}
            {tab === 'facet' && (
              <>
                <div className="font-medium text-sm mb-2">Filter by values</div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex gap-2">
                    <button onClick={handleSelectAll} className="text-xs text-blue-600 hover:underline">
                      Select all {sortedFilteredValues.length}
                    </button>
                    <span className="text-xs text-muted-foreground">·</span>
                    <button onClick={handleClearAll} className="text-xs text-blue-600 hover:underline">
                      Clear
                    </button>
                  </div>
                </div>
                <div className="relative mb-3">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="Search values..."
                    value={filterSearchTerm}
                    onChange={(event) => setFilterSearchTerm(event.target.value)}
                    className="pl-7 h-8 text-sm"
                  />
                </div>
                <div className="space-y-1 max-h-48 overflow-auto border rounded p-2">
                  {sortedFilteredValues.length === 0 ? (
                    <div className="text-xs text-muted-foreground py-2 text-center">No values found</div>
                  ) : (
                    <>
                      {sortedFilteredValues.length > maxOptions && (
                        <div className="text-xs text-muted-foreground pb-2">
                          Showing first {maxOptions}. Refine search to see more.
                        </div>
                      )}
                      {visibleValues.map((value) => (
                        <div key={`${columnKey}-${String(value)}`} className="flex items-center space-x-2 py-1">
                          <Checkbox
                            id={`${columnKey}-${value}`}
                            checked={tempSelected.has(value)}
                            onCheckedChange={() => handleToggle(value)}
                          />
                          <label htmlFor={`${columnKey}-${value}`} className="text-sm flex-1 cursor-pointer">
                            {renderValue ? renderValue(value) : String(value)}
                          </label>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </>
            )}

            {/* ── NUMERIC CONDITION TAB ──────────────────────────────── */}
            {tab === 'condition' && inferredMode === 'numeric' && (
              <div className="space-y-3">
                <div className="font-medium text-sm">Number filter</div>
                <select
                  className="w-full border rounded px-2 py-1.5 text-sm bg-white"
                  value={numOp}
                  onChange={(e) => setNumOp(e.target.value as NumericOperator)}
                >
                  {NUMERIC_OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
                {numNeedsValue && (
                  <Input
                    type="number"
                    placeholder="Value"
                    value={numVal}
                    onChange={(e) => setNumVal(e.target.value)}
                    className="h-8 text-sm"
                  />
                )}
                {numOp === 'between' && (
                  <Input
                    type="number"
                    placeholder="End value"
                    value={numVal2}
                    onChange={(e) => setNumVal2(e.target.value)}
                    className="h-8 text-sm"
                  />
                )}
              </div>
            )}

            {/* ── TEXT CONDITION TAB ─────────────────────────────────── */}
            {tab === 'condition' && inferredMode === 'text' && (
              <div className="space-y-3">
                <div className="font-medium text-sm">Text filter</div>
                <select
                  className="w-full border rounded px-2 py-1.5 text-sm bg-white"
                  value={textOp}
                  onChange={(e) => setTextOp(e.target.value as TextOperator)}
                >
                  {TEXT_OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
                {textNeedsValue && (
                  <Input
                    placeholder="Text..."
                    value={textVal}
                    onChange={(e) => setTextVal(e.target.value)}
                    className="h-8 text-sm"
                  />
                )}
              </div>
            )}

            {/* ── DATE CONDITION TAB ─────────────────────────────────── */}
            {tab === 'condition' && inferredMode === 'date' && (
              <div className="space-y-3">
                <div className="font-medium text-sm">Date filter</div>
                <select
                  className="w-full border rounded px-2 py-1.5 text-sm bg-white"
                  value={dateOp}
                  onChange={(e) => setDateOp(e.target.value as DateOperator)}
                >
                  {DATE_OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
                {dateNeedsValue && (
                  <Input
                    type="date"
                    value={dateVal}
                    onChange={(e) => setDateVal(e.target.value)}
                    className="h-8 text-sm"
                  />
                )}
                {dateOp === 'between' && (
                  <Input
                    type="date"
                    value={dateVal2}
                    onChange={(e) => setDateVal2(e.target.value)}
                    className="h-8 text-sm"
                  />
                )}
              </div>
            )}
          </div>

          {/* ── Footer ──────────────────────────────────────────────── */}
          <div className="flex justify-between pt-2 border-t">
            <Button variant="ghost" size="sm" onClick={handleClear} className="text-red-600 hover:text-red-700">
              Reset
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleApply} className="bg-green-600 hover:bg-green-700">
                OK
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
