'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  Search, 
  Plus, 
  Trash2,
  Filter, 
  Settings,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { Combobox } from '../ui/combobox';

export type PaymentLedgerEntry = {
  id: number;
  paymentId: string;
  effectiveDate: string;
  accrual: number | null;
  order: number | null;
  comment: string | null;
  recordUuid: string;
  userEmail: string;
  createdAt: string;
  updatedAt: string;
  projectUuid?: string;
  counteragentUuid?: string;
  financialCodeUuid?: string;
  jobUuid?: string;
  incomeTax?: boolean;
  currencyUuid?: string;
  projectIndex?: string;
  projectName?: string;
  counteragentName?: string;
  counteragentId?: string;
  counteragentEntityType?: string;
  financialCodeValidation?: string;
  financialCode?: string;
  jobName?: string;
  currencyCode?: string;
};

type ColumnKey = keyof PaymentLedgerEntry;

type ColumnConfig = {
  key: ColumnKey;
  label: string;
  visible: boolean;
  width: number;
  sortable: boolean;
  filterable: boolean;
  format?: 'currency' | 'number' | 'boolean' | 'date';
};

const defaultColumns: ColumnConfig[] = [
  { key: 'id', label: 'ID', visible: false, width: 80, sortable: true, filterable: true },
  { key: 'paymentId', label: 'Payment ID', visible: true, width: 150, sortable: true, filterable: true },
  { key: 'projectIndex', label: 'Project', visible: true, width: 150, sortable: true, filterable: true },
  { key: 'counteragentName', label: 'Counteragent', visible: true, width: 200, sortable: true, filterable: true },
  { key: 'financialCodeValidation', label: 'Financial Code', visible: true, width: 200, sortable: true, filterable: true },
  { key: 'jobName', label: 'Job', visible: true, width: 120, sortable: true, filterable: true },
  { key: 'currencyCode', label: 'Currency', visible: true, width: 100, sortable: true, filterable: true },
  { key: 'incomeTax', label: 'Income Tax', visible: true, width: 100, sortable: true, filterable: true },
  { key: 'effectiveDate', label: 'Effective Date', visible: true, width: 150, sortable: true, filterable: true, format: 'date' },
  { key: 'accrual', label: 'Accrual', visible: true, width: 120, sortable: true, filterable: true },
  { key: 'order', label: 'Order', visible: true, width: 120, sortable: true, filterable: true },
  { key: 'comment', label: 'Comment', visible: true, width: 250, sortable: true, filterable: false },
  { key: 'userEmail', label: 'User', visible: true, width: 200, sortable: true, filterable: true },
  { key: 'recordUuid', label: 'Record UUID', visible: false, width: 250, sortable: false, filterable: false },
  { key: 'createdAt', label: 'Created At', visible: true, width: 150, sortable: true, filterable: true, format: 'date' },
  { key: 'updatedAt', label: 'Updated At', visible: false, width: 150, sortable: true, filterable: true, format: 'date' },
];

export function PaymentsLedgerTable() {
  const [entries, setEntries] = useState<PaymentLedgerEntry[]>([]);
  const [payments, setPayments] = useState<Array<{ 
    paymentId: string; 
    projectIndex?: string; 
    jobName?: string;
    financialCode?: string;
    currencyCode?: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<ColumnKey>('effectiveDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [columnConfig, setColumnConfig] = useState<ColumnConfig[]>(defaultColumns);
  const [filters, setFilters] = useState<Map<string, Set<any>>>(new Map());
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(50);

  // Column resize and drag states
  const [isResizing, setIsResizing] = useState<{ column: ColumnKey; startX: number; startWidth: number; element: HTMLElement } | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);

  // Form states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [accrual, setAccrual] = useState('');
  const [order, setOrder] = useState('');
  const [comment, setComment] = useState('');

  useEffect(() => {
    fetchEntries();
    fetchPayments();
  }, []);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/payments-ledger');
      if (!response.ok) throw new Error('Failed to fetch ledger entries');
      const data = await response.json();
      setEntries(data);
    } catch (error) {
      console.error('Error fetching ledger entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPayments = async () => {
    try {
      // Fetch only recent payments with limit to reduce memory
      const response = await fetch('/api/payments?limit=5000&sort=desc');
      if (!response.ok) throw new Error('Failed to fetch payments');
      const data = await response.json();
      setPayments(data.map((p: any) => ({
        paymentId: p.paymentId,
        projectIndex: p.projectIndex,
        jobName: p.jobName,
        financialCode: p.financialCode,
        currencyCode: p.currencyCode
      })));
    } catch (error) {
      console.error('Error fetching payments:', error);
    }
  };

  const handleAddEntry = async () => {
    if (!selectedPaymentId) {
      alert('Please select a payment');
      return;
    }

    // Validate that at least one of accrual or order is provided and not zero
    const accrualValue = accrual ? parseFloat(accrual) : null;
    const orderValue = order ? parseFloat(order) : null;

    if ((!accrualValue || accrualValue === 0) && (!orderValue || orderValue === 0)) {
      alert('Either Accrual or Order must be provided and cannot be zero');
      return;
    }

    try {
      const response = await fetch('/api/payments-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: selectedPaymentId,
          effectiveDate: effectiveDate || undefined,
          accrual: accrualValue,
          order: orderValue,
          comment: comment || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create ledger entry');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchEntries();
    } catch (error: any) {
      console.error('Error adding ledger entry:', error);
      alert(error.message || 'Failed to add ledger entry');
    }
  };

  const handleDeleteEntry = async (id: number) => {
    if (!confirm('Are you sure you want to delete this ledger entry?')) return;

    try {
      const response = await fetch(`/api/payments-ledger?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete ledger entry');
      fetchEntries();
    } catch (error) {
      console.error('Error deleting ledger entry:', error);
      alert('Failed to delete ledger entry');
    }
  };

  const resetForm = () => {
    setSelectedPaymentId('');
    setEffectiveDate('');
    setAccrual('');
    setOrder('');
    setComment('');
  };

  // Column resize handlers - optimized to avoid re-renders during drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const deltaX = e.clientX - isResizing.startX;
        const newWidth = Math.max(80, isResizing.startWidth + deltaX); // Minimum 80px
        
        // Update DOM directly without triggering re-render
        isResizing.element.style.width = `${newWidth}px`;
        isResizing.element.style.minWidth = `${newWidth}px`;
        isResizing.element.style.maxWidth = `${newWidth}px`;
      }
    };

    const handleMouseUp = () => {
      if (isResizing) {
        // Only update state once when resize is complete
        const finalWidth = parseInt(isResizing.element.style.width);
        setColumnConfig(prev =>
          prev.map(col =>
            col.key === isResizing.column ? { ...col, width: finalWidth } : col
          )
        );
        
        setIsResizing(null);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Column drag handlers
  const handleDragStart = (e: React.DragEvent<HTMLTableCellElement>, key: ColumnKey) => {
    setDraggedColumn(key);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableCellElement>, key: ColumnKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedColumn && draggedColumn !== key) {
      setDragOverColumn(key);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLTableCellElement>, targetKey: ColumnKey) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetKey) return;

    setColumnConfig(prev => {
      const draggedIndex = prev.findIndex(col => col.key === draggedColumn);
      const targetIndex = prev.findIndex(col => col.key === targetKey);
      const newConfig = [...prev];
      const [draggedItem] = newConfig.splice(draggedIndex, 1);
      newConfig.splice(targetIndex, 0, draggedItem);
      return newConfig;
    });

    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const handleSort = (column: ColumnKey) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const toggleColumnVisibility = (key: ColumnKey) => {
    setColumnConfig(prev => 
      prev.map(col => col.key === key ? { ...col, visible: !col.visible } : col)
    );
  };

  const clearFilters = () => {
    setFilters(new Map());
  };

  const filteredAndSortedEntries = useMemo(() => {
    let result = [...entries];

    // Apply search
    if (searchTerm) {
      result = result.filter(entry =>
        Object.values(entry).some(val =>
          String(val).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply filters
    if (filters.size > 0) {
      result = result.filter(entry => {
        for (const [columnKey, allowedValues] of filters.entries()) {
          const entryValue = entry[columnKey as ColumnKey];
          if (!allowedValues.has(entryValue)) {
            return false;
          }
        }
        return true;
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (aVal === bVal) return 0;

      // Special handling for date columns
      const columnCfg = columnConfig.find(col => col.key === sortColumn);
      if (columnCfg?.format === 'date') {
        const aDate = aVal && typeof aVal !== 'boolean' ? new Date(aVal as string | number).getTime() : 0;
        const bDate = bVal && typeof bVal !== 'boolean' ? new Date(bVal as string | number).getTime() : 0;
        const comparison = aDate < bDate ? -1 : 1;
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      // Handle null/undefined values
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const comparison = aVal < bVal ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [entries, searchTerm, sortColumn, sortDirection, filters]);

  // Pagination
  const totalRecords = filteredAndSortedEntries.length;
  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const paginatedEntries = filteredAndSortedEntries.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters]);

  const visibleColumns = columnConfig.filter(col => col.visible);
  const activeFilterCount = filters.size;

  const formatValue = (key: ColumnKey, value: any, entry?: PaymentLedgerEntry) => {
    if (value === null || value === undefined) return '';
    
    if (key === 'effectiveDate' || key === 'createdAt' || key === 'updatedAt') {
      const date = new Date(value);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}.${month}.${year}`;
    }
    
    if (key === 'accrual' || key === 'order') {
      return typeof value === 'number' ? value.toFixed(2) : '';
    }
    
    if (key === 'counteragentName' && entry) {
      const name = entry.counteragentName || '';
      const id = entry.counteragentId ? ` (ს.კ. ${entry.counteragentId})` : '';
      const entityType = entry.counteragentEntityType ? ` - ${entry.counteragentEntityType}` : '';
      return name + id + entityType || '';
    }
    
    if (key === 'financialCodeValidation' && entry) {
      const validation = entry.financialCodeValidation || '';
      const code = entry.financialCode ? ` (${entry.financialCode})` : '';
      return validation + code || '';
    }
    
    if (key === 'projectIndex' && entry) {
      return entry.projectIndex || entry.projectName || '';
    }
    
    if (key === 'jobName' && entry) {
      return entry.jobName || '';
    }
    
    if (key === 'incomeTax') {
      return value ? 'Yes' : 'No';
    }
    
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    return String(value);
  };

  // Memoize unique values to avoid recalculating on every render
  const uniqueValuesCache = useMemo(() => {
    const cache = new Map<ColumnKey, any[]>();
    const filterableColumns = columnConfig.filter(col => col.filterable);
    
    filterableColumns.forEach(col => {
      const values = new Set(entries.map(entry => entry[col.key]));
      cache.set(col.key, Array.from(values).sort());
    });
    
    return cache;
  }, [entries, columnConfig]);

  const getUniqueValues = useCallback((columnKey: ColumnKey): any[] => {
    return uniqueValuesCache.get(columnKey) || [];
  }, [uniqueValuesCache]);

  const handleFilterChange = (columnKey: string, values: Set<any>) => {
    const newFilters = new Map(filters);
    if (values.size === 0) {
      newFilters.delete(columnKey);
    } else {
      newFilters.set(columnKey, values);
    }
    setFilters(newFilters);
  };

  // Column filter component with sophisticated filter UI - Memoized
  const ColumnFilter = React.memo(function ColumnFilter({ column }: { column: ColumnConfig }) {
    const uniqueValues = useMemo(() => getUniqueValues(column.key), [column.key]);
    const selectedValues = filters.get(column.key) || new Set();
    const [filterSearchTerm, setFilterSearchTerm] = useState('');
    const [tempSelected, setTempSelected] = useState<Set<any>>(new Set(selectedValues));
    const [isOpen, setIsOpen] = useState(false);

    // Filter unique values based on search term
    const filteredValues = useMemo(() => {
      if (!filterSearchTerm) return uniqueValues;
      return uniqueValues.filter(value => 
        String(value).toLowerCase().includes(filterSearchTerm.toLowerCase())
      );
    }, [uniqueValues, filterSearchTerm]);

    // Sort values - numbers first, then text
    const sortedFilteredValues = useMemo(() => {
      return [...filteredValues].sort((a, b) => {
        const aIsNum = !isNaN(Number(a));
        const bIsNum = !isNaN(Number(b));
        
        if (aIsNum && bIsNum) {
          return Number(a) - Number(b);
        } else if (aIsNum && !bIsNum) {
          return -1;
        } else if (!aIsNum && bIsNum) {
          return 1;
        } else {
          return String(a).localeCompare(String(b));
        }
      });
    }, [filteredValues]);

    // Reset temp values when opening
    const handleOpenChange = (open: boolean) => {
      setIsOpen(open);
      if (open) {
        setTempSelected(new Set(selectedValues));
        setFilterSearchTerm('');
      }
    };

    // Apply filters
    const handleApply = () => {
      handleFilterChange(column.key, tempSelected);
      setIsOpen(false);
    };

    // Cancel changes
    const handleCancel = () => {
      setTempSelected(new Set(selectedValues));
      setIsOpen(false);
    };

    // Clear all selections
    const handleClearAll = () => {
      setTempSelected(new Set());
    };

    // Select all visible values
    const handleSelectAll = () => {
      setTempSelected(new Set(filteredValues));
    };

    const handleToggle = (value: any) => {
      const newSelected = new Set(tempSelected);
      if (newSelected.has(value)) {
        newSelected.delete(value);
      } else {
        newSelected.add(value);
      }
      setTempSelected(newSelected);
    };

    return (
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className={`h-6 px-1 ${selectedValues.size > 0 ? 'text-blue-600' : ''}`}
          >
            <Filter className="h-3 w-3" />
            {selectedValues.size > 0 && (
              <span className="ml-1 text-xs">{selectedValues.size}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="start">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-2">
              <div className="font-medium text-sm">{column.label}</div>
              <div className="text-xs text-muted-foreground">
                Displaying {filteredValues.length}
              </div>
            </div>

            {/* Sort Options */}
            <div className="space-y-1">
              <button 
                className="w-full text-left text-sm py-1 px-2 hover:bg-muted rounded"
                onClick={() => {
                  setSortColumn(column.key);
                  setSortDirection('asc');
                  setIsOpen(false);
                }}
              >
                Sort A to Z
              </button>
              <button 
                className="w-full text-left text-sm py-1 px-2 hover:bg-muted rounded"
                onClick={() => {
                  setSortColumn(column.key);
                  setSortDirection('desc');
                  setIsOpen(false);
                }}
              >
                Sort Z to A
              </button>
            </div>

            {/* Filter by values section */}
            <div className="border-t pt-3">
              <div className="font-medium text-sm mb-2">Filter by values</div>
              
              {/* Select All / Clear controls */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex gap-2">
                  <button
                    onClick={handleSelectAll}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Select all {filteredValues.length}
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

              {/* Search input */}
              <div className="relative mb-3">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Search values..."
                  value={filterSearchTerm}
                  onChange={(e) => setFilterSearchTerm(e.target.value)}
                  className="pl-7 h-8 text-sm"
                />
              </div>

              {/* Values list */}
              <div className="space-y-1 max-h-48 overflow-auto border rounded p-2">
                {sortedFilteredValues.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2 text-center">
                    No values found
                  </div>
                ) : (
                  sortedFilteredValues.map(value => (
                    <div key={String(value)} className="flex items-center space-x-2 py-1">
                      <Checkbox
                        id={`${column.key}-${value}`}
                        checked={tempSelected.has(value)}
                        onCheckedChange={() => handleToggle(value)}
                      />
                      <label htmlFor={`${column.key}-${value}`} className="text-sm flex-1 cursor-pointer">
                        {String(value)}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Action buttons */}
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
  });

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Payments Ledger</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Ledger Entry</DialogTitle>
              <DialogDescription>
                Add a new entry to the payments ledger
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Payment</Label>
                <Combobox
                  value={selectedPaymentId}
                  onValueChange={setSelectedPaymentId}
                  options={payments.map(p => {
                    const parts = [
                      p.projectIndex || 'No Project',
                      p.jobName ? p.jobName : 'No Job',
                      p.financialCode || '',
                      p.currencyCode || ''
                    ].filter(Boolean);
                    const label = `${p.paymentId} - ${parts.join(' | ')}`;
                    return {
                      value: p.paymentId,
                      label: label
                    };
                  })}
                  placeholder="Select payment..."
                  searchPlaceholder="Search payments..."
                />
              </div>

              <div className="space-y-2">
                <Label>Effective Date (optional, defaults to now)</Label>
                <Input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Accrual (leave blank if Order is filled)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={accrual}
                  onChange={(e) => setAccrual(e.target.value)}
                  placeholder="Enter accrual amount"
                />
              </div>

              <div className="space-y-2">
                <Label>Order (leave blank if Accrual is filled)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={order}
                  onChange={(e) => setOrder(e.target.value)}
                  placeholder="Enter order amount"
                />
              </div>

              <div className="space-y-2">
                <Label>Comment (optional)</Label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Enter comment..."
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <Button onClick={handleAddEntry} className="w-full">
                Create Entry
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search entries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              Columns
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-2">
              <h4 className="font-semibold">Toggle Columns</h4>
              {columnConfig.map(col => (
                <div key={col.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={col.key}
                    checked={col.visible}
                    onCheckedChange={() => toggleColumnVisibility(col.key)}
                  />
                  <label htmlFor={col.key} className="text-sm cursor-pointer flex-1">
                    {col.label}
                  </label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {activeFilterCount > 0 && (
          <Button variant="outline" onClick={clearFilters}>
            Clear Filters ({activeFilterCount})
          </Button>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-300px)] relative">
          <table style={{ tableLayout: 'fixed', width: '100%' }} className="border-collapse">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b-2 border-gray-200">
                {visibleColumns.map(col => (
                  <th 
                    key={col.key} 
                    className={`font-semibold relative cursor-move overflow-hidden bg-white text-left px-4 py-3 text-sm ${
                      draggedColumn === col.key ? 'opacity-50' : ''
                    } ${
                      dragOverColumn === col.key ? 'border-l-4 border-blue-500' : ''
                    }`}
                    style={{ width: col.width, minWidth: col.width, maxWidth: col.width }}
                    draggable={!isResizing}
                    onDragStart={(e) => handleDragStart(e, col.key)}
                    onDragOver={(e) => handleDragOver(e, col.key)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, col.key)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="flex items-center gap-2 pr-4 overflow-hidden">
                      <span className="truncate font-medium">{col.label}</span>
                      {col.filterable && <ColumnFilter column={col} />}
                    </div>
                    
                    {/* Resize handle */}
                    <div
                      className="absolute top-0 right-0 bottom-0 w-5 cursor-col-resize hover:bg-blue-500/20 active:bg-blue-600/40 z-50"
                      style={{ marginRight: '-10px' }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const thElement = e.currentTarget.parentElement as HTMLElement;
                        setIsResizing({
                          column: col.key,
                          startX: e.clientX,
                          startWidth: col.width,
                          element: thElement
                        });
                      }}
                      title="Drag to resize"
                    >
                      <div className="absolute right-2 top-0 bottom-0 w-1 bg-gray-300 hover:bg-blue-500 transition-colors" />
                    </div>
                  </th>
                ))}
                <th 
                  className="sticky top-0 bg-white px-4 py-3 text-left text-sm font-semibold border-b-2 border-gray-200"
                  style={{ width: 80, minWidth: 80, maxWidth: 80 }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="text-center py-8 px-4">
                    Loading...
                  </td>
                </tr>
              ) : filteredAndSortedEntries.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="text-center py-8 px-4 text-gray-500">
                    No entries found
                  </td>
                </tr>
              ) : (
                paginatedEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-gray-200 hover:bg-gray-50">
                    {visibleColumns.map(col => (
                      <td 
                        key={col.key}
                        className="overflow-hidden px-4 py-2 text-sm"
                        style={{ width: col.width, minWidth: col.width, maxWidth: col.width }}
                      >
                        <div className="truncate">
                          {formatValue(col.key, entry[col.key], entry)}
                        </div>
                      </td>
                    ))}
                    <td className="px-4 py-2 text-sm text-center" style={{ width: 80, minWidth: 80, maxWidth: 80 }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteEntry(entry.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {startIndex + 1} to {Math.min(endIndex, totalRecords)} of {totalRecords} entries
          {entries.length !== totalRecords && ` (filtered from ${entries.length} total)`}
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">Rows per page:</span>
            <select
              value={recordsPerPage}
              onChange={(e) => {
                setRecordsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="px-3 text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              Last
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
