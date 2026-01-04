import React, { useState, useMemo } from 'react';
import { ReportTable } from './components/ReportTable';
import { ColumnSelector } from './components/ColumnSelector';
import { reportData, columnConfigs, ColumnConfig } from './data/reportData';
import { X } from 'lucide-react';
import { Button } from './components/ui/button';

export default function App() {
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(columnConfigs.map((col) => col.key))
  );
  const [columnOrder, setColumnOrder] = useState<ColumnConfig[]>(columnConfigs);
  const [filters, setFilters] = useState<Map<string, Set<any>>>(new Map());

  const handleToggleColumn = (columnKey: string) => {
    const newVisible = new Set(visibleColumns);
    if (newVisible.has(columnKey)) {
      newVisible.delete(columnKey);
    } else {
      newVisible.add(columnKey);
    }
    setVisibleColumns(newVisible);
  };

  const handleReorderColumns = (newOrder: ColumnConfig[]) => {
    setColumnOrder(newOrder);
  };

  const handleFilterChange = (columnKey: string, values: Set<any>) => {
    const newFilters = new Map(filters);
    if (values.size === 0) {
      newFilters.delete(columnKey);
    } else {
      newFilters.set(columnKey, values);
    }
    setFilters(newFilters);
  };

  // Apply filters to count filtered records
  const filteredRecordCount = useMemo(() => {
    if (filters.size === 0) return reportData.length;

    return reportData.filter((row) => {
      for (const [columnKey, allowedValues] of filters.entries()) {
        const rowValue = row[columnKey as keyof typeof row];
        if (!allowedValues.has(rowValue)) {
          return false;
        }
      }
      return true;
    }).length;
  }, [filters]);

  // Count active filters
  const activeFilterCount = filters.size;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg">Payments report</h1>
          </div>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters(new Map())}
                className="gap-2"
              >
                <X className="w-4 h-4" />
                Clear All Filters
              </Button>
            )}
            <ColumnSelector
              columns={columnOrder}
              visibleColumns={visibleColumns}
              onToggleColumn={handleToggleColumn}
            />
          </div>
        </div>
      </div>

      {/* Report Table */}
      <div className="flex-1 overflow-hidden p-2">
        <ReportTable
          data={reportData}
          columns={columnOrder}
          visibleColumns={visibleColumns}
          filters={filters}
          onReorderColumns={handleReorderColumns}
          onFilterChange={handleFilterChange}
        />
      </div>
    </div>
  );
}