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
  ChevronLeft,
  ChevronRight,
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
  const [filteredJobs, setFilteredJobs] = useState<Array<{ jobUuid: string; jobIndex: string; jobName: string; jobDisplay?: string }>>([]);
  const [currencies, setCurrencies] = useState<Array<{ uuid: string; code: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<ColumnKey>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [columnConfig, setColumnConfig] = useState<ColumnConfig[]>(defaultColumns);
  const [filters, setFilters] = useState<Map<string, Set<any>>>(new Map());
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const pageSizeOptions = [50, 100, 200, 500, 1000];
  
  // Column dragging and resizing states
  const [isResizing, setIsResizing] = useState<{ column: ColumnKey; startX: number; startWidth: number; element: HTMLElement } | null>(null);
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

  // Load saved column configuration after hydration
  useEffect(() => {
    const saved = localStorage.getItem('paymentsTableColumns');
    if (saved) {
      try {
        const savedColumns = JSON.parse(saved) as ColumnConfig[];
        const defaultColumnsMap = new Map(defaultColumns.map(col => [col.key, col]));
        const validSavedColumns = savedColumns.filter(savedCol => defaultColumnsMap.has(savedCol.key));
        const updatedSavedColumns = validSavedColumns.map(savedCol => {
          const defaultCol = defaultColumnsMap.get(savedCol.key);
          if (defaultCol) {
            return { ...defaultCol, visible: savedCol.visible, width: savedCol.width };
          }
          return savedCol;
        });
        const savedKeys = new Set(validSavedColumns.map(col => col.key));
        const newColumns = defaultColumns.filter(col => !savedKeys.has(col.key));
        setColumnConfig([...updatedSavedColumns, ...newColumns]);
      } catch (e) {
        console.error('Failed to parse saved columns:', e);
        setColumnConfig(defaultColumns);
      }
    }
    setIsInitialized(true);
  }, []);

  // Save column configuration to localStorage whenever it changes
  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
      localStorage.setItem('paymentsTableColumns', JSON.stringify(columnConfig));
    }
  }, [columnConfig, isInitialized]);

  useEffect(() => {
    fetchPayments();
    fetchProjects();
    fetchCounteragents();
    fetchFinancialCodes();
    fetchJobs();
    fetchCurrencies();
  }, []);

  // Fetch jobs when project changes
  useEffect(() => {
    const fetchProjectJobs = async () => {
      if (selectedProjectUuid) {
        try {
          const response = await fetch(`/api/jobs?projectUuid=${selectedProjectUuid}`);
          if (!response.ok) throw new Error('Failed to fetch project jobs');
          const data = await response.json();
          setFilteredJobs(data);
        } catch (error) {
          console.error('Error fetching project jobs:', error);
          setFilteredJobs([]);
        }
      } else {
        setFilteredJobs([]);
        setSelectedJobUuid('');
      }
    };
    fetchProjectJobs();
  }, [selectedProjectUuid]);

  // Fetch payment options when counteragent changes
  // Fetch all payment options for the selected counteragent
  useEffect(() => {
    if (selectedCounteragentUuid) {
      fetchPaymentOptions(selectedCounteragentUuid);
    } else {
      setPaymentOptions([]);
      setSelectedPaymentId('');
    }
  }, [selectedCounteragentUuid]);

  // Filter payment options based on ALL selected fields
  const filteredPaymentOptions = useMemo(() => {
    if (!selectedCounteragentUuid) return [];
    
    return paymentOptions.filter(opt => {
      // Filter by project if selected
      if (selectedProjectUuid && opt.projectUuid !== selectedProjectUuid) return false;
      
      // Filter by financial code if selected
      if (selectedFinancialCodeUuid && opt.financialCodeUuid !== selectedFinancialCodeUuid) return false;
      
      // Filter by job if selected (handle null case)
      if (selectedJobUuid) {
        if (opt.jobUuid !== selectedJobUuid) return false;
      }
      
      // Filter by currency if selected
      if (selectedCurrencyUuid && opt.currencyUuid !== selectedCurrencyUuid) return false;
      
      return true;
    });
  }, [paymentOptions, selectedProjectUuid, selectedCounteragentUuid, selectedFinancialCodeUuid, selectedJobUuid, selectedCurrencyUuid]);

  // Check for duplicate payments when relevant fields change
  // Mandatory fields: counteragent, financial code, currency
  // Optional fields: project, job, income tax
  useEffect(() => {
    const checkDuplicates = async () => {
      // Only check if we have ALL mandatory fields and no payment ID is selected
      if (!selectedCounteragentUuid || !selectedFinancialCodeUuid || !selectedCurrencyUuid || selectedPaymentId) {
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
            projectUuid: selectedProjectUuid || null,
            counteragentUuid: selectedCounteragentUuid,
            financialCodeUuid: selectedFinancialCodeUuid,
            jobUuid: selectedJobUuid || null,
            currencyUuid: selectedCurrencyUuid,
            incomeTax: selectedIncomeTax,
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
  }, [selectedProjectUuid, selectedCounteragentUuid, selectedFinancialCodeUuid, selectedJobUuid, selectedCurrencyUuid, selectedIncomeTax, selectedPaymentId]);

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
      const result = await response.json();
      // API returns { data: [...] }, not direct array
      const currenciesArray = result.data || result;
      if (!Array.isArray(currenciesArray)) {
        throw new Error('Invalid currencies data format');
      }
      const currencyData = currenciesArray.map((c: any) => ({ 
        uuid: c.uuid, 
        code: c.code, 
        name: c.name 
      }));
      console.log(`✅ Loaded ${currencyData.length} currencies:`, currencyData);
      setCurrencies(currencyData);
    } catch (error) {
      console.error('❌ Failed to fetch currencies:', error);
      setCurrencies([]);
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
    // Validate mandatory fields only - with specific error messages
    const missingFields: string[] = [];
    if (!selectedCounteragentUuid) missingFields.push('Counteragent');
    if (!selectedFinancialCodeUuid) missingFields.push('Financial Code');
    if (!selectedCurrencyUuid) missingFields.push('Currency');
    
    if (missingFields.length > 0) {
      alert(`Missing required fields: ${missingFields.join(', ')}\n\nDebug info:\n- Counteragent UUID: ${selectedCounteragentUuid || 'MISSING'}\n- Financial Code UUID: ${selectedFinancialCodeUuid || 'MISSING'}\n- Currency UUID: ${selectedCurrencyUuid || 'MISSING'}`);
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

  // Mouse events for column resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const deltaX = e.clientX - isResizing.startX;
      const newWidth = Math.max(60, isResizing.startWidth + deltaX);
      
      // Update DOM directly without triggering re-render
      isResizing.element.style.width = `${newWidth}px`;
      isResizing.element.style.minWidth = `${newWidth}px`;
      isResizing.element.style.maxWidth = `${newWidth}px`;
    };

    const handleMouseUp = () => {
      if (!isResizing) return;
      
      const finalWidth = parseInt(isResizing.element.style.width);
      setColumnConfig(prev =>
        prev.map(col =>
          col.key === isResizing.column ? { ...col, width: finalWidth } : col
        )
      );
      
      setIsResizing(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
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

  const handleToggleColumn = (columnKey: string) => {
    setColumnConfig(prev => 
      prev.map(col => 
        col.key === columnKey ? { ...col, visible: !col.visible } : col
      )
    );
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

  const uniqueValuesCache = useMemo(() => {
    const cache = new Map<ColumnKey, any[]>();
    const filterableColumns = columnConfig.filter(col => col.filterable);
    
    filterableColumns.forEach(col => {
      const values = new Set(payments.map(row => row[col.key]));
      cache.set(col.key, Array.from(values).sort());
    });
    
    return cache;
  }, [payments, columnConfig]);

  const getUniqueValues = (columnKey: ColumnKey): any[] => {
    return uniqueValuesCache.get(columnKey) || [];
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
    if (filters.size > 0) {
      filtered = filtered.filter(row => {
        for (const [columnKey, allowedValues] of filters.entries()) {
          const rowValue = row[columnKey as ColumnKey];
          if (!allowedValues.has(rowValue)) {
            return false;
          }
        }
        return true;
      });
    }

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
  }, [payments, searchTerm, sortColumn, sortDirection, filters]);

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
  }, [searchTerm, filters, pageSize]);

  const visibleColumns = columnConfig.filter(col => col.visible);
  const activeFilterCount = filters.size;

  if (loading) {
    return <div className="p-8 text-center">Loading payments...</div>;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-20 flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Payments</h1>
            <Badge variant="secondary">
              {filteredAndSortedPayments.length} records
            </Badge>
            {totalPages > 1 && (
              <span className="text-sm text-gray-500">
                Page {currentPage} of {totalPages}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (open) {
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
                Fill fields in order to create a payment record
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* 1. Counteragent - Always active */}
              <div className="space-y-2">
                <Label>Counteragent <span className="text-red-500">*</span></Label>
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

              {/* 2. Financial Code - Active after counteragent */}
              <div className="space-y-2">
                <Label className={!selectedCounteragentUuid ? 'text-muted-foreground' : ''}>
                  Financial Code <span className="text-red-500">*</span>
                </Label>
                {selectedCounteragentUuid ? (
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
                ) : (
                  <Input value="" placeholder="Select counteragent first" disabled className="bg-muted" />
                )}
              </div>

              {/* 3. Currency - Active after financial code */}
              <div className="space-y-2">
                <Label className={!selectedFinancialCodeUuid ? 'text-muted-foreground' : ''}>
                  Currency <span className="text-red-500">*</span>
                  {!selectedFinancialCodeUuid && <span className="ml-2 text-xs font-normal text-amber-600">(Select financial code first)</span>}
                </Label>
                {selectedFinancialCodeUuid ? (
                  <Combobox
                    value={selectedCurrencyUuid}
                    onValueChange={setSelectedCurrencyUuid}
                    options={currencies.map(c => ({
                      value: c.uuid,
                      label: `${c.code} - ${c.name}`
                    }))}
                    placeholder={currencies.length === 0 ? "Loading currencies..." : "Select currency..."}
                    searchPlaceholder="Search currencies..."
                    disabled={currencies.length === 0}
                  />
                ) : (
                  <Input value="" placeholder="⚠️ Select financial code first" disabled className="bg-muted" />
                )}
              </div>

              {/* 4. Income Tax - Active after currency (always visible as toggle) */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={selectedIncomeTax} 
                    onCheckedChange={setSelectedIncomeTax}
                    id="income-tax-switch"
                    disabled={!selectedCurrencyUuid}
                  />
                  <Label 
                    htmlFor="income-tax-switch" 
                    className={`cursor-pointer ${!selectedCurrencyUuid ? 'text-muted-foreground' : ''}`}
                  >
                    Income Tax
                  </Label>
                </div>
              </div>

              {/* 5. Project - Active after currency (optional) */}
              <div className="space-y-2">
                <Label className={!selectedCurrencyUuid ? 'text-muted-foreground' : ''}>
                  Project (Optional)
                </Label>
                {selectedCurrencyUuid ? (
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
                ) : (
                  <Input value="" placeholder="Select currency first" disabled className="bg-muted" />
                )}
              </div>

              {/* 6. Job - Active after project (optional) */}
              <div className="space-y-2">
                <Label className={!selectedProjectUuid ? 'text-muted-foreground' : ''}>
                  Job (Optional)
                </Label>
                {selectedProjectUuid ? (
                  <Combobox
                    value={selectedJobUuid}
                    onValueChange={setSelectedJobUuid}
                    options={filteredJobs.map(job => ({
                      value: job.jobUuid,
                      label: job.jobDisplay || job.jobIndex || job.jobName
                    }))}
                    placeholder="Select job..."
                    searchPlaceholder="Search jobs..."
                  />
                ) : (
                  <Input value="" placeholder="Select project first" disabled className="bg-muted" />
                )}
              </div>

              {/* Payment ID Information - Only show if no exact duplicates */}
              {selectedCounteragentUuid && duplicateCount === 0 && filteredPaymentOptions.length > 0 && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <svg className="h-5 w-5 text-blue-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <h4 className="font-semibold text-blue-800 text-sm">Similar Payments Found</h4>
                      <p className="text-xs text-blue-700 mt-1">
                        <strong>{filteredPaymentOptions.length}</strong> existing payment{filteredPaymentOptions.length !== 1 ? 's' : ''} match some of your selections
                      </p>
                      <div className="mt-2">
                        <Label className="text-xs text-blue-800">You can link to an existing payment:</Label>
                        <Combobox
                          value={selectedPaymentId}
                          onValueChange={handlePaymentIdChange}
                          options={filteredPaymentOptions.map(opt => ({
                            value: opt.paymentId,
                            label: `${opt.paymentId} - ${opt.projectName || 'No Project'} | ${opt.jobDisplay || opt.jobName || 'No Job'} | ${opt.financialCodeValidation} | ${opt.currencyCode}`
                          }))}
                          placeholder="Link to existing payment..."
                          searchPlaceholder="Search payment IDs..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Duplicate warning - show when exact duplicate exists */}
              {duplicateCount > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <svg className="h-5 w-5 text-red-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-800 text-sm">Cannot Create - Duplicate Exists</h4>
                      <p className="text-xs text-red-700 mt-1">
                        This exact combination already exists in the database.
                      </p>
                      {duplicatePaymentIds.length > 0 && (
                        <p className="text-xs text-red-600 mt-1 font-medium">
                          Existing Payment ID(s): {duplicatePaymentIds.join(', ')}
                        </p>
                      )}
                      <p className="text-xs text-red-700 mt-2">
                        Please change your field selections to create a different payment record.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Button 
                onClick={handleAddPayment} 
                className="w-full"
                disabled={duplicateCount > 0}
              >
                {duplicateCount > 0 
                  ? `Cannot Create - Duplicate Exists` 
                  : selectedPaymentId 
                    ? 'Link to Existing Payment' 
                    : 'Create Payment'
                }
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

              </DialogContent>
            </Dialog>

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

            {/* Pagination Controls */}
            {filteredAndSortedPayments.length > 0 && (
              <>
                <div className="flex items-center gap-2 border-l pl-2">
                  <span className="text-sm text-gray-600">Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    {pageSizeOptions.map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 border-l pl-2">
                  <span className="text-sm text-gray-600">
                    {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, filteredAndSortedPayments.length)} of {filteredAndSortedPayments.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
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
                  {columnConfig.map(col => (
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

      {/* Table */}
      <div className="flex-1 p-4 overflow-hidden">
        <div className="h-full overflow-auto rounded-lg border bg-white">
          <table style={{ tableLayout: 'fixed', width: '100%' }} className="border-collapse">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b-2 border-gray-200">
                {visibleColumns.map(col => (
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
                      maxWidth: col.width
                    }}
                    draggable={!isResizing}
                    onDragStart={(e) => handleDragStart(e, col.key)}
                    onDragOver={(e) => handleDragOver(e, col.key)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, col.key)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="flex items-center gap-2 pr-4 overflow-hidden">
                      {col.sortable ? (
                        <button
                          onClick={() => handleSort(col.key)}
                          className="flex items-center gap-1 hover:text-gray-900 truncate"
                        >
                          <span className="truncate font-medium">{col.label}</span>
                          {sortColumn === col.key && (
                            sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 flex-shrink-0" /> : <ArrowDown className="h-3 w-3 flex-shrink-0" />
                          )}
                        </button>
                      ) : (
                        <span className="truncate font-medium">{col.label}</span>
                      )}
                      {col.filterable && (
                        <FilterPopover
                          columnKey={col.key}
                          columnLabel={col.label}
                          values={getUniqueValues(col.key)}
                          activeFilters={filters.get(col.key) || new Set()}
                          onFilterChange={(values) => handleFilterChange(col.key, values)}
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
                ))}
                <th 
                  className="sticky top-0 bg-white px-4 py-3 text-left text-sm font-semibold border-b-2 border-gray-200"
                  style={{ width: 100, minWidth: 100, maxWidth: 100 }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedPayments.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="text-center py-8 px-4 text-gray-500">
                    No records found
                  </td>
                </tr>
              ) : (
                paginatedPayments.map((payment, idx) => (
                  <tr key={`${payment.id}-${idx}`} className="border-b border-gray-200 hover:bg-gray-50">
                    {visibleColumns.map(col => (
                      <td 
                        key={col.key}
                        className="overflow-hidden px-4 py-2 text-sm"
                        style={{ 
                          width: col.width, 
                          minWidth: col.width, 
                          maxWidth: col.width
                        }}
                      >
                        <div className="truncate">
                          {col.key === 'isActive' ? (
                            <Badge variant={payment.isActive ? 'default' : 'secondary'}>
                              {payment.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          ) : col.key === 'incomeTax' ? (
                            <span className="text-muted-foreground">
                              {payment.incomeTax ? 'Yes' : 'No'}
                            </span>
                          ) : (
                            String(payment[col.key] || '')
                          )}
                        </div>
                      </td>
                    ))}
                    <td className="px-4 py-2 text-sm" style={{ width: 100, minWidth: 100, maxWidth: 100 }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditDialog(payment)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
                      {paymentOptions.length} payment{paymentOptions.length !== 1 ? 's' : ''} available for this counteragent
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