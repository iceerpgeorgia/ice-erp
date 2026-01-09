import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Settings,
  Eye,
  EyeOff,
  Upload,
  Edit2,
  Loader2
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';

export type BankTransaction = {
  id: number;
  uuid: string;
  accountUuid: string;
  accountCurrencyUuid: string;
  accountCurrencyAmount: string;
  paymentUuid: string | null;
  counteragentUuid: string | null;
  projectUuid: string | null;
  financialCodeUuid: string | null;
  nominalCurrencyUuid: string | null;
  nominalAmount: string | null;
  date: string;
  correctionDate: string | null;
  id1: string | null;
  id2: string | null;
  recordUuid: string;
  counteragentAccountNumber: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  
  // Display fields (from joins)
  accountNumber: string | null;
  bankName: string | null;
  counteragentName: string | null;
  projectIndex: string | null;
  financialCode: string | null;
  paymentId: string | null;
  nominalCurrencyCode: string | null;
};

type ColumnKey = keyof BankTransaction;

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
  { key: 'date', label: 'Date', width: 120, visible: true, sortable: true, filterable: true },
  { key: 'accountNumber', label: 'Account', width: 180, visible: true, sortable: true, filterable: true },
  { key: 'bankName', label: 'Bank', width: 150, visible: true, sortable: true, filterable: true },
  { key: 'accountCurrencyAmount', label: 'Amount', width: 120, visible: true, sortable: true, filterable: true },
  { key: 'counteragentName', label: 'Counteragent', width: 200, visible: true, sortable: true, filterable: true },
  { key: 'counteragentAccountNumber', label: 'CA Account', width: 180, visible: true, sortable: true, filterable: true },
  { key: 'projectIndex', label: 'Project', width: 120, visible: true, sortable: true, filterable: true },
  { key: 'financialCode', label: 'Fin. Code', width: 100, visible: true, sortable: true, filterable: true },
  { key: 'nominalCurrencyCode', label: 'Nom ISO', width: 80, visible: true, sortable: true, filterable: true },
  { key: 'paymentId', label: 'Payment ID', width: 140, visible: true, sortable: true, filterable: true },
  { key: 'description', label: 'Description', width: 300, visible: true, sortable: true, filterable: true },
  { key: 'nominalAmount', label: 'Nominal Amt', width: 120, visible: false, sortable: true, filterable: true },
  { key: 'correctionDate', label: 'Correction Date', width: 120, visible: false, sortable: true, filterable: true },
  { key: 'id1', label: 'DocKey', width: 120, visible: false, sortable: true, filterable: true },
  { key: 'id2', label: 'EntriesId', width: 120, visible: false, sortable: true, filterable: true },
  { key: 'recordUuid', label: 'Record UUID', width: 200, visible: false, sortable: true, filterable: true },
  { key: 'uuid', label: 'UUID', width: 200, visible: false, sortable: true, filterable: true },
  { key: 'accountUuid', label: 'Account UUID', width: 200, visible: false, sortable: true, filterable: true },
  { key: 'accountCurrencyUuid', label: 'Currency UUID', width: 200, visible: false, sortable: true, filterable: true },
  { key: 'paymentUuid', label: 'Payment UUID', width: 200, visible: false, sortable: true, filterable: true },
  { key: 'counteragentUuid', label: 'CA UUID', width: 200, visible: false, sortable: true, filterable: true },
  { key: 'projectUuid', label: 'Project UUID', width: 200, visible: false, sortable: true, filterable: true },
  { key: 'financialCodeUuid', label: 'Fin. Code UUID', width: 200, visible: false, sortable: true, filterable: true },
  { key: 'nominalCurrencyUuid', label: 'Nominal Cur. UUID', width: 200, visible: false, sortable: true, filterable: true },
  { key: 'createdAt', label: 'Created', width: 140, visible: false, sortable: true, filterable: true },
  { key: 'updatedAt', label: 'Updated', width: 140, visible: false, sortable: true, filterable: true }
];

// Helper function to format date as dd.mm.yyyy
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return dateString;
  }
};

// Helper function to format amount with thousands separator and 2 decimals
const formatAmount = (amount: string | number | null | undefined): string => {
  if (amount == null) return '-';
  const num = Number(amount);
  if (isNaN(num)) return '-';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Helper function to get responsive classes
const getResponsiveClass = (responsive?: string) => {
  switch (responsive) {
    case 'sm': return 'hidden sm:table-cell';
    case 'md': return 'hidden md:table-cell';
    case 'lg': return 'hidden lg:table-cell';
    case 'xl': return 'hidden xl:table-cell';
    default: return '';
  }
};

export function BankTransactionsTable({ data }: { data?: BankTransaction[] }) {
  const [transactions, setTransactions] = useState<BankTransaction[]>(data ?? []);
  
  // Horizontal scroll synchronization
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const [needsBottomScroller, setNeedsBottomScroller] = useState(false);
  const [scrollContentWidth, setScrollContentWidth] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<ColumnKey | null>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<BankTransaction | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [paymentOptions, setPaymentOptions] = useState<any[]>([]);
  const [projectOptions, setProjectOptions] = useState<any[]>([]);
  const [jobOptions, setJobOptions] = useState<any[]>([]);
  const [financialCodeOptions, setFinancialCodeOptions] = useState<any[]>([]);
  const [currencyOptions, setCurrencyOptions] = useState<any[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [jobSearch, setJobSearch] = useState('');
  const [financialCodeSearch, setFinancialCodeSearch] = useState('');
  const [currencySearch, setCurrencySearch] = useState('');
  const [formData, setFormData] = useState<{
    payment_uuid: string;
    project_uuid: string;
    job_uuid: string;
    financial_code_uuid: string;
    nominal_currency_uuid: string;
  }>({ payment_uuid: '', project_uuid: '', job_uuid: '', financial_code_uuid: '', nominal_currency_uuid: '' });
  
  // Store display labels from selected payment
  const [paymentDisplayValues, setPaymentDisplayValues] = useState<{
    projectLabel: string;
    jobLabel: string;
    financialCodeLabel: string;
    currencyLabel: string;
  }>({ projectLabel: '', jobLabel: '', financialCodeLabel: '', currencyLabel: '' });
  
  // Initialize columns from localStorage or use defaults
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    if (typeof window !== 'undefined') {
      const savedColumns = localStorage.getItem('bank-transactions-table-columns');
      const savedVersion = localStorage.getItem('bank-transactions-table-version');
      const currentVersion = '3'; // Increment this when defaultColumns structure changes
      
      if (savedColumns && savedVersion === currentVersion) {
        try {
          return JSON.parse(savedColumns);
        } catch (error) {
          console.warn('Failed to parse saved column settings:', error);
        }
      } else {
        // Clear old version data
        localStorage.setItem('bank-transactions-table-version', currentVersion);
      }
    }
    return defaultColumns;
  });
  
  const [isResizing, setIsResizing] = useState<{ column: ColumnKey; startX: number; startWidth: number } | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const pageSizeOptions = [50, 100, 200, 500, 1000];

  // Respond to external data updates
  useEffect(() => {
    if (data) setTransactions(data);
  }, [data]);

  // Measure scroll content width
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const measure = () => {
      const sw = el.scrollWidth;
      const cw = el.clientWidth;
      const needs = sw > cw + 1;
      setScrollContentWidth(sw);
      setNeedsBottomScroller(needs);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [transactions, columns]);

  // Sync scroll positions
  useEffect(() => {
    const timer = setTimeout(() => {
      const top = scrollRef.current;
      const bottom = bottomScrollRef.current;
      
      if (!top || !bottom) return;

      let isSyncing = false;
      const syncFromTop = () => {
        if (isSyncing) return;
        isSyncing = true;
        bottom.scrollLeft = top.scrollLeft;
        isSyncing = false;
      };
      const syncFromBottom = () => {
        if (isSyncing) return;
        isSyncing = true;
        top.scrollLeft = bottom.scrollLeft;
        isSyncing = false;
      };
      
      top.addEventListener('scroll', syncFromTop, { passive: true });
      bottom.addEventListener('scroll', syncFromBottom, { passive: true });
      bottom.scrollLeft = top.scrollLeft;
      
      return () => {
        top.removeEventListener('scroll', syncFromTop);
        bottom.removeEventListener('scroll', syncFromBottom);
      };
    }, 100);
    
    return () => clearTimeout(timer);
  }, [scrollContentWidth]);

  // Save column settings
  useEffect(() => {
    localStorage.setItem('bank-transactions-table-columns', JSON.stringify(columns));
  }, [columns]);

  // Mouse events for column resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const diff = e.clientX - isResizing.startX;
      const newWidth = Math.max(10, isResizing.startWidth + diff); // Minimal 10px to prevent negative widths
      setColumns(cols => cols.map(col => 
        col.key === isResizing.column ? { ...col, width: newWidth } : col
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

    const draggedIndex = columns.findIndex(col => col.key === draggedColumn);
    const targetIndex = columns.findIndex(col => col.key === targetColumnKey);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newColumns = [...columns];
    const [removed] = newColumns.splice(draggedIndex, 1);
    newColumns.splice(targetIndex, 0, removed);

    setColumns(newColumns);
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  // Filtering and sorting
  const filteredData = useMemo(() => {
    let result = [...transactions];

    // Apply search filter
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(row => {
        return columns.some(col => {
          if (!col.visible || !col.filterable) return false;
          const val = row[col.key];
          return val != null && String(val).toLowerCase().includes(lower);
        });
      });
    }

    // Apply column filters
    Object.entries(columnFilters).forEach(([columnKey, selectedValues]) => {
      if (selectedValues.length > 0) {
        result = result.filter(row => {
          const cellValue = String(row[columnKey as ColumnKey] ?? '');
          return selectedValues.includes(cellValue);
        });
      }
    });

    // Apply sorting
    if (sortField) {
      result.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return sortDirection === 'asc' ? 1 : -1;
        if (bVal == null) return sortDirection === 'asc' ? -1 : 1;
        
        let comparison = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else if (sortField === 'date' || sortField === 'correctionDate' || sortField === 'createdAt' || sortField === 'updatedAt') {
          comparison = new Date(aVal).getTime() - new Date(bVal).getTime();
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }
        
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [transactions, searchTerm, columnFilters, sortField, sortDirection, columns]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, columnFilters, pageSize]);

  const handleSort = (field: ColumnKey) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleColumnVisibility = (columnKey: ColumnKey) => {
    setColumns(cols => cols.map(col =>
      col.key === columnKey ? { ...col, visible: !col.visible } : col
    ));
  };

  const resetColumns = () => {
    setColumns(defaultColumns);
    localStorage.removeItem('bank-transactions-table-columns');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    
    // Add all selected files
    Array.from(files).forEach(file => {
      formData.append('file', file);
    });

    try {
      const response = await fetch('/api/bank-transactions/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        // Show logs in a textarea for better readability
        const logWindow = window.open('', 'Processing Logs', 'width=800,height=600');
        if (logWindow) {
          logWindow.document.write(`
            <html>
              <head>
                <title>Processing Logs</title>
                <style>
                  body { font-family: monospace; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
                  pre { white-space: pre-wrap; word-wrap: break-word; }
                  h2 { color: #4ec9b0; }
                  .success { color: #4ec9b0; }
                  .error { color: #f48771; }
                </style>
              </head>
              <body>
                <h2 class="success">${result.message}</h2>
                <pre>${result.logs || 'No logs available'}</pre>
                <p><button onclick="window.close(); opener.location.reload();">Close and Reload Page</button></p>
              </body>
            </html>
          `);
          logWindow.document.close();
        } else {
          alert(`Success! ${result.message}\n\nPage will reload.`);
          window.location.reload();
        }
      } else {
        alert(`Error: ${result.error}${result.details ? '\n' + result.details : ''}`);
      }
    } catch (error: any) {
      alert(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const startEdit = async (transaction: BankTransaction) => {
    setEditingTransaction(transaction);
    setFormData({
      payment_uuid: transaction.paymentId || '',
      project_uuid: transaction.projectUuid || '',
      job_uuid: '', // Will be loaded based on project
      financial_code_uuid: transaction.financialCodeUuid || '',
      nominal_currency_uuid: transaction.nominalCurrencyUuid || '',
    });
    setLoadingOptions(true);
    setIsEditDialogOpen(true); // Open dialog immediately with loading state
    
    try {
      // Fetch payment options for this transaction's counteragent
      const res = await fetch(`/api/bank-transactions/${transaction.id}/payment-options`);
      const data = await res.json();
      console.log('Payment options received from API:', data.payments);
      setPaymentOptions(data.payments || []);
      
      // If transaction already has a payment, find it and populate display values
      if (transaction.paymentId && data.payments) {
        const selectedPayment = data.payments.find((p: any) => p.paymentId === transaction.paymentId);
        console.log('Looking for payment:', transaction.paymentId);
        console.log('Found payment:', selectedPayment);
        if (selectedPayment) {
          setPaymentDisplayValues({
            projectLabel: selectedPayment.projectName || '',
            jobLabel: selectedPayment.jobDisplay || selectedPayment.jobName || '',
            financialCodeLabel: selectedPayment.financialCodeValidation || '',
            currencyLabel: selectedPayment.currencyCode || '',
          });
          console.log('Set display values:', {
            projectLabel: selectedPayment.projectName,
            jobLabel: selectedPayment.jobDisplay || selectedPayment.jobName,
            financialCodeLabel: selectedPayment.financialCodeValidation,
            currencyLabel: selectedPayment.currencyCode,
          });
        }
      }
      
      // Load all reference data
      const [projectsRes, codesRes, currenciesRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/financial-codes'),
        fetch('/api/currencies'),
      ]);
      
      const [projectsData, codesData, currenciesData] = await Promise.all([
        projectsRes.json(),
        codesRes.json(),
        currenciesRes.json(),
      ]);
      
      console.log('Projects API response:', projectsData);
      console.log('Is projects array?', Array.isArray(projectsData));
      console.log('Projects length:', Array.isArray(projectsData) ? projectsData.length : 0);
      console.log('First project:', projectsData[0]);
      console.log('Codes API response:', codesData);
      console.log('First code:', codesData[0]);
      console.log('Currencies API response:', currenciesData);
      console.log('First currency:', currenciesData[0]);
      
      // Transform projects from snake_case to camelCase
      const mappedProjects = Array.isArray(projectsData) 
        ? projectsData.map((p: any) => {
            console.log('Mapping project:', p);
            return {
              uuid: p.project_uuid,
              projectIndex: p.project_index,
              projectName: p.project_name,
            };
          })
        : [];
      
      console.log('Mapped projects count:', mappedProjects.length);
      console.log('First mapped project:', mappedProjects[0]);
      
      setProjectOptions(mappedProjects);
      console.log('Project options count after set:', mappedProjects.length);
      
      setFinancialCodeOptions(Array.isArray(codesData) ? codesData : (codesData.codes || []));
      setCurrencyOptions(Array.isArray(currenciesData) ? currenciesData : (currenciesData.currencies || []));
      
      // Load jobs for the current project if present
      if (transaction.projectUuid) {
        const jobsRes = await fetch(`/api/jobs?projectUuid=${transaction.projectUuid}`);
        const jobsData = await jobsRes.json();
        setJobOptions(Array.isArray(jobsData) ? jobsData : []);
      } else {
        setJobOptions([]);
      }
    } catch (error: any) {
      alert(`Failed to load options: ${error.message}`);
      setEditingTransaction(null);
      setIsEditDialogOpen(false);
    } finally {
      setLoadingOptions(false);
    }
  };

  const cancelEdit = () => {
    setEditingTransaction(null);
    setIsEditDialogOpen(false);
    setFormData({ payment_uuid: '', project_uuid: '', job_uuid: '', financial_code_uuid: '', nominal_currency_uuid: '' });
    setPaymentDisplayValues({ projectLabel: '', jobLabel: '', financialCodeLabel: '', currencyLabel: '' });
    setJobOptions([]);
  };

  // Handle payment selection - auto-fill related fields
  const handlePaymentChange = (paymentId: string) => {
    const newFormData = { ...formData, payment_uuid: paymentId === '__none__' ? '' : paymentId };
    
    if (paymentId && paymentId !== '__none__') {
      const selectedPayment = paymentOptions.find(p => p.paymentId === paymentId);
      if (selectedPayment) {
        newFormData.project_uuid = selectedPayment.projectUuid || '';
        newFormData.job_uuid = selectedPayment.jobUuid || '';
        newFormData.financial_code_uuid = selectedPayment.financialCodeUuid || '';
        newFormData.nominal_currency_uuid = selectedPayment.currencyUuid || '';
        
        // Store display labels
        setPaymentDisplayValues({
          projectLabel: selectedPayment.projectName || '',
          jobLabel: selectedPayment.jobName || '',
          financialCodeLabel: selectedPayment.financialCodeValidation || '',
          currencyLabel: selectedPayment.currencyCode || '',
        });
        
        // Load jobs for the selected payment's project
        if (selectedPayment.projectUuid) {
          fetch(`/api/jobs?projectUuid=${selectedPayment.projectUuid}`)
            .then(res => res.json())
            .then(data => setJobOptions(Array.isArray(data) ? data : []))
            .catch(err => console.error('Failed to load jobs:', err));
        }
      }
    } else {
      // Clear all fields when payment is cleared
      newFormData.project_uuid = '';
      newFormData.job_uuid = '';
      newFormData.financial_code_uuid = '';
      newFormData.nominal_currency_uuid = '';
      
      setPaymentDisplayValues({
        projectLabel: '',
        jobLabel: '',
        financialCodeLabel: '',
        currencyLabel: '',
      });
      
      setJobOptions([]);
    }
    
    setFormData(newFormData);
    setPaymentSearch('');
  };

  // Handle project change - load jobs for new project
  const handleProjectChange = async (projectUuid: string) => {
    const newFormData = { ...formData, project_uuid: projectUuid === '__none__' ? '' : projectUuid, job_uuid: '' };
    setFormData(newFormData);
    setProjectSearch('');
    
    if (projectUuid && projectUuid !== '__none__') {
      try {
        console.log(`Loading jobs for project: ${projectUuid}`);
        const jobsRes = await fetch(`/api/jobs?projectUuid=${projectUuid}`);
        const jobsData = await jobsRes.json();
        console.log('Jobs API response:', jobsData);
        console.log('Is array?', Array.isArray(jobsData));
        console.log('Jobs count:', Array.isArray(jobsData) ? jobsData.length : 0);
        setJobOptions(Array.isArray(jobsData) ? jobsData : []);
      } catch (err) {
        console.error('Failed to load jobs:', err);
        setJobOptions([]);
      }
    } else {
      setJobOptions([]);
    }
    
    // Check if manual combination matches a payment
    checkAndAutoSelectPayment(newFormData);
  };

  // Check if manual field selection matches a payment
  const checkAndAutoSelectPayment = (currentFormData: typeof formData) => {
    if (!currentFormData.payment_uuid && 
        currentFormData.project_uuid && 
        currentFormData.financial_code_uuid && 
        currentFormData.nominal_currency_uuid) {
      
      const matchingPayment = paymentOptions.find(p => 
        p.projectUuid === currentFormData.project_uuid &&
        (p.jobUuid || '') === (currentFormData.job_uuid || '') &&
        p.financialCodeUuid === currentFormData.financial_code_uuid &&
        p.currencyUuid === currentFormData.nominal_currency_uuid
      );
      
      if (matchingPayment) {
        setFormData({ ...currentFormData, payment_uuid: matchingPayment.paymentId });
        
        // Set display values to make fields read-only
        setPaymentDisplayValues({
          projectLabel: matchingPayment.projectName || '',
          jobLabel: matchingPayment.jobName || '',
          financialCodeLabel: matchingPayment.financialCodeValidation || '',
          currencyLabel: matchingPayment.currencyCode || '',
        });
      }
    }
  };

  // Handle job change
  const handleJobChange = (jobUuid: string) => {
    const newFormData = { ...formData, job_uuid: jobUuid === '__none__' ? '' : jobUuid };
    setFormData(newFormData);
    setJobSearch('');
    checkAndAutoSelectPayment(newFormData);
  };

  // Handle financial code change
  const handleFinancialCodeChange = (codeUuid: string) => {
    const newFormData = { ...formData, financial_code_uuid: codeUuid === '__none__' ? '' : codeUuid };
    setFormData(newFormData);
    setFinancialCodeSearch('');
    checkAndAutoSelectPayment(newFormData);
  };

  // Handle currency change
  const handleCurrencyChange = (currencyUuid: string) => {
    const newFormData = { ...formData, nominal_currency_uuid: currencyUuid === '__none__' ? '' : currencyUuid };
    setFormData(newFormData);
    setCurrencySearch('');
    checkAndAutoSelectPayment(newFormData);
  };

  const handleSave = async () => {
    if (!editingTransaction) return;
    
    setIsSaving(true);
    
    try {
      const updateData: any = {};
      
      // Only include changed fields
      if (formData.payment_uuid !== (editingTransaction.paymentId || '')) {
        updateData.payment_uuid = formData.payment_uuid || null;
      }
      if (formData.project_uuid !== (editingTransaction.projectUuid || '')) {
        updateData.project_uuid = formData.project_uuid || null;
      }
      if (formData.financial_code_uuid !== (editingTransaction.financialCodeUuid || '')) {
        updateData.financial_code_uuid = formData.financial_code_uuid || null;
      }
      if (formData.nominal_currency_uuid !== (editingTransaction.nominalCurrencyUuid || '')) {
        updateData.nominal_currency_uuid = formData.nominal_currency_uuid || null;
      }

      // If nothing changed, just close
      if (Object.keys(updateData).length === 0) {
        cancelEdit();
        return;
      }

      const response = await fetch(`/api/bank-transactions/${editingTransaction.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const result = await response.json();

      if (response.ok) {
        // Refresh page to get updated values from database
        window.location.reload();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Failed to save: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Get unique values for column filters
  const getColumnUniqueValues = (columnKey: ColumnKey) => {
    const values = new Set<string>();
    transactions.forEach(row => {
      const val = row[columnKey];
      if (val != null) values.add(String(val));
    });
    return Array.from(values).sort();
  };

  // Filter popover component (matching counteragents table exactly)
  const FilterPopover = ({ column }: { column: ColumnConfig }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [filterSearchTerm, setFilterSearchTerm] = useState('');
    const [tempSelectedValues, setTempSelectedValues] = useState<string[]>([]);

    const uniqueValues = useMemo(() => getColumnUniqueValues(column.key), [column.key]);
    const selectedValues = columnFilters[column.key] || [];

    const handleOpenChange = (open: boolean) => {
      if (open) {
        setTempSelectedValues([...selectedValues]);
        setFilterSearchTerm('');
      }
      setIsOpen(open);
    };

    const handleApply = () => {
      setColumnFilters(prev => ({
        ...prev,
        [column.key]: tempSelectedValues
      }));
      setIsOpen(false);
    };

    const handleCancel = () => {
      setTempSelectedValues([...selectedValues]);
      setIsOpen(false);
    };

    const handleSelectAll = () => {
      setTempSelectedValues([...filteredUniqueValues]);
    };

    const handleClearAll = () => {
      setTempSelectedValues([]);
    };

    const filteredUniqueValues = useMemo(() => {
      if (!filterSearchTerm) return uniqueValues;
      const term = filterSearchTerm.toLowerCase();
      return uniqueValues.filter(val => 
        String(val).toLowerCase().includes(term)
      );
    }, [uniqueValues, filterSearchTerm]);

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

  const visibleColumns = columns.filter(col => col.visible);
  const totalWidth = visibleColumns.reduce((sum, col) => sum + col.width, 0);

  return (
    <div className="flex flex-col h-screen">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-4 border-b bg-white">
        <div className="flex-1 min-w-0 w-full sm:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-full"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Upload XML Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Upload className="h-4 w-4 mr-2" />
            {isUploading ? 'Processing...' : 'Upload XML'}
          </Button>
          
          {/* Column Settings */}
          <Popover open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 max-h-96 overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Column Visibility</h4>
                  <Button variant="ghost" size="sm" onClick={resetColumns}>
                    Reset
                  </Button>
                </div>
                <div className="space-y-2">
                  {columns.map(col => (
                    <div key={col.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={`col-${col.key}`}
                        checked={col.visible}
                        onCheckedChange={() => toggleColumnVisibility(col.key)}
                      />
                      <label
                        htmlFor={`col-${col.key}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {col.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex gap-6 px-4 py-3 text-sm bg-gray-50 border-b">
        <div>
          <span className="text-gray-600">Total:</span>
          <span className="ml-2 font-semibold text-blue-900">{transactions.length}</span>
        </div>
        <div>
          <span className="text-gray-600">Filtered:</span>
          <span className="ml-2 font-semibold text-blue-900">{filteredData.length}</span>
        </div>
        <div>
          <span className="text-gray-600">Showing:</span>
          <span className="ml-2 font-semibold text-blue-900">{paginatedData.length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 p-4 overflow-hidden">
        <div className="h-full overflow-auto rounded-lg border bg-white">
          <table style={{ tableLayout: 'fixed', width: '100%' }}>
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b-2 border-gray-200">
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    className={`font-semibold relative cursor-move overflow-hidden text-left px-4 py-3 text-sm ${getResponsiveClass(col.responsive)} ${
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
                      {col.sortable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={() => handleSort(col.key)}
                        >
                          {sortField === col.key ? (
                            sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                      {col.filterable && <FilterPopover column={col} />}
                    </div>
                    
                    {/* Resize handle */}
                    <div
                      className="absolute top-0 right-0 bottom-0 w-5 cursor-col-resize hover:bg-blue-500/20 active:bg-blue-600/40 z-50"
                      style={{ marginRight: '-10px' }}
                      draggable={false}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsResizing({
                          column: col.key,
                          startX: e.clientX,
                          startWidth: col.width
                        });
                      }}
                    />
                  </th>
                ))}
                <th className="font-semibold text-left px-4 py-3 text-sm" style={{ width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="text-center text-gray-500 py-8">
                    No transactions found
                  </td>
                </tr>
              ) : (
                paginatedData.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-gray-50">
                    {visibleColumns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-2 text-sm ${getResponsiveClass(col.responsive)}`}
                        style={{ width: col.width, minWidth: col.width, maxWidth: col.width }}
                      >
                        <div className="truncate overflow-hidden" title={String(row[col.key] ?? '')}>
                          {col.key === 'accountCurrencyAmount' || col.key === 'nominalAmount' ? (
                            <span className={Number(row[col.key]) >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {formatAmount(row[col.key])}
                            </span>
                          ) : col.key === 'date' || col.key === 'correctionDate' || col.key === 'createdAt' || col.key === 'updatedAt' ? (
                            formatDate(row[col.key])
                          ) : (
                            row[col.key] ?? '-'
                          )}
                        </div>
                      </td>
                    ))}
                    <td className="px-4 py-2 text-sm" style={{ width: 100 }}>
                      <div className="flex items-center space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(row)}
                          className="h-7 w-7 p-0"
                          title="Edit transaction"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page:</span>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            {pageSizeOptions.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
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
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
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

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Bank Transaction</DialogTitle>
            <DialogDescription>
              Update transaction details. Payment ID controls which fields can be edited.
            </DialogDescription>
          </DialogHeader>
          {loadingOptions ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading transaction data...</p>
            </div>
          ) : (
            <div className="grid gap-4 py-4">
              {/* Payment ID */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-payment" className="text-right">Payment ID</Label>
                <div className="col-span-3">
                  <Select 
                    value={formData.payment_uuid || '__none__'} 
                    onValueChange={handlePaymentChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="-- No Payment --" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="flex items-center border-b px-3 pb-2">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <Input
                          placeholder="Search payments..."
                          value={paymentSearch}
                          onChange={(e) => setPaymentSearch(e.target.value)}
                          className="h-8 w-full border-0 p-0 focus-visible:ring-0"
                        />
                      </div>
                      <div className="max-h-[300px] overflow-y-auto">
                        <SelectItem value="__none__">-- No Payment --</SelectItem>
                        {paymentOptions
                          .filter((payment) => {
                            if (!paymentSearch) return true;
                            const searchLower = paymentSearch.toLowerCase();
                            return (
                              payment.paymentId?.toLowerCase().includes(searchLower) ||
                              payment.jobName?.toLowerCase().includes(searchLower) ||
                              payment.currencyCode?.toLowerCase().includes(searchLower) ||
                              payment.projectName?.toLowerCase().includes(searchLower) ||
                              payment.financialCodeValidation?.toLowerCase().includes(searchLower)
                            );
                          })
                          .map((payment) => (
                            <SelectItem key={payment.paymentId} value={payment.paymentId}>
                              {payment.paymentId}
                              {(payment.currencyCode || payment.projectName || payment.jobName || payment.financialCodeValidation) && (
                                <span className="text-muted-foreground">
                                  {' | '}{payment.currencyCode || '-'}
                                  {' | '}{payment.projectName || '-'}
                                  {payment.jobName && ` | ${payment.jobName}`}
                                  {' | '}{payment.financialCodeValidation || '-'}
                                </span>
                              )}
                            </SelectItem>
                          ))}
                      </div>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.payment_uuid ? 'Clears auto-fill other fields' : 'Select to auto-fill fields below'}
                  </p>
                </div>
              </div>

              {/* Project */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-project" className="text-right">Project</Label>
                <div className="col-span-3">
                  {!!formData.payment_uuid ? (
                    <Input
                      value={paymentDisplayValues.projectLabel}
                      readOnly
                      className="bg-muted"
                    />
                  ) : (
                    <>
                      {console.log('Project options count:', projectOptions.length)}
                      <Select 
                        value={formData.project_uuid || '__none__'} 
                        onValueChange={handleProjectChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="-- Select Project --" />
                        </SelectTrigger>
                        <SelectContent>
                          <div className="flex items-center border-b px-3 pb-2">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <Input
                              placeholder="Search projects..."
                              value={projectSearch}
                              onChange={(e) => setProjectSearch(e.target.value)}
                              className="h-8 w-full border-0 p-0 focus-visible:ring-0"
                            />
                          </div>
                          <div className="max-h-[300px] overflow-y-auto">
                            <SelectItem value="__none__">-- No Project --</SelectItem>
                            {projectOptions
                              .filter((project) => {
                                if (!projectSearch) return true;
                                const searchLower = projectSearch.toLowerCase();
                                return (
                                  project.projectIndex?.toLowerCase().includes(searchLower) ||
                                  project.projectName?.toLowerCase().includes(searchLower)
                                );
                              })
                              .map((project) => (
                                <SelectItem key={project.uuid} value={project.uuid}>
                                  {project.projectIndex} - {project.projectName}
                                </SelectItem>
                              ))}
                          </div>
                        </SelectContent>
                      </Select>
                    </>
                  )}
                  {!!formData.payment_uuid && (
                    <p className="text-xs text-muted-foreground mt-1">Clear Payment ID to edit manually</p>
                  )}
                </div>
              </div>

              {/* Job Name */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-job" className="text-right">Job Name</Label>
                <div className="col-span-3">
                  {!!formData.payment_uuid ? (
                    <Input
                      value={paymentDisplayValues.jobLabel || '-- No Job --'}
                      readOnly
                      className="bg-muted"
                    />
                  ) : (
                    <Select 
                      value={formData.job_uuid || '__none__'} 
                      onValueChange={handleJobChange}
                      disabled={!formData.project_uuid}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={formData.project_uuid ? "-- No Job --" : "Select project first"} />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="flex items-center border-b px-3 pb-2">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <Input
                            placeholder="Search jobs..."
                            value={jobSearch}
                            onChange={(e) => setJobSearch(e.target.value)}
                            className="h-8 w-full border-0 p-0 focus-visible:ring-0"
                          />
                        </div>
                        <div className="max-h-[300px] overflow-y-auto">
                          <SelectItem value="__none__">-- No Job --</SelectItem>
                          {jobOptions
                            .filter((job) => {
                              if (!jobSearch) return true;
                              const searchLower = jobSearch.toLowerCase();
                              const displayText = job.jobDisplay || job.jobName || '';
                              return displayText.toLowerCase().includes(searchLower);
                            })
                            .map((job) => (
                              <SelectItem key={job.jobUuid} value={job.jobUuid}>
                                {job.jobDisplay || job.jobName}
                              </SelectItem>
                            ))}
                        </div>
                      </SelectContent>
                    </Select>
                  )}
                  {!!formData.payment_uuid && (
                    <p className="text-xs text-muted-foreground mt-1">Clear Payment ID to edit manually</p>
                  )}
                </div>
              </div>

              {/* Financial Code */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-financial-code" className="text-right">Financial Code</Label>
                <div className="col-span-3">
                  {!!formData.payment_uuid ? (
                    <Input
                      value={paymentDisplayValues.financialCodeLabel}
                      readOnly
                      className="bg-muted"
                    />
                  ) : (
                    <Select 
                      value={formData.financial_code_uuid || '__none__'} 
                      onValueChange={handleFinancialCodeChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="-- Select Financial Code --" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="flex items-center border-b px-3 pb-2">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <Input
                            placeholder="Search codes..."
                            value={financialCodeSearch}
                            onChange={(e) => setFinancialCodeSearch(e.target.value)}
                            className="h-8 w-full border-0 p-0 focus-visible:ring-0"
                          />
                        </div>
                        <div className="max-h-[300px] overflow-y-auto">
                          <SelectItem value="__none__">-- No Code --</SelectItem>
                          {financialCodeOptions
                            .filter((code) => {
                              if (!financialCodeSearch) return true;
                              return code.validation?.toLowerCase().includes(financialCodeSearch.toLowerCase());
                            })
                            .map((code) => (
                              <SelectItem key={code.uuid} value={code.uuid}>
                                {code.validation}
                              </SelectItem>
                            ))}
                        </div>
                      </SelectContent>
                    </Select>
                  )}
                  {!!formData.payment_uuid && (
                    <p className="text-xs text-muted-foreground mt-1">Clear Payment ID to edit manually</p>
                  )}
                </div>
              </div>

              {/* Nominal Currency */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-nominal-currency" className="text-right">Nominal Currency</Label>
                <div className="col-span-3">
                  {!!formData.payment_uuid ? (
                    <Input
                      value={paymentDisplayValues.currencyLabel}
                      readOnly
                      className="bg-muted"
                    />
                  ) : (
                    <Select 
                      value={formData.nominal_currency_uuid || '__none__'} 
                      onValueChange={handleCurrencyChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="-- Select Currency --" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="flex items-center border-b px-3 pb-2">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <Input
                            placeholder="Search currencies..."
                            value={currencySearch}
                            onChange={(e) => setCurrencySearch(e.target.value)}
                            className="h-8 w-full border-0 p-0 focus-visible:ring-0"
                          />
                        </div>
                        <div className="max-h-[300px] overflow-y-auto">
                          <SelectItem value="__none__">-- No Currency --</SelectItem>
                          {currencyOptions
                            .filter((currency) => {
                              if (!currencySearch) return true;
                              const searchLower = currencySearch.toLowerCase();
                              return (
                                currency.code?.toLowerCase().includes(searchLower) ||
                                currency.name?.toLowerCase().includes(searchLower)
                              );
                            })
                            .map((currency) => (
                              <SelectItem key={currency.uuid} value={currency.uuid}>
                                {currency.code} - {currency.name}
                              </SelectItem>
                            ))}
                        </div>
                      </SelectContent>
                    </Select>
                  )}
                  {!!formData.payment_uuid && (
                    <p className="text-xs text-muted-foreground mt-1">Clear Payment ID to edit manually</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={cancelEdit} disabled={isSaving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default BankTransactionsTable;
