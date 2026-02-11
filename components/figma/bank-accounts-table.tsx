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
import { loadFilterMap, saveFilterMap, clearColumnFilters } from './shared/column-filter-storage';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { exportRowsToXlsx } from '@/lib/export-xlsx';

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
  parsingSchemeUuid: string | null;
  parsingSchemeName: string | null;
  rawTableName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
  { key: 'balance', label: 'Balance', visible: true, sortable: true, filterable: false, format: 'currency', width: 150 },
  { key: 'balanceDate', label: 'Balance Date', visible: true, sortable: true, filterable: false, format: 'date', width: 130 },
  { key: 'parsingSchemeName', label: 'Parsing Scheme', visible: true, sortable: true, filterable: true, width: 150 },
  { key: 'rawTableName', label: 'Raw Data Table', visible: true, sortable: true, filterable: true, width: 200 },
  { key: 'isActive', label: 'Status', visible: true, sortable: true, filterable: true, format: 'boolean', width: 100 },
  { key: 'createdAt', label: 'Created', visible: false, sortable: true, filterable: false, format: 'date', width: 150 },
];

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
  const [data, setData] = useState<BankAccount[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [parsingSchemes, setParsingSchemes] = useState<ParsingScheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<ColumnKey>('accountNumber');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);
  const filtersStorageKey = 'filters:bank-accounts';
  const [filters, setFilters] = useState<Map<string, Set<any>>>(() => loadFilterMap(filtersStorageKey));
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [isResizing, setIsResizing] = useState<{ column: ColumnKey; startX: number; startWidth: number; element: HTMLElement } | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    accountNumber: '',
    currencyUuid: '',
    bankUuid: '',
    balance: '',
    balanceDate: '',
    rawTableName: '',
    parsingSchemeUuid: '',
  });

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
    }
  }, [isInitialized]);

  // Save column configuration to localStorage
  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
      localStorage.setItem('bankAccountsColumns', JSON.stringify(columns));
    }
  }, [columns, isInitialized]);

  useEffect(() => {
    saveFilterMap(filtersStorageKey, filters);
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
      const response = await fetch('/api/bank-accounts');
      if (!response.ok) throw new Error('Failed to fetch bank accounts');
      const result = await response.json();
      setData(result);
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
      setCurrencies(result.filter((c: Currency & { isActive: boolean }) => c.isActive));
    } catch (error) {
      console.error('Error fetching currencies:', error);
    }
  };

  const fetchBanks = async () => {
    try {
      const response = await fetch('/api/banks');
      if (!response.ok) throw new Error('Failed to fetch banks');
      const result = await response.json();
      setBanks(result.filter((b: Bank & { isActive: boolean }) => b.isActive));
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

    filters.forEach((filterValues, columnKey) => {
      if (excludeColumn && columnKey === excludeColumn) return;
      if (filterValues.size > 0) {
        result = result.filter(row => filterValues.has(row[columnKey as ColumnKey]));
      }
    });

    return result;
  };

  const getUniqueValues = (columnKey: ColumnKey) => {
    const values = new Set(getFacetBaseData(columnKey).map(row => row[columnKey]));
    return Array.from(values).filter(v => v !== null && v !== undefined);
  };

  const handleFilterChange = (columnKey: string, values: Set<any>) => {
    setFilters(prev => {
      const newFilters = new Map(prev);
      if (values.size === 0) {
        newFilters.delete(columnKey);
      } else {
        newFilters.set(columnKey, values);
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
    filters.forEach((filterValues, columnKey) => {
      if (filterValues.size > 0) {
        result = result.filter(row => filterValues.has(row[columnKey as ColumnKey]));
      }
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

  const openAddDialog = () => {
    setIsEditMode(false);
    setEditingId(null);
    setFormData({
      accountNumber: '',
      currencyUuid: '',
      bankUuid: '',
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
          <h1 className="text-2xl font-bold text-gray-900">Bank Accounts</h1>
          
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

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFilters(new Map());
                clearColumnFilters(filtersStorageKey);
              }}
            >
              Clear Filters
            </Button>
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
                          activeFilters={filters.get(col.key) || new Set()}
                          onFilterChange={(values) => handleFilterChange(col.key, values)}
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
                            {formatValue(row[col.key], col.format)}
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

