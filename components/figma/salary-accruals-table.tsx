'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Save, 
  X,
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

type SalaryAccrual = {
  id: string;
  uuid: string;
  counteragent_uuid: string;
  counteragent_name: string;
  financial_code_uuid: string;
  financial_code: string;
  nominal_currency_uuid: string;
  currency_code: string;
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
  month_balance?: number; // net_sum - paid
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
      fetchEmployees();
      fetchFinancialCodes();
      fetchCurrencies();
    }
  }, [isInitialized]);

  // Save column configuration to localStorage
  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
      localStorage.setItem('salaryAccrualsColumns', JSON.stringify(columns));
    }
  }, [columns, isInitialized]);

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

  useEffect(() => {
    fetchData();
    fetchEmployees();
    fetchFinancialCodes();
    fetchCurrencies();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch salary accruals
      const response = await fetch('/api/salary-accruals');
      if (!response.ok) throw new Error('Failed to fetch data');
      const salaryData = await response.json();
      
      // Fetch bank transactions to calculate paid amounts
      const txResponse = await fetch('/api/bank-transactions?limit=10000');
      const txResult = await txResponse.json();
      const transactions = txResult.data || txResult;
      
      // Create a map of payment_id to total paid amount (absolute value)
      // Use lowercase keys for case-insensitive matching
      const paidMap = new Map<string, number>();
      transactions.forEach((tx: any) => {
        const paymentId = tx.payment_id || tx.paymentId;
        if (paymentId) {
          const paymentIdLower = paymentId.toLowerCase(); // Normalize to lowercase
          const amount = Math.abs(parseFloat(tx.account_currency_amount || tx.accountCurrencyAmount || '0'));
          paidMap.set(paymentIdLower, (paidMap.get(paymentIdLower) || 0) + amount);
        }
      });
      
      // Calculate paid and month_balance for each salary accrual
      const enrichedData = salaryData.map((accrual: SalaryAccrual) => {
        const netSum = parseFloat(accrual.net_sum || '0');
        const paymentIdLower = accrual.payment_id ? accrual.payment_id.toLowerCase() : ''; // Normalize to lowercase
        const paid = paidMap.get(paymentIdLower) || 0;
        const monthBalance = netSum - paid;
        
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

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchData();
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

      fetchData();
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
          const rowValue = row[columnKey as ColumnKey];
          if (!allowedValues.has(rowValue)) {
            return false;
          }
        }
        return true;
      });
    }

    // Apply sort
    result.sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      
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
      const values = new Set(data.map(row => row[col.key]));
      cache.set(col.key, Array.from(values).sort());
    });
    
    return cache;
  }, [data, columns]);

  const getUniqueValues = useCallback((columnKey: ColumnKey): any[] => {
    return uniqueValuesCache.get(columnKey) || [];
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

  // Calculate totals
  const totals = useMemo(() => {
    return filteredAndSortedData.reduce((acc, row) => ({
      net_sum: acc.net_sum + (parseFloat(row.net_sum) || 0),
      paid: acc.paid + (row.paid || 0),
      month_balance: acc.month_balance + (row.month_balance || 0),
      surplus_insurance: acc.surplus_insurance + (parseFloat(row.surplus_insurance || '0') || 0),
      deducted_insurance: acc.deducted_insurance + (parseFloat(row.deducted_insurance || '0') || 0),
      deducted_fitness: acc.deducted_fitness + (parseFloat(row.deducted_fitness || '0') || 0),
      deducted_fine: acc.deducted_fine + (parseFloat(row.deducted_fine || '0') || 0),
    }), { 
      net_sum: 0,
      paid: 0,
      month_balance: 0,
      surplus_insurance: 0, 
      deducted_insurance: 0, 
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
            {totalPages > 1 && (
              <span className="text-sm text-gray-500">
                Page {currentPage} of {totalPages}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
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
              {formatValue(totals.net_sum, 'currency')}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Total Paid:</span>
            <span className="ml-2 font-semibold text-green-900">
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
            <span className="text-gray-600">Total Surplus Ins.:</span>
            <span className="ml-2 font-semibold text-blue-900">
              {formatValue(totals.surplus_insurance, 'currency')}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Total Ded. Ins.:</span>
            <span className="ml-2 font-semibold text-blue-900">
              {formatValue(totals.deducted_insurance, 'currency')}
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
                paginatedData.map((accrual, idx) => (
                  <tr key={`${accrual.id}-${idx}`} className="border-b border-gray-200 hover:bg-gray-50">
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
                        <div className="truncate">
                          {formatValue(accrual[col.key], col.format)}
                        </div>
                      </td>
                    ))}
                    <td className="px-4 py-2 text-sm" style={{ width: 100, minWidth: 100, maxWidth: 100 }}>
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(accrual)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
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
    return values.filter(value => 
      String(value).toLowerCase().includes(filterSearchTerm.toLowerCase())
    );
  }, [values, filterSearchTerm]);

  // Sort values - numbers first, then text
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
                sortedFilteredValues.map(value => (
                  <div key={String(value)} className="flex items-center space-x-2 py-1">
                    <Checkbox
                      id={`${columnKey}-${value}`}
                      checked={tempSelected.has(value)}
                      onCheckedChange={() => handleToggle(value)}
                    />
                    <label htmlFor={`${columnKey}-${value}`} className="text-sm flex-1 cursor-pointer">
                      {String(value)}
                    </label>
                  </div>
                ))
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
