'use client';

import React, { useMemo, useState } from 'react';
import { Filter, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';

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

export function ColumnFilterPopover({
  columnKey,
  columnLabel,
  values,
  activeFilters,
  onFilterChange,
  onSort,
  maxOptions = 250,
  renderValue,
}: {
  columnKey: string;
  columnLabel: string;
  values: any[];
  activeFilters: Set<any>;
  onFilterChange: (values: Set<any>) => void;
  onSort: (direction: 'asc' | 'desc') => void;
  maxOptions?: number;
  renderValue?: (value: any) => string;
}) {
  const [open, setOpen] = useState(false);
  const [tempSelected, setTempSelected] = useState<Set<any>>(new Set(activeFilters));
  const [filterSearchTerm, setFilterSearchTerm] = useState('');

  const filteredValues = useMemo(() => {
    if (!filterSearchTerm) return values;
    return values.filter((value) =>
      (renderValue ? renderValue(value) : String(value))
        .toLowerCase()
        .includes(filterSearchTerm.toLowerCase())
    );
  }, [values, filterSearchTerm, renderValue]);

  const sortedFilteredValues = useMemo(
    () => defaultSortValues(filteredValues, renderValue),
    [filteredValues, renderValue]
  );

  const visibleValues = useMemo(() => sortedFilteredValues.slice(0, maxOptions), [sortedFilteredValues, maxOptions]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setTempSelected(new Set(activeFilters));
      setFilterSearchTerm('');
    }
  };

  const handleApply = () => {
    onFilterChange(tempSelected);
    setOpen(false);
  };

  const handleCancel = () => {
    setTempSelected(new Set(activeFilters));
    setOpen(false);
  };

  const handleClearAll = () => {
    setTempSelected(new Set());
  };

  const handleSelectAll = () => {
    setTempSelected(new Set(visibleValues));
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

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-6 px-1 ${activeFilters.size > 0 ? 'text-blue-600' : ''}`}
        >
          <Filter className="h-3 w-3" />
          {activeFilters.size > 0 && (
            <span className="ml-1 text-xs">{activeFilters.size}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="font-medium text-sm">{columnLabel}</div>
            <div className="text-xs text-muted-foreground">Displaying {filteredValues.length}</div>
          </div>

          <div className="space-y-1">
            <button
              className="w-full text-left text-sm py-1 px-2 hover:bg-muted rounded"
              onClick={() => {
                onSort('asc');
                setOpen(false);
              }}
            >
              Sort A to Z
            </button>
            <button
              className="w-full text-left text-sm py-1 px-2 hover:bg-muted rounded"
              onClick={() => {
                onSort('desc');
                setOpen(false);
              }}
            >
              Sort Z to A
            </button>
          </div>

          <div className="border-t pt-3">
            <div className="font-medium text-sm mb-2">Filter by values</div>

            <div className="flex items-center justify-between mb-2">
              <div className="flex gap-2">
                <button
                  onClick={handleSelectAll}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Select all {visibleValues.length}
                </button>
                <span className="text-xs text-muted-foreground">·</span>
                <button
                  onClick={handleClearAll}
                  className="text-xs text-blue-600 hover:underline"
                >
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
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleApply} className="bg-green-600 hover:bg-green-700">
              OK
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
