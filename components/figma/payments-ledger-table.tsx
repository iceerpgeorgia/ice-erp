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
  jobIndex?: string;
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
};

const defaultColumns: ColumnConfig[] = [
  { key: 'id', label: 'ID', visible: false, width: 80, sortable: true },
  { key: 'paymentId', label: 'Payment ID', visible: true, width: 150, sortable: true },
  { key: 'projectIndex', label: 'Project', visible: true, width: 150, sortable: true },
  { key: 'counteragentName', label: 'Counteragent', visible: true, width: 200, sortable: true },
  { key: 'financialCodeValidation', label: 'Financial Code', visible: true, width: 200, sortable: true },
  { key: 'jobIndex', label: 'Job', visible: true, width: 120, sortable: true },
  { key: 'currencyCode', label: 'Currency', visible: true, width: 100, sortable: true },
  { key: 'incomeTax', label: 'Income Tax', visible: true, width: 100, sortable: true },
  { key: 'effectiveDate', label: 'Effective Date', visible: true, width: 150, sortable: true },
  { key: 'accrual', label: 'Accrual', visible: true, width: 120, sortable: true },
  { key: 'order', label: 'Order', visible: true, width: 120, sortable: true },
  { key: 'userEmail', label: 'User', visible: true, width: 200, sortable: true },
  { key: 'recordUuid', label: 'Record UUID', visible: false, width: 250, sortable: false },
  { key: 'createdAt', label: 'Created At', visible: true, width: 150, sortable: true },
  { key: 'updatedAt', label: 'Updated At', visible: false, width: 150, sortable: true },
];

export function PaymentsLedgerTable() {
  const [entries, setEntries] = useState<PaymentLedgerEntry[]>([]);
  const [payments, setPayments] = useState<Array<{ paymentId: string; projectIndex?: string; counteragentName?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<ColumnKey>('effectiveDate');
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

  const getUniqueValues = (key: ColumnKey): string[] => {
    const values = entries.map(entry => {
      const value = entry[key];
      if (value === null || value === undefined) return 'N/A';
      if (typeof value === 'boolean') return value ? 'Yes' : 'No';
      return String(value);
    });
    return Array.from(new Set(values)).sort();
  };

  const toggleFilter = (column: ColumnKey, value: string) => {
    setColumnFilters(prev => {
      const currentFilters = prev[column] || [];
      const newFilters = currentFilters.includes(value)
        ? currentFilters.filter(v => v !== value)
        : [...currentFilters, value];
      
      if (newFilters.length === 0) {
        const { [column]: _, ...rest } = prev;
        return rest;
      }
      
      return { ...prev, [column]: newFilters };
    });
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
    
    if (key === 'jobIndex' && entry) {
      return entry.jobIndex || entry.jobName || 'N/A';
    }
    
    if (key === 'incomeTax') {
      return value ? 'Yes' : 'No';
    }
    
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    return String(value);
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
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumns.map(col => (
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
                      
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="ml-auto">
                            <Filter className={`h-3 w-3 ${columnFilters[col.key]?.length ? 'text-primary' : 'opacity-50'}`} />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48">
                          <div className="space-y-2">
                            <h4 className="font-semibold text-sm">Filter</h4>
                            <div className="max-h-64 overflow-y-auto space-y-2">
                              {getUniqueValues(col.key).map(value => (
                                <div key={value} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`${col.key}-${value}`}
                                    checked={columnFilters[col.key]?.includes(value) || false}
                                    onCheckedChange={() => toggleFilter(col.key, value)}
                                  />
                                  <label
                                    htmlFor={`${col.key}-${value}`}
                                    className="text-sm cursor-pointer flex-1 truncate"
                                  >
                                    {value}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
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
                ))}
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
