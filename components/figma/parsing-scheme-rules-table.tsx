'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Settings,
  Plus,
  Pencil,
  Play,
  ChevronLeft,
  ChevronRight,
  Download,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { ColumnFilterPopover } from './shared/column-filter-popover';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Combobox } from '@/components/ui/combobox';
import { exportRowsToXlsx } from '@/lib/export-xlsx';

type ParsingSchemeRule = {
  id: number;
  schemeUuid: string;
  scheme: string;
  condition: string;
  paymentId: string | null;
  counteragentUuid: string | null;
  financialCodeUuid: string | null;
  nominalCurrencyUuid: string | null;
  counteragentName?: string | null;
  financialCode?: string | null;
  currencyCode?: string | null;
  appliedCount?: number;
  active: boolean;
};

type ColumnKey = keyof ParsingSchemeRule;

type ColumnConfig = {
  key: ColumnKey;
  label: string;
  visible: boolean;
  sortable: boolean;
  filterable: boolean;
  width: number;
};

const defaultColumns: ColumnConfig[] = [
  { key: 'id', label: 'ID', visible: false, sortable: true, filterable: true, width: 80 },
  { key: 'scheme', label: 'Scheme', visible: true, sortable: true, filterable: true, width: 150 },
  { key: 'condition', label: 'Formula', visible: true, sortable: true, filterable: true, width: 400 },
  { key: 'paymentId', label: 'Payment ID', visible: true, sortable: true, filterable: true, width: 200 },
  { key: 'counteragentName', label: 'Counteragent', visible: true, sortable: true, filterable: true, width: 220 },
  { key: 'financialCode', label: 'Financial Code', visible: true, sortable: true, filterable: true, width: 160 },
  { key: 'currencyCode', label: 'Currency', visible: true, sortable: true, filterable: true, width: 120 },
  { key: 'counteragentUuid', label: 'Counteragent UUID', visible: false, sortable: true, filterable: true, width: 200 },
  { key: 'financialCodeUuid', label: 'Financial Code UUID', visible: false, sortable: true, filterable: true, width: 150 },
  { key: 'nominalCurrencyUuid', label: 'Currency UUID', visible: false, sortable: true, filterable: true, width: 120 },
  { key: 'appliedCount', label: 'Applied to', visible: true, sortable: true, filterable: false, width: 100 },
];

interface ParsingScheme {
  uuid: string;
  scheme: string;
}

interface Counteragent {
  counteragent_uuid: string;
  counteragent: string;
  name: string;
  identification_number?: string;
}

interface FinancialCode {
  uuid: string;
  code: string;
  validation: string;
}

interface Currency {
  uuid: string;
  code: string;
  name: string;
}

interface Payment {
  paymentId: string;
  projectIndex: string | null;
  jobName: string | null;
  currencyCode: string | null;
  financialCodeValidation: string | null;
  counteragentName: string | null;
}

export function ParsingSchemeRulesTable() {
  const [data, setData] = useState<ParsingSchemeRule[]>([]);
  const [schemes, setSchemes] = useState<ParsingScheme[]>([]);
  const [counteragents, setCounteragents] = useState<Counteragent[]>([]);
  const [financialCodes, setFinancialCodes] = useState<FinancialCode[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<ColumnKey>('scheme');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);
  const [filters, setFilters] = useState<Map<string, Set<any>>>(new Map());
  const [isExporting, setIsExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [isResizing, setIsResizing] = useState<{ column: ColumnKey; startX: number; startWidth: number; element: HTMLElement } | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedSchemeFilter, setSelectedSchemeFilter] = useState<string>('');
  
  // Selection state
  const [selectedRules, setSelectedRules] = useState<Set<number>>(new Set());
  const [isRunningBatch, setIsRunningBatch] = useState(false);

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    schemeUuid: '',
    condition: '',
    paymentId: '',
    counteragentUuid: '',
    financialCodeUuid: '',
    nominalCurrencyUuid: '',
    active: true,
  });
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [formulaValidation, setFormulaValidation] = useState<{
    valid: boolean;
    error?: string;
    sqlPreview?: string;
  } | null>(null);
  const [validatingFormula, setValidatingFormula] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  
  // Autocomplete states
  const [autocompleteShow, setAutocompleteShow] = useState(false);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<string[]>([]);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const [atSymbolPosition, setAtSymbolPosition] = useState<number | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Test rule preview states
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [testDialogSearch, setTestDialogSearch] = useState('');
  const [testDialogPage, setTestDialogPage] = useState(1);
  const [testDialogPageSize, setTestDialogPageSize] = useState(100);
  const [testRuleData, setTestRuleData] = useState<{
    rule: ParsingSchemeRule | null;
    matchCount: number;
    records: any[];
    column: string;
    value: string;
  }>({
    rule: null,
    matchCount: 0,
    records: [],
    column: '',
    value: ''
  });

  // Load saved column configuration
  useEffect(() => {
    const saved = localStorage.getItem('parsingSchemeRulesColumns');
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
      fetchSchemes();
      fetchData();
    }
  }, [isInitialized]);

  // Save column configuration to localStorage
  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
      localStorage.setItem('parsingSchemeRulesColumns', JSON.stringify(columns));
    }
  }, [columns, isInitialized]);

  // Fetch columns when scheme is selected in form
  useEffect(() => {
    if (formData.schemeUuid) {
      fetchAvailableColumns(formData.schemeUuid);
    }
  }, [formData.schemeUuid]);

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

  const fetchSchemes = async () => {
    try {
      const response = await fetch('/api/parsing-schemes');
      if (!response.ok) throw new Error('Failed to fetch schemes');
      const result = await response.json();
      setSchemes(result);
    } catch (error) {
      console.error('Error fetching schemes:', error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rulesRes, counteragentsRes, financialCodesRes, currenciesRes, paymentsRes] = await Promise.all([
        fetch('/api/parsing-scheme-rules'),
        fetch('/api/counteragents'),
        fetch('/api/financial-codes?leafOnly=true'),
        fetch('/api/currencies'),
        fetch('/api/payments'),
      ]);
      
      if (!rulesRes.ok) throw new Error('Failed to fetch rules');
      const rules = await rulesRes.json();
      setData(rules);

      if (counteragentsRes.ok) {
        const counteragentsData = await counteragentsRes.json();
        // Map API response to Counteragent interface
        const mappedCounteragents = counteragentsData.map((ca: any) => ({
          counteragent_uuid: ca.counteragent_uuid,
          counteragent: ca.counteragent || ca.name,
          name: ca.name,
          identification_number: ca.identification_number
        }));
        setCounteragents(mappedCounteragents);
      }

      if (financialCodesRes.ok) {
        const financialCodesData = await financialCodesRes.json();
        setFinancialCodes(financialCodesData);
      }

      if (currenciesRes.ok) {
        const currenciesData = await currenciesRes.json();
        setCurrencies(currenciesData.data || []);
      }

      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        setPayments(paymentsData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableColumns = async (schemeUuid: string) => {
    try {
      setLoadingColumns(true);
      const response = await fetch(`/api/parsing-scheme-columns?schemeUuid=${schemeUuid}`);
      if (!response.ok) throw new Error('Failed to fetch columns');
      const result = await response.json();
      setAvailableColumns(result.columns || []);
    } catch (error) {
      console.error('Error fetching columns:', error);
      setAvailableColumns([]);
    } finally {
      setLoadingColumns(false);
    }
  };

  const validateFormula = async (formula: string) => {
    try {
      setValidatingFormula(true);
      
      // Strip the highlighting markers before validation
      const cleanFormula = formula.replace(/«|»/g, '');
      
      const response = await fetch('/api/validate-parsing-formula', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          formula: cleanFormula, 
          availableColumns 
        }),
      });
      
      if (!response.ok) throw new Error('Validation failed');
      
      const result = await response.json();
      setFormulaValidation(result);
    } catch (error) {
      console.error('Error validating formula:', error);
      setFormulaValidation({
        valid: false,
        error: 'Failed to validate formula'
      });
    } finally {
      setValidatingFormula(false);
    }
  };

  const handleFormulaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setFormData({ ...formData, condition: value });
    setFormulaValidation(null);

    // Check if @ is inside quotes (don't trigger autocomplete)
    const beforeCursor = value.substring(0, cursorPos);
    const quotesBeforeCursor = (beforeCursor.match(/"/g) || []).length;
    const singleQuotesBeforeCursor = (beforeCursor.match(/'/g) || []).length;
    const insideDoubleQuotes = quotesBeforeCursor % 2 !== 0;
    const insideSingleQuotes = singleQuotesBeforeCursor % 2 !== 0;
    
    if (insideDoubleQuotes || insideSingleQuotes) {
      setAutocompleteShow(false);
      return;
    }

    // Find @ symbol before cursor
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    // If @ found and is recent (not too far back)
    if (lastAtIndex !== -1 && cursorPos - lastAtIndex <= 50) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      
      // Check if there's whitespace or special chars after @, which means we're done with that mention
      if (/[\s(),="'<>]/.test(textAfterAt)) {
        setAutocompleteShow(false);
        return;
      }

      // Show autocomplete with available columns
      if (availableColumns.length > 0) {
        const searchTerm = textAfterAt.toLowerCase();
        const matches = searchTerm === '' 
          ? availableColumns // Show all if just @
          : availableColumns.filter(col => col.toLowerCase().includes(searchTerm));

        if (matches.length > 0) {
          const textarea = e.target;
          const style = window.getComputedStyle(textarea);
          const lineHeight = parseInt(style.lineHeight);
          const lines = textBeforeCursor.split('\n').length;
          
          setAutocompleteSuggestions(matches);
          setAutocompleteIndex(0);
          setAtSymbolPosition(lastAtIndex);
          setAutocompleteShow(true);
          setAutocompletePosition({
            top: lines * lineHeight,
            left: 10
          });
        } else {
          setAutocompleteShow(false);
        }
      }
    } else {
      setAutocompleteShow(false);
    }
  };

  const handleAutocompleteSelect = (suggestion: string) => {
    if (!textareaRef.current || atSymbolPosition === null) return;

    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const value = formData.condition;
    
    // Replace from @ to cursor with the suggestion wrapped in special markers
    const beforeAt = value.substring(0, atSymbolPosition);
    const afterCursor = value.substring(cursorPos);
    
    // Use special markers that we can later highlight: «columnname»
    const newValue = beforeAt + '«' + suggestion + '»' + afterCursor;
    const newCursorPos = atSymbolPosition + suggestion.length + 2; // +2 for the markers
    
    setFormData({ ...formData, condition: newValue });
    setAutocompleteShow(false);
    setAtSymbolPosition(null);
    
    // Set cursor position after insertion
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleFormulaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!autocompleteShow) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAutocompleteIndex(prev => 
        prev < autocompleteSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAutocompleteIndex(prev => prev > 0 ? prev - 1 : 0);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (autocompleteSuggestions.length > 0) {
        e.preventDefault();
        handleAutocompleteSelect(autocompleteSuggestions[autocompleteIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setAutocompleteShow(false);
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

  const visibleColumns = useMemo(() => columns.filter(col => col.visible), [columns]);

  const getFacetBaseData = (excludeColumn?: ColumnKey) => {
    let result = [...data];

    if (selectedSchemeFilter) {
      result = result.filter(row => row.schemeUuid === selectedSchemeFilter);
    }

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

    // Apply scheme filter from buttons
    if (selectedSchemeFilter) {
      result = result.filter(row => row.schemeUuid === selectedSchemeFilter);
    }

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
  }, [data, searchTerm, sortColumn, sortDirection, filters, selectedSchemeFilter]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAndSortedData.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredAndSortedData.length / pageSize);

  const handleExportXlsx = () => {
    if (filteredAndSortedData.length === 0) return;
    setIsExporting(true);
    try {
      const fileName = `parsing-scheme-rules_${new Date().toISOString().slice(0, 10)}.xlsx`;
      exportRowsToXlsx({
        rows: filteredAndSortedData,
        columns,
        fileName,
        sheetName: 'Parsing Scheme Rules',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const openAddDialog = () => {
    setIsEditMode(false);
    setEditingId(null);
    setFormData({
      schemeUuid: schemes[0]?.uuid || '',
      condition: '',
      paymentId: '',
      counteragentUuid: '',
      financialCodeUuid: '',
      nominalCurrencyUuid: '',
      active: true,
    });
    setFormulaValidation(null);
    setShowExamples(false);
    setIsDialogOpen(true);
  };

  const openEditDialog = (rule: ParsingSchemeRule) => {
    setIsEditMode(true);
    setEditingId(rule.id);
    setFormData({
      schemeUuid: rule.schemeUuid,
      condition: rule.condition,
      paymentId: rule.paymentId || '',
      counteragentUuid: rule.counteragentUuid || '',
      financialCodeUuid: rule.financialCodeUuid || '',
      nominalCurrencyUuid: rule.nominalCurrencyUuid || '',
      active: rule.active,
    });
    setFormulaValidation(null);
    setShowExamples(false);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate either paymentId OR counteragent (financial code and currency are optional)
    const hasPaymentId = !!formData.paymentId;
    const hasCounteragent = !!formData.counteragentUuid;
    
    if (!hasPaymentId && !hasCounteragent) {
      alert('You must provide either:\n- Payment ID\nOR\n- Counteragent (Financial Code and Currency are optional)');
      return;
    }
    
    // Validate formula before saving
    if (formData.condition) {
      await validateFormula(formData.condition);
      
      // Check if validation failed
      // Check if validation already failed
      if (formulaValidation && !formulaValidation.valid) {
        alert(`Cannot save: Formula validation failed\n\n${formulaValidation.error || 'Unknown error'}`);
        return;
      }
      
      // If validation hasn't run yet, run it now and wait for server response
      if (!formulaValidation) {
        try {
          const response = await fetch('/api/validate-parsing-formula', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              formula: formData.condition,
              availableColumns: availableColumns
            })
          });
          
          const result = await response.json();
          if (!result.valid) {
            alert(`Cannot save: Formula validation failed\n\n${result.error || 'Unknown error'}`);
            return;
          }
        } catch (error) {
          alert('Cannot save: Formula validation check failed');
          return;
        }
      }
    }
    
    try {
      const url = isEditMode ? `/api/parsing-scheme-rules/${editingId}` : '/api/parsing-scheme-rules';
      const method = isEditMode ? 'PUT' : 'POST';
      
      // Strip highlighting markers before saving
      const cleanFormData = {
        ...formData,
        condition: formData.condition.replace(/«|»/g, ''),
        // Only send payment_id OR the UUIDs based on priority
        paymentId: hasPaymentId ? formData.paymentId : null,
        counteragentUuid: hasPaymentId ? null : formData.counteragentUuid,
        financialCodeUuid: hasPaymentId ? null : formData.financialCodeUuid,
        nominalCurrencyUuid: hasPaymentId ? null : formData.nominalCurrencyUuid,
        active: formData.active,
      };
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanFormData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save rule');
      }
      
      await fetchData();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving rule:', error);
      alert(`Failed to save rule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleTestRule = async (rule: ParsingSchemeRule, applyRule: boolean = false) => {
    try {
      const response = await fetch('/api/parsing-scheme-rules/test-rule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ruleId: rule.id,
          apply: applyRule 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to test rule');
      }
      
      const result = await response.json();
      
      if (!applyRule) {
        // Show preview dialog with records
        setTestRuleData({
          rule,
          matchCount: result.matchCount,
          records: result.records || [],
          column: result.column || '',
          value: result.value || ''
        });
        setIsTestDialogOpen(true);
      } else {
        // Rule was applied
        alert(`Successfully applied rule to ${result.matchCount} records`);
        setIsTestDialogOpen(false);
        await fetchData();
      }
    } catch (error) {
      console.error('Error testing/applying rule:', error);
      alert(`Failed to test/apply rule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleApplyRule = async () => {
    if (testRuleData.rule) {
      await handleTestRule(testRuleData.rule, true);
    }
  };

  const handleBatchRun = async () => {
    if (selectedRules.size === 0) return;
    
    setIsRunningBatch(true);
    try {
      const response = await fetch('/api/parsing-scheme-rules/batch-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleIds: Array.from(selectedRules) })
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(`Successfully processed ${result.results.length} rules:\n${result.results.map((r: any) => `Rule ${r.ruleId}: ${r.matchedRecords} records`).join('\n')}`);
        setSelectedRules(new Set()); // Clear selection
        fetchData(); // Refresh data
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Batch run error:', error);
      alert('Failed to run batch operation');
    } finally {
      setIsRunningBatch(false);
    }
  };

  const handleToggleRule = (ruleId: number) => {
    const newSelected = new Set(selectedRules);
    if (newSelected.has(ruleId)) {
      newSelected.delete(ruleId);
    } else {
      newSelected.add(ruleId);
    }
    setSelectedRules(newSelected);
  };

  const handleToggleAll = () => {
    if (selectedRules.size === filteredAndSortedData.length) {
      setSelectedRules(new Set());
    } else {
      setSelectedRules(new Set(filteredAndSortedData.map(r => r.id)));
    }
  };

  // Debug log
  console.log('ParsingSchemeRulesTable: selectedRules size =', selectedRules.size, 'filteredAndSortedData length =', filteredAndSortedData.length);
  console.log('Checkbox component:', Checkbox);
  console.log('handleToggleAll function:', handleToggleAll);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-30 flex-shrink-0 bg-white border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-2xl font-bold text-gray-900">Parsing Scheme Rules</h1>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportXlsx}
              disabled={isExporting || filteredAndSortedData.length === 0}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              {isExporting ? 'Exporting...' : 'Export XLSX'}
            </Button>
            {selectedRules.size > 0 && (
              <Button 
                onClick={handleBatchRun} 
                disabled={isRunningBatch}
                className="gap-2 bg-purple-600 hover:bg-purple-700"
              >
                <Play className="w-4 h-4" />
                {isRunningBatch ? `Running ${selectedRules.size} rules...` : `Run ${selectedRules.size} Selected Rules`}
              </Button>
            )}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openAddDialog} className="gap-2 bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4" />
                  Add Rule
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[1400px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{isEditMode ? 'Edit Rule' : 'Add Rule'}</DialogTitle>
                  <DialogDescription>
                    {isEditMode ? 'Update parsing rule details' : 'Create a new parsing rule'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Parsing Scheme <span className="text-red-500">*</span></Label>
                    <Select
                      value={formData.schemeUuid}
                      onValueChange={(value) => setFormData({ ...formData, schemeUuid: value })}
                      required
                    >
                      <SelectTrigger className="border-2 border-gray-400">
                        <SelectValue placeholder="Select scheme" />
                      </SelectTrigger>
                      <SelectContent>
                        {schemes.map((scheme) => (
                          <SelectItem key={scheme.uuid} value={scheme.uuid}>
                            {scheme.scheme}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Condition Formula <span className="text-red-500">*</span></Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowExamples(!showExamples)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        {showExamples ? 'Hide' : 'Show'} Examples
                      </Button>
                    </div>
                    
                    {showExamples && (
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded text-xs space-y-2">
                        <p className="font-semibold text-gray-700">Formula Examples (Type <span className="font-mono bg-white px-1 border">@</span> for columns):</p>
                        <div className="space-y-1 font-mono text-gray-600">
                          <p><strong>Type @:</strong> Shows all available columns</p>
                          <p><strong>Type @doc:</strong> Shows columns starting with &quot;doc&quot;</p>
                          <p><strong>Single column:</strong> SEARCH(&quot;გიორგი&quot;, <span className="bg-blue-200 px-1">@docsendername</span>)</p>
                          <p><strong>Multiple columns:</strong> OR(SEARCH(&quot;salary&quot;, <span className="bg-blue-200 px-1">@docinformation</span>), SEARCH(&quot;ხელფასი&quot;, <span className="bg-blue-200 px-1">@docsendername</span>))</p>
                          <p><strong>Amount + currency:</strong> AND(<span className="bg-blue-200 px-1">@docsrcamt</span> &gt; 1000, <span className="bg-blue-200 px-1">@docsrcccy</span> = &quot;GEL&quot;)</p>
                          <p><strong>Literal @ in string:</strong> <span className="bg-blue-200 px-1">@docinformation</span> = &quot;@company.com&quot;</p>
                        </div>
                        <p className="text-gray-600 pt-1">
                          <strong>Supported:</strong> OR, AND, NOT, SEARCH, EXACT, LEN, LEFT, RIGHT, UPPER, LOWER, ISBLANK, ISEMPTY<br/>
                          <strong>Note:</strong> @ inside quotes (&quot;@&quot;) is treated as literal text
                        </p>
                      </div>
                    )}

                    <div className="relative">
                      <textarea
                        ref={textareaRef}
                        value={formData.condition}
                        onChange={handleFormulaChange}
                        onKeyDown={handleFormulaKeyDown}
                        onBlur={() => {
                          // Delay to allow click on autocomplete
                          setTimeout(() => {
                            setAutocompleteShow(false);
                            if (formData.condition) {
                              validateFormula(formData.condition);
                            }
                          }, 200);
                        }}
                        placeholder="Type @ to insert column names..."
                        required
                        rows={3}
                        className="relative w-full border-2 border-gray-400 rounded px-3 py-2 font-mono text-sm"
                        style={{ 
                          lineHeight: '1.5',
                          resize: 'vertical',
                          color: 'transparent',
                          caretColor: '#000',
                          backgroundColor: 'white'
                        }}
                      />
                      
                      {/* Highlighted overlay for column names */}
                      <div 
                        className="absolute inset-0 px-3 py-2 font-mono text-sm pointer-events-none whitespace-pre-wrap overflow-hidden"
                        style={{ 
                          lineHeight: '1.5',
                          wordBreak: 'break-word'
                        }}
                      >
                        {formData.condition.split(/(«[^»]+»)/g).map((part, i) => {
                          if (part.startsWith('«') && part.endsWith('»')) {
                            const columnName = part.slice(1, -1);
                            return (
                              <span 
                                key={i} 
                                className="bg-blue-100 px-1 rounded"
                                style={{ 
                                  color: '#111827'
                                }}
                              >
                                {columnName}
                              </span>
                            );
                          }
                          return <span key={i}>{part}</span>;
                        })}
                      </div>
                      
                      {/* Autocomplete Dropdown */}
                      {autocompleteShow && autocompleteSuggestions.length > 0 && (
                        <div 
                          className="absolute z-50 bg-white border-2 border-blue-500 rounded shadow-lg max-h-64 overflow-y-auto"
                          style={{
                            top: `${autocompletePosition.top + 28}px`,
                            left: `${autocompletePosition.left}px`,
                            minWidth: '250px'
                          }}
                        >
                          <div className="px-2 py-1 bg-blue-50 border-b border-blue-200 text-xs text-blue-700 font-semibold">
                            Select Column ({autocompleteSuggestions.length})
                          </div>
                          {autocompleteSuggestions.map((suggestion, index) => (
                            <div
                              key={suggestion}
                              className={`px-3 py-2 cursor-pointer font-mono text-sm border-b border-gray-100 ${
                                index === autocompleteIndex
                                  ? 'bg-blue-500 text-white'
                                  : 'hover:bg-blue-50'
                              }`}
                              onMouseDown={(e) => {
                                e.preventDefault(); // Prevent blur
                                handleAutocompleteSelect(suggestion);
                              }}
                              onMouseEnter={() => setAutocompleteIndex(index)}
                            >
                              <div className="flex items-center gap-2">
                                <span className={index === autocompleteIndex ? 'text-white' : 'text-blue-600'}>
                                  {index === autocompleteIndex ? '▶' : '•'}
                                </span>
                                {suggestion}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {availableColumns.length > 0 && (
                      <p className="text-xs text-blue-600 flex items-center gap-1">
                        <span className="font-bold">@</span> Type <span className="font-mono bg-gray-100 px-1 rounded">@</span> to insert column names • Selected columns appear highlighted
                      </p>
                    )}
                    
                    {validatingFormula && (
                      <p className="text-xs text-blue-600">Validating formula...</p>
                    )}
                    
                    {formulaValidation && !validatingFormula && (
                      <div className={`p-2 rounded text-xs ${
                        formulaValidation.valid 
                          ? 'bg-green-50 border border-green-200 text-green-700' 
                          : 'bg-red-50 border border-red-200 text-red-700'
                      }`}>
                        {formulaValidation.valid ? (
                          <div>
                            <p className="font-semibold">✓ Valid formula</p>
                            {formulaValidation.sqlPreview && (
                              <p className="mt-1 font-mono text-xs">SQL: {formulaValidation.sqlPreview}</p>
                            )}
                          </div>
                        ) : (
                          <p><strong>✗ Error:</strong> {formulaValidation.error}</p>
                        )}
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-500">
                      Excel-style formula to match transaction records. Use column names from the selected scheme.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Assignment (choose one option)</Label>
                    <p className="text-xs text-gray-500 mb-3">
                      Priority 1: Payment ID (if provided, UUIDs are ignored)<br/>
                      Priority 2: Counteragent + Financial Code (currency optional)
                    </p>
                    
                    <div className="space-y-4 border p-4 rounded">
                      <div>
                        <Label>Payment ID</Label>
                        <Combobox
                          value={formData.paymentId}
                          onValueChange={(value: string) => setFormData({ ...formData, paymentId: value })}
                          options={payments.map((payment, index) => ({
                            value: payment.paymentId,
                            label: `${payment.paymentId} | ${payment.counteragentName || '-'} | ${payment.currencyCode || '-'} | ${payment.projectIndex || '-'}${payment.jobName ? ` | ${payment.jobName}` : ''} | ${payment.financialCodeValidation || '-'}`,
                            keywords: `${payment.paymentId} ${payment.counteragentName} ${payment.projectIndex} ${payment.jobName}`.toLowerCase()
                          }))}
                          placeholder="Select payment ID..."
                          searchPlaceholder="Search payments..."
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          The payment ID to assign when this rule matches
                        </p>
                      </div>

                      <div className="text-center text-sm text-gray-500 font-semibold">OR</div>

                      <div className="space-y-3">
                        <div>
                          <Label>Counteragent <span className="text-red-500">*</span></Label>
                          <Combobox
                            value={formData.counteragentUuid}
                            onValueChange={(value: string) => setFormData({ ...formData, counteragentUuid: value })}
                            options={counteragents.map(ca => ({
                              value: ca.counteragent_uuid,
                              label: ca.counteragent || ca.name,
                              keywords: `${ca.counteragent} ${ca.name} ${ca.identification_number || ''}`.toLowerCase(),
                              displayLabel: `${ca.counteragent || ca.name}${ca.identification_number ? ` (ს.კ. ${ca.identification_number})` : ''}`
                            }))}
                            placeholder="Select counteragent..."
                            searchPlaceholder="Search counteragents..."
                          />
                        </div>

                        <div>
                          <Label>Financial Code <span className="text-gray-400">(optional)</span></Label>
                          <Combobox
                            value={formData.financialCodeUuid}
                            onValueChange={(value: string) => setFormData({ ...formData, financialCodeUuid: value })}
                            options={financialCodes.map(fc => ({
                              value: fc.uuid,
                              label: `${fc.validation} (${fc.code})`
                            }))}
                            placeholder="Select financial code (optional)..."
                            searchPlaceholder="Search financial codes..."
                          />
                        </div>

                        <div>
                          <Label>Nominal Currency <span className="text-gray-400">(optional)</span></Label>
                          <Combobox
                            value={formData.nominalCurrencyUuid}
                            onValueChange={(value: string) => setFormData({ ...formData, nominalCurrencyUuid: value })}
                            options={currencies.map(c => ({
                              value: c.uuid,
                              label: `${c.name} (${c.code})`
                            }))}
                            placeholder="Select currency (optional)..."
                            searchPlaceholder="Search currencies..."
                          />
                        </div>
                        <p className="text-xs text-gray-500">
                          Counteragent is required. Financial Code and Currency are optional.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Active</Label>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${formData.active ? 'text-green-600' : 'text-gray-400'}`}>
                          {formData.active ? 'ON' : 'OFF'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, active: !formData.active })}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            formData.active ? 'bg-green-600' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              formData.active ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      Only active rules are applied during processing.
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
          </div>
        </div>

        {/* Scheme Filter Buttons */}
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto">
          <Button
            variant={selectedSchemeFilter === '' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedSchemeFilter('')}
          >
            All Schemes
          </Button>
          {schemes.map((scheme) => (
            <Button
              key={scheme.uuid}
              variant={selectedSchemeFilter === scheme.uuid ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedSchemeFilter(scheme.uuid)}
            >
              {scheme.scheme}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 p-4 overflow-hidden">
        <div className="h-full overflow-auto rounded-lg border bg-white">
          <table style={{ tableLayout: 'fixed', width: '100%' }} className="border-collapse">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b-2 border-gray-200">
                <th 
                  className="px-4 py-3 text-center text-sm font-semibold"
                  style={{ width: 60, minWidth: 60, maxWidth: 60 }}
                >
                  <Checkbox
                    checked={selectedRules.size === filteredAndSortedData.length && filteredAndSortedData.length > 0}
                    onCheckedChange={handleToggleAll}
                  />
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
                  <td colSpan={visibleColumns.length + 2} className="text-center py-8 px-4">
                    Loading...
                  </td>
                </tr>
              ) : filteredAndSortedData.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 2} className="text-center py-8 px-4 text-gray-500">
                    No rules found
                  </td>
                </tr>
              ) : (
                paginatedData.map((row) => (
                  <tr key={row.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-2 text-center text-sm" style={{ width: 60, minWidth: 60, maxWidth: 60 }}>
                      <Checkbox
                        checked={selectedRules.has(row.id)}
                        onCheckedChange={() => handleToggleRule(row.id)}
                      />
                    </td>
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
                        <div className="truncate">
                          {col.key === 'condition' ? (
                            <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                              {row[col.key]}
                            </code>
                          ) : col.key === 'appliedCount' ? (
                            <span className="font-semibold">
                              {row.appliedCount || 0}
                            </span>
                          ) : col.key === 'paymentId' && row[col.key] ? (
                            (() => {
                              const payment = payments.find(p => p.paymentId === row[col.key]);
                              return payment ? (
                                <span title={`${payment.paymentId} | ${payment.counteragentName || '-'} | ${payment.currencyCode || '-'} | ${payment.projectIndex || '-'}${payment.jobName ? ` | ${payment.jobName}` : ''} | ${payment.financialCodeValidation || '-'}`}>
                                  {payment.paymentId}
                                  <span className="text-muted-foreground text-xs">
                                    {' | '}{payment.counteragentName || '-'}
                                    {' | '}{payment.currencyCode || '-'}
                                    {' | '}{payment.projectIndex || '-'}
                                    {payment.jobName && ` | ${payment.jobName}`}
                                    {' | '}{payment.financialCodeValidation || '-'}
                                  </span>
                                </span>
                              ) : row[col.key];
                            })()
                          ) : col.key === 'counteragentUuid' && row[col.key] ? (
                            <span title={row.counteragentName || row[col.key] as string}>
                              {row.counteragentName || row[col.key]}
                            </span>
                          ) : col.key === 'financialCodeUuid' && row[col.key] ? (
                            <span title={row.financialCode || row[col.key] as string}>
                              {row.financialCode || row[col.key]}
                            </span>
                          ) : col.key === 'nominalCurrencyUuid' && row[col.key] ? (
                            <span title={row.currencyCode || row[col.key] as string}>
                              {row.currencyCode || row[col.key]}
                            </span>
                          ) : (
                            row[col.key]
                          )}
                        </div>
                      </td>
                    ))}
                    <td className="px-4 py-2 text-sm" style={{ width: 100, minWidth: 100, maxWidth: 100 }}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleTestRule(row)}
                          className="text-purple-600 hover:text-purple-800 hover:bg-purple-50 p-1 rounded transition-colors"
                          title="Test and apply rule"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditDialog(row)}
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1 rounded transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
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
            {filteredAndSortedData.length} rules
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

      {/* Test Rule Preview Dialog */}
      <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
        {(() => {
          // Format date helper
          const formatDate = (dateStr: string) => {
            if (!dateStr) return '-';
            try {
              // Parse various date formats (YYYY-MM-DD, DD/MM/YYYY, etc.)
              const parts = dateStr.match(/(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})/);
              if (!parts) return dateStr;
              
              let day, month, year;
              if (parts[1].length === 4) {
                // YYYY-MM-DD or YYYY/MM/DD
                year = parts[1];
                month = parts[2].padStart(2, '0');
                day = parts[3].padStart(2, '0');
              } else {
                // DD-MM-YYYY or DD/MM/YYYY  
                day = parts[1].padStart(2, '0');
                month = parts[2].padStart(2, '0');
                year = parts[3];
              }
              return `${day}.${month}.${year}`;
            } catch {
              return dateStr;
            }
          };
          
          // Filter records based on search
          const filteredRecords = testRuleData.records.filter(record => {
            if (!testDialogSearch) return true;
            const searchLower = testDialogSearch.toLowerCase();
            return (
              record.description?.toLowerCase().includes(searchLower) ||
              record.sender_name?.toLowerCase().includes(searchLower) ||
              record.beneficiary_name?.toLowerCase().includes(searchLower) ||
              record.sender_account?.toLowerCase().includes(searchLower) ||
              record.beneficiary_account?.toLowerCase().includes(searchLower) ||
              formatDate(record.transaction_date)?.includes(searchLower)
            );
          });
          
          // Pagination
          const totalPages = Math.ceil(filteredRecords.length / testDialogPageSize);
          const startIndex = (testDialogPage - 1) * testDialogPageSize;
          const endIndex = startIndex + testDialogPageSize;
          const paginatedRecords = filteredRecords.slice(startIndex, endIndex);
          
          return (<>
        <DialogContent className="w-[1600px] max-w-[98vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Rule Preview: {testRuleData.matchCount} Matching Records</DialogTitle>
            <DialogDescription>
              Found {testRuleData.matchCount} records where <span className="font-mono">{testRuleData.column}</span> = "{testRuleData.value}"
            </DialogDescription>
            <div className="mt-4 flex gap-4 items-center">
              <Input
                placeholder="Search in results..."
                value={testDialogSearch}
                onChange={(e) => { setTestDialogSearch(e.target.value); setTestDialogPage(1); }}
                className="max-w-sm"
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Records per page:</span>
                <Select value={testDialogPageSize.toString()} onValueChange={(val) => { setTestDialogPageSize(Number(val)); setTestDialogPage(1); }}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {testDialogSearch && (
                <div className="text-sm text-gray-600">
                  {filteredRecords.length} result{filteredRecords.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto border rounded">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-100 border-b">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold">Date</th>
                  <th className="px-2 py-2 text-right font-semibold">Debit</th>
                  <th className="px-2 py-2 text-right font-semibold">Credit</th>
                  <th className="px-2 py-2 text-left font-semibold">Description</th>
                  <th className="px-2 py-2 text-left font-semibold">Sender</th>
                  <th className="px-2 py-2 text-left font-semibold">Beneficiary</th>
                  <th className="px-2 py-2 text-left font-semibold">Case</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-2 py-8 text-center text-gray-500">
                      {testDialogSearch ? 'No records match your search' : 'No matching records found'}
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((record, index) => (
                    <tr key={record.uuid || index} className="border-b hover:bg-gray-50">
                      <td className="px-2 py-2 whitespace-nowrap">
                        {formatDate(record.transaction_date)}
                      </td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">
                        {record.debit ? Number(record.debit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                      </td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">
                        {record.credit ? Number(record.credit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                      </td>
                      <td className="px-2 py-2 max-w-xs truncate" title={record.description}>
                        {record.description || '-'}
                      </td>
                      <td className="px-2 py-2">
                        <div className="max-w-xs truncate" title={record.sender_name}>
                          {record.sender_name || '-'}
                        </div>
                        <div className="text-xs text-gray-500 truncate" title={record.sender_account}>
                          {record.sender_account || ''}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="max-w-xs truncate" title={record.beneficiary_name}>
                          {record.beneficiary_name || '-'}
                        </div>
                        <div className="text-xs text-gray-500 truncate" title={record.beneficiary_account}>
                          {record.beneficiary_account || ''}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-xs">
                        <span className={`px-1.5 py-0.5 rounded ${
                          record.processing_case?.includes('Case 6') ? 'bg-purple-100 text-purple-700' :
                          record.processing_case?.includes('Case 1') ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {record.processing_case || 'Unknown'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <DialogFooter className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                {filteredRecords.length > 0 && (
                  <span>
                    Showing {startIndex + 1}-{Math.min(endIndex, filteredRecords.length)} of {filteredRecords.length} records
                    {testDialogSearch && ' (filtered)'}
                  </span>
                )}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTestDialogPage(p => Math.max(1, p - 1))}
                    disabled={testDialogPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm">
                    Page {testDialogPage} of {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTestDialogPage(p => Math.min(totalPages, p + 1))}
                    disabled={testDialogPage === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setIsTestDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="button" 
                className="bg-green-600 hover:bg-green-700"
                onClick={handleApplyRule}
                disabled={testRuleData.matchCount === 0}
              >
                Apply Rule to All {testRuleData.matchCount} Records
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
        </>) 
        })()}
      </Dialog>
    </div>
  );
}

