'use client';
/* eslint-disable react-hooks/exhaustive-deps */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Plus, 
  Trash2,
  Settings,
  Download,
} from 'lucide-react';
import { RequiredInsiderBadge } from './shared/required-insider-badge';
import { useRequiredInsiderName } from './shared/use-required-insider';
import { ClearFiltersButton } from './shared/clear-filters-button';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { Combobox } from '../ui/combobox';
import { exportRowsToXlsx } from '@/lib/export-xlsx';
import { ColumnFilterPopover } from './shared/column-filter-popover';
import type { ColumnFormat } from './shared/table-filters';
import { useTableFilters } from './shared/use-table-filters';

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
  insiderName?: string | null;
};

type ColumnKey = keyof PaymentLedgerEntry;

type ColumnConfig = {
  key: ColumnKey;
  label: string;
  visible: boolean;
  width: number;
  sortable: boolean;
  filterable: boolean;
  format?: ColumnFormat;
};

const defaultColumns: ColumnConfig[] = [
  { key: 'id', label: 'ID', visible: false, width: 80, sortable: true, filterable: true },
  { key: 'paymentId', label: 'Payment ID', visible: true, width: 150, sortable: true, filterable: true },
  { key: 'projectIndex', label: 'Project', visible: true, width: 150, sortable: true, filterable: true },
  { key: 'counteragentName', label: 'Counteragent', visible: true, width: 200, sortable: true, filterable: true },
  { key: 'insiderName', label: 'Insider', visible: true, width: 180, sortable: false, filterable: false },
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
  const requiredInsiderName = useRequiredInsiderName();
  const [entries, setEntries] = useState<PaymentLedgerEntry[]>([]);
  const [payments, setPayments] = useState<Array<{ 
    paymentId: string; 
    projectIndex?: string; 
    jobName?: string;
    financialCode?: string;
    currencyCode?: string;
    counteragentName?: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [columnConfig, setColumnConfig] = useState<ColumnConfig[]>(defaultColumns);

  const {
    filters, searchTerm, sortColumn, sortDirection, currentPage, pageSize,
    sortedData: sortedEntries, paginatedData: paginatedEntries, totalPages,
    getColumnValues, setSearchTerm, handleSort, setSortColumn, setSortDirection,
    setCurrentPage, setPageSize, handleFilterChange, clearFilters, activeFilterCount,
  } = useTableFilters<PaymentLedgerEntry, ColumnKey>({
    data: entries,
    columns: columnConfig,
    defaultSortColumn: 'effectiveDate',
    defaultSortDirection: 'desc',
    pageSize: 50,
  });

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
        currencyCode: p.currencyCode,
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

  const toggleColumnVisibility = (key: ColumnKey) => {
    setColumnConfig(prev => 
      prev.map(col => col.key === key ? { ...col, visible: !col.visible } : col)
    );
  };

  const visibleColumns = columnConfig.filter(col => col.visible);

  const handleExportXlsx = () => {
    if (sortedEntries.length === 0) return;
    setIsExporting(true);
    try {
      const fileName = `payments-ledger_${new Date().toISOString().slice(0, 10)}.xlsx`;
      exportRowsToXlsx({
        rows: sortedEntries,
        columns: columnConfig,
        fileName,
        sheetName: 'Payments Ledger',
      });
    } finally {
      setIsExporting(false);
    }
  };
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
      if (typeof value === 'number') {
        return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      return '';
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



  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">Payments Ledger</h1>
          <RequiredInsiderBadge />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportXlsx}
            disabled={isExporting || sortedEntries.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export XLSX'}
          </Button>
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
                      p.paymentId,
                      p.counteragentName || 'Unknown',
                      p.currencyCode || '',
                      p.projectIndex || '',
                      p.jobName || '',
                      p.financialCode || ''
                    ].filter(Boolean);
                    const label = parts.join(' | ');
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

          <ClearFiltersButton
            activeCount={activeFilterCount + (searchTerm.trim() ? 1 : 0)}
            onClear={() => {
              clearFilters();
              setSearchTerm('');
            }}
          />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-300px)] relative">
          <table style={{ tableLayout: 'fixed', width: '100%' }} className="border-collapse">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b-2 border-gray-200">
                {visibleColumns.map(col => {
                  // Column background colors
                  let bgColor = '';
                  if (col.key === 'accrual') bgColor = '#ffebee'; // Light red
                  if (col.key === 'order') bgColor = '#fff9e6'; // Light yellow
                  
                  return (
                    <th 
                      key={col.key} 
                      className={`font-semibold relative cursor-move overflow-hidden text-left px-4 py-3 text-sm ${
                        draggedColumn === col.key ? 'opacity-50' : ''
                      } ${
                        dragOverColumn === col.key ? 'border-l-4 border-blue-500' : ''
                      }`}
                      style={{ 
                        width: col.width, 
                        minWidth: col.width, 
                        maxWidth: col.width,
                        backgroundColor: bgColor || '#fff'
                      }}
                      draggable={!isResizing}
                      onDragStart={(e) => handleDragStart(e, col.key)}
                      onDragOver={(e) => handleDragOver(e, col.key)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, col.key)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="flex items-center gap-2 pr-4 overflow-hidden">
                        <span className="truncate font-medium">{col.label}</span>
                        {col.filterable && (
                          <ColumnFilterPopover
                            columnKey={col.key}
                            columnLabel={col.label}
                            values={getColumnValues(col.key)}
                            activeFilters={filters.get(col.key)?.mode === 'facet' ? (filters.get(col.key) as any).values : new Set()}
                            activeFilter={filters.get(col.key)}
                            columnFormat={col.format as ColumnFormat | undefined}
                            onAdvancedFilterChange={(filter) => handleFilterChange(col.key, filter)}
                            onFilterChange={(values) => handleFilterChange(col.key, values.size > 0 ? { mode: 'facet', values } : null)}
                            onSort={(direction) => {
                              setSortColumn(col.key);
                              setSortDirection(direction);
                            }}
                          />
                        )}
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
                  );
                })}
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
              ) : sortedEntries.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="text-center py-8 px-4 text-gray-500">
                    No entries found
                  </td>
                </tr>
              ) : (
                paginatedEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-gray-200 hover:bg-gray-50">
                    {visibleColumns.map(col => {
                      // Column background colors
                      let bgColor = '';
                      if (col.key === 'accrual') bgColor = '#ffebee'; // Light red
                      if (col.key === 'order') bgColor = '#fff9e6'; // Light yellow
                      
                      return (
                        <td 
                          key={col.key}
                          className="overflow-hidden px-4 py-2 text-sm"
                          style={{ 
                            width: col.width, 
                            minWidth: col.width, 
                            maxWidth: col.width,
                            backgroundColor: bgColor 
                          }}
                        >
                          <div className="truncate">
                            {col.key === 'insiderName'
                              ? (requiredInsiderName || '-')
                              : formatValue(col.key, entry[col.key], entry)}
                          </div>
                        </td>
                      );
                    })}
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
          Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, sortedEntries.length)} of {sortedEntries.length} entries
          {entries.length !== sortedEntries.length && ` (filtered from ${entries.length} total)`}
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
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
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
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
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
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
