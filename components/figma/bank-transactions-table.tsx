import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';

export type BankTransaction = {
  id: number;
  uuid: string;
  accountUuid: string;
  accountCurrencyUuid: string;
  accountCurrencyAmount: string;
  paymentUuid: string | null;
  counteragentUuid: string | null;
  projectUuid: string | null;
  financialCodeUuid: string | null;
  nominalCurrencyUuid: string | null;
  nominalAmount: string | null;
  date: string;
  correctionDate: string | null;
  id1: string | null;
  id2: string | null;
  recordUuid: string;
  counteragentAccountNumber: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  
  // Display fields (from joins)
  accountNumber: string | null;
  bankName: string | null;
  counteragentName: string | null;
  projectIndex: string | null;
  financialCode: string | null;
  paymentId: string | null;
};

type ColumnKey = keyof BankTransaction;

type ColumnConfig = {
  key: ColumnKey;
  label: string;
  width: number;
  visible: boolean;
  sortable: boolean;
  filterable: boolean;
  responsive?: 'sm' | 'md' | 'lg' | 'xl';
};

const defaultColumns: ColumnConfig[] = [
  { key: 'id', label: 'ID', width: 80, visible: false, sortable: true, filterable: true },
  { key: 'date', label: 'Date', width: 120, visible: true, sortable: true, filterable: true },
  { key: 'accountNumber', label: 'Account', width: 180, visible: true, sortable: true, filterable: true },
  { key: 'bankName', label: 'Bank', width: 150, visible: true, sortable: true, filterable: true },
  { key: 'accountCurrencyAmount', label: 'Amount', width: 120, visible: true, sortable: true, filterable: true },
  { key: 'counteragentName', label: 'Counteragent', width: 200, visible: true, sortable: true, filterable: true },
  { key: 'counteragentAccountNumber', label: 'CA Account', width: 180, visible: true, sortable: true, filterable: true },
  { key: 'projectIndex', label: 'Project', width: 120, visible: true, sortable: true, filterable: true },
  { key: 'financialCode', label: 'Fin. Code', width: 100, visible: true, sortable: true, filterable: true },
  { key: 'paymentId', label: 'Payment ID', width: 140, visible: true, sortable: true, filterable: true },
  { key: 'description', label: 'Description', width: 300, visible: true, sortable: true, filterable: true },
  { key: 'nominalAmount', label: 'Nominal Amt', width: 120, visible: false, sortable: true, filterable: true },
  { key: 'correctionDate', label: 'Correction Date', width: 120, visible: false, sortable: true, filterable: true },
  { key: 'id1', label: 'DocKey', width: 120, visible: false, sortable: true, filterable: true },
  { key: 'id2', label: 'EntriesId', width: 120, visible: false, sortable: true, filterable: true },
  { key: 'recordUuid', label: 'Record UUID', width: 200, visible: false, sortable: true, filterable: true },
  { key: 'uuid', label: 'UUID', width: 200, visible: false, sortable: true, filterable: true },
  { key: 'accountUuid', label: 'Account UUID', width: 200, visible: false, sortable: true, filterable: true },
  { key: 'accountCurrencyUuid', label: 'Currency UUID', width: 200, visible: false, sortable: true, filterable: true },
  { key: 'paymentUuid', label: 'Payment UUID', width: 200, visible: false, sortable: true, filterable: true },
  { key: 'counteragentUuid', label: 'CA UUID', width: 200, visible: false, sortable: true, filterable: true },
  { key: 'projectUuid', label: 'Project UUID', width: 200, visible: false, sortable: true, filterable: true },
  { key: 'financialCodeUuid', label: 'Fin. Code UUID', width: 200, visible: false, sortable: true, filterable: true },
  { key: 'nominalCurrencyUuid', label: 'Nominal Cur. UUID', width: 200, visible: false, sortable: true, filterable: true },
  { key: 'createdAt', label: 'Created', width: 140, visible: false, sortable: true, filterable: true },
  { key: 'updatedAt', label: 'Updated', width: 140, visible: false, sortable: true, filterable: true }
];

// Helper function to get responsive classes
const getResponsiveClass = (responsive?: string) => {
  switch (responsive) {
    case 'sm': return 'hidden sm:table-cell';
    case 'md': return 'hidden md:table-cell';
    case 'lg': return 'hidden lg:table-cell';
    case 'xl': return 'hidden xl:table-cell';
    default: return '';
  }
};

export function BankTransactionsTable({ data }: { data?: BankTransaction[] }) {
  const [transactions, setTransactions] = useState<BankTransaction[]>(data ?? []);
  
  // Horizontal scroll synchronization
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const [needsBottomScroller, setNeedsBottomScroller] = useState(false);
  const [scrollContentWidth, setScrollContentWidth] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<ColumnKey | null>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  
  // Initialize columns from localStorage or use defaults
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    if (typeof window !== 'undefined') {
      const savedColumns = localStorage.getItem('bank-transactions-table-columns');
      if (savedColumns) {
        try {
          return JSON.parse(savedColumns);
        } catch (error) {
          console.warn('Failed to parse saved column settings:', error);
        }
      }
    }
    return defaultColumns;
  });
  
  const [isResizing, setIsResizing] = useState<{ column: ColumnKey; startX: number; startWidth: number } | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const pageSizeOptions = [50, 100, 200, 500, 1000];

  // Respond to external data updates
  useEffect(() => {
    if (data) setTransactions(data);
  }, [data]);

  // Measure scroll content width
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const measure = () => {
      const sw = el.scrollWidth;
      const cw = el.clientWidth;
      const needs = sw > cw + 1;
      setScrollContentWidth(sw);
      setNeedsBottomScroller(needs);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [transactions, columns]);

  // Sync scroll positions
  useEffect(() => {
    const timer = setTimeout(() => {
      const top = scrollRef.current;
      const bottom = bottomScrollRef.current;
      
      if (!top || !bottom) return;

      let isSyncing = false;
      const syncFromTop = () => {
        if (isSyncing) return;
        isSyncing = true;
        bottom.scrollLeft = top.scrollLeft;
        isSyncing = false;
      };
      const syncFromBottom = () => {
        if (isSyncing) return;
        isSyncing = true;
        top.scrollLeft = bottom.scrollLeft;
        isSyncing = false;
      };
      
      top.addEventListener('scroll', syncFromTop, { passive: true });
      bottom.addEventListener('scroll', syncFromBottom, { passive: true });
      bottom.scrollLeft = top.scrollLeft;
      
      return () => {
        top.removeEventListener('scroll', syncFromTop);
        bottom.removeEventListener('scroll', syncFromBottom);
      };
    }, 100);
    
    return () => clearTimeout(timer);
  }, [scrollContentWidth]);

  // Save column settings
  useEffect(() => {
    localStorage.setItem('bank-transactions-table-columns', JSON.stringify(columns));
  }, [columns]);

  // Mouse events for column resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const diff = e.clientX - isResizing.startX;
      const newWidth = Math.max(60, isResizing.startWidth + diff);
      setColumns(cols => cols.map(col => 
        col.key === isResizing.column ? { ...col, width: newWidth } : col
      ));
    };

    const handleMouseUp = () => {
      setIsResizing(null);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Filtering and sorting
  const filteredData = useMemo(() => {
    let result = [...transactions];

    // Apply search filter
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(row => {
        return columns.some(col => {
          if (!col.visible || !col.filterable) return false;
          const val = row[col.key];
          return val != null && String(val).toLowerCase().includes(lower);
        });
      });
    }

    // Apply column filters
    Object.entries(columnFilters).forEach(([columnKey, selectedValues]) => {
      if (selectedValues.length > 0) {
        result = result.filter(row => {
          const cellValue = String(row[columnKey as ColumnKey] ?? '');
          return selectedValues.includes(cellValue);
        });
      }
    });

    // Apply sorting
    if (sortField) {
      result.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return sortDirection === 'asc' ? 1 : -1;
        if (bVal == null) return sortDirection === 'asc' ? -1 : 1;
        
        let comparison = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else if (sortField === 'date' || sortField === 'correctionDate' || sortField === 'createdAt' || sortField === 'updatedAt') {
          comparison = new Date(aVal).getTime() - new Date(bVal).getTime();
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }
        
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [transactions, searchTerm, columnFilters, sortField, sortDirection, columns]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, columnFilters, pageSize]);

  const handleSort = (field: ColumnKey) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleColumnVisibility = (columnKey: ColumnKey) => {
    setColumns(cols => cols.map(col =>
      col.key === columnKey ? { ...col, visible: !col.visible } : col
    ));
  };

  const resetColumns = () => {
    setColumns(defaultColumns);
    localStorage.removeItem('bank-transactions-table-columns');
  };

  // Get unique values for column filters
  const getColumnUniqueValues = (columnKey: ColumnKey) => {
    const values = new Set<string>();
    transactions.forEach(row => {
      const val = row[columnKey];
      if (val != null) values.add(String(val));
    });
    return Array.from(values).sort();
  };

  const visibleColumns = columns.filter(col => col.visible);
  const totalWidth = visibleColumns.reduce((sum, col) => sum + col.width, 0);

  return (
    <div className="w-full space-y-4 p-4">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 min-w-0 w-full sm:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-full"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Column Settings */}
          <Popover open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 max-h-96 overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Column Visibility</h4>
                  <Button variant="ghost" size="sm" onClick={resetColumns}>
                    Reset
                  </Button>
                </div>
                <div className="space-y-2">
                  {columns.map(col => (
                    <div key={col.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={`col-${col.key}`}
                        checked={col.visible}
                        onCheckedChange={() => toggleColumnVisibility(col.key)}
                      />
                      <label
                        htmlFor={`col-${col.key}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {col.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>Total: {transactions.length} transactions</span>
        <span>Filtered: {filteredData.length} transactions</span>
        <span>Showing: {paginatedData.length} transactions</span>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden bg-card">
        <div 
          ref={scrollRef} 
          className="overflow-x-auto"
          style={{ maxHeight: '600px', overflowY: 'auto' }}
        >
          <Table>
            <TableHeader className="sticky top-0 bg-muted z-10">
              <TableRow>
                {visibleColumns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={`relative ${getResponsiveClass(col.responsive)}`}
                    style={{ width: col.width, minWidth: col.width }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate">{col.label}</span>
                      {col.sortable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleSort(col.key)}
                        >
                          {sortField === col.key ? (
                            sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                      {col.filterable && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <Filter className={`h-3 w-3 ${columnFilters[col.key]?.length ? 'text-primary' : ''}`} />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 max-h-80 overflow-y-auto">
                            <div className="space-y-2">
                              <div className="font-semibold text-sm mb-2">Filter {col.label}</div>
                              {getColumnUniqueValues(col.key).map(value => (
                                <div key={value} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`filter-${col.key}-${value}`}
                                    checked={columnFilters[col.key]?.includes(value) ?? false}
                                    onCheckedChange={(checked) => {
                                      setColumnFilters(prev => {
                                        const current = prev[col.key] || [];
                                        if (checked) {
                                          return { ...prev, [col.key]: [...current, value] };
                                        } else {
                                          return { ...prev, [col.key]: current.filter(v => v !== value) };
                                        }
                                      });
                                    }}
                                  />
                                  <label
                                    htmlFor={`filter-${col.key}-${value}`}
                                    className="text-sm cursor-pointer truncate"
                                  >
                                    {value || '(empty)'}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                    {/* Resize handle */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setIsResizing({ column: col.key, startX: e.clientX, startWidth: col.width });
                      }}
                    />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length} className="text-center text-muted-foreground py-8">
                    No transactions found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((row) => (
                  <TableRow key={row.id}>
                    {visibleColumns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={`${getResponsiveClass(col.responsive)}`}
                        style={{ width: col.width, minWidth: col.width }}
                      >
                        <div className="truncate" title={String(row[col.key] ?? '')}>
                          {col.key === 'accountCurrencyAmount' || col.key === 'nominalAmount' ? (
                            <span className={Number(row[col.key]) >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {row[col.key] ? Number(row[col.key]).toFixed(2) : '-'}
                            </span>
                          ) : (
                            row[col.key] ?? '-'
                          )}
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page:</span>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            {pageSizeOptions.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          >
            First
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
          >
            Last
          </Button>
        </div>
      </div>

      {/* Bottom horizontal scroller */}
      {needsBottomScroller && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed bottom-0 left-0 right-0 bg-background border-t z-50 overflow-x-auto"
               ref={bottomScrollRef}
               style={{ height: '20px' }}>
            <div style={{ width: totalWidth, height: '1px' }} />
          </div>,
          document.body
        )
      }
    </div>
  );
}

export default BankTransactionsTable;
