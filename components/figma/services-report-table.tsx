'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ArrowUpRight, Columns3, Download, Edit2, FileText, Link2, Settings, User, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { ColumnFilterPopover } from './shared/column-filter-popover';
import type { ColumnFormat } from './shared/table-filters';
import { ClearFiltersButton } from './shared/clear-filters-button';
import { useTableFilters, type FilterableColumn } from './shared/use-table-filters';
import * as XLSX from 'xlsx';
import { AddProjectDialog } from './add-project-dialog';
import { PaymentAttachments } from './payment-attachments';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';

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
  jobsCount: number;
  jobNames: string[];
  accrual: number;
  latestAccrual: number;
  order: number;
  lastMonthAccrual: number;
  lastMonthOrder: number;
  payment: number;
  due: number;
  balance: number;
  confirmed: boolean;
  latestDate: string | null;
};

type ServicesSummaryRow = {
  status: string;
  projectsCount: number;
  jobsCount: number;
  paymentCount: number;
  accrual: number;
  order: number;
  payment: number;
  due: number;
  balance: number;
};

type ServicesReportResponse = {
  rows: ServicesRow[];
  summaryByStatus: ServicesSummaryRow[];
  totals: {
    projectsCount: number;
    jobsCount: number;
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
  brandName: string;
  floors: number | null;
  weight: number | null;
  isFf: boolean;
  isActive: boolean;
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
  | 'jobsCount'
  | 'accrual'
  | 'order'
  | 'payment'
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
  align?: 'left' | 'right';
};

type SectionData = {
  financialCodeUuid: string;
  financialCodeValidation: string;
  rows: ServicesRow[];
};

const DEFAULT_TOTALS = {
  projectsCount: 0,
  jobsCount: 0,
  paymentCount: 0,
  accrual: 0,
  order: 0,
  payment: 0,
  due: 0,
  balance: 0,
};

const SERVICES_REPORT_COLUMNS_STORAGE_KEY = 'servicesReportSectionColumnsV7';

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
  { key: 'jobsCount', label: 'Jobs', visible: true, width: 90, align: 'right' },
  { key: 'accrual', label: 'Accrual', visible: true, width: 130, align: 'right' },
  { key: 'order', label: 'Order', visible: true, width: 130, align: 'right' },
  { key: 'payment', label: 'Payment', visible: true, width: 130, align: 'right' },
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

const COLUMN_BG: Partial<Record<SectionColumnKey, string>> = {
  accrual: '#ffebee',
  order: '#fff9e6',
  payment: '#e8f5e9',
};

const COLUMN_FORMAT_MAP: Partial<Record<SectionColumnKey, ColumnFormat>> = {
  serviceState: 'text',
  insiderName: 'text',
  department: 'text',
  projectAddress: 'text',
  sum: 'currency',
  paymentCount: 'number',
  jobsCount: 'number',
  accrual: 'currency',
  order: 'currency',
  payment: 'currency',
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
    case 'confirmed':
      return row.confirmed;
    case 'projectAddress':
      return row.projectAddress || '';
    case 'paymentIds':
      return row.paymentIds.join(', ');
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

  const [sectionColumns, setSectionColumns] = useState<Record<string, SectionColumn[]>>({});
  const [draggedColumn, setDraggedColumn] = useState<{ sectionId: string; key: SectionColumnKey } | null>(null);
  const [resizing, setResizing] = useState<{
    sectionId: string;
    key: SectionColumnKey;
    startX: number;
    startWidth: number;
  } | null>(null);

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
  const [paymentProjects, setPaymentProjects] = useState<ProjectOption[]>([]);
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

    if (savedMaxDate && /^\d{4}-\d{2}-\d{2}$/.test(savedMaxDate)) {
      setMaxDate(savedMaxDate);
    }

    if (savedColumns) {
      try {
        const parsed = JSON.parse(savedColumns) as Record<string, SectionColumn[]>;
        if (parsed && typeof parsed === 'object') {
          setSectionColumns(parsed);
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
    localStorage.setItem(SERVICES_REPORT_COLUMNS_STORAGE_KEY, JSON.stringify(sectionColumns));
  }, [sectionColumns]);

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (event: MouseEvent) => {
      const delta = event.clientX - resizing.startX;
      const nextWidth = Math.max(20, resizing.startWidth + delta);
      setSectionColumns((prev) => {
        const current = prev[resizing.sectionId] || DEFAULT_SECTION_COLUMNS;
        const updated = current.map((column) =>
          column.key === resizing.key ? { ...column, width: nextWidth } : column
        );
        return {
          ...prev,
          [resizing.sectionId]: updated,
        };
      });
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
    const response = await fetch('/api/financial-codes?leafOnly=true&isIncome=true');
    if (!response.ok) throw new Error('Failed to load financial codes');
    const data = await response.json();
    if (!Array.isArray(data)) {
      setFinancialCodes([]);
      return;
    }
    const mapped = data.map((item: any) => ({
      uuid: item.uuid,
      code: item.code,
      validation: item.validation,
      name: item.name,
    }));
    setFinancialCodes(mapped);
  }, []);

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
          maxDate: maxDate && /^\d{4}-\d{2}-\d{2}$/.test(maxDate) ? maxDate : null,
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
          maxDate: maxDate && /^\d{4}-\d{2}-\d{2}$/.test(maxDate) ? maxDate : null,
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
      if (maxDate && /^\d{4}-\d{2}-\d{2}$/.test(maxDate)) {
        params.set('maxDate', maxDate);
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
  }, [maxDate, selectedFinancialCodeUuids]);

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

  const getColumnsForSection = (sectionId: string) => {
    return sectionColumns[sectionId] || DEFAULT_SECTION_COLUMNS;
  };

  const setColumnsForSection = (sectionId: string, updater: (current: SectionColumn[]) => SectionColumn[]) => {
    setSectionColumns((prev) => {
      const current = prev[sectionId] || DEFAULT_SECTION_COLUMNS;
      return {
        ...prev,
        [sectionId]: updater(current),
      };
    });
  };

  const toggleColumnVisibility = (sectionId: string, key: SectionColumnKey) => {
    setColumnsForSection(sectionId, (current) =>
      current.map((column) =>
        column.key === key ? { ...column, visible: !column.visible } : column
      )
    );
  };

  const handleColumnDrop = (sectionId: string, targetKey: SectionColumnKey) => {
    if (!draggedColumn || draggedColumn.sectionId !== sectionId || draggedColumn.key === targetKey) return;
    setColumnsForSection(sectionId, (current) => {
      const fromIndex = current.findIndex((column) => column.key === draggedColumn.key);
      const toIndex = current.findIndex((column) => column.key === targetKey);
      if (fromIndex === -1 || toIndex === -1) return current;
      const reordered = [...current];
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
        brandName: j.brandName || j.brand_name || '',
        floors: j.floors ?? null,
        weight: j.weight ?? null,
        isFf: Boolean(j.isFf || j.is_ff),
        isActive: j.is_active !== false,
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
    const s = jobLinkDialog.search.toLowerCase();
    if (!s) return jobLinkDialog.allJobs;
    return jobLinkDialog.allJobs.filter((j) =>
      j.jobName.toLowerCase().includes(s) ||
      j.projectName.toLowerCase().includes(s) ||
      j.brandName.toLowerCase().includes(s)
    );
  }, [jobLinkDialog.allJobs, jobLinkDialog.search]);

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

      setJobLinkDialog((prev) => ({ ...prev, open: false, saving: false }));
      await fetchReport();
    } catch (err: any) {
      alert(err?.message || 'Failed to save job links');
      setJobLinkDialog((prev) => ({ ...prev, saving: false }));
    }
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
            acc.jobs += row.jobsCount;
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
      XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');

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
          row.jobsCount,
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
        <Input
          type="date"
          value={maxDate}
          onChange={(event) => setMaxDate(event.target.value)}
          className="w-[180px]"
        />
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
          const columns = getColumnsForSection(section.financialCodeUuid);
          const visibleColumns = columns.filter((column) => column.visible);
          const selectorColumns = columns;
          return (
            <div key={section.financialCodeUuid} className="rounded-lg border">
              {/* Sticky section header + summary */}
              <div className="sticky top-0 z-20 bg-white rounded-t-lg">
              <div className="px-3 py-2 border-b bg-gray-50 flex items-center justify-between">
                <div className="text-sm font-medium">{section.financialCodeValidation} ({section.rows.length})</div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1">
                      <Columns3 className="h-4 w-4" />
                      Columns
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-2" align="end">
                    <div className="space-y-1 max-h-72 overflow-y-auto">
                      {selectorColumns.map((column) => (
                        <label key={column.key} className="flex items-center gap-2 px-2 py-1 text-sm">
                          <Checkbox
                            checked={column.visible}
                            onCheckedChange={() => toggleColumnVisibility(section.financialCodeUuid, column.key)}
                          />
                          <span>{column.label}</span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
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

              <div className="overflow-x-auto">
              <table className="text-sm min-w-full" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '56px' }} />
                  {visibleColumns.map((column) => (
                    <col key={column.key} style={{ width: `${column.width}px` }} />
                  ))}
                </colgroup>
                <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left w-[56px] bg-gray-50">
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
                    {visibleColumns.map((column) => {
                      const bg = COLUMN_BG[column.key];
                      const isSortable = column.key !== 'actions';
                      const isFilterable = column.key !== 'actions';
                      return (
                      <th
                        key={column.key}
                        draggable
                        onDragStart={() => setDraggedColumn({ sectionId: section.financialCodeUuid, key: column.key })}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => handleColumnDrop(section.financialCodeUuid, column.key)}
                        className={`px-3 py-2 relative overflow-hidden ${column.align === 'right' ? 'text-right' : 'text-left'}`}
                        style={{ width: `${column.width}px`, maxWidth: `${column.width}px`, backgroundColor: bg || '#f9fafb' }}
                      >
                        <div className={`flex items-center gap-2 min-w-0 ${column.align === 'right' ? 'justify-end pr-2' : ''}`}>
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
                              sectionId: section.financialCodeUuid,
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
                      <td className="px-3 py-2">
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
                        const value =
                          column.align === 'right' && typeof rawValue === 'number'
                            ? formatMoney(rawValue)
                            : column.key === 'latestDate'
                              ? formatDate((rawValue as string | null) ?? null)
                            : String(rawValue ?? '-');
                        return (
                          <td
                            key={column.key}
                            className={`px-3 py-2 overflow-hidden ${column.align === 'right' ? 'text-right' : 'text-left'} ${
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
                            ) : column.key === 'jobsCount' ? (
                              <div className="flex items-center justify-end gap-1">
                                <span>{row.jobsCount}</span>
                                <button
                                  onClick={() => openJobLinkDialog(row)}
                                  title={row.jobNames.length > 0 ? `Jobs: ${row.jobNames.join(', ')}` : 'Link jobs to payments'}
                                  className="text-blue-600 hover:text-blue-800 p-0.5 rounded hover:bg-blue-50 transition-colors"
                                >
                                  <Link2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : column.key === 'actions' ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
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
                                    <PaymentAttachments paymentId={paymentId} />
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
              </div>{/* end overflow-x-auto */}
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
                <span className="text-sm text-gray-500 font-medium">{jobLinkDialog.projectName}</span>
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
            <div className="px-5 py-3 border-b shrink-0">
              <Input
                placeholder="Search by job name, project, or brand..."
                value={jobLinkDialog.search}
                onChange={(e) => setJobLinkDialog((prev) => ({ ...prev, search: e.target.value }))}
                className="w-full max-w-md"
              />
            </div>
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
                      <th className="px-4 py-2 text-left">Job Name</th>
                      <th className="px-4 py-2 text-left">Original Project</th>
                      <th className="px-4 py-2 text-left">Brand</th>
                      <th className="px-4 py-2 text-right">Floors</th>
                      <th className="px-4 py-2 text-right">Weight</th>
                      <th className="px-4 py-2 text-center">FF</th>
                      <th className="px-4 py-2 text-center">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDialogJobs.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No jobs match your search.</td></tr>
                    ) : (
                      filteredDialogJobs.map((job) => {
                        const checked = jobLinkDialog.linkedJobUuids.has(job.jobUuid);
                        return (
                          <tr
                            key={job.jobUuid}
                            className={`border-b hover:bg-gray-50 cursor-pointer ${checked ? 'bg-blue-50' : ''}`}
                            onClick={() => toggleJobLink(job.jobUuid)}
                          >
                            <td className="px-4 py-2">
                              <Checkbox checked={checked} onCheckedChange={() => toggleJobLink(job.jobUuid)} />
                            </td>
                            <td className="px-4 py-2 font-medium">{job.jobName}</td>
                            <td className="px-4 py-2 text-gray-600">{job.projectName || '-'}</td>
                            <td className="px-4 py-2 text-gray-600">{job.brandName || '-'}</td>
                            <td className="px-4 py-2 text-right">{job.floors ?? '-'}</td>
                            <td className="px-4 py-2 text-right">{job.weight ?? '-'}</td>
                            <td className="px-4 py-2 text-center">{job.isFf ? 'FF' : ''}</td>
                            <td className="px-4 py-2 text-center">{job.isActive ? 'Yes' : 'No'}</td>
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
     </div>
   );
 }
