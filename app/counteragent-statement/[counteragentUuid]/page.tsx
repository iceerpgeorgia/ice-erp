'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { useParams } from 'next/navigation';
import { Edit2, Eye, Filter, Plus, Search, Settings } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Checkbox } from '../../../components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../components/ui/dialog';
import { BankTransactionsTable } from '../../../components/figma/bank-transactions-table';
import type { BankTransaction } from '../../../components/figma/bank-transactions-table';
import { Combobox } from '../../../components/ui/combobox';
import { Label } from '../../../components/ui/label';

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

const toISO = (d: Date | null): string => (d ? d.toISOString() : '');

const toInputDate = (val: any): string => {
  const date = toValidDate(val);
  return date ? date.toISOString().split('T')[0] : '';
};

type StatementRow = {
  id: string;
  type: 'ledger' | 'bank';
  paymentId: string | null;
  date: string;
  dateSort: number;
  ledgerId?: number;
  bankId?: number;
  bankSourceId?: number;
  bankUuid?: string;
  effectiveDateRaw?: string | null;
  project: string | null;
  financialCode: string | null;
  job: string | null;
  incomeTax: boolean | null;
  currency: string | null;
  accrual: number;
  order: number;
  payment: number;
  ppc: number;
  account: string;
  comment: string;
  id1?: string | null;
  id2?: string | null;
  batchId?: string | null;
};

type ColumnKey = keyof StatementRow;

type ColumnConfig = {
  key: ColumnKey;
  label: string;
  visible: boolean;
  sortable: boolean;
  filterable: boolean;
  width: number;
  align?: 'left' | 'right';
};

const defaultColumns: ColumnConfig[] = [
  { key: 'date', label: 'Date', visible: true, sortable: true, filterable: true, width: 120, align: 'left' },
  { key: 'type', label: 'Type', visible: true, sortable: true, filterable: true, width: 100, align: 'left' },
  { key: 'paymentId', label: 'Payment ID', visible: true, sortable: true, filterable: true, width: 160, align: 'left' },
  { key: 'project', label: 'Project', visible: true, sortable: true, filterable: true, width: 200, align: 'left' },
  { key: 'financialCode', label: 'Fin. Code', visible: true, sortable: true, filterable: true, width: 180, align: 'left' },
  { key: 'job', label: 'Job', visible: true, sortable: true, filterable: true, width: 160, align: 'left' },
  { key: 'incomeTax', label: 'Income Tax', visible: true, sortable: true, filterable: true, width: 120, align: 'left' },
  { key: 'currency', label: 'Currency', visible: true, sortable: true, filterable: true, width: 110, align: 'left' },
  { key: 'accrual', label: 'Accrual', visible: true, sortable: true, filterable: true, width: 120, align: 'right' },
  { key: 'order', label: 'Order', visible: true, sortable: true, filterable: true, width: 120, align: 'right' },
  { key: 'payment', label: 'Payment', visible: true, sortable: true, filterable: true, width: 120, align: 'right' },
  { key: 'ppc', label: 'PPC', visible: true, sortable: true, filterable: true, width: 120, align: 'right' },
  { key: 'batchId', label: 'Batch ID', visible: false, sortable: true, filterable: true, width: 160, align: 'left' },
  { key: 'id1', label: 'ID1', visible: false, sortable: true, filterable: true, width: 140, align: 'left' },
  { key: 'id2', label: 'ID2', visible: false, sortable: true, filterable: true, width: 140, align: 'left' },
  { key: 'account', label: 'Account', visible: true, sortable: true, filterable: true, width: 220, align: 'left' },
  { key: 'comment', label: 'Comment', visible: true, sortable: true, filterable: true, width: 320, align: 'left' },
];

export default function CounteragentStatementPage() {
  const params = useParams();
  const counteragentUuid = params.counteragentUuid as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statement, setStatement] = useState<any>(null);
  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);
  const [filters, setFilters] = useState<Map<ColumnKey, Set<any>>>(new Map());
  const [sortColumn, setSortColumn] = useState<ColumnKey>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isResizing, setIsResizing] = useState<{ column: ColumnKey; startX: number; startWidth: number; element: HTMLElement } | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLedgerEditOpen, setIsLedgerEditOpen] = useState(false);
  const [isLedgerSaving, setIsLedgerSaving] = useState(false);
  const [editingLedgerId, setEditingLedgerId] = useState<number | null>(null);
  const [editPaymentId, setEditPaymentId] = useState('');
  const [editEffectiveDate, setEditEffectiveDate] = useState('');
  const [editAccrual, setEditAccrual] = useState('');
  const [editOrder, setEditOrder] = useState('');
  const [editComment, setEditComment] = useState('');
  const [isBankEditDialogOpen, setIsBankEditDialogOpen] = useState(false);
  const [bankEditData, setBankEditData] = useState<any[]>([]);
  const [bankEditId, setBankEditId] = useState<number | null>(null);
  const [bankEditLoading, setBankEditLoading] = useState(false);
  const [isLedgerViewOpen, setIsLedgerViewOpen] = useState(false);
  const [isBankViewOpen, setIsBankViewOpen] = useState(false);
  const [loadingLedgerView, setLoadingLedgerView] = useState(false);
  const [loadingBankView, setLoadingBankView] = useState(false);
  const [ledgerViewRecord, setLedgerViewRecord] = useState<any | null>(null);
  const [bankViewRecord, setBankViewRecord] = useState<any | null>(null);
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

  const getPaymentInfo = useCallback(
    (paymentId: string | null) => {
      if (!paymentId) {
        return {
          project: null,
          financialCode: null,
          job: null,
          incomeTax: null,
          currency: null,
        };
      }

      const payment = payments.find((p) => p.paymentId === paymentId);
      if (!payment) {
        return {
          project: null,
          financialCode: null,
          job: null,
          incomeTax: null,
          currency: null,
        };
      }

      return {
        project: payment.projectIndex || payment.projectName || null,
        financialCode: payment.financialCode || null,
        job: payment.jobName || null,
        incomeTax: payment.incomeTax ?? null,
        currency: payment.currencyCode || null,
      };
    },
    [payments]
  );

  const handleBankTransactionUpdated = useCallback(
    (transaction: BankTransaction) => {
      setBankEditData((prev) =>
        prev.map((row) =>
          row.id === transaction.id
            ? {
                ...row,
                paymentId: transaction.paymentId || null,
                projectUuid: transaction.projectUuid || null,
                financialCodeUuid: transaction.financialCodeUuid || null,
                nominalCurrencyUuid: transaction.nominalCurrencyUuid || null,
                accountCurrencyUuid: transaction.accountCurrencyUuid || row.accountCurrencyUuid,
                accountCurrencyCode: transaction.accountCurrencyCode || row.accountCurrencyCode,
                accountCurrencyAmount: transaction.accountCurrencyAmount ?? row.accountCurrencyAmount,
                nominalAmount: transaction.nominalAmount ?? row.nominalAmount,
                correctionDate: transaction.correctionDate || null,
                parsingLock: transaction.parsingLock ?? row.parsingLock,
                projectIndex: transaction.projectIndex || row.projectIndex,
                financialCode: transaction.financialCode || row.financialCode,
                nominalCurrencyCode: transaction.nominalCurrencyCode || row.nominalCurrencyCode,
                accountNumber: transaction.accountNumber || row.accountNumber,
                bankName: transaction.bankName || row.bankName,
                description: transaction.description ?? row.description,
                updatedAt: transaction.updatedAt || row.updatedAt,
              }
            : row
        )
      );

      setStatement((prev: any) => {
        if (!prev) return prev;
        const info = getPaymentInfo(transaction.paymentId || null);
        const nextBankTransactions = (prev.bankTransactions || []).map((tx: any) => {
          if (Number(tx.id) !== transaction.id) return tx;
          const accountLabel =
            `${transaction.accountNumber || ''} ${transaction.accountCurrencyCode || ''}`.trim() ||
            tx.accountLabel ||
            '-';
          return {
            ...tx,
            paymentId: transaction.paymentId || null,
            accountCurrencyAmount:
              transaction.accountCurrencyAmount != null
                ? Number(transaction.accountCurrencyAmount)
                : tx.accountCurrencyAmount,
            nominalAmount:
              transaction.nominalAmount != null
                ? Number(transaction.nominalAmount)
                : tx.nominalAmount,
            date: transaction.date || tx.date,
            description: transaction.description ?? tx.description,
            counteragentAccountNumber:
              transaction.counteragentAccountNumber ?? tx.counteragentAccountNumber,
            accountLabel,
            project: info.project,
            financialCode: info.financialCode,
            job: info.job,
            incomeTax: info.incomeTax,
            currency: info.currency,
          };
        });
        const nextPaymentIds = transaction.paymentId
          ? prev.paymentIds?.includes(transaction.paymentId)
            ? prev.paymentIds
            : [...(prev.paymentIds || []), transaction.paymentId]
          : prev.paymentIds;
        return {
          ...prev,
          bankTransactions: nextBankTransactions,
          paymentIds: nextPaymentIds,
        };
      });
    },
    [getPaymentInfo]
  );

  useEffect(() => {
    const saved = localStorage.getItem('counteragentStatementColumns');
    if (saved) {
      try {
        const savedColumns = JSON.parse(saved) as ColumnConfig[];
        const defaultColumnsMap = new Map(defaultColumns.map((col) => [col.key, col]));
        const validSavedColumns = savedColumns.filter((savedCol) => defaultColumnsMap.has(savedCol.key));
        const updatedSavedColumns = validSavedColumns.map((savedCol) => {
          const defaultCol = defaultColumnsMap.get(savedCol.key);
          if (!defaultCol) return savedCol;
          return {
            ...defaultCol,
            visible: savedCol.visible,
            width: savedCol.width,
          };
        });
        const savedKeys = new Set(validSavedColumns.map((col) => col.key));
        const newColumns = defaultColumns.filter((col) => !savedKeys.has(col.key));
        if (updatedSavedColumns.length > 0) {
          setColumns([...updatedSavedColumns, ...newColumns]);
        }
      } catch {
        // ignore
      }
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('counteragentStatementColumns', JSON.stringify(columns));
    }
  }, [columns, isInitialized]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const deltaX = e.clientX - isResizing.startX;
        const newWidth = Math.max(20, isResizing.startWidth + deltaX);
        isResizing.element.style.width = `${newWidth}px`;
        isResizing.element.style.minWidth = `${newWidth}px`;
        isResizing.element.style.maxWidth = `${newWidth}px`;
      }
    };

    const handleMouseUp = () => {
      if (isResizing) {
        const finalWidth = parseInt(isResizing.element.style.width);
        setColumns((prev) =>
          prev.map((col) =>
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
    const fetchPayments = async () => {
      try {
        const response = await fetch('/api/payment-id-options?includeSalary=true&projectionMonths=36');
        if (!response.ok) throw new Error('Failed to fetch payments');
        const data = await response.json();
        if (!Array.isArray(data)) {
          setPayments([]);
          return;
        }
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
      } catch (error) {
        console.error('Error fetching payments:', error);
      }
    };

    fetchPayments();
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

  const fetchStatement = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/counteragent-statement?counteragentUuid=${encodeURIComponent(counteragentUuid)}`
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load counteragent statement');
      }
      const result = await response.json();
      setStatement(result);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load counteragent statement');
    } finally {
      setLoading(false);
    }
  }, [counteragentUuid]);

  useEffect(() => {
    if (counteragentUuid) {
      fetchStatement();
    }
  }, [counteragentUuid, fetchStatement]);

  const rows: StatementRow[] = useMemo(() => {
    if (!statement) return [];
    return [
      ...(statement.ledgerEntries || []).map((entry: any) => ({
        id: `ledger-${entry.id}`,
        type: 'ledger' as const,
        paymentId: entry.paymentId,
        date: formatDate(entry.effectiveDate),
        dateSort: new Date(entry.effectiveDate).getTime(),
        ledgerId: entry.id,
        effectiveDateRaw: entry.effectiveDate,
        project: entry.project || null,
        financialCode: entry.financialCode || null,
        job: entry.job || null,
        incomeTax: entry.incomeTax ?? null,
        currency: entry.currency || null,
        accrual: entry.accrual,
        order: entry.order,
        payment: 0,
        ppc: 0,
        account: '-',
        comment: entry.comment || '-',
        id1: null,
        id2: null,
        batchId: null,
      })),
      ...(statement.bankTransactions || []).map((tx: any) => ({
        id: `bank-${tx.id}`,
        type: 'bank' as const,
        paymentId: tx.paymentId || null,
        date: formatDate(tx.date),
        dateSort: new Date(tx.date).getTime(),
        bankId: tx.id,
        bankSourceId: tx.sourceId ?? tx.id,
        bankUuid: tx.uuid,
        project: tx.project || null,
        financialCode: tx.financialCode || null,
        job: tx.job || null,
        incomeTax: tx.incomeTax ?? null,
        currency: tx.currency || null,
        accrual: 0,
        order: 0,
        payment: tx.nominalAmount,
        ppc: tx.accountCurrencyAmount,
        account: tx.accountLabel || '-',
        comment: tx.description || '-',
        id1: tx.id1 || null,
        id2: tx.id2 || null,
        batchId: tx.batchId || null,
      })),
    ].sort((a, b) => a.dateSort - b.dateSort);
  }, [statement]);

  const columnValues = useMemo(() => {
    const valuesMap = new Map<ColumnKey, any[]>();
    columns.forEach((col) => {
      const values = Array.from(
        new Set(rows.map((row) => (row[col.key] ?? '-')))
      );
      valuesMap.set(col.key, values);
    });
    return valuesMap;
  }, [rows, columns]);

  const filteredRows = useMemo(() => {
    let filtered = [...rows];
    filters.forEach((selectedValues, columnKey) => {
      if (selectedValues.size === 0) return;
      filtered = filtered.filter((row) => {
        const value = row[columnKey] ?? '-';
        return selectedValues.has(value);
      });
    });

    const sortValue = (row: StatementRow) => {
      if (sortColumn === 'date') return row.dateSort;
      const value = row[sortColumn];
      if (typeof value === 'number') return value;
      if (typeof value === 'boolean') return value ? 1 : 0;
      return String(value ?? '').toLowerCase();
    };

    filtered.sort((a, b) => {
      const aVal = sortValue(a);
      const bVal = sortValue(b);
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [rows, filters, sortColumn, sortDirection]);

  const filteredTotals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.accrual += Number(row.accrual || 0);
        acc.order += Number(row.order || 0);
        acc.payment += Number(row.payment || 0);
        acc.ppc += Number(row.ppc || 0);
        return acc;
      },
      { accrual: 0, order: 0, payment: 0, ppc: 0 }
    );
  }, [filteredRows]);

  const handleExportXlsx = () => {
    if (!filteredRows.length) return;
    const visibleColumns = columns.filter((col) => col.visible);
    const rows = filteredRows.map((row) => {
      const record: Record<string, any> = {};
      visibleColumns.forEach((col) => {
        let value: any = row[col.key];
        if (col.key === 'incomeTax') {
          value = value === null || value === undefined ? '' : value ? 'Yes' : 'No';
        }
        if (col.key === 'accrual' || col.key === 'order' || col.key === 'payment' || col.key === 'ppc') {
          if (value === 0 || value === null || value === undefined) {
            value = '';
          } else {
            value = Number(value).toFixed(2);
          }
        }
        record[col.label] = value ?? '';
      });
      return record;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Counteragent Statement');
    const fileName = `counteragent-statement-${counteragentUuid}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const handleToggleColumn = (key: ColumnKey) => {
    setColumns((prev) =>
      prev.map((col) => (col.key === key ? { ...col, visible: !col.visible } : col))
    );
  };

  const handleFilterChange = (columnKey: ColumnKey, selectedValues: Set<any>) => {
    setFilters((prev) => {
      const updated = new Map(prev);
      updated.set(columnKey, selectedValues);
      return updated;
    });
  };

  const handleResizeStart = (e: React.MouseEvent, columnKey: ColumnKey) => {
    e.preventDefault();
    const element = (e.currentTarget as HTMLElement).parentElement as HTMLElement;
    setIsResizing({
      column: columnKey,
      startX: e.clientX,
      startWidth: element.offsetWidth,
      element,
    });
  };

  const renderFilterValue = (value: any) => {
    if (value === null || value === undefined || value === '-') return '';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  };

  const handleAddEntry = async () => {
    if (isSubmitting) return;

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

      const created = await response.json();
      const createdEntry = Array.isArray(created) ? created[0] : null;

      if (createdEntry) {
        const info = getPaymentInfo(createdEntry.payment_id || createdEntry.paymentId || selectedPaymentId);
        setStatement((prev: any) => {
          if (!prev) return prev;
          const nextEntries = [
            ...((prev.ledgerEntries as any[]) || []),
            {
              id: Number(createdEntry.id),
              paymentId: createdEntry.payment_id || createdEntry.paymentId || selectedPaymentId,
              effectiveDate: createdEntry.effective_date || createdEntry.effectiveDate || effectiveDate,
              accrual: createdEntry.accrual ? Number(createdEntry.accrual) : accrualValue || 0,
              order: createdEntry.order ? Number(createdEntry.order) : orderValue || 0,
              comment: createdEntry.comment ?? comment ?? null,
              userEmail: createdEntry.user_email || createdEntry.userEmail || null,
              createdAt: createdEntry.created_at || createdEntry.createdAt || null,
              project: info.project,
              financialCode: info.financialCode,
              job: info.job,
              incomeTax: info.incomeTax,
              currency: info.currency,
            },
          ];
          const nextPaymentIds = prev.paymentIds?.includes(selectedPaymentId)
            ? prev.paymentIds
            : [...(prev.paymentIds || []), selectedPaymentId];
          return {
            ...prev,
            paymentIds: nextPaymentIds,
            ledgerEntries: nextEntries,
          };
        });
      }

      setIsDialogOpen(false);
      resetForm();
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
          currencyUuid: selectedCurrencyUuid,
        }),
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

      const counteragent = counteragents.find(
        (ca) => (ca.counteragent_uuid || ca.counteragentUuid) === selectedCounteragentUuid
      );
      const project = projects.find((p) => p.projectUuid === selectedProjectUuid);
      const job = jobs.find((j) => j.jobUuid === selectedJobUuid);
      const financialCode = financialCodes.find((fc) => fc.uuid === selectedFinancialCodeUuid);
      const currency = currencies.find((c) => c.uuid === selectedCurrencyUuid);

      setPreSelectedPaymentId(newPaymentId);
      setSelectedPaymentId(newPaymentId);
      setSelectedPaymentDetails({
        paymentId: newPaymentId,
        counteragent: counteragent?.name || 'N/A',
        project: project?.projectIndex || project?.projectName || 'N/A',
        job: job?.jobDisplay || job?.jobName || 'N/A',
        financialCode: financialCode?.validation || financialCode?.code || 'N/A',
        incomeTax: selectedIncomeTax,
        currency: currency?.code || 'N/A',
      });

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

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      resetForm();
    } else {
      setAddLedgerStep('payment');
      setSelectedCounteragentUuid(counteragentUuid || '');
    }
  };

  const openLedgerEditDialog = (row: StatementRow) => {
    if (!row.ledgerId) return;
    setEditingLedgerId(row.ledgerId);
    setEditPaymentId(row.paymentId || '');
    const fallbackDate = row.effectiveDateRaw ?? (row.dateSort ? new Date(row.dateSort) : null);
    setEditEffectiveDate(toInputDate(fallbackDate));
    setEditAccrual(row.accrual ? String(row.accrual) : '');
    setEditOrder(row.order ? String(row.order) : '');
    setEditComment(row.comment || '');
    setIsLedgerEditOpen(true);
  };

  const saveLedgerEdit = async () => {
    if (!editingLedgerId) return;
    setIsLedgerSaving(true);
    try {
      const response = await fetch(`/api/payments-ledger/${editingLedgerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: editPaymentId,
          effectiveDate: editEffectiveDate,
          accrual: editAccrual ? Number(editAccrual) : 0,
          order: editOrder ? Number(editOrder) : 0,
          comment: editComment || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update ledger entry');
      }

      const info = getPaymentInfo(editPaymentId || null);
      setStatement((prev: any) => {
        if (!prev) return prev;
        const nextEntries = ((prev.ledgerEntries as any[]) || []).map((entry) => {
          if (Number(entry.id) !== editingLedgerId) return entry;
          return {
            ...entry,
            paymentId: editPaymentId,
            effectiveDate: editEffectiveDate,
            accrual: editAccrual ? Number(editAccrual) : 0,
            order: editOrder ? Number(editOrder) : 0,
            comment: editComment || null,
            project: info.project,
            financialCode: info.financialCode,
            job: info.job,
            incomeTax: info.incomeTax,
            currency: info.currency,
          };
        });
        const nextPaymentIds = prev.paymentIds?.includes(editPaymentId)
          ? prev.paymentIds
          : [...(prev.paymentIds || []), editPaymentId];
        return {
          ...prev,
          paymentIds: nextPaymentIds,
          ledgerEntries: nextEntries,
        };
      });

      setIsLedgerEditOpen(false);
      setEditingLedgerId(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update ledger entry');
    } finally {
      setIsLedgerSaving(false);
    }
  };

  const openBankEditDialog = async (bankId?: number | null) => {
    if (!bankId) return;
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
    } catch (err: any) {
      alert(err.message || 'Failed to fetch bank transaction');
      setIsBankEditDialogOpen(false);
    } finally {
      setBankEditLoading(false);
    }
  };

  const viewLedgerRecord = async (ledgerId?: number) => {
    if (!ledgerId) return;
    setLoadingLedgerView(true);
    setLedgerViewRecord(null);
    setIsLedgerViewOpen(true);
    try {
      const response = await fetch(`/api/payments-ledger/${ledgerId}`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to fetch ledger record');
      }
      const result = await response.json();
      setLedgerViewRecord(result);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch ledger record');
      setIsLedgerViewOpen(false);
    } finally {
      setLoadingLedgerView(false);
    }
  };

  const viewBankRecord = async (bankUuid?: string) => {
    if (!bankUuid) return;
    setLoadingBankView(true);
    setBankViewRecord(null);
    setIsBankViewOpen(true);
    try {
      const response = await fetch(`/api/bank-transactions/raw-record/${bankUuid}`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to fetch bank record');
      }
      const result = await response.json();
      setBankViewRecord(result);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch bank record');
      setIsBankViewOpen(false);
    } finally {
      setLoadingBankView(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading counteragent statement...</div>
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

  if (!statement) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">No data available</div>
      </div>
    );
  }

  const counteragentName = statement.counteragent?.counteragent_name || '-';

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full space-y-6">
        <div className="border-b pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Counteragent Statement</h1>
            <p className="text-gray-600 mt-1">{counteragentName}</p>
          </div>
          <div className="flex items-center gap-2">
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
                              if (!search) return 1;
                              try {
                                const regex = new RegExp(search, 'i');
                                return regex.test(value) ? 1 : 0;
                              } catch {
                                return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                              }
                            }}
                            options={payments.map(p => {
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
                              let value = e.target.value.replace(/[^\d.]/g, '');
                              if (value.length === 2 && !value.includes('.')) {
                                value = value + '.';
                              } else if (value.length === 5 && value.split('.').length === 2) {
                                value = value + '.';
                              }
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

            <Button variant="outline" size="sm" onClick={handleExportXlsx} disabled={!filteredRows.length}>
              Export XLSX
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
                  {columns.map((col) => (
                    <div key={col.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={`column-${col.key}`}
                        checked={col.visible}
                        onCheckedChange={() => handleToggleColumn(col.key)}
                      />
                      <label htmlFor={`column-${col.key}`} className="text-sm cursor-pointer">
                        {col.label}
                      </label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-white px-4 py-2 text-sm text-gray-700">
          <span className="font-semibold">Subtotal (filtered)</span>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Accrual:</span>
            <span className="font-semibold text-gray-900">
              {filteredTotals.accrual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Order:</span>
            <span className="font-semibold text-gray-900">
              {filteredTotals.order.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Payment:</span>
            <span className="font-semibold text-gray-900">
              {filteredTotals.payment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">PPC:</span>
            <span className="font-semibold text-gray-900">
              {filteredTotals.ppc.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  {columns.filter((col) => col.visible).map((col) => (
                    <th
                      key={col.key}
                      className={`px-4 py-3 font-semibold ${col.align === 'right' ? 'text-right' : 'text-left'} group sticky top-0 z-10 bg-gray-50`}
                      style={{ width: col.width, minWidth: col.width, maxWidth: col.width }}
                    >
                      <div className="flex items-center gap-1">
                        <span>{col.label}</span>
                        {col.filterable ? (
                          <FilterPopover
                            columnKey={col.key}
                            columnLabel={col.label}
                            values={columnValues.get(col.key) || []}
                            activeFilters={filters.get(col.key) || new Set()}
                            onFilterChange={(values) => handleFilterChange(col.key, values)}
                            onSort={(direction) => {
                              setSortColumn(col.key);
                              setSortDirection(direction);
                            }}
                            renderValue={renderFilterValue}
                          />
                        ) : null}
                      </div>
                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 group-hover:opacity-100"
                        onMouseDown={(e) => handleResizeStart(e, col.key)}
                      />
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold text-left sticky top-0 z-10 bg-gray-50" style={{ width: 70 }}>
                    View
                  </th>
                  <th className="px-4 py-3 font-semibold text-left sticky top-0 z-10 bg-gray-50" style={{ width: 70 }}>
                    Edit
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.filter((col) => col.visible).length + 2} className="text-center py-6 text-gray-500">
                      No data found
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.id} className="border-b">
                      {columns.filter((col) => col.visible).map((col) => {
                        const value = row[col.key];
                        const displayValue = (() => {
                          if (col.key === 'incomeTax') {
                            return value === null || value === undefined ? '' : value ? 'Yes' : 'No';
                          }
                          if (col.key === 'accrual' || col.key === 'order' || col.key === 'payment' || col.key === 'ppc') {
                            if (value === 0 || value === null || value === undefined) return '';
                            return typeof value === 'number'
                              ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              : '';
                          }
                          return value ?? '';
                        })();

                        return (
                          <td
                            key={col.key}
                            className={`px-4 py-2 text-sm ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                            style={{ width: col.width, minWidth: col.width, maxWidth: col.width }}
                          >
                            {displayValue}
                          </td>
                        );
                      })}
                      <td className="px-4 py-2 text-sm">
                        {row.type === 'ledger' && row.ledgerId ? (
                          <button
                            onClick={() => viewLedgerRecord(row.ledgerId)}
                            className="p-1 hover:bg-gray-200 rounded"
                            title="View ledger record"
                          >
                            <Eye className="h-4 w-4 text-gray-700" />
                          </button>
                        ) : null}
                        {row.type === 'bank' && row.bankUuid ? (
                          <button
                            onClick={() => viewBankRecord(row.bankUuid)}
                            className="p-1 hover:bg-gray-200 rounded"
                            title="View bank transaction"
                          >
                            <Eye className="h-4 w-4 text-gray-700" />
                          </button>
                        ) : null}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {row.type === 'ledger' && row.ledgerId ? (
                          <button
                            onClick={() => openLedgerEditDialog(row)}
                            className="p-1 hover:bg-gray-200 rounded"
                            title="Edit ledger entry"
                          >
                            <Edit2 className="h-4 w-4 text-blue-600" />
                          </button>
                        ) : null}
                        {row.type === 'bank' && row.bankId ? (
                          <button
                            onClick={() => openBankEditDialog(row.bankId)}
                            className="p-1 hover:bg-gray-200 rounded"
                            title="Edit bank transaction"
                          >
                            <Edit2 className="h-4 w-4 text-blue-600" />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={isLedgerEditOpen} onOpenChange={setIsLedgerEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Ledger Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Payment ID</label>
              <Input
                value={editPaymentId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditPaymentId(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Effective Date</label>
              <Input
                type="date"
                value={editEffectiveDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditEffectiveDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Accrual</label>
                <Input
                  value={editAccrual}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditAccrual(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Order</label>
                <Input
                  value={editOrder}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditOrder(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Comment</label>
              <Input
                value={editComment}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditComment(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsLedgerEditOpen(false)}
              disabled={isLedgerSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={saveLedgerEdit}
              disabled={isLedgerSaving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLedgerSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isLedgerViewOpen} onOpenChange={setIsLedgerViewOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Ledger Base Record</DialogTitle>
          </DialogHeader>
          {loadingLedgerView ? (
            <div className="py-6 text-center text-gray-600">Loading...</div>
          ) : ledgerViewRecord ? (
            <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto border rounded p-4">
              {Object.entries(ledgerViewRecord).map(([key, value]) => (
                <div key={key} className="grid grid-cols-2 gap-4 py-2 border-b">
                  <div className="font-medium text-sm text-gray-700">{key}</div>
                  <div className="text-sm break-all">
                    {value !== null && value !== undefined ? String(value) : '-'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-gray-500">No data available</div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isBankViewOpen} onOpenChange={setIsBankViewOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Bank Base Record</DialogTitle>
          </DialogHeader>
          {loadingBankView ? (
            <div className="py-6 text-center text-gray-600">Loading...</div>
          ) : bankViewRecord ? (
            <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto border rounded p-4">
              {Object.entries(bankViewRecord).map(([key, value]) => (
                <div key={key} className="grid grid-cols-2 gap-4 py-2 border-b">
                  <div className="font-medium text-sm text-gray-700">{key}</div>
                  <div className="text-sm break-all">
                    {value !== null && value !== undefined ? String(value) : '-'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-gray-500">No data available</div>
          )}
        </DialogContent>
      </Dialog>

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
              onTransactionUpdated={handleBankTransactionUpdated}
            />
          )}
        </div>
      )}
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
  renderValue,
}: {
  columnKey: string;
  columnLabel: string;
  values: any[];
  activeFilters: Set<any>;
  onFilterChange: (values: Set<any>) => void;
  onSort: (direction: 'asc' | 'desc') => void;
  renderValue: (value: any) => string;
}) {
  const [open, setOpen] = useState(false);
  const [tempSelected, setTempSelected] = useState<Set<any>>(new Set(activeFilters));
  const [filterSearchTerm, setFilterSearchTerm] = useState('');

  const filteredValues = useMemo(() => {
    if (!filterSearchTerm) return values;
    return values.filter((value) =>
      String(value).toLowerCase().includes(filterSearchTerm.toLowerCase())
    );
  }, [values, filterSearchTerm]);

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

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setTempSelected(new Set(activeFilters));
      setFilterSearchTerm('');
    }
  };

  const handleApply = () => {
    onFilterChange(tempSelected);
    setOpen(false);
  };

  const handleCancel = () => {
    setTempSelected(new Set(activeFilters));
    setOpen(false);
  };

  const handleClearAll = () => {
    setTempSelected(new Set());
  };

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
          <div className="flex items-center justify-between border-b pb-2">
            <div className="font-medium text-sm">{columnLabel}</div>
            <div className="text-xs text-muted-foreground">
              Displaying {filteredValues.length}
            </div>
          </div>

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

          <div className="border-t pt-3">
            <div className="font-medium text-sm mb-2">Filter by values</div>
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

            <div className="relative mb-3">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Search values..."
                value={filterSearchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterSearchTerm(e.target.value)}
                className="pl-7 h-8 text-sm"
              />
            </div>

            <div className="space-y-1 max-h-48 overflow-auto border rounded p-2">
              {sortedFilteredValues.length === 0 ? (
                <div className="text-xs text-muted-foreground py-2 text-center">
                  No values found
                </div>
              ) : (
                sortedFilteredValues.map((value) => (
                  <div key={String(value)} className="flex items-center space-x-2 py-1">
                    <Checkbox
                      id={`${columnKey}-${value}`}
                      checked={tempSelected.has(value)}
                      onCheckedChange={() => handleToggle(value)}
                    />
                    <label htmlFor={`${columnKey}-${value}`} className="text-sm flex-1 cursor-pointer">
                      {renderValue(value)}
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>

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
