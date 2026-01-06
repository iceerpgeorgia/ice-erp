'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  Plus, 
  Trash2,
  Filter, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { Combobox } from '../ui/combobox';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';

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
  { key: 'effectiveDate', label: 'Effective Date', visible: true, width: 150, sortable: true, filterable: true },
  { key: 'accrual', label: 'Accrual', visible: true, width: 120, sortable: true, filterable: true },
  { key: 'order', label: 'Order', visible: true, width: 120, sortable: true, filterable: true },
  { key: 'comment', label: 'Comment', visible: true, width: 250, sortable: true, filterable: false },
  { key: 'userEmail', label: 'User', visible: true, width: 200, sortable: true, filterable: true },
  { key: 'recordUuid', label: 'Record UUID', visible: false, width: 250, sortable: false, filterable: false },
  { key: 'createdAt', label: 'Created At', visible: true, width: 150, sortable: true, filterable: true },
  { key: 'updatedAt', label: 'Updated At', visible: false, width: 150, sortable: true, filterable: true },
];

export function PaymentsLedgerTable() {
  const [entries, setEntries] = useState<PaymentLedgerEntry[]>([]);
  const [payments, setPayments] = useState<Array<{ paymentId: string; projectIndex?: string; counteragentName?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<ColumnKey>('effectiveDate');
  
  // Debug log
  console.log('[PaymentsLedgerTable] Rendering with', entries.length, 'entries');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [columnConfig, setColumnConfig] = useState<ColumnConfig[]>(defaultColumns);
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});

  // Column resize and drag states
  const [isResizing, setIsResizing] = useState<{ column: ColumnKey; startX: number; startWidth: number } | null>(null);
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
      const response = await fetch('/api/payments');
      if (!response.ok) throw new Error('Failed to fetch payments');
      const data = await response.json();
      setPayments(data.map((p: any) => ({
        paymentId: p.paymentId,
        projectIndex: p.projectIndex,
        counteragentName: p.counteragentName
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

  // Column resize handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const deltaX = e.clientX - isResizing.startX;
        const newWidth = Math.max(100, isResizing.startWidth + deltaX);
        setColumnConfig(prev =>
          prev.map(col =>
            col.key === isResizing.column ? { ...col, width: newWidth } : col
          )
        );
      }
    };

    const handleMouseUp = () => {
      if (isResizing) {
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
    setColumnFilters({});
  };

  const filteredAndSortedEntries = useMemo(() => {
    let filtered = [...entries];

    // Apply search
    if (searchTerm) {
      filtered = filtered.filter(entry =>
        Object.entries(entry).some(([_, value]) =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply column filters
    Object.entries(columnFilters).forEach(([column, values]) => {
      if (values.length > 0) {
        filtered = filtered.filter(entry => {
          const value = entry[column as ColumnKey];
          const stringValue = value === null || value === undefined ? 'N/A' : 
                             typeof value === 'boolean' ? (value ? 'Yes' : 'No') : 
                             String(value);
          return values.includes(stringValue);
        });
      }
    });

    // Apply sorting
    filtered.sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    return filtered;
  }, [entries, searchTerm, sortColumn, sortDirection, columnFilters]);

  const visibleColumns = columnConfig.filter(col => col.visible);
  const activeFilterCount = Object.keys(columnFilters).length;

  const formatValue = (key: ColumnKey, value: any, entry?: PaymentLedgerEntry) => {
    if (value === null || value === undefined) return 'N/A';
    
    if (key === 'effectiveDate' || key === 'createdAt' || key === 'updatedAt') {
      return new Date(value).toLocaleString();
    }
    
    if (key === 'accrual' || key === 'order') {
      return typeof value === 'number' ? value.toFixed(2) : 'N/A';
    }
    
    if (key === 'counteragentName' && entry) {
      const name = entry.counteragentName || '';
      const id = entry.counteragentId ? ` (ს.კ. ${entry.counteragentId})` : '';
      const entityType = entry.counteragentEntityType ? ` - ${entry.counteragentEntityType}` : '';
      return name + id + entityType || 'N/A';
    }
    
    if (key === 'financialCodeValidation' && entry) {
      const validation = entry.financialCodeValidation || '';
      const code = entry.financialCode ? ` (${entry.financialCode})` : '';
      return validation + code || 'N/A';
    }
    
    if (key === 'projectIndex' && entry) {
      return entry.projectIndex || entry.projectName || 'N/A';
    }
    
    if (key === 'jobName' && entry) {
      return entry.jobName || 'N/A';
    }
    
    if (key === 'incomeTax') {
      return value ? 'Yes' : 'No';
    }
    
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    return String(value);
  };

  // Get unique values for a column for filtering
  const getUniqueValues = (column: ColumnKey) => {
    return [...new Set(entries.map(entry => String(entry[column])))].sort();
  };

  // Column filter component with sophisticated filter UI
  const ColumnFilter = ({ column }: { column: ColumnConfig }) => {
    const uniqueValues = getUniqueValues(column.key);
    const selectedValues = columnFilters[column.key] || [];
    const [filterSearchTerm, setFilterSearchTerm] = useState('');
    const [tempSelectedValues, setTempSelectedValues] = useState<string[]>(selectedValues);
    const [isOpen, setIsOpen] = useState(false);
    
    console.log('[ColumnFilter] Rendering filter for', column.key, 'with', uniqueValues.length, 'unique values');

    // Filter unique values based on search term
    const filteredUniqueValues = useMemo(() => {
      if (!filterSearchTerm) return uniqueValues;
      return uniqueValues.filter(value => 
        value.toLowerCase().includes(filterSearchTerm.toLowerCase())
      );
    }, [uniqueValues, filterSearchTerm]);

    // Reset temp values when opening
    const handleOpenChange = (open: boolean) => {
      setIsOpen(open);
      if (open) {
        setTempSelectedValues(selectedValues);
        setFilterSearchTerm('');
      }
    };

    // Apply filters
    const handleApply = () => {
      setColumnFilters({
        ...columnFilters,
        [column.key]: tempSelectedValues
      });
      setIsOpen(false);
    };

    // Cancel changes
    const handleCancel = () => {
      setTempSelectedValues(selectedValues);
      setIsOpen(false);
    };

    // Clear all selections
    const handleClearAll = () => {
      setTempSelectedValues([]);
    };

    // Select all visible values
    const handleSelectAll = () => {
      setTempSelectedValues(filteredUniqueValues);
    };

    // Sort values - numbers first, then text
    const sortedFilteredValues = useMemo(() => {
      return [...filteredUniqueValues].sort((a, b) => {
        const aIsNum = !isNaN(Number(a));
        const bIsNum = !isNaN(Number(b));
        
        if (aIsNum && bIsNum) {
          return Number(a) - Number(b);
        } else if (aIsNum && !bIsNum) {
          return -1;
        } else if (!aIsNum && bIsNum) {
          return 1;
        } else {
          return a.localeCompare(b);
        }
      });
    }, [filteredUniqueValues]);

    return (
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className={`h-6 px-1 ${selectedValues.length > 0 ? 'text-blue-600' : ''}`}
          >
            <Filter className="h-3 w-3" />
            {selectedValues.length > 0 && (
              <span className="ml-1 text-xs">{selectedValues.length}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="start">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-2">
              <div className="font-medium text-sm">{column.label}</div>
              <div className="text-xs text-muted-foreground">
                Displaying {filteredUniqueValues.length}
              </div>
            </div>

            {/* Sort Options */}
            <div className="space-y-1">
              <button 
                className="w-full text-left text-sm py-1 px-2 hover:bg-muted rounded"
                onClick={() => {
                  const sorted = [...uniqueValues].sort();
                  setTempSelectedValues(tempSelectedValues.filter(v => sorted.includes(v)));
                }}
              >
                Sort A to Z
              </button>
              <button 
                className="w-full text-left text-sm py-1 px-2 hover:bg-muted rounded"
                onClick={() => {
                  const sorted = [...uniqueValues].sort().reverse();
                  setTempSelectedValues(tempSelectedValues.filter(v => sorted.includes(v)));
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
                    Select all {filteredUniqueValues.length}
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
                    <div key={value} className="flex items-center space-x-2 py-1">
                      <Checkbox
                        id={`${column.key}-${value}`}
                        checked={tempSelectedValues.includes(value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setTempSelectedValues([...tempSelectedValues, value]);
                          } else {
                            setTempSelectedValues(tempSelectedValues.filter(v => v !== value));
                          }
                        }}
                      />
                      <Label htmlFor={`${column.key}-${value}`} className="text-sm flex-1 cursor-pointer">
                        {value}
                      </Label>
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
  };

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
                  options={payments.map(p => ({
                    value: p.paymentId,
                    label: p.paymentId
                  }))}
                  placeholder="Select payment..."
                  searchPlaceholder="Search payments..."
                />
              </div>

              <div className="space-y-2">
                <Label>Effective Date (optional, defaults to now)</Label>
                <Input
                  type="datetime-local"
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
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
              <TableRow>
                {visibleColumns.map(col => {
                  console.log('[TableHead] Rendering column:', col.key, 'filterable:', col.filterable);
                  return (
                  <TableHead 
                    key={col.key} 
                    style={{ width: col.width }}
                    draggable={!isResizing}
                    onDragStart={(e) => handleDragStart(e, col.key)}
                    onDragOver={(e) => handleDragOver(e, col.key)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, col.key)}
                    onDragEnd={handleDragEnd}
                    className={`relative ${
                      draggedColumn === col.key ? 'opacity-50' : ''
                    } ${
                      dragOverColumn === col.key ? 'border-l-4 border-primary' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {col.sortable ? (
                        <button
                          onClick={() => handleSort(col.key)}
                          className="flex items-center gap-1 hover:text-foreground"
                        >
                          {col.label}
                          {sortColumn === col.key ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-50" />
                          )}
                        </button>
                      ) : (
                        <span>{col.label}</span>
                      )}
                      
                      {col.filterable && <ColumnFilter column={col} />}
                    </div>
                    
                    {/* Resize handle */}
                    <div
                      className="absolute top-0 right-0 w-4 h-full cursor-col-resize hover:bg-primary/20 active:bg-primary/40 flex items-center justify-center"
                      style={{ right: '-8px' }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsResizing({
                          column: col.key,
                          startX: e.clientX,
                          startWidth: col.width,
                        });
                      }}
                    >
                      <div className="w-px h-4 bg-border" />
                    </div>
                  </TableHead>
                  );
                })}
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 1} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredAndSortedEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 1} className="text-center py-8">
                    No entries found
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    {visibleColumns.map(col => (
                      <TableCell key={col.key}>
                        {formatValue(col.key, entry[col.key], entry)}
                      </TableCell>
                    ))}
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteEntry(entry.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filteredAndSortedEntries.length} of {entries.length} entries
      </div>
    </div>
  );
}
