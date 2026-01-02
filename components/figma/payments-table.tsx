'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  Plus, 
  Edit2, 
  Check, 
  X, 
  Filter, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Settings,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';

export type Payment = {
  id: number;
  projectUuid: string;
  counteragentUuid: string;
  financialCodeUuid: string;
  jobUuid: string;
  incomeTax: boolean;
  currencyUuid: string;
  paymentId: string;
  recordUuid: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  projectIndex: string | null;
  counteragentName: string | null;
  financialCodeValidation: string | null;
  jobName: string | null;
  jobIdentifier: string | null;
  currencyCode: string | null;
};

type ColumnKey = keyof Payment;

type ColumnConfig = {
  key: ColumnKey;
  label: string;
  width: number;
  visible: boolean;
  sortable: boolean;
  filterable: boolean;
  responsive?: 'sm' | 'md' | 'lg' | 'xl';
};

const defaultColumns: ColumnConfig[] = [
  { key: 'id', label: 'ID', width: 80, visible: false, sortable: true, filterable: true },
  { key: 'paymentId', label: 'Payment ID', width: 300, visible: true, sortable: true, filterable: true },
  { key: 'recordUuid', label: 'Record UUID', width: 150, visible: true, sortable: true, filterable: true },
  { key: 'projectIndex', label: 'Project', width: 400, visible: true, sortable: true, filterable: true },
  { key: 'counteragentName', label: 'Counteragent', width: 250, visible: true, sortable: true, filterable: true },
  { key: 'financialCodeValidation', label: 'Financial Code', width: 200, visible: true, sortable: true, filterable: true },
  { key: 'jobName', label: 'Job', width: 200, visible: true, sortable: true, filterable: true },
  { key: 'incomeTax', label: 'Income Tax', width: 100, visible: true, sortable: true, filterable: true },
  { key: 'currencyCode', label: 'Currency', width: 100, visible: true, sortable: true, filterable: true },
  { key: 'projectUuid', label: 'Project UUID', width: 200, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'counteragentUuid', label: 'Counteragent UUID', width: 200, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'financialCodeUuid', label: 'Financial Code UUID', width: 200, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'jobUuid', label: 'Job UUID', width: 200, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'currencyUuid', label: 'Currency UUID', width: 200, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'jobIdentifier', label: 'Job Identifier', width: 200, visible: false, sortable: true, filterable: true },
  { key: 'isActive', label: 'Status', width: 100, visible: true, sortable: true, filterable: true },
  { key: 'createdAt', label: 'Created', width: 140, visible: false, sortable: true, filterable: true },
  { key: 'updatedAt', label: 'Updated', width: 140, visible: false, sortable: true, filterable: true },
];

export function PaymentsTable() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [projects, setProjects] = useState<Array<{ projectUuid: string; projectIndex: string; projectName: string }>>([]);
  const [counteragents, setCounteragents] = useState<Array<{ counteragentUuid: string; name: string; identificationNumber: string; entityType: string }>>([]);
  const [financialCodes, setFinancialCodes] = useState<Array<{ uuid: string; validation: string; code: string }>>([]);
  const [jobs, setJobs] = useState<Array<{ jobUuid: string; jobIndex: string; jobName: string }>>([]);
  const [currencies, setCurrencies] = useState<Array<{ uuid: string; code: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<ColumnKey>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [columnConfig, setColumnConfig] = useState<ColumnConfig[]>(defaultColumns);
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const pageSizeOptions = [50, 100, 200, 500, 1000];
  
  // Column dragging and resizing states
  const [isResizing, setIsResizing] = useState<{ column: ColumnKey; startX: number; startWidth: number } | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);

  // Form states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProjectUuid, setSelectedProjectUuid] = useState('');
  const [selectedCounteragentUuid, setSelectedCounteragentUuid] = useState('');
  const [selectedFinancialCodeUuid, setSelectedFinancialCodeUuid] = useState('');
  const [selectedJobUuid, setSelectedJobUuid] = useState('');
  const [selectedIncomeTax, setSelectedIncomeTax] = useState(false);
  const [selectedCurrencyUuid, setSelectedCurrencyUuid] = useState('');

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editIncomeTax, setEditIncomeTax] = useState(false);

  // Payment options state (for matching existing payments)
  const [paymentOptions, setPaymentOptions] = useState<Array<{ paymentId: string; projectUuid: string; jobUuid: string; financialCodeUuid: string; currencyUuid: string; projectName: string; jobName: string; jobDisplay: string; currencyCode: string; financialCodeValidation: string }>>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState('');
  const [editSelectedPaymentId, setEditSelectedPaymentId] = useState('');
  const [paymentDisplayValues, setPaymentDisplayValues] = useState<{
    projectLabel: string;
    jobLabel: string;
    financialCodeLabel: string;
    currencyLabel: string;
  }>({ projectLabel: '', jobLabel: '', financialCodeLabel: '', currencyLabel: '' });
  const [editPaymentDisplayValues, setEditPaymentDisplayValues] = useState<{
    projectLabel: string;
    jobLabel: string;
    financialCodeLabel: string;
    currencyLabel: string;
  }>({ projectLabel: '', jobLabel: '', financialCodeLabel: '', currencyLabel: '' });

  // Duplicate checking state
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicatePaymentIds, setDuplicatePaymentIds] = useState<string[]>([]);

  useEffect(() => {
    fetchPayments();
    fetchProjects();
    fetchCounteragents();
    fetchFinancialCodes();
    fetchJobs();
    fetchCurrencies();
  }, []);

  // Fetch payment options when counteragent changes
  useEffect(() => {
    if (selectedCounteragentUuid) {
      fetchPaymentOptions(selectedCounteragentUuid);
    } else {
      setPaymentOptions([]);
      setSelectedPaymentId('');
    }
  }, [selectedCounteragentUuid]);

  // Check for duplicate payments when relevant fields change
  useEffect(() => {
    const checkDuplicates = async () => {
      // Only check if we have the minimum required fields and no payment ID is selected
      if (!selectedProjectUuid || !selectedCounteragentUuid || !selectedFinancialCodeUuid || !selectedCurrencyUuid || selectedPaymentId) {
        setDuplicateCount(0);
        setDuplicatePaymentIds([]);
        return;
      }

      setCheckingDuplicates(true);
      try {
        const response = await fetch('/api/payments/check-duplicates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectUuid: selectedProjectUuid,
            counteragentUuid: selectedCounteragentUuid,
            financialCodeUuid: selectedFinancialCodeUuid,
            jobUuid: selectedJobUuid || null,
            currencyUuid: selectedCurrencyUuid,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setDuplicateCount(data.count);
          setDuplicatePaymentIds(data.matches.map((m: any) => m.paymentId));
        }
      } catch (error) {
        console.error('Error checking duplicates:', error);
      } finally {
        setCheckingDuplicates(false);
      }
    };

    checkDuplicates();
  }, [selectedProjectUuid, selectedCounteragentUuid, selectedFinancialCodeUuid, selectedJobUuid, selectedCurrencyUuid, selectedPaymentId]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/payments');
      if (!response.ok) throw new Error('Failed to fetch payments');
      const data = await response.json();
      setPayments(data);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (!response.ok) throw new Error('Failed to fetch projects');
      const data = await response.json();
      // Map the API response to our format
      const formattedProjects = data.map((p: any) => ({
        projectUuid: p.project_uuid,
        projectIndex: p.project_index,
        projectName: p.project_name
      }));
      setProjects(formattedProjects);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchCounteragents = async () => {
    try {
      const response = await fetch('/api/counteragents');
      if (!response.ok) throw new Error('Failed to fetch counteragents');
      const data = await response.json();
      // Map to include full display format
      const formattedCounteragents = data.map((ca: any) => ({
        counteragentUuid: ca.counteragent_uuid,
        name: ca.name,
        identificationNumber: ca.identification_number || '',
        entityType: ca.entity_type || ''
      }));
      setCounteragents(formattedCounteragents);
    } catch (error) {
      console.error('Error fetching counteragents:', error);
    }
  };

  const fetchFinancialCodes = async () => {
    try {
      const response = await fetch('/api/financial-codes');
      if (!response.ok) throw new Error('Failed to fetch financial codes');
      const data = await response.json();
      // Map to include both validation and code
      const formattedCodes = data.map((fc: any) => ({
        uuid: fc.uuid,
        validation: fc.validation || fc.name,
        code: fc.code
      }));
      setFinancialCodes(formattedCodes);
    } catch (error) {
      console.error('Error fetching financial codes:', error);
    }
  };

  const fetchJobs = async () => {
    try {
      const response = await fetch('/api/jobs');
      if (!response.ok) throw new Error('Failed to fetch jobs');
      const data = await response.json();
      // Map to our format
      const formattedJobs = data.map((job: any) => ({
        jobUuid: job.jobUuid,
        jobIndex: job.jobIndex,
        jobName: job.jobName
      }));
      setJobs(formattedJobs);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const fetchCurrencies = async () => {
    try {
      const response = await fetch('/api/currencies');
      if (!response.ok) throw new Error('Failed to fetch currencies');
      const data = await response.json();
      setCurrencies(data.map((c: any) => ({ 
        uuid: c.uuid, 
        code: c.code, 
        name: c.name 
      })));
    } catch (error) {
      console.error('Failed to fetch currencies:', error);
    }
  };

  const fetchPaymentOptions = async (counteragentUuid: string) => {
    if (!counteragentUuid) {
      setPaymentOptions([]);
      return;
    }

    try {
      const response = await fetch(`/api/payments/${counteragentUuid}/payment-options`);
      if (!response.ok) {
        console.error('Failed to fetch payment options');
        setPaymentOptions([]);
        return;
      }
      const data = await response.json();
      setPaymentOptions(data.payments || []);
    } catch (error) {
      console.error('Error fetching payment options:', error);
      setPaymentOptions([]);
    }
  };

  // Handle payment ID selection in add dialog
  const handlePaymentIdChange = (paymentId: string) => {
    setSelectedPaymentId(paymentId);
    
    if (paymentId) {
      const selectedPayment = paymentOptions.find(p => p.paymentId === paymentId);
      if (selectedPayment) {
        setSelectedProjectUuid(selectedPayment.projectUuid || '');
        setSelectedJobUuid(selectedPayment.jobUuid || '');
        setSelectedFinancialCodeUuid(selectedPayment.financialCodeUuid || '');
        setSelectedCurrencyUuid(selectedPayment.currencyUuid || '');
        
        setPaymentDisplayValues({
          projectLabel: selectedPayment.projectName || '',
          jobLabel: selectedPayment.jobDisplay || selectedPayment.jobName || '',
          financialCodeLabel: selectedPayment.financialCodeValidation || '',
          currencyLabel: selectedPayment.currencyCode || '',
        });
      }
    } else {
      // Clear display values when payment is cleared
      setPaymentDisplayValues({
        projectLabel: '',
        jobLabel: '',
        financialCodeLabel: '',
        currencyLabel: '',
      });
    }
  };

  // Handle payment ID selection in edit dialog
  const handleEditPaymentIdChange = (paymentId: string) => {
    setEditSelectedPaymentId(paymentId);
    
    if (paymentId) {
      const selectedPayment = paymentOptions.find(p => p.paymentId === paymentId);
      if (selectedPayment && editingPayment) {
        setEditPaymentDisplayValues({
          projectLabel: selectedPayment.projectName || '',
          jobLabel: selectedPayment.jobDisplay || selectedPayment.jobName || '',
          financialCodeLabel: selectedPayment.financialCodeValidation || '',
          currencyLabel: selectedPayment.currencyCode || '',
        });
      }
    } else {
      // Clear display values when payment is cleared
      if (editingPayment) {
        setEditPaymentDisplayValues({
          projectLabel: editingPayment.projectIndex || '',
          jobLabel: editingPayment.jobName || '',
          financialCodeLabel: editingPayment.financialCodeValidation || '',
          currencyLabel: editingPayment.currencyCode || '',
        });
      }
    }
  };

  const handleAddPayment = async () => {
    if (!selectedProjectUuid || !selectedCounteragentUuid || !selectedFinancialCodeUuid || !selectedCurrencyUuid) {
      alert('Please fill in all required fields');
      return;
    }

    // Prevent creating duplicate if matches exist and no payment ID selected
    if (duplicateCount > 0 && !selectedPaymentId) {
      alert(`Cannot create duplicate payment. ${duplicateCount} matching payment(s) already exist with these exact parameters. Please select one of the existing payments from the Payment ID dropdown.`);
      return;
    }

    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectUuid: selectedProjectUuid,
          counteragentUuid: selectedCounteragentUuid,
          financialCodeUuid: selectedFinancialCodeUuid,
          jobUuid: selectedJobUuid || null,
          incomeTax: selectedIncomeTax,
          currencyUuid: selectedCurrencyUuid,
          paymentId: selectedPaymentId || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create payment');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchPayments();
    } catch (error: any) {
      console.error('Error adding payment:', error);
      alert(error.message || 'Failed to add payment');
    }
  };

  const handleOpenEditDialog = async (payment: Payment) => {
    setEditingPayment(payment);
    setEditIncomeTax(payment.incomeTax);
    setEditSelectedPaymentId(payment.paymentId || '');
    
    // Set initial display values
    setEditPaymentDisplayValues({
      projectLabel: payment.projectIndex || '',
      jobLabel: payment.jobName || '',
      financialCodeLabel: payment.financialCodeValidation || '',
      currencyLabel: payment.currencyCode || '',
    });
    
    // Fetch payment options for this counteragent
    if (payment.counteragentUuid) {
      await fetchPaymentOptions(payment.counteragentUuid);
    }
    
    setEditDialogOpen(true);
  };

  const handleSaveIncomeTax = async () => {
    if (!editingPayment) return;

    try {
      const response = await fetch(`/api/payments?id=${editingPayment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          incomeTax: editIncomeTax,
          paymentId: editSelectedPaymentId || undefined,
        }),
      });

      if (!response.ok) throw new Error('Failed to update payment');
      await fetchPayments();
      setEditDialogOpen(false);
    } catch (error) {
      console.error('Error updating payment:', error);
      alert('Failed to update payment');
    }
  };

  const resetForm = () => {
    setSelectedProjectUuid('');
    setSelectedCounteragentUuid('');
    setSelectedFinancialCodeUuid('');
    setSelectedJobUuid('');
    setSelectedIncomeTax(false);
    setSelectedCurrencyUuid('');
    setSelectedPaymentId('');
    setPaymentOptions([]);
    setPaymentDisplayValues({ projectLabel: '', jobLabel: '', financialCodeLabel: '', currencyLabel: '' });
    setDuplicateCount(0);
    setDuplicatePaymentIds([]);
  };
  };

  // Mouse events for column resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const diff = e.clientX - isResizing.startX;
      const newWidth = Math.max(60, isResizing.startWidth + diff);
      
      setColumnConfig(cols => cols.map(col => 
        col.key === isResizing.column 
          ? { ...col, width: newWidth }
          : col
      ));
    };

    const handleMouseUp = () => {
      setIsResizing(null);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Column reordering handlers
  const handleDragStart = (e: React.DragEvent, columnKey: ColumnKey) => {
    setDraggedColumn(columnKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, columnKey: ColumnKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedColumn && draggedColumn !== columnKey) {
      setDragOverColumn(columnKey);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetColumnKey: ColumnKey) => {
    e.preventDefault();
    
    if (!draggedColumn || draggedColumn === targetColumnKey) {
      setDraggedColumn(null);
      setDragOverColumn(null);
      return;
    }

    const draggedIndex = columnConfig.findIndex(col => col.key === draggedColumn);
    const targetIndex = columnConfig.findIndex(col => col.key === targetColumnKey);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newColumns = [...columnConfig];
    const [removed] = newColumns.splice(draggedIndex, 1);
    newColumns.splice(targetIndex, 0, removed);

    setColumnConfig(newColumns);
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

  const getUniqueValues = (key: ColumnKey): string[] => {
    const values = payments
      .map(payment => String(payment[key] || ''))
      .filter((value, index, self) => value && self.indexOf(value) === index);
    return values.sort();
  };

  const filteredAndSortedPayments = useMemo(() => {
    let filtered = [...payments];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(payment =>
        Object.values(payment).some(value =>
          String(value).toLowerCase().includes(term)
        )
      );
    }

    // Apply column filters
    Object.entries(columnFilters).forEach(([column, values]) => {
      if (values.length > 0) {
        filtered = filtered.filter(payment => {
          const cellValue = String(payment[column as ColumnKey] || '');
          return values.includes(cellValue);
        });
      }
    });

    // Apply sorting
    filtered.sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];
      
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      if (sortDirection === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });

    return filtered;
  }, [payments, searchTerm, sortColumn, sortDirection, columnFilters]);

  // Pagination
  const totalRecords = filteredAndSortedPayments.length;
  const totalPages = Math.ceil(totalRecords / pageSize);
  
  const paginatedPayments = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredAndSortedPayments.slice(startIndex, endIndex);
  }, [filteredAndSortedPayments, currentPage, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, columnFilters, pageSize]);

  // Column filter component (matching counteragents style)
  function ColumnFilter({ column }: { column: ColumnConfig }) {
    const uniqueValues = getUniqueValues(column.key);
    const [searchValue, setSearchValue] = useState('');
    const [tempSelected, setTempSelected] = useState<string[]>(columnFilters[column.key] || []);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    const filteredValues = uniqueValues.filter(value =>
      value.toLowerCase().includes(searchValue.toLowerCase())
    );

    const sortedValues = [...filteredValues].sort((a, b) => {
      return sortOrder === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
    });

    const handleApply = () => {
      setColumnFilters(prev => ({
        ...prev,
        [column.key]: tempSelected
      }));
    };

    const handleCancel = () => {
      setTempSelected(columnFilters[column.key] || []);
    };

    const handleSelectAll = () => {
      setTempSelected(sortedValues);
    };

    const handleClearAll = () => {
      setTempSelected([]);
    };

    const toggleSort = () => {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    };

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 px-2 hover:bg-gray-100"
          >
            <Filter className="h-3 w-3" />
            {columnFilters[column.key]?.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {columnFilters[column.key].length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>
          <div className="p-2 border-b flex items-center justify-between">
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSort}
                className="h-7 px-2"
              >
                {sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              </Button>
            </div>
            <div className="flex gap-2 text-xs">
              <button
                onClick={handleSelectAll}
                className="text-blue-600 hover:underline"
              >
                Select all
              </button>
              <span className="text-gray-400">|</span>
              <button
                onClick={handleClearAll}
                className="text-blue-600 hover:underline"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto p-2">
            {sortedValues.map(value => (
              <div key={value} className="flex items-center space-x-2 py-1">
                <Checkbox
                  id={`${column.key}-${value}`}
                  checked={tempSelected.includes(value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setTempSelected([...tempSelected, value]);
                    } else {
                      setTempSelected(tempSelected.filter(v => v !== value));
                    }
                  }}
                />
                <label
                  htmlFor={`${column.key}-${value}`}
                  className="text-sm cursor-pointer flex-1"
                >
                  {value || '(empty)'}
                </label>
              </div>
            ))}
          </div>
          <div className="p-2 border-t flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="h-8"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              className="h-8 bg-green-600 hover:bg-green-700"
            >
              OK
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  const visibleColumns = columnConfig.filter(col => col.visible);

  if (loading) {
    return <div className="p-8 text-center">Loading payments...</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Payments</h1>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (open) {
            // Reset form when dialog opens to ensure blank state
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Payment</DialogTitle>
              <DialogDescription>
                Create a new payment record
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Project</Label>
                {selectedPaymentId ? (
                  <>
                    <Input
                      value={paymentDisplayValues.projectLabel}
                      readOnly
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">Clear Payment ID to edit manually</p>
                  </>
                ) : (
                  <Combobox
                    value={selectedProjectUuid}
                    onValueChange={setSelectedProjectUuid}
                    options={projects.map(p => ({
                      value: p.projectUuid,
                      label: p.projectIndex || p.projectName
                    }))}
                    placeholder="Select project..."
                    searchPlaceholder="Search projects..."
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>Counteragent</Label>
                <Combobox
                  value={selectedCounteragentUuid}
                  onValueChange={setSelectedCounteragentUuid}
                  options={counteragents.map(ca => ({
                    value: ca.counteragentUuid,
                    label: `${ca.name}${ca.identificationNumber ? ` (ს.კ. ${ca.identificationNumber})` : ''}${ca.entityType ? ` - ${ca.entityType}` : ''}`
                  }))}
                  placeholder="Select counteragent..."
                  searchPlaceholder="Search counteragents..."
                />
              </div>

              <div className="space-y-2">
                <Label>Financial Code</Label>
                {selectedPaymentId ? (
                  <>
                    <Input
                      value={paymentDisplayValues.financialCodeLabel}
                      readOnly
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">Clear Payment ID to edit manually</p>
                  </>
                ) : (
                  <Combobox
                    value={selectedFinancialCodeUuid}
                    onValueChange={setSelectedFinancialCodeUuid}
                    options={financialCodes.map(fc => ({
                      value: fc.uuid,
                      label: `${fc.validation} (${fc.code})`
                    }))}
                    placeholder="Select financial code..."
                    searchPlaceholder="Search financial codes..."
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>Job (Optional)</Label>
                {selectedPaymentId ? (
                  <>
                    <Input
                      value={paymentDisplayValues.jobLabel || '-- No Job --'}
                      readOnly
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">Clear Payment ID to edit manually</p>
                  </>
                ) : (
                  <Combobox
                    value={selectedJobUuid}
                    onValueChange={setSelectedJobUuid}
                    options={jobs.map(job => ({
                      value: job.jobUuid,
                      label: job.jobIndex || job.jobName
                    }))}
                    placeholder="Select job..."
                    searchPlaceholder="Search jobs..."
                  />
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={selectedIncomeTax} 
                    onCheckedChange={setSelectedIncomeTax}
                    id="income-tax-switch"
                  />
                  <Label htmlFor="income-tax-switch" className="cursor-pointer">
                    Income Tax
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Currency</Label>
                {selectedPaymentId ? (
                  <>
                    <Input
                      value={paymentDisplayValues.currencyLabel}
                      readOnly
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">Clear Payment ID to edit manually</p>
                  </>
                ) : (
                  <Combobox
                    value={selectedCurrencyUuid}
                    onValueChange={setSelectedCurrencyUuid}
                    options={currencies.map(c => ({
                      value: c.uuid,
                      label: `${c.code} - ${c.name}`
                    }))}
                    placeholder="Select currency..."
                    searchPlaceholder="Search currencies..."
                  />
                )}
              </div>

              {paymentOptions.length > 0 && (
                <div className="space-y-2">
                  <Label>Payment ID (Optional)</Label>
                  <Combobox
                    value={selectedPaymentId}
                    onValueChange={handlePaymentIdChange}
                    options={paymentOptions.map(opt => ({
                      value: opt.paymentId,
                      label: `${opt.paymentId} - ${opt.projectName} | ${opt.jobDisplay || opt.jobName || 'No Job'} | ${opt.financialCodeValidation} | ${opt.currencyCode}`
                    }))}
                    placeholder="Link to existing payment..."
                    searchPlaceholder="Search payment IDs..."
                  />
                  <p className="text-xs text-muted-foreground">
                    {paymentOptions.length} matching payment{paymentOptions.length !== 1 ? 's' : ''} found. {selectedPaymentId ? 'Selecting auto-fills fields above.' : 'Select to auto-fill fields.'}
                  </p>
                </div>
              )}

              {/* Duplicate warning */}
              {duplicateCount > 0 && !selectedPaymentId && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <svg className="h-5 w-5 text-yellow-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                      <h4 className="font-semibold text-yellow-800">Duplicate Payment Detected</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        <strong>{duplicateCount}</strong> matching payment{duplicateCount !== 1 ? 's' : ''} already exist{duplicateCount === 1 ? 's' : ''} with these exact parameters.
                      </p>
                      {duplicatePaymentIds.length > 0 && (
                        <p className="text-xs text-yellow-600 mt-1">
                          Payment IDs: {duplicatePaymentIds.join(', ')}
                        </p>
                      )}
                      <p className="text-sm text-yellow-700 mt-2 font-medium">
                        You must select one of the existing payments from the "Payment ID" dropdown above instead of creating a duplicate.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Button 
                onClick={handleAddPayment} 
                className="w-full"
                disabled={duplicateCount > 0 && !selectedPaymentId}
              >
                {duplicateCount > 0 && !selectedPaymentId ? `Cannot Create - ${duplicateCount} Duplicate(s) Exist` : 'Create Payment'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search all columns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} records
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="border border-input rounded px-2 py-1 text-sm bg-background"
            >
              {pageSizeOptions.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
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
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
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
      )}

      <div className="flex items-center gap-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Columns
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-2">
              <h4 className="font-medium text-sm mb-3">Toggle Columns</h4>
              {columnConfig.map((column) => (
                <div key={column.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={`col-${column.key}`}
                    checked={column.visible}
                    onCheckedChange={(checked) => {
                      setColumnConfig(
                        columnConfig.map(col =>
                          col.key === column.key ? { ...col, visible: !!checked } : col
                        )
                      );
                    }}
                  />
                  <label
                    htmlFor={`col-${column.key}`}
                    className="text-sm cursor-pointer"
                  >
                    {column.label}
                  </label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleColumns.map((column) => (
                <TableHead 
                  key={column.key} 
                  draggable={!isResizing}
                  onDragStart={(e) => handleDragStart(e, column.key)}
                  onDragOver={(e) => handleDragOver(e, column.key)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, column.key)}
                  onDragEnd={handleDragEnd}
                  className={`relative group ${
                    draggedColumn === column.key ? 'opacity-50' : ''
                  } ${
                    dragOverColumn === column.key ? 'border-l-4 border-l-blue-500' : ''
                  }`}
                  style={{ 
                    width: column.width,
                    cursor: isResizing ? 'col-resize' : 'grab'
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {column.sortable ? (
                        <button
                          onClick={() => handleSort(column.key)}
                          className="flex items-center gap-1 hover:text-gray-900"
                        >
                          {column.label}
                          {sortColumn === column.key && (
                            sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                          )}
                        </button>
                      ) : (
                        column.label
                      )}
                      {column.filterable && <ColumnFilter column={column} />}
                    </div>
                    
                    {/* Resize handle */}
                    <div
                      className="absolute top-0 bottom-0 w-4 cursor-col-resize hover:bg-blue-400/30 active:bg-blue-500/50 transition-colors"
                      style={{ 
                        right: '-8px',
                        zIndex: 30 
                      }}
                      draggable={false}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsResizing({
                          column: column.key,
                          startX: e.clientX,
                          startWidth: column.width
                        });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      title="Drag to resize column"
                    >
                      <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[2px] bg-gray-300 hover:bg-blue-500 transition-colors" />
                    </div>
                  </div>
                </TableHead>
              ))}
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedPayments.map((payment) => (
              <TableRow key={payment.id}>
                {visibleColumns.map((column) => (
                  <TableCell key={column.key} style={{ width: column.width }}>
                    {column.key === 'isActive' ? (
                      <Badge variant={payment.isActive ? 'default' : 'secondary'}>
                        {payment.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    ) : column.key === 'incomeTax' ? (
                      <span className="text-muted-foreground">
                        {payment.incomeTax ? 'Yes' : 'No'}
                      </span>
                    ) : (
                      String(payment[column.key] || '')
                    )}
                  </TableCell>
                ))}
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEditDialog(payment)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Payment Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
            <DialogDescription>
              Modify income tax setting for this payment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {editingPayment && (
              <>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Current Payment ID</Label>
                  <Input value={editingPayment.paymentId || '(None)'} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Counteragent</Label>
                  <Input value={editingPayment.counteragentName || ''} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Project</Label>
                  <Input value={editPaymentDisplayValues.projectLabel} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Job</Label>
                  <Input value={editPaymentDisplayValues.jobLabel || '-- No Job --'} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Financial Code</Label>
                  <Input value={editPaymentDisplayValues.financialCodeLabel} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Currency</Label>
                  <Input value={editPaymentDisplayValues.currencyLabel} disabled className="bg-muted" />
                </div>
                {paymentOptions.length > 0 && (
                  <div className="space-y-2">
                    <Label>Change Payment ID</Label>
                    <Combobox
                      value={editSelectedPaymentId}
                      onValueChange={handleEditPaymentIdChange}
                      options={paymentOptions.map(opt => ({
                        value: opt.paymentId,
                        label: `${opt.paymentId} - ${opt.projectName} | ${opt.jobDisplay || opt.jobName || 'No Job'} | ${opt.financialCodeValidation} | ${opt.currencyCode}`
                      }))}
                      placeholder="Link to payment ID..."
                      searchPlaceholder="Search payment IDs..."
                    />
                    <p className="text-xs text-muted-foreground">
                      {paymentOptions.length} matching payment{paymentOptions.length !== 1 ? 's' : ''} found for this counteragent
                    </p>
                  </div>
                )}
                <div className="flex items-center space-x-2 pt-4 border-t">
                  <Switch 
                    checked={editIncomeTax} 
                    onCheckedChange={setEditIncomeTax}
                    id="edit-income-tax"
                  />
                  <Label htmlFor="edit-income-tax" className="cursor-pointer font-semibold">
                    Income Tax
                  </Label>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={handleSaveIncomeTax}
                    className="flex-1"
                  >
                    Save Changes
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setEditDialogOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
