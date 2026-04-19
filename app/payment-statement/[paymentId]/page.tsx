'use client';
/* eslint-disable react-hooks/exhaustive-deps */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Edit2, Plus, X, Eye, Info } from 'lucide-react';
import { ColumnFilterPopover } from '@/components/figma/shared/column-filter-popover';
import { ClearFiltersButton } from '@/components/figma/shared/clear-filters-button';
import type { FilterState, ColumnFilter, ColumnFormat } from '@/components/figma/shared/table-filters';
import { matchesFilter, buildFacetBaseData, buildUniqueValuesCache } from '@/components/figma/shared/table-filters';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { BankTransactionsTable } from '@/components/figma/bank-transactions-table';
import * as XLSX from 'xlsx';

const formatDate = (date: string | Date): string => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
};

const toIsoDateFromDisplay = (value: string): string => {
  if (!value) return '';
  if (value.includes('.')) {
    const [day, month, year] = value.split('.');
    if (year && month && day) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().split('T')[0];
};

const toValidDate = (val: any): Date | null => {
  if (!val) return null;
  if (val instanceof Date) return val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const toISO = (d: Date | null): string => {
  return d ? d.toISOString() : '';
};

type TransactionRow = {
  id: string;
  ledgerId?: number; // Add ledger ID for editing
  bankUuid?: string;
  bankId?: number;
  adjustmentId?: number;
  type: 'ledger' | 'bank' | 'adjustment';
  date: string;
  accrual: number;
  payment: number;
  order: number;
  ppc: number;
  paidPercent: number;
  due: number;
  balance: number;
  confirmed?: boolean | null;
  comment: string;
  user: string;
  caAccount: string;
  account: string;
  createdAt: string;
  id1?: string | null;
  id2?: string | null;
  batchId?: string | null;
};

type ColumnConfig = {
  key: keyof TransactionRow;
  label: string;
  visible: boolean;
  filterable?: boolean;
  sortable?: boolean;
  width: number;
  align?: 'left' | 'right';
  format?: ColumnFormat;
};

const defaultColumns: ColumnConfig[] = [
  { key: 'date', label: 'Date', visible: true, filterable: true, sortable: true, width: 120, align: 'left', format: 'date' },
  { key: 'accrual', label: 'Accrual', visible: true, filterable: true, sortable: true, width: 120, align: 'right', format: 'currency' },
  { key: 'payment', label: 'Payment', visible: true, filterable: true, sortable: true, width: 120, align: 'right', format: 'currency' },
  { key: 'order', label: 'Order', visible: true, filterable: true, sortable: true, width: 120, align: 'right', format: 'currency' },
  { key: 'confirmed', label: 'Confirmed', visible: true, filterable: true, sortable: true, width: 120, align: 'left', format: 'boolean' },
  { key: 'ppc', label: 'PPC', visible: true, filterable: true, sortable: true, width: 120, align: 'right', format: 'currency' },
  { key: 'paidPercent', label: 'Paid %', visible: true, filterable: true, sortable: true, width: 100, align: 'right', format: 'percent' },
  { key: 'due', label: 'Due', visible: true, filterable: true, sortable: true, width: 120, align: 'right', format: 'currency' },
  { key: 'balance', label: 'Balance', visible: true, filterable: true, sortable: true, width: 120, align: 'right', format: 'currency' },
  { key: 'comment', label: 'Comment', visible: true, filterable: true, sortable: true, width: 300, align: 'left', format: 'text' },
  { key: 'user', label: 'User', visible: true, filterable: true, sortable: true, width: 180, align: 'left' },
  { key: 'caAccount', label: 'CA Account', visible: true, filterable: true, sortable: true, width: 180, align: 'left' },
  { key: 'account', label: 'Account', visible: true, filterable: true, sortable: true, width: 200, align: 'left' },
  { key: 'batchId', label: 'Batch ID', visible: false, filterable: true, sortable: true, width: 160, align: 'left' },
  { key: 'id1', label: 'ID1', visible: false, filterable: true, sortable: true, width: 140, align: 'left' },
  { key: 'id2', label: 'ID2', visible: false, filterable: true, sortable: true, width: 140, align: 'left' },
  { key: 'createdAt', label: 'Created At', visible: true, filterable: true, sortable: true, width: 180, align: 'left', format: 'date' },
];

export default function PaymentStatementPage() {
  const BANK_AUDIT_TABLE = "GE78BG0000000893486000_BOG_GEL";
  const params = useParams();
  const paymentId = params.paymentId as string;
  const [statementData, setStatementData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);
  const [isResizing, setIsResizing] = useState<{ column: keyof TransactionRow; startX: number; startWidth: number; element: HTMLElement } | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<keyof TransactionRow | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<keyof TransactionRow | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [filters, setFilters] = useState<FilterState>(new Map());
  const [sortColumn, setSortColumn] = useState<keyof TransactionRow | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Edit dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<{
    id: number;
    paymentId: string;
    date: string;
    accrual: number;
    order: number;
    comment: string;
  } | null>(null);
  const [newPaymentId, setNewPaymentId] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newAccrual, setNewAccrual] = useState('');
  const [newOrder, setNewOrder] = useState('');
  const [newComment, setNewComment] = useState('');
  const [allPayments, setAllPayments] = useState<Array<{ 
    paymentId: string; 
    counteragent: string; 
    project: string; 
    job: string;
    financialCode: string;
    currency: string;
    incomeTax: boolean;
  }>>([]);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<{
    counteragent: string;
    project: string;
    job: string;
    financialCode: string;
    currency: string;
    incomeTax: boolean;
  } | null>(null);
  const [isBankRecordDialogOpen, setIsBankRecordDialogOpen] = useState(false);
  const [viewingBankRecord, setViewingBankRecord] = useState<any>(null);
  const [loadingBankRecord, setLoadingBankRecord] = useState(false);
  const [isBankLockUpdating, setIsBankLockUpdating] = useState(false);
  const [isLedgerRecordDialogOpen, setIsLedgerRecordDialogOpen] = useState(false);
  const [viewingLedgerRecord, setViewingLedgerRecord] = useState<any>(null);
  const [loadingLedgerRecord, setLoadingLedgerRecord] = useState(false);
  const [isAuditDialogOpen, setIsAuditDialogOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditTitle, setAuditTitle] = useState('');
  const [isBankEditDialogOpen, setIsBankEditDialogOpen] = useState(false);
  const [bankEditData, setBankEditData] = useState<any[]>([]);
  const [bankEditId, setBankEditId] = useState<number | null>(null);
  const [bankEditLoading, setBankEditLoading] = useState(false);
  const [pageTitleSet, setPageTitleSet] = useState(false);

  // Add Ledger dialog state (locked to current payment)
  const [isAddLedgerDialogOpen, setIsAddLedgerDialogOpen] = useState(false);
  const [addEffectiveDate, setAddEffectiveDate] = useState('');
  const [addAccrual, setAddAccrual] = useState('');
  const [addOrder, setAddOrder] = useState('');
  const [addComment, setAddComment] = useState('');
  const [isAddingLedger, setIsAddingLedger] = useState(false);
  const [selectedAccrualIds, setSelectedAccrualIds] = useState<Set<string>>(new Set());
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isAoSubmitting, setIsAoSubmitting] = useState(false);

  // Adjustment dialog state (shared for add & edit)
  const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState(false);
  const [editingAdjustmentId, setEditingAdjustmentId] = useState<number | null>(null);
  const [adjEffectiveDate, setAdjEffectiveDate] = useState('');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjComment, setAdjComment] = useState('');
  const [adjFaceCurrency, setAdjFaceCurrency] = useState('');
  const [adjFaceAmount, setAdjFaceAmount] = useState('');
  const [adjManualRate, setAdjManualRate] = useState('');
  const [isSavingAdjustment, setIsSavingAdjustment] = useState(false);
  const [adjNominalPreview, setAdjNominalPreview] = useState<{ nominalAmount: number; nominalCurrency: string; rate: number; rateSource?: string } | null>(null);

  // Live preview of nominal amount when face currency inputs change
  useEffect(() => {
    if (!isAdjustmentDialogOpen) return;
    const pid = statementData?.payment?.paymentId;
    if (!pid || !adjFaceCurrency || !adjFaceAmount || parseFloat(adjFaceAmount) === 0) {
      setAdjNominalPreview(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          paymentId: pid,
          faceCurrency: adjFaceCurrency,
          faceAmount: adjFaceAmount,
          date: adjEffectiveDate || new Date().toISOString().split('T')[0],
        });
        if (adjManualRate && parseFloat(adjManualRate) !== 0) {
          params.set('manualRate', adjManualRate);
        }
        const res = await fetch(`/api/adjustments/preview-nominal?${params}`, { signal: controller.signal });
        if (res.ok) {
          setAdjNominalPreview(await res.json());
        } else {
          setAdjNominalPreview(null);
        }
      } catch {
        if (!controller.signal.aborted) setAdjNominalPreview(null);
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [isAdjustmentDialogOpen, adjFaceCurrency, adjFaceAmount, adjManualRate, adjEffectiveDate, statementData?.payment?.paymentId]);

  useEffect(() => {
    if (pageTitleSet || !statementData?.payment) return;
    const counteragent = statementData.payment.counteragent || '';
    const jobName = statementData.payment.job || '';
    const title = jobName ? `${jobName} | ${counteragent}` : counteragent;
    if (title) {
      document.title = title;
      setPageTitleSet(true);
    }
  }, [pageTitleSet, statementData]);

  // BroadcastChannel for cross-tab updates
  const [broadcastChannel] = useState(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      return new BroadcastChannel('payments-ledger-updates');
    }
    return null;
  });

  // Load saved column configuration from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedColumns = localStorage.getItem('paymentStatementColumns');
      if (savedColumns) {
        try {
          const parsed = JSON.parse(savedColumns);
          
          // Validate saved columns structure
          const validSavedColumns = parsed.filter((col: any) => 
            col.key && col.label && typeof col.width === 'number' && typeof col.visible === 'boolean'
          );
          
          // Merge saved columns with defaults to handle new columns
          const updatedSavedColumns = validSavedColumns.map((savedCol: any) => {
            const defaultCol = defaultColumns.find(col => col.key === savedCol.key);
            return defaultCol ? { ...defaultCol, ...savedCol } : savedCol;
          });
          
          // Find new columns that don't exist in saved columns
          const savedKeys = new Set(validSavedColumns.map((col: any) => col.key));
          const newColumns = defaultColumns.filter(col => !savedKeys.has(col.key));
          
          setColumns([...updatedSavedColumns, ...newColumns]);
        } catch (e) {
          console.error('Failed to parse saved columns:', e);
          setColumns(defaultColumns);
        }
      }
    }
    setIsInitialized(true);
  }, []);

  // Save column configuration to localStorage whenever it changes
  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
      localStorage.setItem('paymentStatementColumns', JSON.stringify(columns));
    }
  }, [columns, isInitialized]);

  useEffect(() => {
    const fetchStatement = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/payment-statement?paymentId=${paymentId}`);
        if (!response.ok) throw new Error('Failed to fetch statement');
        const result = await response.json();
        setStatementData(result);
      } catch (err: any) {
        setError(err.message || 'Failed to load statement');
      } finally {
        setLoading(false);
      }
    };

    if (paymentId) {
      fetchStatement();
    }
  }, [paymentId]);

  useEffect(() => {
    setSelectedAccrualIds(new Set());
    setSelectedOrderIds(new Set());
  }, [paymentId]);

  // Fetch all payments for the payment ID dropdown
  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const response = await fetch('/api/payments?limit=5000');
        if (!response.ok) throw new Error('Failed to fetch payments');
        const data = await response.json();
        setAllPayments(data.map((p: any) => ({
          paymentId: p.paymentId,
          counteragent: p.counteragentName || 'N/A',
          project: p.projectIndex || 'N/A',
          job: p.jobName || 'N/A',
          financialCode: p.financialCode || 'N/A',
          currency: p.currencyCode || 'N/A',
          incomeTax: p.incomeTax || false
        })));
      } catch (error) {
        console.error('Error fetching payments:', error);
      }
    };
    fetchPayments();
  }, []);

  // Column resize handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const deltaX = e.clientX - isResizing.startX;
        const newWidth = Math.max(50, isResizing.startWidth + deltaX);
        
        isResizing.element.style.width = `${newWidth}px`;
        isResizing.element.style.minWidth = `${newWidth}px`;
        isResizing.element.style.maxWidth = `${newWidth}px`;
      }
    };

    const handleMouseUp = () => {
      if (isResizing) {
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

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  const handleResizeStart = (e: React.MouseEvent, column: keyof TransactionRow) => {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.target as HTMLElement).parentElement as HTMLElement;
    setIsResizing({
      column,
      startX: e.clientX,
      startWidth: th.offsetWidth,
      element: th
    });
  };

  const handleDragStart = (e: React.DragEvent, columnKey: keyof TransactionRow) => {
    setDraggedColumn(columnKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, columnKey: keyof TransactionRow) => {
    e.preventDefault();
    if (draggedColumn && draggedColumn !== columnKey) {
      setDragOverColumn(columnKey);
    }
  };

  const handleDrop = (e: React.DragEvent, targetKey: keyof TransactionRow) => {
    e.preventDefault();
    if (draggedColumn && draggedColumn !== targetKey) {
      const draggedIndex = columns.findIndex(col => col.key === draggedColumn);
      const targetIndex = columns.findIndex(col => col.key === targetKey);
      
      const newColumns = [...columns];
      const [removed] = newColumns.splice(draggedIndex, 1);
      newColumns.splice(targetIndex, 0, removed);
      
      setColumns(newColumns);
    }
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const handleToggleColumn = (columnKey: keyof TransactionRow) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.key === columnKey ? { ...col, visible: !col.visible } : col
      )
    );
  };

  const mergedTransactions: TransactionRow[] = statementData ? [
    ...statementData.ledgerEntries.map((entry: any) => ({
      id: `ledger-${entry.id}`,
      ledgerId: entry.id, // Store ledger ID for editing
      type: 'ledger' as const,
      date: formatDate(entry.effectiveDate),
      dateSort: new Date(entry.effectiveDate).getTime(),
      accrual: entry.accrual,
      payment: 0,
      order: entry.order,
      confirmed: entry.confirmed ?? false,
      ppc: 0,
      paidPercent: 0,
      due: 0,
      balance: 0,
      comment: entry.comment || '-',
      user: entry.userEmail,
      caAccount: '-',
      account: '-',
      createdAt: formatDate(entry.createdAt),
      id1: null,
      id2: null,
      batchId: null,
    })),
    ...statementData.bankTransactions.map((tx: any) => {
      const nominalAmount = Number(tx.nominalAmount ?? 0);
      const accountAmount = Number(tx.accountCurrencyAmount ?? 0);
      const amountMagnitude = Math.abs(
        Number.isFinite(nominalAmount) && nominalAmount !== 0
          ? nominalAmount
          : accountAmount
      );
      const signedPayment = accountAmount < 0
        ? -amountMagnitude
        : accountAmount > 0
          ? amountMagnitude
          : (Number.isFinite(nominalAmount) ? nominalAmount : 0);
      return {
      id: `bank-${tx.id}`,
      bankUuid: tx.uuid,
      bankId: tx.id,
      type: 'bank' as const,
      date: formatDate(tx.date),
      dateSort: new Date(tx.date).getTime(),
      accrual: 0,
      // Keep bank transaction sign in Payment column (outgoing: negative, incoming: positive).
      payment: signedPayment,
      order: 0,
        confirmed: null,
      ppc: Number.isFinite(accountAmount) ? accountAmount : 0,
      paidPercent: 0,
      due: 0,
      balance: 0,
      comment: tx.description || '-',
      user: '-',
      caAccount: tx.counteragentAccountNumber || '-',
      account: tx.accountLabel || '-',
      createdAt: formatDate(tx.createdAt),
      id1: tx.id1 || null,
      id2: tx.id2 || null,
      batchId: tx.batchId || null,
    }}),
    ...(statementData.adjustments || []).map((adj: any) => ({
      id: `adj-${adj.id}`,
      adjustmentId: adj.id,
      type: 'adjustment' as const,
      date: formatDate(adj.effectiveDate),
      dateSort: new Date(adj.effectiveDate).getTime(),
      accrual: 0,
      payment: adj.nominalAmount ?? adj.amount,
      order: 0,
      confirmed: null,
      ppc: adj.faceAmount ?? adj.nominalAmount ?? adj.amount,
      paidPercent: 0,
      due: 0,
      balance: 0,
      comment: (adj.faceCurrencyCode && adj.faceAmount ? `[${adj.faceCurrencyCode} ${adj.faceAmount}] ` : '') + (adj.comment || '-'),
      user: adj.userEmail || '-',
      caAccount: '-',
      account: '-',
      createdAt: formatDate(adj.createdAt),
      id1: null,
      id2: null,
      batchId: null,
    })),
  ].sort((a, b) => a.dateSort - b.dateSort) : []; // Sort by date ascending for cumulative calculation

  // Calculate cumulative values for each row (from oldest to newest)
  // For income financial codes (is_income=true): payments are incoming (positive),
  //   refunds are negative — use raw payment value.
  // For expense financial codes (is_income=false): payments are outgoing (negative),
  //   use Math.abs so due/balance decrease correctly.
  const isIncome = statementData?.payment?.isIncome ?? false;

  if (mergedTransactions.length > 0) {
    let cumulativeAccrual = 0;
    let cumulativePaid = 0;
    let cumulativeOrder = 0;

    mergedTransactions.forEach(row => {
      cumulativeAccrual += row.accrual;
      cumulativePaid += isIncome ? row.payment : Math.abs(row.payment);
      cumulativeOrder += row.order;

      row.paidPercent = cumulativeAccrual !== 0 
        ? parseFloat(((cumulativePaid / cumulativeAccrual) * 100).toFixed(2))
        : 0;

      row.due = parseFloat((cumulativeOrder - cumulativePaid).toFixed(2));

      row.balance = parseFloat((cumulativeAccrual - cumulativePaid).toFixed(2));
    });

    // Now reverse to show newest first in the table
    mergedTransactions.reverse();
  }

  // --- Shared filter engine ---
  const renderFilterValue = useCallback((value: any) => {
    if (value === null || value === undefined || value === '-') return '';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const getFacetBaseData = useMemo(() => {
    return buildFacetBaseData(mergedTransactions, '', filters, (row: any, key: string) => row[key]);
  }, [mergedTransactions, filters]);

  const columnValues = useMemo(() => {
    const filterableKeys = columns.filter(c => c.filterable).map(c => c.key as string);
    return buildUniqueValuesCache(filterableKeys, getFacetBaseData, (row: any, key: string) => row[key]);
  }, [columns, getFacetBaseData]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filteredTransactions = useMemo(() => {
    let filtered = [...mergedTransactions];

    // Apply column filters
    filters.forEach((filter, columnKey) => {
      filtered = filtered.filter((row) => {
        const value = (row as any)[columnKey];
        return matchesFilter(value, filter);
      });
    });

    // Apply sort
    if (sortColumn) {
      filtered.sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        const aStr = String(aVal ?? '').toLowerCase();
        const bStr = String(bVal ?? '').toLowerCase();
        return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    }

    return filtered;
  }, [mergedTransactions, filters, sortColumn, sortDirection]);

  const handleFilterChange = useCallback((columnKey: keyof TransactionRow, selectedValues: Set<any>) => {
    setFilters((prev) => {
      const updated = new Map(prev);
      if (selectedValues.size === 0) {
        updated.delete(columnKey as string);
      } else {
        updated.set(columnKey as string, { mode: 'facet', values: selectedValues });
      }
      return updated;
    });
  }, []);

  const handleAdvancedFilterChange = useCallback((columnKey: keyof TransactionRow, filter: ColumnFilter | null) => {
    setFilters((prev) => {
      const updated = new Map(prev);
      if (!filter) {
        updated.delete(columnKey as string);
      } else {
        updated.set(columnKey as string, filter);
      }
      return updated;
    });
  }, []);

  const resetAddLedgerForm = () => {
    setAddEffectiveDate('');
    setAddAccrual('');
    setAddOrder('');
    setAddComment('');
    setIsAddingLedger(false);
  };

  const toggleAccrualSelect = (rowId: string, checked: boolean) => {
    setSelectedAccrualIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(rowId);
      } else {
        next.delete(rowId);
      }
      return next;
    });
  };

  const toggleOrderSelect = (rowId: string, checked: boolean) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(rowId);
      } else {
        next.delete(rowId);
      }
      return next;
    });
  };

  const handleOpenAddLedger = () => {
    resetAddLedgerForm();
    setIsAddLedgerDialogOpen(true);
  };

  const handleCloseAddLedger = () => {
    setIsAddLedgerDialogOpen(false);
    resetAddLedgerForm();
  };

  const handleSaveAddLedger = async () => {
    if (!statementData?.payment?.paymentId) {
      alert('Payment ID is missing');
      return;
    }

    const accrualValue = addAccrual ? parseFloat(addAccrual) : null;
    const orderValue = addOrder ? parseFloat(addOrder) : null;

    if ((!accrualValue || accrualValue === 0) && (!orderValue || orderValue === 0)) {
      alert('Either Accrual or Order must be provided and cannot be zero');
      return;
    }

    setIsAddingLedger(true);
    try {
      const response = await fetch('/api/payments-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: statementData.payment.paymentId,
          effectiveDate: addEffectiveDate || undefined,
          accrual: accrualValue,
          order: orderValue,
          comment: addComment || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create ledger entry');
      }

      const result = await response.json();
      const created = Array.isArray(result) ? result[0] : result;

      if (created && statementData) {
        const newEntry = {
          id: Number(created.id),
          effectiveDate: created.effective_date || created.effectiveDate,
          accrual: created.accrual ? Number(created.accrual) : 0,
          order: created.order ? Number(created.order) : 0,
          confirmed: created.confirmed ?? false,
          comment: created.comment,
          userEmail: created.user_email || created.userEmail,
          createdAt: created.created_at || created.createdAt,
        };

        setStatementData({
          ...statementData,
          ledgerEntries: [...(statementData.ledgerEntries || []), newEntry],
        });

        if (broadcastChannel) {
          broadcastChannel.postMessage({
            type: 'ledger-updated',
            paymentId: statementData.payment.paymentId,
            ledgerId: newEntry.id,
            timestamp: Date.now(),
          });
        }
      }

      handleCloseAddLedger();
    } catch (error: any) {
      console.error('Error adding ledger entry:', error);
      alert(error.message || 'Failed to add ledger entry');
    } finally {
      setIsAddingLedger(false);
    }
  };

  // Adjustment handlers
  const resetAdjustmentForm = () => {
    setEditingAdjustmentId(null);
    setAdjEffectiveDate('');
    setAdjAmount('');
    setAdjComment('');
    setAdjFaceCurrency('');
    setAdjFaceAmount('');
    setAdjManualRate('');
    setIsSavingAdjustment(false);
    setAdjNominalPreview(null);
  };

  const handleOpenAddAdjustment = () => {
    resetAdjustmentForm();
    setIsAdjustmentDialogOpen(true);
  };

  const handleOpenEditAdjustment = (adjustmentId: number) => {
    const adj = (statementData?.adjustments || []).find((a: any) => a.id === adjustmentId);
    if (!adj) return;
    resetAdjustmentForm();
    setEditingAdjustmentId(adj.id);
    // Format date for input[type=date]
    const d = adj.effectiveDate ? new Date(adj.effectiveDate) : null;
    setAdjEffectiveDate(d && !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '');
    setAdjAmount(adj.amount ? String(adj.amount) : '');
    setAdjComment(adj.comment || '');
    setAdjFaceCurrency(adj.faceCurrencyCode || '');
    setAdjFaceAmount(adj.faceAmount ? String(adj.faceAmount) : '');
    setAdjManualRate(adj.manualRate ? String(adj.manualRate) : '');
    setIsAdjustmentDialogOpen(true);
  };

  const handleCloseAdjustmentDialog = () => {
    setIsAdjustmentDialogOpen(false);
    resetAdjustmentForm();
  };

  const handleSaveAdjustment = async () => {
    if (!statementData?.payment?.paymentId) {
      alert('Payment ID is missing');
      return;
    }

    const useFaceCurrency = adjFaceCurrency && adjFaceAmount && parseFloat(adjFaceAmount) !== 0;

    if (!useFaceCurrency) {
      const amountValue = adjAmount ? parseFloat(adjAmount) : null;
      if (!amountValue || amountValue === 0) {
        alert('Amount is required and cannot be zero (or provide face currency + face amount)');
        return;
      }
    }

    setIsSavingAdjustment(true);
    try {
      const isEdit = editingAdjustmentId !== null;
      const payload: any = isEdit
        ? { id: editingAdjustmentId }
        : { paymentId: statementData.payment.paymentId };

      payload.effectiveDate = adjEffectiveDate || undefined;
      payload.comment = adjComment || undefined;

      if (useFaceCurrency) {
        payload.faceCurrencyCode = adjFaceCurrency;
        payload.faceAmount = parseFloat(adjFaceAmount);
        if (adjManualRate && parseFloat(adjManualRate) !== 0) {
          payload.manualRate = parseFloat(adjManualRate);
        } else {
          payload.manualRate = null;
        }
      } else {
        payload.amount = parseFloat(adjAmount);
        payload.faceCurrencyCode = null;
        payload.faceAmount = null;
        payload.manualRate = null;
      }

      const response = await fetch('/api/adjustments', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${isEdit ? 'update' : 'create'} adjustment`);
      }

      const result = await response.json();
      const saved = Array.isArray(result) ? result[0] : result;

      if (saved && statementData) {
        const adjObj = {
          id: Number(saved.id),
          effectiveDate: saved.effective_date || saved.effectiveDate,
          amount: saved.amount ? Number(saved.amount) : 0,
          faceCurrencyCode: saved.face_currency_code || saved.faceCurrencyCode || null,
          faceAmount: saved.face_amount ? Number(saved.face_amount) : (saved.faceAmount ? Number(saved.faceAmount) : null),
          manualRate: saved.manual_rate ? Number(saved.manual_rate) : (saved.manualRate ? Number(saved.manualRate) : null),
          nominalAmount: saved.nominal_amount ? Number(saved.nominal_amount) : (saved.nominalAmount ? Number(saved.nominalAmount) : (saved.amount ? Number(saved.amount) : 0)),
          comment: saved.comment,
          userEmail: saved.user_email || saved.userEmail,
          createdAt: saved.created_at || saved.createdAt,
        };

        if (isEdit) {
          setStatementData({
            ...statementData,
            adjustments: (statementData.adjustments || []).map((a: any) =>
              a.id === editingAdjustmentId ? adjObj : a
            ),
          });
        } else {
          setStatementData({
            ...statementData,
            adjustments: [...(statementData.adjustments || []), adjObj],
          });
        }
      }

      handleCloseAdjustmentDialog();
    } catch (error: any) {
      console.error('Error saving adjustment:', error);
      alert(error.message || 'Failed to save adjustment');
    } finally {
      setIsSavingAdjustment(false);
    }
  };

  const handleDeleteAdjustment = async (adjustmentId: number) => {
    if (!confirm('Delete this adjustment?')) return;
    try {
      const response = await fetch(`/api/adjustments?id=${adjustmentId}`, { method: 'DELETE' });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete adjustment');
      }
      if (statementData) {
        setStatementData({
          ...statementData,
          adjustments: (statementData.adjustments || []).filter((a: any) => a.id !== adjustmentId),
        });
      }
    } catch (error: any) {
      console.error('Error deleting adjustment:', error);
      alert(error.message || 'Failed to delete adjustment');
    }
  };

  const handleAddAccrualOrderFromPayments = async () => {
    if (!statementData?.payment?.paymentId) {
      alert('Payment ID is missing');
      return;
    }

    const selectedRows = mergedTransactions.filter((row) =>
      row.type === 'bank' && (selectedAccrualIds.has(row.id) || selectedOrderIds.has(row.id))
    );

    if (selectedRows.length === 0) {
      alert('Select at least one payment row for accrual/order');
      return;
    }

    setIsAoSubmitting(true);
    try {
      const entries: Array<{
        paymentId: string;
        effectiveDate?: string;
        accrual: number | null;
        order: number | null;
      }> = [];

      for (const row of selectedRows) {
        const accrual = selectedAccrualIds.has(row.id) ? Math.abs(row.payment) : null;
        const order = selectedOrderIds.has(row.id) ? Math.abs(row.payment) : null;
        if (!accrual && !order) continue;
        entries.push({
          paymentId: statementData.payment.paymentId,
          effectiveDate: toIsoDateFromDisplay(row.date) || undefined,
          accrual,
          order,
        });
      }

      if (entries.length === 0) {
        alert('No valid A/O rows selected');
        return;
      }

      const response = await fetch('/api/payments-ledger/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Failed to add accrual/order entries');
      }

      const refreshed = await fetch(`/api/payment-statement?paymentId=${statementData.payment.paymentId}`);
      if (refreshed.ok) {
        const refreshedData = await refreshed.json();
        setStatementData(refreshedData);
      }

      if (broadcastChannel) {
        broadcastChannel.postMessage({
          type: 'ledger-updated',
          paymentId: statementData.payment.paymentId,
          timestamp: Date.now(),
        });
      }

      setSelectedAccrualIds(new Set());
      setSelectedOrderIds(new Set());
    } catch (error: any) {
      console.error('Error adding accrual/order entries:', error);
      alert(error.message || 'Failed to add accrual/order entries');
    } finally {
      setIsAoSubmitting(false);
    }
  };

  const handleEditEntry = (row: TransactionRow) => {
    if (row.type === 'ledger' && row.ledgerId) {
      // Convert dd.mm.yyyy to yyyy-MM-dd for input[type="date"]
      const dateParts = row.date.split('.');
      const isoDate = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}` : '';
      
      setEditingEntry({
        id: row.ledgerId,
        paymentId: statementData.payment.paymentId,
        date: row.date,
        accrual: row.accrual,
        order: row.order,
        comment: row.comment === '-' ? '' : row.comment
      });
      setNewPaymentId(statementData.payment.paymentId);
      setNewDate(isoDate);
      setNewAccrual(row.accrual.toString());
      setNewOrder(row.order.toString());
      setNewComment(row.comment === '-' ? '' : row.comment);
      setPaymentSearch('');
      
      // Fetch current payment details
      const payment = allPayments.find(p => p.paymentId === statementData.payment.paymentId);
      if (payment) {
        setPaymentDetails({
          counteragent: payment.counteragent,
          project: payment.project,
          job: payment.job,
          financialCode: payment.financialCode,
          currency: payment.currency,
          incomeTax: payment.incomeTax
        });
      }
      
      setIsEditDialogOpen(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingEntry || !newPaymentId) return;

    // Close confirmation and start saving
    setShowConfirmation(false);
    setIsSaving(true);
    try {
      const response = await fetch(`/api/payments-ledger/${editingEntry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: newPaymentId,
          effectiveDate: newDate,
          accrual: parseFloat(newAccrual) || 0,
          order: parseFloat(newOrder) || 0,
          comment: newComment || null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update entry');
      }

      console.log('[Payment Statement] Update successful, updating local state...');
      console.log('[Payment Statement] statementData structure:', statementData ? Object.keys(statementData) : 'null');

      // Update the statement data locally without full page reload
      if (statementData && statementData.ledgerEntries) {
        console.log('[Payment Statement] Updating ledgerEntries, entry ID:', editingEntry.id);
        
        const updatedLedgerEntries = statementData.ledgerEntries.map((entry: any) => {
          if (entry.id === editingEntry.id) {
            console.log('[Payment Statement] Found matching entry, updating...');
            // Update the changed entry
            return {
              ...entry,
              effectiveDate: newDate,
              accrual: parseFloat(newAccrual) || 0,
              order: parseFloat(newOrder) || 0,
              comment: newComment || null
            };
          }
          return entry;
        });

        console.log('[Payment Statement] Updated ledger entries count:', updatedLedgerEntries.length);

        // Update state with new data
        setStatementData({
          ...statementData,
          ledgerEntries: updatedLedgerEntries
        });

        console.log('[Payment Statement] State updated, broadcasting to other tabs...');

        // Broadcast the update to other tabs/windows
        if (broadcastChannel) {
          const message = {
            type: 'ledger-updated',
            paymentId: newPaymentId,
            ledgerId: editingEntry.id,
            timestamp: Date.now()
          };
          console.log('[Payment Statement] Broadcasting message:', message);
          broadcastChannel.postMessage(message);
        } else {
          console.log('[Payment Statement] BroadcastChannel not available');
        }
      } else {
        console.warn('[Payment Statement] Cannot update: statementData or ledgerEntries missing');
        console.log('[Payment Statement] statementData:', statementData);
      }

      // Close dialog
      setIsEditDialogOpen(false);
      setEditingEntry(null);
    } catch (error: any) {
      console.error('Error updating ledger entry:', error);
      alert(error.message || 'Failed to update entry');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEntry = async () => {
    if (!editingEntry) return;
    if (!confirm('Delete this ledger entry? This will hide it from reports and statements.')) {
      return;
    }
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/payments-ledger?id=${editingEntry.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete entry');
      }

      if (statementData && statementData.ledgerEntries) {
        const updatedLedgerEntries = statementData.ledgerEntries.filter((entry: any) => entry.id !== editingEntry.id);
        setStatementData({
          ...statementData,
          ledgerEntries: updatedLedgerEntries
        });

        if (broadcastChannel) {
          broadcastChannel.postMessage({
            type: 'ledger-deleted',
            paymentId: statementData.payment.paymentId,
            ledgerId: editingEntry.id,
            timestamp: Date.now(),
          });
        }
      }

      setIsEditDialogOpen(false);
      setEditingEntry(null);
    } catch (error: any) {
      console.error('Error deleting ledger entry:', error);
      alert(error.message || 'Failed to delete ledger entry');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditDialogOpen(false);
    setEditingEntry(null);
    setNewPaymentId('');
    setNewDate('');
    setNewAccrual('');
    setNewOrder('');
    setNewComment('');
    setPaymentSearch('');
    setPaymentDetails(null);
    setShowConfirmation(false);
  };

  const viewLedgerRecord = async (ledgerId: number) => {
    setLoadingLedgerRecord(true);
    setViewingLedgerRecord(null);
    setIsLedgerRecordDialogOpen(true);
    try {
      const response = await fetch(`/api/payments-ledger/${ledgerId}`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to fetch ledger record');
      }
      const result = await response.json();
      setViewingLedgerRecord(result);
    } catch (error: any) {
      alert(error?.message || 'Failed to fetch ledger record');
      setIsLedgerRecordDialogOpen(false);
    } finally {
      setLoadingLedgerRecord(false);
    }
  };

  const viewAuditLog = async (table: string, recordId: number, title: string) => {
    setIsAuditDialogOpen(true);
    setLoadingAudit(true);
    setAuditTitle(title);
    try {
      const response = await fetch(`/api/audit?table=${encodeURIComponent(table)}&recordId=${recordId}`);
      if (response.ok) {
        const logs = await response.json();
        setAuditLogs(Array.isArray(logs) ? logs : []);
      } else {
        setAuditLogs([]);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      setAuditLogs([]);
    } finally {
      setLoadingAudit(false);
    }
  };

  const viewBankAuditLog = async (recordId: number) => {
    setIsAuditDialogOpen(true);
    setLoadingAudit(true);
    setAuditTitle('Bank Transaction Audit Log');
    try {
      const response = await fetch(
        `/api/audit?table=${encodeURIComponent(BANK_AUDIT_TABLE)}&recordId=${recordId}`
      );
      const logs = response.ok ? await response.json() : [];
      setAuditLogs(Array.isArray(logs) ? logs : []);
    } catch (error) {
      console.error('Error fetching bank audit logs:', error);
      setAuditLogs([]);
    } finally {
      setLoadingAudit(false);
    }
  };

  const openBankEditDialog = async (bankUuid?: string | null) => {
    if (!bankUuid) return;
    setIsBankEditDialogOpen(true);
    setBankEditLoading(true);
    setBankEditId(null);
    setBankEditData([]);
    try {
      const response = await fetch(`/api/bank-transactions?recordUuid=${encodeURIComponent(bankUuid)}`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to fetch bank transaction');
      }
      const result = await response.json();
      const records = Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : [];
      const mapped = records.map((row: any) => ({
        id: row.id,
        uuid: row.uuid,
        accountUuid: row.bank_account_uuid || row.accountUuid || '',
        accountCurrencyUuid: row.account_currency_uuid || row.accountCurrencyUuid || '',
        accountCurrencyCode: row.account_currency_code || row.accountCurrencyCode || null,
        accountCurrencyAmount: row.account_currency_amount || row.accountCurrencyAmount || null,
        paymentUuid: row.payment_uuid || row.paymentUuid || null,
        counteragentUuid: row.counteragent_uuid || row.counteragentUuid || null,
        projectUuid: row.project_uuid || row.projectUuid || null,
        financialCodeUuid: row.financial_code_uuid || row.financialCodeUuid || null,
        nominalCurrencyUuid: row.nominal_currency_uuid || row.nominalCurrencyUuid || null,
        nominalAmount: row.nominal_amount || row.nominalAmount || null,
        date: row.transaction_date || row.date || '',
        correctionDate: row.correction_date || row.correctionDate || null,
        exchangeRate: row.exchange_rate || row.exchangeRate || null,
        nominalExchangeRate: row.nominal_exchange_rate || row.nominalExchangeRate || null,
        usdGelRate: row.usd_gel_rate ?? row.usdGelRate ?? null,
        id1: row.id1 || row.dockey || null,
        id2: row.id2 || row.entriesid || null,
        batchId: row.batch_id || row.batchId || null,
        recordUuid: row.raw_record_uuid || row.recordUuid || '',
        counteragentAccountNumber: row.counteragent_account_number ? String(row.counteragent_account_number) : null,
        description: row.description || null,
        processingCase: row.processing_case || row.processingCase || null,
        appliedRuleId: row.applied_rule_id || row.appliedRuleId || null,
        parsingLock: row.parsing_lock ?? row.parsingLock ?? false,
        createdAt: toISO(toValidDate(row.created_at || row.createdAt)),
        updatedAt: toISO(toValidDate(row.updated_at || row.updatedAt)),
        isBalanceRecord: row.is_balance_record || row.isBalanceRecord || false,
        accountNumber: row.account_number || row.accountNumber || null,
        bankName: row.bank_name || row.bankName || null,
        counteragentName: row.counteragent_name || row.counteragentName || null,
        projectIndex: row.project_index || row.projectIndex || null,
        financialCode: row.financial_code || row.financialCode || null,
        paymentId: row.payment_id || row.paymentId || null,
        nominalCurrencyCode: row.nominal_currency_code || row.nominalCurrencyCode || null,
      }));
      setBankEditData(mapped);
      if (mapped.length > 0) {
        setBankEditId(Number(mapped[0].id));
      }
    } catch (error: any) {
      alert(error?.message || 'Failed to fetch bank transaction');
      setIsBankEditDialogOpen(false);
    } finally {
      setBankEditLoading(false);
    }
  };

  const viewBankRecord = async (uuid: string) => {
    setLoadingBankRecord(true);
    setViewingBankRecord(null);
    setIsBankRecordDialogOpen(true);
    try {
      const response = await fetch(`/api/bank-transactions/raw-record/${uuid}`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to fetch bank record');
      }
      const result = await response.json();
      setViewingBankRecord(result);
    } catch (error: any) {
      alert(error?.message || 'Failed to fetch bank record');
      setIsBankRecordDialogOpen(false);
    } finally {
      setLoadingBankRecord(false);
    }
  };

  const updateBankRecordParsingLock = async (checked: boolean) => {
    if (!viewingBankRecord?.id) return;
    setIsBankLockUpdating(true);
    try {
      const response = await fetch(`/api/bank-transactions/parsing-lock/${viewingBankRecord.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsing_lock: checked }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to update parsing lock');
      }
      setViewingBankRecord((prev: any) => ({
        ...prev,
        parsing_lock: checked,
      }));
    } catch (error: any) {
      alert(error?.message || 'Failed to update parsing lock');
    } finally {
      setIsBankLockUpdating(false);
    }
  };

  const filteredPayments = allPayments.filter(p => {
    if (!paymentSearch) return true;
    const searchLower = paymentSearch.toLowerCase();
    return (
      p.paymentId.toLowerCase().includes(searchLower) ||
      p.counteragent.toLowerCase().includes(searchLower) ||
      p.project.toLowerCase().includes(searchLower)
    );
  });


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading statement...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  if (!statementData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">No data available</div>
      </div>
    );
  }

  const handleExportXlsx = () => {
    const fmtNum = (v: number | null | undefined) => (v == null ? '' : Number(Number(v).toFixed(2)));
    const fmtDate = (v: string | Date | null | undefined) => {
      if (!v) return '';
      const d = new Date(v);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${day}.${month}.${d.getFullYear()}`;
    };
    const rows = filteredTransactions.map(row => ({
      'Date': fmtDate(row.date),
      'Type': row.type,
      'Accrual': fmtNum(row.accrual),
      'Payment': fmtNum(row.payment),
      'Order': fmtNum(row.order),
      'PPC': fmtNum(row.ppc),
      'Paid %': fmtNum(row.paidPercent),
      'Due': fmtNum(row.due),
      'Balance': fmtNum(row.balance),
      'Confirmed': row.confirmed == null ? '' : row.confirmed ? 'Yes' : 'No',
      'Comment': row.comment ?? '',
      'User': row.user ?? '',
      'CA Account': row.caAccount ?? '',
      'Account': row.account ?? '',
      'Batch ID': row.batchId ?? '',
      'ID1': row.id1 ?? '',
      'ID2': row.id2 ?? '',
      'Created At': fmtDate(row.createdAt),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Statement');
    const payId = statementData.payment.paymentId ?? 'export';
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `payment_statement_${payId}_${dateStr}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full">
        <div className="space-y-6">
          {/* Header */}
          <div className="border-b pb-4 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">Payment Statement</h1>
              <p className="text-gray-600 mt-1">Payment ID: {statementData.payment.paymentId}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportXlsx}>
              Export XLSX
            </Button>
          </div>

          {/* Payment Info */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-3 text-lg">Payment Information</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600 block">Payment ID</span>
                <span className="font-medium">{statementData.payment.paymentId}</span>
              </div>
              <div>
                <span className="text-gray-600 block">Project</span>
                <span className="font-medium">{statementData.payment.project || '-'}</span>
              </div>
              <div>
                <span className="text-gray-600 block">Counteragent</span>
                <span className="font-medium">{statementData.payment.counteragent || '-'}</span>
              </div>
              <div>
                <span className="text-gray-600 block">Counteragent ID</span>
                <span className="font-medium">{statementData.payment.counteragentId || '-'}</span>
              </div>
              <div>
                <span className="text-gray-600 block">Financial Code</span>
                <span className="font-medium">{statementData.payment.financialCode || '-'}</span>
              </div>
              <div>
                <span className="text-gray-600 block">Job</span>
                <span className="font-medium">{statementData.payment.job || '-'}</span>
              </div>
              <div>
                <span className="text-gray-600 block">Floors</span>
                <span className="font-medium">{statementData.payment.floors}</span>
              </div>
              <div>
                <span className="text-gray-600 block">Currency</span>
                <span className="font-medium">{statementData.payment.currency || '-'}</span>
              </div>
              <div>
                <span className="text-gray-600 block">Income Tax</span>
                <span className="font-medium">{statementData.payment.incomeTax ? '✓ Yes' : '✗ No'}</span>
              </div>
            </div>
          </div>

          {/* Merged Payment Transactions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-lg">
                Payment Transactions 
                <span className="ml-2 text-sm font-normal text-gray-600">
                  ({filteredTransactions.length}{filters.size > 0 ? ` of ${mergedTransactions.length}` : ''} {filteredTransactions.length === 1 ? 'entry' : 'entries'})
                </span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenAddLedger}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  title="Add ledger entry"
                >
                  <Plus className="h-4 w-4" />
                  Add Ledger
                </button>
                <button
                  onClick={handleOpenAddAdjustment}
                  className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                  title="Add adjustment"
                >
                  <Plus className="h-4 w-4" />
                  Add Adjustment
                </button>
                <button
                  onClick={handleAddAccrualOrderFromPayments}
                  className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
                  disabled={isAoSubmitting}
                  title="Add accrual/order from selected payment rows"
                >
                  <Plus className="h-4 w-4" />
                  {isAoSubmitting ? 'Adding...' : '+A&O'}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between mb-3">
              <div />
              <div className="flex items-center gap-2">
                <ClearFiltersButton
                  activeCount={filters.size}
                  onClear={() => setFilters(new Map())}
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      Columns
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Toggle Columns</h4>
                      {columns.map((col) => (
                        <div key={col.key} className="flex items-center space-x-2">
                          <Checkbox
                            id={`payment-statement-column-${col.key}`}
                            checked={col.visible}
                            onCheckedChange={() => handleToggleColumn(col.key)}
                          />
                          <label
                            htmlFor={`payment-statement-column-${col.key}`}
                            className="text-sm cursor-pointer"
                          >
                            {col.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {filteredTransactions.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                    <thead className="bg-gray-100">
                      <tr>
                        {(() => {
                          const eligibleIds = filteredTransactions
                            .filter((row) => row.type === 'bank' && row.payment !== 0)
                            .map((row) => row.id);
                          const allAccrualSelected =
                            eligibleIds.length > 0 && eligibleIds.every((id) => selectedAccrualIds.has(id));
                          const allOrderSelected =
                            eligibleIds.length > 0 && eligibleIds.every((id) => selectedOrderIds.has(id));
                          return (
                            <>
                              <th
                                className="px-2 py-3 font-semibold text-center bg-red-100 text-red-700"
                                style={{ width: '70px' }}
                                title="Accrual selector"
                              >
                                <div className="flex items-center justify-center gap-2">
                                  A
                                  <Checkbox
                                    checked={allAccrualSelected}
                                    disabled={isAoSubmitting || eligibleIds.length === 0}
                                    onCheckedChange={(checked) => {
                                      setSelectedAccrualIds(
                                        checked ? new Set(eligibleIds) : new Set()
                                      );
                                    }}
                                  />
                                </div>
                              </th>
                              <th
                                className="px-2 py-3 font-semibold text-center bg-yellow-100 text-yellow-800"
                                style={{ width: '70px' }}
                                title="Order selector"
                              >
                                <div className="flex items-center justify-center gap-2">
                                  O
                                  <Checkbox
                                    checked={allOrderSelected}
                                    disabled={isAoSubmitting || eligibleIds.length === 0}
                                    onCheckedChange={(checked) => {
                                      setSelectedOrderIds(
                                        checked ? new Set(eligibleIds) : new Set()
                                      );
                                    }}
                                  />
                                </div>
                              </th>
                            </>
                          );
                        })()}
                        {columns.filter(col => col.visible).map((column) => (
                          <th
                            key={column.key}
                            draggable
                            onDragStart={(e) => handleDragStart(e, column.key)}
                            onDragOver={(e) => handleDragOver(e, column.key)}
                            onDrop={(e) => handleDrop(e, column.key)}
                            className={`px-4 py-3 font-semibold relative cursor-move select-none ${
                              column.align === 'right' ? 'text-right' : 'text-left'
                            } ${dragOverColumn === column.key ? 'bg-blue-100' : ''}`}
                            style={{
                              width: `${column.width}px`,
                              minWidth: `${column.width}px`,
                              maxWidth: `${column.width}px`,
                            }}
                          >
                            <div className="flex items-center gap-1">
                              <span className={column.align === 'right' ? 'ml-auto' : ''}>{column.label}</span>
                              {column.filterable && (
                                <ColumnFilterPopover
                                  columnKey={column.key as string}
                                  columnLabel={column.label}
                                  values={columnValues.get(column.key as string) || []}
                                  activeFilter={filters.get(column.key as string)}
                                  onAdvancedFilterChange={(filter) => handleAdvancedFilterChange(column.key, filter)}
                                  onFilterChange={(values) => handleFilterChange(column.key, values)}
                                  onSort={(direction) => {
                                    setSortColumn(column.key);
                                    setSortDirection(direction);
                                  }}
                                  columnFormat={column.format}
                                  renderValue={renderFilterValue}
                                />
                              )}
                              <div
                                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-10"
                                onMouseDown={(e) => handleResizeStart(e, column.key)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </th>
                        ))}
                        <th className="px-4 py-3 font-semibold text-left" style={{ width: '70px' }}>
                          View
                        </th>
                        <th className="px-4 py-3 font-semibold text-left" style={{ width: '70px' }}>
                          Logs
                        </th>
                        <th className="px-4 py-3 font-semibold text-left" style={{ width: '90px' }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((row, index) => (
                        <tr key={row.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          {(() => {
                            const canSelect = row.type === 'bank' && row.payment !== 0;
                            return (
                              <>
                                <td
                                  className="px-2 py-3 text-center bg-red-100"
                                  style={{ width: '70px' }}
                                >
                                  {canSelect ? (
                                    <Checkbox
                                      checked={selectedAccrualIds.has(row.id)}
                                      disabled={isAoSubmitting}
                                      onCheckedChange={(checked) => toggleAccrualSelect(row.id, Boolean(checked))}
                                    />
                                  ) : (
                                    <span className="text-gray-300">-</span>
                                  )}
                                </td>
                                <td
                                  className="px-2 py-3 text-center bg-yellow-100"
                                  style={{ width: '70px' }}
                                >
                                  {canSelect ? (
                                    <Checkbox
                                      checked={selectedOrderIds.has(row.id)}
                                      disabled={isAoSubmitting}
                                      onCheckedChange={(checked) => toggleOrderSelect(row.id, Boolean(checked))}
                                    />
                                  ) : (
                                    <span className="text-gray-300">-</span>
                                  )}
                                </td>
                              </>
                            );
                          })()}
                          {columns.filter(col => col.visible).map((column) => {
                            let displayValue: any = row[column.key];

                            if (column.key === 'confirmed') {
                              displayValue =
                                displayValue === null || displayValue === undefined
                                  ? ''
                                  : displayValue
                                    ? 'Yes'
                                    : 'No';
                            }

                            // Format numeric values
                            if (column.align === 'right' && typeof displayValue === 'number') {
                              // Show blank for 0.00 in accrual, order, payment, and ppc columns
                              if ((column.key === 'accrual' || column.key === 'order' || column.key === 'payment' || column.key === 'ppc') && displayValue === 0) {
                                displayValue = '';
                              } else if (column.key === 'paidPercent') {
                                displayValue = `${displayValue.toFixed(2)}%`;
                              } else {
                                displayValue = displayValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                              }
                            }
                            
                            return (
                              <td
                                key={column.key}
                                className={`px-4 py-3 ${
                                  column.align === 'right' ? 'text-right font-mono' : 'text-left'
                                }`}
                                style={{
                                  width: `${column.width}px`,
                                  minWidth: `${column.width}px`,
                                  maxWidth: `${column.width}px`,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {displayValue}
                              </td>
                            );
                          })}
                          <td className="px-4 py-3" style={{ width: '70px' }}>
                            {row.type === 'ledger' && row.ledgerId && (
                              <button
                                onClick={() => viewLedgerRecord(row.ledgerId as number)}
                                className="p-1 hover:bg-gray-200 rounded"
                                title="View ledger record"
                              >
                                <Eye className="h-4 w-4 text-gray-700" />
                              </button>
                            )}
                            {row.type === 'bank' && row.bankUuid && (
                              <button
                                onClick={() => viewBankRecord(row.bankUuid as string)}
                                className="p-1 hover:bg-gray-200 rounded"
                                title="View bank transaction"
                              >
                                <Eye className="h-4 w-4 text-gray-700" />
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3" style={{ width: '70px' }}>
                            {row.type === 'ledger' && row.ledgerId && (
                              <button
                                onClick={() => viewAuditLog('payments_ledger', row.ledgerId as number, 'Ledger Audit Log')}
                                className="p-1 hover:bg-gray-200 rounded"
                                title="View ledger audit log"
                              >
                                <Info className="h-4 w-4 text-gray-700" />
                              </button>
                            )}
                            {row.type === 'bank' && row.bankId && (
                              <button
                                onClick={() => viewBankAuditLog(row.bankId as number)}
                                className="p-1 hover:bg-gray-200 rounded"
                                title="View bank audit log"
                              >
                                <Info className="h-4 w-4 text-gray-700" />
                              </button>
                            )}
                            {row.type === 'adjustment' && row.adjustmentId && (
                              <button
                                onClick={() => viewAuditLog('payment_adjustments', row.adjustmentId as number, 'Adjustment Audit Log')}
                                className="p-1 hover:bg-gray-200 rounded"
                                title="View adjustment audit log"
                              >
                                <Info className="h-4 w-4 text-gray-700" />
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3" style={{ width: '90px' }}>
                            {row.type === 'ledger' && row.ledgerId && (
                              <button
                                onClick={() => handleEditEntry(row)}
                                className="p-1 hover:bg-gray-200 rounded"
                                title="Edit entry"
                              >
                                <Edit2 className="h-4 w-4 text-blue-600" />
                              </button>
                            )}
                            {row.type === 'bank' && row.bankUuid && (
                              <button
                                onClick={() => openBankEditDialog(row.bankUuid as string)}
                                className="p-1 hover:bg-gray-200 rounded"
                                title="Edit bank transaction"
                              >
                                <Edit2 className="h-4 w-4 text-blue-600" />
                              </button>
                            )}
                            {row.type === 'adjustment' && row.adjustmentId && (
                              <button
                                onClick={() => handleOpenEditAdjustment(row.adjustmentId as number)}
                                className="p-1 hover:bg-gray-200 rounded"
                                title="Edit adjustment"
                              >
                                <Edit2 className="h-4 w-4 text-blue-600" />
                              </button>
                            )}
                            {row.type === 'adjustment' && row.adjustmentId && (
                              <button
                                onClick={() => handleDeleteAdjustment(row.adjustmentId as number)}
                                className="p-1 hover:bg-gray-200 rounded"
                                title="Delete adjustment"
                              >
                                <X className="h-4 w-4 text-red-600" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      
                      {/* Totals Row */}
                      <tr className="bg-blue-50 font-bold border-t-2 border-blue-300">
                        <td className="px-2 py-3 bg-red-100" style={{ width: '70px' }}></td>
                        <td className="px-2 py-3 bg-yellow-100" style={{ width: '70px' }}></td>
                        {columns.filter(col => col.visible).map((column) => {
                          let totalValue: string | number = '';
                          
                          if (column.key === 'date') {
                            totalValue = 'TOTAL';
                          } else if (column.key === 'accrual') {
                            const total = filteredTransactions.reduce((sum, row) => sum + row.accrual, 0);
                            totalValue = total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          } else if (column.key === 'order') {
                            const total = filteredTransactions.reduce((sum, row) => sum + row.order, 0);
                            totalValue = total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          } else if (column.key === 'payment') {
                            const total = filteredTransactions.reduce((sum, row) => sum + row.payment, 0);
                            totalValue = total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          } else if (column.key === 'ppc') {
                            const total = filteredTransactions.reduce((sum, row) => sum + row.ppc, 0);
                            totalValue = total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          }
                          
                          return (
                            <td
                              key={column.key}
                              className={`px-4 py-3 ${
                                column.align === 'right' ? 'text-right font-mono' : 'text-left'
                              }`}
                              style={{
                                width: `${column.width}px`,
                                minWidth: `${column.width}px`,
                                maxWidth: `${column.width}px`,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {totalValue}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3" style={{ width: '70px' }}></td>
                        <td className="px-4 py-3" style={{ width: '70px' }}></td>
                        <td className="px-4 py-3" style={{ width: '90px' }}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 border rounded-lg">No transactions found</div>
            )}
          </div>

          {/* Print Button */}
          <div className="flex justify-end pt-4 border-t">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Print Statement
            </button>
          </div>
        </div>
      </div>

      {/* Add Ledger Dialog */}
      {isAddLedgerDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Add Ledger</h2>
              <button
                onClick={handleCloseAddLedger}
                className="p-1 hover:bg-gray-100 rounded"
                disabled={isAddingLedger}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Payment ID (Locked)
                </label>
                <input
                  value={statementData?.payment?.paymentId || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Effective Date
                </label>
                <input
                  type="date"
                  value={addEffectiveDate}
                  onChange={(e) => setAddEffectiveDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Accrual Amount
                  </label>
                  <input
                    type="number"
                    value={addAccrual}
                    onChange={(e) => setAddAccrual(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Order Amount
                  </label>
                  <input
                    type="number"
                    value={addOrder}
                    onChange={(e) => setAddOrder(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Comment
                </label>
                <textarea
                  value={addComment}
                  onChange={(e) => setAddComment(e.target.value)}
                  placeholder="Enter comment..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={handleCloseAddLedger}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  disabled={isAddingLedger}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAddLedger}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  disabled={isAddingLedger}
                >
                  {isAddingLedger ? 'Saving...' : 'Add Entry'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Adjustment Dialog */}
      {isAdjustmentDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">{editingAdjustmentId ? 'Edit Adjustment' : 'Add Adjustment'}</h2>
              <button
                onClick={handleCloseAdjustmentDialog}
                className="p-1 hover:bg-gray-100 rounded"
                disabled={isSavingAdjustment}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Payment ID (Locked)
                </label>
                <input
                  value={statementData?.payment?.paymentId || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Effective Date
                </label>
                <input
                  type="date"
                  value={adjEffectiveDate}
                  onChange={(e) => setAdjEffectiveDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              {/* Face Currency Section */}
              <div className="border border-gray-200 rounded-md p-4 space-y-3 bg-gray-50">
                <p className="text-sm font-medium text-gray-700">Face Currency (optional — auto-converts to nominal)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs text-gray-500">Currency</label>
                    <select
                      value={adjFaceCurrency}
                      onChange={(e) => setAdjFaceCurrency(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="">— none —</option>
                      {['GEL','USD','EUR','GBP','CNY','TRY','AED','KZT','RUB'].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs text-gray-500">Face Amount</label>
                    <input
                      type="number"
                      value={adjFaceAmount}
                      onChange={(e) => setAdjFaceAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs text-gray-500">Manual Rate (opt.)</label>
                    <input
                      type="number"
                      value={adjManualRate}
                      onChange={(e) => setAdjManualRate(e.target.value)}
                      placeholder="auto"
                      step="0.000001"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Nominal amount preview */}
              {adjNominalPreview && (
                <div className="rounded-md border border-purple-200 bg-purple-50 px-4 py-2 flex items-center justify-between">
                  <div className="text-sm text-purple-800">
                    <span className="font-medium">Nominal Amount:</span>{' '}
                    <span className="font-bold text-lg">{adjNominalPreview.nominalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>{' '}
                    <span className="font-medium">{adjNominalPreview.nominalCurrency}</span>
                  </div>
                  <div className="text-xs text-purple-600">
                    Rate: {adjNominalPreview.rate} ({adjNominalPreview.rateSource === 'manual' ? 'manual' : 'NBG'})
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Amount (nominal — used if no face currency)
                </label>
                <input
                  type="number"
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  disabled={!!(adjFaceCurrency && adjFaceAmount)}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Comment
                </label>
                <textarea
                  value={adjComment}
                  onChange={(e) => setAdjComment(e.target.value)}
                  placeholder="Enter comment..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={handleCloseAdjustmentDialog}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  disabled={isSavingAdjustment}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAdjustment}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                  disabled={isSavingAdjustment}
                >
                  {isSavingAdjustment ? 'Saving...' : (editingAdjustmentId ? 'Save Changes' : 'Add Adjustment')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      {isEditDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Edit Ledger Entry</h2>
              <button
                onClick={handleCancelEdit}
                className="p-1 hover:bg-gray-100 rounded"
                disabled={isSaving}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Payment ID Selection with Combobox */}
              <div className="space-y-2">
                <Label>Payment ID <span className="text-red-500">*</span></Label>
                <Combobox
                  value={newPaymentId}
                  onValueChange={(value) => {
                    setNewPaymentId(value);
                    // Fetch and set payment details when payment changes
                    const payment = allPayments.find(p => p.paymentId === value);
                    if (payment) {
                      setPaymentDetails({
                        counteragent: payment.counteragent,
                        project: payment.project,
                        job: payment.job,
                        financialCode: payment.financialCode,
                        currency: payment.currency,
                        incomeTax: payment.incomeTax
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
                  options={allPayments.map(p => {
                    const parts = [p.paymentId];
                    if (p.counteragent) parts.push(p.counteragent);
                    if (p.project) parts.push(p.project);
                    if (p.job) parts.push(p.job);
                    if (p.financialCode) parts.push(p.financialCode);
                    if (p.currency) parts.push(p.currency);
                    
                    const fullLabel = parts.join(' | ');
                    const searchKeywords = [
                      p.paymentId,
                      p.counteragent || '',
                      p.project || '',
                      p.job || '',
                      p.financialCode || '',
                      p.currency || ''
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

              {/* Payment Details Display */}
              {paymentDetails && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700">Payment Details</h3>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-600">Payment ID</Label>
                      <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                        <span className="font-bold" style={{ color: '#000' }}>{newPaymentId}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-600">Currency</Label>
                      <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                        <span className="font-bold" style={{ color: '#000' }}>{paymentDetails.currency}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-600">Income Tax</Label>
                      <div className="flex items-center h-9 px-3 border-2 border-gray-300 rounded-md bg-gray-100">
                        <Checkbox checked={paymentDetails.incomeTax} disabled />
                        <span className="ml-2 text-sm font-bold" style={{ color: '#000' }}>{paymentDetails.incomeTax ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Counteragent</Label>
                    <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                      <span className="font-bold" style={{ color: '#000' }}>{paymentDetails.counteragent}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Project</Label>
                    <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                      <span className="font-bold" style={{ color: '#000' }}>{paymentDetails.project}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Job</Label>
                    <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                      <span className="font-bold" style={{ color: '#000' }}>{paymentDetails.job}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Financial Code</Label>
                    <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                      <span className="font-bold" style={{ color: '#000' }}>{paymentDetails.financialCode}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Date Field */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Effective Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Comment Field */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Comment
                </label>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Enter comment..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Accrual and Order Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Accrual Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newAccrual}
                    onChange={(e) => setNewAccrual(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Order Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newOrder}
                    onChange={(e) => setNewOrder(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Current Entry Info */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <h3 className="text-sm font-semibold text-gray-700">Current Entry</h3>
                <div className="text-sm text-gray-600">
                  <div>Original Payment ID: <span className="font-medium">{editingEntry?.paymentId}</span></div>
                  <div>Original Date: <span className="font-medium">{editingEntry?.date}</span></div>
                  <div>Original Accrual: <span className="font-medium">{editingEntry?.accrual.toFixed(2)}</span></div>
                  <div>Original Order: <span className="font-medium">{editingEntry?.order.toFixed(2)}</span></div>
                  <div>Original Comment: <span className="font-medium">{editingEntry?.comment || '(none)'}</span></div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end gap-3">
              <button
                onClick={handleDeleteEntry}
                disabled={isSaving || isDeleting}
                className="px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={isSaving || isDeleting}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowConfirmation(true)}
                disabled={isSaving || isDeleting || !newPaymentId}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 rounded-t-lg">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="text-2xl">⚠️</span>
                Confirm Changes
              </h2>
            </div>
            
            <div className="p-6">
              <p className="text-gray-700 mb-4 font-medium">You are about to update the following fields:</p>
              
              <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-4 space-y-3">
                {newPaymentId !== editingEntry?.paymentId && (
                  <div className="flex items-center gap-2 bg-white rounded p-3 border border-amber-200">
                    <span className="font-semibold text-gray-700 min-w-[120px]">Payment ID:</span>
                    <span className="text-red-600 line-through">{editingEntry?.paymentId}</span>
                    <span className="text-gray-400 text-xl">→</span>
                    <span className="text-green-600 font-bold">{newPaymentId}</span>
                  </div>
                )}
                {newDate !== editingEntry?.date.split('.').reverse().join('-') && (
                  <div className="flex items-center gap-2 bg-white rounded p-3 border border-amber-200">
                    <span className="font-semibold text-gray-700 min-w-[120px]">Date:</span>
                    <span className="text-red-600 line-through">{editingEntry?.date}</span>
                    <span className="text-gray-400 text-xl">→</span>
                    <span className="text-green-600 font-bold">{newDate.split('-').reverse().join('.')}</span>
                  </div>
                )}
                {parseFloat(newAccrual) !== editingEntry?.accrual && (
                  <div className="flex items-center gap-2 bg-white rounded p-3 border border-amber-200">
                    <span className="font-semibold text-gray-700 min-w-[120px]">Accrual:</span>
                    <span className="text-red-600 line-through">{editingEntry?.accrual.toFixed(2)}</span>
                    <span className="text-gray-400 text-xl">→</span>
                    <span className="text-green-600 font-bold">{parseFloat(newAccrual || '0').toFixed(2)}</span>
                  </div>
                )}
                {parseFloat(newOrder) !== editingEntry?.order && (
                  <div className="flex items-center gap-2 bg-white rounded p-3 border border-amber-200">
                    <span className="font-semibold text-gray-700 min-w-[120px]">Order:</span>
                    <span className="text-red-600 line-through">{editingEntry?.order.toFixed(2)}</span>
                    <span className="text-gray-400 text-xl">→</span>
                    <span className="text-green-600 font-bold">{parseFloat(newOrder || '0').toFixed(2)}</span>
                  </div>
                )}
                {newComment !== editingEntry?.comment && (
                  <div className="flex items-start gap-2 bg-white rounded p-3 border border-amber-200">
                    <span className="font-semibold text-gray-700 min-w-[120px]">Comment:</span>
                    <div className="flex-1 space-y-1">
                      <div className="text-red-600 line-through">{editingEntry?.comment || '(none)'}</div>
                      <span className="text-gray-400 text-xl">↓</span>
                      <div className="text-green-600 font-bold">{newComment || '(none)'}</div>
                    </div>
                  </div>
                )}
              </div>
              
              <p className="text-sm text-gray-600 mt-4 italic">
                These changes will be saved immediately and cannot be undone.
              </p>
            </div>
            
            <div className="bg-gray-50 border-t px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 font-semibold"
              >
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bank Transaction Record Dialog */}
      {isBankRecordDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Bank Transaction Record</h2>
              <button
                onClick={() => setIsBankRecordDialogOpen(false)}
                className="p-1 hover:bg-gray-100 rounded"
                disabled={loadingBankRecord}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {loadingBankRecord ? (
                <div className="flex items-center justify-center py-8">
                  <span className="text-gray-600">Loading...</span>
                </div>
              ) : viewingBankRecord ? (
                <div className="space-y-4">
                  {'id' in viewingBankRecord && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={Boolean(viewingBankRecord.parsing_lock)}
                        onCheckedChange={(checked) => updateBankRecordParsingLock(Boolean(checked))}
                        disabled={isBankLockUpdating}
                      />
                      <Label className="text-sm">Parsing lock (skip during backparse)</Label>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto border rounded p-4">
                    {Object.entries(viewingBankRecord).map(([key, value]) => (
                      <div key={key} className="grid grid-cols-2 gap-4 py-2 border-b">
                        <div className="font-medium text-sm text-gray-700">
                          {key}
                        </div>
                        <div className="text-sm break-all">
                          {value !== null && value !== undefined ? String(value) : '-'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">No data available</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ledger Record Dialog */}
      {isLedgerRecordDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Ledger Record</h2>
              <button
                onClick={() => setIsLedgerRecordDialogOpen(false)}
                className="p-1 hover:bg-gray-100 rounded"
                disabled={loadingLedgerRecord}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {loadingLedgerRecord ? (
                <div className="flex items-center justify-center py-8">
                  <span className="text-gray-600">Loading...</span>
                </div>
              ) : viewingLedgerRecord ? (
                <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto border rounded p-4">
                  {Object.entries(viewingLedgerRecord).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-2 gap-4 py-2 border-b">
                      <div className="font-medium text-sm text-gray-700">
                        {key}
                      </div>
                      <div className="text-sm break-all">
                        {value !== null && value !== undefined ? String(value) : '-'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">No data available</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Dialog */}
      {isAuditDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">{auditTitle || 'Audit Log'}</h2>
              <button
                onClick={() => setIsAuditDialogOpen(false)}
                className="p-1 hover:bg-gray-100 rounded"
                disabled={loadingAudit}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {loadingAudit ? (
                <div className="flex items-center justify-center py-8">
                  <span className="text-gray-600">Loading...</span>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No audit logs found</div>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex flex-wrap gap-4 text-sm text-gray-700">
                        <div><span className="font-semibold">Action:</span> {log.action}</div>
                        <div><span className="font-semibold">User:</span> {log.userEmail || '-'}</div>
                        <div><span className="font-semibold">At:</span> {new Date(log.createdAt).toLocaleString()}</div>
                      </div>
                      {log.changes && (
                        <pre className="mt-3 text-xs bg-white border rounded p-3 overflow-x-auto">
{JSON.stringify(log.changes, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isBankEditDialogOpen && (
        <div className="relative z-[70]">
          {bankEditLoading ? (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="bg-white rounded-lg shadow-xl px-6 py-4">
                <span className="text-gray-600">Loading...</span>
              </div>
            </div>
          ) : (
            <BankTransactionsTable
              data={bankEditData}
              renderMode="dialog-only"
              autoEditId={bankEditId ?? undefined}
              onDialogClose={() => setIsBankEditDialogOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
