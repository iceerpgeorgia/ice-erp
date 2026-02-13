'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Edit2, Plus, X, Eye, Info, User } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Combobox } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { BankTransactionsTable } from '@/components/figma/bank-transactions-table';

const formatDate = (date: string | Date): string => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
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

const displayDateToIso = (value: string): string => {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return value;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
};

type TransactionRow = {
  id: string;
  ledgerId?: number; // Add ledger ID for editing
  bankUuid?: string;
  bankId?: number;
  bankSourceId?: number;
  type: 'ledger' | 'bank';
  date: string;
  accrual: number;
  payment: number;
  order: number;
  ppc: number;
  paidPercent: number;
  due: number;
  balance: number;
  comment: string;
  user: string;
  caAccount: string;
  account: string;
  id1?: string | null;
  id2?: string | null;
  batchId?: string | null;
  createdAt: string;
};

type CounteragentStatementRow = {
  id: string;
  type: 'ledger' | 'bank';
  paymentId: string | null;
  date: string;
  dateSort: number;
  accrual: number;
  order: number;
  payment: number;
  ppc: number;
  comment: string;
  account: string;
};

type ColumnConfig = {
  key: keyof TransactionRow;
  label: string;
  visible: boolean;
  width: number;
  align?: 'left' | 'right';
};

const defaultColumns: ColumnConfig[] = [
  { key: 'date', label: 'Date', visible: true, width: 120, align: 'left' },
  { key: 'accrual', label: 'Accrual', visible: true, width: 120, align: 'right' },
  { key: 'payment', label: 'Payment', visible: true, width: 120, align: 'right' },
  { key: 'order', label: 'Order', visible: true, width: 120, align: 'right' },
  { key: 'ppc', label: 'PPC', visible: true, width: 120, align: 'right' },
  { key: 'paidPercent', label: 'Paid %', visible: true, width: 100, align: 'right' },
  { key: 'due', label: 'Due', visible: true, width: 120, align: 'right' },
  { key: 'balance', label: 'Balance', visible: true, width: 120, align: 'right' },
  { key: 'batchId', label: 'Batch ID', visible: false, width: 160, align: 'left' },
  { key: 'id1', label: 'ID1', visible: false, width: 140, align: 'left' },
  { key: 'id2', label: 'ID2', visible: false, width: 140, align: 'left' },
  { key: 'comment', label: 'Comment', visible: true, width: 300, align: 'left' },
  { key: 'user', label: 'User', visible: true, width: 180, align: 'left' },
  { key: 'caAccount', label: 'CA Account', visible: true, width: 180, align: 'left' },
  { key: 'account', label: 'Account', visible: true, width: 200, align: 'left' },
  { key: 'createdAt', label: 'Created At', visible: true, width: 180, align: 'left' },
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
  const [isCounteragentDialogOpen, setIsCounteragentDialogOpen] = useState(false);
  const [counteragentStatement, setCounteragentStatement] = useState<any>(null);
  const [counteragentLoading, setCounteragentLoading] = useState(false);
  const [counteragentError, setCounteragentError] = useState<string | null>(null);
  const [selectedBankAccrualRowIds, setSelectedBankAccrualRowIds] = useState<Set<string>>(new Set());
  const [selectedBankOrderRowIds, setSelectedBankOrderRowIds] = useState<Set<string>>(new Set());
  const [isBulkAdding, setIsBulkAdding] = useState(false);

  // Add Ledger dialog state (two-step like payments report)
  const [isAddLedgerDialogOpen, setIsAddLedgerDialogOpen] = useState(false);
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
  const [addEffectiveDate, setAddEffectiveDate] = useState('');
  const [addAccrual, setAddAccrual] = useState('');
  const [addOrder, setAddOrder] = useState('');
  const [addComment, setAddComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const financialCodeOptions = useMemo(() => {
    if (!financialCodes.length) return [];
    const byUuid = new Map(financialCodes.map((fc) => [fc.uuid, fc]));
    const parentSet = new Set(
      financialCodes.map((fc: any) => fc.parent_uuid).filter(Boolean)
    );

    const labelFor = (fc: any) => fc.validation || fc.code || fc.name || '';

    const buildPath = (fc: any) => {
      const parts: string[] = [];
      let current = fc;
      let guard = 0;
      while (current && guard < 10) {
        const label = labelFor(current);
        if (label) parts.unshift(label);
        if (!current.parent_uuid) break;
        current = byUuid.get(current.parent_uuid);
        guard += 1;
      }
      return parts.join(' / ');
    };

    return financialCodes
      .filter((fc: any) => !parentSet.has(fc.uuid))
      .map((fc: any) => ({
        value: fc.uuid,
        label: buildPath(fc),
      }));
  }, [financialCodes]);

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

  const handleExportStatementXlsx = () => {
    if (!mergedTransactions.length) return;
    setIsExporting(true);
    try {
      const visibleColumns = columns.filter((col) => col.visible);
      const rows = mergedTransactions.map((row) => {
        const record: Record<string, any> = {};
        visibleColumns.forEach((col) => {
          const rawValue = row[col.key];
          record[col.label] = rawValue ?? '';
        });
        return record;
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Statement');
      const fileName = `payment-statement-${paymentId}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } finally {
      setIsExporting(false);
    }
  };

  const openCounteragentStatement = async () => {
    const counteragentUuid = statementData?.payment?.counteragentUuid;
    if (!counteragentUuid) return;
    setIsCounteragentDialogOpen(true);
    setCounteragentLoading(true);
    setCounteragentError(null);
    setCounteragentStatement(null);
    try {
      const response = await fetch(
        `/api/counteragent-statement?counteragentUuid=${encodeURIComponent(counteragentUuid)}`
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to load counteragent statement');
      }
      const result = await response.json();
      setCounteragentStatement(result);
    } catch (error: any) {
      setCounteragentError(error.message || 'Failed to load counteragent statement');
    } finally {
      setCounteragentLoading(false);
    }
  };

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

  const refreshStatement = async () => {
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

  useEffect(() => {
    if (paymentId) {
      refreshStatement();
    }
  }, [paymentId]);

  useEffect(() => {
    if (!isAddLedgerDialogOpen) return;
    const fetchPaymentsForLedger = async () => {
      try {
        const response = await fetch('/api/payment-id-options?includeSalary=true&projectionMonths=36');
        if (!response.ok) throw new Error('Failed to fetch payments');
        const data = await response.json();
        if (Array.isArray(data)) {
          setPayments(data.map((p: any) => ({
            paymentId: p.paymentId || p.payment_id,
            counteragentName: p.counteragentName || p.counteragent_name || null,
            projectIndex: p.projectIndex || p.project_index || null,
            projectName: p.projectName || p.project_name || null,
            jobName: p.jobName || p.job_name || null,
            financialCode: p.financialCode || p.financialCodeValidation || p.financial_code || null,
            incomeTax: p.incomeTax ?? null,
            currencyCode: p.currencyCode || p.currency_code || null,
          })));
        }
      } catch (error) {
        console.error('Error fetching payments:', error);
      }
    };

    const fetchDictionaries = async () => {
      try {
        const [projectsRes, counteragentsRes, financialCodesRes, currenciesRes] = await Promise.all([
          fetch('/api/projects'),
          fetch('/api/counteragents'),
          fetch('/api/financial-codes?leafOnly=true'),
          fetch('/api/currencies'),
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

    fetchPaymentsForLedger();
    fetchDictionaries();

    if (statementData?.payment?.paymentId) {
      setSelectedPaymentId(statementData.payment.paymentId);
      setPreSelectedPaymentId(statementData.payment.paymentId);
      setAddLedgerStep('ledger');
    } else {
      setAddLedgerStep('payment');
    }
  }, [isAddLedgerDialogOpen, statementData?.payment?.paymentId]);

  useEffect(() => {
    if (!selectedProjectUuid) {
      setJobs([]);
      setSelectedJobUuid('');
      return;
    }
    const fetchJobs = async () => {
      try {
        const response = await fetch(`/api/jobs?projectUuid=${selectedProjectUuid}`);
        if (!response.ok) throw new Error('Failed to fetch jobs');
        const data = await response.json();
        setJobs(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching jobs:', error);
        setJobs([]);
      }
    };
    fetchJobs();
  }, [selectedProjectUuid]);

  // Fetch all payments for the payment ID dropdown
  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const response = await fetch('/api/payment-id-options?includeSalary=true&projectionMonths=36');
        if (!response.ok) throw new Error('Failed to fetch payments');
        const data = await response.json();
        setAllPayments(data.map((p: any) => ({
          paymentId: p.paymentId || p.payment_id,
          counteragent: p.counteragentName || p.counteragent_name || 'N/A',
          project: p.projectIndex || p.project_name || 'N/A',
          job: p.jobName || p.job_name || 'N/A',
          financialCode: p.financialCode || p.financialCodeValidation || p.financial_code || 'N/A',
          currency: p.currencyCode || p.currency_code || 'N/A',
          incomeTax: p.incomeTax ?? false
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
      ppc: 0,
      paidPercent: 0,
      due: 0,
      balance: 0,
      comment: entry.comment || '-',
      user: entry.userEmail,
      caAccount: '-',
      account: '-',
      id1: null,
      id2: null,
      batchId: null,
      createdAt: `${formatDate(entry.createdAt)} ${new Date(entry.createdAt).toLocaleTimeString()}`,
    })),
    ...statementData.bankTransactions.map((tx: any) => ({
      id: `bank-${tx.id}`,
      bankUuid: tx.uuid,
      bankId: tx.id,
      bankSourceId: tx.sourceId ?? tx.id,
      type: 'bank' as const,
      date: formatDate(tx.date),
      dateSort: new Date(tx.date).getTime(),
      accrual: 0,
      payment: tx.nominalAmount,
      order: 0,
      ppc: tx.accountCurrencyAmount,
      paidPercent: 0,
      due: 0,
      balance: 0,
      comment: tx.description || '-',
      user: '-',
      caAccount: tx.counteragentAccountNumber || '-',
      account: tx.accountLabel || '-',
      id1: tx.id1 || null,
      id2: tx.id2 || null,
      batchId: tx.batchId || null,
      createdAt: `${formatDate(tx.createdAt)} ${new Date(tx.createdAt).toLocaleTimeString()}`,
    }))
  ].sort((a, b) => a.dateSort - b.dateSort) : []; // Sort by date ascending for cumulative calculation

  // Calculate cumulative values for each row (from oldest to newest)
  if (mergedTransactions.length > 0) {
    let cumulativeAccrual = 0;
    let cumulativePaymentAbs = 0;
    let cumulativePaymentSigned = 0;
    let cumulativeOrder = 0;

    mergedTransactions.forEach(row => {
      cumulativeAccrual += row.accrual;
      const paymentForCalc = Math.abs(row.payment || 0);
      cumulativePaymentAbs += paymentForCalc;
      cumulativePaymentSigned += row.payment || 0;
      cumulativeOrder += row.order;

      // Calculate Paid % = (cumulative payment / cumulative accrual) * 100
      row.paidPercent = cumulativeAccrual !== 0 
        ? parseFloat(((cumulativePaymentSigned / cumulativeAccrual) * 100).toFixed(2))
        : 0;

      // Calculate Due = cumulative order + cumulative payment (signed)
      row.due = parseFloat((cumulativeOrder + cumulativePaymentSigned).toFixed(2));

      // Calculate Balance = cumulative accrual + cumulative payment (signed)
      row.balance = parseFloat((cumulativeAccrual + cumulativePaymentSigned).toFixed(2));
    });

    // Now reverse to show newest first in the table
    mergedTransactions.reverse();
  }

  const bankRows = mergedTransactions.filter((row) => row.type === 'bank');
  const allBankAccrualSelected =
    bankRows.length > 0 && bankRows.every((row) => selectedBankAccrualRowIds.has(row.id));
  const allBankOrderSelected =
    bankRows.length > 0 && bankRows.every((row) => selectedBankOrderRowIds.has(row.id));
  const hasBulkSelection =
    selectedBankAccrualRowIds.size > 0 || selectedBankOrderRowIds.size > 0;

  const handleToggleBankAccrualRow = (rowId: string) => {
    setSelectedBankAccrualRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const handleToggleBankOrderRow = (rowId: string) => {
    setSelectedBankOrderRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const handleToggleAllBankAccrualRows = () => {
    setSelectedBankAccrualRowIds((prev) => {
      const next = new Set(prev);
      if (allBankAccrualSelected) {
        bankRows.forEach((row) => next.delete(row.id));
      } else {
        bankRows.forEach((row) => next.add(row.id));
      }
      return next;
    });
  };

  const handleToggleAllBankOrderRows = () => {
    setSelectedBankOrderRowIds((prev) => {
      const next = new Set(prev);
      if (allBankOrderSelected) {
        bankRows.forEach((row) => next.delete(row.id));
      } else {
        bankRows.forEach((row) => next.add(row.id));
      }
      return next;
    });
  };

  const handleBulkAddAO = async () => {
    if (!statementData?.payment?.paymentId) return;
    if (!hasBulkSelection) return;

    const selectedRows = bankRows.filter(
      (row) => selectedBankAccrualRowIds.has(row.id) || selectedBankOrderRowIds.has(row.id)
    );
    if (selectedRows.length === 0) return;

    const entries = selectedRows
      .map((row) => {
        const addAccrual = selectedBankAccrualRowIds.has(row.id);
        const addOrder = selectedBankOrderRowIds.has(row.id);
        if (!addAccrual && !addOrder) return null;

        const amount = Math.abs(row.payment);
        return {
          paymentId: statementData.payment.paymentId,
          effectiveDate: displayDateToIso(row.date),
          accrual: addAccrual ? amount : null,
          order: addOrder ? amount : null,
          comment: 'Bulk A/O from payment statement',
        };
      })
      .filter(Boolean);

    setIsBulkAdding(true);
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

      setSelectedBankAccrualRowIds(new Set());
      setSelectedBankOrderRowIds(new Set());
      if (broadcastChannel) {
        broadcastChannel.postMessage({
          type: 'ledger-updated',
          paymentId: statementData.payment.paymentId,
          timestamp: Date.now(),
        });
      }
      await refreshStatement();
    } catch (error: any) {
      console.error('Error creating bulk ledger entries:', error);
      alert(error.message || 'Failed to create bulk ledger entries');
    } finally {
      setIsBulkAdding(false);
    }
  };

  const resetAddLedgerForm = () => {
    setAddLedgerStep('payment');
    setPreSelectedPaymentId(null);
    setSelectedPaymentDetails(null);
    setSelectedCounteragentUuid('');
    setSelectedProjectUuid('');
    setSelectedFinancialCodeUuid('');
    setSelectedJobUuid('');
    setSelectedCurrencyUuid('');
    setSelectedIncomeTax(false);
    setSelectedPaymentId('');
    setAddEffectiveDate('');
    setAddAccrual('');
    setAddOrder('');
    setAddComment('');
    setIsSubmitting(false);
    setIsCreatingPayment(false);
  };

  const handleOpenAddLedger = () => {
    resetAddLedgerForm();
    if (statementData?.payment?.paymentId) {
      setPreSelectedPaymentId(statementData.payment.paymentId);
      setSelectedPaymentId(statementData.payment.paymentId);
      setAddLedgerStep('ledger');
    }
    setIsAddLedgerDialogOpen(true);
  };

  const handleCloseAddLedger = () => {
    setIsAddLedgerDialogOpen(false);
    resetAddLedgerForm();
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
          currencyUuid: selectedCurrencyUuid,
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
      const project = projects.find(p => (p.projectUuid || p.project_uuid) === selectedProjectUuid);
      const job = jobs.find(j => j.jobUuid === selectedJobUuid);
      const financialCode = financialCodes.find(fc => fc.uuid === selectedFinancialCodeUuid);
      const currency = currencies.find(c => c.uuid === selectedCurrencyUuid);

      setPreSelectedPaymentId(newPaymentId);
      setSelectedPaymentId(newPaymentId);
      setSelectedPaymentDetails({
        paymentId: newPaymentId,
        counteragent: (counteragent as any)?.counteragent || (counteragent as any)?.name || 'N/A',
        project: (project as any)?.projectIndex || (project as any)?.project_index || (project as any)?.projectName || (project as any)?.project_name || 'N/A',
        job: (job as any)?.jobDisplay || (job as any)?.jobName || 'N/A',
        financialCode: financialCode?.validation || financialCode?.code || 'N/A',
        incomeTax: selectedIncomeTax,
        currency: (currency as any)?.code || 'N/A'
      });

      setPayments(prev => [{
        paymentId: newPaymentId,
        counteragentName: (counteragent as any)?.counteragent || (counteragent as any)?.name,
        projectIndex: (project as any)?.projectIndex || (project as any)?.project_index,
        projectName: (project as any)?.projectName || (project as any)?.project_name,
        jobName: (job as any)?.jobName,
        financialCode: financialCode?.validation || financialCode?.code,
        incomeTax: selectedIncomeTax,
        currencyCode: (currency as any)?.code,
      }, ...prev]);

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

  const handleSaveAddLedger = async () => {
    if (!selectedPaymentId) {
      alert('Please select a payment');
      return;
    }

    const accrualValue = addAccrual ? parseFloat(addAccrual) : null;
    const orderValue = addOrder ? parseFloat(addOrder) : null;

    if ((!accrualValue || accrualValue === 0) && (!orderValue || orderValue === 0)) {
      alert('Either Accrual or Order must be provided and cannot be zero');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/payments-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: selectedPaymentId,
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

      if (broadcastChannel) {
        broadcastChannel.postMessage({
          type: 'ledger-updated',
          paymentId: selectedPaymentId,
          timestamp: Date.now(),
        });
      }

      await refreshStatement();
      handleCloseAddLedger();
    } catch (error: any) {
      console.error('Error adding ledger entry:', error);
      alert(error.message || 'Failed to add ledger entry');
    } finally {
      setIsSubmitting(false);
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

  const openBankEditDialog = async (bankId: number) => {
    setIsBankEditDialogOpen(true);
    setBankEditLoading(true);
    setBankEditId(bankId);
    setBankEditData([]);
    try {
      const response = await fetch(`/api/bank-transactions?ids=${bankId}`);
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
        batchId: row.batch_id || row.batchId || null,
        nominalCurrencyCode: row.nominal_currency_code || row.nominalCurrencyCode || null,
      }));
      setBankEditData(mapped);
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

  useEffect(() => {
    if (!selectedPaymentId) return;
    const payment = payments.find(p => p.paymentId === selectedPaymentId);
    if (payment) {
      setSelectedPaymentDetails({
        paymentId: payment.paymentId,
        counteragent: payment.counteragentName || 'N/A',
        project: payment.projectIndex || payment.projectName || 'N/A',
        job: payment.jobName || 'N/A',
        financialCode: payment.financialCode || 'N/A',
        incomeTax: payment.incomeTax || false,
        currency: payment.currencyCode || 'N/A'
      });
    }
  }, [selectedPaymentId, payments]);


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

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full">
        <div className="space-y-6">
          {/* Header */}
          <div className="border-b pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold">Payment Statement</h1>
                <p className="text-gray-600 mt-1">Payment ID: {statementData.payment.paymentId}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportStatementXlsx}
                  disabled={isExporting || !mergedTransactions.length}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExporting ? 'Exporting...' : 'Export XLSX'}
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Print Statement
                </button>
              </div>
            </div>
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
                  ({mergedTransactions.length} {mergedTransactions.length === 1 ? 'entry' : 'entries'})
                </span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkAddAO}
                  disabled={!hasBulkSelection || isBulkAdding}
                  className={`px-3 py-2 rounded border transition-colors ${
                    !hasBulkSelection || isBulkAdding
                      ? 'border-gray-300 text-gray-400 cursor-not-allowed'
                      : 'border-emerald-500 text-emerald-700 hover:bg-emerald-50'
                  }`}
                  title={hasBulkSelection ? 'Add accruals/orders for selected bank rows' : 'Select bank rows (A/O) first'}
                >
                  {isBulkAdding ? 'Adding...' : '+A&O'}
                </button>
                <button
                  onClick={handleOpenAddLedger}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Ledger Entry
                </button>
              </div>
            </div>
            {mergedTransactions.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                    <thead className="bg-gray-100 sticky top-0 z-10">
                      <tr>
                        <th
                          className="px-2 py-3 font-semibold text-center bg-red-50 text-red-700 sticky top-0 z-10"
                          style={{ width: '48px' }}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs font-semibold">A</span>
                            <Checkbox
                              checked={allBankAccrualSelected}
                              onCheckedChange={handleToggleAllBankAccrualRows}
                              className="data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600 text-red-700"
                            />
                          </div>
                        </th>
                        <th
                          className="px-2 py-3 font-semibold text-center bg-yellow-50 text-yellow-700 sticky top-0 z-10"
                          style={{ width: '48px' }}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs font-semibold">O</span>
                            <Checkbox
                              checked={allBankOrderSelected}
                              onCheckedChange={handleToggleAllBankOrderRows}
                              className="data-[state=checked]:bg-yellow-600 data-[state=checked]:border-yellow-600 text-yellow-700"
                            />
                          </div>
                        </th>
                        {columns.filter(col => col.visible).map((column) => (
                          <th
                            key={column.key}
                            draggable
                            onDragStart={(e) => handleDragStart(e, column.key)}
                            onDragOver={(e) => handleDragOver(e, column.key)}
                            onDrop={(e) => handleDrop(e, column.key)}
                            className={`px-4 py-3 font-semibold relative cursor-move select-none sticky top-0 z-10 bg-gray-100 ${
                              column.align === 'right' ? 'text-right' : 'text-left'
                            } ${dragOverColumn === column.key ? 'bg-blue-100' : ''}`}
                            style={{
                              width: `${column.width}px`,
                              minWidth: `${column.width}px`,
                              maxWidth: `${column.width}px`,
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className={column.align === 'right' ? 'ml-auto' : ''}>{column.label}</span>
                              <div
                                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-10"
                                onMouseDown={(e) => handleResizeStart(e, column.key)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </th>
                        ))}
                        <th className="px-4 py-3 font-semibold text-left sticky top-0 z-10 bg-gray-100" style={{ width: '70px' }}>
                          View
                        </th>
                        <th className="px-4 py-3 font-semibold text-left sticky top-0 z-10 bg-gray-100" style={{ width: '70px' }}>
                          Logs
                        </th>
                        <th className="px-4 py-3 font-semibold text-left sticky top-0 z-10 bg-gray-100" style={{ width: '90px' }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {mergedTransactions.map((row, index) => (
                        <tr key={row.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-2 py-3 text-center" style={{ width: '48px' }}>
                            <Checkbox
                              checked={row.type === 'bank' && selectedBankAccrualRowIds.has(row.id)}
                              disabled={row.type !== 'bank'}
                              onCheckedChange={() => row.type === 'bank' && handleToggleBankAccrualRow(row.id)}
                              className="data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600 text-red-700"
                            />
                          </td>
                          <td className="px-2 py-3 text-center" style={{ width: '48px' }}>
                            <Checkbox
                              checked={row.type === 'bank' && selectedBankOrderRowIds.has(row.id)}
                              disabled={row.type !== 'bank'}
                              onCheckedChange={() => row.type === 'bank' && handleToggleBankOrderRow(row.id)}
                              className="data-[state=checked]:bg-yellow-600 data-[state=checked]:border-yellow-600 text-yellow-700"
                            />
                          </td>
                          {columns.filter(col => col.visible).map((column) => {
                            let displayValue = row[column.key];
                            
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
                            {row.type === 'bank' && row.bankSourceId && (
                              <button
                                onClick={() => viewBankAuditLog(row.bankSourceId as number)}
                                className="p-1 hover:bg-gray-200 rounded"
                                title="View bank audit log"
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
                            {row.type === 'bank' && row.bankId && (
                              <button
                                onClick={() => openBankEditDialog(row.bankId as number)}
                                className="p-1 hover:bg-gray-200 rounded"
                                title="Edit bank transaction"
                              >
                                <Edit2 className="h-4 w-4 text-blue-600" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      
                      {/* Totals Row */}
                      <tr className="bg-blue-50 font-bold border-t-2 border-blue-300">
                        <td className="px-2 py-3" style={{ width: '48px' }}></td>
                        <td className="px-2 py-3" style={{ width: '48px' }}></td>
                        {columns.filter(col => col.visible).map((column) => {
                          let totalValue: string | number = '';
                          
                          if (column.key === 'date') {
                            totalValue = 'TOTAL';
                          } else if (column.key === 'accrual') {
                            const total = mergedTransactions.reduce((sum, row) => sum + row.accrual, 0);
                            totalValue = total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          } else if (column.key === 'order') {
                            const total = mergedTransactions.reduce((sum, row) => sum + row.order, 0);
                            totalValue = total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          } else if (column.key === 'payment') {
                            const total = mergedTransactions.reduce((sum, row) => sum + row.payment, 0);
                            totalValue = total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          } else if (column.key === 'ppc') {
                            const total = mergedTransactions.reduce((sum, row) => sum + row.ppc, 0);
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

          {/* Print & Export Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={handleExportStatementXlsx}
              disabled={isExporting || !mergedTransactions.length}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? 'Exporting...' : 'Export XLSX'}
            </button>
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
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {addLedgerStep === 'payment' ? 'Add Payment' : 'Add Ledger Entry'}
              </h2>
              <button
                onClick={handleCloseAddLedger}
                className="p-1 hover:bg-gray-100 rounded"
                disabled={isSubmitting || isCreatingPayment}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
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
                          const labelBase = ca.counteragent || ca.name || '';
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
                      options={financialCodeOptions}
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
                        label: c.code || c.name
                      }))}
                      placeholder="Select currency..."
                      searchPlaceholder="Search currencies..."
                      disabled={!selectedFinancialCodeUuid}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Project</Label>
                    <Combobox
                      value={selectedProjectUuid}
                      onValueChange={setSelectedProjectUuid}
                      options={projects.map(p => ({
                        value: p.projectUuid || p.project_uuid || '',
                        label: p.projectIndex || p.project_index || p.projectName || p.project_name || 'N/A'
                      }))}
                      placeholder="Select project..."
                      searchPlaceholder="Search projects..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Job</Label>
                    <Combobox
                      value={selectedJobUuid}
                      onValueChange={setSelectedJobUuid}
                      options={jobs.map(j => ({
                        value: j.jobUuid,
                        label: j.jobDisplay || j.jobName
                      }))}
                      placeholder="Select job..."
                      searchPlaceholder="Search jobs..."
                      disabled={!selectedProjectUuid}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Income Tax</Label>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={selectedIncomeTax} onCheckedChange={(v) => setSelectedIncomeTax(Boolean(v))} />
                      <span className="text-sm text-gray-700">Apply income tax</span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      onClick={handleSkipToLedger}
                      className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Skip to ledger
                    </button>
                    <button
                      onClick={handleCreatePayment}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      disabled={isCreatingPayment}
                    >
                      {isCreatingPayment ? 'Creating...' : 'Create payment'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Payment ID <span className="text-red-500">*</span></Label>
                    <Combobox
                      value={selectedPaymentId}
                      onValueChange={(value) => {
                        setSelectedPaymentId(value);
                        const payment = payments.find(p => p.paymentId === value);
                        if (payment) {
                          setSelectedPaymentDetails({
                            paymentId: payment.paymentId,
                            counteragent: payment.counteragentName || 'N/A',
                            project: payment.projectIndex || payment.projectName || 'N/A',
                            job: payment.jobName || 'N/A',
                            financialCode: payment.financialCode || 'N/A',
                            incomeTax: payment.incomeTax || false,
                            currency: payment.currencyCode || 'N/A'
                          });
                        }
                      }}
                      options={payments.map(p => ({
                        value: p.paymentId,
                        label: [p.paymentId, p.counteragentName, p.projectIndex, p.projectName, p.jobName, p.financialCode, p.currencyCode]
                          .filter(Boolean)
                          .join(' | '),
                      }))}
                      placeholder="Select payment..."
                      searchPlaceholder="Search payment ID, project, job..."
                    />
                  </div>

                  {selectedPaymentDetails && (
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-700">Payment Details</h3>
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
                  )}

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
                      onClick={() => setAddLedgerStep('payment')}
                      className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleSaveAddLedger}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Saving...' : 'Add Entry'}
                    </button>
                  </div>
                </>
              )}
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

      {/* Counteragent Statement Dialog */}
      {isCounteragentDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                Counteragent Statement
              </h2>
              <button
                onClick={() => setIsCounteragentDialogOpen(false)}
                className="p-1 hover:bg-gray-100 rounded"
                disabled={counteragentLoading}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {counteragentLoading ? (
                <div className="flex items-center justify-center py-8">
                  <span className="text-gray-600">Loading...</span>
                </div>
              ) : counteragentError ? (
                <div className="text-red-600">{counteragentError}</div>
              ) : counteragentStatement ? (
                (() => {
                  const rows: CounteragentStatementRow[] = [
                    ...(counteragentStatement.ledgerEntries || []).map((entry: any) => ({
                      id: `ledger-${entry.id}`,
                      type: 'ledger' as const,
                      paymentId: entry.paymentId,
                      date: formatDate(entry.effectiveDate),
                      dateSort: new Date(entry.effectiveDate).getTime(),
                      accrual: entry.accrual,
                      order: entry.order,
                      payment: 0,
                      ppc: 0,
                      comment: entry.comment || '-',
                      account: '-',
                    })),
                    ...(counteragentStatement.bankTransactions || []).map((tx: any) => ({
                      id: `bank-${tx.id}`,
                      type: 'bank' as const,
                      paymentId: tx.paymentId || null,
                      date: formatDate(tx.date),
                      dateSort: new Date(tx.date).getTime(),
                      accrual: 0,
                      order: 0,
                      payment: Math.abs(tx.nominalAmount),
                      ppc: Math.abs(tx.accountCurrencyAmount),
                      comment: tx.description || '-',
                      account: tx.accountLabel || '-',
                    })),
                  ].sort((a, b) => a.dateSort - b.dateSort);

                  return (
                    <div className="space-y-4">
                      <div className="text-sm text-gray-600">
                        {counteragentStatement.counteragent?.counteragent_name || statementData?.payment?.counteragent || '-'}
                      </div>
                      <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 font-semibold text-left">Date</th>
                              <th className="px-4 py-3 font-semibold text-left">Type</th>
                              <th className="px-4 py-3 font-semibold text-left">Payment ID</th>
                              <th className="px-4 py-3 font-semibold text-right">Accrual</th>
                              <th className="px-4 py-3 font-semibold text-right">Order</th>
                              <th className="px-4 py-3 font-semibold text-right">Payment</th>
                              <th className="px-4 py-3 font-semibold text-right">PPC</th>
                              <th className="px-4 py-3 font-semibold text-left">Account</th>
                              <th className="px-4 py-3 font-semibold text-left">Comment</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.length === 0 ? (
                              <tr>
                                <td colSpan={9} className="text-center py-6 text-gray-500">
                                  No data found
                                </td>
                              </tr>
                            ) : (
                              rows.map((row) => (
                                <tr key={row.id} className="border-b">
                                  <td className="px-4 py-2 text-sm">{row.date}</td>
                                  <td className="px-4 py-2 text-sm">{row.type}</td>
                                  <td className="px-4 py-2 text-sm">{row.paymentId || '-'}</td>
                                  <td className="px-4 py-2 text-sm text-right">{row.accrual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  <td className="px-4 py-2 text-sm text-right">{row.order.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  <td className="px-4 py-2 text-sm text-right">{row.payment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  <td className="px-4 py-2 text-sm text-right">{row.ppc.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  <td className="px-4 py-2 text-sm">{row.account}</td>
                                  <td className="px-4 py-2 text-sm">{row.comment}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()
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
