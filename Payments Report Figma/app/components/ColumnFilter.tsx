import React, { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { ListFilter, X } from 'lucide-react';
import { ReportData, ColumnConfig } from '../data/reportData';
import { Input } from './ui/input';

interface ColumnFilterProps {
  column: ColumnConfig;
  data: ReportData[];
  activeFilters: Set<any>;
  onFilterChange: (columnKey: string, values: Set<any>) => void;
}

export function ColumnFilter({ column, data, activeFilters, onFilterChange }: ColumnFilterProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Get unique values for this column
  const uniqueValues = useMemo(() => {
    const values = new Set<any>();
    data.forEach((row) => {
      const value = row[column.key];
      values.add(value);
    });
    
    const sorted = Array.from(values).sort((a, b) => {
      if (column.type === 'boolean') return a === b ? 0 : a ? -1 : 1;
      if (column.type === 'number' || column.type === 'percent') return (a as number) - (b as number);
      return String(a).localeCompare(String(b));
    });
    
    return sorted;
  }, [data, column]);

  // Filter values based on search
  const filteredValues = useMemo(() => {
    if (!searchTerm) return uniqueValues;
    return uniqueValues.filter((value) => {
      const strValue = column.type === 'boolean' 
        ? (value ? 'Yes' : 'No')
        : String(value);
      return strValue.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [uniqueValues, searchTerm, column.type]);

  const handleToggleValue = (value: any) => {
    const newFilters = new Set(activeFilters);
    if (newFilters.has(value)) {
      newFilters.delete(value);
    } else {
      newFilters.add(value);
    }
    onFilterChange(column.key, newFilters);
  };

  const handleSelectAll = () => {
    onFilterChange(column.key, new Set(uniqueValues));
  };

  const handleClearAll = () => {
    onFilterChange(column.key, new Set());
  };

  const isFiltered = activeFilters.size > 0 && activeFilters.size < uniqueValues.length;
  const allSelected = activeFilters.size === uniqueValues.length;

  const formatValue = (value: any): string => {
    if (column.type === 'boolean') return value ? 'Yes' : 'No';
    if (column.type === 'number' && column.format === '00.00') return value.toFixed(2);
    if (column.type === 'percent') return `${value.toFixed(2)}%`;
    return String(value);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={`p-0.5 rounded hover:bg-gray-200 transition-colors ${
            isFiltered ? 'text-blue-600' : 'text-gray-500'
          }`}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          {isFiltered ? (
            <ListFilter className="w-3.5 h-3.5 fill-current" />
          ) : (
            <ListFilter className="w-3.5 h-3.5" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-72 p-0" 
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col max-h-[400px]">
          {/* Header */}
          <div className="p-3 border-b">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm">Filter: {column.label}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 p-2 border-b">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={handleSelectAll}
              disabled={allSelected}
            >
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={handleClearAll}
              disabled={activeFilters.size === 0}
            >
              Clear
            </Button>
          </div>

          {/* Values List */}
          <div className="overflow-y-auto p-2 space-y-1">
            {filteredValues.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-4">
                No values found
              </div>
            ) : (
              filteredValues.map((value, idx) => (
                <div
                  key={`${value}-${idx}`}
                  className="flex items-center space-x-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer"
                  onClick={() => handleToggleValue(value)}
                >
                  <Checkbox
                    id={`filter-${column.key}-${idx}`}
                    checked={activeFilters.has(value)}
                    onCheckedChange={() => handleToggleValue(value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <label
                    htmlFor={`filter-${column.key}-${idx}`}
                    className="text-sm flex-1 cursor-pointer select-none"
                  >
                    {formatValue(value)}
                  </label>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {isFiltered && (
            <div className="p-2 border-t bg-gray-50">
              <div className="text-xs text-gray-600">
                {activeFilters.size} of {uniqueValues.length} selected
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
