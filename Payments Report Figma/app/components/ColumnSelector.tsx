import React from 'react';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { Settings2 } from 'lucide-react';
import { ColumnConfig } from '../data/reportData';

interface ColumnSelectorProps {
  columns: ColumnConfig[];
  visibleColumns: Set<string>;
  onToggleColumn: (columnKey: string) => void;
}

export function ColumnSelector({ columns, visibleColumns, onToggleColumn }: ColumnSelectorProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Settings2 className="w-4 h-4" />
          Columns ({visibleColumns.size}/{columns.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="mb-3">Select Columns</h4>
            <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2">
              {columns.map((column) => (
                <div key={column.key} className="flex items-center space-x-3">
                  <Checkbox
                    id={column.key}
                    checked={visibleColumns.has(column.key)}
                    onCheckedChange={() => onToggleColumn(column.key)}
                    disabled={!column.canHide}
                  />
                  <label
                    htmlFor={column.key}
                    className={`text-sm flex-1 cursor-pointer select-none ${
                      !column.canHide ? 'text-gray-500 italic' : ''
                    }`}
                  >
                    {column.label}
                    {!column.canHide && ' (required)'}
                  </label>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-2 border-t flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                columns.forEach((col) => {
                  if (col.canHide && !visibleColumns.has(col.key)) {
                    onToggleColumn(col.key);
                  }
                });
              }}
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                columns.forEach((col) => {
                  if (col.canHide && visibleColumns.has(col.key)) {
                    onToggleColumn(col.key);
                  }
                });
              }}
            >
              Clear All
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}