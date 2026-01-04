import React, { useMemo, useState, useCallback } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ReportData, ColumnConfig } from '../data/reportData';
import { Checkbox } from './ui/checkbox';
import { DraggableColumnHeader } from './DraggableColumnHeader';

interface ReportTableProps {
  data: ReportData[];
  columns: ColumnConfig[];
  visibleColumns: Set<string>;
  filters: Map<string, Set<any>>;
  onReorderColumns: (newOrder: ColumnConfig[]) => void;
  onFilterChange: (columnKey: string, values: Set<any>) => void;
}

interface GroupedRow {
  groupKey: string;
  groupValues: { [key: string]: any };
  aggregates: {
    Floors: number;
    Accrual: number;
    Order: number;
    Paid: number;
    Balance: number;
    Due: number;
  };
  count: number;
}

const DEFAULT_COLUMN_WIDTHS: { [key: string]: number } = {
  Counteragent: 200,
  PaymentID: 140,
  Code: 100,
  Currency: 80,
  FinancialCode: 120,
  IncomeTax: 100,
  Project: 150,
  Job: 120,
  Floors: 80,
  Accrual: 120,
  Order: 120,
  Paid: 120,
  AccrualPerFloor: 130,
  PaidPercent: 100,
  Balance: 120,
  Due: 120,
};

export function ReportTable({ data, columns, visibleColumns, filters, onReorderColumns, onFilterChange }: ReportTableProps) {
  const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>(
    DEFAULT_COLUMN_WIDTHS
  );

  // Apply filters to data
  const filteredData = useMemo(() => {
    if (filters.size === 0) return data;

    return data.filter((row) => {
      for (const [columnKey, allowedValues] of filters.entries()) {
        const rowValue = row[columnKey as keyof ReportData];
        if (!allowedValues.has(rowValue)) {
          return false;
        }
      }
      return true;
    });
  }, [data, filters]);

  const visibleColumnConfigs = useMemo(() => {
    return columns.filter((col) => visibleColumns.has(col.key));
  }, [columns, visibleColumns]);

  const groupingColumns = useMemo(() => {
    return visibleColumnConfigs.filter((col) => col.type === 'text' || col.type === 'boolean');
  }, [visibleColumnConfigs]);

  const groupedData = useMemo(() => {
    if (groupingColumns.length === 0) return [];

    const groups = new Map<string, GroupedRow>();

    filteredData.forEach((row) => {
      const groupKey = groupingColumns
        .map((col) => `${col.key}:${row[col.key]}`)
        .join('|');

      if (!groups.has(groupKey)) {
        const groupValues: { [key: string]: any } = {};
        groupingColumns.forEach((col) => {
          groupValues[col.key] = row[col.key];
        });

        groups.set(groupKey, {
          groupKey,
          groupValues,
          aggregates: {
            Floors: 0,
            Accrual: 0,
            Order: 0,
            Paid: 0,
            Balance: 0,
            Due: 0,
          },
          count: 0,
        });
      }

      const group = groups.get(groupKey)!;
      group.count++;
      group.aggregates.Floors += row.Floors;
      group.aggregates.Accrual += row.Accrual;
      group.aggregates.Order += row.Order;
      group.aggregates.Paid += row.Paid;
      group.aggregates.Balance += row.Balance;
      group.aggregates.Due += row.Due;
    });

    return Array.from(groups.values());
  }, [filteredData, groupingColumns]);

  const formatValue = (value: any, column: ColumnConfig): string => {
    if (value === null || value === undefined) return '';

    switch (column.type) {
      case 'boolean':
        return '';
      case 'number':
        if (column.format === '00') {
          return Math.floor(value).toString().padStart(2, '0');
        } else if (column.format === '00.00') {
          return value.toFixed(2);
        }
        return value.toString();
      case 'percent':
        return `${value.toFixed(2)}%`;
      default:
        return value.toString();
    }
  };

  const calculateDerivedValue = (row: GroupedRow, column: ColumnConfig): any => {
    switch (column.key) {
      case 'AccrualPerFloor':
        return row.aggregates.Floors > 0
          ? row.aggregates.Accrual / row.aggregates.Floors
          : 0;
      case 'PaidPercent':
        return row.aggregates.Accrual > 0
          ? (row.aggregates.Paid / row.aggregates.Accrual) * 100
          : 0;
      default:
        return row.aggregates[column.key as keyof typeof row.aggregates] ?? 0;
    }
  };

  const handleColumnResize = useCallback((columnKey: string, width: number) => {
    setColumnWidths((prev) => ({
      ...prev,
      [columnKey]: width,
    }));
  }, []);

  const moveColumn = useCallback(
    (dragIndex: number, hoverIndex: number) => {
      const dragColumn = visibleColumnConfigs[dragIndex];
      const newColumns = [...columns];
      
      // Find actual indices in the full columns array
      const actualDragIndex = newColumns.findIndex(col => col.key === dragColumn.key);
      const actualHoverColumn = visibleColumnConfigs[hoverIndex];
      const actualHoverIndex = newColumns.findIndex(col => col.key === actualHoverColumn.key);
      
      // Remove and reinsert
      const [removed] = newColumns.splice(actualDragIndex, 1);
      newColumns.splice(actualHoverIndex, 0, removed);
      
      onReorderColumns(newColumns);
    },
    [visibleColumnConfigs, columns, onReorderColumns]
  );

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="overflow-auto h-full border border-gray-300 bg-white">
        <table className="border-collapse bg-white" style={{ width: 'max-content' }}>
          <thead className="sticky top-0 z-20 bg-gray-100">
            <tr>
              {visibleColumnConfigs.map((column, index) => (
                <DraggableColumnHeader
                  key={column.key}
                  columnKey={column.key}
                  label={column.label}
                  width={columnWidths[column.key] || DEFAULT_COLUMN_WIDTHS[column.key] || 120}
                  index={index}
                  column={column}
                  data={data}
                  activeFilters={filters.get(column.key) || new Set()}
                  onResize={handleColumnResize}
                  onMove={moveColumn}
                  onFilterChange={onFilterChange}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {groupedData.map((row, idx) => (
              <tr
                key={row.groupKey}
                className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}
              >
                {visibleColumnConfigs.map((column) => {
                  let cellValue: any;
                  let displayValue: string;

                  if (column.key in row.groupValues) {
                    cellValue = row.groupValues[column.key];
                    displayValue = formatValue(cellValue, column);
                  } else {
                    cellValue = calculateDerivedValue(row, column);
                    displayValue = formatValue(cellValue, column);
                  }

                  return (
                    <td
                      key={column.key}
                      className={`border border-gray-300 px-3 py-2 ${
                        column.type === 'number' || column.type === 'percent'
                          ? 'text-right'
                          : 'text-left'
                      }`}
                      style={{
                        width: `${columnWidths[column.key] || DEFAULT_COLUMN_WIDTHS[column.key] || 120}px`,
                        minWidth: `${columnWidths[column.key] || DEFAULT_COLUMN_WIDTHS[column.key] || 120}px`,
                        maxWidth: `${columnWidths[column.key] || DEFAULT_COLUMN_WIDTHS[column.key] || 120}px`,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {column.type === 'boolean' ? (
                        <Checkbox checked={cellValue} disabled className="cursor-default" />
                      ) : (
                        <span title={displayValue}>{displayValue}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DndProvider>
  );
}