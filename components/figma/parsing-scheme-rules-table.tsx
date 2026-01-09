'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Settings,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

type ParsingSchemeRule = {
  id: number;
  schemeUuid: string;
  scheme: string;
  condition: string;
  paymentId: string | null;
  counteragentUuid: string | null;
  financialCodeUuid: string | null;
  nominalCurrencyUuid: string | null;
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
  { key: 'scheme', label: 'Scheme', visible: true, sortable: true, filterable: true, width: 150 },
  { key: 'condition', label: 'Formula', visible: true, sortable: true, filterable: true, width: 400 },
  { key: 'paymentId', label: 'Payment ID', visible: true, sortable: true, filterable: true, width: 200 },
];

interface ParsingScheme {
  uuid: string;
  scheme: string;
}

export function ParsingSchemeRulesTable() {
  const [data, setData] = useState<ParsingSchemeRule[]>([]);
  const [schemes, setSchemes] = useState<ParsingScheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<ColumnKey>('scheme');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);
  const [filters, setFilters] = useState<Map<string, Set<any>>>(new Map());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [isResizing, setIsResizing] = useState<{ column: ColumnKey; startX: number; startWidth: number; element: HTMLElement } | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedSchemeFilter, setSelectedSchemeFilter] = useState<string>('');

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
      const response = await fetch('/api/parsing-scheme-rules');
      if (!response.ok) throw new Error('Failed to fetch rules');
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching rules:', error);
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

  const getUniqueValues = (columnKey: ColumnKey) => {
    const values = new Set(data.map(row => row[columnKey]));
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
    });
    setFormulaValidation(null);
    setShowExamples(false);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate either paymentId OR all three UUIDs are provided
    const hasPaymentId = !!formData.paymentId;
    const hasAllUuids = !!formData.counteragentUuid && !!formData.financialCodeUuid && !!formData.nominalCurrencyUuid;
    
    if (!hasPaymentId && !hasAllUuids) {
      alert('You must provide either:\n- Payment ID\nOR\n- All three UUIDs (Counteragent, Financial Code, and Nominal Currency)');
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

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      const response = await fetch(`/api/parsing-scheme-rules/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete rule');
      
      await fetchData();
    } catch (error) {
      console.error('Error deleting rule:', error);
      alert('Failed to delete rule');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-30 flex-shrink-0 bg-white border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-2xl font-bold text-gray-900">Parsing Scheme Rules</h1>
          
          <div className="flex items-center gap-3">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openAddDialog} className="gap-2 bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4" />
                  Add Rule
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
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
                      {/* Highlighted overlay for column names */}
                      <div 
                        className="absolute inset-0 px-3 py-2 font-mono text-sm pointer-events-none whitespace-pre-wrap break-words overflow-hidden rounded border-2 border-transparent"
                        style={{ 
                          lineHeight: '1.5',
                          color: 'transparent',
                          zIndex: 1
                        }}
                      >
                        {formData.condition.split(/(«[^»]+»)/g).map((part, i) => {
                          if (part.startsWith('«') && part.endsWith('»')) {
                            const columnName = part.slice(1, -1);
                            return (
                              <span 
                                key={i} 
                                className="bg-blue-200 text-blue-900 px-1 rounded"
                                style={{ color: '#1e40af' }}
                              >
                                {columnName}
                              </span>
                            );
                          }
                          return <span key={i}>{part}</span>;
                        })}
                      </div>
                      
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
                        className="relative w-full border-2 border-gray-400 rounded px-3 py-2 font-mono text-sm bg-transparent"
                        style={{ 
                          lineHeight: '1.5',
                          zIndex: 2,
                          resize: 'vertical'
                        }}
                      />
                      
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
                      Priority 2: All three UUIDs (counteragent, financial code, currency)
                    </p>
                    
                    <div className="space-y-4 border p-4 rounded">
                      <div>
                        <Label>Payment ID</Label>
                        <Input
                          value={formData.paymentId}
                          onChange={(e) => setFormData({ ...formData, paymentId: e.target.value })}
                          placeholder="e.g., SAL_001"
                          className="border-2 border-gray-400"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          The payment ID to assign when this rule matches
                        </p>
                      </div>

                      <div className="text-center text-sm text-gray-500 font-semibold">OR</div>

                      <div className="space-y-3">
                        <div>
                          <Label>Counteragent UUID</Label>
                          <Input
                            value={formData.counteragentUuid}
                            onChange={(e) => setFormData({ ...formData, counteragentUuid: e.target.value })}
                            placeholder="UUID of counteragent"
                            className="border-2 border-gray-400"
                          />
                        </div>

                        <div>
                          <Label>Financial Code UUID</Label>
                          <Input
                            value={formData.financialCodeUuid}
                            onChange={(e) => setFormData({ ...formData, financialCodeUuid: e.target.value })}
                            placeholder="UUID of financial code"
                            className="border-2 border-gray-400"
                          />
                        </div>

                        <div>
                          <Label>Nominal Currency UUID</Label>
                          <Input
                            value={formData.nominalCurrencyUuid}
                            onChange={(e) => setFormData({ ...formData, nominalCurrencyUuid: e.target.value })}
                            placeholder="UUID of nominal currency"
                            className="border-2 border-gray-400"
                          />
                        </div>
                        <p className="text-xs text-gray-500">
                          All three UUIDs must be provided if not using Payment ID
                        </p>
                      </div>
                    </div>
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
                    No rules found
                  </td>
                </tr>
              ) : (
                paginatedData.map((row) => (
                  <tr key={row.id} className="border-b border-gray-200 hover:bg-gray-50">
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
                          ) : (
                            row[col.key]
                          )}
                        </div>
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
                          onClick={() => handleDelete(row.id)}
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

  const filteredValues = useMemo(() => {
    if (!filterSearchTerm) return values;
    return values.filter(value => 
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

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    if (open) {
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
                onChange={(e) => setFilterSearchTerm(e.target.value)}
                className="pl-7 h-8 text-sm"
              />
            </div>

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
