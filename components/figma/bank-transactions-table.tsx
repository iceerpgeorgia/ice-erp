import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Settings,
  Eye,
  EyeOff,
  Upload,
  Edit2,
  Loader2,
  Download,
  RefreshCw,
  X
} from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import { ColumnFilterPopover } from './shared/column-filter-popover';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { BatchEditor } from '@/components/batch-editor';
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
  sourceTable?: string | null;
  sourceId?: number | null;
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
  exchangeRate: string | null;
  nominalExchangeRate?: string | null;
  usdGelRate?: number | null;
  id1: string | null;
  id2: string | null;
  recordUuid: string;
  counteragentAccountNumber: string | null;
  description: string | null;
  comment: string | null;
  processingCase: string | null;
  appliedRuleId: number | null;
  parsingLock?: boolean;
  createdAt: string;
  updatedAt: string;
  isBalanceRecord?: boolean; // Flag for balance records (no view/edit actions)
  
  // Display fields (from joins)
  accountNumber: string | null;
  bankName: string | null;
  counteragentName: string | null;
  projectIndex: string | null;
  financialCode: string | null;
  paymentId: string | null;
  batchId?: string | null;
  nominalCurrencyCode: string | null;
  accountCurrencyCode?: string | null;
};

type BackparsePreviewItem = {
  id: number;
  uuid: string;
  transaction_date: string | null;
  description: string | null;
  changed_fields: string[];
  current: Record<string, any>;
  next: Record<string, any>;
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
  { key: 'processingCase', label: 'Case', width: 220, visible: true, sortable: true, filterable: true },
  { key: 'parsingLock', label: 'Lock', width: 80, visible: true, sortable: true, filterable: true },
  { key: 'appliedRuleId', label: 'Applied Rule ID', width: 120, visible: false, sortable: true, filterable: true },
  { key: 'counteragentName', label: 'Counteragent', width: 200, visible: true, sortable: true, filterable: true },
  { key: 'counteragentAccountNumber', label: 'CA Account', width: 180, visible: true, sortable: true, filterable: true },
  { key: 'projectIndex', label: 'Project', width: 120, visible: true, sortable: true, filterable: true },
  { key: 'financialCode', label: 'Fin. Code', width: 100, visible: true, sortable: true, filterable: true },
  { key: 'nominalCurrencyCode', label: 'Nom ISO', width: 80, visible: true, sortable: true, filterable: true },
  { key: 'paymentId', label: 'Payment ID', width: 140, visible: true, sortable: true, filterable: true },
  { key: 'batchId', label: 'Batch ID', width: 140, visible: true, sortable: true, filterable: true },
  { key: 'description', label: 'Description', width: 300, visible: true, sortable: true, filterable: true },
  { key: 'comment', label: 'Comment', width: 260, visible: true, sortable: true, filterable: true },
  { key: 'nominalAmount', label: 'Nominal Amt', width: 120, visible: false, sortable: true, filterable: true },
  { key: 'usdGelRate', label: 'USD/GEL', width: 120, visible: true, sortable: true, filterable: true },
  { key: 'correctionDate', label: 'Correction Date', width: 120, visible: false, sortable: true, filterable: true },
  { key: 'exchangeRate', label: 'FX', width: 120, visible: false, sortable: true, filterable: true },
  { key: 'id1', label: 'ID1', width: 140, visible: true, sortable: true, filterable: true },
  { key: 'id2', label: 'ID2', width: 140, visible: true, sortable: true, filterable: true },
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
    // Handle YYYY-MM-DD format directly
    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateString)) {
      const [year, month, day] = dateString.split('T')[0].split('-');
      return `${day}.${month}.${year}`;
    }
    // Fallback to Date parsing for other formats
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return String(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return String(dateString);
  }
};

// Helper function to format amount with thousands separator and 2 decimals
const formatAmount = (amount: string | number | null | undefined): string => {
  if (amount == null) return '-';
  const num = Number(amount);
  if (isNaN(num)) return '-';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const toInputDate = (value?: string | null): string => {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split('.');
    return `${year}-${month}-${day}`;
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return '';
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

export function BankTransactionsTable({
  data,
  currencySummaries,
  uploadEndpoint = '/api/bank-transactions/upload',
  apiBasePath = '/api/bank-transactions',
  listBasePath,
  autoEditId: autoEditIdProp,
  renderMode = 'full',
  enableEditing = true,
  onDialogClose,
  onTransactionUpdated,
  filterStorageKey,
}: {
  data?: BankTransaction[];
  currencySummaries?: any[];
  uploadEndpoint?: string;
  apiBasePath?: string;
  listBasePath?: string;
  autoEditId?: number;
  renderMode?: 'full' | 'dialog-only';
  enableEditing?: boolean;
  onDialogClose?: () => void;
  onTransactionUpdated?: (transaction: BankTransaction) => void;
  filterStorageKey?: string;
}) {
  const resolvedFiltersStorageKey = filterStorageKey ?? 'bank-transactions-table-filters';
  const [transactions, setTransactions] = useState<BankTransaction[]>(data ?? []);
  const resolvedListBasePath = listBasePath ?? apiBasePath;
  const showFullTable = renderMode !== 'dialog-only';
  
  console.log('[BankTransactionsTable] currencySummaries:', currencySummaries);
  console.log('[BankTransactionsTable] currencySummaries[0]:', currencySummaries?.[0]);
  console.log('[BankTransactionsTable] opening_balance:', currencySummaries?.[0]?.opening_balance);
  
  // Horizontal scroll synchronization
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const [needsBottomScroller, setNeedsBottomScroller] = useState(false);
  const [scrollContentWidth, setScrollContentWidth] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Table sorting - default to date descending
  const [sortField, setSortField] = useState<ColumnKey>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const [pageSize, setPageSize] = useState(100);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [wasDialogOpen, setWasDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<BankTransaction | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importPreviewRows, setImportPreviewRows] = useState<any[]>([]);
  const [importSummary, setImportSummary] = useState<any | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingImportRows, setPendingImportRows] = useState<any[]>([]);
  const [importFileName, setImportFileName] = useState<string>('');
  const [isBatchEditorOpen, setIsBatchEditorOpen] = useState(false);
  const [batchEditorLoading, setBatchEditorLoading] = useState(false);
  const [batchEditorUuid, setBatchEditorUuid] = useState<string | null>(null);
  const [batchInitialPartitions, setBatchInitialPartitions] = useState<any[] | null>(null);
  const [batchEditorError, setBatchEditorError] = useState<string | null>(null);
  const [paymentOptions, setPaymentOptions] = useState<any[]>([]);
  const [allPayments, setAllPayments] = useState<any[]>([]); // All payments for search
  const [projectOptions, setProjectOptions] = useState<any[]>([]);

  const mapApiRowToTransaction = (row: any, fallback?: BankTransaction): BankTransaction => ({
    id: row.id,
    uuid: row.uuid || fallback?.uuid || "",
    accountUuid: row.bank_account_uuid || fallback?.accountUuid || "",
    accountCurrencyUuid: row.account_currency_uuid || fallback?.accountCurrencyUuid || "",
    accountCurrencyCode: row.account_currency_code || row.accountCurrencyCode || fallback?.accountCurrencyCode || null,
    accountCurrencyAmount: row.account_currency_amount || fallback?.accountCurrencyAmount || "0",
    paymentUuid: null,
    counteragentUuid: row.counteragent_uuid || fallback?.counteragentUuid || null,
    projectUuid: row.project_uuid || fallback?.projectUuid || null,
    financialCodeUuid: row.financial_code_uuid || fallback?.financialCodeUuid || null,
    nominalCurrencyUuid: row.nominal_currency_uuid || fallback?.nominalCurrencyUuid || null,
    nominalAmount: row.nominal_amount ?? fallback?.nominalAmount ?? null,
    date: row.transaction_date || fallback?.date || "",
    correctionDate: row.correction_date ?? row.correctionDate ?? fallback?.correctionDate ?? null,
    exchangeRate: row.exchange_rate ?? fallback?.exchangeRate ?? null,
    nominalExchangeRate: row.nominal_exchange_rate ?? fallback?.nominalExchangeRate ?? null,
    id1: row.id1 || row.dockey || fallback?.id1 || null,
    id2: row.id2 || row.entriesid || fallback?.id2 || null,
    recordUuid: row.raw_record_uuid || fallback?.recordUuid || "",
    counteragentAccountNumber: row.counteragent_account_number ?? fallback?.counteragentAccountNumber ?? null,
    description: row.description ?? fallback?.description ?? null,
    comment: row.comment ?? fallback?.comment ?? null,
    processingCase: row.processing_case ?? fallback?.processingCase ?? null,
    appliedRuleId: row.applied_rule_id ?? fallback?.appliedRuleId ?? null,
    parsingLock: row.parsing_lock ?? fallback?.parsingLock ?? false,
    createdAt: row.created_at || fallback?.createdAt || "",
    updatedAt: row.updated_at || fallback?.updatedAt || "",
    isBalanceRecord: row.is_balance_record ?? fallback?.isBalanceRecord ?? false,
    accountNumber: row.account_number ?? fallback?.accountNumber ?? null,
    bankName: row.bank_name ?? fallback?.bankName ?? null,
    counteragentName: row.counteragent_name ?? fallback?.counteragentName ?? null,
    projectIndex: row.project_index ?? fallback?.projectIndex ?? null,
    financialCode: row.financial_code ?? fallback?.financialCode ?? null,
    paymentId: row.payment_id ?? fallback?.paymentId ?? null,
    batchId: row.batch_id ?? row.batchId ?? fallback?.batchId ?? null,
    nominalCurrencyCode: row.nominal_currency_code ?? fallback?.nominalCurrencyCode ?? null,
    sourceTable: row.source_table ?? fallback?.sourceTable ?? null,
    sourceId: row.source_id ?? fallback?.sourceId ?? null,
  });

  const refreshTransactionById = async (transactionId: number, fallback?: BankTransaction) => {
    try {
      const updatedResponse = await fetch(`${apiBasePath}?ids=${transactionId}`);
      if (!updatedResponse.ok) {
        throw new Error('Failed to fetch updated transaction');
      }
      const updatedData = await updatedResponse.json();
      const row = Array.isArray(updatedData) ? updatedData[0] : updatedData?.data?.[0];
      if (!row || !row.id) {
        throw new Error('No updated transaction returned');
      }
      const mapped = mapApiRowToTransaction(row, fallback);
      setTransactions((prev) => prev.map((t) => (t.id === transactionId ? mapped : t)));
      onTransactionUpdated?.(mapped);
      return mapped;
    } catch (error) {
      console.error('[BankTransactionsTable] Failed to refresh transaction:', error);
      return null;
    }
  };

  const refreshTransactionsByRawRecordUuid = async (rawRecordUuid: string, fallback?: BankTransaction) => {
    try {
      const updatedResponse = await fetch(`${resolvedListBasePath}?rawRecordUuid=${encodeURIComponent(rawRecordUuid)}`);
      if (!updatedResponse.ok) {
        throw new Error('Failed to fetch updated batch transactions');
      }
      const updatedData = await updatedResponse.json();
      const rows = Array.isArray(updatedData)
        ? updatedData
        : Array.isArray(updatedData?.data)
          ? updatedData.data
          : [];
      if (rows.length === 0) {
        throw new Error('No batch transactions returned');
      }

      const mappedRows = rows
        .map((row: any) => mapApiRowToTransaction(row, fallback))
        .filter((row: BankTransaction) => Boolean(row.id));

      setTransactions((prev) => {
        const firstIndex = prev.findIndex((t) => t.recordUuid === rawRecordUuid);
        const filtered = prev.filter((t) => t.recordUuid !== rawRecordUuid);
        if (firstIndex === -1) {
          return [...mappedRows, ...filtered];
        }
        return [...filtered.slice(0, firstIndex), ...mappedRows, ...filtered.slice(firstIndex)];
      });

      if (mappedRows.length > 0) {
        onTransactionUpdated?.(mappedRows[0]);
      }

      return mappedRows;
    } catch (error) {
      console.error('[BankTransactionsTable] Failed to refresh batch transactions:', error);
      return null;
    }
  };
  const [jobOptions, setJobOptions] = useState<any[]>([]);
  const [financialCodeOptions, setFinancialCodeOptions] = useState<any[]>([]);
  const [currencyOptions, setCurrencyOptions] = useState<any[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [jobSearch, setJobSearch] = useState('');
  const [financialCodeSearch, setFinancialCodeSearch] = useState('');
  const [currencySearch, setCurrencySearch] = useState('');
  const [exchangeRates, setExchangeRates] = useState<any>(null); // Store exchange rates for transaction date
  const [exchangeRateDate, setExchangeRateDate] = useState<string>('');
  const [formData, setFormData] = useState<{
    payment_uuid: string;
    project_uuid: string;
    job_uuid: string;
    financial_code_uuid: string;
    nominal_currency_uuid: string;
    nominal_amount: string;
    correction_date: string;
    parsing_lock: boolean;
    comment: string;
  }>({
    payment_uuid: '',
    project_uuid: '',
    job_uuid: '',
    financial_code_uuid: '',
    nominal_currency_uuid: '',
    nominal_amount: '',
    correction_date: '',
    parsing_lock: false,
    comment: '',
  });
  const [isRawRecordDialogOpen, setIsRawRecordDialogOpen] = useState(false);
  const [viewingRawRecord, setViewingRawRecord] = useState<any>(null);
  const [loadingRawRecord, setLoadingRawRecord] = useState(false);
  const [isRawLockUpdating, setIsRawLockUpdating] = useState(false);
  const [autoEditId, setAutoEditId] = useState<number | null>(autoEditIdProp ?? null);
  const [isBackparseDialogOpen, setIsBackparseDialogOpen] = useState(false);
  const [isBackparseLoading, setIsBackparseLoading] = useState(false);
  const [isBackparseRunning, setIsBackparseRunning] = useState(false);
  const [isReparseRunning, setIsReparseRunning] = useState(false);
  const [backparsePreview, setBackparsePreview] = useState<BackparsePreviewItem[]>([]);
  const [backparseError, setBackparseError] = useState<string | null>(null);
  const [backparseLimit, setBackparseLimit] = useState(200);
  const [selectedBackparseIds, setSelectedBackparseIds] = useState<Set<number>>(new Set());
  
  // Store display labels from selected payment
  const [paymentDisplayValues, setPaymentDisplayValues] = useState<{
    projectLabel: string;
    jobLabel: string;
    financialCodeLabel: string;
    currencyLabel: string;
    nominalAmountLabel: string;
  }>({ projectLabel: '', jobLabel: '', financialCodeLabel: '', currencyLabel: '', nominalAmountLabel: '' });
  const [calculatedExchangeRate, setCalculatedExchangeRate] = useState<string>('');

  const updatePaymentOptions = (transaction: BankTransaction, paymentsList: any[]) => {
    // Filter payments by counteragent if one exists
    let payments = paymentsList;

    if (transaction.counteragentUuid) {
      payments = paymentsList.filter((p: any) => p.counteragentUuid === transaction.counteragentUuid);
    }

    setPaymentOptions(payments);

    // If transaction already has a payment, find it and populate display values
    if (transaction.paymentId && payments && payments.length > 0) {
      const selectedPayment = payments.find((p: any) => p.paymentId === transaction.paymentId);

      if (selectedPayment) {
        setPaymentDisplayValues({
          projectLabel: selectedPayment.projectIndex || 'N/A',
          jobLabel: selectedPayment.jobName || 'N/A',
          financialCodeLabel: selectedPayment.financialCodeValidation || '',
          currencyLabel: selectedPayment.currencyCode || '',
          nominalAmountLabel: formatAmount(transaction.nominalAmount || transaction.accountCurrencyAmount),
        });
      }
    }
  };

  useEffect(() => {
    if (autoEditIdProp !== undefined && autoEditIdProp !== null) {
      setAutoEditId(autoEditIdProp);
      return;
    }
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const editIdParam = params.get('editId');
    if (editIdParam) {
      const parsed = Number(editIdParam);
      if (!Number.isNaN(parsed)) {
        setAutoEditId(parsed);
      }
    }
  }, [autoEditIdProp]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedFilters = localStorage.getItem(resolvedFiltersStorageKey);
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        if (typeof parsed.searchTerm === 'string') setSearchTerm(parsed.searchTerm);
        if (parsed.sortField) setSortField(parsed.sortField as ColumnKey);
        if (parsed.sortDirection === 'asc' || parsed.sortDirection === 'desc') {
          setSortDirection(parsed.sortDirection);
        }
        if (typeof parsed.pageSize === 'number') setPageSize(parsed.pageSize);
        if (parsed.columnFilters && typeof parsed.columnFilters === 'object') {
          setColumnFilters(parsed.columnFilters);
        }
      } catch (error) {
        console.warn('Failed to parse saved bank transaction filters:', error);
      }
    }
    setFiltersInitialized(true);
  }, [resolvedFiltersStorageKey]);

  useEffect(() => {
    if (!filtersInitialized || typeof window === 'undefined') return;
    const serialized = {
      searchTerm,
      sortField,
      sortDirection,
      pageSize,
      columnFilters,
    };
    localStorage.setItem(resolvedFiltersStorageKey, JSON.stringify(serialized));
  }, [filtersInitialized, resolvedFiltersStorageKey, searchTerm, sortField, sortDirection, pageSize, columnFilters]);
  
  // Initialize columns from localStorage or use defaults
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    if (typeof window !== 'undefined') {
      const savedColumns = localStorage.getItem('bank-transactions-table-columns');
      const savedVersion = localStorage.getItem('bank-transactions-table-version');
      const currentVersion = '10'; // Increment this when defaultColumns structure changes
      
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
  const pageSizeOptions = [50, 100, 200, 500, 1000];
  const [isExporting, setIsExporting] = useState(false);

  // Respond to external data updates
  useEffect(() => {
    if (data) setTransactions(data);
  }, [data]);

  // Fetch all payments on mount
  useEffect(() => {
    const fetchAllPayments = async () => {
      try {
        const response = await fetch('/api/payment-id-options?includeSalary=true&projectionMonths=36');
        if (!response.ok) throw new Error('Failed to fetch payments');
        const paymentsData = await response.json();
        const normalizedPayments = Array.isArray(paymentsData)
          ? paymentsData.map((payment: any) => ({
              ...payment,
              counteragentUuid: payment.counteragentUuid || payment.counteragent_uuid || null,
              projectUuid: payment.projectUuid || payment.project_uuid || null,
              financialCodeUuid: payment.financialCodeUuid || payment.financial_code_uuid || null,
              currencyUuid: payment.currencyUuid || payment.currency_uuid || null,
              paymentId: payment.paymentId || payment.payment_id || null,
            }))
          : [];
        setAllPayments(normalizedPayments);
        console.log('[BankTransactionsTable] Loaded all payments:', normalizedPayments.length);
      } catch (error) {
        console.error('[BankTransactionsTable] Error fetching all payments:', error);
      }
    };
    fetchAllPayments();
  }, []);

  // Debounce search term to improve performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 150); // 150ms debounce - faster response

    return () => {
      clearTimeout(timer);
    };
  }, [searchTerm]);

  // Set isSearching flag
  useEffect(() => {
    if (searchTerm !== debouncedSearchTerm) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
  }, [searchTerm, debouncedSearchTerm]);

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

    // Apply search filter - supports regex patterns
    if (debouncedSearchTerm) {
      const searchableColumns: ColumnKey[] = [
        'counteragentName',        // Counteragent
        'counteragentAccountNumber', // CA Account
        'projectIndex',            // Project
        'paymentId',               // Payment ID
        'financialCode',           // Fin. Code
        'description'              // Description
      ];
      
      // Try to compile as regex, fallback to literal string search if invalid
      let searchRegex: RegExp | null = null;
      let isValidRegex = false;
      try {
        searchRegex = new RegExp(debouncedSearchTerm, 'i'); // Case-insensitive
        isValidRegex = true;
      } catch (e) {
        // Invalid regex - will use literal string search as fallback
        console.warn('Invalid regex pattern, using literal search:', debouncedSearchTerm);
      }
      
      result = result.filter(row => {
        // Early exit optimization - check each column and return immediately on match
        for (const key of searchableColumns) {
          const val = row[key];
          if (val !== null && val !== undefined) {
            const strVal = typeof val === 'string' ? val : String(val);
            
            if (isValidRegex && searchRegex) {
              // Use regex matching
              if (searchRegex.test(strVal)) {
                return true; // Found a match, include this row
              }
            } else {
              // Fallback to case-insensitive literal search
              if (strVal.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) {
                return true;
              }
            }
          }
        }
        return false; // No matches found
      });
    }

    // Apply column filters
    if (Object.keys(columnFilters).length > 0) {
      result = result.filter(row => {
        for (const [columnKey, allowedValues] of Object.entries(columnFilters)) {
          if (allowedValues.length === 0) continue;
          const rowValue = row[columnKey as ColumnKey];
          if (!allowedValues.includes(String(rowValue ?? ''))) {
            return false;
          }
        }
        return true;
      });
    }

    // Apply sorting
    if (sortField) {
      result.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        
        if (aVal === bVal) return 0;
        
        // Handle null/undefined values
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        let comparison = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else if (sortField === 'date') {
          // Special handling for dd.mm.yyyy date format
          const toComparable = (dateStr: any): string => {
            if (!dateStr || typeof dateStr !== 'string') return '';
            const parts = dateStr.split('.');
            if (parts.length !== 3) return dateStr;
            const [day, month, year] = parts;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          };
          const aComparable = toComparable(aVal);
          const bComparable = toComparable(bVal);
          comparison = aComparable < bComparable ? -1 : 1;
        } else if (sortField === 'correctionDate' || sortField === 'createdAt' || sortField === 'updatedAt') {
          const aDate = new Date(aVal as string | number).getTime();
          const bDate = new Date(bVal as string | number).getTime();
          comparison = aDate < bDate ? -1 : 1;
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }
        
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [transactions, debouncedSearchTerm, columnFilters, sortField, sortDirection]);

  // Calculate summary statistics from filtered data
  const summaryStats = useMemo(() => {
    const inflow = filteredData.reduce((sum, row) => {
      const amount = parseFloat(row.accountCurrencyAmount || '0');
      return amount > 0 ? sum + amount : sum;
    }, 0);

    const outflow = filteredData.reduce((sum, row) => {
      const amount = parseFloat(row.accountCurrencyAmount || '0');
      return amount < 0 ? sum + amount : sum;
    }, 0);

    const balance = inflow + outflow;

    return { inflow, outflow, balance };
  }, [filteredData]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, columnFilters, pageSize]);

  // Sorting is locked to date descending - no handleSort needed

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
    let logWindow: Window | null = null;
    let logBuffer = '';

    const writeLog = (message: string) => {
      logBuffer += `${message}\n`;
      if (logWindow) {
        logWindow.document.body.innerHTML = `
          <h2 class="info">Processing...</h2>
          <pre>${logBuffer.replace(/</g, '&lt;')}</pre>
        `;
      }
    };

    try {
      // Open log window immediately to avoid popup blockers
      logWindow = window.open('', 'Processing Logs', 'width=800,height=600');
      if (logWindow) {
        logWindow.document.write(`
          <html>
            <head>
              <title>Processing Logs</title>
              <style>
                body { font-family: monospace; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
                pre { white-space: pre-wrap; word-wrap: break-word; }
                h2 { color: #4ec9b0; }
                .info { color: #9cdcfe; }
                .success { color: #4ec9b0; }
                .error { color: #f48771; }
              </style>
            </head>
            <body>
              <h2 class="info">Preparing upload...</h2>
              <pre>Initializing...</pre>
            </body>
          </html>
        `);
        logWindow.document.close();
      }

      const supabase = getSupabaseBrowser();
      const bucketName = 'bank-xml-uploads';
      writeLog(`Uploading ${files.length} file(s) to Supabase Storage bucket: ${bucketName}`);

      const uploadedFiles = await Promise.all(
        Array.from(files).map(async (file) => {
          writeLog(`→ Requesting signed upload URL for ${file.name}`);
          const urlResponse = await fetch('/api/storage/upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: file.name, bucket: bucketName }),
          });

          const urlResult = await urlResponse.json();
          if (!urlResponse.ok) {
            throw new Error(`Failed to get signed URL for ${file.name}: ${urlResult.error || 'Unknown error'}`);
          }

          const { path, token } = urlResult;
          writeLog(`→ Uploading ${file.name} (${file.size.toLocaleString()} bytes)`);
          const { error: uploadError } = await supabase.storage
            .from(bucketName)
            .uploadToSignedUrl(path, token, file, {
              contentType: file.type || 'application/xml',
              upsert: false,
            });

          if (uploadError) {
            throw new Error(`Storage upload failed for ${file.name}: ${uploadError.message}`);
          }

          const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
          writeLog(`✓ Uploaded ${file.name}`);
          return { name: file.name, url: data.publicUrl };
        })
      );

      writeLog('All files uploaded. Calling import API...');

      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: uploadedFiles }),
      });

      const result = await response.json();

      if (response.ok) {
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
        writeLog(`✗ Import API error: ${result.error || 'Unknown error'}`);
        alert(`Error: ${result.error}${result.details ? '\n' + result.details : ''}`);
      }
    } catch (error: any) {
      writeLog(`✗ Upload failed: ${error.message}`);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const viewRawRecord = async (recordUuid: string, transaction?: BankTransaction) => {
    setLoadingRawRecord(true);
    setIsRawRecordDialogOpen(true);
    setViewingRawRecord(null);
    
    try {
      const sourceParams = transaction?.sourceTable && transaction?.sourceId !== undefined
        ? `?sourceTable=${encodeURIComponent(transaction.sourceTable)}&sourceId=${encodeURIComponent(String(transaction.sourceId))}`
        : '';
      const response = await fetch(`${apiBasePath}/raw-record/${recordUuid}${sourceParams}`);
      if (!response.ok) {
        throw new Error('Failed to fetch raw record');
      }
      const data = await response.json();
      setViewingRawRecord(data);
    } catch (error) {
      console.error('Error fetching raw record:', error);
      alert('Failed to load raw record');
      setIsRawRecordDialogOpen(false);
    } finally {
      setLoadingRawRecord(false);
    }
  };

  const startEdit = async (transaction: BankTransaction) => {
    console.log('[startEdit] Transaction:', transaction);
    setEditingTransaction(transaction);
    
    const transactionDateInput = toInputDate(transaction.date);
    const correctionInput = toInputDate(transaction.correctionDate);
    const initialCorrectionDate =
      correctionInput && correctionInput !== transactionDateInput ? correctionInput : '';

    // Initialize form with transaction data - use paymentId (not UUID) for the Select value
    const initialFormData = {
      payment_uuid: transaction.paymentId || '', // Use paymentId as the form value
      project_uuid: transaction.projectUuid || '',
      job_uuid: '', // Will be populated after jobs load
      financial_code_uuid: transaction.financialCodeUuid || '',
      nominal_currency_uuid: transaction.nominalCurrencyUuid || '',
      nominal_amount: transaction.nominalAmount || '',
      correction_date: initialCorrectionDate,
      parsing_lock: Boolean(transaction.parsingLock),
      comment: transaction.comment || '',
    };
    console.log('[startEdit] Initial formData:', initialFormData);
    setFormData(initialFormData);
    setLoadingOptions(true);
    setIsEditDialogOpen(true); // Open dialog immediately with loading state
    
    // Reset all search states
    setPaymentSearch('');
    setProjectSearch('');
    setJobSearch('');
    setFinancialCodeSearch('');
    setCurrencySearch('');
    
    try {
      // Fetch exchange rates for the transaction date upfront
      const effectiveDate = initialFormData.correction_date || transactionDateInput;
      const ratesResponse = await fetch(`/api/exchange-rates?date=${effectiveDate}`);
      const ratesData = await ratesResponse.json();
      const rates = ratesData && ratesData.length > 0 ? ratesData[0] : null;
      setExchangeRates(rates);
      setExchangeRateDate(effectiveDate);
      console.log('[startEdit] Loaded exchange rates for', effectiveDate, ':', rates);
      
      console.log('[startEdit] Total allPayments available:', allPayments.length);
      console.log('[startEdit] Transaction counteragentUuid:', transaction.counteragentUuid);
      console.log('[startEdit] Sample payment counteragentUuids:', allPayments.slice(0, 3).map((p: any) => ({ paymentId: p.paymentId, counteragentUuid: p.counteragentUuid })));

      updatePaymentOptions(transaction, allPayments);
      
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
        const jobs = Array.isArray(jobsData) ? jobsData : [];
        console.log('[startEdit] Loaded jobs:', jobs.length);
        setJobOptions(jobs);
        
        // Now set the job_uuid in formData if transaction has one
        // We need to find the matching job by UUID
        // Transaction stores jobUuid, jobs array has job_uuid field
        if (transaction.projectUuid && jobs.length > 0) {
          // Find if there's a job that matches - need to check transaction for job reference
          // For now, we'll rely on the payment's job if it exists
          console.log('[startEdit] Transaction has project, jobs available');
        }
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

  useEffect(() => {
    if (!autoEditId || transactions.length === 0) return;
    const match = transactions.find((tx) => Number(tx.id) === autoEditId);
    if (match) {
      startEdit(match);
      setAutoEditId(null);
    }
  }, [autoEditId, transactions]);

  useEffect(() => {
    if (!editingTransaction || !isEditDialogOpen) return;
    if (allPayments.length === 0) return;
    if (paymentOptions.length > 0) return;
    updatePaymentOptions(editingTransaction, allPayments);
  }, [allPayments.length, editingTransaction, isEditDialogOpen, paymentOptions.length]);

  useEffect(() => {
    if (renderMode !== 'dialog-only') return;
    if (isEditDialogOpen) {
      if (!wasDialogOpen) setWasDialogOpen(true);
      return;
    }
    if (wasDialogOpen && onDialogClose) {
      onDialogClose();
    }
  }, [renderMode, isEditDialogOpen, wasDialogOpen, onDialogClose]);

  const cancelEdit = () => {
    setEditingTransaction(null);
    setIsEditDialogOpen(false);
    setFormData({
      payment_uuid: '',
      project_uuid: '',
      job_uuid: '',
      financial_code_uuid: '',
      nominal_currency_uuid: '',
      nominal_amount: '',
      correction_date: '',
      parsing_lock: false,
      comment: '',
    });
    setPaymentDisplayValues({ projectLabel: '', jobLabel: '', financialCodeLabel: '', currencyLabel: '', nominalAmountLabel: '' });
    setJobOptions([]);
  };

  const openBatchEditor = async () => {
    if (!editingTransaction?.recordUuid && !editingTransaction?.batchId) {
      setBatchEditorError('Missing batch reference for this transaction');
      return;
    }
    setBatchEditorError(null);
    setBatchInitialPartitions(null);
    setBatchEditorUuid(null);
    setIsBatchEditorOpen(true);
    setBatchEditorLoading(true);

    try {
      let existingBatch: any = null;
      if (editingTransaction?.recordUuid) {
        const statusResponse = await fetch(`/api/bank-transaction-batches?rawRecordUuid=${editingTransaction.recordUuid}`);
        if (!statusResponse.ok) {
          throw new Error('Failed to check batch status');
        }
        const statusData = await statusResponse.json();
        existingBatch = Array.isArray(statusData?.batches) ? statusData.batches[0] : null;
      }
      const batchLookupUrl = existingBatch?.batchUuid
        ? `/api/bank-transaction-batches?batchUuid=${existingBatch.batchUuid}`
        : editingTransaction?.batchId
          ? `/api/bank-transaction-batches?batchId=${encodeURIComponent(editingTransaction.batchId)}`
          : null;

      if (batchLookupUrl) {
        const batchResponse = await fetch(batchLookupUrl);
        if (!batchResponse.ok) {
          throw new Error('Failed to load batch partitions');
        }
        const batchData = await batchResponse.json();
        const partitions = Array.isArray(batchData?.partitions) ? batchData.partitions : [];
        const mapped = partitions.map((p: any, index: number) => ({
          id: String(index + 1),
          partitionAmount: Number(p.partition_amount ?? p.partitionAmount ?? 0),
          paymentUuid: p.payment_uuid || p.paymentUuid || null,
          paymentId: p.payment_id || p.paymentId || null,
          counteragentUuid: p.counteragent_uuid || null,
          projectUuid: p.project_uuid || null,
          financialCodeUuid: p.financial_code_uuid || null,
          nominalCurrencyUuid: p.nominal_currency_uuid || null,
          nominalAmount: p.nominal_amount ? Number(p.nominal_amount) : null,
          partitionNote: p.partition_note || '',
        }));
        setBatchEditorUuid(batchData?.batchUuid || existingBatch?.batchUuid || null);
        setBatchInitialPartitions(mapped);
      } else {
        if (editingTransaction?.paymentId) {
          const fallbackPartition = {
            id: '1',
            partitionAmount: Math.abs(Number(editingTransaction.accountCurrencyAmount || 0)),
            paymentUuid: null,
            paymentId: editingTransaction.paymentId || null,
            counteragentUuid: editingTransaction.counteragentUuid || null,
            projectUuid: editingTransaction.projectUuid || null,
            financialCodeUuid: editingTransaction.financialCodeUuid || null,
            nominalCurrencyUuid: editingTransaction.nominalCurrencyUuid || null,
            nominalAmount: editingTransaction.nominalAmount !== null && editingTransaction.nominalAmount !== undefined
              ? Math.abs(Number(editingTransaction.nominalAmount))
              : null,
            partitionNote: '',
          };
          setBatchInitialPartitions([fallbackPartition]);
        } else {
          setBatchEditorError('No batch found for this transaction');
        }
      }
    } catch (error: any) {
      setBatchEditorError(error?.message || 'Failed to load batch editor');
    } finally {
      setBatchEditorLoading(false);
    }
  };

  const handleBatchEditorClose = () => {
    setIsBatchEditorOpen(false);
    setBatchEditorLoading(false);
    setBatchEditorUuid(null);
    setBatchInitialPartitions(null);
    setBatchEditorError(null);
  };

  const handleBatchEditorSaved = () => {
    handleBatchEditorClose();
    if (editingTransaction?.recordUuid) {
      refreshTransactionsByRawRecordUuid(editingTransaction.recordUuid, editingTransaction);
    }
    cancelEdit();
  };

  const deassignBatchForPayment = async () => {
    const rawRecordUuid = editingTransaction?.recordUuid;
    if (!rawRecordUuid) {
      alert('Transaction record is missing.');
      return;
    }

    if (!confirm('Deassign this transaction from all batches?')) return;

    try {
      const response = await fetch(`/api/bank-transaction-batches?rawRecordUuid=${encodeURIComponent(rawRecordUuid)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error || 'Failed to deassign payment from batches');
      }

      if (editingTransaction?.recordUuid) {
        await refreshTransactionsByRawRecordUuid(editingTransaction.recordUuid, editingTransaction);
      }
      alert('Transaction deassigned from batches.');
    } catch (error: any) {
      alert(error?.message || 'Failed to deassign payment from batches');
    }
  };

  // Handle payment selection - auto-fill related fields
  const handlePaymentChange = (paymentId: string) => {
    console.log('[handlePaymentChange] START - paymentId:', paymentId);
    console.log('[handlePaymentChange] exchangeRates:', exchangeRates);
    console.log('[handlePaymentChange] currencyOptions count:', currencyOptions.length);
    console.log('[handlePaymentChange] editingTransaction:', editingTransaction);
    
    const newFormData = { ...formData, payment_uuid: paymentId === '__none__' ? '' : paymentId };
    
    if (paymentId && paymentId !== '__none__') {
      const selectedPayment = paymentOptions.find(p => p.paymentId === paymentId);
      console.log('[handlePaymentChange] selectedPayment:', selectedPayment);
      
      if (selectedPayment && editingTransaction) {
        newFormData.project_uuid = selectedPayment.projectUuid || '';
        newFormData.job_uuid = selectedPayment.jobUuid || '';
        newFormData.financial_code_uuid = selectedPayment.financialCodeUuid || '';
        newFormData.nominal_currency_uuid = selectedPayment.currencyUuid || '';
        
        // Calculate nominal amount using cached exchange rates
        let calculatedAmount = formatAmount(editingTransaction.accountCurrencyAmount);
        
        if (exchangeRates && currencyOptions.length > 0) {
          try {
            const accountAmount = Number(editingTransaction.accountCurrencyAmount);
            
            // Get currency codes
            const accountCurrency = currencyOptions.find(c => c.uuid === editingTransaction.accountCurrencyUuid);
            const accountCode = accountCurrency?.code || 'GEL';
            const nominalCode = selectedPayment.currencyCode;
            
            console.log('[handlePaymentChange] Converting:', accountCode, 'G��', nominalCode, 'Amount:', accountAmount);
            console.log('[handlePaymentChange] Exchange rates object:', exchangeRates);
            
            const calculatedRate = getExchangeRateValue(nominalCode);
            if (calculatedRate && Number.isFinite(calculatedRate) && calculatedRate !== 0) {
              const converted = accountAmount * (1 / calculatedRate);
              calculatedAmount = formatAmount(Math.round(converted * 100) / 100);
            }
          } catch (error) {
            console.error('[handlePaymentChange] Calculation error:', error);
          }
        } else if (editingTransaction?.nominalExchangeRate) {
          const storedRate = Number(editingTransaction.nominalExchangeRate);
          if (Number.isFinite(storedRate) && storedRate !== 0) {
            const accountAmount = Number(editingTransaction.accountCurrencyAmount);
            const converted = accountAmount / storedRate;
            calculatedAmount = formatAmount(Math.round(converted * 100) / 100);
            console.log('[handlePaymentChange] Fallback to nominalExchangeRate:', storedRate, '=>', converted);
          }
        } else {
          console.warn('[handlePaymentChange] Missing exchangeRates or currencyOptions');
        }
        
        console.log('[handlePaymentChange] Final calculatedAmount:', calculatedAmount);
        
        // Store display labels
        setPaymentDisplayValues({
          projectLabel: selectedPayment.projectIndex || 'N/A',
          jobLabel: selectedPayment.jobName || 'N/A',
          financialCodeLabel: selectedPayment.financialCodeValidation || '',
          currencyLabel: selectedPayment.currencyCode || '',
          nominalAmountLabel: calculatedAmount,
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
        nominalAmountLabel: '',
      });
      
      setJobOptions([]);
    }
    
    setFormData(newFormData);
    setPaymentSearch('');
  };

  const recomputeNominalAmountLabel = () => {
    if (!editingTransaction) return;
    const selectedPayment = formData.payment_uuid
      ? paymentOptions.find(p => p.paymentId === formData.payment_uuid)
      : null;
    const nominalCode = selectedPayment?.currencyCode || editingTransaction.nominalCurrencyCode || '';
    if (!nominalCode) return;

    const accountAmountRaw = Number(editingTransaction.accountCurrencyAmount);
    const nominalAmountRaw = Number(editingTransaction.nominalAmount);
    const storedNominalRate = editingTransaction.nominalExchangeRate
      ? Number(editingTransaction.nominalExchangeRate)
      : null;
    let calculatedAmount = formatAmount(editingTransaction.accountCurrencyAmount);
    let rateLabel = '';

    if (exchangeRates && currencyOptions.length > 0) {
      try {
        const accountAmount = Number(editingTransaction.accountCurrencyAmount);
        const exchangeRate = getExchangeRateValue(nominalCode);

        if (exchangeRate && Number.isFinite(exchangeRate) && exchangeRate !== 0) {
          const converted = accountAmount * (1 / exchangeRate);
          calculatedAmount = formatAmount(Math.round(converted * 100) / 100);
          rateLabel = exchangeRate.toFixed(10);
        }
      } catch (error) {
        console.error('[recomputeNominalAmountLabel] Calculation error:', error);
      }
    }

    if (!rateLabel && Number.isFinite(storedNominalRate) && storedNominalRate) {
      calculatedAmount = formatAmount(Math.round((accountAmountRaw / storedNominalRate) * 100) / 100);
      rateLabel = storedNominalRate.toFixed(10);
    }

    if (!rateLabel && Number.isFinite(accountAmountRaw) && Number.isFinite(nominalAmountRaw) && nominalAmountRaw !== 0) {
      const derivedRate = Math.abs(accountAmountRaw) / Math.abs(nominalAmountRaw);
      if (Number.isFinite(derivedRate)) {
        rateLabel = derivedRate.toFixed(10);
      }
    }

    setPaymentDisplayValues((prev) => ({
      projectLabel: selectedPayment?.projectIndex || prev.projectLabel,
      jobLabel: selectedPayment?.jobName || prev.jobLabel,
      financialCodeLabel: selectedPayment?.financialCodeValidation || prev.financialCodeLabel,
      currencyLabel: selectedPayment?.currencyCode || prev.currencyLabel || nominalCode,
      nominalAmountLabel: calculatedAmount,
    }));
    setCalculatedExchangeRate(rateLabel);
  };

  useEffect(() => {
    if (!editingTransaction) return;
    recomputeNominalAmountLabel();
  }, [formData.payment_uuid, formData.correction_date, exchangeRates, currencyOptions, editingTransaction, paymentOptions]);

  useEffect(() => {
    if (!editingTransaction) return;
    const effectiveDate = formData.correction_date || toInputDate(editingTransaction.date);
    if (!effectiveDate || effectiveDate === exchangeRateDate) return;
    const fetchRates = async () => {
      try {
        const ratesResponse = await fetch(`/api/exchange-rates?date=${effectiveDate}`);
        const ratesData = await ratesResponse.json();
        const rates = ratesData && ratesData.length > 0 ? ratesData[0] : null;
        setExchangeRates(rates);
        setExchangeRateDate(effectiveDate);
      } catch (error) {
        console.error('[exchangeRates] Failed to load rates for', effectiveDate, error);
      }
    };
    fetchRates();
  }, [formData.correction_date, editingTransaction, exchangeRateDate]);

  const getExchangeRateValue = (overrideNominalCode?: string) => {
    if (!exchangeRates || !editingTransaction) return null;
    const accountCode = currencyOptions.find((c) => c.uuid === editingTransaction.accountCurrencyUuid)?.code || 'GEL';
    const nominalCode = overrideNominalCode || paymentDisplayValues.currencyLabel || editingTransaction.nominalCurrencyCode || '';
    if (!nominalCode) return null;

    if (accountCode === nominalCode) return 1;
    if (accountCode === 'GEL' && nominalCode !== 'GEL') {
      const rate = exchangeRates[nominalCode.toLowerCase()];
      return rate ? Number(rate) : null;
    }
    if (accountCode !== 'GEL' && nominalCode === 'GEL') {
      const rate = exchangeRates[accountCode.toLowerCase()];
      return rate ? Number(rate) : null;
    }
    const accountRate = exchangeRates[accountCode.toLowerCase()];
    const nominalRate = exchangeRates[nominalCode.toLowerCase()];
    if (accountRate && nominalRate) {
      return Number(accountRate) / Number(nominalRate);
    }
    return null;
  };

  const getExchangeRateLabel = () => {
    const rate = getExchangeRateValue();
    return rate && Number.isFinite(rate) ? rate.toFixed(10) : '';
  };

  const getLiveNominalAmountLabel = () => {
    if (!editingTransaction) return '';
    const nominalCode = paymentDisplayValues.currencyLabel || editingTransaction.nominalCurrencyCode || '';
    if (!nominalCode) return paymentDisplayValues.nominalAmountLabel || editingTransaction.nominalAmount || '';

    const exchangeRate = getExchangeRateValue(nominalCode);
    if (!exchangeRate || !Number.isFinite(exchangeRate) || exchangeRate === 0) {
      return paymentDisplayValues.nominalAmountLabel || editingTransaction.nominalAmount || '';
    }

    const accountAmount = Number(editingTransaction.accountCurrencyAmount);
    if (!Number.isFinite(accountAmount)) {
      return paymentDisplayValues.nominalAmountLabel || editingTransaction.nominalAmount || '';
    }

    const converted = accountAmount * (1 / exchangeRate);
    return formatAmount(Math.round(converted * 100) / 100);
  };

  // Handle project change - load jobs for new project
  const handleProjectChange = async (projectUuid: string) => {
    const isClearing = projectUuid === '__none__' || !projectUuid;
    const newFormData = { ...formData, project_uuid: isClearing ? '' : projectUuid, job_uuid: '' };
    setFormData(newFormData);
    setProjectSearch('');
    
    if (!isClearing) {
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
          nominalAmountLabel: `Will be recalculated to ${matchingPayment.currencyCode || 'currency'}`,
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
      const transactionDateInput = toInputDate(editingTransaction.date);
      if (formData.correction_date !== toInputDate(editingTransaction.correctionDate)) {
        updateData.correction_date =
          formData.correction_date && formData.correction_date !== transactionDateInput
            ? formData.correction_date
            : null;
      }
      if (formData.parsing_lock !== Boolean(editingTransaction.parsingLock)) {
        updateData.parsing_lock = formData.parsing_lock;
      }
      const currentComment = editingTransaction.comment || '';
      if (formData.comment !== currentComment) {
        updateData.comment = formData.comment ? formData.comment : null;
      }
      // Note: nominal_amount is calculated on backend based on currency change

      const { parsing_lock, ...mainUpdate } = updateData;

      if (Object.keys(mainUpdate).length === 0 && parsing_lock === undefined) {
        cancelEdit();
        return;
      }

      if (parsing_lock !== undefined) {
        const lockParams = editingTransaction.sourceTable && editingTransaction.sourceId !== undefined
          ? `?sourceTable=${encodeURIComponent(editingTransaction.sourceTable)}&sourceId=${encodeURIComponent(String(editingTransaction.sourceId))}`
          : '';
        const lockResponse = await fetch(`${apiBasePath}/parsing-lock/${editingTransaction.id}${lockParams}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parsing_lock }),
        });

        if (!lockResponse.ok) {
          const lockError = await lockResponse.json().catch(() => ({}));
          throw new Error(lockError?.error || 'Failed to update parsing lock');
        }
      }

      if (Object.keys(mainUpdate).length === 0) {
        cancelEdit();
        return;
      }

      const updateParams = editingTransaction.sourceTable && editingTransaction.sourceId !== undefined
        ? `?sourceTable=${encodeURIComponent(editingTransaction.sourceTable)}&sourceId=${encodeURIComponent(String(editingTransaction.sourceId))}`
        : '';
      const response = await fetch(`${apiBasePath}/${editingTransaction.id}${updateParams}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mainUpdate),
      });

      const result = await response.json();

      if (response.ok) {
        // Fetch the updated transaction to get calculated values (like nominal_amount)
        const updated = await refreshTransactionById(editingTransaction.id, editingTransaction);
        if (!updated) {
          alert('Saved, but failed to refresh the edited row. Please try again if data looks stale.');
        }

        // Close dialog and reset state
        cancelEdit();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Failed to save: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const runReparseTransaction = async () => {
    if (!editingTransaction) return;
    if (!editingTransaction.sourceTable || editingTransaction.sourceId === undefined || editingTransaction.sourceId === null) {
      alert('Source table information is missing for this transaction.');
      return;
    }

    setIsReparseRunning(true);
    try {
      const response = await fetch('/api/bank-transactions/reparse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceTable: editingTransaction.sourceTable,
          sourceId: editingTransaction.sourceId,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to reparse transaction');
      }

      const updatedResponse = await fetch(`${apiBasePath}?ids=${editingTransaction.id}`);
      if (updatedResponse.ok) {
        const updatedData = await updatedResponse.json();
        if (Array.isArray(updatedData) && updatedData[0]) {
          const row = updatedData[0];
          const mapped = {
            id: row.id,
            uuid: row.uuid || "",
            accountUuid: row.bank_account_uuid || "",
            accountCurrencyUuid: row.account_currency_uuid || "",
            accountCurrencyCode: row.account_currency_code || row.accountCurrencyCode || null,
            accountCurrencyAmount: row.account_currency_amount || "0",
            paymentUuid: null,
            counteragentUuid: row.counteragent_uuid || null,
            projectUuid: row.project_uuid || null,
            financialCodeUuid: row.financial_code_uuid || null,
            nominalCurrencyUuid: row.nominal_currency_uuid || null,
            nominalAmount: row.nominal_amount || null,
            date: row.transaction_date || "",
            correctionDate: row.correction_date || null,
            exchangeRate: row.exchange_rate || null,
            nominalExchangeRate: row.nominal_exchange_rate || null,
            id1: row.id1 || row.dockey || null,
            id2: row.id2 || row.entriesid || null,
            recordUuid: row.raw_record_uuid || "",
            counteragentAccountNumber: row.counteragent_account_number || null,
            description: row.description || null,
            comment: row.comment ?? null,
            processingCase: row.processing_case || null,
            appliedRuleId: row.applied_rule_id || null,
            parsingLock: row.parsing_lock ?? false,
            createdAt: row.created_at || "",
            updatedAt: row.updated_at || "",
            isBalanceRecord: row.is_balance_record || false,
            accountNumber: row.account_number || null,
            bankName: row.bank_name || null,
            counteragentName: row.counteragent_name || null,
            projectIndex: row.project_index || null,
            financialCode: row.financial_code || null,
            paymentId: row.payment_id || null,
            nominalCurrencyCode: row.nominal_currency_code || null,
            sourceTable: row.source_table || editingTransaction.sourceTable,
            sourceId: row.source_id ?? editingTransaction.sourceId,
          };

          setTransactions((prev) =>
            prev.map((t) => (t.id === editingTransaction.id ? mapped : t))
          );
          onTransactionUpdated?.(mapped);
        }
      }
    } catch (error: any) {
      alert(error?.message || 'Failed to reparse transaction');
    } finally {
      setIsReparseRunning(false);
    }
  };

  const runReparsePayment = async () => {
    const paymentId = formData.payment_uuid || editingTransaction?.paymentId;
    if (!paymentId) {
      alert('Payment ID is required to reparse by payment.');
      return;
    }

    if (!confirm(`Reparse all transactions for payment ID: ${paymentId}?`)) return;

    setIsReparseRunning(true);
    try {
      const response = await fetch('/api/bank-transactions/reparse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to reparse payment transactions');
      }

      alert(`Reparse complete. Updated ${result?.updated ?? 0} record(s).`);
    } catch (error: any) {
      alert(error?.message || 'Failed to reparse payment transactions');
    } finally {
      setIsReparseRunning(false);
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

  const visibleColumns = columns.filter(col => col.visible);
  const totalWidth = visibleColumns.reduce((sum, col) => sum + col.width, 0);

  const formatExportValue = (key: ColumnKey, value: BankTransaction[ColumnKey]) => {
    if (value === null || value === undefined) return '';
    if (key === 'accountCurrencyAmount' || key === 'nominalAmount') {
      const num = Number(value);
      return Number.isNaN(num) ? String(value) : num;
    }
    if (key === 'usdGelRate') {
      const num = Number(value);
      return Number.isNaN(num) ? String(value) : Number(num.toFixed(6));
    }
    if (key === 'exchangeRate') {
      const num = Number(value);
      return Number.isNaN(num) ? String(value) : Number(num.toFixed(10));
    }
    if (key === 'parsingLock') {
      return value ? 'Yes' : 'No';
    }
    if (key === 'date' || key === 'correctionDate' || key === 'createdAt' || key === 'updatedAt') {
      return formatDate(String(value));
    }
    return String(value);
  };

  const dateKeys: ColumnKey[] = ['date', 'correctionDate', 'createdAt', 'updatedAt'];

  const toExcelSerial = (value: string) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d{2}\.\d{2}\.\d{4}$/.test(trimmed)) {
      const [dayStr, monthStr, yearStr] = trimmed.split('.');
      const day = Number(dayStr);
      const month = Number(monthStr);
      const year = Number(yearStr);
      if (!day || !month || !year) return null;
      const utc = Date.UTC(year, month - 1, day);
      return utc / 86400000 + 25569;
    }

    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const [yearStr, monthStr, dayStr] = trimmed.slice(0, 10).split('-');
      const day = Number(dayStr);
      const month = Number(monthStr);
      const year = Number(yearStr);
      if (!day || !month || !year) return null;
      const utc = Date.UTC(year, month - 1, day);
      return utc / 86400000 + 25569;
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    const utc = Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
    return utc / 86400000 + 25569;
  };

  const handleExportXlsx = () => {
    if (filteredData.length === 0) {
      alert('No data to export');
      return;
    }
    try {
      setIsExporting(true);
      const exportColumns = visibleColumns;
      const header = exportColumns.map(col => col.label);
      const rows = filteredData.map(row =>
        exportColumns.map(col => formatExportValue(col.key, row[col.key]))
      );
      const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
      const dateColumnIndexes = exportColumns
        .map((col, index) => (dateKeys.includes(col.key) ? index : -1))
        .filter((index) => index >= 0);

      if (dateColumnIndexes.length > 0) {
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
          for (const colIndex of dateColumnIndexes) {
            const value = rows[rowIndex][colIndex];
            const serial = toExcelSerial(String(value || ''));
            if (serial === null) continue;
            const cellAddress = XLSX.utils.encode_cell({ r: rowIndex + 1, c: colIndex });
            worksheet[cellAddress] = { t: 'n', v: serial, z: 'dd.mm.yyyy' };
          }
        }
      }
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Bank Transactions');
      const dateStamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `bank-transactions-${dateStamp}.xlsx`, { bookType: 'xlsx' });
    } finally {
      setIsExporting(false);
    }
  };

  const normalizeImportHeader = (value: any) => String(value || '').trim().toLowerCase();

  const mapImportHeaderToKey = (header: string) => {
    const normalized = normalizeImportHeader(header);
    if (normalized === 'id1' || normalized === 'dockey') return 'id1';
    if (normalized === 'id2' || normalized === 'entriesid') return 'id2';
    if (normalized === 'payment id' || normalized === 'payment_id' || normalized === 'paymentid') return 'paymentId';
    if (normalized === 'amount' || normalized === 'accountcurrencyamount') return 'accountCurrencyAmount';
    if (normalized === 'nominal amt' || normalized === 'nominal amount' || normalized === 'nominalamount') return 'nominalAmount';
    if (normalized === 'nom iso' || normalized === 'nominal currency' || normalized === 'nominalcurrencycode') return 'nominalCurrencyCode';
    return null;
  };

  const parseImportRows = (data: any[][]) => {
    if (data.length === 0) return { rows: [], errors: ['Empty sheet'] };
    const [headerRow, ...bodyRows] = data;
    const headerKeys = headerRow.map((cell) => mapImportHeaderToKey(cell));

    const headerKeySet = new Set(headerKeys.filter((key) => Boolean(key)));
    const required = ['id1', 'id2', 'paymentId'] as const;
    const missingRequired = required.filter((key) => !headerKeySet.has(key));
    if (missingRequired.length > 0) {
      return {
        rows: [],
        errors: [`Missing required columns: ${missingRequired.join(', ')}`],
      };
    }

    const rows = bodyRows
      .filter((row) => row.some((cell: any) => String(cell || '').trim() !== ''))
      .map((row) => {
        const record: any = {};
        headerKeys.forEach((key, idx) => {
          if (!key) return;
          record[key] = row[idx];
        });
        return {
          id1: String(record.id1 || '').trim(),
          id2: String(record.id2 || '').trim(),
          paymentId: String(record.paymentId || '').trim(),
          accountCurrencyAmount: record.accountCurrencyAmount ?? null,
          nominalAmount: record.nominalAmount ?? null,
          nominalCurrencyCode: record.nominalCurrencyCode ?? null,
        };
      })
      .filter((row) => row.id1 || row.id2 || row.paymentId);

    return { rows, errors: [] };
  };

  const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportPreviewRows([]);
    setImportSummary(null);
    setImportFileName(file.name);

    try {
      setIsImporting(true);
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false }) as any[][];
      const parsed = parseImportRows(data);
      if (parsed.errors.length > 0) {
        setImportError(parsed.errors.join(' '));
        setIsImportDialogOpen(true);
        return;
      }

      setPendingImportRows(parsed.rows);
      const response = await fetch('/api/bank-transactions/import-xlsx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'preview', rows: parsed.rows }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to preview import');
      }

      setImportPreviewRows(Array.isArray(result?.rows) ? result.rows : []);
      setImportSummary(result?.summary || null);
      setIsImportDialogOpen(true);
    } catch (error: any) {
      setImportError(error?.message || 'Failed to read XLSX');
      setIsImportDialogOpen(true);
    } finally {
      setIsImporting(false);
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  };

  const handleApplyImport = async () => {
    if (pendingImportRows.length === 0) return;
    try {
      setIsImporting(true);
      const response = await fetch('/api/bank-transactions/import-xlsx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'apply', rows: pendingImportRows }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to apply import');
      }

      const errorText = Array.isArray(result?.errors) && result.errors.length > 0
        ? ` Warnings: ${result.errors.join(' | ')}`
        : '';
      alert(`Import complete. Updated ${result?.updated ?? 0} record(s), created ${result?.batchesCreated ?? 0} batch(es).${errorText}`);
      setIsImportDialogOpen(false);
      window.location.reload();
    } catch (error: any) {
      setImportError(error?.message || 'Failed to apply import');
    } finally {
      setIsImporting(false);
    }
  };

  const loadBackparsePreview = async () => {
    setIsBackparseLoading(true);
    setBackparseError(null);
    try {
      const response = await fetch(`${apiBasePath}/backparse-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: backparseLimit, offset: 0 }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to load preview');
      }
      const result = await response.json();
      const changes = Array.isArray(result?.changes) ? result.changes : [];
      setBackparsePreview(changes);
      setSelectedBackparseIds(new Set(changes.map((item: BackparsePreviewItem) => item.id)));
    } catch (error: any) {
      setBackparseError(error?.message || 'Failed to load preview');
    } finally {
      setIsBackparseLoading(false);
    }
  };

  const toggleBackparseSelection = (id: number) => {
    setSelectedBackparseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllBackparse = () => {
    setSelectedBackparseIds(new Set(backparsePreview.map((item) => item.id)));
  };

  const clearBackparseSelection = () => {
    setSelectedBackparseIds(new Set());
  };

  const updateParsingLockForSelection = async (lock: boolean) => {
    const ids = Array.from(selectedBackparseIds);
    if (ids.length === 0) {
      alert('Select at least one record.');
      return;
    }
    setIsBackparseRunning(true);
    try {
      const response = await fetch(`${apiBasePath}/parsing-lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, parsing_lock: lock }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to update parsing lock');
      }
      await loadBackparsePreview();
    } catch (error: any) {
      alert(error?.message || 'Failed to update parsing lock');
    } finally {
      setIsBackparseRunning(false);
    }
  };

  const runBackparseForSelection = async () => {
    const ids = Array.from(selectedBackparseIds);
    if (ids.length === 0) {
      alert('Select at least one record.');
      return;
    }
    if (!confirm(`Backparse ${ids.length} selected record(s)?`)) {
      return;
    }
    setIsBackparseRunning(true);
    try {
      const response = await fetch(`${apiBasePath}/backparse-selected`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Backparse failed');
      }
      const result = await response.json();
      alert(`Backparse complete. Updated ${result?.updated ?? 0} record(s).`);
      window.location.reload();
    } catch (error: any) {
      alert(error?.message || 'Backparse failed');
    } finally {
      setIsBackparseRunning(false);
    }
  };

  const updateRawRecordParsingLock = async (checked: boolean) => {
    if (!viewingRawRecord?.id) return;
    setIsRawLockUpdating(true);
    try {
      const response = await fetch(`${apiBasePath}/parsing-lock/${viewingRawRecord.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsing_lock: checked }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to update parsing lock');
      }
      setViewingRawRecord((prev: any) => ({
        ...prev,
        parsing_lock: checked,
      }));
    } catch (error: any) {
      alert(error?.message || 'Failed to update parsing lock');
    } finally {
      setIsRawLockUpdating(false);
    }
  };

  return (
    <div className={showFullTable ? 'flex flex-col h-screen' : 'flex flex-col'}>
      {showFullTable && (
        <>
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-4 border-b bg-white">
        <div className="flex-1 min-w-0 w-full sm:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search transactions (regex supported)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-9 w-full"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
            )}
          </div>
          {debouncedSearchTerm && (
            <p className="text-xs text-muted-foreground mt-1">
              Searching in: Counteragent, CA Account, Project, Payment ID, Fin. Code, Description
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {Object.keys(columnFilters).length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setColumnFilters({})}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Clear Filters
            </Button>
          )}
          {/* Upload XML Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx"
            onChange={handleImportFileChange}
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

          <Button
            variant="outline"
            size="sm"
            onClick={() => importInputRef.current?.click()}
            disabled={isImporting}
          >
            <Upload className="h-4 w-4 mr-2" />
            {isImporting ? 'Importing...' : 'Import XLSX'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportXlsx}
            disabled={isExporting}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export XLSX'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsBackparseDialogOpen(true);
              loadBackparsePreview();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Backparse Preview
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
        <div className="border-l pl-6">
          {currencySummaries && currencySummaries.length > 0 && (
            <span className="mr-4">
              <span className="text-gray-600">Opening:</span>
              <span className="ml-2 font-semibold text-blue-900">
                {parseFloat(currencySummaries[0].opening_balance || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </span>
          )}
          <span className="text-gray-600">Inflow:</span>
          <span className="ml-2 font-semibold text-green-600">
            {summaryStats.inflow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div>
          <span className="text-gray-600">Outflow:</span>
          <span className="ml-2 font-semibold text-red-600">
            {summaryStats.outflow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div>
          <span className="text-gray-600">Balance:</span>
          <span className={`ml-2 font-semibold ${summaryStats.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {summaryStats.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
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
                      {col.filterable && (
                        <ColumnFilterPopover
                          columnKey={col.key}
                          columnLabel={col.label}
                          values={getColumnUniqueValues(col.key)}
                          activeFilters={new Set(columnFilters[col.key] || [])}
                          onFilterChange={(values) =>
                            setColumnFilters((prev) => ({
                              ...prev,
                              [col.key]: Array.from(values)
                            }))
                          }
                          onSort={(direction) => {
                            setSortField(col.key);
                            setSortDirection(direction);
                          }}
                        />
                      )}
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
                <th className="font-semibold text-left px-4 py-3 text-sm" style={{ width: 140 }}>Actions</th>
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
                              ) : col.key === 'usdGelRate' ? (
                                row[col.key] !== null && row[col.key] !== undefined
                                  ? Number(row[col.key]).toFixed(6)
                                  : '-'
                          ) : col.key === 'exchangeRate' ? (
                            row[col.key] ? Number(row[col.key]).toFixed(10) : '-'
                          ) : col.key === 'parsingLock' ? (
                            <Checkbox checked={Boolean(row[col.key])} disabled className="cursor-default" />
                          ) : col.key === 'date' || col.key === 'correctionDate' || col.key === 'createdAt' || col.key === 'updatedAt' ? (
                            formatDate(row[col.key])
                          ) : col.key === 'counteragentAccountNumber' ? (
                            row[col.key] ? String(row[col.key]) : '-'
                          ) : (
                            typeof row[col.key] === 'object' && row[col.key] !== null
                              ? JSON.stringify(row[col.key])
                              : row[col.key] ?? '-'
                          )}
                        </div>
                      </td>
                    ))}
                    <td className="px-4 py-2 text-sm" style={{ width: 140 }}>
                      <div className="flex items-center space-x-1">
                        {!row.isBalanceRecord && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => viewRawRecord(row.uuid, row)}
                              className="h-7 w-7 p-0"
                              title="View raw record"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            {enableEditing && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startEdit(row)}
                                className="h-7 w-7 p-0"
                                title="Edit transaction"
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            )}
                          </>
                        )}
                        {row.isBalanceRecord && (
                          <span className="text-xs text-muted-foreground italic">
                            Balance record
                          </span>
                        )}
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

        </>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-[1120px]">
          <DialogHeader>
            <DialogTitle>Edit Bank Transaction</DialogTitle>
            <DialogDescription>
              Update transaction details and link to a payment
            </DialogDescription>
          </DialogHeader>
          {loadingOptions ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading transaction data...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Payment ID Selection - Always visible at top */}
              <div className="space-y-2">
                <Label>Payment ID</Label>
                <Select 
                  value={formData.payment_uuid || '__none__'} 
                  onValueChange={handlePaymentChange}
                >
                  <SelectTrigger className="border-2 border-gray-400 w-full">
                    <SelectValue placeholder="-- Select Payment --" />
                  </SelectTrigger>
                  <SelectContent className="w-full">
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
                              payment.counteragentName?.toLowerCase().includes(searchLower) ||
                              payment.jobName?.toLowerCase().includes(searchLower) ||
                              payment.currencyCode?.toLowerCase().includes(searchLower) ||
                              payment.projectIndex?.toLowerCase().includes(searchLower) ||
                              payment.financialCodeValidation?.toLowerCase().includes(searchLower)
                            );
                          })
                          .map((payment) => (
                            <SelectItem key={payment.paymentId} value={payment.paymentId}>
                              {payment.paymentId}
                              {(payment.projectIndex || payment.jobName || payment.financialCodeValidation) && (
                                <span className="text-muted-foreground text-xs">
                                  {' | '}{payment.projectIndex || '-'}
                                  {payment.jobName && ` | ${payment.jobName}`}
                                  {' | '}{payment.financialCodeValidation || '-'}
                                </span>
                              )}
                            </SelectItem>
                          ))}
                      </div>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    {editingTransaction?.counteragentUuid 
                      ? paymentOptions.length > 0
                        ? `Showing ${paymentOptions.length} payment${paymentOptions.length === 1 ? '' : 's'} for counteragent: ${editingTransaction.counteragentName || 'Unknown'}`
                        : `G��n+� No payments found for counteragent: ${editingTransaction.counteragentName || 'Unknown'}. Create a payment for this counteragent first.`
                      : `Showing all ${paymentOptions.length} payments (no counteragent parsed)`}
                  </p>
                  <div className="flex items-center gap-2 pt-2">
                    <Checkbox
                      checked={formData.parsing_lock}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, parsing_lock: Boolean(checked) }))
                      }
                    />
                    <Label className="text-sm">Parsing lock (skip during backparse)</Label>
                  </div>
                  <div className="pt-2 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={openBatchEditor}
                      disabled={!editingTransaction?.recordUuid || !editingTransaction?.id1 || !editingTransaction?.id2 || !editingTransaction?.accountUuid}
                    >
                      Split into batches
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={deassignBatchForPayment}
                      disabled={!editingTransaction?.recordUuid}
                    >
                      Deassign batch
                    </Button>
                    {batchEditorError && (
                      <p className="mt-2 text-xs text-red-600">{batchEditorError}</p>
                    )}
                  </div>
                </div>

              {/* Payment Details Section - Read-only when payment is selected */}
              {formData.payment_uuid && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Payment Details</h3>

                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-600">Counteragent</Label>
                      <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                        <span className="font-bold" style={{ color: '#000' }}>
                          {editingTransaction?.counteragentName || 'N/A'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-600">Currency</Label>
                      <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                        <span className="font-bold" style={{ color: '#000' }}>{paymentDisplayValues.currencyLabel || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-600">Exchange Rate</Label>
                      <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                        <span className="font-bold" style={{ color: '#000' }}>
                          {getExchangeRateLabel()
                            ? getExchangeRateLabel()
                            : calculatedExchangeRate
                              ? calculatedExchangeRate
                              : editingTransaction?.nominalExchangeRate
                                ? Number(editingTransaction.nominalExchangeRate).toFixed(10)
                                : editingTransaction?.exchangeRate
                                  ? Number(editingTransaction.exchangeRate).toFixed(10)
                                  : 'N/A'}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-600">Nominal Amount</Label>
                      <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                        <span className="font-bold" style={{ color: '#000' }}>
                          {getLiveNominalAmountLabel() || '0.00'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Project</Label>
                    <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                      <span className="font-bold" style={{ color: '#000' }}>{paymentDisplayValues.projectLabel || 'N/A'}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Job</Label>
                    <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                      <span className="font-bold" style={{ color: '#000' }}>{paymentDisplayValues.jobLabel || 'N/A'}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Financial Code</Label>
                    <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                      <span className="font-bold" style={{ color: '#000' }}>{paymentDisplayValues.financialCodeLabel || 'N/A'}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Nominal Currency</Label>
                    <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                      <span className="font-bold" style={{ color: '#000' }}>{paymentDisplayValues.currencyLabel || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Manual Entry Fields - Only show when no payment selected */}
              {!formData.payment_uuid && (
                <div className="space-y-4 pt-2">
                  {/* Project */}
                  <div className="space-y-2">
                    <Label>Project</Label>
                    <Select 
                      value={formData.project_uuid || '__none__'} 
                      onValueChange={handleProjectChange}
                    >
                      <SelectTrigger className="border-2 border-gray-400">
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
                  </div>

                  {/* Job */}
                  <div className="space-y-2">
                    <Label>Job</Label>
                    <Select 
                      value={formData.job_uuid || '__none__'} 
                      onValueChange={handleJobChange}
                      disabled={!formData.project_uuid}
                    >
                      <SelectTrigger className="border-2 border-gray-400">
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
                  </div>

                  {/* Financial Code */}
                  <div className="space-y-2">
                    <Label>Financial Code</Label>
                    <Select 
                      value={formData.financial_code_uuid || '__none__'} 
                      onValueChange={handleFinancialCodeChange}
                    >
                      <SelectTrigger className="border-2 border-gray-400">
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
                  </div>

                  {/* Currency and Amount */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Nominal Currency</Label>
                      <Select 
                        value={formData.nominal_currency_uuid || '__none__'} 
                        onValueChange={handleCurrencyChange}
                      >
                        <SelectTrigger className="border-2 border-gray-400">
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
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Nominal Amount</Label>
                      <Input
                        value={getLiveNominalAmountLabel() || '0.00'}
                        readOnly
                        className="bg-gray-100 border-gray-300"
                      />
                      <p className="text-xs text-gray-500">Automatically calculated</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Transaction Details - Always visible */}
              <div className="space-y-4 pt-2 border-t">
                <h3 className="text-sm font-semibold text-gray-700">Transaction Information</h3>
                
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Record ID</Label>
                  <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                    <span className="font-bold" style={{ color: '#000' }}>
                      {editingTransaction?.id || 'N/A'}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Transaction Date</Label>
                    <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                      <span className="font-bold" style={{ color: '#000' }}>
                        {editingTransaction?.date 
                          ? new Date(editingTransaction.date).toLocaleDateString('en-GB') 
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Correction Date</Label>
                    <Input
                      type="date"
                      value={formData.correction_date}
                      onChange={(event) =>
                        setFormData((prev) => ({ ...prev, correction_date: event.target.value }))
                      }
                      className="bg-white border-gray-300"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Bank Account</Label>
                    <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                      <span className="font-bold" style={{ color: '#000' }}>
                        {editingTransaction?.accountNumber || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Account Currency Amount (Face amount)</Label>
                  <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                    <span className="font-bold" style={{ color: '#000' }}>
                      {formatAmount(editingTransaction?.accountCurrencyAmount)}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Description</Label>
                  <div className="flex min-h-[60px] w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-2 text-sm">
                    <span className="font-bold whitespace-pre-wrap" style={{ color: '#000' }}>
                      {editingTransaction?.description || 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Comment</Label>
                  <Textarea
                    value={formData.comment}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, comment: event.target.value }))
                    }
                    placeholder="Add a comment..."
                    className="bg-white border-gray-300"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={runReparseTransaction}
                  disabled={isSaving || isReparseRunning}
                >
                  {isReparseRunning ? 'Reparsing...' : 'Reparse Transaction'}
                </Button>
                <Button
                  variant="outline"
                  onClick={runReparsePayment}
                  disabled={isSaving || isReparseRunning}
                >
                  {isReparseRunning ? 'Reparsing...' : 'Reparse Payment'}
                </Button>
                <Button variant="outline" onClick={cancelEdit} disabled={isSaving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>

              {isBatchEditorOpen && editingTransaction && (
                <div className="relative z-[80]">
                  {batchEditorLoading ? (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
                      <div className="bg-white rounded-lg shadow-xl px-6 py-4">
                        <span className="text-gray-600">Loading...</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      {(() => {
                        const fallbackTotal = Math.abs(Number(editingTransaction.accountCurrencyAmount || 0));
                        const batchTotal = (batchInitialPartitions && batchInitialPartitions.length > 0)
                          ? batchInitialPartitions.reduce(
                              (sum, p) => sum + (Number(p.partitionAmount) || 0),
                              0
                            )
                          : null;
                        const totalAmount = batchTotal && batchTotal > 0 ? batchTotal : fallbackTotal;
                        return (
                    <BatchEditor
                      batchUuid={batchEditorUuid}
                      initialPartitions={batchInitialPartitions ?? undefined}
                      rawRecordUuid={editingTransaction.recordUuid}
                      rawRecordId1={editingTransaction.id1 || ''}
                      rawRecordId2={editingTransaction.id2 || ''}
                      bankAccountUuid={editingTransaction.accountUuid}
                      counteragentUuid={editingTransaction.counteragentUuid || null}
                      accountCurrencyUuid={editingTransaction.accountCurrencyUuid}
                      accountCurrencyCode={editingTransaction.accountCurrencyCode || null}
                      transactionDate={editingTransaction.correctionDate || editingTransaction.date}
                      totalAmount={totalAmount}
                      description={editingTransaction.description || ''}
                      onClose={handleBatchEditorClose}
                      onSave={handleBatchEditorSaved}
                    />
                        );
                      })()}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {showFullTable && (
        <Dialog open={isBackparseDialogOpen} onOpenChange={setIsBackparseDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Backparse Preview</DialogTitle>
              <DialogDescription>
                Review changes before reprocessing. Locked records are excluded.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Preview limit</Label>
                    <Input
                      type="number"
                      min={1}
                      value={backparseLimit}
                      onChange={(e) => setBackparseLimit(Number(e.target.value) || 1)}
                      className="w-28"
                    />
                    <Button variant="outline" size="sm" onClick={loadBackparsePreview} disabled={isBackparseLoading}>
                      {isBackparseLoading ? 'Loading...' : 'Refresh'}
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={selectAllBackparse}>
                      Select all
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearBackparseSelection}>
                      Select none
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateParsingLockForSelection(true)}
                      disabled={isBackparseRunning}
                    >
                      Lock selected
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateParsingLockForSelection(false)}
                      disabled={isBackparseRunning}
                    >
                      Unlock selected
                    </Button>
                    <Button
                      size="sm"
                      onClick={runBackparseForSelection}
                      disabled={isBackparseRunning}
                    >
                      {isBackparseRunning ? 'Processing...' : 'Backparse selected'}
                    </Button>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  Selected: {selectedBackparseIds.size} / {backparsePreview.length}
                </div>
              </div>

              {backparseError && (
                <div className="text-sm text-red-600">{backparseError}</div>
              )}

              {isBackparseLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : backparsePreview.length === 0 ? (
                <div className="text-sm text-muted-foreground">No changes detected.</div>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-left">
                        <th className="p-2 w-10"></th>
                        <th className="p-2">ID</th>
                        <th className="p-2">Date</th>
                        <th className="p-2">Description</th>
                        <th className="p-2">Changed fields</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backparsePreview.map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="p-2">
                            <Checkbox
                              checked={selectedBackparseIds.has(item.id)}
                              onCheckedChange={() => toggleBackparseSelection(item.id)}
                            />
                          </td>
                          <td className="p-2">{item.id}</td>
                          <td className="p-2">{formatDate(item.transaction_date)}</td>
                          <td className="p-2 max-w-[320px] truncate" title={item.description || ''}>
                            {item.description || '-'}
                          </td>
                          <td className="p-2">
                            <div className="flex flex-wrap gap-1">
                              {item.changed_fields.map((field) => (
                                <Badge key={field} variant="secondary">{field}</Badge>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showFullTable && (
        <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Import XLSX Preview</DialogTitle>
              <DialogDescription>
                Review parsed rows from {importFileName || 'XLSX'} before applying.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {importError && (
                <div className="text-sm text-red-600">{importError}</div>
              )}

              {importSummary && (
                <div className="text-sm text-muted-foreground">
                  Total rows: {importSummary.total ?? 0} � Missing records: {importSummary.missingRecords ?? 0} � Batch groups: {importSummary.batchGroups ?? 0}
                </div>
              )}

              {importPreviewRows.length === 0 ? (
                <div className="text-sm text-muted-foreground">No preview rows loaded.</div>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-left">
                        <th className="p-2">ID1</th>
                        <th className="p-2">ID2</th>
                        <th className="p-2">Payment ID</th>
                        <th className="p-2">New Payment</th>
                        <th className="p-2">Amount</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Warnings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreviewRows.map((row, idx) => (
                        <tr key={`${row.id1}-${row.id2}-${idx}`} className="border-t">
                          <td className="p-2 font-mono">{row.id1}</td>
                          <td className="p-2 font-mono">{row.id2}</td>
                          <td className="p-2 font-mono">{row.paymentId || '-'}</td>
                          <td className="p-2 font-mono">{row.newPaymentId || '-'}</td>
                          <td className="p-2">{row.accountCurrencyAmount ?? '-'}</td>
                          <td className="p-2">{row.status}</td>
                          <td className="p-2">
                            {Array.isArray(row.warnings) && row.warnings.length > 0
                              ? row.warnings.join(' | ')
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsImportDialogOpen(false)} disabled={isImporting}>
                Close
              </Button>
              <Button onClick={handleApplyImport} disabled={isImporting || Boolean(importError)}>
                {isImporting ? 'Applying...' : 'Confirm Import'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Raw Record Viewer Dialog */}
      <Dialog open={isRawRecordDialogOpen} onOpenChange={setIsRawRecordDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Raw Record Data</DialogTitle>
            <DialogDescription>
              Headers and values from the raw bank statement record
            </DialogDescription>
          </DialogHeader>
          {loadingRawRecord ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : viewingRawRecord ? (
            <div className="space-y-4">
              {'id' in viewingRawRecord && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={Boolean(viewingRawRecord.parsing_lock)}
                    onCheckedChange={(checked) => updateRawRecordParsingLock(Boolean(checked))}
                    disabled={isRawLockUpdating}
                  />
                  <Label className="text-sm">Parsing lock (skip during backparse)</Label>
                </div>
              )}
              <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto border rounded p-4">
                {Object.entries(viewingRawRecord).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-2 gap-4 py-2 border-b">
                    <div className="font-medium text-sm text-gray-700 dark:text-gray-300">
                      {key}
                    </div>
                    <div className="text-sm break-all">
                      {value !== null && value !== undefined ? String(value) : '-'}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setIsRawRecordDialogOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No data available
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}

export default BankTransactionsTable;


