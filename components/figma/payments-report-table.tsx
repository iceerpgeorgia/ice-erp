'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Settings,
  Eye,
  EyeOff,
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
  Plus
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Combobox } from '../ui/combobox';
import * as XLSX from 'xlsx';


type PaymentReport = {
  paymentId: string;
  counteragent: string;
  counteragentId?: string | null;
  counteragentIban?: string | null;
  project: string;
  projectName?: string | null;
  job: string;
  floors: number;
  financialCode: string;
  financialCodeDescription?: string | null;
  incomeTax: boolean;
  currency: string;
  accrual: number;
  order: number;
  payment: number;
  accrualPerFloor: number;
  paidPercent: number;
  due: number;
  balance: number;
  latestDate: string | null;
};

type ColumnKey = keyof PaymentReport;

type ColumnConfig = {
  key: ColumnKey;
  label: string;
  visible: boolean;
  sortable: boolean;
  filterable: boolean;
  format?: 'currency' | 'number' | 'boolean' | 'date' | 'percent';
  width: number;
};

const defaultColumns: ColumnConfig[] = [
  { key: 'counteragent', label: 'Counteragent', visible: true, sortable: true, filterable: true, width: 280 },
  { key: 'paymentId', label: 'Payment ID', visible: true, sortable: true, filterable: true, width: 150 },
  { key: 'currency', label: 'Currency', visible: true, sortable: true, filterable: true, width: 100 },
  { key: 'financialCode', label: 'Financial Code', visible: true, sortable: true, filterable: true, width: 200 },
  { key: 'incomeTax', label: 'Income Tax', visible: true, sortable: true, filterable: true, format: 'boolean', width: 100 },
  { key: 'project', label: 'Project', visible: true, sortable: true, filterable: true, width: 200 },
  { key: 'job', label: 'Job', visible: true, sortable: true, filterable: true, width: 150 },
  { key: 'floors', label: 'Floors', visible: true, sortable: true, filterable: true, format: 'number', width: 100 },
  { key: 'accrual', label: 'Accrual', visible: true, sortable: true, filterable: true, format: 'currency', width: 120 },
  { key: 'order', label: 'Order', visible: true, sortable: true, filterable: true, format: 'currency', width: 120 },
  { key: 'payment', label: 'Payment', visible: true, sortable: true, filterable: true, format: 'currency', width: 120 },
  { key: 'paidPercent', label: 'Paid %', visible: true, sortable: true, filterable: true, format: 'percent', width: 100 },
  { key: 'due', label: 'Due', visible: true, sortable: true, filterable: true, format: 'currency', width: 120 },
  { key: 'accrualPerFloor', label: 'Accrual/Floor', visible: true, sortable: true, filterable: true, format: 'currency', width: 120 },
  { key: 'balance', label: 'Balance', visible: true, sortable: true, filterable: true, format: 'currency', width: 120 },
  { key: 'latestDate', label: 'Latest Date', visible: true, sortable: true, filterable: true, format: 'date', width: 120 },
];

export function PaymentsReportTable() {
  const filtersStorageKey = 'paymentsReportFiltersV2';
  const [data, setData] = useState<PaymentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<ColumnKey>('latestDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);
  const [filters, setFilters] = useState<Map<string, Set<any>>>(new Map());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [isResizing, setIsResizing] = useState<{ column: ColumnKey; startX: number; startWidth: number; element: HTMLElement } | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [dateFilterMode, setDateFilterMode] = useState<'none' | 'today' | 'custom'>('none');
  const [customDate, setCustomDate] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string>>(new Set());
  const [isBaseInfoOpen, setIsBaseInfoOpen] = useState(false);
  const [baseInfoLoading, setBaseInfoLoading] = useState(false);
  const [baseInfoError, setBaseInfoError] = useState<string | null>(null);
  const [baseInfo, setBaseInfo] = useState<any | null>(null);
  const [isBankExporting, setIsBankExporting] = useState(false);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const counteragentsWithNegativeBalance = useMemo(() => {
    const flagged = new Set<string>();
    data.forEach((row) => {
      if (row.counteragent && (row.due < 0 || row.balance < 0)) {
        flagged.add(row.counteragent);
      }
    });
    return flagged;
  }, [data]);

  // BroadcastChannel for cross-tab updates
  const [broadcastChannel] = useState(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      return new BroadcastChannel('payments-ledger-updates');
    }
    return null;
  });

  // Conditions filter state
  const allConditions = [
    'ALL',
    'Accrual>0',
    'Accrual<0',
    'Accrual=0',
    'Order>0',
    'Order<0',
    'Order=0',
    'Paid>0',
    'Paid<0',
    'Paid=0',
    'Due>0',
    'Due<0',
    'Due=0',
    'Balance>0',
    'Balance<0',
    'Balance=0',
    'Current Due>0',
    'Current Due<0',
    'Current Due=0'
  ] as const;
  const [selectedConditions, setSelectedConditions] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('paymentsReportConditions');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length === 0) {
            return new Set(allConditions);
          }
          return new Set(parsed);
        } catch {
          return new Set(allConditions);
        }
      }
    }
    return new Set(allConditions);
  });

  // Add Entry form states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [addLedgerStep, setAddLedgerStep] = useState<'payment' | 'ledger'>('payment');
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [preSelectedPaymentId, setPreSelectedPaymentId] = useState<string | null>(null);
  const [selectedPaymentDetails, setSelectedPaymentDetails] = useState<{
    paymentId: string;
    counteragent: string;
    project: string;
    job: string;
    financialCode: string;
    incomeTax: boolean;
    currency: string;
  } | null>(null);
  const [projects, setProjects] = useState<Array<{ projectUuid?: string; project_uuid?: string; projectIndex?: string; project_index?: string; projectName?: string; project_name?: string }>>([]);
  const [counteragents, setCounteragents] = useState<Array<{ counteragent_uuid?: string; counteragentUuid?: string; counteragent?: string; name?: string; identification_number?: string; identificationNumber?: string }>>([]);
  const [financialCodes, setFinancialCodes] = useState<Array<{ uuid: string; validation: string; code: string }>>([]);
  const [currencies, setCurrencies] = useState<Array<{ uuid: string; code: string; name: string }>>([]);
  const [jobs, setJobs] = useState<Array<{ jobUuid: string; jobName: string; jobDisplay?: string }>>([]);
  const [selectedCounteragentUuid, setSelectedCounteragentUuid] = useState('');
  const [selectedProjectUuid, setSelectedProjectUuid] = useState('');
  const [selectedFinancialCodeUuid, setSelectedFinancialCodeUuid] = useState('');
  const [selectedJobUuid, setSelectedJobUuid] = useState('');
  const [selectedCurrencyUuid, setSelectedCurrencyUuid] = useState('');
  const [selectedIncomeTax, setSelectedIncomeTax] = useState(false);
  const [payments, setPayments] = useState<Array<{ 
    paymentId: string; 
    counteragentName?: string;
    projectIndex?: string;
    projectName?: string;
    jobName?: string;
    financialCode?: string;
    incomeTax?: boolean;
    currencyCode?: string;
  }>>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [accrual, setAccrual] = useState('');
  const [order, setOrder] = useState('');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load saved column configuration and date filter after hydration
  useEffect(() => {
    const saved = localStorage.getItem('paymentsReportColumns');
    if (saved) {
      try {
        const savedColumns = JSON.parse(saved) as ColumnConfig[];
        
        // Create a map of default columns for easy lookup
        const defaultColumnsMap = new Map(defaultColumns.map(col => [col.key, col]));
        
        // Filter out any columns that don't exist in defaultColumns (e.g., removed counteragentId)
        const validSavedColumns = savedColumns.filter(savedCol => defaultColumnsMap.has(savedCol.key));
        
        // Update saved columns with latest defaults (format, filterable, etc.) while preserving user preferences (visible, width)
        const updatedSavedColumns = validSavedColumns.map(savedCol => {
          const defaultCol = defaultColumnsMap.get(savedCol.key);
          if (defaultCol) {
            // Preserve user preferences but update structure from defaults
            return {
              ...defaultCol,
              visible: savedCol.visible,
              width: savedCol.width
            };
          }
          return savedCol;
        });
        
        // Find completely new columns that don't exist in saved columns
        const savedKeys = new Set(validSavedColumns.map(col => col.key));
        const newColumns = defaultColumns.filter(col => !savedKeys.has(col.key));
        
        // Combine updated saved columns with new columns
        setColumns([...updatedSavedColumns, ...newColumns]);
      } catch (e) {
        console.error('Failed to parse saved columns:', e);
        setColumns(defaultColumns);
      }
    }
    
    // Load saved date filter settings
    const savedDateFilter = localStorage.getItem('paymentsReportDateFilter');
    if (savedDateFilter) {
      try {
        const { mode, date } = JSON.parse(savedDateFilter);
        const isValidDateString = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date);
        const today = new Date().toISOString().split('T')[0];
        const isDateInRange = isValidDateString && date <= today;

        if (mode === 'today') {
          setDateFilterMode('today');
        } else if (mode === 'custom' && isDateInRange) {
          setDateFilterMode('custom');
          setCustomDate(date);
        } else {
          setDateFilterMode('none');
          setCustomDate('');
        }
      } catch (e) {
        console.error('Failed to parse saved date filter:', e);
        setDateFilterMode('none');
        setCustomDate('');
      }
    }

    const savedFilters = localStorage.getItem(filtersStorageKey);
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        if (typeof parsed.searchTerm === 'string') setSearchTerm(parsed.searchTerm);
        if (parsed.sortColumn) setSortColumn(parsed.sortColumn as ColumnKey);
        if (parsed.sortDirection === 'asc' || parsed.sortDirection === 'desc') {
          setSortDirection(parsed.sortDirection);
        }
        if (typeof parsed.pageSize === 'number') setPageSize(parsed.pageSize);
        if (Array.isArray(parsed.filters)) {
          const restored = new Map<string, Set<any>>(
            parsed.filters.map(([key, values]: [string, any[]]) => [key, new Set(values)])
          );
          setFilters(restored);
        }
      } catch (e) {
        console.error('Failed to parse saved filters:', e);
      }
    }
    
    setIsInitialized(true);
    setFiltersInitialized(true);
  }, []);

  useEffect(() => {
    if (!filtersInitialized) return;
    const serialized = {
      searchTerm,
      sortColumn,
      sortDirection,
      pageSize,
      filters: Array.from(filters.entries()).map(([key, set]) => [key, Array.from(set)]),
    };
    localStorage.setItem(filtersStorageKey, JSON.stringify(serialized));
  }, [filtersInitialized, searchTerm, sortColumn, sortDirection, pageSize, filters]);

  // Fetch data after initialization and when date filter changes
  useEffect(() => {
    if (isInitialized) {
      fetchData();
      fetchPayments(); // Also fetch payments for Add Entry dialog
    }
  }, [isInitialized, dateFilterMode, customDate]);

  // Fetch dictionaries for add payment step
  useEffect(() => {
    const fetchDictionaries = async () => {
      try {
        const [projectsRes, counteragentsRes, financialCodesRes, currenciesRes] = await Promise.all([
          fetch('/api/projects'),
          fetch('/api/counteragents'),
          fetch('/api/financial-codes?leafOnly=true'),
          fetch('/api/currencies')
        ]);

        if (projectsRes.ok) {
          const projectsData = await projectsRes.json();
          const list = Array.isArray(projectsData)
            ? projectsData
            : Array.isArray(projectsData?.data)
              ? projectsData.data
              : [];
          setProjects(list);
        }
        if (counteragentsRes.ok) {
          const counteragentsData = await counteragentsRes.json();
          setCounteragents(Array.isArray(counteragentsData) ? counteragentsData : []);
        }
        if (financialCodesRes.ok) {
          const financialCodesData = await financialCodesRes.json();
          setFinancialCodes(Array.isArray(financialCodesData) ? financialCodesData : []);
        }
        if (currenciesRes.ok) {
          const currenciesData = await currenciesRes.json();
          const list = Array.isArray(currenciesData)
            ? currenciesData
            : Array.isArray(currenciesData?.data)
              ? currenciesData.data
              : [];
          setCurrencies(list);
        }
      } catch (error) {
        console.error('Error fetching dictionaries:', error);
      }
    };

    fetchDictionaries();
  }, []);

  useEffect(() => {
    const fetchProjectJobs = async () => {
      setSelectedJobUuid('');
      if (!selectedProjectUuid) {
        setJobs([]);
        return;
      }

      try {
        const response = await fetch(`/api/jobs?projectUuid=${selectedProjectUuid}`);
        if (!response.ok) throw new Error('Failed to fetch project jobs');
        const data = await response.json();
        setJobs(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching project jobs:', error);
        setJobs([]);
      }
    };

    fetchProjectJobs();
  }, [selectedProjectUuid]);

  // Manual refresh handler
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchData();
      await fetchPayments();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500); // Keep spinning for visual feedback
    }
  };

  // Save column configuration to localStorage whenever it changes (but not on initial load)
  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
      localStorage.setItem('paymentsReportColumns', JSON.stringify(columns));
    }
  }, [columns, isInitialized]);

  // Save date filter settings to localStorage whenever they change
  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
      localStorage.setItem('paymentsReportDateFilter', JSON.stringify({
        mode: dateFilterMode,
        date: customDate
      }));
    }
  }, [dateFilterMode, customDate, isInitialized]);

  // Save conditions filter to localStorage
  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
      localStorage.setItem('paymentsReportConditions', JSON.stringify(Array.from(selectedConditions)));
    }
  }, [selectedConditions, isInitialized]);

  // Column resize handlers - optimized to avoid re-renders during drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const deltaX = e.clientX - isResizing.startX;
        const newWidth = Math.max(20, isResizing.startWidth + deltaX); // Minimum 20px to keep resize handle visible
        
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
        setColumns(prev =>
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

  // Column drag handlers for reordering
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

    setColumns(prev => {
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

  const fetchPayments = async () => {
    try {
      const response = await fetch('/api/payments?limit=5000&sort=desc');
      if (!response.ok) throw new Error('Failed to fetch payments');
      const data = await response.json();
      if (!Array.isArray(data)) {
        console.warn('[Payments Report] Expected payments array, received:', data);
        setPayments([]);
        return;
      }
      setPayments(data.map((p: any) => ({
        paymentId: p.paymentId,
        counteragentName: p.counteragentName,
        projectIndex: p.projectIndex,
        projectName: p.projectName,
        jobName: p.jobName,
        financialCode: p.financialCode,
        incomeTax: p.incomeTax,
        currencyCode: p.currencyCode
      })));
    } catch (error) {
      console.error('Error fetching payments:', error);
    }
  };

  const handleAddEntry = async () => {
    if (isSubmitting) return; // Prevent double submission
    
    if (!selectedPaymentId) {
      alert('Please select a payment');
      return;
    }

    const accrualValue = accrual ? parseFloat(accrual) : null;
    const orderValue = order ? parseFloat(order) : null;

    if ((!accrualValue || accrualValue === 0) && (!orderValue || orderValue === 0)) {
      alert('Either Accrual or Order must be provided and cannot be zero');
      return;
    }

    // Convert dd.mm.yyyy to ISO format (yyyy-mm-dd) if provided
    let isoDate: string | undefined = undefined;
    if (effectiveDate) {
      const datePattern = /^(\d{2})\.(\d{2})\.(\d{4})$/;
      const match = effectiveDate.match(datePattern);
      if (match) {
        const [, day, month, year] = match;
        isoDate = `${year}-${month}-${day}`;
      } else {
        alert('Please enter date in dd.mm.yyyy format (e.g., 07.01.2026)');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/payments-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: selectedPaymentId,
          effectiveDate: isoDate,
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
      fetchData(); // Refresh the report data to show updated values
    } catch (error: any) {
      console.error('Error adding ledger entry:', error);
      alert(error.message || 'Failed to add ledger entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedPaymentId('');
    setPreSelectedPaymentId(null);
    setSelectedPaymentDetails(null);
    setEffectiveDate('');
    setAccrual('');
    setOrder('');
    setComment('');
    setIsSubmitting(false);
    setAddLedgerStep('payment');
    setSelectedCounteragentUuid('');
    setSelectedProjectUuid('');
    setSelectedFinancialCodeUuid('');
    setSelectedJobUuid('');
    setSelectedCurrencyUuid('');
    setSelectedIncomeTax(false);
    setIsCreatingPayment(false);
  };

  const handleCreatePayment = async () => {
    if (!selectedCounteragentUuid || !selectedFinancialCodeUuid || !selectedCurrencyUuid) {
      alert('Please fill Counteragent, Financial Code, and Currency');
      return;
    }

    setIsCreatingPayment(true);
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counteragentUuid: selectedCounteragentUuid,
          projectUuid: selectedProjectUuid || null,
          financialCodeUuid: selectedFinancialCodeUuid,
          jobUuid: selectedJobUuid || null,
          incomeTax: selectedIncomeTax,
          currencyUuid: selectedCurrencyUuid
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create payment');
      }

      const result = await response.json();
      const newPaymentId = result?.data?.payment_id || result?.data?.paymentId;

      if (!newPaymentId) {
        throw new Error('Payment ID not returned from server');
      }

      const counteragent = counteragents.find(ca => (ca.counteragent_uuid || ca.counteragentUuid) === selectedCounteragentUuid);
      const project = projects.find(p => p.projectUuid === selectedProjectUuid);
      const job = jobs.find(j => j.jobUuid === selectedJobUuid);
      const financialCode = financialCodes.find(fc => fc.uuid === selectedFinancialCodeUuid);
      const currency = currencies.find(c => c.uuid === selectedCurrencyUuid);

      setPreSelectedPaymentId(newPaymentId);
      setSelectedPaymentId(newPaymentId);
      setSelectedPaymentDetails({
        paymentId: newPaymentId,
        counteragent: counteragent?.name || 'N/A',
        project: project?.projectIndex || project?.projectName || 'N/A',
        job: job?.jobDisplay || job?.jobName || 'N/A',
        financialCode: financialCode?.validation || financialCode?.code || 'N/A',
        incomeTax: selectedIncomeTax,
        currency: currency?.code || 'N/A'
      });

      await fetchPayments();
      setAddLedgerStep('ledger');
    } catch (error: any) {
      console.error('Error creating payment:', error);
      alert(error.message || 'Failed to create payment');
    } finally {
      setIsCreatingPayment(false);
    }
  };

  const handleSkipToLedger = () => {
    setAddLedgerStep('ledger');
  };

  const openDialogForPayment = (paymentId: string) => {
    const payment = payments.find(p => p.paymentId === paymentId);
    if (payment) {
      setPreSelectedPaymentId(paymentId);
      setSelectedPaymentId(paymentId);
      setSelectedPaymentDetails({
        paymentId: payment.paymentId,
        counteragent: payment.counteragentName || 'N/A',
        project: payment.projectIndex || 'N/A',
        job: payment.jobName || 'N/A',
        financialCode: payment.financialCode || 'N/A',
        incomeTax: payment.incomeTax || false,
        currency: payment.currencyCode || 'N/A'
      });
    }
    setAddLedgerStep('ledger');
    setIsDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      resetForm();
    } else {
      setAddLedgerStep('payment');
    }
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Build query params for date filter
      const params = new URLSearchParams();
      if (dateFilterMode === 'today') {
        const today = new Date().toISOString().split('T')[0];
        params.set('maxDate', today);
        console.log('[Payments Report] Filtering by today:', today);
      } else if (dateFilterMode === 'custom' && customDate) {
        const isValidDateString = /^\d{4}-\d{2}-\d{2}$/.test(customDate);
        const today = new Date().toISOString().split('T')[0];
        if (isValidDateString && customDate <= today) {
          params.set('maxDate', customDate);
          console.log('[Payments Report] Filtering by custom date:', customDate);
        } else {
          console.warn('[Payments Report] Ignoring invalid custom date filter:', customDate);
        }
      } else {
        console.log('[Payments Report] No date filter applied');
      }
      
      const url = `/api/payments-report${params.toString() ? '?' + params.toString() : ''}`;
      console.log('[Payments Report] Fetching from:', url);
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch report data');
      const result = await response.json();
      if (!Array.isArray(result)) {
        console.warn('[Payments Report] Expected array response, received:', result);
        setData([]);
      } else {
        console.log('[Payments Report] Received', result.length, 'records');
        setData(result);
      }
      
      // Always set default sort to latestDate descending after data loads
      setSortColumn('latestDate');
      setSortDirection('desc');
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  }, [dateFilterMode, customDate]);

  // Listen for ledger updates from other tabs
  useEffect(() => {
    if (broadcastChannel) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'ledger-updated') {
          console.log('[Payments Report] Ledger updated in another tab, refreshing data...');
          // Refresh the report to show updated values
          fetchData();
        }
      };

      broadcastChannel.addEventListener('message', handleMessage);

      return () => {
        broadcastChannel.removeEventListener('message', handleMessage);
        broadcastChannel.close();
      };
    }
  }, [broadcastChannel, fetchData]);

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

  const applySearchFilter = useCallback((rows: PaymentReport[]) => {
    if (!searchTerm) return rows;
    return rows.filter(row =>
      Object.values(row).some(val =>
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [searchTerm]);

  const applyColumnFilters = useCallback((rows: PaymentReport[], excludeColumn?: ColumnKey) => {
    if (filters.size === 0) return rows;
    return rows.filter(row => {
      for (const [columnKey, allowedValues] of filters.entries()) {
        if (excludeColumn && columnKey === excludeColumn) continue;
        const rowValue = row[columnKey as ColumnKey];
        if (!allowedValues.has(rowValue)) {
          return false;
        }
      }
      return true;
    });
  }, [filters]);

  const applyConditionsFilter = useCallback((rows: PaymentReport[]) => {
    if (selectedConditions.size === 0 || selectedConditions.has('ALL')) return rows;

    return rows.filter(row => {
      for (const condition of selectedConditions) {
        let matches = false;

        switch (condition) {
          case 'Accrual>0':
            matches = row.accrual > 0;
            break;
          case 'Accrual<0':
            matches = row.accrual < 0;
            break;
          case 'Accrual=0':
            matches = row.accrual === 0;
            break;
          case 'Order>0':
            matches = row.order > 0;
            break;
          case 'Order<0':
            matches = row.order < 0;
            break;
          case 'Order=0':
            matches = row.order === 0;
            break;
          case 'Paid>0':
            matches = row.payment > 0;
            break;
          case 'Paid<0':
            matches = row.payment < 0;
            break;
          case 'Paid=0':
            matches = row.payment === 0;
            break;
          case 'Due>0':
            matches = row.due > 0;
            break;
          case 'Due<0':
            matches = row.due < 0;
            break;
          case 'Due=0':
            matches = row.due === 0;
            break;
          case 'Balance>0':
            matches = row.balance > 0;
            break;
          case 'Balance<0':
            matches = row.balance < 0;
            break;
          case 'Balance=0':
            matches = row.balance === 0;
            break;
          case 'Current Due>0':
            matches = row.due > 0;
            break;
          case 'Current Due<0':
            matches = row.due < 0;
            break;
          case 'Current Due=0':
            matches = row.due === 0;
            break;
        }

        if (matches) return true;
      }
      return false;
    });
  }, [selectedConditions]);

  const getFacetBaseData = useCallback((excludeColumn?: ColumnKey) => {
    let result = [...data];
    result = applySearchFilter(result);
    result = applyColumnFilters(result, excludeColumn);
    result = applyConditionsFilter(result);
    return result;
  }, [data, applySearchFilter, applyColumnFilters, applyConditionsFilter]);

  const filteredAndSortedData = useMemo(() => {
    let result = getFacetBaseData();

    // Apply sort
    result.sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      
      if (aVal === bVal) return 0;
      
      // Special handling for date columns
      const columnConfig = columns.find(col => col.key === sortColumn);
      if (columnConfig?.format === 'date') {
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
  }, [getFacetBaseData, sortColumn, sortDirection]);

  // Paginate data to limit DOM nodes
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredAndSortedData.slice(startIndex, endIndex);
  }, [filteredAndSortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredAndSortedData.length / pageSize);

  // Reset to page 1 when filters/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters]);

  // Memoize unique values to avoid recalculating on every render
  const uniqueValuesCache = useMemo(() => {
    const cache = new Map<ColumnKey, any[]>();
    const filterableColumns = columns.filter(col => col.filterable);

    filterableColumns.forEach(col => {
      const baseData = getFacetBaseData(col.key);
      const values = new Set(baseData.map(row => row[col.key]));
      cache.set(col.key, Array.from(values).sort());
    });

    return cache;
  }, [columns, getFacetBaseData]);

  const getUniqueValues = useCallback((columnKey: ColumnKey): any[] => {
    return uniqueValuesCache.get(columnKey) || [];
  }, [uniqueValuesCache]);

  const formatValue = (
    value: any,
    format?: 'currency' | 'number' | 'boolean' | 'date' | 'percent',
    columnKey?: ColumnKey
  ) => {
    if (value === null || value === undefined) return '-';
    
    if (format === 'boolean') {
      return (
        <Checkbox
          checked={value}
          disabled
          className="cursor-default"
        />
      );
    }
    
    if (format === 'date') {
      if (!value) return '-';
      const date = new Date(value);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}.${month}.${year}`;
    }
    
    if (format === 'percent') {
      return `${Number(value).toFixed(2)}%`;
    }
    
    if (format === 'currency' || format === 'number') {
      const numericValue = Number(value);
      const shouldKeepSign = columnKey === 'due' || columnKey === 'balance';
      const displayValue = shouldKeepSign ? numericValue : Math.abs(numericValue);
      return displayValue.toLocaleString('en-US', {
        minimumFractionDigits: format === 'currency' ? 2 : 0,
        maximumFractionDigits: 2,
      });
    }
    
    return String(value);
  };

  const sanitizeRecipientName = (name: string) => {
    return name
      .replace(/\s*\(\s*ს\.კ\.[^)]*\)\s*/g, ' ')
      .replace(/\s*-\s*ფიზ\.\s*პირი\s*/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  const buildPaymentDescription = (template: string | null | undefined, row: PaymentReport) => {
    const variables = {
      project: row.projectName || row.project || '',
      job_no: row.job || '',
      job_name: row.job || '',
      job: row.job || ''
    } as const;

    if (!template) return '';
    const raw = template.trim();
    if (!raw) return '';

    const parts = raw.split('+').map((part) => part.trim()).filter(Boolean);
    const renderPart = (part: string) => {
      let value = part;
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      return value
        .replace(/@project/gi, variables.project)
        .replace(/@job_no/gi, variables.job_no)
        .replace(/@job_name/gi, variables.job_name)
        .replace(/@jobno/gi, variables.job_no)
        .replace(/@job/gi, variables.job);
    };

    if (parts.length === 0) return '';
    if (parts.length === 1) return renderPart(parts[0]);
    return parts.map(renderPart).join('');
  };

  const handleToggleSelect = (paymentId: string) => {
    setSelectedPaymentIds((prev) => {
      const next = new Set(prev);
      if (next.has(paymentId)) {
        next.delete(paymentId);
      } else {
        next.add(paymentId);
      }
      return next;
    });
  };

  const handleToggleSelectAll = (paymentIds: string[]) => {
    setSelectedPaymentIds((prev) => {
      const next = new Set(prev);
      const allSelected = paymentIds.length > 0 && paymentIds.every((id) => next.has(id));
      if (allSelected) {
        paymentIds.forEach((id) => next.delete(id));
      } else {
        paymentIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleBulkAddAO = async () => {
    if (selectedPaymentIds.size === 0) return;

    const selectedRows = data.filter((row) => selectedPaymentIds.has(row.paymentId));
    if (selectedRows.length === 0) return;

    const missingDate = selectedRows.filter((row) => !row.latestDate);
    if (missingDate.length > 0) {
      alert('Some selected payments are missing a date. Please deselect them or set a date.');
      return;
    }

    const entries = selectedRows.map((row) => ({
      paymentId: row.paymentId,
      effectiveDate: row.latestDate,
      accrual: row.accrual,
      order: row.order,
      comment: 'Bulk A&O from payments report',
    }));

    setIsBulkSubmitting(true);
    try {
      const response = await fetch('/api/payments-ledger/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create bulk ledger entries');
      }

      setSelectedPaymentIds(new Set());
      if (broadcastChannel) {
        broadcastChannel.postMessage({ type: 'ledger-updated' });
      }
      fetchData();
    } catch (error: any) {
      console.error('Error creating bulk ledger entries:', error);
      alert(error.message || 'Failed to create bulk ledger entries');
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  const fetchExchangeRate = async (currency: string, date: string) => {
    if (currency.toUpperCase() === 'GEL') return 1;

    const rateResponse = await fetch(`/api/exchange-rates?date=${date}&currency=${currency}`);
    if (rateResponse.ok) {
      const rateData = await rateResponse.json();
      if (rateData?.rate) return Number(rateData.rate);
    }

    const updateResponse = await fetch('/api/exchange-rates/update', { method: 'POST' });
    if (!updateResponse.ok) {
      throw new Error('Failed to update exchange rates');
    }

    const retryResponse = await fetch(`/api/exchange-rates?date=${date}&currency=${currency}`);
    if (!retryResponse.ok) {
      throw new Error('Failed to fetch exchange rate after update');
    }
    const retryData = await retryResponse.json();
    if (!retryData?.rate) {
      throw new Error('Exchange rate not available');
    }
    return Number(retryData.rate);
  };

  const getTbilisiToday = () => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tbilisi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  };

  const calculateExportAmount = async (row: PaymentReport) => {
    const due = Number(row.due || 0);
    const currency = (row.currency || 'GEL').toUpperCase();
    if (currency === 'GEL') return Math.round(due * 100) / 100;

    const rateDate = getTbilisiToday();
    const rate = await fetchExchangeRate(currency, rateDate);
    const converted = due / (1 / rate);
    return Math.round(converted * 100) / 100;
  };

  const handleDownloadBankXlsx = async () => {
    const selectedRecords = filteredAndSortedData.filter((row) => selectedPaymentIds.has(row.paymentId));
    if (selectedRecords.length === 0) {
      alert('No records selected');
      return;
    }

    setIsBankExporting(true);

    const headers = [
      'გამგზავნის ანგარიშის ნომერი',
      'დოკუმენტის ნომერი',
      'მიმღები ბანკის კოდი(არასავალდებულო)',
      'მიმღების ანგარიშის ნომერი',
      'მიმღების დასახელება',
      'მიმღების საიდენტიფიკაციო კოდი',
      'დანიშნულება',
      'თანხა',
      'ხელფასი',
      'გადარიცხვის მეთოდი',
      'დამატებითი ინფორმაცია',
    ];

    try {
      const rows = await Promise.all(
        selectedRecords.map(async (record) => {
          const description = buildPaymentDescription(record.financialCodeDescription, record);
          const amount = await calculateExportAmount(record);
          return [
            'GE78BG0000000893486000',
            '',
            '',
            record.counteragentIban || '',
            sanitizeRecipientName(record.counteragent || ''),
            record.counteragentId || '',
            description || 'გადახდა',
            amount,
            '',
            '',
            record.paymentId || '',
          ];
        })
      );

      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      XLSX.writeFile(workbook, 'Payments Bank XLSX.xlsx');
    } catch (error: any) {
      console.error('Failed to generate bank XLSX:', error);
      alert(error.message || 'Failed to generate bank XLSX');
    } finally {
      setIsBankExporting(false);
    }
  };

  const handleOpenBaseInfo = async (paymentId: string) => {
    setIsBaseInfoOpen(true);
    setBaseInfoLoading(true);
    setBaseInfoError(null);
    setBaseInfo(null);
    try {
      const response = await fetch(`/api/payment-statement?paymentId=${encodeURIComponent(paymentId)}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to load payment info');
      }
      const result = await response.json();
      setBaseInfo(result?.payment || null);
    } catch (error: any) {
      setBaseInfoError(error.message || 'Failed to load payment info');
    } finally {
      setBaseInfoLoading(false);
    }
  };

  const handleExportXlsx = () => {
    const rows = filteredAndSortedData.map((row) => {
      const out: Record<string, any> = {};
      visibleColumns.forEach((col) => {
        out[col.label] = row[col.key];
      });
      return out;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Payments Report');
    XLSX.writeFile(workbook, `payments_report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const visibleColumns = columns.filter(col => col.visible);
  const activeFilterCount = filters.size;
  const filteredPaymentIds = filteredAndSortedData.map((row) => row.paymentId);
  const allFilteredSelected =
    filteredPaymentIds.length > 0 && filteredPaymentIds.every((id) => selectedPaymentIds.has(id));

  // Calculate totals
  const totals = useMemo(() => {
    const sums = filteredAndSortedData.reduce((acc, row) => ({
      accrual: acc.accrual + row.accrual,
      order: acc.order + row.order,
      payment: acc.payment + row.payment,
      due: acc.due + row.due,
      balance: acc.balance + row.balance,
      floors: acc.floors + row.floors,
    }), { accrual: 0, order: 0, payment: 0, due: 0, balance: 0, floors: 0 });
    
    // Calculate overall paid percentage
    const paidPercent = sums.accrual !== 0 ? (sums.payment / sums.accrual) * 100 : 0;
    
    return { ...sums, paidPercent };
  }, [filteredAndSortedData]);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-20 flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Payments Report</h1>
            <Badge variant="secondary">
              {filteredAndSortedData.length} records
            </Badge>
            {totalPages > 1 && (
              <span className="text-sm text-gray-500">
                Page {currentPage} of {totalPages}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportXlsx}>
              Export XLSX
            </Button>
            {selectedPaymentIds.size > 0 && (
              <Button variant="outline" onClick={handleDownloadBankXlsx} disabled={isBankExporting}>
                {isBankExporting ? 'Preparing...' : 'Bank XLSX'}
              </Button>
            )}
            {selectedPaymentIds.size > 0 && (
              <Button variant="default" onClick={handleBulkAddAO} disabled={isBulkSubmitting}>
                {isBulkSubmitting ? 'Adding...' : '+A&O'}
              </Button>
            )}
            {/* Add Entry Button */}
            <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
              <DialogTrigger asChild>
                <Button variant="default">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Ledger
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[80%] max-w-6xl">
                <DialogHeader>
                  <DialogTitle>
                    {addLedgerStep === 'payment' ? 'Add Payment' : 'Add Ledger Entry'}
                  </DialogTitle>
                  <DialogDescription>
                    {addLedgerStep === 'payment'
                      ? 'Create a payment first, or skip to add a ledger entry to an existing payment.'
                      : 'Add a new entry to the payments ledger.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {addLedgerStep === 'payment' ? (
                    <>
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                        Create a payment first, or skip to add a ledger entry to an existing payment.
                      </div>

                      <div className="space-y-2">
                        <Label>Counteragent <span className="text-red-500">*</span></Label>
                        <Combobox
                          value={selectedCounteragentUuid}
                          onValueChange={setSelectedCounteragentUuid}
                          options={counteragents
                            .map(ca => {
                              const value = ca.counteragent_uuid || ca.counteragentUuid || '';
                              const labelBase = ca.counteragent || '';
                              if (!value || !labelBase) return null;
                              return {
                                value,
                                label: labelBase
                              };
                            })
                            .filter((opt): opt is { value: string; label: string } => Boolean(opt))}
                          placeholder="Select counteragent..."
                          searchPlaceholder="Search counteragents..."
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className={!selectedCounteragentUuid ? 'text-muted-foreground' : ''}>
                          Financial Code <span className="text-red-500">*</span>
                        </Label>
                        <Combobox
                          value={selectedFinancialCodeUuid}
                          onValueChange={setSelectedFinancialCodeUuid}
                          options={financialCodes.map(fc => ({
                            value: fc.uuid,
                            label: fc.validation
                          }))}
                          placeholder="Select financial code..."
                          searchPlaceholder="Search financial codes..."
                          disabled={!selectedCounteragentUuid}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className={!selectedFinancialCodeUuid ? 'text-muted-foreground' : ''}>
                          Currency <span className="text-red-500">*</span>
                        </Label>
                        <Combobox
                          value={selectedCurrencyUuid}
                          onValueChange={setSelectedCurrencyUuid}
                          options={currencies.map(c => ({
                            value: c.uuid,
                            label: c.code
                          }))}
                          placeholder="Select currency..."
                          searchPlaceholder="Search currencies..."
                          disabled={!selectedFinancialCodeUuid}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedIncomeTax}
                          onCheckedChange={(checked) => setSelectedIncomeTax(checked as boolean)}
                        />
                        <Label>Income Tax</Label>
                      </div>

                      <div className="space-y-2">
                        <Label className={!selectedCurrencyUuid ? 'text-muted-foreground' : ''}>Project (Optional)</Label>
                        <Combobox
                          value={selectedProjectUuid}
                          onValueChange={setSelectedProjectUuid}
                          options={projects
                            .map(p => {
                              const value = p.projectUuid || p.project_uuid || '';
                              const label = p.projectIndex || p.project_index || p.projectName || p.project_name || '';
                              if (!value || !label) return null;
                              return { value, label };
                            })
                            .filter((opt): opt is { value: string; label: string } => Boolean(opt))}
                          placeholder="Select project..."
                          searchPlaceholder="Search projects..."
                          disabled={!selectedCurrencyUuid}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className={!selectedProjectUuid ? 'text-muted-foreground' : ''}>Job (Optional)</Label>
                        <Combobox
                          value={selectedJobUuid}
                          onValueChange={setSelectedJobUuid}
                          options={jobs.map(job => ({
                            value: job.jobUuid,
                            label: job.jobDisplay || job.jobName
                          }))}
                          placeholder="Select job..."
                          searchPlaceholder="Search jobs..."
                          disabled={!selectedProjectUuid}
                        />
                      </div>

                      <div className="flex gap-3 pt-2">
                        <Button
                          onClick={handleCreatePayment}
                          className="flex-1"
                          disabled={isCreatingPayment || !selectedCounteragentUuid || !selectedFinancialCodeUuid || !selectedCurrencyUuid}
                        >
                          {isCreatingPayment ? 'Creating...' : 'Create Payment & Continue'}
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={handleSkipToLedger}
                        >
                          Skip - Use Existing Payment
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      {preSelectedPaymentId && selectedPaymentDetails ? (
                        // Show payment details as read-only form fields
                        <div className="space-y-4">
                          <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Payment Details</h3>
                            
                            <div className="grid grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs text-gray-600">Payment ID</Label>
                                <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                                  <span className="font-bold" style={{ color: '#000' }}>{selectedPaymentDetails.paymentId}</span>
                                </div>
                              </div>
                              
                              <div className="space-y-1">
                                <Label className="text-xs text-gray-600">Currency</Label>
                                <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                                  <span className="font-bold" style={{ color: '#000' }}>{selectedPaymentDetails.currency}</span>
                                </div>
                              </div>
                              
                              <div className="space-y-1">
                                <Label className="text-xs text-gray-600">Income Tax</Label>
                                <div className="flex items-center h-9 px-3 border-2 border-gray-300 rounded-md bg-gray-100">
                                  <Checkbox checked={selectedPaymentDetails.incomeTax} disabled />
                                  <span className="ml-2 text-sm font-bold" style={{ color: '#000' }}>{selectedPaymentDetails.incomeTax ? 'Yes' : 'No'}</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-600">Counteragent</Label>
                              <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                                <span className="font-bold" style={{ color: '#000' }}>{selectedPaymentDetails.counteragent}</span>
                              </div>
                            </div>
                            
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-600">Project</Label>
                              <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                                <span className="font-bold" style={{ color: '#000' }}>{selectedPaymentDetails.project}</span>
                              </div>
                            </div>
                            
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-600">Job</Label>
                              <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                                <span className="font-bold" style={{ color: '#000' }}>{selectedPaymentDetails.job}</span>
                              </div>
                            </div>
                            
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-600">Financial Code</Label>
                              <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                                <span className="font-bold" style={{ color: '#000' }}>{selectedPaymentDetails.financialCode}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Show payment selection dropdown
                        <div className="space-y-2">
                          <Label>Payment</Label>
                          <Combobox
                            value={selectedPaymentId}
                            onValueChange={(value) => {
                              setSelectedPaymentId(value);
                              const payment = payments.find(p => p.paymentId === value);
                              if (payment) {
                                setSelectedPaymentDetails({
                                  paymentId: payment.paymentId,
                                  counteragent: payment.counteragentName || 'N/A',
                                  project: payment.projectIndex || 'N/A',
                                  job: payment.jobName || 'N/A',
                                  financialCode: payment.financialCode || 'N/A',
                                  incomeTax: payment.incomeTax || false,
                                  currency: payment.currencyCode || 'N/A'
                                });
                              }
                            }}
                            filter={(value, search) => {
                              // Custom regex-based filter
                              if (!search) return 1;
                              try {
                                const regex = new RegExp(search, 'i');
                                return regex.test(value) ? 1 : 0;
                              } catch {
                                // If invalid regex, fall back to case-insensitive includes
                                return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                              }
                            }}
                            options={payments.map(p => {
                              // Build label: PaymentID | Counteragent | ProjectName | [JobName |] FinancialCode | Currency
                              const parts = [p.paymentId];
                              if (p.counteragentName) parts.push(p.counteragentName);
                              if (p.projectName) parts.push(p.projectName);
                              if (p.jobName) parts.push(p.jobName);
                              if (p.financialCode) parts.push(p.financialCode);
                              if (p.currencyCode) parts.push(p.currencyCode);
                              
                              const fullLabel = parts.join(' | ');
                              
                              const searchKeywords = [
                                p.paymentId,
                                p.counteragentName || '',
                                p.projectName || '',
                                p.jobName || '',
                                p.financialCode || '',
                                p.currencyCode || ''
                              ].filter(Boolean).join(' ');
                              
                              return {
                                value: p.paymentId,
                                label: fullLabel,
                                displayLabel: fullLabel,
                                keywords: searchKeywords
                              };
                            })}
                            placeholder="Select payment..."
                            searchPlaceholder="Search by payment ID, project, job..."
                          />
                        </div>
                      )}

                  <div className="space-y-2">
                    <Label>Effective Date</Label>
                    <div className="relative flex gap-2">
                      <Input
                        type="text"
                        value={effectiveDate}
                        onChange={(e) => {
                          // Allow only numbers and dots
                          let value = e.target.value.replace(/[^\d.]/g, '');
                          
                          // Auto-add dots after day and month
                          if (value.length === 2 && !value.includes('.')) {
                            value = value + '.';
                          } else if (value.length === 5 && value.split('.').length === 2) {
                            value = value + '.';
                          }
                          
                          // Limit to dd.mm.yyyy format (10 chars)
                          if (value.length <= 10) {
                            setEffectiveDate(value);
                          }
                        }}
                        placeholder="dd.mm.yyyy"
                        maxLength={10}
                        className="border-2 border-gray-400 flex-1"
                      />
                      <input
                        type="date"
                        onChange={(e) => {
                          if (e.target.value) {
                            // Convert yyyy-mm-dd to dd.mm.yyyy
                            const [year, month, day] = e.target.value.split('-');
                            setEffectiveDate(`${day}.${month}.${year}`);
                          }
                        }}
                        className="border-2 border-gray-400 rounded-md px-3 cursor-pointer w-12 flex-shrink-0"
                        title="Pick date from calendar"
                      />
                    </div>
                    <p className="text-xs text-gray-500">Optional. Defaults to today if not set. Format: dd.mm.yyyy (e.g., 07.01.2026)</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Amount <span className="text-red-500">*</span></Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-600 mb-1 block">Accrual</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={accrual}
                          onChange={(e) => setAccrual(e.target.value)}
                          placeholder="0.00"
                          className="border-[3px] border-gray-400 focus-visible:border-blue-500"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-600 mb-1 block">Order</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={order}
                          onChange={(e) => setOrder(e.target.value)}
                          placeholder="0.00"
                          className="border-[3px] border-gray-400 focus-visible:border-blue-500"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">Enter at least one amount (Accrual or Order).</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Comment</Label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Optional notes or description"
                      className="flex min-h-[240px] w-full rounded-md border-[3px] border-gray-400 bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      rows={10}
                    />
                  </div>

                  <Button 
                    onClick={handleAddEntry} 
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Creating...' : 'Create Entry'}
                  </Button>
                </>
                  )}
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
            {filteredAndSortedData.length > 0 && (
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
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                    <option value={500}>500</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 border-l pl-2">
                  <span className="text-sm text-gray-600">
                    {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, filteredAndSortedData.length)} of {filteredAndSortedData.length}
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
                  <Filter className="w-4 h-4" />
                  Conditions
                  {!selectedConditions.has('ALL') && (
                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                      {selectedConditions.size}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 max-h-[500px] overflow-y-auto">
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Filter by Conditions</h4>
                  
                  <div className="space-y-2">
                    {allConditions.map(condition => (
                      <div key={condition} className="flex items-center space-x-2">
                        <Checkbox
                          id={`condition-${condition}`}
                          checked={selectedConditions.has(condition)}
                          onCheckedChange={(checked) => {
                            setSelectedConditions(prev => {
                              const next = new Set(prev);
                              if (checked) {
                                next.add(condition);
                                // If ALL is selected, select all conditions
                                if (condition === 'ALL') {
                                  allConditions.forEach(c => next.add(c));
                                }
                              } else {
                                next.delete(condition);
                                // If any condition is unselected, unselect ALL
                                if (condition !== 'ALL') {
                                  next.delete('ALL');
                                } else {
                                  // If ALL is unselected, unselect everything
                                  next.clear();
                                }
                              }
                              return next;
                            });
                          }}
                        />
                        <label 
                          htmlFor={`condition-${condition}`} 
                          className="text-sm cursor-pointer flex-1"
                        >
                          {condition}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="w-4 h-4" />
                  Date Filter
                  {dateFilterMode !== 'none' && (
                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                      {dateFilterMode === 'today' ? 'Today' : 'Custom'}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Filter by Latest Date</h4>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="date-none"
                        name="dateFilter"
                        checked={dateFilterMode === 'none'}
                        onChange={() => setDateFilterMode('none')}
                        className="cursor-pointer"
                      />
                      <label htmlFor="date-none" className="text-sm cursor-pointer flex-1">
                        None (All records)
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="date-today"
                        name="dateFilter"
                        checked={dateFilterMode === 'today'}
                        onChange={() => setDateFilterMode('today')}
                        className="cursor-pointer"
                      />
                      <label htmlFor="date-today" className="text-sm cursor-pointer flex-1">
                        Today ({new Date().toLocaleDateString()})
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="date-custom"
                        name="dateFilter"
                        checked={dateFilterMode === 'custom'}
                        onChange={() => setDateFilterMode('custom')}
                        className="cursor-pointer"
                      />
                      <label htmlFor="date-custom" className="text-sm cursor-pointer flex-1">
                        Custom Date
                      </label>
                    </div>

                    {dateFilterMode === 'custom' && (
                      <div className="ml-6">
                        <Input
                          type="date"
                          value={customDate}
                          onChange={(e) => setCustomDate(e.target.value)}
                          className="w-full text-sm"
                          max={new Date().toISOString().split('T')[0]}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Show records with latest date ≤ selected date
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              title="Refresh data"
            >
              <span className={isRefreshing ? "animate-spin" : ""}>🔄</span>
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>

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
      <div className="sticky top-[60px] z-20 flex-shrink-0 bg-blue-50 border-b border-blue-200 px-4 py-2 border-t border-t-gray-200">
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-gray-600">Total Accrual:</span>
            <span className="ml-2 font-semibold text-blue-900">
              {formatValue(totals.accrual, 'currency', 'accrual')}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Total Order:</span>
            <span className="ml-2 font-semibold text-blue-900">
              {formatValue(totals.order, 'currency', 'order')}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Total Payment:</span>
            <span className="ml-2 font-semibold text-blue-900">
              {formatValue(totals.payment, 'currency', 'payment')}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Paid %:</span>
            <span className="ml-2 font-semibold text-blue-900">
              {formatValue(totals.paidPercent, 'percent', 'paidPercent')}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Total Due:</span>
            <span className="ml-2 font-semibold text-blue-900">
              {formatValue(totals.due, 'currency', 'due')}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Total Balance:</span>
            <span className="ml-2 font-semibold text-blue-900">
              {formatValue(totals.balance, 'currency', 'balance')}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Total Floors:</span>
            <span className="ml-2 font-semibold text-blue-900">
              {formatValue(totals.floors, 'number', 'floors')}
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 p-4 overflow-hidden">
        <div className="h-full overflow-auto rounded-lg border bg-white">
          <table style={{ tableLayout: 'fixed', width: '100%' }} className="border-collapse">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b-2 border-gray-200">
                <th
                  className="sticky top-0 left-0 z-20 bg-white px-2 py-3 text-center text-sm font-semibold border-b-2 border-gray-200"
                  style={{ width: 60, minWidth: 60, maxWidth: 60 }}
                >
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={() => handleToggleSelectAll(filteredPaymentIds)}
                    />
                  </div>
                </th>
                {visibleColumns.map(col => {
                  // Column background colors
                  let bgColor = '';
                  if (col.key === 'accrual') bgColor = '#ffebee'; // Light red
                  if (col.key === 'payment') bgColor = '#e8f5e9'; // Light green
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
                <td colSpan={visibleColumns.length + 2} className="text-center py-8 px-4">
                  Loading...
                </td>
              </tr>
            ) : filteredAndSortedData.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + 2} className="text-center py-8 px-4 text-gray-500">
                  No records found
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => (
                <tr key={`${row.paymentId}-${idx}`} className="group border-b border-gray-200 hover:bg-gray-50">
                  <td
                    className="sticky left-0 z-10 bg-white px-2 py-2 text-sm group-hover:bg-gray-50"
                    style={{ width: 60, minWidth: 60, maxWidth: 60 }}
                  >
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={selectedPaymentIds.has(row.paymentId)}
                        onCheckedChange={() => handleToggleSelect(row.paymentId)}
                      />
                    </div>
                  </td>
                  {visibleColumns.map(col => {
                    // Column background colors
                    let bgColor = '';
                    if (col.key === 'accrual') bgColor = '#ffebee'; // Light red
                    if (col.key === 'payment') bgColor = '#e8f5e9'; // Light green
                    if (col.key === 'order') bgColor = '#fff9e6'; // Light yellow
                    const isFlaggedCounteragent =
                      col.key === 'counteragent' &&
                      counteragentsWithNegativeBalance.has(row.counteragent);
                    
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
                      {col.format === 'boolean' ? (
                        <div className="flex items-center">
                          {formatValue(row[col.key], col.format, col.key)}
                        </div>
                      ) : (
                        <div
                          className={`truncate ${
                            isFlaggedCounteragent ? 'font-bold text-red-600' : ''
                          }`}
                        >
                          {formatValue(row[col.key], col.format, col.key)}
                        </div>
                      )}
                    </td>
                    );
                  })}
                  <td className="px-4 py-2 text-sm" style={{ width: 80, minWidth: 80, maxWidth: 80 }}>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleOpenBaseInfo(row.paymentId)}
                        className="inline-block text-gray-600 hover:text-gray-800 hover:bg-gray-50 p-1 rounded transition-colors"
                        title="View payment info"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openDialogForPayment(row.paymentId)}
                        className="inline-block text-green-600 hover:text-green-800 hover:bg-green-50 p-1 rounded transition-colors"
                        title="Add ledger entry for this payment"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <a
                        href={`/payment-statement/${row.paymentId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1 rounded transition-colors"
                        title="View statement (opens in new tab)"
                      >
                        <FileText className="w-4 h-4" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
    <Dialog open={isBaseInfoOpen} onOpenChange={setIsBaseInfoOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Payment Base Info</DialogTitle>
          <DialogDescription>Base record details for the selected payment.</DialogDescription>
        </DialogHeader>
        {baseInfoLoading ? (
          <div className="py-6">Loading...</div>
        ) : baseInfoError ? (
          <div className="py-6 text-red-600">{baseInfoError}</div>
        ) : baseInfo ? (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 block">Payment ID</span>
              <span className="font-medium">{baseInfo.paymentId || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Record UUID</span>
              <span className="font-medium">{baseInfo.recordUuid || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Project</span>
              <span className="font-medium">{baseInfo.project || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Counteragent</span>
              <span className="font-medium">{baseInfo.counteragent || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Counteragent ID</span>
              <span className="font-medium">{baseInfo.counteragentId || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Financial Code</span>
              <span className="font-medium">{baseInfo.financialCode || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Job</span>
              <span className="font-medium">{baseInfo.job || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Floors</span>
              <span className="font-medium">{baseInfo.floors ?? '-'}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Currency</span>
              <span className="font-medium">{baseInfo.currency || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Income Tax</span>
              <span className="font-medium">{baseInfo.incomeTax ? 'Yes' : 'No'}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Created At</span>
              <span className="font-medium">{baseInfo.createdAt || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Updated At</span>
              <span className="font-medium">{baseInfo.updatedAt || '-'}</span>
            </div>
          </div>
        ) : (
          <div className="py-6 text-gray-500">No data available</div>
        )}
      </DialogContent>
    </Dialog>
    </div>
  );
}

function FilterPopover({
  columnKey,
  columnLabel,
  values,
  activeFilters,
  onFilterChange,
  onSort,
}: {
  columnKey: string;
  columnLabel: string;
  values: any[];
  activeFilters: Set<any>;
  onFilterChange: (values: Set<any>) => void;
  onSort: (direction: 'asc' | 'desc') => void;
}) {
  const [open, setOpen] = useState(false);
  const [tempSelected, setTempSelected] = useState<Set<any>>(new Set(activeFilters));
  const [filterSearchTerm, setFilterSearchTerm] = useState('');

  // Filter unique values based on search term
  const filteredValues = useMemo(() => {
    if (!filterSearchTerm) return values;
    return values.filter(value => 
      String(value).toLowerCase().includes(filterSearchTerm.toLowerCase())
    );
  }, [values, filterSearchTerm]);

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
    setOpen(open);
    if (open) {
      setTempSelected(new Set(activeFilters));
      setFilterSearchTerm('');
    }
  };

  // Apply filters
  const handleApply = () => {
    onFilterChange(tempSelected);
    setOpen(false);
  };

  // Cancel changes
  const handleCancel = () => {
    setTempSelected(new Set(activeFilters));
    setOpen(false);
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
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-6 px-1 ${activeFilters.size > 0 ? 'text-blue-600' : ''}`}
        >
          <Filter className="h-3 w-3" />
          {activeFilters.size > 0 && (
            <span className="ml-1 text-xs">{activeFilters.size}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-2">
            <div className="font-medium text-sm">{columnLabel}</div>
            <div className="text-xs text-muted-foreground">
              Displaying {filteredValues.length}
            </div>
          </div>

          {/* Sort Options */}
          <div className="space-y-1">
            <button 
              className="w-full text-left text-sm py-1 px-2 hover:bg-muted rounded"
              onClick={() => {
                onSort('asc');
                setOpen(false);
              }}
            >
              Sort A to Z
            </button>
            <button 
              className="w-full text-left text-sm py-1 px-2 hover:bg-muted rounded"
              onClick={() => {
                onSort('desc');
                setOpen(false);
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
                      id={`${columnKey}-${value}`}
                      checked={tempSelected.has(value)}
                      onCheckedChange={() => handleToggle(value)}
                    />
                    <label htmlFor={`${columnKey}-${value}`} className="text-sm flex-1 cursor-pointer">
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
}
