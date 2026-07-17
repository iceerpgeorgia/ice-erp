'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ArrowUpRight, Columns3, Download, Edit2, FileText, Link2, Settings, User, X, Plus, Filter, Search } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Label } from './ui/label';
import { ColumnFilterPopover } from './shared/column-filter-popover';
import type { ColumnFormat } from './shared/table-filters';
import { ClearFiltersButton } from './shared/clear-filters-button';
import { useTableFilters, type FilterableColumn } from './shared/use-table-filters';
import * as XLSX from 'xlsx-js-style';
import { AddProjectDialog } from './add-project-dialog';
import { RowAttachments } from './row-attachments';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Combobox } from '../ui/combobox';
import { MultiCombobox } from '../ui/multi-combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';

type FinancialCode = {
  uuid: string;
  code: string;
  validation?: string;
  name?: string;
};

type ServicesRow = {
  financialCodeUuid: string;
  financialCodeValidation: string;
  projectUuid: string;
  counteragentUuid: string | null;
  status: string;
  serviceState: string;
  project: string;
  projectName: string;
  projectAddress?: string | null;
  sum: number;
  counteragent: string;
  insiderName: string;
  department: string;
  paymentIds: string[];
  hasUnboundCounteragentTransactions?: boolean;
  currency: string;
  paymentCount: number;
  jobsByState: {
    active: number;
    conversion: number;
    free: number;
    others: number;
    recovery: number;
  };
  jobNames: string[];
  accrual: number;
  latestAccrual: number;
  order: number;
  lastMonthAccrual: number;
  lastMonthOrder: number;
  payment: number;
  costAccrual: number;
  costOrder: number;
  costPayment: number;
  profit: number;
  projectCurrencyUuid: string | null;
  projectCurrencyCode: string;
  costPaymentIds: string[];
  due: number;
  balance: number;
  confirmed: boolean;
  latestDate: string | null;
};

type ServicesSummaryRow = {
  status: string;
  projectsCount: number;
  paymentCount: number;
  accrual: number;
  order: number;
  payment: number;
  costAccrual: number;
  costOrder: number;
  costPayment: number;
  profit: number;
  due: number;
  balance: number;
};

type ServicesReportResponse = {
  rows: ServicesRow[];
  summaryByStatus: ServicesSummaryRow[];
  totals: {
    projectsCount: number;
    paymentCount: number;
    accrual: number;
    order: number;
    payment: number;
    due: number;
    balance: number;
  };
};

type JobRow = {
  jobUuid: string;
  jobName: string;
  projectName: string;
  projectIndex: string;
  brandName: string;
  floors: number | null;
  weight: number | null;
  isFf: boolean;
  isActive: boolean;
  serviceState: string | null;
};

type JobLinkDialogState = {
  open: boolean;
  projectUuid: string;
  projectName: string;
  allJobs: JobRow[];
  linkedJobUuids: Set<string>;
  search: string;
  loading: boolean;
  saving: boolean;
};

type ProjectOption = {
  projectUuid?: string;
  project_uuid?: string;
  projectIndex?: string;
  project_index?: string;
  projectName?: string;
  project_name?: string;
};

type CounteragentOption = {
  counteragent_uuid?: string;
  counteragentUuid?: string;
  counteragent?: string;
  name?: string;
  identification_number?: string;
  identificationNumber?: string;
};

type FinancialCodeOption = {
  uuid: string;
  validation?: string;
  code?: string;
};

type CurrencyOption = {
  uuid: string;
  code?: string;
  name?: string;
};

type JobOption = {
  jobUuid: string;
  jobName: string;
  jobDisplay?: string;
};

type PaymentEditDialogState = {
  open: boolean;
  loading: boolean;
  saving: boolean;
  paymentRowId: number | null;
  originalPaymentId: string;
  paymentId: string;
  label: string;
  counteragentUuid: string;
  financialCodeUuid: string;
  currencyUuid: string;
  projectUuid: string;
  jobUuid: string;
  incomeTax: boolean;
  isActive: boolean;
  error: string | null;
};

type SectionColumnKey =
  | 'status'
  | 'serviceState'
  | 'financialCodeValidation'
  | 'projectName'
  | 'projectAddress'
  | 'insiderName'
  | 'department'
  | 'currency'
  | 'sum'
  | 'counteragent'
  | 'paymentIds'
  | 'paymentCount'
  | 'jobsActive'
  | 'jobsConversion'
  | 'jobsFree'
  | 'jobsOthers'
  | 'jobsRecovery'
  | 'accrual'
  | 'order'
  | 'payment'
  | 'costAccrual'
  | 'costOrder'
  | 'costPayment'
  | 'profit'
  | 'due'
  | 'balance'
  | 'confirmed'
  | 'latestDate'
  | 'actions';

type SectionColumn = {
  key: SectionColumnKey;
  label: string;
  visible: boolean;
  width: number;
  align?: 'left' | 'right' | 'center';
};

type SectionData = {
  financialCodeUuid: string;
  financialCodeValidation: string;
  rows: ServicesRow[];
};

const DEFAULT_TOTALS = {
  projectsCount: 0,
  paymentCount: 0,
  accrual: 0,
  order: 0,
  payment: 0,
  costAccrual: 0,
  costOrder: 0,
  costPayment: 0,
  profit: 0,
  due: 0,
  balance: 0,
};

const SERVICES_REPORT_COLUMNS_STORAGE_KEY = 'servicesReportColumnsV8';

const DEFAULT_SECTION_COLUMNS: SectionColumn[] = [
  { key: 'status', label: 'Status', visible: true, width: 120, align: 'left' },
  { key: 'serviceState', label: 'Service State', visible: true, width: 150, align: 'left' },
  { key: 'financialCodeValidation', label: 'Financial Code', visible: true, width: 220, align: 'left' },
  { key: 'projectName', label: 'Project', visible: true, width: 260, align: 'left' },
  { key: 'projectAddress', label: 'Project Address', visible: false, width: 220, align: 'left' },
  { key: 'insiderName', label: 'Insider', visible: false, width: 200, align: 'left' },
  { key: 'department', label: 'Department', visible: false, width: 160, align: 'left' },
  { key: 'currency', label: 'Currency', visible: true, width: 110, align: 'left' },
  { key: 'sum', label: 'Sum', visible: true, width: 130, align: 'right' },
  { key: 'counteragent', label: 'Counteragent', visible: true, width: 220, align: 'left' },
  { key: 'paymentIds', label: 'Payment IDs', visible: true, width: 260, align: 'left' },
  { key: 'paymentCount', label: 'Payments', visible: true, width: 100, align: 'right' },
  { key: 'jobsActive', label: 'A', visible: true, width: 60, align: 'center' },
  { key: 'jobsConversion', label: 'C', visible: true, width: 60, align: 'center' },
  { key: 'jobsFree', label: 'F', visible: true, width: 60, align: 'center' },
  { key: 'jobsOthers', label: 'O', visible: true, width: 60, align: 'center' },
  { key: 'jobsRecovery', label: 'R', visible: true, width: 60, align: 'center' },
  { key: 'accrual', label: 'Accrual', visible: true, width: 130, align: 'right' },
  { key: 'order', label: 'Order', visible: true, width: 130, align: 'right' },
  { key: 'payment', label: 'Payment', visible: true, width: 130, align: 'right' },
  { key: 'costAccrual', label: 'Cost Accrual', visible: true, width: 130, align: 'right' },
  { key: 'costOrder', label: 'Cost Order', visible: false, width: 130, align: 'right' },
  { key: 'costPayment', label: 'Cost Payment', visible: false, width: 130, align: 'right' },
  { key: 'profit', label: 'Profit (VAT Adj.)', visible: true, width: 150, align: 'right' },
  { key: 'due', label: 'Due', visible: true, width: 130, align: 'right' },
  { key: 'balance', label: 'Balance', visible: true, width: 130, align: 'right' },
  { key: 'confirmed', label: 'Confirmed', visible: true, width: 110, align: 'left' },
  { key: 'latestDate', label: 'Latest Date', visible: true, width: 130, align: 'left' },
  { key: 'actions', label: 'Actions', visible: true, width: 90, align: 'left' },
];

const formatMoney = (value: number) =>
  value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDate = (value: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

// Job service state colors with abbreviations
const JOB_STATE_COLORS: Record<string, { bg: string; text: string; abbr: string }> = {
  active: { bg: '#D4EDDA', text: '#155724', abbr: 'A' }, // Green
  conversion: { bg: '#FFE5CC', text: '#CC6600', abbr: 'C' }, // Orange
  free: { bg: '#D1ECF1', text: '#0C5460', abbr: 'F' }, // Teal
  others: { bg: '#E8EAED', text: '#5F6368', abbr: 'O' }, // Gray
  recovery: { bg: '#F8D7DA', text: '#721C24', abbr: 'R' }, // Red
};

const COLUMN_BG: Partial<Record<SectionColumnKey, string>> = {
  accrual: '#ffebee',
  order: '#fff9e6',
  payment: '#e8f5e9',
  costAccrual: '#ffe0b2',
  costOrder: '#fdd835',
  costPayment: '#c8e6c9',
  profit: '#e1bee7',
};

const COLUMN_FORMAT_MAP: Partial<Record<SectionColumnKey, ColumnFormat>> = {
  serviceState: 'text',
  insiderName: 'text',
  department: 'text',
  projectAddress: 'text',
  sum: 'currency',
  paymentCount: 'number',
  jobsActive: 'number',
  jobsConversion: 'number',
  jobsFree: 'number',
  jobsOthers: 'number',
  jobsRecovery: 'number',
  accrual: 'currency',
  order: 'currency',
  payment: 'currency',
  costAccrual: 'currency',
  costOrder: 'currency',
  costPayment: 'currency',
  profit: 'currency',
  due: 'currency',
  balance: 'currency',
  confirmed: 'boolean',
  latestDate: 'date',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const getColumnValue = (row: ServicesRow, key: SectionColumnKey) => {
  switch (key) {
    case 'sum':
      return row.sum;
    case 'latestDate':
      return row.latestDate;
    case 'accrual':
      return row.accrual;
    case 'costAccrual':
      return row.costAccrual;
    case 'costOrder':
      return row.costOrder;
    case 'costPayment':
      return row.costPayment;
    case 'profit':
      return row.profit;
    case 'confirmed':
      return row.confirmed;
    case 'projectAddress':
      return row.projectAddress || '';
    case 'paymentIds':
      return row.paymentIds.join(', ');
    case 'jobsActive':
      return row.jobsByState.active;
    case 'jobsConversion':
      return row.jobsByState.conversion;
    case 'jobsFree':
      return row.jobsByState.free;
    case 'jobsOthers':
      return row.jobsByState.others;
    case 'jobsRecovery':
      return row.jobsByState.recovery;
    case 'actions':
      return '';
    default:
      return row[key as keyof ServicesRow] as unknown;
  }
};

const HOOK_COLUMNS: FilterableColumn<SectionColumnKey>[] = DEFAULT_SECTION_COLUMNS.map((col) => ({
  key: col.key,
  label: col.label,
  visible: true,
  sortable: col.key !== 'actions',
  filterable: col.key !== 'actions',
  format: COLUMN_FORMAT_MAP[col.key],
  width: col.width,
}));

export function ServicesReportTable() {
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInsiderUuids, setSelectedInsiderUuids] = useState<string[]>([]);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string>>(new Set());
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isDeconfirmOpen, setIsDeconfirmOpen] = useState(false);
  const [isDeconfirming, setIsDeconfirming] = useState(false);
  const [deconfirmError, setDeconfirmError] = useState<string | null>(null);
  const [maxDate, setMaxDate] = useState('');
  const [financialCodeSearch, setFinancialCodeSearch] = useState('');
  const [financialCodes, setFinancialCodes] = useState<FinancialCode[]>([]);
  const [selectedFinancialCodeUuids, setSelectedFinancialCodeUuids] = useState<Set<string>>(new Set());
  const [report, setReport] = useState<ServicesReportResponse>({
    rows: [],
    summaryByStatus: [],
    totals: DEFAULT_TOTALS,
  });

  const {
    filters: columnFilters,
    searchTerm: search,
    sortColumn: sortField,
    sortDirection,
    sortedData: sortedServices,
    setSearchTerm: setSearch,
    handleSort,
    setSortColumn: setSortField,
    setSortDirection,
    handleFilterChange,
    clearFilters,
    activeFilterCount,
    getColumnValues: getUniqueValues,
  } = useTableFilters<ServicesRow, SectionColumnKey>({
    data: report.rows,
    columns: HOOK_COLUMNS,
    defaultSortColumn: 'latestDate',
    defaultSortDirection: 'desc',
    searchColumns: ['status', 'serviceState', 'project', 'projectName', 'counteragent', 'currency', 'financialCodeValidation'] as SectionColumnKey[],
    getRowValue: (row, key) => getColumnValue(row, key as SectionColumnKey),
    pageSize: 100000,
  });

  const [columns, setColumns] = useState<SectionColumn[]>(DEFAULT_SECTION_COLUMNS);
  const [draggedColumn, setDraggedColumn] = useState<{ key: SectionColumnKey } | null>(null);
  const [resizing, setResizing] = useState<{
    key: SectionColumnKey;
    startX: number;
    startWidth: number;
  } | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Add Ledger for Costs dialog state (two-step flow)
  const [addLedgerCostsDialogOpen, setAddLedgerCostsDialogOpen] = useState(false);
  const [addLedgerCostsStep, setAddLedgerCostsStep] = useState<'payment' | 'ledger'>('payment');
  const [addLedgerCostsProjectUuid, setAddLedgerCostsProjectUuid] = useState('');
  const [addLedgerCostsProjectName, setAddLedgerCostsProjectName] = useState('');
  const [isCreatingCostPayment, setIsCreatingCostPayment] = useState(false);
  const [preSelectedCostPaymentId, setPreSelectedCostPaymentId] = useState<string | null>(null);
  const [selectedCostPaymentDetails, setSelectedCostPaymentDetails] = useState<{
    paymentId: string;
    counteragent: string;
    project: string;
    financialCode: string;
    currency: string;
  } | null>(null);
  
  // Form fields for cost payment creation
  const [selectedCostCounteragentUuid, setSelectedCostCounteragentUuid] = useState('');
  const [selectedCostFinancialCodeUuid, setSelectedCostFinancialCodeUuid] = useState('');
  const [selectedCostCurrencyUuid, setSelectedCostCurrencyUuid] = useState('');
  const [selectedCostLabel, setSelectedCostLabel] = useState('');
  
  // Form fields for cost ledger entry
  const [costEffectiveDate, setCostEffectiveDate] = useState('');
  const [costAccrual, setCostAccrual] = useState('');
  const [costOrder, setCostOrder] = useState('');
  const [costComment, setCostComment] = useState('');
  const [isSubmittingCostLedger, setIsSubmittingCostLedger] = useState(false);
  
  // Data lists
  const [costFinancialCodes, setCostFinancialCodes] = useState<FinancialCodeOption[]>([]);
  const [costCounterAgents, setCostCounterAgents] = useState<Array<{ uuid: string; name: string }>>([]);
  const [costCurrencies, setCostCurrencies] = useState<Array<{ uuid: string; code: string }>>([]);
  const [costPayments, setCostPayments] = useState<Array<{ 
    paymentId: string; 
    counteragentUuid?: string | null;
    counteragentName?: string | null;
    projectName?: string | null;
    financialCode?: string | null;
    currencyCode?: string | null;
  }>>([]);
  const [skipCostCounteragentFilter, setSkipCostCounteragentFilter] = useState<{ uuid: string; name: string } | null>(null);

  const [jobLinkDialog, setJobLinkDialog] = useState<JobLinkDialogState>({
    open: false,
    projectUuid: '',
    projectName: '',
    allJobs: [],
    linkedJobUuids: new Set(),
    search: '',
    loading: false,
    saving: false,
  });
  const [jobLinkBulkServiceState, setJobLinkBulkServiceState] = useState<string>('Active');
  const [jobLinkBulkUpdating, setJobLinkBulkUpdating] = useState(false);
  const [jobLinkBulkBindDialog, setJobLinkBulkBindDialog] = useState<{
    open: boolean;
    selectedProjectUuids: string[];
    loading: boolean;
    saving: boolean;
  }>({
    open: false,
    selectedProjectUuids: [],
    loading: false,
    saving: false,
  });
  const [jobLinkColumnFilters, setJobLinkColumnFilters] = useState<Record<string, string[]>>({});
  const [jobLinkEditDialog, setJobLinkEditDialog] = useState<{
    open: boolean;
    jobUuid: string | null;
    id: number | null;
    jobName: string;
    factoryNo: string;
    floors: string;
    weight: string;
    sellingPrice: string;
    isFf: boolean;
    brandUuid: string;
    serviceState: string;
    projectUuids: string[];
    insiderUuid: string;
    loading: boolean;
    saving: boolean;
  }>({
    open: false,
    jobUuid: null,
    id: null,
    jobName: '',
    factoryNo: '',
    floors: '',
    weight: '',
    sellingPrice: '',
    isFf: false,
    brandUuid: '',
    serviceState: 'Active',
    projectUuids: [],
    insiderUuid: '',
    loading: false,
    saving: false,
  });
  const [paymentProjects, setPaymentProjects] = useState<ProjectOption[]>([]);
  const [jobEditBrands, setJobEditBrands] = useState<any[]>([]);
  const [jobEditInsiderOptions, setJobEditInsiderOptions] = useState<any[]>([]);
  const [paymentCounteragents, setPaymentCounteragents] = useState<CounteragentOption[]>([]);
  const [paymentFinancialCodes, setPaymentFinancialCodes] = useState<FinancialCodeOption[]>([]);
  const [paymentCurrencies, setPaymentCurrencies] = useState<CurrencyOption[]>([]);
  const [paymentJobs, setPaymentJobs] = useState<JobOption[]>([]);
  const [paymentEditDialog, setPaymentEditDialog] = useState<PaymentEditDialogState>({
    open: false,
    loading: false,
    saving: false,
    paymentRowId: null,
    originalPaymentId: '',
    paymentId: '',
    label: '',
    counteragentUuid: '',
    financialCodeUuid: '',
    currencyUuid: '',
    projectUuid: '',
    jobUuid: '',
    incomeTax: false,
    isActive: true,
    error: null,
  });

  useEffect(() => {
    const savedCodes = localStorage.getItem('servicesReportFinancialCodeUuids');
    const savedMaxDate = localStorage.getItem('servicesReportMaxDate');
    const savedColumns = localStorage.getItem(SERVICES_REPORT_COLUMNS_STORAGE_KEY);

    if (savedCodes) {
      try {
        const parsed = JSON.parse(savedCodes);
        if (Array.isArray(parsed)) {
          setSelectedFinancialCodeUuids(new Set(parsed.map((item) => String(item))));
        }
      } catch {
        // ignore
      }
    }

    if (savedMaxDate) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(savedMaxDate)) {
        const [y, m, d] = savedMaxDate.split('-');
        setMaxDate(`${d}.${m}.${y}`);
      } else if (/^\d{2}\.\d{2}\.\d{4}$/.test(savedMaxDate)) {
        setMaxDate(savedMaxDate);
      }
    }

    if (savedColumns) {
      try {
        const parsed = JSON.parse(savedColumns) as SectionColumn[];
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.key) {
          // Merge saved columns with defaults to include any new columns added since last save
          const savedMap = new Map(parsed.map((col) => [col.key, col]));
          const merged = DEFAULT_SECTION_COLUMNS.map((defaultCol) => {
            const saved = savedMap.get(defaultCol.key);
            return saved ? { ...defaultCol, visible: saved.visible } : defaultCol;
          });
          setColumns(merged);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('servicesReportFinancialCodeUuids', JSON.stringify(Array.from(selectedFinancialCodeUuids)));
  }, [selectedFinancialCodeUuids]);

  useEffect(() => {
    localStorage.setItem('servicesReportMaxDate', maxDate || '');
  }, [maxDate]);

  useEffect(() => {
    localStorage.setItem(SERVICES_REPORT_COLUMNS_STORAGE_KEY, JSON.stringify(columns));
  }, [columns]);

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (event: MouseEvent) => {
      const delta = event.clientX - resizing.startX;
      const nextWidth = Math.max(20, resizing.startWidth + delta);
      setColumns((prev) =>
        prev.map((column) =>
          column.key === resizing.key ? { ...column, width: nextWidth } : column
        )
      );
    };

    const handleMouseUp = () => {
      setResizing(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing]);

  const fetchFinancialCodes = useCallback(async () => {
    const [codesRes, insiderRes] = await Promise.all([
      fetch('/api/financial-codes?leafOnly=true&isIncome=true'),
      fetch('/api/insider-selection'),
    ]);
    if (!codesRes.ok) throw new Error('Failed to load financial codes');
    const data = await codesRes.json();
    if (!Array.isArray(data)) {
      setFinancialCodes([]);
    } else {
      setFinancialCodes(data.map((item: any) => ({
        uuid: item.uuid,
        code: item.code,
        validation: item.validation,
        name: item.name,
      })));
    }
    if (insiderRes.ok) {
      const insiderData = await insiderRes.json();
      const uuids = Array.isArray(insiderData?.selectedUuids) ? insiderData.selectedUuids : [];
      setSelectedInsiderUuids(uuids);
    }
  }, [])

  const handleConfirmSelected = async () => {
    if (selectedPaymentIds.size === 0) return;
    setIsConfirming(true);
    setConfirmError(null);
    try {
      const response = await fetch('/api/payments-ledger/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIds: Array.from(selectedPaymentIds),
          maxDate: (() => { const m = maxDate?.match(/^(\d{2})\.(\d{2})\.(\d{4})$/); if (m) return `${m[3]}-${m[2]}-${m[1]}`; return maxDate && /^\d{4}-\d{2}-\d{2}$/.test(maxDate) ? maxDate : null; })(),
        }),
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || 'Failed to confirm ledger entries.');
      }
      setIsConfirmOpen(false);
      setSelectedPaymentIds(new Set());
      await fetchReport();
    } catch (err: any) {
      setConfirmError(err.message || 'Failed to confirm ledger entries.');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleDeconfirmSelected = async () => {
    if (selectedPaymentIds.size === 0) return;
    setIsDeconfirming(true);
    setDeconfirmError(null);
    try {
      const response = await fetch('/api/payments-ledger/deconfirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIds: Array.from(selectedPaymentIds),
          maxDate: (() => { const m = maxDate?.match(/^(\d{2})\.(\d{2})\.(\d{4})$/); if (m) return `${m[3]}-${m[2]}-${m[1]}`; return maxDate && /^\d{4}-\d{2}-\d{2}$/.test(maxDate) ? maxDate : null; })(),
        }),
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || 'Failed to deconfirm ledger entries.');
      }
      setIsDeconfirmOpen(false);
      setSelectedPaymentIds(new Set());
      await fetchReport();
    } catch (err: any) {
      setDeconfirmError(err.message || 'Failed to deconfirm ledger entries.');
    } finally {
      setIsDeconfirming(false);
    }
  };

  const fetchReport = useCallback(async () => {
    if (selectedFinancialCodeUuids.size === 0) {
      setReport({
        rows: [],
        summaryByStatus: [],
        totals: DEFAULT_TOTALS,
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('financialCodeUuids', Array.from(selectedFinancialCodeUuids).join(','));
      if (maxDate && /^\d{2}\.\d{2}\.\d{4}$/.test(maxDate)) {
        const [dd, mm, yyyy] = maxDate.split('.');
        params.set('maxDate', `${yyyy}-${mm}-${dd}`);
      } else if (maxDate && /^\d{4}-\d{2}-\d{2}$/.test(maxDate)) {
        params.set('maxDate', maxDate);
      }
      if (selectedInsiderUuids.length > 0) {
        params.set('insiderUuids', selectedInsiderUuids.join(','));
      }
      const response = await fetch(`/api/services-report?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to load services report');
      const data = (await response.json()) as ServicesReportResponse;
      setReport({
        rows: Array.isArray(data.rows) ? data.rows : [],
        summaryByStatus: Array.isArray(data.summaryByStatus) ? data.summaryByStatus : [],
        totals: data.totals || DEFAULT_TOTALS,
      });
    } catch (fetchError: any) {
      setError(fetchError?.message || 'Failed to load services report');
    } finally {
      setLoading(false);
    }
  }, [maxDate, selectedFinancialCodeUuids, selectedInsiderUuids]);

  useEffect(() => {
    fetchFinancialCodes().catch((fetchError: any) => {
      setError(fetchError?.message || 'Failed to load financial codes');
      setLoading(false);
    });
  }, [fetchFinancialCodes]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const filteredFinancialCodes = useMemo(() => {
    const term = financialCodeSearch.trim().toLowerCase();
    if (!term) return financialCodes;
    return financialCodes.filter((code) =>
      `${code.code} ${code.validation || ''} ${code.name || ''}`.toLowerCase().includes(term)
    );
  }, [financialCodeSearch, financialCodes]);

  const codeLabelByUuid = useMemo(() => {
    const map = new Map<string, string>();
    for (const code of financialCodes) {
      map.set(code.uuid, code.validation || `${code.code} ${code.name || ''}`.trim());
    }
    return map;
  }, [financialCodes]);

  const sections = useMemo(() => {
    const grouped = new Map<string, SectionData>();
    for (const row of sortedServices) {
      const key = row.financialCodeUuid || 'unknown';
      const existing = grouped.get(key);
      if (existing) {
        existing.rows.push(row);
      } else {
        grouped.set(key, {
          financialCodeUuid: key,
          financialCodeValidation:
            row.financialCodeValidation || codeLabelByUuid.get(key) || 'Unknown Financial Code',
          rows: [row],
        });
      }
    }

    return Array.from(grouped.values()).sort((a, b) =>
      a.financialCodeValidation.localeCompare(b.financialCodeValidation)
    );
  }, [sortedServices, codeLabelByUuid]);

  const toggleFinancialCode = (uuid: string) => {
    setSelectedFinancialCodeUuids((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };

  const selectAllCodes = () => {
    setSelectedFinancialCodeUuids(new Set(financialCodes.map((code) => code.uuid)));
  };

  const clearAllCodes = () => {
    setSelectedFinancialCodeUuids(new Set());
  };

  const toggleColumnVisibility = (key: SectionColumnKey) => {
    setColumns((prev) =>
      prev.map((column) =>
        column.key === key ? { ...column, visible: !column.visible } : column
      )
    );
  };

  const handleColumnDrop = (targetKey: SectionColumnKey) => {
    if (!draggedColumn || draggedColumn.key === targetKey) return;
    setColumns((prev) => {
      const fromIndex = prev.findIndex((column) => column.key === draggedColumn.key);
      const toIndex = prev.findIndex((column) => column.key === targetKey);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const reordered = [...prev];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      return reordered;
    });
    setDraggedColumn(null);
  };

  const openJobLinkDialog = async (row: ServicesRow) => {
    setJobLinkDialog((prev) => ({ ...prev, open: true, projectUuid: row.projectUuid, projectName: row.projectName, loading: true, allJobs: [], linkedJobUuids: new Set(), search: '', saving: false }));
    try {
      const [jobsRes, linksRes, paymentsRes] = await Promise.all([
        fetch('/api/jobs'),
        fetch(`/api/job-projects?projectUuid=${row.projectUuid}`),
        fetch(`/api/payments?paymentIds=${encodeURIComponent(row.paymentIds.join(','))}`),
      ]);
      const jobsData = jobsRes.ok ? await jobsRes.json() : [];
      const linksData = linksRes.ok ? await linksRes.json() : [];
      const paymentsData = paymentsRes.ok ? await paymentsRes.json() : [];
      const allJobs: JobRow[] = (Array.isArray(jobsData) ? jobsData : []).map((j: any) => ({
        jobUuid: j.jobUuid,
        jobName: j.jobName || j.job_name || '',
        projectName: j.projectName || j.project_name || '',
        projectIndex: j.projectIndex || j.project_index || '-',
        brandName: j.brandName || j.brand_name || '',
        floors: j.floors ?? null,
        weight: j.weight ?? null,
        isFf: Boolean(j.isFf || j.is_ff),
        isActive: j.is_active !== false,
        serviceState: j.serviceState || j.service_state || null,
      }));
      const linkedJobUuids = new Set<string>(Array.isArray(linksData) ? linksData : []);
      for (const payment of (Array.isArray(paymentsData) ? paymentsData : [])) {
        if (payment?.jobUuid) {
          linkedJobUuids.add(String(payment.jobUuid));
        }
      }
      setJobLinkDialog((prev) => ({ ...prev, allJobs, linkedJobUuids, loading: false }));
    } catch {
      setJobLinkDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  const toggleJobLink = (jobUuid: string) => {
    setJobLinkDialog((prev) => {
      const next = new Set(prev.linkedJobUuids);
      if (next.has(jobUuid)) next.delete(jobUuid); else next.add(jobUuid);
      return { ...prev, linkedJobUuids: next };
    });
  };

  const filteredDialogJobs = useMemo(() => {
    let jobs = [...jobLinkDialog.allJobs];

    // Apply search filter
    const s = jobLinkDialog.search.trim().toLowerCase();
    if (s) {
      jobs = jobs.filter((j) =>
        j.jobName.toLowerCase().includes(s) ||
        (j.projectName && j.projectName.toLowerCase().includes(s)) ||
        (j.brandName && j.brandName.toLowerCase().includes(s))
      );
    }

    // Apply column filters
    const hasColumnFilters = Object.keys(jobLinkColumnFilters).some((col) => jobLinkColumnFilters[col].length > 0);
    if (hasColumnFilters) {
      jobs = jobs.filter((job) => {
        for (const [column, values] of Object.entries(jobLinkColumnFilters)) {
          if (!values || values.length === 0) continue;
          
          let fieldValue = '';
          if (column === 'jobName') fieldValue = job.jobName || '';
          else if (column === 'projectIndex') fieldValue = job.projectIndex || '';
          else if (column === 'projectName') fieldValue = job.projectName || '';
          else if (column === 'brandName') fieldValue = job.brandName || '';
          else if (column === 'floors') fieldValue = (job.floors !== null && job.floors !== undefined) ? String(job.floors) : '';
          else if (column === 'weight') fieldValue = (job.weight !== null && job.weight !== undefined) ? String(job.weight) : '';
          else if (column === 'isFf') fieldValue = job.isFf ? 'FF' : 'No';
          else if (column === 'isActive') fieldValue = job.isActive ? 'Yes' : 'No';
          else if (column === 'serviceState') fieldValue = job.serviceState ? String(job.serviceState) : '-';
          
          // Check if fieldValue is in the filter values (case-insensitive for text)
          const valueStrings = values.map((v) => String(v || '').trim());
          const matchesFilter = valueStrings.some((v) => {
            if (column === 'jobName' || column === 'projectIndex' || column === 'projectName' || column === 'brandName') {
              return fieldValue.toLowerCase() === v.toLowerCase();
            }
            return fieldValue === v;
          });
          
          if (!matchesFilter) return false;
        }
        return true;
      });
    }

    return jobs;
  }, [jobLinkDialog.allJobs, jobLinkDialog.search, jobLinkColumnFilters]);


  const allFilteredChecked = filteredDialogJobs.length > 0 && filteredDialogJobs.every((j) => jobLinkDialog.linkedJobUuids.has(j.jobUuid));

  const toggleAllFiltered = () => {
    setJobLinkDialog((prev) => {
      const next = new Set(prev.linkedJobUuids);
      if (allFilteredChecked) {
        for (const j of filteredDialogJobs) next.delete(j.jobUuid);
      } else {
        for (const j of filteredDialogJobs) next.add(j.jobUuid);
      }
      return { ...prev, linkedJobUuids: next };
    });
  };

  const closePaymentEditDialog = () => {
    setPaymentEditDialog({
      open: false,
      loading: false,
      saving: false,
      paymentRowId: null,
      originalPaymentId: '',
      paymentId: '',
      label: '',
      counteragentUuid: '',
      financialCodeUuid: '',
      currencyUuid: '',
      projectUuid: '',
      jobUuid: '',
      incomeTax: false,
      isActive: true,
      error: null,
    });
    setPaymentJobs([]);
  };

  const ensurePaymentEditDictionariesLoaded = async () => {
    if (
      paymentProjects.length > 0 &&
      paymentCounteragents.length > 0 &&
      paymentFinancialCodes.length > 0 &&
      paymentCurrencies.length > 0
    ) {
      return;
    }

    const [projectsRes, counteragentsRes, financialCodesRes, currenciesRes] = await Promise.all([
      fetch('/api/projects-v2'),
      fetch('/api/counteragents'),
      fetch('/api/financial-codes?leafOnly=true'),
      fetch('/api/currencies'),
    ]);

    if (!projectsRes.ok || !counteragentsRes.ok || !financialCodesRes.ok || !currenciesRes.ok) {
      throw new Error('Failed to load payment dictionaries');
    }

    const [projectsData, counteragentsData, financialCodesData, currenciesData] = await Promise.all([
      projectsRes.json(),
      counteragentsRes.json(),
      financialCodesRes.json(),
      currenciesRes.json(),
    ]);

    const projectsList = Array.isArray(projectsData)
      ? projectsData
      : Array.isArray(projectsData?.data)
        ? projectsData.data
        : [];

    const currenciesList = Array.isArray(currenciesData)
      ? currenciesData
      : Array.isArray(currenciesData?.data)
        ? currenciesData.data
        : [];

    setPaymentProjects(projectsList);
    setPaymentCounteragents(Array.isArray(counteragentsData) ? counteragentsData : []);
    setPaymentFinancialCodes(Array.isArray(financialCodesData) ? financialCodesData : []);
    setPaymentCurrencies(currenciesList);
  };

  const openPaymentEditDialog = async (paymentId: string) => {
    setPaymentEditDialog({
      open: true,
      loading: true,
      saving: false,
      paymentRowId: null,
      originalPaymentId: paymentId,
      paymentId,
      label: '',
      counteragentUuid: '',
      financialCodeUuid: '',
      currencyUuid: '',
      projectUuid: '',
      jobUuid: '',
      incomeTax: false,
      isActive: true,
      error: null,
    });

    try {
      await ensurePaymentEditDictionariesLoaded();

      const response = await fetch(`/api/payments?paymentIds=${encodeURIComponent(paymentId)}&limit=1&sort=desc`);
      if (!response.ok) {
        throw new Error('Failed to load payment for editing');
      }

      const data = await response.json();
      const rows = Array.isArray(data) ? data : [];
      const matched = rows.find((row: any) => String(row.paymentId || '') === paymentId) || rows[0];
      if (!matched || matched.id == null) {
        throw new Error(`Payment record not found for ${paymentId}`);
      }

      setPaymentEditDialog((prev) => ({
        ...prev,
        loading: false,
        paymentRowId: Number(matched.id),
        paymentId: String(matched.paymentId || paymentId),
        label: String(matched.label || ''),
        counteragentUuid: String(matched.counteragent_uuid || ''),
        financialCodeUuid: String(matched.financial_code_uuid || ''),
        currencyUuid: String(matched.currencyUuid || ''),
        projectUuid: String(matched.project_uuid || ''),
        jobUuid: String(matched.jobUuid || ''),
        incomeTax: Boolean(matched.incomeTax),
        isActive: matched.is_active !== false,
      }));
    } catch (error: any) {
      setPaymentEditDialog((prev) => ({
        ...prev,
        loading: false,
        error: error?.message || 'Failed to load payment for editing',
      }));
    }
  };

  useEffect(() => {
    const fetchPaymentJobs = async () => {
      if (!paymentEditDialog.open || !paymentEditDialog.projectUuid) {
        setPaymentJobs([]);
        return;
      }

      try {
        const response = await fetch(`/api/jobs?projectUuid=${encodeURIComponent(paymentEditDialog.projectUuid)}`);
        if (!response.ok) {
          throw new Error('Failed to fetch project jobs');
        }

        const data = await response.json();
        setPaymentJobs(Array.isArray(data) ? data : []);
      } catch {
        setPaymentJobs([]);
      }
    };

    fetchPaymentJobs();
  }, [paymentEditDialog.open, paymentEditDialog.projectUuid]);

  const savePaymentEdit = async () => {
    if (!paymentEditDialog.paymentRowId) {
      setPaymentEditDialog((prev) => ({ ...prev, error: 'Missing payment record id.' }));
      return;
    }

    if (!paymentEditDialog.counteragentUuid || !paymentEditDialog.financialCodeUuid || !paymentEditDialog.currencyUuid) {
      setPaymentEditDialog((prev) => ({
        ...prev,
        error: 'Counteragent, financial code, and currency are required.',
      }));
      return;
    }

    setPaymentEditDialog((prev) => ({ ...prev, saving: true, error: null }));
    try {
      const response = await fetch(`/api/payments?id=${paymentEditDialog.paymentRowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectUuid: paymentEditDialog.projectUuid || null,
          counteragentUuid: paymentEditDialog.counteragentUuid,
          financialCodeUuid: paymentEditDialog.financialCodeUuid,
          jobUuid: paymentEditDialog.jobUuid || null,
          incomeTax: paymentEditDialog.incomeTax,
          currencyUuid: paymentEditDialog.currencyUuid,
          paymentId: paymentEditDialog.paymentId.trim() || null,
          label: paymentEditDialog.label.trim() || null,
          isActive: paymentEditDialog.isActive,
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || 'Failed to update payment');
      }

      closePaymentEditDialog();
      await fetchReport();
    } catch (error: any) {
      setPaymentEditDialog((prev) => ({
        ...prev,
        saving: false,
        error: error?.message || 'Failed to update payment',
      }));
    }
  };

  const saveJobLinks = async () => {
    setJobLinkDialog((prev) => ({ ...prev, saving: true }));
    try {
      const jobUuids = Array.from(jobLinkDialog.linkedJobUuids).filter((value) => UUID_REGEX.test(value));
      const response = await fetch('/api/job-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectUuid: jobLinkDialog.projectUuid,
          jobUuids,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to save job links');
      }

      // Close dialog without reloading all jobs
      setJobLinkDialog((prev) => ({ ...prev, open: false, saving: false }));
      console.log(`[Bind Dialog] Bound ${jobUuids.length} jobs to project ${jobLinkDialog.projectUuid}`);
    } catch (err: any) {
      alert(err?.message || 'Failed to save job links');
      setJobLinkDialog((prev) => ({ ...prev, saving: false }));
    }
  };

  const handleJobLinkBulkServiceStateUpdate = async () => {
    if (jobLinkDialog.linkedJobUuids.size === 0 || !jobLinkBulkServiceState) return;
    setJobLinkBulkUpdating(true);
    try {
      const jobUuids = Array.from(jobLinkDialog.linkedJobUuids).filter((value) => UUID_REGEX.test(value));
      const res = await fetch('/api/jobs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobUuids,
          serviceState: jobLinkBulkServiceState,
          bulkUpdate: true,
        }),
      });
      if (res.ok) {
        // Update service state inline for all selected jobs
        setJobLinkDialog((prev) => ({
          ...prev,
          allJobs: prev.allJobs.map((job) =>
            jobUuids.includes(job.jobUuid)
              ? { ...job, serviceState: jobLinkBulkServiceState }
              : job
          ),
        }));
        setJobLinkBulkServiceState('');
        console.log(`[Bind Dialog] Updated service state for ${jobUuids.length} jobs to ${jobLinkBulkServiceState}`);
      } else {
        throw new Error('Failed to update service state');
      }
    } catch (error) {
      console.error('Failed to update service state:', error);
      alert('Failed to update service state');
    } finally {
      setJobLinkBulkUpdating(false);
    }
  };

  const openJobLinkEditDialog = async (jobUuid: string) => {
    setJobLinkEditDialog((prev) => ({ ...prev, open: true, jobUuid, loading: true }));
    try {
      // Fetch full job details and dictionaries
      const [jobsRes, projectsRes, brandsRes, insiderRes] = await Promise.all([
        fetch(`/api/jobs`),
        fetch('/api/projects-v2'),
        fetch('/api/brands'),
        fetch('/api/insider-selection'),
      ]);

      if (jobsRes.ok && projectsRes.ok && brandsRes.ok && insiderRes.ok) {
        const jobsData = await jobsRes.json();
        const projectsData = await projectsRes.json();
        const brandsData = await brandsRes.json();
        const insiderData = await insiderRes.json();
        
        const job = Array.isArray(jobsData) ? jobsData.find((j: any) => j.jobUuid === jobUuid) : null;
        if (job) {
          // Gather all project bindings for this job
          const allJobs = Array.isArray(jobsData) ? jobsData : [];
          const allBindings = allJobs.filter((j: any) => j.jobUuid === jobUuid);
          const allProjectUuids = [...new Set(allBindings.map((b: any) => b.projectUuid).filter(Boolean))];

          // Store dictionaries for the form
          const projectsList = Array.isArray(projectsData) ? projectsData : (Array.isArray(projectsData?.data) ? projectsData.data : []);
          const brandsList = Array.isArray(brandsData) ? brandsData : (Array.isArray(brandsData?.data) ? brandsData.data : []);
          const insiderOptions = insiderData?.options || [];
          
          setPaymentProjects(projectsList);
          setJobEditBrands(brandsList);
          setJobEditInsiderOptions(insiderOptions);

          setJobLinkEditDialog((prev) => ({
            ...prev,
            id: job.id || null,
            jobName: job.jobName || job.job_name || '',
            factoryNo: job.factoryNo || job.factory_no || '',
            floors: job.floors?.toString() || '',
            weight: job.weight?.toString() || '',
            sellingPrice: (job.sellingPrice ?? job.selling_price)?.toString() || '',
            isFf: Boolean(job.isFf || job.is_ff),
            brandUuid: job.brandUuid || job.brand_uuid || '',
            serviceState: job.serviceState || job.service_state || 'Active',
            projectUuids: allProjectUuids,
            insiderUuid: job.insiderUuid || job.insider_uuid || '',
            loading: false,
          }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch job details:', error);
      setJobLinkEditDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleJobLinkEditSave = async () => {
    if (!jobLinkEditDialog.jobUuid) return;
    setJobLinkEditDialog((prev) => ({ ...prev, saving: true }));
    try {
      const response = await fetch('/api/jobs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: jobLinkEditDialog.id,
          jobName: jobLinkEditDialog.jobName,
          factoryNo: jobLinkEditDialog.factoryNo || null,
          floors: jobLinkEditDialog.floors ? parseInt(jobLinkEditDialog.floors) : null,
          weight: jobLinkEditDialog.weight ? parseFloat(jobLinkEditDialog.weight) : null,
          sellingPrice: jobLinkEditDialog.sellingPrice ? parseFloat(jobLinkEditDialog.sellingPrice) : null,
          isFf: jobLinkEditDialog.isFf,
          brandUuid: jobLinkEditDialog.brandUuid || null,
          serviceState: jobLinkEditDialog.serviceState || 'Active',
          projectUuids: jobLinkEditDialog.projectUuids && jobLinkEditDialog.projectUuids.length > 0 ? jobLinkEditDialog.projectUuids : [],
        }),
      });

      if (response.ok) {
        // Update the job inline in the dialog instead of reloading all jobs
        setJobLinkDialog((prev) => ({
          ...prev,
          allJobs: prev.allJobs.map((job) =>
            job.jobUuid === jobLinkEditDialog.jobUuid
              ? {
                  ...job,
                  jobName: jobLinkEditDialog.jobName,
                  floors: jobLinkEditDialog.floors ? parseInt(jobLinkEditDialog.floors) : null,
                  weight: jobLinkEditDialog.weight ? parseFloat(jobLinkEditDialog.weight) : null,
                  isFf: jobLinkEditDialog.isFf,
                  serviceState: jobLinkEditDialog.serviceState || 'Active',
                }
              : job
          ),
        }));
        setJobLinkEditDialog((prev) => ({ ...prev, open: false, saving: false, jobUuid: null }));
        console.log(`[Bind Dialog] Updated job ${jobLinkEditDialog.jobUuid} inline`);
      } else {
        throw new Error('Failed to save job');
      }
    } catch (error) {
      console.error('Failed to save job:', error);
      alert('Failed to save job changes');
      setJobLinkEditDialog((prev) => ({ ...prev, saving: false }));
    }
  };

  const handleJobLinkBulkBind = async () => {
    if (jobLinkDialog.linkedJobUuids.size === 0 || jobLinkBulkBindDialog.selectedProjectUuids.length === 0) return;
    
    setJobLinkBulkBindDialog((prev) => ({ ...prev, saving: true }));
    try {
      const jobUuids = Array.from(jobLinkDialog.linkedJobUuids).filter((value) => UUID_REGEX.test(value));
      
      // Bind each selected job to each selected project
      const bindPromises = jobLinkBulkBindDialog.selectedProjectUuids.map((projectUuid) =>
        fetch('/api/job-projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectUuid,
            jobUuids,
          }),
        }).then((res) => {
          if (!res.ok) throw new Error(`Failed to bind jobs to project ${projectUuid}`);
          return res.json();
        })
      );

      await Promise.all(bindPromises);

      console.log(`[Bind Dialog] Successfully bound ${jobUuids.length} job(s) to ${jobLinkBulkBindDialog.selectedProjectUuids.length} project(s)`);
      
      // Close dialog without reloading all jobs
      setJobLinkBulkBindDialog((prev) => ({ ...prev, open: false, saving: false, selectedProjectUuids: [] }));
      setJobLinkDialog((prev) => ({ ...prev, linkedJobUuids: new Set() }));
    } catch (error) {
      console.error('Failed to bulk bind jobs:', error);
      alert('Failed to bind jobs to projects: ' + (error instanceof Error ? error.message : String(error)));
      setJobLinkBulkBindDialog((prev) => ({ ...prev, saving: false }));
    }
  };

  const openJobLinkBulkBindDialog = async (predefinedProjectUuid?: string) => {
    // If project is predefined from the row, skip loading all projects
    if (predefinedProjectUuid) {
      // Pre-populate with the predefined project
      setJobLinkBulkBindDialog((prev) => ({ 
        ...prev, 
        open: true, 
        selectedProjectUuids: [predefinedProjectUuid],
        loading: false 
      }));
      console.log(`[Bind Dialog] Pre-populated with project: ${predefinedProjectUuid}`);
      return;
    }
    
    // Load projects if not already loaded
    if (paymentProjects.length === 0) {
      setJobLinkBulkBindDialog((prev) => ({ ...prev, loading: true }));
      try {
        const projectsRes = await fetch('/api/projects-v2');
        if (!projectsRes.ok) throw new Error('Failed to load projects');
        const projectsData = await projectsRes.json();
        const projectsList = Array.isArray(projectsData)
          ? projectsData
          : Array.isArray(projectsData?.data)
            ? projectsData.data
            : [];
        setPaymentProjects(projectsList);
        console.log(`[Bind Dialog] Loaded ${projectsList.length} projects`);
      } catch (error) {
        console.error('Failed to load projects:', error);
        alert('Failed to load projects');
        return;
      } finally {
        setJobLinkBulkBindDialog((prev) => ({ ...prev, loading: false }));
      }
    }
    
    setJobLinkBulkBindDialog((prev) => ({ ...prev, open: true }));
  };


  const openAddLedgerCostsDialog = async (projectUuid: string, projectName: string) => {
    setAddLedgerCostsProjectUuid(projectUuid);
    setAddLedgerCostsProjectName(projectName);
    setAddLedgerCostsStep('payment');
    setAddLedgerCostsDialogOpen(true);

    try {
      // Load financial codes (cost only: is_income = false && applies_to_pl = true)
      const fcResponse = await fetch('/api/financial-codes?leafOnly=true');
      if (fcResponse.ok) {
        const fcData = await fcResponse.json();
        const costFcs = (Array.isArray(fcData) ? fcData : []).filter(
          (fc: any) => fc.is_income === false && fc.applies_to_pl === true
        );
        setCostFinancialCodes(costFcs.map((fc: any) => ({ uuid: fc.uuid, validation: fc.validation, code: fc.code })));
      }

      // Load counteragents
      const caResponse = await fetch('/api/counteragents');
      if (caResponse.ok) {
        const caData = await caResponse.json();
        const cas = (Array.isArray(caData) ? caData : []).map((ca: any) => ({
          uuid: ca.counteragent_uuid || ca.uuid,
          name: ca.counteragent || ca.name,
        }));
        setCostCounterAgents(cas);
      }

      // Load currencies
      const currResponse = await fetch('/api/currencies');
      if (currResponse.ok) {
        const currData = await currResponse.json();
        const currsList = Array.isArray(currData)
          ? currData
          : Array.isArray(currData?.data)
            ? currData.data
            : [];
        const currs = currsList.map((curr: any) => ({
          uuid: curr.uuid,
          code: curr.code,
        }));
        setCostCurrencies(currs);
      }

      // Load existing cost payments
      await fetchCostPayments();
    } catch (err: any) {
      console.error('Failed to load dialog data:', err);
      setCostFinancialCodes([]);
      setCostCounterAgents([]);
      setCostCurrencies([]);
    }
  };

  const fetchCostPayments = async () => {
    try {
      const response = await fetch('/api/payment-id-options');
      if (!response.ok) throw new Error('Failed to fetch payments');
      const data = await response.json();
      if (!Array.isArray(data)) {
        console.warn('[Services Report] Expected payments array, received:', data);
        setCostPayments([]);
        return;
      }
      // Filter to only cost financial codes (is_income = false)
      setCostPayments(data
        .filter((p: any) => {
          const financialCodeIsIncome = p.financialCodeIsIncome ?? p.financial_code_is_income;
          return financialCodeIsIncome === false;
        })
        .map((p: any) => ({
          paymentId: p.paymentId || p.payment_id,
          counteragentUuid: p.counteragentUuid || p.counteragent_uuid || null,
          counteragentName: p.counteragentName || p.counteragent_name || null,
          projectName: p.projectName || p.project_name || null,
          financialCode: p.financialCode || p.financialCodeValidation || p.financial_code || null,
          currencyCode: p.currencyCode || p.currency_code || null,
        })));
    } catch (error) {
      console.error('Error fetching cost payments:', error);
      setCostPayments([]);
    }
  };

  const handleCreateCostPayment = async () => {
    if (!selectedCostCounteragentUuid || !selectedCostFinancialCodeUuid || !selectedCostCurrencyUuid) {
      alert('Please fill Counteragent, Financial Code, and Currency');
      return;
    }

    setIsCreatingCostPayment(true);
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counteragentUuid: selectedCostCounteragentUuid,
          projectUuid: addLedgerCostsProjectUuid,
          financialCodeUuid: selectedCostFinancialCodeUuid,
          incomeTax: false,
          currencyUuid: selectedCostCurrencyUuid,
          label: selectedCostLabel || null
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

      const counteragent = costCounterAgents.find(ca => ca.uuid === selectedCostCounteragentUuid);
      const financialCode = costFinancialCodes.find(fc => fc.uuid === selectedCostFinancialCodeUuid);
      const currency = costCurrencies.find(c => c.uuid === selectedCostCurrencyUuid);

      setPreSelectedCostPaymentId(newPaymentId);
      setSelectedCostPaymentDetails({
        paymentId: newPaymentId,
        counteragent: counteragent?.name || 'N/A',
        project: addLedgerCostsProjectName,
        financialCode: financialCode?.validation || financialCode?.code || 'N/A',
        currency: currency?.code || 'N/A'
      });

      await fetchCostPayments();
      setAddLedgerCostsStep('ledger');
    } catch (error: any) {
      console.error('Error creating payment:', error);
      alert(error.message || 'Failed to create payment');
    } finally {
      setIsCreatingCostPayment(false);
    }
  };

  const handleSkipToCostLedger = () => {
    if (selectedCostCounteragentUuid) {
      const ca = costCounterAgents.find(c => c.uuid === selectedCostCounteragentUuid);
      setSkipCostCounteragentFilter({
        uuid: selectedCostCounteragentUuid,
        name: ca?.name || selectedCostCounteragentUuid,
      });
    } else {
      setSkipCostCounteragentFilter(null);
    }
    setAddLedgerCostsStep('ledger');
  };

  const handleSaveCostLedger = async () => {
    if (isSubmittingCostLedger) return;

    if (!preSelectedCostPaymentId) {
      alert('Please select a payment');
      return;
    }

    const accrualValue = costAccrual ? parseFloat(costAccrual) : null;
    const orderValue = costOrder ? parseFloat(costOrder) : null;

    if ((!accrualValue || accrualValue === 0) && (!orderValue || orderValue === 0)) {
      alert('Either Accrual or Order must be provided and cannot be zero');
      return;
    }

    // Convert ISO date to ISO format if needed
    let isoDate: string | undefined = undefined;
    if (costEffectiveDate) {
      // Check if already in ISO format (yyyy-mm-dd)
      if (/^\d{4}-\d{2}-\d{2}$/.test(costEffectiveDate)) {
        isoDate = costEffectiveDate;
      } else {
        // Try dd.mm.yyyy format
        const datePattern = /^(\d{2})\.(\d{2})\.(\d{4})$/;
        const match = costEffectiveDate.match(datePattern);
        if (match) {
          const [, day, month, year] = match;
          isoDate = `${year}-${month}-${day}`;
        } else {
          alert('Please enter date in yyyy-mm-dd or dd.mm.yyyy format');
          return;
        }
      }
    }

    setIsSubmittingCostLedger(true);
    try {
      const response = await fetch('/api/payments-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: preSelectedCostPaymentId,
          effectiveDate: isoDate,
          accrual: accrualValue,
          order: orderValue,
          comment: costComment || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create ledger entry');
      }

      resetCostLedgerForm();
      setAddLedgerCostsDialogOpen(false);
      await fetchReport();
    } catch (error: any) {
      console.error('Error adding ledger entry:', error);
      alert(error.message || 'Failed to add ledger entry');
    } finally {
      setIsSubmittingCostLedger(false);
    }
  };

  const resetCostLedgerForm = () => {
    setCostEffectiveDate('');
    setCostAccrual('');
    setCostOrder('');
    setCostComment('');
    setPreSelectedCostPaymentId(null);
    setSelectedCostPaymentDetails(null);
    setSelectedCostCounteragentUuid('');
    setSelectedCostFinancialCodeUuid('');
    setSelectedCostCurrencyUuid('');
    setSelectedCostLabel('');
    setSkipCostCounteragentFilter(null);
    setAddLedgerCostsStep('payment');
    setIsSubmittingCostLedger(false);
  };

  const handleExportXlsx = useCallback(() => {
    if (sections.length === 0) return;

    setIsExporting(true);
    try {
      const workbook = XLSX.utils.book_new();
      const sheetNameCounters = new Map<string, number>();

      const buildUniqueSheetName = (rawName: string) => {
        const sanitized = rawName.replace(/[\\/?*\[\]:]/g, ' ').replace(/\s+/g, ' ').trim() || 'Section';
        const base = sanitized.slice(0, 31);
        const existingCount = sheetNameCounters.get(base) || 0;
        sheetNameCounters.set(base, existingCount + 1);
        if (existingCount === 0) return base;

        const suffix = ` (${existingCount + 1})`;
        const truncatedBase = base.slice(0, Math.max(1, 31 - suffix.length));
        return `${truncatedBase}${suffix}`;
      };

      const header = [
        '#',
        'Status',
        'Service State',
        'Financial Code',
        'Project',
        'Project Address',
        'Insider',
        'Department',
        'Project UUID',
        'Counteragent',
        'Counteragent UUID',
        'Payment IDs',
        'Payments',
        'Jobs',
        'Job Names',
        'Currency',
        'Sum',
        'Accrual',
        'Order',
        'Payment',
        'Due',
        'Balance',
        'Confirmed',
        'Latest Date',
      ];

      const summaryHeader = [
        'Section',
        'Rows',
        'Payments',
        'Jobs',
        'Sum',
        'Accrual',
        'Order',
        'Payment',
        'Due',
        'Balance',
      ];

      const summaryRows = sections.map((section) => {
        const sectionTotals = section.rows.reduce(
          (acc, row) => {
            acc.rows += 1;
            acc.payments += row.paymentCount;
            acc.jobs += row.jobsByState.active + row.jobsByState.conversion + row.jobsByState.free + row.jobsByState.others + row.jobsByState.recovery;
            acc.sum += row.sum;
            acc.accrual += row.accrual;
            acc.order += row.order;
            acc.payment += row.payment;
            acc.due += row.due;
            acc.balance += row.balance;
            return acc;
          },
          {
            rows: 0,
            payments: 0,
            jobs: 0,
            sum: 0,
            accrual: 0,
            order: 0,
            payment: 0,
            due: 0,
            balance: 0,
          }
        );

        return [
          section.financialCodeValidation,
          sectionTotals.rows,
          sectionTotals.payments,
          sectionTotals.jobs,
          sectionTotals.sum,
          sectionTotals.accrual,
          sectionTotals.order,
          sectionTotals.payment,
          sectionTotals.due,
          sectionTotals.balance,
        ];
      });

      const grandTotals = summaryRows.reduce(
        (acc, row) => {
          acc.rows += Number(row[1]) || 0;
          acc.payments += Number(row[2]) || 0;
          acc.jobs += Number(row[3]) || 0;
          acc.sum += Number(row[4]) || 0;
          acc.accrual += Number(row[5]) || 0;
          acc.order += Number(row[6]) || 0;
          acc.payment += Number(row[7]) || 0;
          acc.due += Number(row[8]) || 0;
          acc.balance += Number(row[9]) || 0;
          return acc;
        },
        {
          rows: 0,
          payments: 0,
          jobs: 0,
          sum: 0,
          accrual: 0,
          order: 0,
          payment: 0,
          due: 0,
          balance: 0,
        }
      );

      const summaryWorksheet = XLSX.utils.aoa_to_sheet([
        summaryHeader,
        ...summaryRows,
        [
          'TOTAL',
          grandTotals.rows,
          grandTotals.payments,
          grandTotals.jobs,
          grandTotals.sum,
          grandTotals.accrual,
          grandTotals.order,
          grandTotals.payment,
          grandTotals.due,
          grandTotals.balance,
        ],
      ]);
      // Style summary header
      for (let c = 0; c < summaryHeader.length; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        if (!summaryWorksheet[addr]) continue;
        summaryWorksheet[addr].s = {
          font: { bold: true, sz: 10 },
          fill: { fgColor: { rgb: 'E0E0E0' } },
          alignment: { horizontal: 'center' },
        };
      }
      // Style summary total row
      const totalRowIdx = summaryRows.length + 1;
      for (let c = 0; c < summaryHeader.length; c++) {
        const addr = XLSX.utils.encode_cell({ r: totalRowIdx, c });
        if (!summaryWorksheet[addr]) continue;
        summaryWorksheet[addr].s = { font: { bold: true, sz: 10 } };
      }
      XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');

      // Column-specific header colors: Accrual(17)=red, Order(18)=yellow, Payment(19)=green
      const sectionColBg: Record<number, string> = {
        17: 'FFEBEE', // Accrual
        18: 'FFF9E6', // Order
        19: 'E8F5E9', // Payment
      };

      for (const section of sections) {
        const rows = section.rows.map((row, index) => [
          index + 1,
          row.status,
          row.serviceState,
          row.financialCodeValidation,
          row.projectName,
          row.projectAddress || '',
          row.insiderName,
          row.department,
          row.projectUuid,
          row.counteragent,
          row.counteragentUuid ?? '',
          row.paymentIds.join(', '),
          row.paymentCount,
          row.jobsByState.active + row.jobsByState.conversion + row.jobsByState.free + row.jobsByState.others + row.jobsByState.recovery,
          row.jobNames.join(', '),
          row.currency,
          row.sum,
          row.accrual,
          row.order,
          row.payment,
          row.due,
          row.balance,
          row.confirmed ? 'Yes' : 'No',
          formatDate(row.latestDate),
        ]);

        const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);

        // Style header row
        for (let c = 0; c < header.length; c++) {
          const addr = XLSX.utils.encode_cell({ r: 0, c });
          if (!worksheet[addr]) continue;
          const bg = sectionColBg[c] || 'E0E0E0';
          worksheet[addr].s = {
            font: { bold: true, sz: 10 },
            fill: { fgColor: { rgb: bg } },
            alignment: { horizontal: 'center' },
          };
        }

        // Style data rows
        section.rows.forEach((row, rIdx) => {
          const isConfirmedPaid = Boolean(row.confirmed && row.due === 0);
          const isConfirmedDue = Boolean(row.confirmed && row.due > 0);
          const isSumMismatch = Math.abs(row.sum - row.latestAccrual) > 0.009;

          let rowFill: any = undefined;
          if (isConfirmedPaid) rowFill = { fgColor: { rgb: 'F3F4F6' } };
          else if (isConfirmedDue) rowFill = { fgColor: { rgb: 'E8F5E9' } };

          for (let c = 0; c < header.length; c++) {
            const addr = XLSX.utils.encode_cell({ r: rIdx + 1, c });
            if (!worksheet[addr]) continue;
            const cellStyle: any = {};

            if (rowFill) cellStyle.fill = rowFill;
            if (sectionColBg[c]) cellStyle.fill = { fgColor: { rgb: sectionColBg[c] } };

            // Red bold for sum mismatch (column 16 = Sum)
            if (c === 16 && isSumMismatch) {
              cellStyle.font = { bold: true, color: { rgb: 'DC2626' } };
            }

            if (Object.keys(cellStyle).length > 0) {
              worksheet[addr].s = { ...(worksheet[addr].s || {}), ...cellStyle };
            }
          }
        });

        XLSX.utils.book_append_sheet(
          workbook,
          worksheet,
          buildUniqueSheetName(section.financialCodeValidation)
        );
      }

      XLSX.writeFile(workbook, `services-report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setIsExporting(false);
    }
  }, [sections]);

  const handleOpenCostPaymentFilter = useCallback((row: ServicesRow) => {
    if (!row.costPaymentIds || row.costPaymentIds.length === 0) {
      alert('No cost payments found for this project');
      return;
    }

    // Build query parameters for Payments Report
    const costPaymentIdsParam = row.costPaymentIds.join(',');
    const url = `/dictionaries/payments-report?paymentIds=${encodeURIComponent(costPaymentIdsParam)}&isIncome=false`;
    
    // Open in new tab
    window.open(url, '_blank');
  }, []);

  const getSortIcon = (field: SectionColumnKey) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Services Report</h1>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[560px] p-4" align="start">
            <div className="space-y-3">
              <div className="text-sm font-medium">Report Settings</div>
              <div className="text-sm text-gray-600">
                Select financial codes that define service projects for this report.
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  placeholder="Search financial code..."
                  value={financialCodeSearch}
                  onChange={(event) => setFinancialCodeSearch(event.target.value)}
                  className="w-[300px]"
                />
                <Button variant="outline" onClick={selectAllCodes}>Select All</Button>
                <Button variant="outline" onClick={clearAllCodes}>Clear</Button>
                <div className="text-sm text-gray-600">Selected: {selectedFinancialCodeUuids.size}</div>
              </div>
              <div className="max-h-56 overflow-y-auto rounded border p-2">
                {filteredFinancialCodes.length === 0 ? (
                  <div className="text-sm text-gray-500 px-2 py-1">No financial codes found.</div>
                ) : (
                  filteredFinancialCodes.map((code) => {
                    const label = code.validation || `${code.code} ${code.name || ''}`.trim();
                    const checked = selectedFinancialCodeUuids.has(code.uuid);
                    return (
                      <label key={code.uuid} className="flex items-center gap-2 px-2 py-1 text-sm">
                        <Checkbox checked={checked} onCheckedChange={() => toggleFinancialCode(code.uuid)} />
                        <span>{label}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
        {/* Global column selector */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <Columns3 className="h-4 w-4" />
              Columns
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-2" align="start">
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {columns.map((column) => (
                <label key={column.key} className="flex items-center gap-2 px-2 py-1 text-sm cursor-pointer">
                  <Checkbox
                    checked={column.visible}
                    onCheckedChange={() => toggleColumnVisibility(column.key)}
                  />
                  <span>{column.label}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <div className="flex gap-2 items-center">
          <Input
            type="text"
            value={maxDate}
            onChange={(event) => {
              let v = event.target.value.replace(/[^\d.]/g, '');
              if (v.length === 2 && !v.includes('.')) v += '.';
              else if (v.length === 5 && v.split('.').length === 2) v += '.';
              if (v.length <= 10) setMaxDate(v);
            }}
            placeholder="dd.mm.yyyy"
            maxLength={10}
            className="w-[180px]"
          />
          <input
            type="date"
            onChange={(e) => { if (e.target.value) { const [y, m, d] = e.target.value.split('-'); setMaxDate(`${d}.${m}.${y}`); } }}
            className="border border-input rounded-md px-2 cursor-pointer w-12 flex-shrink-0"
            title="Pick date from calendar"
          />
        </div>
        <Input
          placeholder="Search in report..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-[260px]"
        />
        <ClearFiltersButton
          onClear={clearFilters}
          activeCount={activeFilterCount}
          label="Clear Column Filters"
        />
        <AddProjectDialog onSuccess={fetchReport} />
        {selectedPaymentIds.size > 0 && (
          <Dialog open={isConfirmOpen} onOpenChange={(open) => { setIsConfirmOpen(open); if (!open) setConfirmError(null); }}>
            <DialogTrigger asChild>
              <Button variant="default">{selectedPaymentIds.size} selected — Confirm</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Confirm selected payments</DialogTitle>
                <DialogDescription>
                  You are about to confirm ledger entries for {selectedPaymentIds.size} payment{selectedPaymentIds.size === 1 ? '' : 's'}.
                  {maxDate && ` Only entries with effective date ≤ ${maxDate} will be confirmed.`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {maxDate && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Only ledger entries with effective date &lt;= {maxDate} will be confirmed.
                  </div>
                )}
                <div className="max-h-48 overflow-y-auto rounded-md border text-sm">
                  <div className="flex flex-wrap gap-1 p-2">
                    {Array.from(selectedPaymentIds).map((id) => (
                      <span key={id} className="rounded bg-gray-100 px-2 py-0.5 text-xs">{id}</span>
                    ))}
                  </div>
                </div>
                {confirmError && <div className="text-sm text-red-600">{confirmError}</div>}
                <div className="flex gap-3 pt-1">
                  <Button onClick={handleConfirmSelected} disabled={isConfirming} className="flex-1">
                    {isConfirming ? 'Confirming...' : 'Confirm'}
                  </Button>
                  <Button variant="outline" onClick={() => setIsConfirmOpen(false)} className="flex-1">Cancel</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
        {selectedPaymentIds.size > 0 && (
          <Dialog open={isDeconfirmOpen} onOpenChange={(open) => { setIsDeconfirmOpen(open); if (!open) setDeconfirmError(null); }}>
            <DialogTrigger asChild>
              <Button variant="outline">Deconfirm</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Deconfirm selected payments</DialogTitle>
                <DialogDescription>
                  You are about to deconfirm ledger entries for {selectedPaymentIds.size} payment{selectedPaymentIds.size === 1 ? '' : 's'}.
                  {maxDate && ` Only entries with effective date ≤ ${maxDate} will be deconfirmed.`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {maxDate && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Only ledger entries with effective date &lt;= {maxDate} will be deconfirmed.
                  </div>
                )}
                <div className="max-h-48 overflow-y-auto rounded-md border text-sm">
                  <div className="flex flex-wrap gap-1 p-2">
                    {Array.from(selectedPaymentIds).map((id) => (
                      <span key={id} className="rounded bg-gray-100 px-2 py-0.5 text-xs">{id}</span>
                    ))}
                  </div>
                </div>
                {deconfirmError && <div className="text-sm text-red-600">{deconfirmError}</div>}
                <div className="flex gap-3 pt-1">
                  <Button onClick={handleDeconfirmSelected} disabled={isDeconfirming} variant="destructive" className="flex-1">
                    {isDeconfirming ? 'Deconfirming...' : 'Deconfirm'}
                  </Button>
                  <Button variant="outline" onClick={() => setIsDeconfirmOpen(false)} className="flex-1">Cancel</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
        <Button variant="outline" onClick={fetchReport}>Refresh</Button>
        <Button
          variant="outline"
          onClick={handleExportXlsx}
          disabled={isExporting || sortedServices.length === 0}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          {isExporting ? 'Exporting...' : 'Export XLSX'}
        </Button>
      </div>

      <div className="text-sm text-gray-600">Selected financial codes: {selectedFinancialCodeUuids.size}</div>
      {loading ? (
        <div className="rounded-lg border px-3 py-8 text-center text-gray-500">Loading...</div>
      ) : sections.length === 0 ? (
        <div className="rounded-lg border px-3 py-8 text-center text-gray-500">
          {selectedFinancialCodeUuids.size === 0
            ? 'Select at least one financial code from settings to load report data.'
            : 'No rows match current filters.'}
        </div>
      ) : (
        sections.map((section) => {
          const visibleColumns = columns.filter((column) => column.visible);
          const isCollapsed = collapsedSections.has(section.financialCodeUuid);
          return (
            <div key={section.financialCodeUuid} className="rounded-lg border">
              {/* Sticky section header + summary */}
              <div className="sticky top-0 z-20 bg-white rounded-t-lg">
              <div className="px-3 py-2 border-b bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCollapsedSections((prev) => {
                      const next = new Set(prev);
                      if (next.has(section.financialCodeUuid)) next.delete(section.financialCodeUuid);
                      else next.add(section.financialCodeUuid);
                      return next;
                    })}
                    className="w-5 h-5 flex items-center justify-center rounded border text-xs font-bold hover:bg-gray-100"
                  >
                    {isCollapsed ? '+' : '−'}
                  </button>
                  <div className="text-sm font-medium">{section.financialCodeValidation} ({section.rows.length})</div>
                </div>
              </div>
              {/* Section totals boxes (active service_state projects only) */}
              {(() => {
                const totalsMap = new Map<string, { sum: number; accrual: number; order: number; payment: number; due: number; balance: number }>();
                for (const row of section.rows) {
                  if ((row.serviceState || '').toLowerCase() !== 'active') continue;
                  const ccy = row.currency || 'N/A';
                  const cur = totalsMap.get(ccy) || { sum: 0, accrual: 0, order: 0, payment: 0, due: 0, balance: 0 };
                  totalsMap.set(ccy, {
                    sum: cur.sum + row.sum,
                    accrual: cur.accrual + row.accrual,
                    order: cur.order + row.order,
                    payment: cur.payment + row.payment,
                    due: cur.due + row.due,
                    balance: cur.balance + row.balance,
                  });
                }
                const entries = Array.from(totalsMap.entries()).sort(([a], [b]) => a.localeCompare(b));
                return entries.length > 0 ? (
                  <div className="px-3 py-2 border-b bg-blue-50 flex flex-wrap items-center gap-3">
                    {entries.map(([ccy, t]) => (
                      <div key={ccy} className="rounded-md border border-blue-100 bg-white px-3 py-1.5">
                        <div className="text-xs font-semibold text-blue-700">{ccy}</div>
                        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                          <div className="text-gray-600">Sum:</div>
                          <div className="font-semibold text-blue-900 text-right">{formatMoney(t.sum)}</div>
                          <div className="text-gray-600">Accrual:</div>
                          <div className="font-semibold text-blue-900 text-right">{formatMoney(t.accrual)}</div>
                          <div className="text-gray-600">Order:</div>
                          <div className="font-semibold text-blue-900 text-right">{formatMoney(t.order)}</div>
                          <div className="text-gray-600">Payment:</div>
                          <div className="font-semibold text-blue-900 text-right">{formatMoney(t.payment)}</div>
                          <div className="text-gray-600">Due:</div>
                          <div className="font-semibold text-blue-900 text-right">{formatMoney(t.due)}</div>
                          <div className="text-gray-600">Balance:</div>
                          <div className="font-semibold text-blue-900 text-right">{formatMoney(t.balance)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null;
              })()}
              </div>{/* end sticky band */}

              {!isCollapsed && (
              <div className="overflow-x-auto">
              <table className="text-sm min-w-full" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '32px' }} />
                  <col style={{ width: '40px' }} />
                  {visibleColumns.map((column) => (
                    <col key={column.key} style={{ width: `${column.width}px` }} />
                  ))}
                </colgroup>
                <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-2 text-center w-[32px] bg-gray-50">
                      {(() => {
                        const sectionPaymentIds = section.rows.flatMap((r) => r.paymentIds);
                        const allSelected = sectionPaymentIds.length > 0 && sectionPaymentIds.every((id) => selectedPaymentIds.has(id));
                        const someSelected = !allSelected && sectionPaymentIds.some((id) => selectedPaymentIds.has(id));
                        return (
                          <Checkbox
                            checked={allSelected}
                            data-state={someSelected ? 'indeterminate' : undefined}
                            onCheckedChange={() => {
                              setSelectedPaymentIds((prev) => {
                                const next = new Set(prev);
                                if (allSelected) {
                                  sectionPaymentIds.forEach((id) => next.delete(id));
                                } else {
                                  sectionPaymentIds.forEach((id) => next.add(id));
                                }
                                return next;
                              });
                            }}
                            title="Select / deselect all in section"
                          />
                        );
                      })()}
                    </th>
                    <th className="px-2 py-2 text-center w-[40px] bg-gray-50 text-xs text-gray-400">#</th>
                    {visibleColumns.map((column) => {
                      const bg = COLUMN_BG[column.key];
                      const isSortable = column.key !== 'actions';
                      const isFilterable = column.key !== 'actions';
                      
                      // Apply job state colors to columns
                      const jobStateColorMap: Record<string, string> = {
                        jobsActive: '#D4EDDA',
                        jobsConversion: '#FFE5CC',
                        jobsFree: '#D1ECF1',
                        jobsOthers: '#E8EAED',
                        jobsRecovery: '#F8D7DA',
                      };
                      const headerBg = jobStateColorMap[column.key] || bg || '#f9fafb';
                      
                      return (
                      <th
                        key={column.key}
                        draggable
                        onDragStart={() => setDraggedColumn({ key: column.key })}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => handleColumnDrop(column.key)}
                        className={`px-3 py-2 relative overflow-hidden font-semibold ${column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left'}`}
                        style={{ width: `${column.width}px`, maxWidth: `${column.width}px`, backgroundColor: headerBg }}
                      >
                        <div className={`flex items-center gap-2 min-w-0 ${column.align === 'center' ? 'justify-center' : column.align === 'right' ? 'justify-end pr-2' : ''}`}>
                          {isSortable ? (
                            <button
                              onClick={() => handleSort(column.key)}
                              className="inline-flex items-center gap-1 hover:text-black"
                            >
                              <span>{column.label}</span>
                              {getSortIcon(column.key)}
                            </button>
                          ) : (
                            <span>{column.label}</span>
                          )}
                          {isFilterable && (
                            <ColumnFilterPopover
                              columnKey={column.key}
                              columnLabel={column.label}
                              values={getUniqueValues(column.key)}
                              activeFilter={columnFilters.get(column.key)}
                              onAdvancedFilterChange={(filter) => handleFilterChange(column.key, filter)}
                              onSort={(direction) => {
                                setSortField(column.key);
                                setSortDirection(direction);
                              }}
                              columnFormat={COLUMN_FORMAT_MAP[column.key]}
                            />
                          )}
                        </div>
                        <div
                          className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            setResizing({
                              key: column.key,
                              startX: event.clientX,
                              startWidth: column.width,
                            });
                          }}
                        />
                      </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row, index) => {
                    const isConfirmedDue = Boolean(row.confirmed && row.due > 0);
                    const isConfirmedPaid = Boolean(row.confirmed && row.due === 0);
                    const isSumMismatch = Math.abs(row.sum - row.latestAccrual) > 0.009;
                    return (
                    <tr
                      key={`${section.financialCodeUuid}-${row.projectUuid}-${index}`}
                      className={`border-t hover:bg-gray-50 ${
                        isConfirmedPaid ? 'bg-gray-100' : isConfirmedDue ? 'bg-[#e8f5e9]' : ''
                      }`}
                    >
                      <td className="px-2 py-2 text-center">
                        {(() => {
                          const rowHasAnySelected = row.paymentIds.some((id) => selectedPaymentIds.has(id));
                          const rowAllSelected = row.paymentIds.length > 0 && row.paymentIds.every((id) => selectedPaymentIds.has(id));
                          return (
                            <Checkbox
                              checked={rowAllSelected}
                              data-state={rowHasAnySelected && !rowAllSelected ? 'indeterminate' : undefined}
                              onCheckedChange={() => {
                                setSelectedPaymentIds((prev) => {
                                  const next = new Set(prev);
                                  if (rowAllSelected) {
                                    row.paymentIds.forEach((id) => next.delete(id));
                                  } else {
                                    row.paymentIds.forEach((id) => next.add(id));
                                  }
                                  return next;
                                });
                              }}
                            />
                          );
                        })()}
                      </td>
                      <td className="px-2 py-2 text-center text-xs text-gray-500">{index + 1}</td>
                      {visibleColumns.map((column) => {
                        const rawValue = getColumnValue(row, column.key);
                        const bg = COLUMN_BG[column.key];
                        if (column.key === 'confirmed') {
                          return (
                            <td
                              key={column.key}
                              className="px-3 py-2 overflow-hidden"
                              style={{ width: `${column.width}px`, maxWidth: `${column.width}px` }}
                            >
                              <Checkbox checked={Boolean(rawValue)} disabled className="cursor-default" />
                            </td>
                          );
                        }
                        // Job state columns with colored backgrounds
                        const jobStateMap: Record<string, keyof typeof JOB_STATE_COLORS> = {
                          jobsActive: 'active',
                          jobsConversion: 'conversion',
                          jobsFree: 'free',
                          jobsOthers: 'others',
                          jobsRecovery: 'recovery',
                        };
                        if (column.key in jobStateMap) {
                          const stateKey = jobStateMap[column.key as keyof typeof jobStateMap];
                          const colors = JOB_STATE_COLORS[stateKey];
                          const count = typeof rawValue === 'number' ? rawValue : 0;
                          return (
                            <td
                              key={column.key}
                              className="px-2 py-2 text-center overflow-hidden font-semibold"
                              style={{ width: `${column.width}px`, maxWidth: `${column.width}px`, backgroundColor: colors.bg, color: colors.text }}
                              title={`${stateKey.charAt(0).toUpperCase() + stateKey.slice(1)}: ${count}`}
                            >
                              {count > 0 ? count : '-'}
                            </td>
                          );
                        }
                        const value =
                          column.align === 'right' && typeof rawValue === 'number'
                            ? formatMoney(rawValue)
                            : column.key === 'latestDate'
                              ? formatDate((rawValue as string | null) ?? null)
                            : String(rawValue ?? '-');
                        return (
                          <td
                            key={column.key}
                            className={`px-3 py-2 overflow-hidden ${column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left'} ${
                              column.key === 'sum' && isSumMismatch ? 'font-bold text-red-600' : ''
                            }`}
                            style={{ width: `${column.width}px`, maxWidth: `${column.width}px`, ...(bg ? { backgroundColor: bg } : {}) }}
                          >
                            {column.key === 'paymentIds' ? (
                              row.paymentIds.length > 0 ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  {row.paymentIds.map((paymentId) => (
                                    <span key={`${row.projectUuid}-${paymentId}`} className="inline-flex items-center gap-1 text-xs text-gray-700">
                                      <span>{paymentId}</span>
                                      <button
                                        type="button"
                                        onClick={() => openPaymentEditDialog(paymentId)}
                                        className="inline-flex items-center justify-center rounded p-0.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                                        title={`Edit payment ${paymentId}`}
                                      >
                                        <Edit2 className="h-3.5 w-3.5" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )
                            ) : column.key === 'projectName' ? (
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="truncate">{row.projectName || '-'}</span>
                                <a
                                  href={row.projectUuid ? `/admin/projects?projectUuid=${encodeURIComponent(row.projectUuid)}` : '#'}
                                  target={row.projectUuid ? '_blank' : undefined}
                                  rel={row.projectUuid ? 'noopener noreferrer' : undefined}
                                  className={`inline-flex items-center justify-center rounded p-1 transition-colors flex-shrink-0 ${
                                    row.projectUuid
                                      ? 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                                      : 'text-gray-300 cursor-not-allowed'
                                  }`}
                                  title="Open project in Projects table"
                                  aria-disabled={!row.projectUuid}
                                  onClick={(event) => {
                                    if (!row.projectUuid) {
                                      event.preventDefault();
                                    }
                                  }}
                                >
                                  <ArrowUpRight className="h-3.5 w-3.5" />
                                </a>
                              </div>
                            ) : column.key === 'counteragent' ? (
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="truncate">{row.counteragent || '-'}</span>
                                {row.counteragent && row.counteragent !== '-' && (
                                  <a
                                    href={`/dictionaries/counteragents?search=${encodeURIComponent(row.counteragent)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center rounded p-1 transition-colors flex-shrink-0 text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                                    title="Open in Counteragents table"
                                  >
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                  </a>
                                )}
                              </div>
                            ) : column.key === 'actions' ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  onClick={() => openJobLinkDialog(row)}
                                  title={row.jobNames.length > 0 ? `Jobs: ${row.jobNames.join(', ')}` : 'Link jobs to payments'}
                                  className="text-blue-600 hover:text-blue-800 p-0.5 rounded hover:bg-blue-50 transition-colors"
                                >
                                  <Link2 className="w-3.5 h-3.5" />
                                </button>
                                {row.paymentIds.map((paymentId) => (
                                  <span key={`${row.projectUuid}-${paymentId}`} className="inline-flex items-center gap-0.5">
                                    <a
                                      href={`/payment-statement/${paymentId}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-block text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1 rounded transition-colors"
                                      title={`Payment statement: ${paymentId}`}
                                    >
                                      <FileText className="w-4 h-4" />
                                    </a>
                                    <RowAttachments
                                      paymentId={paymentId}
                                      projectUuid={row.projectUuid || null}
                                      projectName={row.projectName || null}
                                      canAddProjectAttachment={Boolean(row.projectUuid)}
                                    />
                                  </span>
                                ))}
                                <a
                                  href={row.counteragentUuid ? `/counteragent-statement/${row.counteragentUuid}` : '#'}
                                  target={row.counteragentUuid ? '_blank' : undefined}
                                  rel={row.counteragentUuid ? 'noopener noreferrer' : undefined}
                                  className={`inline-block p-1 rounded transition-colors ${
                                    row.counteragentUuid
                                      ? row.hasUnboundCounteragentTransactions
                                        ? 'text-red-600 hover:text-red-800 hover:bg-red-50'
                                        : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
                                      : 'text-gray-400'
                                  }`}
                                  aria-disabled={!row.counteragentUuid}
                                  title={
                                    row.hasUnboundCounteragentTransactions
                                      ? 'Counteragent has transactions without payment ID'
                                      : 'View counteragent statement (opens in new tab)'
                                  }
                                  onClick={(event) => {
                                    if (!row.counteragentUuid) {
                                      event.preventDefault();
                                    }
                                  }}
                                >
                                  <User className="w-4 h-4" />
                                </a>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openAddLedgerCostsDialog(row.projectUuid, row.projectName)}
                                  className="text-xs h-7"
                                  title="Add cost ledger entries for this project"
                                >
                                  + Cost
                                </Button>
                              </div>
                            ) : column.key === 'costAccrual' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <span>{value}</span>
                                {row.costPaymentIds && row.costPaymentIds.length > 0 && (
                                  <button
                                    onClick={() => handleOpenCostPaymentFilter(row)}
                                    className="inline-flex items-center justify-center rounded p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                    title={`Filter cost payments (${row.costPaymentIds.length}): ${row.costPaymentIds.slice(0, 3).join(', ')}${row.costPaymentIds.length > 3 ? '...' : ''}`}
                                  >
                                    <Filter className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              value
                            )}
                          </td>
                        );
                      })}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
              )}
            </div>
          );
        })
      )}

      {jobLinkDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl flex flex-col" style={{ width: '95vw', maxWidth: '1960px', height: '95vh' }}>
            <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold">Link Jobs to Project</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 font-medium">{jobLinkDialog.projectName}</span>
                  {jobLinkDialog.projectUuid && (
                    <a
                      href={`/admin/projects?projectUuid=${encodeURIComponent(jobLinkDialog.projectUuid)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded p-1 transition-colors text-gray-400 hover:text-blue-600 hover:bg-blue-50 flex-shrink-0"
                      title="Open project in admin panel"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">
                  {jobLinkDialog.linkedJobUuids.size} selected / {filteredDialogJobs.length} shown / {jobLinkDialog.allJobs.length} total
                </span>
                <button
                  onClick={() => setJobLinkDialog((prev) => ({ ...prev, open: false }))}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="px-5 py-3 border-b shrink-0 flex items-center gap-2">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search jobs by name, project, or brand..."
                  value={jobLinkDialog.search}
                  onChange={(e) => setJobLinkDialog((prev) => ({ ...prev, search: e.target.value }))}
                  className="pl-9 pr-8 w-full"
                  autoFocus
                />
                {jobLinkDialog.search && (
                  <button
                    onClick={() => setJobLinkDialog((prev) => ({ ...prev, search: '' }))}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    title="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {jobLinkDialog.search && (
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {filteredDialogJobs.length} result{filteredDialogJobs.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {/* Bulk operations toolbar */}
            {jobLinkDialog.linkedJobUuids.size > 0 && (
              <div className="px-5 py-3 border-b bg-blue-50 flex items-center gap-4 shrink-0">
                <span className="text-sm font-medium text-gray-700">
                  {jobLinkDialog.linkedJobUuids.size} job{jobLinkDialog.linkedJobUuids.size !== 1 ? 's' : ''} selected
                </span>
                <div className="flex items-center gap-2">
                  <Select value={jobLinkBulkServiceState} onValueChange={setJobLinkBulkServiceState}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Conversion">Conversion</SelectItem>
                      <SelectItem value="Free">Free</SelectItem>
                      <SelectItem value="Others">Others</SelectItem>
                      <SelectItem value="Recovery">Recovery</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleJobLinkBulkServiceStateUpdate}
                    disabled={jobLinkBulkUpdating || !jobLinkBulkServiceState}
                    className="h-8 text-xs"
                  >
                    {jobLinkBulkUpdating ? 'Updating...' : 'Update Service State'}
                  </Button>
                </div>
                <div className="h-6 w-px bg-gray-300" />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openJobLinkBulkBindDialog(jobLinkDialog.projectUuid)}
                  className="h-8 text-xs"
                  disabled={jobLinkBulkBindDialog.loading}
                >
                  {jobLinkBulkBindDialog.loading ? 'Loading...' : 'Bind to Projects'}
                </Button>
              </div>
            )}
            <div className="flex-1 overflow-auto">
              {jobLinkDialog.loading ? (
                <div className="text-sm text-gray-500 py-12 text-center">Loading jobs...</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 z-10">
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left w-10">
                        <Checkbox
                          checked={allFilteredChecked}
                          onCheckedChange={toggleAllFiltered}
                          title="Select / deselect all filtered"
                        />
                      </th>
                      <th className="px-4 py-2 text-left">
                        <div className="flex items-center gap-2">
                          <span>Job Name</span>
                          <ColumnFilterPopover
                            columnKey="jobName"
                            columnLabel="Job Name"
                            values={Array.from(new Set(jobLinkDialog.allJobs.map((j) => j.jobName).filter(Boolean)))}
                            activeFilters={new Set(jobLinkColumnFilters.jobName || [])}
                            columnFormat="text"
                            onFilterChange={(values) => {
                              setJobLinkColumnFilters((prev) => ({
                                ...prev,
                                jobName: values.size > 0 ? Array.from(values) : [],
                              }));
                            }}
                            onSort={() => {}}
                          />
                        </div>
                      </th>
                      <th className="px-4 py-2 text-left">
                        <div className="flex items-center gap-2">
                          <span>Original Project</span>
                          <ColumnFilterPopover
                            columnKey="projectIndex"
                            columnLabel="Original Project"
                            values={Array.from(new Set(jobLinkDialog.allJobs.map((j) => j.projectIndex).filter(Boolean)))}
                            activeFilters={new Set(jobLinkColumnFilters.projectIndex || [])}
                            columnFormat="text"
                            onFilterChange={(values) => {
                              setJobLinkColumnFilters((prev) => ({
                                ...prev,
                                projectIndex: values.size > 0 ? Array.from(values) : [],
                              }));
                            }}
                            onSort={() => {}}
                          />
                        </div>
                      </th>
                      <th className="px-4 py-2 text-left">
                        <div className="flex items-center gap-2">
                          <span>Brand</span>
                          <ColumnFilterPopover
                            columnKey="brandName"
                            columnLabel="Brand"
                            values={Array.from(new Set(jobLinkDialog.allJobs.map((j) => j.brandName).filter(Boolean)))}
                            activeFilters={new Set(jobLinkColumnFilters.brandName || [])}
                            columnFormat="text"
                            onFilterChange={(values) => {
                              setJobLinkColumnFilters((prev) => ({
                                ...prev,
                                brandName: values.size > 0 ? Array.from(values) : [],
                              }));
                            }}
                            onSort={() => {}}
                          />
                        </div>
                      </th>
                      <th className="px-4 py-2 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <span>Floors</span>
                          <ColumnFilterPopover
                            columnKey="floors"
                            columnLabel="Floors"
                            values={Array.from(new Set(jobLinkDialog.allJobs.map((j) => j.floors?.toString()).filter(Boolean))) as any[]}
                            activeFilters={new Set(jobLinkColumnFilters.floors || [])}
                            columnFormat="number"
                            onFilterChange={(values) => {
                              setJobLinkColumnFilters((prev) => ({
                                ...prev,
                                floors: values.size > 0 ? Array.from(values) : [],
                              }));
                            }}
                            onSort={() => {}}
                          />
                        </div>
                      </th>
                      <th className="px-4 py-2 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <span>Weight</span>
                          <ColumnFilterPopover
                            columnKey="weight"
                            columnLabel="Weight"
                            values={Array.from(new Set(jobLinkDialog.allJobs.map((j) => j.weight?.toString()).filter(Boolean))) as any[]}
                            activeFilters={new Set(jobLinkColumnFilters.weight || [])}
                            columnFormat="number"
                            onFilterChange={(values) => {
                              setJobLinkColumnFilters((prev) => ({
                                ...prev,
                                weight: values.size > 0 ? Array.from(values) : [],
                              }));
                            }}
                            onSort={() => {}}
                          />
                        </div>
                      </th>
                      <th className="px-4 py-2 text-center">
                        <div className="flex items-center gap-2 justify-center">
                          <span>FF</span>
                          <ColumnFilterPopover
                            columnKey="isFf"
                            columnLabel="FF"
                            values={['FF', 'No']}
                            activeFilters={new Set(jobLinkColumnFilters.isFf || [])}
                            columnFormat="text"
                            onFilterChange={(values) => {
                              setJobLinkColumnFilters((prev) => ({
                                ...prev,
                                isFf: values.size > 0 ? Array.from(values) : [],
                              }));
                            }}
                            onSort={() => {}}
                          />
                        </div>
                      </th>
                      <th className="px-4 py-2 text-center">
                        <div className="flex items-center gap-2 justify-center">
                          <span>Active</span>
                          <ColumnFilterPopover
                            columnKey="isActive"
                            columnLabel="Active"
                            values={['Yes', 'No']}
                            activeFilters={new Set(jobLinkColumnFilters.isActive || [])}
                            columnFormat="text"
                            onFilterChange={(values) => {
                              setJobLinkColumnFilters((prev) => ({
                                ...prev,
                                isActive: values.size > 0 ? Array.from(values) : [],
                              }));
                            }}
                            onSort={() => {}}
                          />
                        </div>
                      </th>
                      <th className="px-4 py-2 text-left">
                        <div className="flex items-center gap-2">
                          <span>Service State</span>
                          <ColumnFilterPopover
                            columnKey="serviceState"
                            columnLabel="Service State"
                            values={Array.from(new Set(jobLinkDialog.allJobs.map((j) => j.serviceState || '-').filter(Boolean)))}
                            activeFilters={new Set(jobLinkColumnFilters.serviceState || [])}
                            columnFormat="text"
                            onFilterChange={(values) => {
                              setJobLinkColumnFilters((prev) => ({
                                ...prev,
                                serviceState: values.size > 0 ? Array.from(values) : [],
                              }));
                            }}
                            onSort={() => {}}
                          />
                        </div>
                      </th>
                      <th className="px-4 py-2 text-center w-12">Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDialogJobs.length === 0 ? (
                      <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No jobs match your search.</td></tr>
                    ) : (
                      filteredDialogJobs.map((job) => {
                        const checked = jobLinkDialog.linkedJobUuids.has(job.jobUuid);
                        const uniqueRowKey = `${job.jobUuid}_${job.projectName}_${job.brandName}`;
                        return (
                          <tr
                            key={uniqueRowKey}
                            className={`border-b hover:bg-gray-50 ${checked ? 'bg-blue-50' : ''}`}
                          >
                            <td className="px-4 py-2">
                              <Checkbox checked={checked} onCheckedChange={() => toggleJobLink(job.jobUuid)} />
                            </td>
                            <td className="px-4 py-2 font-medium cursor-pointer hover:underline" onClick={() => toggleJobLink(job.jobUuid)}>{job.jobName}</td>
                            <td className="px-4 py-2 text-gray-600 cursor-pointer hover:underline" onClick={() => toggleJobLink(job.jobUuid)}>{job.projectIndex || '-'}</td>
                            <td className="px-4 py-2 text-gray-600 cursor-pointer hover:underline" onClick={() => toggleJobLink(job.jobUuid)}>{job.brandName || '-'}</td>
                            <td className="px-4 py-2 text-right cursor-pointer hover:underline" onClick={() => toggleJobLink(job.jobUuid)}>{job.floors ?? '-'}</td>
                            <td className="px-4 py-2 text-right cursor-pointer hover:underline" onClick={() => toggleJobLink(job.jobUuid)}>{job.weight ?? '-'}</td>
                            <td className="px-4 py-2 text-center cursor-pointer hover:underline" onClick={() => toggleJobLink(job.jobUuid)}>{job.isFf ? 'FF' : ''}</td>
                            <td className="px-4 py-2 text-center cursor-pointer hover:underline" onClick={() => toggleJobLink(job.jobUuid)}>{job.isActive ? 'Yes' : 'No'}</td>
                            <td className="px-4 py-2 text-left cursor-pointer hover:underline" onClick={() => toggleJobLink(job.jobUuid)}>{job.serviceState || '-'}</td>
                            <td className="px-4 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => openJobLinkEditDialog(job.jobUuid)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t shrink-0">
              <Button variant="outline" onClick={() => setJobLinkDialog((prev) => ({ ...prev, open: false }))}>
                Cancel
              </Button>
              <Button onClick={saveJobLinks} disabled={jobLinkDialog.saving || jobLinkDialog.loading}>
                {jobLinkDialog.saving ? 'Saving...' : `Save (${jobLinkDialog.linkedJobUuids.size} jobs)`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Job Edit Dialog */}
      {jobLinkEditDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b px-5 py-3 sticky top-0 bg-white">
              <h2 className="text-base font-semibold">Edit Job</h2>
              <button 
                onClick={() => setJobLinkEditDialog((prev) => ({ ...prev, open: false, jobUuid: null }))} 
                className="text-gray-400 hover:text-gray-600" 
                disabled={jobLinkEditDialog.saving}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              {jobLinkEditDialog.loading ? (
                <div className="text-sm text-gray-500 text-center py-8">Loading job details...</div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="job-name">Job Name *</Label>
                    <Input
                      id="job-name"
                      value={jobLinkEditDialog.jobName}
                      onChange={(e) => setJobLinkEditDialog((prev) => ({ ...prev, jobName: e.target.value }))}
                      placeholder="Enter job name"
                      disabled={jobLinkEditDialog.saving}
                    />
                  </div>
                  <div>
                    <Label htmlFor="job-factory-no">Factory No</Label>
                    <Input
                      id="job-factory-no"
                      value={jobLinkEditDialog.factoryNo}
                      onChange={(e) => setJobLinkEditDialog((prev) => ({ ...prev, factoryNo: e.target.value }))}
                      placeholder="Enter factory number"
                      disabled={jobLinkEditDialog.saving}
                    />
                  </div>
                  <div>
                    <Label htmlFor="job-brand">Brand *</Label>
                    <Select
                      value={jobLinkEditDialog.brandUuid}
                      onValueChange={(value) => setJobLinkEditDialog((prev) => ({ ...prev, brandUuid: value }))}
                      disabled={jobLinkEditDialog.saving}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select brand..." />
                      </SelectTrigger>
                      <SelectContent>
                        {jobEditBrands.map((brand: any) => (
                          <SelectItem key={brand.uuid || brand.id} value={brand.uuid || brand.id}>
                            {brand.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="job-projects">Projects *</Label>
                    <MultiCombobox
                      options={paymentProjects
                        .filter(p => p.project_uuid || p.projectUuid)
                        .map(p => ({
                          value: (p.project_uuid || p.projectUuid) as string,
                          label: `${p.project_index || p.projectIndex} - ${p.project_name || p.projectName}`,
                          keywords: `${p.project_index || p.projectIndex} ${p.project_name || p.projectName}`
                        }))}
                      value={jobLinkEditDialog.projectUuids || []}
                      onValueChange={(values: string[]) => setJobLinkEditDialog((prev) => ({ ...prev, projectUuids: values }))}
                      placeholder="Select one or more projects..."
                      searchPlaceholder="Search projects..."
                      emptyText="No project found."
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="job-floors">Floors *</Label>
                      <Input
                        id="job-floors"
                        type="number"
                        value={jobLinkEditDialog.floors}
                        onChange={(e) => setJobLinkEditDialog((prev) => ({ ...prev, floors: e.target.value }))}
                        placeholder="Enter number of floors"
                        disabled={jobLinkEditDialog.saving}
                      />
                    </div>
                    <div>
                      <Label htmlFor="job-weight">Weight (kg) *</Label>
                      <Input
                        id="job-weight"
                        type="number"
                        value={jobLinkEditDialog.weight}
                        onChange={(e) => setJobLinkEditDialog((prev) => ({ ...prev, weight: e.target.value }))}
                        placeholder="Enter weight in kg"
                        disabled={jobLinkEditDialog.saving}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="job-selling-price">Selling Price</Label>
                      <Input
                        id="job-selling-price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={jobLinkEditDialog.sellingPrice}
                        onChange={(e) => setJobLinkEditDialog((prev) => ({ ...prev, sellingPrice: e.target.value }))}
                        placeholder="Enter selling price"
                        disabled={jobLinkEditDialog.saving}
                      />
                    </div>
                    <div>
                      <Label htmlFor="job-service-state">Service State</Label>
                      <Select
                        value={jobLinkEditDialog.serviceState}
                        onValueChange={(value) => setJobLinkEditDialog((prev) => ({ ...prev, serviceState: value }))}
                        disabled={jobLinkEditDialog.saving}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select service state..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Conversion">Conversion</SelectItem>
                          <SelectItem value="Free">Free</SelectItem>
                          <SelectItem value="Others">Others</SelectItem>
                          <SelectItem value="Recovery">Recovery</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="job-ff"
                      checked={jobLinkEditDialog.isFf}
                      onCheckedChange={(checked) => setJobLinkEditDialog((prev) => ({ ...prev, isFf: checked }))}
                      disabled={jobLinkEditDialog.saving}
                    />
                    <Label htmlFor="job-ff">FF (firefighter)</Label>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t">
              <Button 
                variant="outline" 
                onClick={() => setJobLinkEditDialog((prev) => ({ ...prev, open: false, jobUuid: null }))}
                disabled={jobLinkEditDialog.saving}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleJobLinkEditSave}
                disabled={jobLinkEditDialog.saving || jobLinkEditDialog.loading}
              >
                {jobLinkEditDialog.saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {jobLinkBulkBindDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h2 className="text-base font-semibold">Bind Jobs to Projects</h2>
              <button
                onClick={() => setJobLinkBulkBindDialog((prev) => ({ ...prev, open: false, selectedProjectUuids: [] }))}
                className="text-gray-400 hover:text-gray-600"
                disabled={jobLinkBulkBindDialog.saving}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="text-sm text-gray-600">
                {jobLinkDialog.linkedJobUuids.size} job{jobLinkDialog.linkedJobUuids.size !== 1 ? 's' : ''} will be bound to project.
              </div>
              {jobLinkBulkBindDialog.selectedProjectUuids.length > 0 && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-sm font-medium text-gray-700">Target Project:</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {(() => {
                      const targetProj = paymentProjects.find(
                        (p) => (p.project_uuid || '') === jobLinkBulkBindDialog.selectedProjectUuids[0]
                      );
                      return targetProj
                        ? `${targetProj.project_index} - ${targetProj.project_name}`
                        : jobLinkBulkBindDialog.selectedProjectUuids[0];
                    })()}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t">
              <Button
                variant="outline"
                onClick={() => setJobLinkBulkBindDialog((prev) => ({ ...prev, open: false, selectedProjectUuids: [] }))}
                disabled={jobLinkBulkBindDialog.saving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleJobLinkBulkBind}
                disabled={jobLinkBulkBindDialog.saving || jobLinkBulkBindDialog.selectedProjectUuids.length === 0}
              >
                {jobLinkBulkBindDialog.saving ? 'Binding...' : 'Bind Jobs'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {paymentEditDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h2 className="text-base font-semibold">Edit Payment</h2>
              <button onClick={closePaymentEditDialog} className="text-gray-400 hover:text-gray-600" disabled={paymentEditDialog.saving}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <div className="text-sm text-gray-600">Original payment ID: {paymentEditDialog.originalPaymentId}</div>
              {paymentEditDialog.loading ? <div className="text-sm text-gray-500">Loading payment details...</div> : null}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Payment ID</label>
                  <Input
                    value={paymentEditDialog.paymentId}
                    onChange={(event) =>
                      setPaymentEditDialog((prev) => ({ ...prev, paymentId: event.target.value }))
                    }
                    placeholder="Enter payment ID"
                    disabled={paymentEditDialog.loading || paymentEditDialog.saving}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Label</label>
                  <Input
                    value={paymentEditDialog.label}
                    onChange={(event) =>
                      setPaymentEditDialog((prev) => ({ ...prev, label: event.target.value }))
                    }
                    placeholder="Enter payment label"
                    disabled={paymentEditDialog.loading || paymentEditDialog.saving}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Counteragent *</label>
                  <select
                    value={paymentEditDialog.counteragentUuid}
                    onChange={(event) =>
                      setPaymentEditDialog((prev) => ({ ...prev, counteragentUuid: event.target.value }))
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    disabled={paymentEditDialog.loading || paymentEditDialog.saving}
                  >
                    <option value="">Select counteragent</option>
                    {paymentCounteragents.map((ca) => {
                      const uuid = ca.counteragent_uuid || ca.counteragentUuid || '';
                      const name = ca.counteragent || ca.name || '';
                      const inn = ca.identification_number || ca.identificationNumber || '';
                      return (
                        <option key={uuid} value={uuid}>
                          {inn ? `${name} (TIN ${inn})` : name}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Financial Code *</label>
                  <select
                    value={paymentEditDialog.financialCodeUuid}
                    onChange={(event) =>
                      setPaymentEditDialog((prev) => ({ ...prev, financialCodeUuid: event.target.value }))
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    disabled={paymentEditDialog.loading || paymentEditDialog.saving}
                  >
                    <option value="">Select financial code</option>
                    {paymentFinancialCodes.map((fc) => (
                      <option key={fc.uuid} value={fc.uuid}>
                        {fc.validation || fc.code || fc.uuid}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Currency *</label>
                  <select
                    value={paymentEditDialog.currencyUuid}
                    onChange={(event) =>
                      setPaymentEditDialog((prev) => ({ ...prev, currencyUuid: event.target.value }))
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    disabled={paymentEditDialog.loading || paymentEditDialog.saving}
                  >
                    <option value="">Select currency</option>
                    {paymentCurrencies.map((currency) => (
                      <option key={currency.uuid} value={currency.uuid}>
                        {currency.code || currency.name || currency.uuid}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Project (Optional)</label>
                  <select
                    value={paymentEditDialog.projectUuid}
                    onChange={(event) =>
                      setPaymentEditDialog((prev) => ({ ...prev, projectUuid: event.target.value, jobUuid: '' }))
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    disabled={paymentEditDialog.loading || paymentEditDialog.saving}
                  >
                    <option value="">No project</option>
                    {paymentProjects.map((project) => {
                      const projectUuid = project.projectUuid || project.project_uuid || '';
                      const projectLabel =
                        project.projectIndex ||
                        project.project_index ||
                        project.projectName ||
                        project.project_name ||
                        projectUuid;
                      return (
                        <option key={projectUuid} value={projectUuid}>
                          {projectLabel}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Job (Optional)</label>
                  <select
                    value={paymentEditDialog.jobUuid}
                    onChange={(event) =>
                      setPaymentEditDialog((prev) => ({ ...prev, jobUuid: event.target.value }))
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    disabled={!paymentEditDialog.projectUuid || paymentEditDialog.loading || paymentEditDialog.saving}
                  >
                    <option value="">No job</option>
                    {paymentJobs.map((job) => (
                      <option key={job.jobUuid} value={job.jobUuid}>
                        {job.jobDisplay || job.jobName || job.jobUuid}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-1 flex items-center gap-2 md:col-span-2">
                  <Checkbox
                    id="services-report-edit-income-tax"
                    checked={paymentEditDialog.incomeTax}
                    onCheckedChange={(value) =>
                      setPaymentEditDialog((prev) => ({ ...prev, incomeTax: Boolean(value) }))
                    }
                    disabled={paymentEditDialog.loading || paymentEditDialog.saving}
                  />
                  <label htmlFor="services-report-edit-income-tax" className="text-sm">
                    Income Tax
                  </label>
                  <Checkbox
                    id="services-report-edit-is-active"
                    checked={paymentEditDialog.isActive}
                    onCheckedChange={(value) =>
                      setPaymentEditDialog((prev) => ({ ...prev, isActive: Boolean(value) }))
                    }
                    disabled={paymentEditDialog.loading || paymentEditDialog.saving}
                  />
                  <label htmlFor="services-report-edit-is-active" className="text-sm">
                    Active
                  </label>
                </div>
              </div>
              {paymentEditDialog.error ? (
                <div className="text-sm text-red-600">{paymentEditDialog.error}</div>
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
              <Button variant="outline" onClick={closePaymentEditDialog} disabled={paymentEditDialog.saving}>
                Cancel
              </Button>
              <Button onClick={savePaymentEdit} disabled={paymentEditDialog.loading || paymentEditDialog.saving}>
                {paymentEditDialog.saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Ledger for Costs Dialog - Two-step flow */}
      <Dialog open={addLedgerCostsDialogOpen} onOpenChange={setAddLedgerCostsDialogOpen}>
        <DialogContent className="w-[80%] max-w-6xl">
          <DialogHeader>
            <DialogTitle>
              {addLedgerCostsStep === 'payment' ? 'Add Cost Payment' : 'Add Cost Ledger Entry'}
            </DialogTitle>
            <DialogDescription>
              {addLedgerCostsStep === 'payment'
                ? 'Create a cost payment first, or skip to add a ledger entry to an existing payment.'
                : 'Add a new entry to the cost ledger.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {addLedgerCostsStep === 'payment' ? (
              <>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  Create a cost payment first, or skip to add a ledger entry to an existing payment.
                </div>

                <div className="space-y-2">
                  <Label>Counteragent <span className="text-red-500">*</span></Label>
                  <Combobox
                    value={selectedCostCounteragentUuid}
                    onValueChange={setSelectedCostCounteragentUuid}
                    options={costCounterAgents
                      .filter(ca => ca.name) // Filter out entries without names
                      .map(ca => ({
                        value: ca.uuid,
                        label: ca.name as string
                      }))}
                    placeholder="Select counteragent..."
                    searchPlaceholder="Search counteragents..."
                  />
                </div>

                <div className="space-y-2">
                  <Label className={!selectedCostCounteragentUuid ? 'text-muted-foreground' : ''}>
                    Cost Financial Code <span className="text-red-500">*</span>
                  </Label>
                  <Combobox
                    value={selectedCostFinancialCodeUuid}
                    onValueChange={setSelectedCostFinancialCodeUuid}
                    options={costFinancialCodes
                      .filter(fc => fc.validation || fc.code) // Filter out entries without label
                      .map(fc => ({
                      value: fc.uuid,
                      label: (fc.validation || fc.code || 'Unknown') as string
                    }))}
                    placeholder="Select financial code..."
                    searchPlaceholder="Search financial codes..."
                    disabled={!selectedCostCounteragentUuid}
                  />
                </div>

                <div className="space-y-2">
                  <Label className={!selectedCostFinancialCodeUuid ? 'text-muted-foreground' : ''}>
                    Currency <span className="text-red-500">*</span>
                  </Label>
                  <Combobox
                    value={selectedCostCurrencyUuid}
                    onValueChange={setSelectedCostCurrencyUuid}
                    options={costCurrencies
                      .filter(c => c.code) // Filter out entries without code
                      .map(c => ({
                      value: c.uuid,
                      label: c.code as string
                    }))}
                    placeholder="Select currency..."
                    searchPlaceholder="Search currencies..."
                    disabled={!selectedCostFinancialCodeUuid}
                  />
                </div>

                <div className="space-y-2">
                  <Label className={!selectedCostCurrencyUuid ? 'text-muted-foreground' : ''}>Project</Label>
                  <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                    <span className="font-bold" style={{ color: '#000' }}>{addLedgerCostsProjectName}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Label (Optional)</Label>
                  <Input
                    value={selectedCostLabel}
                    onChange={(e) => setSelectedCostLabel(e.target.value)}
                    placeholder="Payment label"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handleCreateCostPayment}
                    className="flex-1"
                    disabled={isCreatingCostPayment || !selectedCostCounteragentUuid || !selectedCostFinancialCodeUuid || !selectedCostCurrencyUuid}
                  >
                    {isCreatingCostPayment ? 'Creating...' : 'Create Payment & Continue'}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleSkipToCostLedger}
                  >
                    Skip - Use Existing Payment
                  </Button>
                </div>
              </>
            ) : (
              <>
                {selectedCostPaymentDetails && preSelectedCostPaymentId ? (
                  // Show payment details as read-only form fields
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Cost Payment Details</h3>
                      
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-600">Payment ID</Label>
                          <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                            <span className="font-bold" style={{ color: '#000' }}>{selectedCostPaymentDetails.paymentId}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-600">Currency</Label>
                          <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                            <span className="font-bold" style={{ color: '#000' }}>{selectedCostPaymentDetails.currency}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-gray-600">Type</Label>
                          <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                            <span className="font-bold" style={{ color: '#000' }}>Cost</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-600">Counteragent</Label>
                        <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                          <span className="font-bold" style={{ color: '#000' }}>{selectedCostPaymentDetails.counteragent}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-600">Project</Label>
                        <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                          <span className="font-bold" style={{ color: '#000' }}>{selectedCostPaymentDetails.project}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-600">Financial Code</Label>
                        <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                          <span className="font-bold" style={{ color: '#000' }}>{selectedCostPaymentDetails.financialCode}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Show payment selection dropdown
                  <div className="space-y-2">
                    <Label>Cost Payment</Label>
                    {skipCostCounteragentFilter && (
                      <div className="flex items-center gap-2 rounded-md bg-blue-50 border border-blue-200 px-3 py-1.5 text-sm text-blue-800">
                        <span className="flex-1">Showing payments for: <strong>{skipCostCounteragentFilter.name}</strong></span>
                        <button
                          type="button"
                          className="text-blue-500 hover:text-blue-700 font-bold leading-none"
                          onClick={() => setSkipCostCounteragentFilter(null)}
                        >
                          ×
                        </button>
                      </div>
                    )}
                    <Combobox
                      value={preSelectedCostPaymentId || ''}
                      onValueChange={(value) => {
                        setPreSelectedCostPaymentId(value);
                        const payment = costPayments.find(p => p.paymentId === value);
                        if (payment) {
                          setSelectedCostPaymentDetails({
                            paymentId: payment.paymentId,
                            counteragent: payment.counteragentName || 'N/A',
                            project: addLedgerCostsProjectName,
                            financialCode: payment.financialCode || 'N/A',
                            currency: payment.currencyCode || 'N/A'
                          });
                        }
                      }}
                      filter={(value, search) => {
                        if (!search) return 1;
                        try {
                          const regex = new RegExp(search, 'i');
                          return regex.test(value) ? 1 : 0;
                        } catch {
                          return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                        }
                      }}
                      options={costPayments
                        .filter(p => !skipCostCounteragentFilter || p.counteragentUuid === skipCostCounteragentFilter.uuid)
                        .map(p => {
                          const parts: string[] = [p.paymentId];
                          if (p.counteragentName) parts.push(p.counteragentName);
                          if (p.financialCode) parts.push(p.financialCode);
                          if (p.currencyCode) parts.push(p.currencyCode);
                          
                          const fullLabel = (parts.join(' | ') || p.paymentId) as string;
                          
                          return {
                            value: p.paymentId,
                            label: fullLabel,
                            displayLabel: fullLabel,
                            keywords: parts.filter(Boolean).join(' ')
                          };
                        })}
                      placeholder="Select cost payment..."
                      searchPlaceholder="Search by payment ID, counteragent, code..."
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Effective Date</Label>
                  <div className="relative flex gap-2">
                    <Input
                      type="date"
                      value={costEffectiveDate}
                      onChange={(e) => setCostEffectiveDate(e.target.value)}
                      placeholder="YYYY-MM-DD"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Accrual</Label>
                    <Input
                      type="number"
                      value={costAccrual}
                      onChange={(e) => setCostAccrual(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Order</Label>
                    <Input
                      type="number"
                      value={costOrder}
                      onChange={(e) => setCostOrder(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Comment (Optional)</Label>
                  <Input
                    value={costComment}
                    onChange={(e) => setCostComment(e.target.value)}
                    placeholder="Optional comment"
                  />
                </div>

                <div className="text-xs text-gray-500">
                  At least one of Accrual or Order must be provided.
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                resetCostLedgerForm();
                setAddLedgerCostsDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            {addLedgerCostsStep === 'ledger' && (
              <Button
                onClick={handleSaveCostLedger}
                disabled={isSubmittingCostLedger || !preSelectedCostPaymentId}
              >
                {isSubmittingCostLedger ? 'Adding...' : 'Add Entry'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
     </div>
   );
 }
