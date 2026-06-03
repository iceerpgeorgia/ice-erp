'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Settings,
  Edit2,
  Eye,
  Plus,
  FileText,
  User,
  Copy,
  RefreshCw,
} from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Combobox } from '@/components/ui/combobox';
import { PaymentAttachments } from './payment-attachments';
import { ColumnFilterPopover } from './shared/column-filter-popover';
import { ClearFiltersButton } from './shared/clear-filters-button';
import { useTableFilters } from './shared/use-table-filters';
import type { ColumnFormat } from './shared/table-filters';

// ── Types ─────────────────────────────────────────────────────────────────────

type IncomeColKey =
  | 'paymentId'
  | 'financialCode'
  | 'accrual'
  | 'order'
  | 'payment'
  | 'paidPercent'
  | 'due'
  | 'latestDate';

type IncomeColumnConfig = {
  key: IncomeColKey;
  label: string;
  width: number;
  visible: boolean;
  sortable: boolean;
  filterable: boolean;
  format?: ColumnFormat;
};

type IncomePaymentRow = {
  paymentId: string;
  paymentRowId: number | null;
  financialCode: string;
  financialCodeUuid: string | null;
  parentFinancialCode: string | null;
  accrual: number;
  order: number;
  payment: number;
  paidPercent: number;
  due: number;
  latestDate: string | null;
  counteragentUuid: string | null;
  currencyUuid: string | null;
  projectUuid: string | null;
  jobUuid: string | null;
  counteragentName: string | null;
  incomeTax: boolean;
  isRecurring: boolean;
  isActive: boolean;
  label: string | null;
  confirmed: boolean;
};

// ── Column definitions ────────────────────────────────────────────────────────

const defaultIncomeColumns: IncomeColumnConfig[] = [
  { key: 'paymentId', label: 'Payment ID', width: 150, visible: true, sortable: true, filterable: false },
  { key: 'financialCode', label: 'Financial Code', width: 200, visible: true, sortable: true, filterable: true },
  { key: 'accrual', label: 'Accrual', width: 120, visible: true, sortable: true, filterable: false, format: 'currency' },
  { key: 'order', label: 'Order', width: 120, visible: true, sortable: true, filterable: false, format: 'currency' },
  { key: 'payment', label: 'Payment', width: 120, visible: true, sortable: true, filterable: false, format: 'currency' },
  { key: 'paidPercent', label: 'Paid %', width: 100, visible: true, sortable: true, filterable: false, format: 'percent' },
  { key: 'due', label: 'Due', width: 120, visible: true, sortable: true, filterable: false, format: 'currency' },
  { key: 'latestDate', label: 'Latest Date', width: 130, visible: true, sortable: true, filterable: false, format: 'date' },
];

const INCOME_STORAGE_KEY = 'handovers-income-payments-columns';
const INCOME_STORAGE_VERSION = '3';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtVal(value: any, format?: ColumnFormat, key?: string): string {
  if (value === null || value === undefined) return '-';
  if (format === 'date') {
    if (!value) return '-';
    const d = new Date(value);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  }
  if (format === 'percent') return `${Number(value).toFixed(2)}%`;
  if (format === 'currency' || format === 'number') {
    const num = Number(value);
    const display = key === 'due' ? num : Math.abs(num);
    return display.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(value);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HandoverPaymentsGrid({ projectUuid }: { projectUuid: string }) {
  // ── Data ──────────────────────────────────────────────────────────────────
  const [incomeRows, setIncomeRows] = useState<IncomePaymentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});

  // ── Column config ─────────────────────────────────────────────────────────
  const [columns, setColumns] = useState<IncomeColumnConfig[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(INCOME_STORAGE_KEY);
        const version = localStorage.getItem(`${INCOME_STORAGE_KEY}-v`);
        if (saved && version === INCOME_STORAGE_VERSION) return JSON.parse(saved);
      } catch {}
    }
    return defaultIncomeColumns;
  });

  // ── Resize ────────────────────────────────────────────────────────────────
  const [isResizing, setIsResizing] = useState<{
    column: IncomeColKey;
    startX: number;
    startWidth: number;
  } | null>(null);

  // ── Drag reorder ─────────────────────────────────────────────────────────
  const [draggedColumn, setDraggedColumn] = useState<IncomeColKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<IncomeColKey | null>(null);

  // ── Row selection ─────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleRow = (id: string) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () =>
    setSelectedIds(prev => prev.size === paginatedData.length && paginatedData.every(r => prev.has(r.paymentId))
      ? new Set() : new Set(paginatedData.map(r => r.paymentId)));

  // ── Edit payment dialog ───────────────────────────────────────────────────
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editRowId, setEditRowId] = useState<number | null>(null);
  const [editPaymentId, setEditPaymentId] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editCounteragentUuid, setEditCounteragentUuid] = useState('');
  const [editFinancialCodeUuid, setEditFinancialCodeUuid] = useState('');
  const [editCurrencyUuid, setEditCurrencyUuid] = useState('');
  const [editProjectUuid, setEditProjectUuid] = useState('');
  const [editJobUuid, setEditJobUuid] = useState('');
  const [editIncomeTax, setEditIncomeTax] = useState(false);
  const [editIsRecurring, setEditIsRecurring] = useState(false);
  const [editIsActive, setEditIsActive] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // ── Add ledger dialog ─────────────────────────────────────────────────────
  const [isAddLedgerOpen, setIsAddLedgerOpen] = useState(false);
  const [addLedgerPaymentId, setAddLedgerPaymentId] = useState('');
  const [addLedgerDate, setAddLedgerDate] = useState('');
  const [addLedgerAccrual, setAddLedgerAccrual] = useState('');
  const [addLedgerOrder, setAddLedgerOrder] = useState('');
  const [addLedgerComment, setAddLedgerComment] = useState('');
  const [addLedgerSubmitting, setAddLedgerSubmitting] = useState(false);
  const [addLedgerError, setAddLedgerError] = useState<string | null>(null);

  // ── Base info dialog ──────────────────────────────────────────────────────
  const [isBaseInfoOpen, setIsBaseInfoOpen] = useState(false);
  const [baseInfoLoading, setBaseInfoLoading] = useState(false);
  const [baseInfoError, setBaseInfoError] = useState<string | null>(null);
  const [baseInfo, setBaseInfo] = useState<any>(null);

  // ── Dictionaries (lazy loaded) ────────────────────────────────────────────
  const [counteragents, setCounteragents] = useState<any[]>([]);
  const [financialCodes, setFinancialCodes] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [editJobs, setEditJobs] = useState<any[]>([]);

  // ── Persist column config ─────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(INCOME_STORAGE_KEY, JSON.stringify(columns));
    localStorage.setItem(`${INCOME_STORAGE_KEY}-v`, INCOME_STORAGE_VERSION);
  }, [columns]);

  // ── Resize mouse events ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isResizing) {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      return;
    }
    const onMove = (e: MouseEvent) => {
      const diff = e.clientX - isResizing.startX;
      const newWidth = Math.max(60, isResizing.startWidth + diff);
      setColumns(cols =>
        cols.map(c => (c.key === isResizing.column ? { ...c, width: newWidth } : c)),
      );
    };
    const onUp = () => setIsResizing(null);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isResizing]);

  // ── Fetch income payments ─────────────────────────────────────────────────
  const fetchIncomePayments = useCallback(async (uuid: string) => {
    if (!uuid) {
      setIncomeRows([]);
      setAttachmentCounts({});
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/payments-report?projectUuid=${encodeURIComponent(uuid)}`);
      if (!res.ok) { setIncomeRows([]); return; }
      const data: any[] = await res.json();
      const incomeOnly = data.filter(r => r.financialCodeIsIncome);
      setIncomeRows(
        incomeOnly.map(r => ({
          paymentId: r.paymentId,
          paymentRowId: r.paymentRowId,
          financialCode: r.financialCode || '',
          financialCodeUuid: r.financialCodeUuid || null,
          parentFinancialCode: r.parentFinancialCode || null,
          accrual: r.accrual,
          order: r.order,
          payment: r.payment,
          paidPercent: r.paidPercent,
          due: r.due,
          latestDate: r.latestDate,
          counteragentUuid: r.counteragentUuid || null,
          currencyUuid: r.currencyUuid || null,
          projectUuid: r.projectUuid || null,
          jobUuid: r.jobUuid || null,
          counteragentName: r.counteragentName || r.counteragent || null,
          incomeTax: Boolean(r.incomeTax),
          isRecurring: Boolean(r.isRecurring),
          isActive: r.isActive ?? true,
          label: r.label || null,
          confirmed: Boolean(r.confirmed),
        })),
      );
      if (incomeOnly.length > 0) {
        const ids = incomeOnly.map((r: any) => r.paymentId).filter(Boolean);
        const countRes = await fetch('/api/payments/attachments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentIds: ids, countsOnly: true }),
        });
        if (countRes.ok) {
          const { counts } = await countRes.json();
          setAttachmentCounts(counts || {});
        }
      } else {
        setAttachmentCounts({});
      }
    } catch (e) {
      console.error('Failed to fetch income payments:', e);
      setIncomeRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncomePayments(projectUuid);
  }, [projectUuid, fetchIncomePayments]);

  // ── Lazy dictionary loaders ───────────────────────────────────────────────
  const fetchDictionaries = useCallback(async () => {
    if (financialCodes.length > 0 && currencies.length > 0) return;
    const [fcRes, currRes] = await Promise.all([
      fetch('/api/financial-codes?leafOnly=true'),
      fetch('/api/currencies'),
    ]);
    if (fcRes.ok) setFinancialCodes(await fcRes.json());
    if (currRes.ok) {
      const d = await currRes.json();
      setCurrencies(Array.isArray(d) ? d : (d.data ?? []));
    }
  }, [financialCodes.length, currencies.length]);

  const fetchCounterAgents = useCallback(async () => {
    if (counteragents.length > 0) return;
    const res = await fetch('/api/counteragents');
    if (res.ok) setCounteragents(await res.json());
  }, [counteragents.length]);

  const fetchAllProjects = useCallback(async () => {
    if (allProjects.length > 0) return;
    const res = await fetch('/api/projects-v2');
    if (res.ok) {
      const d = await res.json();
      setAllProjects(Array.isArray(d) ? d : (d.data ?? []));
    }
  }, [allProjects.length]);

  // ── Fetch jobs when editProjectUuid changes ───────────────────────────────
  useEffect(() => {
    if (!editProjectUuid) { setEditJobs([]); return; }
    fetch(`/api/jobs?projectUuid=${editProjectUuid}`)
      .then(r => (r.ok ? r.json() : []))
      .then(d => setEditJobs(Array.isArray(d) ? d : []))
      .catch(() => setEditJobs([]));
  }, [editProjectUuid]);

  // ── Column helpers ────────────────────────────────────────────────────────
  const visibleColumns = useMemo(() => columns.filter(c => c.visible), [columns]);

  const toggleColVisibility = (key: IncomeColKey) =>
    setColumns(cols => cols.map(c => (c.key === key ? { ...c, visible: !c.visible } : c)));

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, key: IncomeColKey) => {
    setDraggedColumn(key);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: React.DragEvent, key: IncomeColKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedColumn && draggedColumn !== key) setDragOverColumn(key);
  };
  const handleDragLeave = () => setDragOverColumn(null);
  const handleDrop = (e: React.DragEvent, targetKey: IncomeColKey) => {
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

  // ── Table filters ─────────────────────────────────────────────────────────
  const {
    filters,
    searchTerm,
    sortColumn,
    sortDirection,
    currentPage,
    pageSize,
    sortedData,
    paginatedData,
    totalPages,
    getColumnValues,
    setSearchTerm,
    handleSort,
    setSortColumn,
    setSortDirection,
    setCurrentPage,
    handleFilterChange,
    clearFilters,
    activeFilterCount,
  } = useTableFilters<IncomePaymentRow, IncomeColKey>({
    data: incomeRows,
    columns,
    defaultSortColumn: 'financialCode',
    defaultSortDirection: 'asc',
    filtersStorageKey: 'handovers-income-payments:filters',
  });

  // ── Action handlers ───────────────────────────────────────────────────────
  const openEditDialog = (row: IncomePaymentRow) => {
    setEditRowId(row.paymentRowId);
    setEditPaymentId(row.paymentId);
    setEditLabel(row.label || '');
    setEditCounteragentUuid(row.counteragentUuid || '');
    setEditFinancialCodeUuid(row.financialCodeUuid || '');
    setEditCurrencyUuid(row.currencyUuid || '');
    setEditProjectUuid(row.projectUuid || '');
    setEditJobUuid(row.jobUuid || '');
    setEditIncomeTax(row.incomeTax);
    setEditIsRecurring(row.isRecurring);
    setEditIsActive(row.isActive);
    setEditError(null);
    setIsEditOpen(true);
    fetchDictionaries();
    fetchCounterAgents();
    fetchAllProjects();
  };

  const handleSaveEdit = async () => {
    if (!editRowId) { setEditError('Missing payment record id.'); return; }
    if (!editCounteragentUuid || !editFinancialCodeUuid || !editCurrencyUuid) {
      setEditError('Counteragent, financial code, and currency are required.');
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/payments?id=${editRowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectUuid: editProjectUuid || null,
          counteragentUuid: editCounteragentUuid,
          financialCodeUuid: editFinancialCodeUuid,
          jobUuid: editJobUuid || null,
          incomeTax: editIncomeTax,
          currencyUuid: editCurrencyUuid,
          paymentId: editPaymentId || null,
          label: editLabel || null,
          isActive: editIsActive,
          isRecurring: editIsRecurring,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 409 && err?.code === 'PAYMENT_HAS_LEDGER_ACTIVITY') {
          alert(err.error || 'This payment cannot be set inactive because it has accrual/order entries in Payments Ledger.');
        }
        setEditError(err.error || 'Failed to update payment.');
        return;
      }
      setIsEditOpen(false);
      fetchIncomePayments(projectUuid);
    } catch {
      setEditError('Failed to update payment.');
    } finally {
      setEditSaving(false);
    }
  };

  const openAddLedger = (pmtId: string) => {
    setAddLedgerPaymentId(pmtId);
    setAddLedgerDate('');
    setAddLedgerAccrual('');
    setAddLedgerOrder('');
    setAddLedgerComment('');
    setAddLedgerError(null);
    setIsAddLedgerOpen(true);
  };

  const handleAddLedger = async () => {
    const accrual = addLedgerAccrual ? parseFloat(addLedgerAccrual) : null;
    const order = addLedgerOrder ? parseFloat(addLedgerOrder) : null;
    if ((!accrual || accrual === 0) && (!order || order === 0)) {
      setAddLedgerError('Either Accrual or Order must be provided and non-zero.');
      return;
    }
    setAddLedgerSubmitting(true);
    setAddLedgerError(null);
    try {
      const res = await fetch('/api/payments-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: addLedgerPaymentId,
          effectiveDate: addLedgerDate || undefined,
          accrual: accrual ?? undefined,
          order: order ?? undefined,
          comment: addLedgerComment || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAddLedgerError(err.error || 'Failed to create ledger entry.');
        return;
      }
      setIsAddLedgerOpen(false);
      fetchIncomePayments(projectUuid);
    } catch {
      setAddLedgerError('Failed to create ledger entry.');
    } finally {
      setAddLedgerSubmitting(false);
    }
  };

  const openBaseInfo = async (pmtId: string) => {
    setIsBaseInfoOpen(true);
    setBaseInfoLoading(true);
    setBaseInfoError(null);
    setBaseInfo(null);
    try {
      const res = await fetch(`/api/payment-statement?paymentId=${encodeURIComponent(pmtId)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load');
      }
      const result = await res.json();
      setBaseInfo(result?.payment || null);
    } catch (e: any) {
      setBaseInfoError(e.message || 'Failed to load payment info');
    } finally {
      setBaseInfoLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Section header */}
      <div>
        <h2 className="text-lg font-semibold">Income Payments</h2>
        <p className="text-sm text-muted-foreground">
          Income payment report records for this project.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search payments…"
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
                    id={`icol-${col.key}`}
                    checked={col.visible}
                    onCheckedChange={() => toggleColVisibility(col.key)}
                  />
                  <Label htmlFor={`icol-${col.key}`} className="text-sm cursor-pointer">
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
          onClick={() => fetchIncomePayments(projectUuid)}
          disabled={loading}
          title="Refresh payments"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>

        {selectedIds.size > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const records = paginatedData.filter(r => selectedIds.has(r.paymentId));
              const payload = records.map(r => ({ paymentId: r.paymentId, amount: Math.abs(r.due) }));
              navigator.clipboard.writeText(JSON.stringify(payload)).catch(() => {});
            }}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy for Batch ({selectedIds.size})
          </Button>
        )}

        <span className="text-sm text-muted-foreground ml-auto">
          {loading
            ? 'Loading…'
            : `${sortedData.length} payment${sortedData.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table style={{ tableLayout: 'fixed', width: '100%' }} className="border-collapse">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b-2 border-gray-200">
                <th className="sticky top-0 z-10 bg-white px-3 py-3 w-9 min-w-[36px]" style={{ width: 36, minWidth: 36 }}>
                  <input
                    type="checkbox"
                    className="cursor-pointer"
                    checked={paginatedData.length > 0 && paginatedData.every(r => selectedIds.has(r.paymentId))}
                    onChange={toggleAll}
                  />
                </th>
                {visibleColumns.map(column => {
                  let bgColor = '';
                  if (column.key === 'accrual') bgColor = '#ffebee';
                  if (column.key === 'payment') bgColor = '#e8f5e9';
                  if (column.key === 'order') bgColor = '#fff9e6';
                  return (
                    <th
                      key={column.key}
                      className={`relative font-semibold cursor-move overflow-hidden text-left px-4 py-3 text-sm sticky top-0 z-10 ${
                        draggedColumn === column.key ? 'opacity-50' : ''
                      } ${dragOverColumn === column.key ? 'border-l-4 border-blue-500' : ''}`}
                      style={{ width: column.width, minWidth: column.width, maxWidth: column.width, backgroundColor: bgColor || '#fff' }}
                      draggable={!isResizing}
                      onDragStart={e => handleDragStart(e, column.key)}
                      onDragOver={e => handleDragOver(e, column.key)}
                      onDragLeave={handleDragLeave}
                      onDrop={e => handleDrop(e, column.key)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="flex items-center gap-2 pr-4 overflow-hidden">
                        <span className="truncate font-medium">{column.label}</span>
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
                  );
                })}
                <th
                  className="sticky top-0 z-10 bg-white px-4 py-3 text-left text-sm font-semibold border-b-2 border-gray-200"
                  style={{ width: 190, minWidth: 190 }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={visibleColumns.length + 2} className="text-center py-8 px-4 text-gray-500">
                    Loading…
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 2} className="text-center py-8 px-4 text-gray-500">
                    {sortedData.length === 0 && !searchTerm && activeFilterCount === 0
                      ? 'No income payments for this project.'
                      : 'No payments match the current filters.'}
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => {
                  const isConfirmedPaid = Boolean(row.confirmed && row.due === 0);
                  const isConfirmedDue = Boolean(row.confirmed && row.due > 0);
                  const isSelected = selectedIds.has(row.paymentId);
                  const hasParentFC = Boolean(row.parentFinancialCode);
                  return (
                    <tr
                      key={`${row.paymentId}-${idx}`}
                      className={`border-b border-gray-200 hover:bg-gray-50 ${
                        hasParentFC ? 'italic bg-blue-50/40' : isSelected ? 'bg-blue-50' : isConfirmedPaid ? 'bg-gray-100' : isConfirmedDue ? 'bg-[#e8f5e9]' : ''
                      }`}
                    >
                      <td className="px-3 py-2" style={{ width: 36, minWidth: 36 }}>
                        <input type="checkbox" className="cursor-pointer" checked={isSelected} onChange={() => toggleRow(row.paymentId)} />
                      </td>
                      {visibleColumns.map(col => {
                        let bgColor = '';
                        if (col.key === 'accrual') bgColor = '#ffebee';
                        if (col.key === 'payment') bgColor = '#e8f5e9';
                        if (col.key === 'order') bgColor = '#fff9e6';
                        return (
                          <td
                            key={col.key}
                            className="overflow-hidden px-4 py-2 text-sm"
                            style={{
                              width: col.width,
                              minWidth: col.width,
                              maxWidth: col.width,
                              backgroundColor: bgColor || (isConfirmedPaid ? '#f3f4f6' : isConfirmedDue ? '#e8f5e9' : undefined),
                            }}
                          >
                            {col.key === 'paymentId' ? (
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="truncate">{row.paymentId}</span>
                                <button
                                  type="button"
                                  className="text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded p-1 shrink-0"
                                  title="Copy payment ID"
                                  onClick={async () => {
                                    try { await navigator.clipboard.writeText(row.paymentId); } catch {}
                                  }}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : col.key === 'financialCode' ? (
                              <div className="flex flex-col min-w-0">
                                <span className="truncate">{row.financialCode || '-'}</span>
                                {row.parentFinancialCode && (
                                  <span className="truncate text-xs text-gray-400">{row.parentFinancialCode}</span>
                                )}
                              </div>
                            ) : (
                              <span className="truncate block">
                                {fmtVal((row as any)[col.key], col.format, col.key)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-2 text-sm" style={{ width: 190, minWidth: 190 }}>
                        <div className="flex items-center gap-1">
                          <PaymentAttachments
                            paymentId={row.paymentId}
                            initialCount={attachmentCounts[row.paymentId] ?? 0}
                          />
                          <button
                            onClick={() => openBaseInfo(row.paymentId)}
                            className="inline-block text-gray-600 hover:text-gray-800 hover:bg-gray-50 p-1 rounded transition-colors"
                            title="View payment info"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditDialog(row)}
                            className="inline-block text-gray-600 hover:text-gray-800 hover:bg-gray-50 p-1 rounded transition-colors"
                            title="Edit payment"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openAddLedger(row.paymentId)}
                            className="inline-block text-green-600 hover:text-green-800 hover:bg-green-50 p-1 rounded transition-colors"
                            title="Add ledger entry"
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
                          <a
                            href={row.counteragentUuid ? `/counteragent-statement/${row.counteragentUuid}` : '#'}
                            target={row.counteragentUuid ? '_blank' : undefined}
                            rel={row.counteragentUuid ? 'noopener noreferrer' : undefined}
                            className={`inline-block p-1 rounded transition-colors ${
                              row.counteragentUuid
                                ? 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
                                : 'text-gray-400'
                            }`}
                            aria-disabled={!row.counteragentUuid}
                            title="View counteragent statement (opens in new tab)"
                            onClick={e => { if (!row.counteragentUuid) e.preventDefault(); }}
                          >
                            <User className="w-4 h-4" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="flex items-center px-2">
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
          </div>
        </div>
      )}

      {/* ── Dialogs ───────────────────────────────────────────────────────── */}

      {/* Edit Payment Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
            <DialogDescription>Update payment fields and save changes.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="col-span-2">
              <Label>Payment ID</Label>
              <Input
                value={editPaymentId}
                onChange={e => setEditPaymentId(e.target.value)}
                placeholder="Payment ID"
              />
            </div>
            <div className="col-span-2">
              <Label>Label</Label>
              <Input
                value={editLabel}
                onChange={e => setEditLabel(e.target.value)}
                placeholder="Payment label"
              />
            </div>
            <div>
              <Label>
                Counteragent <span className="text-red-500">*</span>
              </Label>
              <Combobox
                value={editCounteragentUuid}
                onValueChange={setEditCounteragentUuid}
                options={counteragents.map((ca: any) => ({
                  value: ca.counteragent_uuid || ca.counteragentUuid || '',
                  label: `${ca.counteragent || ca.name || ''}${
                    ca.identification_number || ca.identificationNumber
                      ? ` (ს.კ. ${ca.identification_number || ca.identificationNumber})`
                      : ''
                  }`,
                }))}
                placeholder="Select counteragent..."
                searchPlaceholder="Search counteragents..."
              />
            </div>
            <div>
              <Label>
                Financial Code <span className="text-red-500">*</span>
              </Label>
              <Combobox
                value={editFinancialCodeUuid}
                onValueChange={setEditFinancialCodeUuid}
                options={financialCodes.map((fc: any) => ({
                  value: fc.uuid,
                  label: fc.validation || fc.code,
                }))}
                placeholder="Select financial code..."
                searchPlaceholder="Search financial codes..."
              />
            </div>
            <div>
              <Label>
                Currency <span className="text-red-500">*</span>
              </Label>
              <Combobox
                value={editCurrencyUuid}
                onValueChange={setEditCurrencyUuid}
                options={currencies.map((c: any) => ({ value: c.uuid, label: c.code }))}
                placeholder="Select currency..."
                searchPlaceholder="Search currencies..."
              />
            </div>
            <div>
              <Label>Project (Optional)</Label>
              <Combobox
                value={editProjectUuid}
                onValueChange={setEditProjectUuid}
                options={allProjects.map((p: any) => ({
                  value: p.projectUuid || p.project_uuid || '',
                  label:
                    p.projectIndex || p.project_index || p.projectName || p.project_name || '',
                }))}
                placeholder="Select project..."
                searchPlaceholder="Search projects..."
              />
            </div>
            <div>
              <Label>Job (Optional)</Label>
              <Combobox
                value={editJobUuid}
                onValueChange={setEditJobUuid}
                options={editJobs.map((job: any) => ({
                  value: job.jobUuid,
                  label: job.jobDisplay || job.jobName || '',
                }))}
                placeholder={editProjectUuid ? 'Select job...' : 'Select project first'}
                searchPlaceholder="Search jobs..."
                disabled={!editProjectUuid}
              />
            </div>
            <div className="col-span-2 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={editIncomeTax}
                  onCheckedChange={v => setEditIncomeTax(Boolean(v))}
                  id="inc-edit-income-tax"
                />
                <Label htmlFor="inc-edit-income-tax">Income Tax</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={editIsRecurring}
                  onCheckedChange={v => setEditIsRecurring(Boolean(v))}
                  id="inc-edit-recurring"
                />
                <Label htmlFor="inc-edit-recurring">Recurring</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={editIsActive}
                  onCheckedChange={v => setEditIsActive(Boolean(v))}
                  id="inc-edit-active"
                />
                <Label htmlFor="inc-edit-active">Active</Label>
              </div>
            </div>
          </div>
          {editError && <div className="text-sm text-red-600">{editError}</div>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={editSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={editSaving}>
              {editSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Ledger Entry Dialog */}
      <Dialog
        open={isAddLedgerOpen}
        onOpenChange={open => {
          setIsAddLedgerOpen(open);
          if (!open) setAddLedgerError(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Ledger Entry</DialogTitle>
            <DialogDescription>
              Add accrual/order entry for payment{' '}
              <span className="font-mono">{addLedgerPaymentId}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Date (dd.mm.yyyy)</Label>
              <Input
                value={addLedgerDate}
                onChange={e => setAddLedgerDate(e.target.value)}
                placeholder="e.g. 07.01.2026"
              />
            </div>
            <div>
              <Label>Accrual</Label>
              <Input
                type="number"
                value={addLedgerAccrual}
                onChange={e => setAddLedgerAccrual(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Order</Label>
              <Input
                type="number"
                value={addLedgerOrder}
                onChange={e => setAddLedgerOrder(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Comment (Optional)</Label>
              <Input
                value={addLedgerComment}
                onChange={e => setAddLedgerComment(e.target.value)}
                placeholder="Comment..."
              />
            </div>
          </div>
          {addLedgerError && <div className="text-sm text-red-600">{addLedgerError}</div>}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsAddLedgerOpen(false)}
              disabled={addLedgerSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleAddLedger} disabled={addLedgerSubmitting}>
              {addLedgerSubmitting ? 'Saving...' : 'Add Entry'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Base Info Dialog */}
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
                <span className="text-gray-500 block">Project</span>
                <span className="font-medium">{baseInfo.project || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Counteragent</span>
                <span className="font-medium">{baseInfo.counteragent || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Financial Code</span>
                <span className="font-medium">{baseInfo.financialCode || '-'}</span>
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
            <div className="py-6 text-gray-500">No data found.</div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setIsBaseInfoOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
