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
  Settings,
  ChevronLeft,
  ChevronRight,
  User
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
import { ColumnFilterPopover } from './shared/column-filter-popover';
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
  confirmed?: boolean;
  created_at: string;
  updated_at: string;
  paid?: number; // Calculated from bank transactions
  month_balance?: number; // computed month balance
  cumulative_accrual?: number;
  cumulative_payment?: number;
  cumulative_balance?: number;
};

type ColumnKey = keyof SalaryAccrual;

type ColumnConfig = {
  key: ColumnKey;
  label: string;
  visible: boolean;
  sortable: boolean;
  filterable: boolean;
  format?: 'currency' | 'date' | 'text' | 'boolean';
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
  { key: 'confirmed', label: 'Confirmed', visible: true, sortable: true, filterable: true, format: 'boolean', width: 120 },
  { key: 'financial_code', label: 'Financial Code', visible: true, sortable: true, filterable: true, width: 200 },
  { key: 'salary_month', label: 'Month', visible: true, sortable: true, filterable: true, format: 'date', width: 120 },
  { key: 'net_sum', label: 'Net Sum', visible: true, sortable: true, filterable: true, format: 'currency', width: 130 },
  { key: 'paid', label: 'Paid', visible: true, sortable: true, filterable: true, format: 'currency', width: 130 },
  { key: 'month_balance', label: 'Month Balance', visible: true, sortable: true, filterable: true, format: 'currency', width: 150 },
  { key: 'cumulative_accrual', label: 'Cumulative Accrual', visible: true, sortable: true, filterable: true, format: 'currency', width: 170 },
  { key: 'cumulative_payment', label: 'Cumulative Payment', visible: true, sortable: true, filterable: true, format: 'currency', width: 170 },
  { key: 'cumulative_balance', label: 'Cumulative Balance', visible: true, sortable: true, filterable: true, format: 'currency', width: 170 },
  { key: 'currency_code', label: 'Currency', visible: true, sortable: true, filterable: true, width: 100 },
  { key: 'surplus_insurance', label: 'Surplus Insurance', visible: true, sortable: true, filterable: true, format: 'currency', width: 150 },
  { key: 'deducted_insurance', label: 'Ded. Insurance', visible: true, sortable: true, filterable: true, format: 'currency', width: 150 },
  { key: 'deducted_fitness', label: 'Ded. Fitness', visible: true, sortable: true, filterable: true, format: 'currency', width: 130 },
  { key: 'deducted_fine', label: 'Ded. Fine', visible: true, sortable: true, filterable: true, format: 'currency', width: 130 },
];

export function SalaryAccrualsTable() {
  const filtersStorageKey = 'salaryAccrualsFiltersV1';
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
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const [projectedMonths, setProjectedMonths] = useState(0);
  const [latestBaseMonthLabel, setLatestBaseMonthLabel] = useState<string | null>(null);
  const [latestBaseMonthDate, setLatestBaseMonthDate] = useState<Date | null>(null);
  const [latestBaseRecords, setLatestBaseRecords] = useState<SalaryAccrual[]>([]);
  const [isCopyingLatest, setIsCopyingLatest] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadMonth, setUploadMonth] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSalaryUploadDialogOpen, setIsSalaryUploadDialogOpen] = useState(false);
  const [salaryUploadMonth, setSalaryUploadMonth] = useState('');
  const [salaryUploadFile, setSalaryUploadFile] = useState<File | null>(null);
  const [isSalaryUploading, setIsSalaryUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isDeconfirmOpen, setIsDeconfirmOpen] = useState(false);
  const [isDeconfirming, setIsDeconfirming] = useState(false);
  const [deconfirmError, setDeconfirmError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
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

    const savedFilters = localStorage.getItem(filtersStorageKey);
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        if (typeof parsed.searchTerm === 'string') setSearchTerm(parsed.searchTerm);
        if (parsed.sortColumn) setSortColumn(parsed.sortColumn as ColumnKey);
        if (parsed.sortDirection === 'asc' || parsed.sortDirection === 'desc') {
          setSortDirection(parsed.sortDirection);
        }
        if (typeof parsed.pageSize === 'number') setPageSize(parsed.pageSize);
        if (Array.isArray(parsed.filters)) {
          const restored = new Map<string, Set<any>>(
            parsed.filters.map(([key, values]: [string, any[]]) => [key, new Set(values)])
          );
          setFilters(restored);
        }
      } catch (e) {
        console.error('Failed to parse saved filters:', e);
      }
    }
    
    setIsInitialized(true);
    setFiltersInitialized(true);
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

  useEffect(() => {
    if (!filtersInitialized || !isInitialized || typeof window === 'undefined') return;
    const serialized = {
      searchTerm,
      sortColumn,
      sortDirection,
      pageSize,
      filters: Array.from(filters.entries()).map(([key, set]) => [key, Array.from(set)]),
    };
    localStorage.setItem(filtersStorageKey, JSON.stringify(serialized));
  }, [filtersInitialized, isInitialized, searchTerm, sortColumn, sortDirection, pageSize, filters]);

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
        setData((prev) => applyComputedColumns([...(result.records as SalaryAccrual[]), ...prev]));
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

      setUploadSummary(normalizeUploadSummaryInsurance(result));
      setIsSummaryOpen(true);
      if (action === 'apply') {
        const updates = Array.isArray(result.updated_details) ? result.updated_details : [];
        if (updates.length > 0) {
          const updateMap = new Map<string, any>(
            updates.map((item: any) => [item.counteragent_uuid, item])
          );
          const targetMonth = uploadMonth;
          setData((prev) =>
            applyComputedColumns(prev.map((row) => {
              const rowDate = parseSalaryMonth(row.salary_month);
              const matchesMonth =
                rowDate &&
                rowDate.getFullYear() === Number(targetMonth.split('-')[0]) &&
                rowDate.getMonth() + 1 === Number(targetMonth.split('-')[1]);
              if (!matchesMonth) return row;
              const update = updateMap.get(row.counteragent_uuid) as any;
              if (!update) return row;
              const normalizedInsurance = normalizeInsurancePair(
                String(update.surplus_insurance ?? row.surplus_insurance ?? '0'),
                String(update.deducted_insurance ?? row.deducted_insurance ?? '0'),
              );
              const updatedRow = {
                ...row,
                surplus_insurance: normalizedInsurance.surplus_insurance,
                deducted_insurance: normalizedInsurance.deducted_insurance,
              } as SalaryAccrual;
              return updatedRow;
            }))
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

  const handleSalaryPeriodUpload = async () => {
    if (!salaryUploadMonth || !salaryUploadFile) {
      alert('Please select a period and choose an XLSX file.');
      return;
    }

    setIsSalaryUploading(true);
    try {
      const formData = new FormData();
      formData.append('month', salaryUploadMonth);
      formData.append('file', salaryUploadFile);
      formData.append('updated_by', 'user');

      const response = await fetch('/api/salary-accruals/upload-period', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload salary accrual XLSX');
      }

      const errorCount = Array.isArray(result.errors) ? result.errors.length : 0;
      alert(
        `Upload completed for ${result.month}. Inserted: ${result.inserted}, Updated: ${result.updated}, Errors: ${errorCount}`
      );

      setIsSalaryUploadDialogOpen(false);
      setSalaryUploadFile(null);
      await fetchData({ showLoading: false });
    } catch (error: any) {
      alert(error.message || 'Failed to upload salary accrual XLSX');
    } finally {
      setIsSalaryUploading(false);
    }
  };

  const handleDownloadSalaryTemplate = () => {
    window.open('/api/salary-accruals/upload-period', '_blank', 'noopener,noreferrer');
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

  const handleDownloadBankXlsx = async () => {
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

    const getTbilisiToday = () => {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tbilisi',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(new Date());
    };

    const fetchExchangeRate = async (currency: string, date: string) => {
      const response = await fetch(`/api/exchange-rates?date=${date}`);
      if (!response.ok) {
        throw new Error('Failed to fetch exchange rates');
      }
      const data = await response.json();
      const rateRow = Array.isArray(data) ? data[0] : null;
      const rate = rateRow?.rates?.[currency] || rateRow?.[currency];
      if (!rate) {
        throw new Error('Exchange rate not available');
      }
      return Number(rate);
    };

    const calculateExportAmount = async (record: SalaryAccrual) => {
      const amount = Number(computeBalance(record) || 0);
      const currency = (record.currency_code || 'GEL').toUpperCase();
      if (currency === 'GEL') return Math.round(amount * 100) / 100;

      const rateDate = getTbilisiToday();
      const rate = await fetchExchangeRate(currency, rateDate);
      const converted = amount / (1 / rate);
      return Math.round(converted * 100) / 100;
    };

    const rows = await Promise.all(selectedRecords.map(async (record) => [
      'GE78BG0000000893486000',
      record.counteragent_iban || '',
      '',
      '',
      sanitizeRecipientName(record.counteragent_name || ''),
      record.identification_number || '',
      'ხელფასი',
      await calculateExportAmount(record),
      '',
      '',
      record.payment_id || '',
    ]));

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, 'Bank XLSX.xlsx');
  };

  const handleExportXlsx = () => {
    try {
      setIsExporting(true);

      const exportColumns = columns.filter((col) => col.visible);
      const headers = exportColumns.map((col) => col.label);

      const toExportValue = (row: SalaryAccrual, column: ColumnConfig) => {
        const rawValue = getRowValue(row, column.key);

        if (rawValue === null || rawValue === undefined) return '';

        if (column.key === 'pension_scheme') {
          return rawValue ? 'Yes' : 'No';
        }

        if (column.format === 'date') {
          const parsedDate = parseSalaryMonth(String(rawValue));
          if (!parsedDate) return String(rawValue);
          const year = parsedDate.getFullYear();
          const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
          return `${year}-${month}`;
        }

        if (column.format === 'currency') {
          const numValue = typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue));
          if (Number.isNaN(numValue)) return '';
          return Math.round(numValue * 100) / 100;
        }

        return String(rawValue);
      };

      const rows = filteredAndSortedData.map((row) =>
        exportColumns.map((column) => toExportValue(row, column))
      );

      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Salary Accruals');

      const dateStamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `salary-accruals-${dateStamp}.xlsx`, { bookType: 'xlsx' });
    } catch (error) {
      console.error('Failed to export salary accruals XLSX:', error);
      alert('Failed to export XLSX');
    } finally {
      setIsExporting(false);
    }
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

  const normalizePaymentId = (value: any) => {
    const trimmed = String(value ?? '').trim();
    const base = trimmed.includes(':') ? trimmed.split(':')[0] : trimmed;
    return base.toLowerCase();
  };

  const normalizeInsurancePair = (
    surplusInsurance: string | null | undefined,
    deductedInsurance: string | null | undefined,
  ) => {
    return {
      surplus_insurance: surplusInsurance ?? null,
      deducted_insurance: deductedInsurance ?? null,
    };
  };

  const getNormalizedInsuranceAmounts = (row: Pick<SalaryAccrual, 'surplus_insurance' | 'deducted_insurance'>) => {
    const surplusNumeric = parseFloat(row.surplus_insurance || '0') || 0;
    const deductedNumeric = parseFloat(row.deducted_insurance || '0') || 0;
    return { surplus: surplusNumeric, deducted: deductedNumeric };
  };

  const normalizeAccrualInsurance = (accrual: SalaryAccrual): SalaryAccrual => {
    const normalized = normalizeInsurancePair(accrual.surplus_insurance, accrual.deducted_insurance);
    return {
      ...accrual,
      surplus_insurance: normalized.surplus_insurance,
      deducted_insurance: normalized.deducted_insurance,
    };
  };

  const normalizeUploadSummaryInsurance = (summary: any) => {
    if (!summary || typeof summary !== 'object') return summary;
    const normalizeItem = (item: any) => {
      if (!item || typeof item !== 'object') return item;
      const normalized = normalizeInsurancePair(
        item.surplus_insurance != null ? String(item.surplus_insurance) : null,
        item.deducted_insurance != null ? String(item.deducted_insurance) : null,
      );
      return {
        ...item,
        surplus_insurance:
          normalized.surplus_insurance === null ? item.surplus_insurance : Number(normalized.surplus_insurance),
        deducted_insurance:
          normalized.deducted_insurance === null ? item.deducted_insurance : Number(normalized.deducted_insurance),
      };
    };

    return {
      ...summary,
      updated_details: Array.isArray(summary.updated_details)
        ? summary.updated_details.map(normalizeItem)
        : summary.updated_details,
      negative_results: Array.isArray(summary.negative_results)
        ? summary.negative_results.map(normalizeItem)
        : summary.negative_results,
    };
  };

  const computeAccrualValue = (row: SalaryAccrual) => {
    const netSum = parseFloat(row.net_sum || '0');
    const { deducted: deductedInsurance } = getNormalizedInsuranceAmounts(row);
    const deductedFitness = parseFloat(row.deducted_fitness || '0') || 0;
    const deductedFine = parseFloat(row.deducted_fine || '0') || 0;
    const pensionMultiplier = row.pension_scheme ? 0.98 : 1;
    return netSum * pensionMultiplier - deductedInsurance - deductedFitness - deductedFine;
  };

  const getPaidValue = (row: SalaryAccrual) => {
    return typeof row.paid === 'number' ? row.paid : parseFloat((row.paid as any) || '0') || 0;
  };

  const computeBalance = (row: SalaryAccrual) => {
    return computeAccrualValue(row) - getPaidValue(row);
  };

  const applyComputedColumns = (rows: SalaryAccrual[]) => {
    const normalizedRows = rows.map((row) => normalizeAccrualInsurance(row));
    const sortedForCumulative = [...normalizedRows].sort((a, b) => {
      const aDate = parseSalaryMonth(a.salary_month)?.getTime() || 0;
      const bDate = parseSalaryMonth(b.salary_month)?.getTime() || 0;
      if (aDate !== bDate) return aDate - bDate;
      const aCreated = new Date(a.created_at || 0).getTime();
      const bCreated = new Date(b.created_at || 0).getTime();
      if (aCreated !== bCreated) return aCreated - bCreated;
      return String(a.id).localeCompare(String(b.id));
    });

    const cumulativeByRowId = new Map<string, { cumulativeAccrual: number; cumulativePayment: number; cumulativeBalance: number; monthBalance: number }>();
    const runningTotals = new Map<string, { accrual: number; payment: number }>();

    sortedForCumulative.forEach((row) => {
      const groupKey = `${row.counteragent_uuid || ''}|${row.nominal_currency_uuid || ''}`;
      const accrualValue = computeAccrualValue(row);
      const paidValue = getPaidValue(row);
      const previous = runningTotals.get(groupKey) || { accrual: 0, payment: 0 };
      const cumulativeAccrual = previous.accrual + accrualValue;
      const cumulativePayment = previous.payment + paidValue;
      const cumulativeBalance = cumulativeAccrual - cumulativePayment;
      const monthBalance = accrualValue - paidValue;

      runningTotals.set(groupKey, { accrual: cumulativeAccrual, payment: cumulativePayment });
      cumulativeByRowId.set(String(row.id), {
        cumulativeAccrual,
        cumulativePayment,
        cumulativeBalance,
        monthBalance,
      });
    });

    return normalizedRows.map((row) => {
      const computed = cumulativeByRowId.get(String(row.id));
      if (!computed) return row;
      return {
        ...row,
        month_balance: computed.monthBalance,
        cumulative_accrual: computed.cumulativeAccrual,
        cumulative_payment: computed.cumulativePayment,
        cumulative_balance: computed.cumulativeBalance,
      };
    });
  };

  const getRowValue = (row: SalaryAccrual, columnKey: ColumnKey) => {
    if (columnKey === 'month_balance') return row.month_balance ?? computeBalance(row);
    if (columnKey === 'cumulative_accrual') return row.cumulative_accrual ?? 0;
    if (columnKey === 'cumulative_payment') return row.cumulative_payment ?? 0;
    if (columnKey === 'cumulative_balance') return row.cumulative_balance ?? 0;
    return row[columnKey];
  };

  const fetchData = async (options: { showLoading?: boolean } = {}) => {
    const { showLoading = true } = options;
    if (showLoading) {
      setLoading(true);
    }
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
      
      // Create a map of payment_id to total paid amount (absolute of signed aggregate)
      // Use lowercase keys for case-insensitive matching
      const paidMap = new Map<string, number>();
      transactions.forEach((tx: any) => {
        const paymentId = tx.payment_id || tx.paymentId;
        if (paymentId) {
          const paymentIdLower = normalizePaymentId(paymentId);
          const rawAmount =
            tx.nominal_amount ??
            tx.nominalAmount ??
            tx.account_currency_amount ??
            tx.accountCurrencyAmount ??
            '0';
          const amount = parseFloat(rawAmount || '0') || 0;
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

      // Calculate paid and computed columns for each salary accrual
      const enrichedData = projectedData.map((accrual: SalaryAccrual) => {
        const normalizedAccrual = normalizeAccrualInsurance(accrual);
        const paymentIdLower = normalizedAccrual.payment_id ? normalizePaymentId(normalizedAccrual.payment_id) : '';
        const paid = typeof accrual.paid === 'number'
          ? accrual.paid
          : Math.abs(paidMap.get(paymentIdLower) || 0);

        return {
          ...normalizedAccrual,
          paid,
        };
      });
      
      setData(applyComputedColumns(enrichedData));
    } catch (error) {
      console.error('Error fetching salary accruals:', error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchData({ showLoading: false });
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
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

    const normalizedInsurance = normalizeInsurancePair(surplusInsurance || null, deductedInsurance || null);

    const payload = {
      counteragent_uuid: selectedEmployee,
      financial_code_uuid: selectedFinancialCode,
      nominal_currency_uuid: selectedCurrency,
      salary_month: salaryMonth,
      net_sum: netSum,
      surplus_insurance: normalizedInsurance.surplus_insurance,
      deducted_insurance: normalizedInsurance.deducted_insurance,
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

      const normalizedUpdatedRow = normalizeAccrualInsurance(updatedRow);

      setData((prev) => {
        if (editingId) {
          return applyComputedColumns(prev.map((row) => (row.id === editingId ? normalizedUpdatedRow : row)));
        }
        return applyComputedColumns([normalizedUpdatedRow, ...prev]);
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

      setData((prev) => applyComputedColumns(prev.filter((row) => row.id !== id)));
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
          const rowValue = getRowValue(row, columnKey as ColumnKey);
          if (!allowedValues.has(rowValue)) {
            return false;
          }
        }
        return true;
      });
    }

    // Apply sort
    result.sort((a, b) => {
      const aVal = getRowValue(a, sortColumn);
      const bVal = getRowValue(b, sortColumn);
      
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

  const getFacetBaseData = useCallback((excludeColumn?: ColumnKey) => {
    let result = [...data];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(term)
        )
      );
    }

    if (filters.size > 0) {
      result = result.filter(row => {
        for (const [columnKey, allowedValues] of filters.entries()) {
          if (excludeColumn && columnKey === excludeColumn) continue;
          const rowValue = getRowValue(row, columnKey as ColumnKey);
          if (!allowedValues.has(rowValue)) {
            return false;
          }
        }
        return true;
      });
    }

    return result;
  }, [data, searchTerm, filters]);

  // Memoize unique values
  const uniqueValuesCache = useMemo(() => {
    const cache = new Map<ColumnKey, any[]>();
    const filterableColumns = columns.filter(col => col.filterable);
    
    filterableColumns.forEach(col => {
      const values = new Set(
        getFacetBaseData(col.key).map(row => getRowValue(row, col.key))
      );
      cache.set(col.key, Array.from(values).sort());
    });
    
    return cache;
  }, [columns, getFacetBaseData]);

  const formatMonthLabel = (value: any) => {
    const date = parseSalaryMonth(String(value));
    if (date) {
      return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    }
    return String(value);
  };

  const getUniqueValues = useCallback((columnKey: ColumnKey): any[] => {
    return uniqueValuesCache.get(columnKey) || [];
  }, [uniqueValuesCache]);

  const formatValue = (value: any, format?: 'currency' | 'date' | 'text' | 'boolean') => {
    if (value === null || value === undefined) return '-';

    if (format === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
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
  const selectedRecords = useMemo(
    () => filteredAndSortedData.filter((row) => selectedIds.has(row.id)),
    [filteredAndSortedData, selectedIds]
  );

  const selectedPaymentIds = useMemo(
    () => Array.from(new Set(selectedRecords.map((row) => row.payment_id).filter(Boolean))),
    [selectedRecords]
  );

  const selectedMaxMonthDate = useMemo(() => {
    if (selectedRecords.length === 0) return null;
    const maxSalaryDate = selectedRecords.reduce<Date | null>((maxDate, row) => {
      const parsed = parseSalaryMonth(String(row.salary_month));
      if (!parsed) return maxDate;
      if (!maxDate || parsed.getTime() > maxDate.getTime()) return parsed;
      return maxDate;
    }, null);
    if (!maxSalaryDate) return null;
    const endOfMonth = new Date(maxSalaryDate.getFullYear(), maxSalaryDate.getMonth() + 1, 0);
    const year = endOfMonth.getFullYear();
    const month = String(endOfMonth.getMonth() + 1).padStart(2, '0');
    const day = String(endOfMonth.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [selectedRecords]);

  const handleConfirmSelected = async () => {
    if (selectedPaymentIds.length === 0) return;
    setIsConfirming(true);
    setConfirmError(null);
    try {
      const response = await fetch('/api/payments-ledger/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIds: selectedPaymentIds,
          maxDate: selectedMaxMonthDate,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to confirm ledger entries.');
      }
      setIsConfirmOpen(false);
      setSelectedIds(new Set());
      await fetchData();
    } catch (error: any) {
      console.error('Error confirming ledger entries:', error);
      setConfirmError(error.message || 'Failed to confirm ledger entries.');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleDeconfirmSelected = async () => {
    if (selectedPaymentIds.length === 0) return;
    setIsDeconfirming(true);
    setDeconfirmError(null);
    try {
      const response = await fetch('/api/payments-ledger/deconfirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIds: selectedPaymentIds,
          maxDate: selectedMaxMonthDate,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to deconfirm ledger entries.');
      }
      setIsDeconfirmOpen(false);
      setSelectedIds(new Set());
      await fetchData();
    } catch (error: any) {
      console.error('Error deconfirming ledger entries:', error);
      setDeconfirmError(error.message || 'Failed to deconfirm ledger entries.');
    } finally {
      setIsDeconfirming(false);
    }
  };

  // Calculate totals
  const totals = useMemo(() => {
    return filteredAndSortedData.reduce((acc, row) => {
      const { surplus, deducted } = getNormalizedInsuranceAmounts(row);
      return {
        net_sum: acc.net_sum + (parseFloat(row.net_sum) || 0),
        paid: acc.paid + (row.paid || 0),
        month_balance: acc.month_balance + computeBalance(row),
        surplus_insurance: acc.surplus_insurance + surplus,
        deducted_insurance: acc.deducted_insurance + deducted,
        total_insurance: acc.total_insurance + surplus + deducted,
        deducted_fitness: acc.deducted_fitness + (parseFloat(row.deducted_fitness || '0') || 0),
        deducted_fine: acc.deducted_fine + (parseFloat(row.deducted_fine || '0') || 0),
      };
    }, {
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
    <>
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
            {selectedIds.size > 0 && (
              <Dialog
                open={isConfirmOpen}
                onOpenChange={(open) => {
                  setIsConfirmOpen(open);
                  if (!open) setConfirmError(null);
                }}
              >
                <DialogTrigger asChild>
                  <Button>Confirm</Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Confirm selected salary accruals</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      {selectedMaxMonthDate
                        ? `Only ledger entries with effective date <= ${selectedMaxMonthDate} will be confirmed.`
                        : 'No date cutoff is applied. All ledger entries for selected payment IDs will be confirmed.'}
                    </div>
                    <div className="max-h-64 overflow-y-auto rounded-md border">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                          <tr>
                            <th className="px-3 py-2 text-left">Payment ID</th>
                            <th className="px-3 py-2 text-left">Employee</th>
                            <th className="px-3 py-2 text-left">Month</th>
                            <th className="px-3 py-2 text-right">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedRecords.map((row) => (
                            <tr key={row.id} className="border-t">
                              <td className="px-3 py-2">{row.payment_id}</td>
                              <td className="px-3 py-2">{row.counteragent_name || '-'}</td>
                              <td className="px-3 py-2">{formatMonthLabel(row.salary_month)}</td>
                              <td className="px-3 py-2 text-right">{formatValue(getRowValue(row, 'month_balance'), 'currency')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {confirmError && <div className="text-sm text-red-600">{confirmError}</div>}
                    <div className="flex gap-3 pt-2">
                      <Button onClick={handleConfirmSelected} disabled={isConfirming} className="flex-1">
                        {isConfirming ? 'Confirming...' : 'Confirm'}
                      </Button>
                      <Button variant="outline" onClick={() => setIsConfirmOpen(false)} className="flex-1">
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            {selectedIds.size > 0 && (
              <Dialog
                open={isDeconfirmOpen}
                onOpenChange={(open) => {
                  setIsDeconfirmOpen(open);
                  if (!open) setDeconfirmError(null);
                }}
              >
                <DialogTrigger asChild>
                  <Button variant="outline">Deconfirm</Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Deconfirm selected salary accruals</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      {selectedMaxMonthDate
                        ? `Only ledger entries with effective date <= ${selectedMaxMonthDate} will be deconfirmed.`
                        : 'No date cutoff is applied. All ledger entries for selected payment IDs will be deconfirmed.'}
                    </div>
                    <div className="max-h-64 overflow-y-auto rounded-md border">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                          <tr>
                            <th className="px-3 py-2 text-left">Payment ID</th>
                            <th className="px-3 py-2 text-left">Employee</th>
                            <th className="px-3 py-2 text-left">Month</th>
                            <th className="px-3 py-2 text-right">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedRecords.map((row) => (
                            <tr key={row.id} className="border-t">
                              <td className="px-3 py-2">{row.payment_id}</td>
                              <td className="px-3 py-2">{row.counteragent_name || '-'}</td>
                              <td className="px-3 py-2">{formatMonthLabel(row.salary_month)}</td>
                              <td className="px-3 py-2 text-right">{formatValue(getRowValue(row, 'month_balance'), 'currency')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {deconfirmError && <div className="text-sm text-red-600">{deconfirmError}</div>}
                    <div className="flex gap-3 pt-2">
                      <Button onClick={handleDeconfirmSelected} disabled={isDeconfirming} className="flex-1" variant="destructive">
                        {isDeconfirming ? 'Deconfirming...' : 'Deconfirm'}
                      </Button>
                      <Button variant="outline" onClick={() => setIsDeconfirmOpen(false)} className="flex-1">
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            <Button variant="outline" onClick={handleExportXlsx} disabled={isExporting}>
              {isExporting ? 'Exporting...' : 'Export XLSX'}
            </Button>
            <Button variant="outline" onClick={handleDownloadSalaryTemplate}>
              Salary Template
            </Button>
            <Button variant="outline" onClick={() => setIsSalaryUploadDialogOpen(true)}>
              Upload Salary XLSX
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Upload XLSX
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsSalaryUploadDialogOpen(true)}>
                  Salary Accruals (Period)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadSalaryTemplate}>
                  Download Salary Template
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsUploadDialogOpen(true)}>
                  TBC Insurance
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={isSalaryUploadDialogOpen} onOpenChange={setIsSalaryUploadDialogOpen}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Upload Salary Accruals by Period</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="grid gap-2">
                    <Label htmlFor="salaryPeriodMonth">Period</Label>
                    <Input
                      id="salaryPeriodMonth"
                      type="month"
                      value={salaryUploadMonth}
                      onChange={(e) => setSalaryUploadMonth(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="salaryPeriodFile">XLSX File</Label>
                    <Input
                      id="salaryPeriodFile"
                      type="file"
                      accept=".xlsx"
                      onChange={(e) => setSalaryUploadFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Button variant="outline" onClick={handleDownloadSalaryTemplate}>
                      Download Template
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={() => setIsSalaryUploadDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSalaryPeriodUpload} disabled={isSalaryUploading}>
                        {isSalaryUploading ? 'Uploading...' : 'Upload'}
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
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

            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              title="Refresh data"
            >
              <span className={isRefreshing ? "animate-spin" : ""}>🔄</span>
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            
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
                      <div><span className="text-gray-600">Total insurance cost (file):</span> {formatValue(uploadSummary.summary_totals?.file_total_insurance_cost || 0, 'currency')}</div>
                      <div><span className="text-gray-600">Matched cost total:</span> {formatValue(uploadSummary.summary_totals?.matched_total_insurance_cost || 0, 'currency')}</div>
                      <div><span className="text-gray-600">Matched surplus total:</span> {formatValue(uploadSummary.summary_totals?.matched_total_surplus_insurance || 0, 'currency')}</div>
                      <div><span className="text-gray-600">Matched deductable total:</span> {formatValue(uploadSummary.summary_totals?.matched_total_deducted_insurance || 0, 'currency')}</div>
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
                    className={`font-semibold relative cursor-move overflow-hidden text-left px-4 py-3 text-sm sticky top-0 z-10 ${
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
                        <ColumnFilterPopover
                          columnKey={col.key}
                          columnLabel={col.label}
                          values={getUniqueValues(col.key)}
                          activeFilters={filters.get(col.key) || new Set()}
                          onFilterChange={(values) => handleFilterChange(col.key, values)}
                          onSort={(direction) => {
                            setSortColumn(col.key);
                            setSortDirection(direction);
                          }}
                          renderValue={(value) =>
                            col.key === 'salary_month'
                              ? formatMonthLabel(value)
                              : formatValue(value, col.format)
                          }
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
                  <tr
                    key={`${accrual.id}-${idx}`}
                    className={`border-b border-gray-200 hover:bg-gray-50 ${accrual.confirmed ? 'bg-[#e8f5e9]' : ''}`}
                  >
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
                        ) : col.format === 'boolean' ? (
                          <div className="truncate">{formatValue(accrual[col.key], 'boolean')}</div>
                        ) : col.key === 'month_balance' ? (
                          <div className="truncate">
                            {formatValue(getRowValue(accrual, 'month_balance'), col.format)}
                          </div>
                        ) : col.key === 'cumulative_accrual' || col.key === 'cumulative_payment' || col.key === 'cumulative_balance' ? (
                          <div className="truncate">
                            {formatValue(getRowValue(accrual, col.key), col.format)}
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
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              const url = `/payment-statement/${encodeURIComponent(accrual.payment_id)}`;
                              window.open(url, '_blank', 'noopener,noreferrer');
                            }}
                            className="inline-flex items-center justify-center rounded p-1 text-blue-600 hover:bg-blue-50 hover:text-blue-800"
                            title="View statement (opens in new tab)"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                        ) : null}
                        <a
                          href={accrual.counteragent_uuid ? `/counteragent-statement/${accrual.counteragent_uuid}` : '#'}
                          target={accrual.counteragent_uuid ? '_blank' : undefined}
                          rel={accrual.counteragent_uuid ? 'noopener noreferrer' : undefined}
                          className="inline-flex items-center justify-center rounded p-1 text-blue-600 hover:bg-blue-50 hover:text-blue-800"
                          aria-disabled={!accrual.counteragent_uuid}
                          title="View counteragent statement (opens in new tab)"
                          onClick={(event) => {
                            if (!accrual.counteragent_uuid) {
                              event.preventDefault();
                            }
                          }}
                        >
                          <User className="h-4 w-4" />
                        </a>
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

    </>
  );
}

