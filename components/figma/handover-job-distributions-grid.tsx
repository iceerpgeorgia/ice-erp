'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import {
  RefreshCw,
  Loader2,
  Settings,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
} from 'lucide-react';
import { JobDistributionGrid, type JobDistributionRow } from './job-distribution-grid';
import { ColumnFilterPopover } from './shared/column-filter-popover';
import { ClearFiltersButton } from './shared/clear-filters-button';
import type { ColumnFilter, FilterState } from './shared/table-filters';
import type { ColumnFormat } from './shared/table-filters';
import { exportRowsToXlsx } from '@/lib/export-xlsx';
import {
  buildPaymentLookupMaps,
  resolvePaymentInfo,
  type PaymentLookupEntry,
} from '@/lib/handovers-job-distributions';

// ── Types ─────────────────────────────────────────────────────────────────────

type BankTxColKey =
  | 'actions'
  | 'date'
  | 'account'
  | 'caAccount'
  | 'amount'
  | 'nominalAmount'
  | 'financialCode'
  | 'nomIso'
  | 'paymentId'
  | 'batchId'
  | 'description'
  | 'id1'
  | 'id2';

type BankTxColumnConfig = {
  key: BankTxColKey;
  label: string;
  width: number;
  visible: boolean;
  sortable: boolean;
  filterable: boolean;
  format?: ColumnFormat;
};

type BankTransactionRow = {
  id: number;
  transaction_date: string | null;
  counteragent_uuid?: string | null;
  financial_code_uuid?: string | null;
  account_number: string | null;
  counteragent_account_number: string | null;
  account_currency_amount: string | number | null;
  nominal_amount: string | number | null;
  financial_code: string | null;
  nominal_currency_code: string | null;
  payment_id: string | null;
  batch_id: string | null;
  description: string | null;
  dockey: string | null;
  entriesid: string | null;
  project_uuid: string | null;
  is_balance_record?: boolean | null;
};

type PaymentMapEntry = PaymentLookupEntry;

type Props = {
  projectUuid: string;
};

// ── Column definitions ────────────────────────────────────────────────────────

const defaultBankTxColumns: BankTxColumnConfig[] = [
  { key: 'actions', label: 'Actions', width: 56, visible: true, sortable: false, filterable: false },
  { key: 'date', label: 'Date', width: 110, visible: true, sortable: true, filterable: false, format: 'date' },
  { key: 'account', label: 'Account', width: 150, visible: true, sortable: true, filterable: true },
  { key: 'caAccount', label: 'CA Account', width: 150, visible: true, sortable: true, filterable: true },
  { key: 'amount', label: 'Amount', width: 120, visible: true, sortable: true, filterable: false, format: 'currency' },
  { key: 'nominalAmount', label: 'Nominal Amount', width: 140, visible: true, sortable: true, filterable: false, format: 'currency' },
  { key: 'financialCode', label: 'Financial Code', width: 160, visible: true, sortable: true, filterable: true },
  { key: 'nomIso', label: 'Nom ISO', width: 90, visible: true, sortable: true, filterable: true },
  { key: 'paymentId', label: 'Payment ID', width: 150, visible: true, sortable: true, filterable: false },
  { key: 'batchId', label: 'Batch ID', width: 120, visible: true, sortable: true, filterable: false },
  { key: 'description', label: 'Description', width: 300, visible: true, sortable: true, filterable: false },
  { key: 'id1', label: 'ID1', width: 100, visible: true, sortable: true, filterable: false },
  { key: 'id2', label: 'ID2', width: 100, visible: true, sortable: true, filterable: false },
];

const JOB_DIST_STORAGE_KEY = 'handovers-job-distributions-columns';
const JOB_DIST_STORAGE_VERSION = '3';

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeColumns(saved: unknown): BankTxColumnConfig[] {
  const base = defaultBankTxColumns.map(col => ({ ...col }));

  if (!Array.isArray(saved)) return base;

  const savedMap = new Map(saved.map((col: any) => [col?.key, col]));
  const savedOrder = saved
    .map((col: any) => (typeof col?.key === 'string' ? col.key : null))
    .filter((key): key is BankTxColKey => key !== null);

  const normalized = base
    .map(def => {
      const candidate = savedMap.get(def.key);
      return {
        ...def,
        ...(candidate && typeof candidate === 'object' ? candidate : {}),
        label: candidate?.label || def.label || 'Actions',
        width: Number.isFinite(Number(candidate?.width)) ? Number(candidate.width) : def.width,
        visible: candidate?.visible !== false,
      };
    })
    .sort((a, b) => {
      const aIndex = savedOrder.indexOf(a.key);
      const bIndex = savedOrder.indexOf(b.key);
      const aRank = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
      const bRank = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
      return aRank - bRank;
    });

  const actionsIndex = normalized.findIndex(col => col.key === 'actions');
  if (actionsIndex === -1) {
    normalized.unshift({ ...defaultBankTxColumns[0], visible: true, width: 56 });
  } else if (actionsIndex !== 0) {
    const [actionsCol] = normalized.splice(actionsIndex, 1);
    normalized.unshift({ ...actionsCol, visible: true, width: 56 });
  } else {
    normalized[0] = { ...normalized[0], visible: true, width: 56 };
  }

  return normalized;
}

function fmtVal(value: any, format?: ColumnFormat, key?: string): string {
  if (value === null || value === undefined) return '-';
  if (format === 'date') {
    if (!value) return '-';
    const d = new Date(value);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  }
  if (format === 'currency' || format === 'number') {
    const num = Number(value);
    const display = Math.abs(num);
    return display.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(value);
}

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateString)) {
    const [year, month, day] = dateString.split('T')[0].split('-');
    return `${day}.${month}.${year}`;
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return String(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};


const exportKeyMap: Record<BankTxColKey, string> = {
  actions: 'actions',
  date: 'date',
  account: 'account',
  caAccount: 'caAccount',
  amount: 'amount',
  nominalAmount: 'nominalAmount',
  financialCode: 'financialCode',
  nomIso: 'nomIso',
  paymentId: 'paymentId',
  batchId: 'batchId',
  description: 'description',
  id1: 'id1',
  id2: 'id2',
};

function buildDistributionExportRows(
  rows: BankTransactionRow[],
  paymentMap: Map<string, PaymentMapEntry>,
  paymentIdMap: Map<string, PaymentMapEntry[]>,
  distributionMap: Map<string, JobDistributionRow[]>,
) {
  const exportRows: Record<string, any>[] = [];

  rows.forEach((row) => {
    const paymentInfo = resolvePaymentInfo(row, paymentMap, paymentIdMap);
    const paymentUuid = paymentInfo?.paymentUuid ?? null;
    const distributions = paymentUuid ? (distributionMap.get(paymentUuid) ?? []) : [];
    const accountAmount = Number(row.account_currency_amount ?? 0);
    const nominalAmount = Number(row.nominal_amount ?? 0);
    const hasRowRate = Number.isFinite(accountAmount)
      && Number.isFinite(nominalAmount)
      && nominalAmount !== 0;
    const rowRate = hasRowRate ? accountAmount / nominalAmount : null;
    const shouldRecalcAccount = rowRate !== null && Number.isFinite(rowRate) && Math.abs(rowRate - 1) > 0.01;

    if (distributions.length === 0) {
      exportRows.push({
        date: row.transaction_date ?? '',
        account: row.account_number ?? '',
        caAccount: row.counteragent_account_number ?? '',
        amount: row.account_currency_amount ?? '',
        nominalAmount: row.nominal_amount ?? '',
        financialCode: row.financial_code ?? '',
        nomIso: row.nominal_currency_code ?? '',
        paymentId: row.payment_id ?? '',
        batchId: row.batch_id ?? '',
        description: row.description ?? '',
        id1: row.dockey ?? '',
        id2: row.entriesid ?? '',
        jobName: '',
        factoryNo: '',
        sellingPrice: '',
        allocationPercent: '',
        distributedAmount: '',
        distributedAmountAccountCurr: '',
      });
      return;
    }

    distributions.forEach((dist) => {
      const distributedAmount = dist.amount != null ? Number(dist.amount) : null;
      const distributedAmountAccountCurrRaw = dist.amountAccountCurr != null ? Number(dist.amountAccountCurr) : null;
      const distributedAmountAccountCurr = shouldRecalcAccount
        && distributedAmount != null
        && (distributedAmountAccountCurrRaw == null
          || Math.abs(distributedAmountAccountCurrRaw - distributedAmount) < 0.01)
        ? distributedAmount * rowRate!
        : distributedAmountAccountCurrRaw;

      exportRows.push({
        date: row.transaction_date ?? '',
        account: row.account_number ?? '',
        caAccount: row.counteragent_account_number ?? '',
        amount: row.account_currency_amount ?? '',
        nominalAmount: row.nominal_amount ?? '',
        financialCode: row.financial_code ?? '',
        nomIso: row.nominal_currency_code ?? '',
        paymentId: row.payment_id ?? '',
        batchId: row.batch_id ?? '',
        description: row.description ?? '',
        id1: row.dockey ?? '',
        id2: row.entriesid ?? '',
        jobName: dist.jobName ?? '',
        factoryNo: dist.factoryNo ?? '',
        sellingPrice: dist.sellingPrice ?? '',
        allocationPercent: dist.percentage ?? '',
        distributedAmount,
        distributedAmountAccountCurr,
      });
    });
  });

  return exportRows;
}

export function HandoverJobDistributionsGrid({ projectUuid }: Props) {
  // ── Data ──────────────────────────────────────────────────────────────────
  const [transactions, setTransactions] = useState<BankTransactionRow[]>([]);
  const [paymentMap, setPaymentMap] = useState<Map<string, PaymentMapEntry>>(new Map());
  const [paymentIdMap, setPaymentIdMap] = useState<Map<string, PaymentMapEntry[]>>(new Map());
  const [distributionMap, setDistributionMap] = useState<Map<string, JobDistributionRow[]>>(new Map());
  const [loading, setLoading] = useState(false);

  // ── Column config ─────────────────────────────────────────────────────────
  const [columns, setColumns] = useState<BankTxColumnConfig[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(JOB_DIST_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            return normalizeColumns(parsed);
          }
        }
      } catch {}
    }
    return normalizeColumns(null);
  });

  // ── Search & filters ──────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<FilterState>(new Map());

  const handleFilterChange = (columnKey: string, filter: ColumnFilter | null) => {
    setFilters(prev => {
      const next = new Map(prev);
      if (filter === null) {
        next.delete(columnKey);
      } else {
        next.set(columnKey, filter);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setFilters(new Map());
  };

  const activeFilterCount = filters.size;

  // ── Sorting ───────────────────────────────────────────────────────────────
  const [sortColumn, setSortColumn] = useState<BankTxColKey | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // ── Resize ────────────────────────────────────────────────────────────────
  const [isResizing, setIsResizing] = useState<{
    column: BankTxColKey;
    startX: number;
    startWidth: number;
  } | null>(null);

  // ── Drag reorder ─────────────────────────────────────────────────────────
  const [draggedColumn, setDraggedColumn] = useState<BankTxColKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<BankTxColKey | null>(null);

  const fetchData = useCallback(async () => {
    if (!projectUuid) {
      setTransactions([]);
      setPaymentMap(new Map());
      setDistributionMap(new Map());
      return;
    }

    setLoading(true);
    try {
      const [txRes, paymentsRes, distRes] = await Promise.all([
        fetch(`/api/bank-transactions?project_uuid=${encodeURIComponent(projectUuid)}&limit=0`),
        fetch(`/api/payments-report?projectUuid=${encodeURIComponent(projectUuid)}`),
        fetch(`/api/payments-jobs?project_uuid=${encodeURIComponent(projectUuid)}`),
      ]);

      const txPayload = txRes.ok ? await txRes.json() : null;
      const txRows = Array.isArray(txPayload)
        ? txPayload
        : Array.isArray(txPayload?.data)
          ? txPayload.data
          : [];

      const incomePaymentIds = new Set<string>();
      let nextPaymentMap = new Map<string, PaymentMapEntry>();
      let nextPaymentIdMap = new Map<string, PaymentMapEntry[]>();
      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        const incomePayments = paymentsData.filter((payment: any) => payment.financialCodeIsIncome);
        console.log('[Job Dist] Income payments count:', incomePayments.length);

        const lookupData = buildPaymentLookupMaps(incomePayments);
        nextPaymentMap = lookupData.paymentMap;
        nextPaymentIdMap = lookupData.paymentIdMap;

        incomePayments.forEach((payment: any) => {
          if (payment.paymentId) {
            incomePaymentIds.add(payment.paymentId);
          }
        });
      }
      setPaymentMap(nextPaymentMap);
      setPaymentIdMap(nextPaymentIdMap);

      const filteredRows = txRows.filter((row: any) =>
        row.project_uuid === projectUuid &&
        !row.is_balance_record &&
        row.payment_id &&
        incomePaymentIds.has(row.payment_id)
      );
      setTransactions(filteredRows);

      const nextDistributionMap = new Map<string, JobDistributionRow[]>();
      if (distRes.ok) {
        const distData = await distRes.json();
        console.log('[Job Dist] Loaded distributions:', distData.length);
        distData.forEach((dist: any) => {
          if (!dist.payment_uuid) return;
          const row: JobDistributionRow = {
            jobUuid: dist.job_uuid,
            jobName: dist.job_name,
            factoryNo: dist.factory_no,
            sellingPrice: dist.selling_price,
            percentage: dist.allocation_percent != null ? Number(dist.allocation_percent).toFixed(2) : '',
            amount: dist.amount != null ? Number(dist.amount).toFixed(2) : '',
            amountAccountCurr: dist.amount_account_curr != null ? Number(dist.amount_account_curr).toFixed(2) : '',
          };
          const current = nextDistributionMap.get(dist.payment_uuid) || [];
          current.push(row);
          nextDistributionMap.set(dist.payment_uuid, current);
          console.log('[Job Dist] Distribution for payment_uuid:', {
            payment_uuid: dist.payment_uuid,
            payment_id: dist.payment_id,
            job_name: dist.job_name,
            amount: dist.amount,
          });
        });
      }
      console.log('[Job Dist] Distribution map keys:', Array.from(nextDistributionMap.keys()));
      setDistributionMap(nextDistributionMap);
    } catch (error) {
      console.error('Failed to fetch bank transactions:', error);
      setTransactions([]);
      setPaymentMap(new Map());
      setDistributionMap(new Map());
    } finally {
      setLoading(false);
    }
  }, [projectUuid]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Persist columns to localStorage ───────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const normalizedColumns = normalizeColumns(columns);
      localStorage.setItem(JOB_DIST_STORAGE_KEY, JSON.stringify(normalizedColumns));
      localStorage.setItem(`${JOB_DIST_STORAGE_KEY}-v`, JOB_DIST_STORAGE_VERSION);
    }
  }, [columns]);

  // ── Resize mouse handlers ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - isResizing.startX;
      const newWidth = Math.max(50, isResizing.startWidth + delta);
      setColumns(cols =>
        cols.map(c => (c.key === isResizing.column ? { ...c, width: newWidth } : c))
      );
    };

    const handleMouseUp = () => setIsResizing(null);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // ── Column helpers ────────────────────────────────────────────────────────
  const visibleColumns = useMemo(() => columns.filter(c => c.visible), [columns]);

  const toggleColVisibility = (key: BankTxColKey) =>
    setColumns(cols => cols.map(c => (c.key === key ? { ...c, visible: !c.visible } : c)));

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, key: BankTxColKey) => {
    setDraggedColumn(key);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: React.DragEvent, key: BankTxColKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedColumn && draggedColumn !== key) setDragOverColumn(key);
  };
  const handleDragLeave = () => setDragOverColumn(null);
  const handleDrop = (e: React.DragEvent, targetKey: BankTxColKey) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetKey) {
      setDraggedColumn(null);
      setDragOverColumn(null);
      return;
    }
    const from = columns.findIndex(c => c.key === draggedColumn);
    const to = columns.findIndex(c => c.key === targetKey);
    if (from === -1 || to === -1) return;
    const next = [...columns];
    const [removed] = next.splice(from, 1);
    next.splice(to, 0, removed);
    setColumns(next);
    setDraggedColumn(null);
    setDragOverColumn(null);
  };
  const handleDragEnd = () => {
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  // ── Sorting ───────────────────────────────────────────────────────────────
  const handleSort = (key: BankTxColKey) => {
    if (sortColumn === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(key);
      setSortDirection('asc');
    }
  };

  // ── Get column values for filtering ───────────────────────────────────────
  const getColumnValues = (key: BankTxColKey): string[] => {
    const valueSet = new Set<string>();
    transactions.forEach(row => {
      const val = getRowValue(row, key);
      if (val !== null && val !== undefined && val !== '') {
        valueSet.add(String(val));
      }
    });
    return Array.from(valueSet).sort();
  };

  // ── Get row value by column key ───────────────────────────────────────────
  const getRowValue = (row: BankTransactionRow, key: BankTxColKey): any => {
    switch (key) {
      case 'actions': return null;
      case 'date': return row.transaction_date;
      case 'account': return row.account_number;
      case 'caAccount': return row.counteragent_account_number;
      case 'amount': return row.account_currency_amount;
      case 'nominalAmount': return row.nominal_amount;
      case 'financialCode': return row.financial_code;
      case 'nomIso': return row.nominal_currency_code;
      case 'paymentId': return row.payment_id;
      case 'batchId': return row.batch_id;
      case 'description': return row.description;
      case 'id1': return row.dockey;
      case 'id2': return row.entriesid;
      default: return null;
    }
  };

  // ── Search filtering ──────────────────────────────────────────────────────
  const searchFilteredData = useMemo(() => {
    if (!searchTerm.trim()) return transactions;
    const lower = searchTerm.toLowerCase();
    return transactions.filter(row =>
      Object.values(row).some(val =>
        val != null && String(val).toLowerCase().includes(lower)
      )
    );
  }, [transactions, searchTerm]);

  // ── Column filtering ──────────────────────────────────────────────────────
  const filteredData = useMemo(() => {
    if (filters.size === 0) return searchFilteredData;
    return searchFilteredData.filter(row =>
      Array.from(filters.entries()).every(([col, filter]) => {
        const value = getRowValue(row, col as BankTxColKey);
        if (filter.mode === 'facet') {
          return filter.values.has(String(value));
        }
        // Advanced filters (range, etc.) could be added here
        return true;
      })
    );
  }, [searchFilteredData, filters]);

  // ── Sorting ───────────────────────────────────────────────────────────────
  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData;
    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      const aVal = getRowValue(a, sortColumn);
      const bVal = getRowValue(b, sortColumn);
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [filteredData, sortColumn, sortDirection]);

  const totals = useMemo(() => {
    return {
      amount: sortedData.reduce((sum, row) => sum + Number(row.account_currency_amount ?? 0), 0),
      nominalAmount: sortedData.reduce((sum, row) => sum + Number(row.nominal_amount ?? 0), 0),
    };
  }, [sortedData]);

  const handleExportXlsx = useCallback(() => {
    if (!sortedData.length) return;

    const exportColumns = visibleColumns
      .filter(column => column.key !== 'actions')
      .map(column => ({
        key: exportKeyMap[column.key],
        label: column.label,
        visible: true,
        format: column.format,
      }));

    const exportRows = buildDistributionExportRows(sortedData, paymentMap, paymentIdMap, distributionMap);

    exportRowsToXlsx({
      rows: exportRows,
      columns: [
        ...exportColumns,
        { key: 'jobName', label: 'Job Name', visible: true },
        { key: 'factoryNo', label: 'Factory No', visible: true },
        { key: 'sellingPrice', label: 'Selling Price', visible: true, format: 'currency' },
        { key: 'allocationPercent', label: 'Allocation %', visible: true, format: 'percent' },
        { key: 'distributedAmount', label: 'Distributed Amount', visible: true, format: 'currency' },
        { key: 'distributedAmountAccountCurr', label: 'Distributed Amount (Account Curr)', visible: true, format: 'currency' },
      ],
      fileName: `job-distributions-${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: 'Job Distributions',
    });
  }, [distributionMap, paymentIdMap, paymentMap, sortedData, visibleColumns]);

  if (!projectUuid) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center text-muted-foreground">
        Select a project to view job distributions
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="text-lg font-semibold mr-auto">Job Distributions</h3>

        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <ClearFiltersButton
          activeCount={activeFilterCount + (searchTerm.trim() ? 1 : 0)}
          onClear={() => {
            clearFilters();
            setSearchTerm('');
          }}
        />

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Columns
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Toggle Columns</h4>
              {columns.map(col => (
                <div key={col.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={`jdcol-${col.key}`}
                    checked={col.visible}
                    onCheckedChange={() => toggleColVisibility(col.key)}
                  />
                  <Label htmlFor={`jdcol-${col.key}`} className="text-sm cursor-pointer">
                    {col.label}
                  </Label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExportXlsx}
          disabled={loading || sortedData.length === 0}
          title="Export job distributions to XLSX"
        >
          <Download className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
          title="Refresh transactions"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>

        <span className="text-sm text-muted-foreground">
          {loading
            ? 'Loading…'
            : `${sortedData.length} transaction${sortedData.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center items-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : sortedData.length === 0 ? (
        <div className="rounded-lg border bg-white p-6 text-center text-muted-foreground">
          No matching bank transactions for this project.
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table style={{ tableLayout: 'fixed', width: '100%' }} className="border-collapse">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b-2 border-gray-200">
                  {visibleColumns.map(column => (
                    <th
                      key={column.key}
                      className={`font-semibold cursor-move overflow-hidden text-left px-4 py-3 text-sm sticky top-0 z-10 bg-gray-50 ${
                        draggedColumn === column.key ? 'opacity-50' : ''
                      } ${dragOverColumn === column.key ? 'border-l-4 border-blue-500' : ''}`}
                      style={{ width: column.width, minWidth: column.width, maxWidth: column.width, position: 'relative' }}
                      draggable={!isResizing}
                      onDragStart={e => handleDragStart(e, column.key)}
                      onDragOver={e => handleDragOver(e, column.key)}
                      onDragLeave={handleDragLeave}
                      onDrop={e => handleDrop(e, column.key)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="flex items-center gap-2 pr-4 overflow-hidden">
                        <span className="truncate font-medium">{column.label || defaultBankTxColumns.find(c => c.key === column.key)?.label || 'Actions'}</span>
                        {column.sortable && (
                          <button
                            onClick={() => handleSort(column.key)}
                            className="hover:bg-gray-100 rounded p-0.5 shrink-0"
                          >
                            {sortColumn === column.key ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="h-3 w-3" />
                              ) : (
                                <ArrowDown className="h-3 w-3" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 text-gray-400" />
                            )}
                          </button>
                        )}
                        {column.filterable && (
                          <ColumnFilterPopover
                            columnKey={column.key}
                            columnLabel={column.label}
                            values={getColumnValues(column.key)}
                            activeFilters={
                              filters.get(column.key)?.mode === 'facet'
                                ? (filters.get(column.key) as any).values
                                : new Set<string>()
                            }
                            activeFilter={filters.get(column.key)}
                            columnFormat={column.format as ColumnFormat | undefined}
                            onAdvancedFilterChange={f => handleFilterChange(column.key, f)}
                            onFilterChange={vals =>
                              handleFilterChange(
                                column.key,
                                vals.size > 0 ? { mode: 'facet', values: vals } : null,
                              )
                            }
                            onSort={dir => {
                              setSortColumn(column.key);
                              setSortDirection(dir);
                            }}
                          />
                        )}
                      </div>
                      {/* Resize handle */}
                      <div
                        className="absolute top-0 right-0 bottom-0 w-5 cursor-col-resize hover:bg-blue-500/20 z-50"
                        style={{ marginRight: '-10px' }}
                        draggable={false}
                        onMouseDown={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsResizing({ column: column.key, startX: e.clientX, startWidth: column.width });
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="absolute right-2 top-0 bottom-0 w-1 bg-gray-300 hover:bg-blue-500 transition-colors" />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedData.map((row, idx) => {
                const paymentInfo = resolvePaymentInfo(row, paymentMap, paymentIdMap);
                const paymentUuid = paymentInfo?.paymentUuid ?? null;
                const distributionValue = paymentUuid ? (distributionMap.get(paymentUuid) ?? []) : [];

                if (idx < 5) { // Only log first 5 rows to avoid spam
                  console.log('[Job Dist] Row payment lookup:', {
                    rowId: row.id,
                    payment_id: row.payment_id,
                    financial_code: row.financial_code,
                    resolved_payment_uuid: paymentUuid,
                    has_distributions: distributionValue.length > 0,
                    distribution_count: distributionValue.length,
                  });
                }

                const nominalAmount = Number(row.nominal_amount ?? 0);
                const accountAmount = Number(row.account_currency_amount ?? 0);
                const hasNominal = Number.isFinite(nominalAmount) && nominalAmount !== 0;
                const paymentAmount = hasNominal
                  ? nominalAmount
                  : (Number.isFinite(accountAmount) ? accountAmount : 0);
                const rawRate = hasNominal && Number.isFinite(accountAmount)
                  ? accountAmount / nominalAmount
                  : 1;
                const accountCurrencyRate = Number.isFinite(rawRate) && rawRate !== 0 ? rawRate : 1;
                const paymentCurrencyCode = row.nominal_currency_code || paymentInfo?.currencyCode || 'GEL';

                return (
                  <tr key={row.id} className="hover:bg-gray-50">
                    {visibleColumns.map(column => {
                      const value = getRowValue(row, column.key);
                      const formatted = fmtVal(value, column.format, column.key);

                      if (column.key === 'actions') {
                        return (
                          <td key={column.key} className="px-4 py-2 text-sm" style={{ width: column.width }}>
                            {paymentUuid && row.payment_id ? (
                              <JobDistributionGrid
                                paymentUuid={paymentUuid}
                                paymentId={row.payment_id}
                                paymentAmount={paymentAmount}
                                paymentCurrencyCode={paymentCurrencyCode}
                                accountCurrencyRate={accountCurrencyRate}
                                projectUuid={projectUuid}
                                value={distributionValue}
                                onChange={() => {}}
                                onSave={fetchData}
                              />
                            ) : null}
                          </td>
                        );
                      }

                      if (column.key === 'paymentId') {
                        return (
                          <td key={column.key} className="px-4 py-2 text-sm" style={{ width: column.width }}>
                            {row.payment_id || ''}
                          </td>
                        );
                      }

                      // Number columns: right-aligned
                      if (column.key === 'amount' || column.key === 'nominalAmount') {
                        return (
                          <td key={column.key} className="px-4 py-2 text-sm text-right" style={{ width: column.width }}>
                            {formatted}
                          </td>
                        );
                      }

                      // Description: truncate
                      if (column.key === 'description') {
                        return (
                          <td key={column.key} className="px-4 py-2 text-sm truncate" style={{ width: column.width }} title={String(value || '')}>
                            {formatted}
                          </td>
                        );
                      }

                      // Default: left-aligned
                      return (
                        <td key={column.key} className="px-4 py-2 text-sm" style={{ width: column.width }}>
                          {formatted}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold text-sm">
                <tr className="border-t border-gray-200">
                  {visibleColumns.map((column, index) => {
                    if (index === 0) {
                      return (
                        <td key="totals-label" className="px-4 py-3 text-sm font-semibold" style={{ width: column.width }}>
                          Total
                        </td>
                      );
                    }

                    if (column.key === 'amount') {
                      return (
                        <td key="totals-amount" className="px-4 py-3 text-sm text-right tabular-nums" style={{ width: column.width }}>
                          {fmtVal(totals.amount, column.format, column.key)}
                        </td>
                      );
                    }

                    if (column.key === 'nominalAmount') {
                      return (
                        <td key="totals-nominal" className="px-4 py-3 text-sm text-right tabular-nums" style={{ width: column.width }}>
                          {fmtVal(totals.nominalAmount, column.format, column.key)}
                        </td>
                      );
                    }

                    return (
                      <td key={`totals-${column.key}`} className="px-4 py-3 text-sm" style={{ width: column.width }} />
                    );
                  })}
                </tr>
              </tfoot>
            </table>
        </div>
      </div>
    )}
    </div>
  );
}
