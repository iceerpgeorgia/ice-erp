'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Settings,
  Eye,
  EyeOff,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Download,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { ColumnFilterPopover } from './shared/column-filter-popover';
import { ClearFiltersButton } from './shared/clear-filters-button';
import type { FilterState, ColumnFilter, ColumnFormat } from './shared/table-filters';
import { matchesFilter } from './shared/table-filters';
import { loadFilterMap, saveFilterMap, clearColumnFilters } from './shared/column-filter-storage';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Combobox } from '@/components/ui/combobox';
import { exportRowsToXlsx } from '@/lib/export-xlsx';
import { RequiredInsiderBadge } from './shared/required-insider-badge';
import { useRequiredInsiderName } from './shared/use-required-insider';

type BankAccount = {
  id: number;
  uuid: string;
  accountNumber: string;
  currencyUuid: string;
  currencyCode: string;
  currencyName: string;
  bankUuid: string;
  bankName: string;
  balance: number | null;
  balanceDate: string | null;
  latestDate?: string | null;
  recordedBalance?: number | null;
  parsingSchemeUuid: string | null;
  parsingSchemeName: string | null;
  rawTableName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  insiderUuid?: string | null;
  insiderName?: string | null;
  computedCurrentBalance?: number | null;
  balanceDelta?: number | null;
  periodIncome?: number | null;
  periodExpense?: number | null;
  balanceAsOfDate?: string | null;
  balanceCheckStatus?: string | null;
  bogApiBalance?: number | null;
  bogBalanceDelta?: number | null;
  bogBalanceStatus?: string | null;
};

type DailyBalanceRow = {
  accountUuid: string;
  accountNumber: string;
  currencyCode: string | null;
  bankName: string | null;
  date: string;
  openingDate: string;
  closingDate: string;
  openingBalance: number;
  inflow: number;
  outflow: number;
  closingBalance: number;
  hasTurnover: boolean;
};

type ColumnKey = keyof BankAccount;

type ColumnConfig = {
  key: ColumnKey;
  label: string;
  visible: boolean;
  sortable: boolean;
  filterable: boolean;
  format?: 'currency' | 'number' | 'boolean' | 'date';
  width: number;
};

const defaultColumns: ColumnConfig[] = [
  { key: 'accountNumber', label: 'Account Number', visible: true, sortable: true, filterable: true, width: 180 },
  { key: 'bankName', label: 'Bank', visible: true, sortable: true, filterable: true, width: 200 },
  { key: 'currencyCode', label: 'Currency', visible: true, sortable: true, filterable: true, width: 100 },
  { key: 'insiderName', label: 'Insider', visible: true, sortable: false, filterable: false, width: 180 },
  { key: 'latestDate', label: 'Latest Date', visible: true, sortable: true, filterable: false, format: 'date', width: 130 },
  { key: 'recordedBalance', label: 'Recorded Balance', visible: true, sortable: true, filterable: false, format: 'currency', width: 170 },
  { key: 'balance', label: 'Balance', visible: true, sortable: true, filterable: false, format: 'currency', width: 150 },
  { key: 'computedCurrentBalance', label: 'Current Balance', visible: true, sortable: true, filterable: false, format: 'currency', width: 170 },
  { key: 'bogApiBalance', label: 'BOG API Balance', visible: true, sortable: true, filterable: false, format: 'currency', width: 170 },
  { key: 'bogBalanceDelta', label: 'BOG Delta', visible: true, sortable: true, filterable: false, format: 'currency', width: 130 },
  { key: 'balanceDelta', label: 'Delta', visible: true, sortable: true, filterable: false, format: 'currency', width: 130 },
  { key: 'balanceDate', label: 'Balance Date', visible: true, sortable: true, filterable: false, format: 'date', width: 130 },
  { key: 'parsingSchemeName', label: 'Parsing Scheme', visible: true, sortable: true, filterable: true, width: 150 },
  { key: 'rawTableName', label: 'Raw Data Table', visible: true, sortable: true, filterable: true, width: 200 },
  { key: 'isActive', label: 'Status', visible: true, sortable: true, filterable: true, format: 'boolean', width: 100 },
  { key: 'createdAt', label: 'Created', visible: false, sortable: true, filterable: false, format: 'date', width: 150 },
];

const BALANCE_DRIFT_WARNING_THRESHOLD = 1;

interface Currency {
  uuid: string;
  code: string;
  name: string;
}

interface Bank {
  uuid: string;
  bankName: string;
}

interface ParsingScheme {
  uuid: string;
  scheme: string;
}

export function BankAccountsTable() {
  const requiredInsiderName = useRequiredInsiderName();
  const [data, setData] = useState<BankAccount[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [parsingSchemes, setParsingSchemes] = useState<ParsingScheme[]>([]);
  const [insidersList, setInsidersList] = useState<Array<{ insiderUuid: string; insiderName: string }>>([]);
  const [selectedInsiderUuids, setSelectedInsiderUuids] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<ColumnKey>('accountNumber');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);
  const filtersStorageKey = 'filters:bank-accounts';
  const [filters, setFilters] = useState<FilterState>(() => {
    const legacy = loadFilterMap(filtersStorageKey);
    // Convert legacy Map<string, Set<any>> to FilterState
    const fs: FilterState = new Map();
    legacy.forEach((values, key) => { if (values.size > 0) fs.set(key, { mode: 'facet', values }); });
    return fs;
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [isResizing, setIsResizing] = useState<{ column: ColumnKey; startX: number; startWidth: number; element: HTMLElement } | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isBalanceQueryDialogOpen, setIsBalanceQueryDialogOpen] = useState(false);
  const [queryAccountUuid, setQueryAccountUuid] = useState<string>('all');
  const [queryFromDate, setQueryFromDate] = useState<string>('');
  const [queryToDate, setQueryToDate] = useState<string>('');
  const [queryRows, setQueryRows] = useState<DailyBalanceRow[]>([]);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    accountNumber: '',
    currencyUuid: '',
    bankUuid: '',
    insiderUuid: '',
    balance: '',
    balanceDate: '',
    rawTableName: '',
    parsingSchemeUuid: '',
  });

  const isInsiderFixed = selectedInsiderUuids.length === 1;

  const fixedInsider = useMemo(() => {
    if (!isInsiderFixed) return null;
    const fixedUuid = selectedInsiderUuids[0];
    return insidersList.find((insider) => insider.insiderUuid === fixedUuid) ?? null;
  }, [isInsiderFixed, insidersList, selectedInsiderUuids]);

  const insiderOptions = useMemo(
    () => insidersList.map((i) => ({ value: i.insiderUuid, label: i.insiderName, keywords: i.insiderName })),
    [insidersList]
  );

  // Load saved column configuration after hydration
  useEffect(() => {
    const saved = localStorage.getItem('bankAccountsColumns');
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
    setIsInitialized(true);
  }, []);

  // Fetch data after initialization
  useEffect(() => {
    if (isInitialized) {
      fetchData();
      fetchCurrencies();
      fetchBanks();
      fetchParsingSchemes();
      fetchInsiderSelection();
    }
  }, [isInitialized]);

  useEffect(() => {
    if (!isInsiderFixed || !fixedInsider?.insiderUuid) return;
    setFormData((prev) =>
      prev.insiderUuid === fixedInsider.insiderUuid
        ? prev
        : { ...prev, insiderUuid: fixedInsider.insiderUuid }
    );
  }, [isInsiderFixed, fixedInsider?.insiderUuid]);

  // Save column configuration to localStorage
  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
      localStorage.setItem('bankAccountsColumns', JSON.stringify(columns));
    }
  }, [columns, isInitialized]);

  useEffect(() => {
    // Convert FilterState back to legacy format for persistence
    const legacyMap = new Map<string, Set<any>>();
    filters.forEach((filter, key) => {
      if (filter.mode === 'facet') legacyMap.set(key, filter.values);
    });
    saveFilterMap(filtersStorageKey, legacyMap);
  }, [filters]);

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

  const fetchData = async () => {
    try {
      setLoading(true);
      const [accountsResponse, balanceResponse] = await Promise.all([
        fetch('/api/bank-accounts'),
        fetch('/api/bank-accounts/balance-check'),
      ]);

      if (!accountsResponse.ok) throw new Error('Failed to fetch bank accounts');
      const accounts = await accountsResponse.json();

      let balanceRows: any[] = [];
      if (balanceResponse.ok) {
        const payload = await balanceResponse.json();
        balanceRows = Array.isArray(payload?.rows) ? payload.rows : [];
      }

      const balanceByAccount = new Map<string, any>(
        balanceRows.map((row) => [String(row.bankAccountUuid), row])
      );

      const merged = (Array.isArray(accounts) ? accounts : []).map((account: any) => {
        const balanceData = balanceByAccount.get(String(account.uuid));
        return {
          ...account,
          computedCurrentBalance:
            balanceData?.computedCurrentBalance === null || balanceData?.computedCurrentBalance === undefined
              ? null
              : Number(balanceData.computedCurrentBalance),
          balanceDelta:
            balanceData?.deltaFromStored === null || balanceData?.deltaFromStored === undefined
              ? null
              : Number(balanceData.deltaFromStored),
          periodIncome:
            balanceData?.income === null || balanceData?.income === undefined
              ? null
              : Number(balanceData.income),
          periodExpense:
            balanceData?.expense === null || balanceData?.expense === undefined
              ? null
              : Number(balanceData.expense),
          balanceAsOfDate: balanceData?.asOfDate || null,
          balanceCheckStatus: balanceData?.status || null,
          bogApiBalance:
            balanceData?.bogApiBalance === null || balanceData?.bogApiBalance === undefined
              ? null
              : Number(balanceData.bogApiBalance),
          bogBalanceDelta:
            balanceData?.deltaFromBogApi === null || balanceData?.deltaFromBogApi === undefined
              ? null
              : Number(balanceData.deltaFromBogApi),
          bogBalanceStatus: balanceData?.bogBalanceStatus || null,
        } as BankAccount;
      });

      setData(merged);
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrencies = async () => {
    try {
      const response = await fetch('/api/currencies');
      if (!response.ok) throw new Error('Failed to fetch currencies');
      const result = await response.json();
      const rows = Array.isArray(result) ? result : result.data;
      setCurrencies((rows || []).filter((c: Currency & { is_active?: boolean }) => c.is_active !== false));
    } catch (error) {
      console.error('Error fetching currencies:', error);
    }
  };

  const fetchBanks = async () => {
    try {
      const response = await fetch('/api/banks');
      if (!response.ok) throw new Error('Failed to fetch banks');
      const result = await response.json();
      setBanks((result || []).filter((b: Bank & { is_active?: boolean }) => b.is_active !== false));
    } catch (error) {
      console.error('Error fetching banks:', error);
    }
  };

  const fetchParsingSchemes = async () => {
    try {
      const response = await fetch('/api/parsing-schemes');
      if (!response.ok) throw new Error('Failed to fetch parsing schemes');
      const result = await response.json();
      setParsingSchemes(result);
    } catch (error) {
      console.error('Error fetching parsing schemes:', error);
    }
  };

  const fetchInsiderSelection = async () => {
    try {
      const response = await fetch('/api/insider-selection', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch insider selection');
      const data = await response.json();

      const selectedUuids = Array.isArray(data?.selectedUuids) ? data.selectedUuids : [];
      const selectedInsiders = Array.isArray(data?.selectedInsiders) ? data.selectedInsiders : [];
      const options = Array.isArray(data?.options) ? data.options : [];
      const availableInsidersRaw = selectedInsiders.length > 0 ? selectedInsiders : options;
      const availableInsiders = availableInsidersRaw.map((option: any) => ({
        insiderUuid: option.insiderUuid,
        insiderName: option.insiderName,
      }));

      setSelectedInsiderUuids(selectedUuids);
      setInsidersList(availableInsiders);

      if (selectedUuids.length === 1) {
        setFormData((prev) => ({ ...prev, insiderUuid: selectedUuids[0] }));
      } else if (selectedUuids.length > 1) {
        setFormData((prev) => ({ ...prev, insiderUuid: prev.insiderUuid || selectedUuids[0] }));
      } else if (availableInsiders.length > 0) {
        setFormData((prev) => ({ ...prev, insiderUuid: prev.insiderUuid || availableInsiders[0].insiderUuid }));
      }
    } catch (error) {
      console.error('Error fetching insider selection:', error);
    }
  };

  // Column drag handlers
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

  const handleToggleColumn = (key: ColumnKey) => {
    setColumns(prev =>
      prev.map(col => (col.key === key ? { ...col, visible: !col.visible } : col))
    );
  };

  const formatValue = (value: any, format?: string) => {
    if (value === null || value === undefined || value === '') return '-';

    switch (format) {
      case 'currency':
        return typeof value === 'number' ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
      case 'number':
        return typeof value === 'number' ? value.toLocaleString('en-US') : value;
      case 'boolean':
        return value ? <span className="text-green-600 font-semibold">✓ Active</span> : <span className="text-red-600">✗ Inactive</span>;
      case 'date':
        if (!value) return '-';
        try {
          const date = new Date(value);
          return date.toLocaleDateString('en-GB');
        } catch {
          return value;
        }
      default:
        return value;
    }
  };

  const formatDeltaCell = (row: BankAccount) => {
    const value = row.balanceDelta;
    if (value === null || value === undefined) return '-';

    const abs = Math.abs(value);
    const text = value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const isWarning = abs >= BALANCE_DRIFT_WARNING_THRESHOLD;

    if (!isWarning) return text;

    return (
      <span className="inline-flex items-center gap-1 font-semibold text-amber-700" title={`As of ${row.balanceAsOfDate || 'today'}`}>
        <span>Drift</span>
        <span>{text}</span>
      </span>
    );
  };

  const visibleColumns = useMemo(() => columns.filter(col => col.visible), [columns]);

  const getFacetBaseData = (excludeColumn?: ColumnKey) => {
    let result = [...data];

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(row =>
        Object.values(row).some(val =>
          String(val).toLowerCase().includes(lowerSearch)
        )
      );
    }

    filters.forEach((filter, columnKey) => {
      if (excludeColumn && columnKey === excludeColumn) return;
      result = result.filter(row => matchesFilter(row[columnKey as ColumnKey], filter));
    });

    return result;
  };

  const getUniqueValues = (columnKey: ColumnKey) => {
    const values = new Set(getFacetBaseData(columnKey).map(row => row[columnKey]));
    return Array.from(values).filter(v => v !== null && v !== undefined);
  };

  const handleFilterChange = (columnKey: string, filter: ColumnFilter | null) => {
    setFilters(prev => {
      const newFilters = new Map(prev);
      if (filter) {
        newFilters.set(columnKey, filter);
      } else {
        newFilters.delete(columnKey);
      }
      return newFilters;
    });
    setCurrentPage(1);
  };

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Apply search
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(row =>
        Object.values(row).some(val =>
          String(val).toLowerCase().includes(lowerSearch)
        )
      );
    }

    // Apply filters
    filters.forEach((filter, columnKey) => {
      result = result.filter(row => matchesFilter(row[columnKey as ColumnKey], filter));
    });

    // Apply sort
    if (sortColumn) {
      result.sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        return sortDirection === 'asc' 
          ? aStr.localeCompare(bStr) 
          : bStr.localeCompare(aStr);
      });
    }

    return result;
  }, [data, searchTerm, sortColumn, sortDirection, filters]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAndSortedData.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredAndSortedData.length / pageSize);

  const handleExportXlsx = () => {
    if (filteredAndSortedData.length === 0) return;
    setIsExporting(true);
    try {
      const fileName = `bank-accounts_${new Date().toISOString().slice(0, 10)}.xlsx`;
      exportRowsToXlsx({
        rows: filteredAndSortedData,
        columns,
        fileName,
        sheetName: 'Bank Accounts',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const runBalanceQuery = async () => {
    if (!queryFromDate || !queryToDate) {
      setQueryError('Please select both From and To dates.');
      return;
    }

    if (queryFromDate > queryToDate) {
      setQueryError('From date must be less than or equal to To date.');
      return;
    }

    try {
      setQueryLoading(true);
      setQueryError(null);

      const params = new URLSearchParams({
        from: queryFromDate,
        to: queryToDate,
      });

      if (queryAccountUuid !== 'all') {
        params.set('accountUuid', queryAccountUuid);
      }

      const response = await fetch(`/api/bank-accounts/daily-balances?${params.toString()}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Failed to query balances');
      }

      const payload = await response.json();
      const rows = Array.isArray(payload?.rows) ? payload.rows : [];
      setQueryRows(rows as DailyBalanceRow[]);
    } catch (error: any) {
      setQueryRows([]);
      setQueryError(error?.message || 'Failed to query balances');
    } finally {
      setQueryLoading(false);
    }
  };

  const openAddDialog = () => {
    setIsEditMode(false);
    setEditingId(null);
    setFormData({
      accountNumber: '',
      currencyUuid: '',
      bankUuid: '',
      insiderUuid: fixedInsider?.insiderUuid || insidersList[0]?.insiderUuid || '',
      balance: '',
      balanceDate: '',
      rawTableName: '',
      parsingSchemeUuid: '',
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (account: BankAccount) => {
    setIsEditMode(true);
    setEditingId(account.uuid);
    setFormData({
      accountNumber: account.accountNumber,
      currencyUuid: account.currencyUuid,
      bankUuid: account.bankUuid,
      insiderUuid: isInsiderFixed
        ? (fixedInsider?.insiderUuid || '')
        : (account.insiderUuid || fixedInsider?.insiderUuid || insidersList[0]?.insiderUuid || ''),
      balance: account.balance?.toString() || '',
      balanceDate: account.balanceDate || '',
      parsingSchemeUuid: account.parsingSchemeUuid || '',
      rawTableName: account.rawTableName || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      accountNumber: formData.accountNumber,
      currencyUuid: formData.currencyUuid,
      bankUuid: formData.bankUuid,
      insiderUuid: formData.insiderUuid || null,
      insider_uuid: formData.insiderUuid || null,
      rawTableName: formData.rawTableName || null,
      balance: formData.balance ? parseFloat(formData.balance) : null,
      balanceDate: formData.balanceDate || null,
      parsingSchemeUuid: formData.parsingSchemeUuid || null,
    };

    try {
      const url = isEditMode ? `/api/bank-accounts/${editingId}` : '/api/bank-accounts';
      const method = isEditMode ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to save bank account');
      
      await fetchData();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving bank account:', error);
      alert('Failed to save bank account');
    }
  };

  const handleDelete = async (uuid: string) => {
    if (!confirm('Are you sure you want to delete this bank account?')) return;

    try {
      const response = await fetch(`/api/bank-accounts/${uuid}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete bank account');
      
      await fetchData();
    } catch (error) {
      console.error('Error deleting bank account:', error);
      alert('Failed to delete bank account');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-30 flex-shrink-0 bg-white border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Bank Accounts</h1>
            <RequiredInsiderBadge />
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportXlsx}
              disabled={isExporting || filteredAndSortedData.length === 0}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {isExporting ? 'Exporting...' : 'Export XLSX'}
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openAddDialog} className="gap-2 bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4" />
                  Add Account
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{isEditMode ? 'Edit Bank Account' : 'Add Bank Account'}</DialogTitle>
                  <DialogDescription>
                    {isEditMode ? 'Update bank account details' : 'Create a new bank account'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Insider <span className="text-red-500">*</span></Label>
                    <Combobox
                      options={insiderOptions}
                      value={formData.insiderUuid}
                      onValueChange={(value: string) => setFormData({ ...formData, insiderUuid: value })}
                      placeholder="Select insider"
                      searchPlaceholder="Search insiders..."
                      emptyText="No insider found."
                      disabled={isInsiderFixed}
                      triggerClassName={isInsiderFixed ? 'bg-muted text-muted-foreground cursor-not-allowed' : ''}
                    />
                    {isInsiderFixed && fixedInsider?.insiderName && (
                      <p className="text-xs text-muted-foreground">Fixed by homepage selection: {fixedInsider.insiderName}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Account Number <span className="text-red-500">*</span></Label>
                    <Input
                      value={formData.accountNumber}
                      onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                      required
                      className="border-2 border-gray-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Bank <span className="text-red-500">*</span></Label>
                    <Select
                      value={formData.bankUuid}
                      onValueChange={(value) => setFormData({ ...formData, bankUuid: value })}
                      required
                    >
                      <SelectTrigger className="border-2 border-gray-400">
                        <SelectValue placeholder="Select bank" />
                      </SelectTrigger>
                      <SelectContent>
                        {banks.map((bank) => (
                          <SelectItem key={bank.uuid} value={bank.uuid}>
                            {bank.bankName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Currency <span className="text-red-500">*</span></Label>
                    <Select
                      value={formData.currencyUuid}
                      onValueChange={(value) => setFormData({ ...formData, currencyUuid: value })}
                      required
                    >
                      <SelectTrigger className="border-2 border-gray-400">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((currency) => (
                          <SelectItem key={currency.uuid} value={currency.uuid}>
                            {currency.code} - {currency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Balance</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.balance}
                      onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                      className="border-2 border-gray-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Balance Date</Label>
                    <Input
                      type="date"
                      value={formData.balanceDate}
                      onChange={(e) => setFormData({ ...formData, balanceDate: e.target.value })}
                      className="border-2 border-gray-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Parsing Scheme</Label>
                    <Select
                      value={formData.parsingSchemeUuid}
                      onValueChange={(value) => setFormData({ ...formData, parsingSchemeUuid: value })}
                    >
                      <SelectTrigger className="border-2 border-gray-400">
                        <SelectValue placeholder="Select parsing scheme" />
                      </SelectTrigger>
                      <SelectContent>
                        {parsingSchemes.map((scheme) => (
                          <SelectItem key={scheme.uuid} value={scheme.uuid}>
                            {scheme.scheme}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Raw Data Table Name</Label>
                    <Input
                      value={formData.rawTableName}
                      onChange={(e) => setFormData({ ...formData, rawTableName: e.target.value })}
                      placeholder="e.g., bog_gel_raw_893486000"
                      className="border-2 border-gray-400"
                    />
                    <p className="text-xs text-gray-500">
                      The database table name where raw transaction data is stored for this account
                    </p>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-green-600 hover:bg-green-700">
                      {isEditMode ? 'Update' : 'Create'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={isBalanceQueryDialogOpen} onOpenChange={setIsBalanceQueryDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="w-4 h-4" />
                  Query Balances
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle>Opening/Closing Balance Query</DialogTitle>
                  <DialogDescription>
                    Query specific dates and accounts using the compressed period balances.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pb-2">
                  <div className="space-y-1">
                    <Label>Account</Label>
                    <Select value={queryAccountUuid} onValueChange={setQueryAccountUuid}>
                      <SelectTrigger>
                        <SelectValue placeholder="All accounts" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All accounts</SelectItem>
                        {data.map((account) => (
                          <SelectItem key={account.uuid} value={account.uuid}>
                            {account.accountNumber} ({account.currencyCode || '-'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label>From</Label>
                    <Input type="date" value={queryFromDate} onChange={(e) => setQueryFromDate(e.target.value)} />
                  </div>

                  <div className="space-y-1">
                    <Label>To</Label>
                    <Input type="date" value={queryToDate} onChange={(e) => setQueryToDate(e.target.value)} />
                  </div>

                  <div className="flex items-end">
                    <Button className="w-full" onClick={runBalanceQuery} disabled={queryLoading}>
                      {queryLoading ? 'Querying...' : 'Run Query'}
                    </Button>
                  </div>
                </div>

                {queryError ? <p className="text-sm text-red-600">{queryError}</p> : null}

                <div className="border rounded-md overflow-auto flex-1">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white border-b">
                      <tr>
                        <th className="text-left px-3 py-2">Account</th>
                        <th className="text-left px-3 py-2">Currency</th>
                        <th className="text-left px-3 py-2">Date</th>
                        <th className="text-right px-3 py-2">Opening</th>
                        <th className="text-right px-3 py-2">Inflow</th>
                        <th className="text-right px-3 py-2">Outflow</th>
                        <th className="text-right px-3 py-2">Closing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queryRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                            No rows yet. Run a query to see opening and closing balances.
                          </td>
                        </tr>
                      ) : (
                        queryRows.map((row, idx) => (
                          <tr key={`${row.accountUuid}-${row.date}-${idx}`} className="border-b last:border-b-0">
                            <td className="px-3 py-2">{row.accountNumber}</td>
                            <td className="px-3 py-2">{row.currencyCode || '-'}</td>
                            <td className="px-3 py-2">{formatValue(row.date, 'date')}</td>
                            <td className="px-3 py-2 text-right">{formatValue(row.openingBalance, 'currency')}</td>
                            <td className="px-3 py-2 text-right">{formatValue(row.inflow, 'currency')}</td>
                            <td className="px-3 py-2 text-right">{formatValue(row.outflow, 'currency')}</td>
                            <td className="px-3 py-2 text-right">{formatValue(row.closingBalance, 'currency')}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </DialogContent>
            </Dialog>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64"
              />
            </div>

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

            <ClearFiltersButton
              activeCount={filters.size + (searchTerm.trim() ? 1 : 0)}
              onClear={() => {
                setFilters(new Map());
                clearColumnFilters(filtersStorageKey);
                setSearchTerm('');
              }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 p-4 overflow-hidden">
        <div className="h-full overflow-auto rounded-lg border bg-white">
          <table style={{ tableLayout: 'fixed', width: '100%' }} className="border-collapse">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b-2 border-gray-200">
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
                          activeFilters={filters.get(col.key)?.mode === 'facet' ? (filters.get(col.key) as any).values : new Set()}
                          activeFilter={filters.get(col.key)}
                          columnFormat={col.format as ColumnFormat | undefined}
                          onAdvancedFilterChange={(filter) => handleFilterChange(col.key, filter)}
                          onFilterChange={(values) => handleFilterChange(col.key, values.size > 0 ? { mode: 'facet', values } : null)}
                          onSort={(direction) => {
                            setSortColumn(col.key);
                            setSortDirection(direction);
                          }}
                        />
                      )}
                    </div>
                    
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
                  className="sticky top-0 bg-white px-4 py-3 text-left text-sm font-semibold border-b-2 border-gray-200"
                  style={{ width: 100, minWidth: 100, maxWidth: 100 }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="text-center py-8 px-4">
                    Loading...
                  </td>
                </tr>
              ) : filteredAndSortedData.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="text-center py-8 px-4 text-gray-500">
                    No records found
                  </td>
                </tr>
              ) : (
                paginatedData.map((row) => (
                  <tr key={row.uuid} className="border-b border-gray-200 hover:bg-gray-50">
                    {visibleColumns.map(col => (
                      <td 
                        key={col.key}
                        className="overflow-hidden px-4 py-2 text-sm"
                        style={{ 
                          width: col.width, 
                          minWidth: col.width, 
                          maxWidth: col.width,
                        }}
                      >
                        {col.format === 'boolean' ? (
                          <div className="flex items-center">
                            {formatValue(row[col.key], col.format)}
                          </div>
                        ) : (
                          <div className="truncate">
                            {col.key === 'insiderName'
                              ? (requiredInsiderName || '-')
                              : col.key === 'balanceDelta'
                                ? formatDeltaCell(row)
                              : formatValue(row[col.key], col.format)}
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-sm" style={{ width: 100, minWidth: 100, maxWidth: 100 }}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditDialog(row)}
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1 rounded transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(row.uuid)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
      <div className="sticky bottom-0 z-20 flex-shrink-0 bg-white border-t px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {filteredAndSortedData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, filteredAndSortedData.length)} of{' '}
            {filteredAndSortedData.length} records
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

