'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Settings,
  Eye,
  EyeOff,
  X
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';

type PaymentReport = {
  paymentId: string;
  counteragent: string;
  counteragentId: string;
  project: string;
  job: string;
  floors: number;
  financialCode: string;
  incomeTax: boolean;
  currency: string;
  accrual: number;
  order: number;
  accrualPerFloor: number;
  balance: number;
};

type ColumnKey = keyof PaymentReport;

type ColumnConfig = {
  key: ColumnKey;
  label: string;
  visible: boolean;
  sortable: boolean;
  filterable: boolean;
  format?: 'currency' | 'number' | 'boolean';
};

const defaultColumns: ColumnConfig[] = [
  { key: 'counteragent', label: 'Counteragent', visible: true, sortable: true, filterable: true },
  { key: 'paymentId', label: 'Payment ID', visible: true, sortable: true, filterable: true },
  { key: 'counteragentId', label: 'ID', visible: true, sortable: true, filterable: true },
  { key: 'currency', label: 'Currency', visible: true, sortable: true, filterable: true },
  { key: 'financialCode', label: 'Financial Code', visible: true, sortable: true, filterable: true },
  { key: 'incomeTax', label: 'Income Tax', visible: true, sortable: true, filterable: true, format: 'boolean' },
  { key: 'project', label: 'Project', visible: true, sortable: true, filterable: true },
  { key: 'job', label: 'Job', visible: true, sortable: true, filterable: true },
  { key: 'floors', label: 'Floors', visible: true, sortable: true, filterable: false, format: 'number' },
  { key: 'accrual', label: 'Accrual', visible: true, sortable: true, filterable: false, format: 'currency' },
  { key: 'order', label: 'Order', visible: true, sortable: true, filterable: false, format: 'currency' },
  { key: 'accrualPerFloor', label: 'Accrual/Floor', visible: true, sortable: true, filterable: false, format: 'currency' },
  { key: 'balance', label: 'Balance', visible: true, sortable: true, filterable: false, format: 'currency' },
];

export function PaymentsReportTable() {
  const [data, setData] = useState<PaymentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<ColumnKey>('paymentId');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);
  const [filters, setFilters] = useState<Map<string, Set<any>>>(new Map());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/payments-report');
      if (!response.ok) throw new Error('Failed to fetch report data');
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleColumn = (columnKey: string) => {
    setColumns(prev => 
      prev.map(col => 
        col.key === columnKey ? { ...col, visible: !col.visible } : col
      )
    );
  };

  const handleSort = (columnKey: ColumnKey) => {
    if (sortColumn === columnKey) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
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

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Apply search
    if (searchTerm) {
      result = result.filter(row =>
        Object.values(row).some(val =>
          String(val).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply filters
    if (filters.size > 0) {
      result = result.filter(row => {
        for (const [columnKey, allowedValues] of filters.entries()) {
          const rowValue = row[columnKey as ColumnKey];
          if (!allowedValues.has(rowValue)) {
            return false;
          }
        }
        return true;
      });
    }

    // Apply sort
    result.sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      
      if (aVal === bVal) return 0;
      
      const comparison = aVal < bVal ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [data, searchTerm, sortColumn, sortDirection, filters]);

  const getUniqueValues = (columnKey: ColumnKey) => {
    const values = new Set(data.map(row => row[columnKey]));
    return Array.from(values).sort();
  };

  const formatValue = (value: any, format?: 'currency' | 'number' | 'boolean') => {
    if (value === null || value === undefined) return '-';
    
    if (format === 'boolean') {
      return value ? '✓' : '✗';
    }
    
    if (format === 'currency' || format === 'number') {
      return Number(value).toLocaleString('en-US', {
        minimumFractionDigits: format === 'currency' ? 2 : 0,
        maximumFractionDigits: 2,
      });
    }
    
    return String(value);
  };

  const visibleColumns = columns.filter(col => col.visible);
  const activeFilterCount = filters.size;

  // Calculate totals
  const totals = useMemo(() => {
    return filteredAndSortedData.reduce((acc, row) => ({
      accrual: acc.accrual + row.accrual,
      order: acc.order + row.order,
      balance: acc.balance + row.balance,
      floors: acc.floors + row.floors,
    }), { accrual: 0, order: 0, balance: 0, floors: 0 });
  }, [filteredAndSortedData]);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Payments Report</h1>
            <Badge variant="secondary">
              {filteredAndSortedData.length} records
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
            
            {activeFilterCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters(new Map())}
                className="gap-2"
              >
                <X className="w-4 h-4" />
                Clear Filters
              </Button>
            )}

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Settings className="w-4 h-4" />
                  Columns
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Toggle Columns</h4>
                  {columns.map(col => (
                    <div key={col.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={col.key}
                        checked={col.visible}
                        onCheckedChange={() => handleToggleColumn(col.key)}
                      />
                      <label htmlFor={col.key} className="text-sm cursor-pointer">
                        {col.label}
                      </label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Totals Bar */}
      <div className="flex-shrink-0 bg-blue-50 border-b border-blue-200 px-4 py-2">
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-gray-600">Total Accrual:</span>
            <span className="ml-2 font-semibold text-blue-900">
              {formatValue(totals.accrual, 'currency')}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Total Order:</span>
            <span className="ml-2 font-semibold text-blue-900">
              {formatValue(totals.order, 'currency')}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Total Balance:</span>
            <span className="ml-2 font-semibold text-blue-900">
              {formatValue(totals.balance, 'currency')}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Total Floors:</span>
            <span className="ml-2 font-semibold text-blue-900">
              {formatValue(totals.floors, 'number')}
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4">
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumns.map(col => (
                  <TableHead key={col.key} className="font-semibold">
                    <div className="flex items-center gap-2">
                      <span>{col.label}</span>
                      {col.sortable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleSort(col.key)}
                        >
                          {sortColumn === col.key ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                      {col.filterable && (
                        <FilterPopover
                          columnKey={col.key}
                          values={getUniqueValues(col.key)}
                          activeFilters={filters.get(col.key) || new Set()}
                          onFilterChange={(values) => handleFilterChange(col.key, values)}
                        />
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredAndSortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length} className="text-center py-8 text-muted-foreground">
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedData.map((row, idx) => (
                  <TableRow key={`${row.paymentId}-${idx}`}>
                    {visibleColumns.map(col => (
                      <TableCell key={col.key}>
                        {formatValue(row[col.key], col.format)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function FilterPopover({
  columnKey,
  values,
  activeFilters,
  onFilterChange,
}: {
  columnKey: string;
  values: any[];
  activeFilters: Set<any>;
  onFilterChange: (values: Set<any>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<any>>(new Set(activeFilters));

  const handleApply = () => {
    onFilterChange(selected);
    setOpen(false);
  };

  const handleToggle = (value: any) => {
    const newSelected = new Set(selected);
    if (newSelected.has(value)) {
      newSelected.delete(value);
    } else {
      newSelected.add(value);
    }
    setSelected(newSelected);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
        >
          <Filter className={`h-3 w-3 ${activeFilters.size > 0 ? 'text-blue-600' : ''}`} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="space-y-2 max-h-80 overflow-auto">
          <h4 className="font-medium text-sm mb-2">Filter by {columnKey}</h4>
          {values.map(value => (
            <div key={String(value)} className="flex items-center space-x-2">
              <Checkbox
                id={`${columnKey}-${value}`}
                checked={selected.has(value)}
                onCheckedChange={() => handleToggle(value)}
              />
              <label 
                htmlFor={`${columnKey}-${value}`}
                className="text-sm cursor-pointer flex-1"
              >
                {String(value) || '(empty)'}
              </label>
            </div>
          ))}
          <div className="flex gap-2 pt-2 border-t">
            <Button size="sm" onClick={handleApply} className="flex-1">
              Apply
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => {
                setSelected(new Set());
                onFilterChange(new Set());
                setOpen(false);
              }}
              className="flex-1"
            >
              Clear
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
