'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Save, 
  X,
  FileText,
  Search,
  Filter,
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Combobox } from '../ui/combobox';
import { Badge } from './ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import * as XLSX from 'xlsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

type SalaryAccrual = {
  id: string;
  uuid: string;
  counteragent_uuid: string;
  counteragent_name: string;
  identification_number?: string | null;
  sex?: string | null;
  pension_scheme?: boolean | null;
  financial_code_uuid: string;
  financial_code: string;
  nominal_currency_uuid: string;
  currency_code: string;
  counteragent_iban?: string | null;
  payment_id: string;
  salary_month: string;
  net_sum: string;
  surplus_insurance: string | null;
  deducted_insurance: string | null;
  deducted_fitness: string | null;
  deducted_fine: string | null;
  created_at: string;
  updated_at: string;
  paid?: number; // Calculated from bank transactions
  month_balance?: number; // computed month balance
};

type ColumnKey = keyof SalaryAccrual;

type ColumnConfig = {
  key: ColumnKey;
  label: string;
  visible: boolean;
  sortable: boolean;
  filterable: boolean;
  format?: 'currency' | 'date' | 'text';
  width: number;
};

type Employee = {
  value: string;
  label: string;
};

type FinancialCode = {
  value: string;
  label: string;
};

type Currency = {
  value: string;
  label: string;
};

const defaultColumns: ColumnConfig[] = [
  { key: 'counteragent_name', label: 'Employee', visible: true, sortable: true, filterable: true, width: 200 },
  { key: 'sex', label: 'Sex', visible: true, sortable: true, filterable: true, width: 90 },
  { key: 'pension_scheme', label: 'Pension Scheme', visible: true, sortable: true, filterable: true, width: 140 },
  { key: 'payment_id', label: 'Payment ID', visible: true, sortable: true, filterable: true, width: 200 },
  { key: 'financial_code', label: 'Financial Code', visible: true, sortable: true, filterable: true, width: 200 },
  { key: 'salary_month', label: 'Month', visible: true, sortable: true, filterable: true, format: 'date', width: 120 },
  { key: 'net_sum', label: 'Net Sum', visible: true, sortable: true, filterable: true, format: 'currency', width: 130 },
  { key: 'paid', label: 'Paid', visible: true, sortable: true, filterable: true, format: 'currency', width: 130 },
  { key: 'month_balance', label: 'Month Balance', visible: true, sortable: true, filterable: true, format: 'currency', width: 150 },
  { key: 'currency_code', label: 'Currency', visible: true, sortable: true, filterable: true, width: 100 },
  { key: 'surplus_insurance', label: 'Surplus Insurance', visible: true, sortable: true, filterable: true, format: 'currency', width: 150 },
  { key: 'deducted_insurance', label: 'Ded. Insurance', visible: true, sortable: true, filterable: true, format: 'currency', width: 150 },
  { key: 'deducted_fitness', label: 'Ded. Fitness', visible: true, sortable: true, filterable: true, format: 'currency', width: 130 },
  { key: 'deducted_fine', label: 'Ded. Fine', visible: true, sortable: true, filterable: true, format: 'currency', width: 130 },
];

export function SalaryAccrualsTable() {
  const [data, setData] = useState<SalaryAccrual[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Table state
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<ColumnKey>('salary_month');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);
  const [filters, setFilters] = useState<Map<string, Set<any>>>(new Map());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [isResizing, setIsResizing] = useState<{ column: ColumnKey; startX: number; startWidth: number; element: HTMLElement } | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [projectedMonths, setProjectedMonths] = useState(0);
  const [latestBaseMonthLabel, setLatestBaseMonthLabel] = useState<string | null>(null);
  const [latestBaseMonthDate, setLatestBaseMonthDate] = useState<Date | null>(null);
  const [latestBaseRecords, setLatestBaseRecords] = useState<SalaryAccrual[]>([]);
  const [isCopyingLatest, setIsCopyingLatest] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadMonth, setUploadMonth] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<any | null>(null);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Form states
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [financialCodes, setFinancialCodes] = useState<FinancialCode[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedFinancialCode, setSelectedFinancialCode] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [salaryMonth, setSalaryMonth] = useState('');
  const [netSum, setNetSum] = useState('');
  const [surplusInsurance, setSurplusInsurance] = useState('');
  const [deductedInsurance, setDeductedInsurance] = useState('');
  const [deductedFitness, setDeductedFitness] = useState('');
  const [deductedFine, setDeductedFine] = useState('');

  // Load saved column configuration after hydration
  useEffect(() => {
    const saved = localStorage.getItem('salaryAccrualsColumns');
    const savedProjectedMonths = localStorage.getItem('salaryAccrualsProjectedMonths');
    if (saved) {
      try {
        const savedColumns = JSON.parse(saved) as ColumnConfig[];
        const defaultColumnsMap = new Map(defaultColumns.map(col => [col.key, col]));
        const validSavedColumns = savedColumns.filter(savedCol => defaultColumnsMap.has(savedCol.key));
        
        const updatedSavedColumns = validSavedColumns.map(savedCol => {
          const defaultCol = defaultColumnsMap.get(savedCol.key);
          if (defaultCol) {
            return {
              ...defaultCol,
              visible: savedCol.visible,
              width: savedCol.width
            };
          }
          return savedCol;
        });
        
        const savedKeys = new Set(validSavedColumns.map(col => col.key));
        const newColumns = defaultColumns.filter(col => !savedKeys.has(col.key));
        
        setColumns([...updatedSavedColumns, ...newColumns]);
      } catch (e) {
        console.error('Failed to parse saved columns:', e);
        setColumns(defaultColumns);
      }
    }

    if (savedProjectedMonths) {
      const parsed = parseInt(savedProjectedMonths, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        setProjectedMonths(parsed);
      }
    }
    
    setIsInitialized(true);
  }, []);

  // Fetch data after initialization
  useEffect(() => {
    if (isInitialized) {
      fetchEmployees();
      fetchFinancialCodes();
      fetchCurrencies();
    }
  }, [isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      fetchData();
    }
  }, [isInitialized, projectedMonths]);

  // Save column configuration to localStorage
  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
      localStorage.setItem('salaryAccrualsColumns', JSON.stringify(columns));
    }
  }, [columns, isInitialized]);

  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
      localStorage.setItem('salaryAccrualsProjectedMonths', String(projectedMonths));
    }
  }, [projectedMonths, isInitialized]);

  const parseSalaryMonth = (value: string): Date | null => {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(`${value}T00:00:00`);
    }
    if (/^\d{4}-\d{2}$/.test(value)) {
      return new Date(`${value}-01T00:00:00`);
    }
    if (/^\d{2}\/\d{4}$/.test(value)) {
      const [mm, yyyy] = value.split('/');
      return new Date(`${yyyy}-${mm}-01T00:00:00`);
    }
    if (/^\d{2}\.\d{4}$/.test(value)) {
      const [mm, yyyy] = value.split('.');
      return new Date(`${yyyy}-${mm}-01T00:00:00`);
    }
    const dotMatch = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (dotMatch) {
      const [_, dd, mm, yyyy] = dotMatch;
      return new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    }
    const monthNameMatch = value.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i);
    if (monthNameMatch) {
      const monthMap = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 } as const;
      const mm = monthMap[monthNameMatch[1].toLowerCase() as keyof typeof monthMap];
      const yyyy = monthNameMatch[2];
      return new Date(`${yyyy}-${String(mm).padStart(2, '0')}-01T00:00:00`);
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
    return null;
  };

  const formatSalaryMonth = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}-01`;
  };

  const updatePaymentIdForMonth = (paymentId: string, date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    if (/_PRL\d{2}\d{4}$/i.test(paymentId)) {
      return paymentId.replace(/_PRL\d{2}\d{4}$/i, `_PRL${mm}${yyyy}`);
    }
    if (paymentId.length >= 20) {
      return `${paymentId}_PRL${mm}${yyyy}`;
    }
    return paymentId;
  };

  const handleCopyLatestMonth = async () => {
    if (!latestBaseMonthDate || latestBaseRecords.length === 0) return;

    const nextDate = new Date(latestBaseMonthDate.getFullYear(), latestBaseMonthDate.getMonth() + 1, 1);
    const nextLabel = nextDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    const currentLabel = latestBaseMonthDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

    const confirmed = window.confirm(`Do you want to copy ${currentLabel} to ${nextLabel}?`);
    if (!confirmed) return;

    setIsCopyingLatest(true);
    try {
      const response = await fetch('/api/salary-accruals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'copy-latest',
          base_month: formatSalaryMonth(latestBaseMonthDate),
          target_month: formatSalaryMonth(nextDate),
          created_by: 'user',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to copy salary accruals');
      }
      const result = await response.json();
      if (Array.isArray(result.records)) {
        setData((prev) => [...result.records, ...prev]);
      }
    } catch (error: any) {
      alert(error.message || 'Failed to copy salary accruals');
    } finally {
      setIsCopyingLatest(false);
    }
  };

  const handleUploadTbcInsurance = async (action: 'preview' | 'apply') => {
    if (!uploadMonth || !uploadFile) {
      alert('Please select a month and choose an XLSX file.');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('month', uploadMonth);
      formData.append('action', action);
      formData.append('file', uploadFile);

      const response = await fetch('/api/salary-accruals/upload-tbc-insurance', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload insurance data');
      }

      setUploadSummary(result);
      setIsSummaryOpen(true);
      if (action === 'apply') {
        const updates = Array.isArray(result.updated_details) ? result.updated_details : [];
        if (updates.length > 0) {
          const updateMap = new Map<string, any>(
            updates.map((item: any) => [item.counteragent_uuid, item])
          );
          const targetMonth = uploadMonth;
          setData((prev) =>
            prev.map((row) => {
              const rowDate = parseSalaryMonth(row.salary_month);
              const matchesMonth =
                rowDate &&
                rowDate.getFullYear() === Number(targetMonth.split('-')[0]) &&
                rowDate.getMonth() + 1 === Number(targetMonth.split('-')[1]);
              if (!matchesMonth) return row;
              const update = updateMap.get(row.counteragent_uuid) as any;
              if (!update) return row;
              const updatedRow = {
                ...row,
                surplus_insurance: String(update.surplus_insurance ?? row.surplus_insurance ?? '0'),
                deducted_insurance: String(update.deducted_insurance ?? row.deducted_insurance ?? '0'),
              } as SalaryAccrual;
              return {
                ...updatedRow,
                month_balance: computeBalance(updatedRow),
              };
            })
          );
        }
        setIsUploadDialogOpen(false);
        setUploadFile(null);
      }
    } catch (error: any) {
      alert(error.message || 'Failed to upload insurance data');
    } finally {
      setIsUploading(false);
    }
  };

  const handleApplyTbcInsurance = async () => {
    await handleUploadTbcInsurance('apply');
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = (ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = ids.length > 0 && ids.every((id) => next.has(id));
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const sanitizeRecipientName = (name: string) => {
    return name
      .replace(/\s*\(\s*ს\.კ\.[^)]*\)\s*/g, ' ')
      .replace(/\s*-\s*ფიზ\.\s*პირი\s*/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  const handleDownloadBankXlsx = () => {
    const selectedRecords = data.filter((row) => selectedIds.has(row.id));
    if (selectedRecords.length === 0) {
      alert('No records selected');
      return;
    }

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

    const rows = selectedRecords.map((record) => [
      'GE78BG0000000893486000',
      record.counteragent_iban || '',
      '',
      '',
      sanitizeRecipientName(record.counteragent_name || ''),
      record.identification_number || '',
      'ხელფასი',
      computeBalance(record),
      '',
      '',
      record.payment_id || '',
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, 'Bank XLSX.xlsx');
  };

  // Column resize handlers
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

  const normalizePaymentId = (value: any) =>
    String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

  const computeBalance = (row: SalaryAccrual) => {
    const netSum = parseFloat(row.net_sum || '0');
    const deductedInsurance = parseFloat(row.deducted_insurance || '0') || 0;
    const deductedFitness = parseFloat(row.deducted_fitness || '0') || 0;
    const deductedFine = parseFloat(row.deducted_fine || '0') || 0;
    const paid = typeof row.paid === 'number' ? row.paid : parseFloat((row.paid as any) || '0') || 0;
    const pensionMultiplier = row.pension_scheme ? 0.98 : 1;
    return netSum * pensionMultiplier - paid - deductedInsurance - deductedFitness - deductedFine;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch salary accruals
      const response = await fetch('/api/salary-accruals');
      if (!response.ok) throw new Error('Failed to fetch data');
      const salaryData = await response.json();
      if (!Array.isArray(salaryData)) {
        console.warn('[Salary Accruals] Expected array, received:', salaryData);
        setData([]);
        return;
      }
      
      // Fetch bank transactions to calculate paid amounts
      const txResponse = await fetch('/api/bank-transactions?limit=0');
      const txResult = await txResponse.json();
      const transactions = Array.isArray(txResult.data)
        ? txResult.data
        : Array.isArray(txResult)
          ? txResult
          : [];
      
      // Create a map of payment_id to total paid amount (absolute value)
      // Use lowercase keys for case-insensitive matching
      const paidMap = new Map<string, number>();
      transactions.forEach((tx: any) => {
        const paymentId = tx.payment_id || tx.paymentId;
        if (paymentId) {
          const paymentIdLower = normalizePaymentId(paymentId);
          const rawAmount =
            tx.account_currency_amount ??
            tx.accountCurrencyAmount ??
            tx.nominal_amount ??
            tx.nominalAmount ??
            '0';
          const amount = Math.abs(parseFloat(rawAmount || '0'));
          paidMap.set(paymentIdLower, (paidMap.get(paymentIdLower) || 0) + amount);
        }
      });
      

      let projectedData: SalaryAccrual[] = salaryData;
      if (projectedMonths > 0 && salaryData.length > 0) {
        const parsedDates: { item: SalaryAccrual; date: Date }[] = salaryData
          .map((item: SalaryAccrual) => ({ item, date: parseSalaryMonth(item.salary_month) }))
          .filter((entry: { item: SalaryAccrual; date: Date | null }): entry is { item: SalaryAccrual; date: Date } => Boolean(entry.date));

        if (parsedDates.length > 0) {
          const latestDate = parsedDates.reduce((max: Date, cur: { item: SalaryAccrual; date: Date }) => (cur.date > max ? cur.date : max), parsedDates[0].date);
          const latestMonthKey = `${latestDate.getFullYear()}-${latestDate.getMonth()}`;
          const latestRecords = parsedDates
            .filter((entry: { item: SalaryAccrual; date: Date }) => `${entry.date.getFullYear()}-${entry.date.getMonth()}` === latestMonthKey)
            .map((entry: { item: SalaryAccrual; date: Date }) => entry.item);

          setLatestBaseMonthDate(latestDate);
          setLatestBaseRecords(latestRecords);
          setLatestBaseMonthLabel(
            latestDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
          );

          const futureRecords: SalaryAccrual[] = [];
          for (let i = 1; i <= projectedMonths; i++) {
            const futureDate = new Date(latestDate.getFullYear(), latestDate.getMonth() + i, 1);
            const futureMonth = formatSalaryMonth(futureDate);
            latestRecords.forEach((record: SalaryAccrual, idx: number) => {
              const basePaymentId = record.payment_id || '';
              const projectedPaymentId = basePaymentId ? updatePaymentIdForMonth(basePaymentId, futureDate) : basePaymentId;
              futureRecords.push({
                ...record,
                id: `projected-${record.id}-${i}-${idx}`,
                uuid: `projected-${record.uuid}-${i}-${idx}`,
                salary_month: futureMonth,
                payment_id: projectedPaymentId,
                surplus_insurance: null,
                deducted_insurance: null,
                deducted_fitness: null,
                deducted_fine: null,
              });
            });
          }

          projectedData = [...salaryData, ...futureRecords];
        }
      }

      if (salaryData.length > 0 && latestBaseMonthDate === null) {
        const parsedDates = salaryData
          .map((item: SalaryAccrual) => ({ item, date: parseSalaryMonth(item.salary_month) }))
          .filter((entry: { item: SalaryAccrual; date: Date | null }): entry is { item: SalaryAccrual; date: Date } => Boolean(entry.date));
        if (parsedDates.length > 0) {
          const latestDate = parsedDates.reduce((max: Date, cur: { item: SalaryAccrual; date: Date }) => (cur.date > max ? cur.date : max), parsedDates[0].date);
          const latestMonthKey = `${latestDate.getFullYear()}-${latestDate.getMonth()}`;
          const latestRecords = parsedDates
            .filter((entry: { item: SalaryAccrual; date: Date }) => `${entry.date.getFullYear()}-${entry.date.getMonth()}` === latestMonthKey)
            .map((entry: { item: SalaryAccrual; date: Date }) => entry.item);
          setLatestBaseMonthDate(latestDate);
          setLatestBaseRecords(latestRecords);
          setLatestBaseMonthLabel(
            latestDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
          );
        }
      }

      // Calculate paid and month_balance for each salary accrual
      const enrichedData = projectedData.map((accrual: SalaryAccrual) => {
        const paymentIdLower = accrual.payment_id ? normalizePaymentId(accrual.payment_id) : '';
        const paid = typeof accrual.paid === 'number'
          ? accrual.paid
          : (paidMap.get(paymentIdLower) || 0);
        const monthBalance = computeBalance(accrual);

        return {
          ...accrual,
          paid,
          month_balance: monthBalance
        };
      });
      
      setData(enrichedData);
    } catch (error) {
      console.error('Error fetching salary accruals:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/counteragents?is_emploee=true');
      if (!response.ok) throw new Error('Failed to fetch employees');
      const result = await response.json();
      setEmployees(
        result.map((emp: any) => ({
          value: emp.counteragent_uuid,
          label: emp.counteragent || emp.name,
        }))
      );
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchFinancialCodes = async () => {
    try {
      const response = await fetch('/api/financial-codes?isIncome=false&leafOnly=true');
      if (!response.ok) throw new Error('Failed to fetch financial codes');
      const result = await response.json();
      setFinancialCodes(
        result.map((fc: any) => ({
          value: fc.uuid,
          label: fc.validation || fc.name,
        }))
      );
    } catch (error) {
      console.error('Error fetching financial codes:', error);
    }
  };

  const fetchCurrencies = async () => {
    try {
      const response = await fetch('/api/currencies');
      if (!response.ok) throw new Error('Failed to fetch currencies');
      const result = await response.json();
      setCurrencies(
        result.data.map((cur: any) => ({
          value: cur.uuid,
          label: cur.currencyCode,
        }))
      );
    } catch (error) {
      console.error('Error fetching currencies:', error);
    }
  };

  const resetForm = () => {
    setSelectedEmployee('');
    setSelectedFinancialCode('');
    setSelectedCurrency('');
    setSalaryMonth('');
    setNetSum('');
    setSurplusInsurance('');
    setDeductedInsurance('');
    setDeductedFitness('');
    setDeductedFine('');
    setEditingId(null);
  };

  const handleOpenDialog = (accrual?: SalaryAccrual) => {
    if (accrual) {
      setEditingId(accrual.id);
      setSelectedEmployee(accrual.counteragent_uuid);
      setSelectedFinancialCode(accrual.financial_code_uuid);
      setSelectedCurrency(accrual.nominal_currency_uuid);
      setSalaryMonth(accrual.salary_month.split('T')[0]);
      setNetSum(accrual.net_sum);
      setSurplusInsurance(accrual.surplus_insurance || '');
      setDeductedInsurance(accrual.deducted_insurance || '');
      setDeductedFitness(accrual.deducted_fitness || '');
      setDeductedFine(accrual.deducted_fine || '');
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedEmployee || !selectedFinancialCode || !selectedCurrency || !salaryMonth || !netSum) {
      alert('Please fill in all required fields');
      return;
    }

    const payload = {
      counteragent_uuid: selectedEmployee,
      financial_code_uuid: selectedFinancialCode,
      nominal_currency_uuid: selectedCurrency,
      salary_month: salaryMonth,
      net_sum: netSum,
      surplus_insurance: surplusInsurance || null,
      deducted_insurance: deductedInsurance || null,
      deducted_fitness: deductedFitness || null,
      deducted_fine: deductedFine || null,
      created_by: 'user',
      updated_by: 'user',
    };

    try {
      const url = '/api/salary-accruals';
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId ? { ...payload, id: editingId } : payload;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to save');
      }

      const existing = data.find((row) => row.id === editingId);
      const employeeLabel = employees.find((emp) => emp.value === selectedEmployee)?.label;
      const financialLabel = financialCodes.find((code) => code.value === selectedFinancialCode)?.label;
      const currencyLabel = currencies.find((cur) => cur.value === selectedCurrency)?.label;

      const updatedRow: SalaryAccrual = {
        ...(existing || ({} as SalaryAccrual)),
        ...result,
        id: result.id?.toString?.() || editingId || result.id,
        counteragent_uuid: selectedEmployee,
        financial_code_uuid: selectedFinancialCode,
        nominal_currency_uuid: selectedCurrency,
        counteragent_name: employeeLabel || existing?.counteragent_name || 'Unknown',
        identification_number: existing?.identification_number || result.identification_number || null,
        financial_code: financialLabel || existing?.financial_code || 'Unknown',
        currency_code: currencyLabel || existing?.currency_code || 'Unknown',
        sex: existing?.sex ?? null,
        pension_scheme: existing?.pension_scheme ?? null,
        salary_month: result.salary_month || salaryMonth,
        net_sum: result.net_sum?.toString?.() || netSum,
        surplus_insurance: result.surplus_insurance ?? (surplusInsurance ? surplusInsurance : null),
        deducted_insurance: result.deducted_insurance ?? (deductedInsurance ? deductedInsurance : null),
        deducted_fitness: result.deducted_fitness ?? (deductedFitness ? deductedFitness : null),
        deducted_fine: result.deducted_fine ?? (deductedFine ? deductedFine : null),
        payment_id: result.payment_id || existing?.payment_id || '',
        created_at: result.created_at || existing?.created_at || new Date().toISOString(),
        updated_at: result.updated_at || new Date().toISOString(),
        paid: existing?.paid || 0,
        month_balance: 0,
      };

      updatedRow.month_balance = computeBalance(updatedRow);

      setData((prev) => {
        if (editingId) {
          return prev.map((row) => (row.id === editingId ? updatedRow : row));
        }
        return [updatedRow, ...prev];
      });

      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Error saving salary accrual:', error);
      alert(error.message || 'Failed to save salary accrual');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this accrual?')) return;

    try {
      const response = await fetch(`/api/salary-accruals?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete');
      }

      setData((prev) => prev.filter((row) => row.id !== id));
    } catch (error: any) {
      console.error('Error deleting salary accrual:', error);
      alert(error.message || 'Failed to delete salary accrual');
    }
  };

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

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Apply search
    if (searchTerm) {
      result = result.filter(row =>
        Object.values(row).some(val =>
          String(val).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply filters
    if (filters.size > 0) {
      result = result.filter(row => {
        for (const [columnKey, allowedValues] of filters.entries()) {
          const rowValue = columnKey === 'month_balance'
            ? computeBalance(row)
            : row[columnKey as ColumnKey];
          if (!allowedValues.has(rowValue)) {
            return false;
          }
        }
        return true;
      });
    }

    // Apply sort
    result.sort((a, b) => {
      const aVal = sortColumn === 'month_balance' ? computeBalance(a) : a[sortColumn];
      const bVal = sortColumn === 'month_balance' ? computeBalance(b) : b[sortColumn];
      
      if (aVal === bVal) return 0;
      
      // Special handling for date columns
      const columnConfig = columns.find(col => col.key === sortColumn);
      if (columnConfig?.format === 'date') {
        const aDate = aVal ? new Date(aVal as string).getTime() : 0;
        const bDate = bVal ? new Date(bVal as string).getTime() : 0;
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
  }, [data, searchTerm, sortColumn, sortDirection, filters, columns]);

  // Paginate data
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

  // Memoize unique values
  const uniqueValuesCache = useMemo(() => {
    const cache = new Map<ColumnKey, any[]>();
    const filterableColumns = columns.filter(col => col.filterable);
    
    filterableColumns.forEach(col => {
      const values = new Set(
        data.map(row => col.key === 'month_balance' ? computeBalance(row) : row[col.key])
      );
      cache.set(col.key, Array.from(values).sort());
    });
    
    return cache;
  }, [data, columns]);

  const formatMonthLabel = (value: any) => {
    const date = parseSalaryMonth(String(value));
    if (date) {
      return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    }
    return String(value);
  };

  const getUniqueValues = useCallback((columnKey: ColumnKey): any[] => {
    const values = uniqueValuesCache.get(columnKey) || [];
    if (columnKey === 'salary_month') {
      return values.map(value => ({ value, label: formatMonthLabel(value) }));
    }
    return values;
  }, [uniqueValuesCache]);

  const formatValue = (value: any, format?: 'currency' | 'date' | 'text') => {
    if (value === null || value === undefined) return '-';
    
    if (format === 'date') {
      if (!value) return '-';
      const date = new Date(value);
      return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short' });
    }
    
    if (format === 'currency') {
      const numValue = typeof value === 'number' ? value : parseFloat(value as string);
      if (isNaN(numValue)) return '-';
      return numValue.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    
    return String(value);
  };

  const visibleColumns = columns.filter(col => col.visible);
  const activeFilterCount = filters.size;
  const filteredIds = filteredAndSortedData.map((row) => row.id);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));

  // Calculate totals
  const totals = useMemo(() => {
    return filteredAndSortedData.reduce((acc, row) => ({
      net_sum: acc.net_sum + (parseFloat(row.net_sum) || 0),
      paid: acc.paid + (row.paid || 0),
      month_balance: acc.month_balance + computeBalance(row),
      surplus_insurance: acc.surplus_insurance + (parseFloat(row.surplus_insurance || '0') || 0),
      deducted_insurance: acc.deducted_insurance + (parseFloat(row.deducted_insurance || '0') || 0),
      total_insurance: acc.total_insurance +
        (parseFloat(row.surplus_insurance || '0') || 0) +
        (parseFloat(row.deducted_insurance || '0') || 0),
      deducted_fitness: acc.deducted_fitness + (parseFloat(row.deducted_fitness || '0') || 0),
      deducted_fine: acc.deducted_fine + (parseFloat(row.deducted_fine || '0') || 0),
    }), { 
      net_sum: 0,
      paid: 0,
      month_balance: 0,
      surplus_insurance: 0, 
      deducted_insurance: 0,
      total_insurance: 0,
      deducted_fitness: 0, 
      deducted_fine: 0 
    });
  }, [filteredAndSortedData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg">Loading salary accruals...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-20 flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Salary Accruals</h1>
            <Badge variant="secondary">
              {filteredAndSortedData.length} records
            </Badge>
            <Badge variant="outline">
              Total: {data.length}
            </Badge>
            {latestBaseMonthLabel && (
              <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm">
                <span className="text-gray-600">Latest:</span>
                <span className="font-medium text-gray-900">{latestBaseMonthLabel}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={handleCopyLatestMonth}
                  disabled={isCopyingLatest}
                >
                  +
                </Button>
              </div>
            )}
            {totalPages > 1 && (
              <span className="text-sm text-gray-500">
                Page {currentPage} of {totalPages}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1">
              <Label htmlFor="projectedMonths" className="text-xs text-gray-600">
                Projected Months
              </Label>
              <Input
                id="projectedMonths"
                type="number"
                min={0}
                step={1}
                value={projectedMonths}
                onChange={(e) => {
                  const nextValue = Math.max(0, parseInt(e.target.value || '0', 10));
                  setProjectedMonths(Number.isNaN(nextValue) ? 0 : nextValue);
                }}
                className="h-7 w-20 text-sm"
              />
            </div>
            {selectedIds.size > 0 && (
              <Button variant="outline" onClick={handleDownloadBankXlsx}>
                Bank XLSX
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Upload XLSX
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsUploadDialogOpen(true)}>
                  TBC Insurance
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Accrual
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingId ? 'Edit' : 'Add'} Salary Accrual</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="employee">Employee *</Label>
                    <Combobox
                      options={employees}
                      value={selectedEmployee}
                      onValueChange={setSelectedEmployee}
                      placeholder="Select employee..."
                      searchPlaceholder="Search employees..."
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="financialCode">Financial Code *</Label>
                    <Combobox
                      options={financialCodes}
                      value={selectedFinancialCode}
                      onValueChange={setSelectedFinancialCode}
                      placeholder="Select financial code..."
                      searchPlaceholder="Search financial codes..."
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="currency">Currency *</Label>
                    <Combobox
                      options={currencies}
                      value={selectedCurrency}
                      onValueChange={setSelectedCurrency}
                      placeholder="Select currency..."
                      searchPlaceholder="Search currencies..."
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="salaryMonth">Salary Month *</Label>
                    <Input
                      id="salaryMonth"
                      type="date"
                      value={salaryMonth}
                      onChange={(e) => setSalaryMonth(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="netSum">Net Sum *</Label>
                    <Input
                      id="netSum"
                      type="number"
                      step="0.01"
                      value={netSum}
                      onChange={(e) => setNetSum(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="surplusInsurance">Surplus Insurance</Label>
                    <Input
                      id="surplusInsurance"
                      type="number"
                      step="0.01"
                      value={surplusInsurance}
                      onChange={(e) => setSurplusInsurance(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="deductedInsurance">Deducted Insurance</Label>
                    <Input
                      id="deductedInsurance"
                      type="number"
                      step="0.01"
                      value={deductedInsurance}
                      onChange={(e) => setDeductedInsurance(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="deductedFitness">Deducted Fitness</Label>
                    <Input
                      id="deductedFitness"
                      type="number"
                      step="0.01"
                      value={deductedFitness}
                      onChange={(e) => setDeductedFitness(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="deductedFine">Deducted Fine</Label>
                    <Input
                      id="deductedFine"
                      type="number"
                      step="0.01"
                      value={deductedFine}
                      onChange={(e) => setDeductedFine(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={handleSave}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
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
        <div className="flex items-center gap-6 text-sm flex-wrap">
          <div>
            <span className="text-gray-600">Total Net Sum:</span>
            <span className="ml-2 font-semibold text-blue-900">
            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Upload TBC Insurance</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="grid gap-2">
                    <Label htmlFor="tbcMonth">Month</Label>
                    <Input
                      id="tbcMonth"
                      type="month"
                      value={uploadMonth}
                      onChange={(e) => setUploadMonth(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="tbcFile">XLSX File</Label>
                    <Input
                      id="tbcFile"
                      type="file"
                      accept=".xlsx"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={() => handleUploadTbcInsurance('preview')} disabled={isUploading}>
                      {isUploading ? 'Uploading...' : 'Preview'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
              {formatValue(totals.net_sum, 'currency')}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Total Paid:</span>
            <span className="ml-2 font-semibold text-green-900">
            <Dialog open={isSummaryOpen} onOpenChange={setIsSummaryOpen}>
              <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Insurance Upload Confirmation</DialogTitle>
                </DialogHeader>
                {uploadSummary ? (
                  <div className="space-y-4 text-sm">
                    <div className="grid gap-1">
                      <div><span className="text-gray-600">Month:</span> {uploadSummary.month}</div>
                      <div><span className="text-gray-600">Rows in file:</span> {uploadSummary.total_rows}</div>
                      <div><span className="text-gray-600">Matched employees:</span> {uploadSummary.matched_employees}</div>
                      <div><span className="text-gray-600">Updated records:</span> {uploadSummary.updated_records}</div>
                      <div><span className="text-gray-600">Missing employees:</span> {uploadSummary.missing_employees?.length || 0}</div>
                      <div><span className="text-gray-600">Negative deductions:</span> {uploadSummary.negative_results?.length || 0}</div>
                    </div>
                    <div>
                      <div className="font-medium mb-2">Employees</div>
                      <div className="rounded-md border border-gray-200">
                        <div className="grid grid-cols-6 gap-2 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600">
                          <div>Employee</div>
                          <div>ID</div>
                          <div>Surplus</div>
                          <div>Deductable</div>
                          <div>Total</div>
                          <div>Schedule</div>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto">
                          {(uploadSummary.updated_details || []).map((item: any, idx: number) => (
                            <div key={`${item.counteragent_uuid}-${idx}`} className="grid grid-cols-6 gap-2 border-t border-gray-100 px-3 py-2 text-xs">
                              <div className="font-medium">{item.counteragent_name || 'Unknown'}</div>
                              <div>{item.personal_id}</div>
                              <div>{item.surplus_insurance}</div>
                              <div className={item.deducted_insurance < 0 ? 'text-red-600 font-semibold' : ''}>
                                {item.deducted_insurance}
                              </div>
                              <div>{item.total_insurance}</div>
                              <div>{item.graph_amount}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    {uploadSummary.negative_results?.length > 0 && (
                      <div>
                        <div className="font-medium mb-2 text-red-600">Negative Deductions</div>
                        <div className="rounded-md border border-red-200">
                          <div className="grid grid-cols-6 gap-2 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                            <div>Employee</div>
                            <div>ID</div>
                            <div>Surplus</div>
                            <div>Deductable</div>
                            <div>Total</div>
                            <div>Schedule</div>
                          </div>
                          <div className="max-h-[200px] overflow-y-auto">
                            {uploadSummary.negative_results.map((item: any, idx: number) => (
                              <div key={`neg-${item.counteragent_uuid}-${idx}`} className="grid grid-cols-6 gap-2 border-t border-red-100 px-3 py-2 text-xs">
                                <div className="font-medium">{item.counteragent_name || 'Unknown'}</div>
                                <div>{item.personal_id}</div>
                                <div>{item.surplus_insurance}</div>
                                <div className="text-red-600 font-semibold">{item.deducted_insurance}</div>
                                <div>{item.total_insurance}</div>
                                <div>{item.graph_amount}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    {uploadSummary.missing_employees?.length > 0 && (
                      <div>
                        <div className="font-medium mb-2">Missing IDs</div>
                        <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
                          {uploadSummary.missing_employees.join(', ')}
                        </div>
                      </div>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsSummaryOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleApplyTbcInsurance} disabled={isUploading}>
                        {isUploading ? 'Applying...' : 'Confirm Apply'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-600">No summary data available.</div>
                )}
              </DialogContent>
            </Dialog>
              {formatValue(totals.paid, 'currency')}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Total Balance:</span>
            <span className={`ml-2 font-semibold ${totals.month_balance < 0 ? 'text-red-900' : 'text-blue-900'}`}>
              {formatValue(totals.month_balance, 'currency')}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Surplus Ins.:</span>
            <span className="ml-2 font-semibold text-blue-900">
              {formatValue(totals.surplus_insurance, 'currency')}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Ded Ins.:</span>
            <span className="ml-2 font-semibold text-blue-900">
              {formatValue(totals.deducted_insurance, 'currency')}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Total Ins.:</span>
            <span className="ml-2 font-semibold text-blue-900">
              {formatValue(totals.total_insurance, 'currency')}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Total Ded. Fitness:</span>
            <span className="ml-2 font-semibold text-blue-900">
              {formatValue(totals.deducted_fitness, 'currency')}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Total Ded. Fine:</span>
            <span className="ml-2 font-semibold text-blue-900">
              {formatValue(totals.deducted_fine, 'currency')}
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
                  className="sticky top-0 bg-white px-2 py-3 text-center text-sm font-semibold border-b-2 border-gray-200"
                  style={{ width: 60, minWidth: 60, maxWidth: 60 }}
                >
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={() => handleToggleSelectAll(filteredIds)}
                    />
                  </div>
                </th>
                {visibleColumns.map(col => (
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
                      backgroundColor: '#fff'
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
                ))}
                <th 
                  className="sticky top-0 bg-white px-4 py-3 text-center text-sm font-semibold border-b-2 border-gray-200"
                  style={{ width: 120, minWidth: 120, maxWidth: 120 }}
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
                paginatedData.map((accrual, idx) => (
                  <tr key={`${accrual.id}-${idx}`} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-2 py-2 text-sm" style={{ width: 60, minWidth: 60, maxWidth: 60 }}>
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={selectedIds.has(accrual.id)}
                          onCheckedChange={() => handleToggleSelect(accrual.id)}
                        />
                      </div>
                    </td>
                    {visibleColumns.map(col => (
                      <td 
                        key={col.key}
                        className="overflow-hidden px-4 py-2 text-sm"
                        style={{ 
                          width: col.width, 
                          minWidth: col.width, 
                          maxWidth: col.width
                        }}
                      >
                        {col.key === 'pension_scheme' ? (
                          <div className="flex items-center justify-center">
                            <Checkbox checked={Boolean(accrual.pension_scheme)} disabled />
                          </div>
                        ) : col.key === 'month_balance' ? (
                          <div className="truncate">
                            {formatValue(computeBalance(accrual), col.format)}
                          </div>
                        ) : (
                          <div className="truncate">
                            {formatValue(accrual[col.key], col.format)}
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-sm" style={{ width: 120, minWidth: 120, maxWidth: 120 }}>
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(accrual)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {accrual.payment_id ? (
                          <a
                            href={`/payment-statement/${encodeURIComponent(accrual.payment_id)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded p-1 text-blue-600 hover:bg-blue-50 hover:text-blue-800"
                            title="View statement (opens in new tab)"
                          >
                            <FileText className="h-4 w-4" />
                          </a>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(accrual.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
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
    return values.filter(value => {
      const label = typeof value === 'object' && value !== null && 'label' in value ? value.label : value;
      return String(label).toLowerCase().includes(filterSearchTerm.toLowerCase());
    });
  }, [values, filterSearchTerm]);

  // Sort values - numbers first, then text
  const sortedFilteredValues = useMemo(() => {
    return [...filteredValues].sort((a, b) => {
      const aLabel = typeof a === 'object' && a !== null && 'label' in a ? a.label : a;
      const bLabel = typeof b === 'object' && b !== null && 'label' in b ? b.label : b;
      const aIsNum = !isNaN(Number(aLabel));
      const bIsNum = !isNaN(Number(bLabel));

      if (aIsNum && bIsNum) {
        return Number(aLabel) - Number(bLabel);
      } else if (aIsNum && !bIsNum) {
        return -1;
      } else if (!aIsNum && bIsNum) {
        return 1;
      } else {
        return String(aLabel).localeCompare(String(bLabel));
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
    const nextValues = new Set(
      filteredValues.map(value =>
        typeof value === 'object' && value !== null && 'value' in value ? value.value : value
      )
    );
    setTempSelected(nextValues);
  };

  const handleToggle = (value: any) => {
    const actualValue = typeof value === 'object' && value !== null && 'value' in value ? value.value : value;
    const newSelected = new Set(tempSelected);
    if (newSelected.has(actualValue)) {
      newSelected.delete(actualValue);
    } else {
      newSelected.add(actualValue);
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
                sortedFilteredValues.map(value => {
                  const displayLabel = typeof value === 'object' && value !== null && 'label' in value ? value.label : value;
                  const actualValue = typeof value === 'object' && value !== null && 'value' in value ? value.value : value;
                  return (
                    <div key={String(actualValue)} className="flex items-center space-x-2 py-1">
                      <Checkbox
                        id={`${columnKey}-${String(actualValue)}`}
                        checked={tempSelected.has(actualValue)}
                        onCheckedChange={() => handleToggle(value)}
                      />
                      <label htmlFor={`${columnKey}-${String(actualValue)}`} className="text-sm flex-1 cursor-pointer">
                        {String(displayLabel)}
                      </label>
                    </div>
                  );
                })
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
