import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, 
  Plus, 
  Edit2, 
  Check, 
  X, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Settings,
  Eye,
  EyeOff,
  Info
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Checkbox } from './ui/checkbox';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';
import { ColumnFilterPopover } from './shared/column-filter-popover';

// Sample data matching your exact database schema
const initialCountries = [
  {
    id: 1,
    createdAt: '2025-10-01',
    updatedAt: '2025-10-02',
    ts: '2025-10-01T12:00:00',
    countryUuid: 'uuid-1234',
    nameEn: 'Georgia',
    nameKa: 'საქართველო',
    iso2: 'GE',
    iso3: 'GEO',
    unCode: 268,
    country: 'Georgia',
    isActive: true
  },
  {
    id: 2,
    createdAt: '2025-10-01',
    updatedAt: '2025-10-02',
    ts: '2025-10-01T12:30:00',
    countryUuid: 'uuid-5678',
    nameEn: 'United States',
    nameKa: 'შეერთებული შტატები',
    iso2: 'US',
    iso3: 'USA',
    unCode: 840,
    country: 'United States',
    isActive: true
  },
  {
    id: 3,
    createdAt: '2025-10-01',
    updatedAt: '2025-10-02',
    ts: '2025-10-01T13:00:00',
    countryUuid: 'uuid-9012',
    nameEn: 'United Kingdom',
    nameKa: 'გაერთიანებული სამეფო',
    iso2: 'GB',
    iso3: 'GBR',
    unCode: 826,
    country: 'United Kingdom',
    isActive: false
  },
  {
    id: 4,
    createdAt: '2025-10-01',
    updatedAt: '2025-10-02',
    ts: '2025-10-01T13:30:00',
    countryUuid: 'uuid-3456',
    nameEn: 'Germany',
    nameKa: 'გერმანია',
    iso2: 'DE',
    iso3: 'DEU',
    unCode: 276,
    country: 'Germany',
    isActive: true
  },
  {
    id: 5,
    createdAt: '2025-10-01',
    updatedAt: '2025-10-02',
    ts: '2025-10-01T14:00:00',
    countryUuid: 'uuid-7890',
    nameEn: 'France',
    nameKa: 'საფრანგეთი',
    iso2: 'FR',
    iso3: 'FRA',
    unCode: 250,
    country: 'France',
    isActive: true
  },
  {
    id: 6,
    createdAt: '2025-10-01',
    updatedAt: '2025-10-02',
    ts: '2025-10-01T14:30:00',
    countryUuid: 'uuid-2468',
    nameEn: 'Japan',
    nameKa: 'იაპონია',
    iso2: 'JP',
    iso3: 'JPN',
    unCode: 392,
    country: 'Japan',
    isActive: false
  }
];

export type Country = {
  id: number;
  createdAt: string;
  updatedAt: string;
  ts: string;
  countryUuid: string;
  nameEn: string;
  nameKa: string;
  iso2: string;
  iso3: string;
  unCode: number;
  country: string;
  isActive: boolean;
};

type ColumnKey = keyof Country;

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
  { key: 'id', label: 'ID', width: 80, visible: true, sortable: true, filterable: true },
  { key: 'createdAt', label: 'Created', width: 140, visible: true, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'updatedAt', label: 'Updated', width: 140, visible: true, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'ts', label: 'Timestamp', width: 140, visible: true, sortable: true, filterable: true, responsive: 'lg' },
  { key: 'countryUuid', label: 'UUID', width: 200, visible: true, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'nameEn', label: 'Name EN', width: 180, visible: true, sortable: true, filterable: true },
  { key: 'nameKa', label: 'Name GE', width: 200, visible: true, sortable: true, filterable: true, responsive: 'md' },
  { key: 'iso2', label: 'ISO2', width: 80, visible: true, sortable: true, filterable: true },
  { key: 'iso3', label: 'ISO3', width: 80, visible: true, sortable: true, filterable: true, responsive: 'lg' },
  { key: 'unCode', label: 'UN Code', width: 100, visible: true, sortable: true, filterable: true, responsive: 'lg' },
  { key: 'country', label: 'Country', width: 200, visible: true, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'isActive', label: 'Status', width: 100, visible: true, sortable: true, filterable: true }
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

export function CountriesTable({ data }: { data?: Country[] }) {
  const [countries, setCountries] = useState<Country[]>(data ?? initialCountries);
  // Horizontal scroll synchronization between the table and a sticky bottom scroller
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const [needsBottomScroller, setNeedsBottomScroller] = useState(false);
  const [scrollContentWidth, setScrollContentWidth] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<ColumnKey | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuditDialogOpen, setIsAuditDialogOpen] = useState(false);
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  
  // Initialize columns from localStorage or use defaults
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    if (typeof window !== 'undefined') {
      const savedColumns = localStorage.getItem('countries-table-columns');
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
  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);
  
  // Form state with validation
  const [formData, setFormData] = useState({
    nameEn: '',
    nameKa: '',
    iso2: '',
    iso3: '',
    unCode: '',
    isActive: true
  });
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const pageSizeOptions = [50, 100, 200, 500, 1000];

  // Respond to external data updates
  useEffect(() => {
    if (data) setCountries(data);
  }, [data]);

  // Measure scroll content width and whether a horizontal scrollbar is needed
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const measure = () => {
      const sw = el.scrollWidth;
      const cw = el.clientWidth;
      const needs = sw > cw + 1;
      console.log('[ScrollDebug] scrollWidth:', sw, 'clientWidth:', cw, 'needsScroller:', needs);
      setScrollContentWidth(sw);
      setNeedsBottomScroller(needs);
    };

    // initial + a couple of reflows to catch late layout/font loads
    measure();
    const raf1 = requestAnimationFrame(measure);
    const raf2 = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('load', measure);
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [countries, columns]);

  // Sync scroll positions between main table scroller and bottom scroller
  useEffect(() => {
    // Small delay to ensure refs are attached after portal renders
    const timer = setTimeout(() => {
      const top = scrollRef.current;
      const bottom = bottomScrollRef.current;
      
      console.log('[Sync] Refs:', { top: !!top, bottom: !!bottom });
      
      if (!top || !bottom) return;

      let isSyncing = false;
      const syncFromTop = () => {
        if (isSyncing) return;
        isSyncing = true;
        bottom.scrollLeft = top.scrollLeft;
        console.log('[Sync] Top->Bottom:', top.scrollLeft);
        isSyncing = false;
      };
      const syncFromBottom = () => {
        if (isSyncing) return;
        isSyncing = true;
        top.scrollLeft = bottom.scrollLeft;
        console.log('[Sync] Bottom->Top:', bottom.scrollLeft);
        isSyncing = false;
      };
      
      top.addEventListener('scroll', syncFromTop, { passive: true });
      bottom.addEventListener('scroll', syncFromBottom, { passive: true });
      
      // Initialize positions to match
      bottom.scrollLeft = top.scrollLeft;
      console.log('[Sync] Initialized, listeners attached');
      
      return () => {
        top.removeEventListener('scroll', syncFromTop);
        bottom.removeEventListener('scroll', syncFromBottom);
        console.log('[Sync] Listeners removed');
      };
    }, 100);
    
    return () => clearTimeout(timer);
  }, [scrollContentWidth]);

  // Save column settings to localStorage
  useEffect(() => {
    localStorage.setItem('countries-table-columns', JSON.stringify(columns));
  }, [columns]);

  // Mouse events for column resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const diff = e.clientX - isResizing.startX;
      const newWidth = Math.max(60, isResizing.startWidth + diff);
      
      console.log('[Resize] Moving:', { diff, newWidth, column: isResizing.column });
      
      setColumns(cols => cols.map(col => 
        col.key === isResizing.column 
          ? { ...col, width: newWidth }
          : col
      ));
    };

    const handleMouseUp = () => {
      console.log('[Resize] Mouse up, stopping resize');
      setIsResizing(null);
    };

    if (isResizing) {
      console.log('[Resize] Started resizing:', isResizing);
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

  // Column reordering handlers
  const handleDragStart = (e: React.DragEvent, columnKey: ColumnKey) => {
    setDraggedColumn(columnKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, columnKey: ColumnKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedColumn && draggedColumn !== columnKey) {
      setDragOverColumn(columnKey);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetColumnKey: ColumnKey) => {
    e.preventDefault();
    
    if (!draggedColumn || draggedColumn === targetColumnKey) {
      setDraggedColumn(null);
      setDragOverColumn(null);
      return;
    }

    const draggedIndex = columns.findIndex(col => col.key === draggedColumn);
    const targetIndex = columns.findIndex(col => col.key === targetColumnKey);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newColumns = [...columns];
    const [removed] = newColumns.splice(draggedIndex, 1);
    newColumns.splice(targetIndex, 0, removed);

    setColumns(newColumns);
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  // Form validation
  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.nameEn.trim()) errors.nameEn = 'English name is required';
    if (!formData.nameKa.trim()) errors.nameKa = 'Georgian name is required';
    if (!formData.iso2.trim()) errors.iso2 = 'ISO2 code is required';
    else if (formData.iso2.length !== 2) errors.iso2 = 'ISO2 must be exactly 2 characters';
    if (!formData.iso3.trim()) errors.iso3 = 'ISO3 code is required';
    else if (formData.iso3.length !== 3) errors.iso3 = 'ISO3 must be exactly 3 characters';
    if (!formData.unCode.trim()) errors.unCode = 'UN code is required';
    else if (isNaN(parseInt(formData.unCode))) errors.unCode = 'UN code must be a number';
    
    // Check for duplicates
    const existingCountry = countries.find(c => 
      c.id !== editingCountry?.id && (
        c.iso2.toLowerCase() === formData.iso2.toLowerCase() ||
        c.iso3.toLowerCase() === formData.iso3.toLowerCase() ||
        c.unCode === parseInt(formData.unCode)
      )
    );
    
    if (existingCountry) {
      if (existingCountry.iso2.toLowerCase() === formData.iso2.toLowerCase()) {
        errors.iso2 = 'ISO2 code already exists';
      }
      if (existingCountry.iso3.toLowerCase() === formData.iso3.toLowerCase()) {
        errors.iso3 = 'ISO3 code already exists';
      }
      if (existingCountry.unCode === parseInt(formData.unCode)) {
        errors.unCode = 'UN code already exists';
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Filter and search logic
  const filteredCountries = useMemo(() => {
    let filtered = countries;

    // Apply search across all visible text fields
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(country =>
        country.nameEn.toLowerCase().includes(search) ||
        country.nameKa.toLowerCase().includes(search) ||
        country.iso2.toLowerCase().includes(search) ||
        country.iso3.toLowerCase().includes(search) ||
        country.unCode.toString().includes(search) ||
        country.country.toLowerCase().includes(search) ||
        (country.isActive ? 'active' : 'inactive').includes(search) ||
        country.ts.toLowerCase().includes(search)
      );
    }

    // Apply column filters
    Object.entries(columnFilters).forEach(([column, values]) => {
      if (values.length > 0) {
        filtered = filtered.filter(country => {
          const cellValue = String(country[column as ColumnKey]);
          return values.includes(cellValue);
        });
      }
    });

    return filtered;
  }, [countries, searchTerm, columnFilters]);

  // Sort logic
  const sortedCountries = useMemo(() => {
    if (!sortField) return filteredCountries;

    return [...filteredCountries].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredCountries, sortField, sortDirection]);

  // Pagination
  const totalRecords = sortedCountries.length;
  const totalPages = Math.ceil(totalRecords / pageSize);
  
  const paginatedCountries = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return sortedCountries.slice(startIndex, endIndex);
  }, [sortedCountries, currentPage, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, columnFilters, pageSize]);

  const handleSort = (field: ColumnKey) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: ColumnKey) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3" />
      : <ArrowDown className="h-3 w-3" />;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    
    // Derive the country field from nameKa and iso3
    const derivedCountry = `${formData.nameKa || formData.nameEn} - ${formData.iso3}`;
    
    if (editingCountry) {
      // Update existing via API
      try {
        const response = await fetch(`/api/countries?id=${editingCountry.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name_en: formData.nameEn,
            name_ka: formData.nameKa,
            iso2: formData.iso2.toUpperCase(),
            iso3: formData.iso3.toUpperCase(),
            un_code: parseInt(formData.unCode),
            country: derivedCountry,
            is_active: formData.isActive
          })
        });
        
        if (!response.ok) {
          const error = await response.json();
          console.error('[Edit] API error:', error);
          alert(`Failed to update: ${error.error || 'Unknown error'}`);
          return;
        }
        
        const updated = await response.json();
        
        // Update local state with API response
        setCountries(countries.map(country =>
          country.id === editingCountry.id ? updated : country
        ));
        
        setIsEditDialogOpen(false);
        setEditingCountry(null);
      } catch (error) {
        console.error('[Edit] Network error:', error);
        alert('Failed to update country. Please try again.');
        return;
      }
    } else {
      // Add new via API
      try {
        const response = await fetch('/api/countries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name_en: formData.nameEn,
            name_ka: formData.nameKa,
            iso2: formData.iso2.toUpperCase(),
            iso3: formData.iso3.toUpperCase(),
            un_code: parseInt(formData.unCode),
            country: derivedCountry,
            is_active: formData.isActive
          })
        });
        
        if (!response.ok) {
          const error = await response.json();
          console.error('[Add] API error:', error);
          alert(`Failed to add: ${error.error || 'Unknown error'}`);
          return;
        }
        
        const created = await response.json();
        
        // Fetch fresh data from API to get all fields properly formatted
        const refreshResponse = await fetch('/api/countries');
        const refreshedData = await refreshResponse.json();
        setCountries(refreshedData);
        
        setIsAddDialogOpen(false);
      } catch (error) {
        console.error('[Add] Network error:', error);
        alert('Failed to add country. Please try again.');
        return;
      }
    }
    
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      nameEn: '',
      nameKa: '',
      iso2: '',
      iso3: '',
      unCode: '',
      isActive: true
    });
    setFormErrors({});
  };

  const startEdit = (country: Country) => {
    setEditingCountry(country);
    setFormData({
      nameEn: country.nameEn,
      nameKa: country.nameKa,
      iso2: country.iso2,
      iso3: country.iso3,
      unCode: country.unCode.toString(),
      isActive: country.isActive
    });
    setFormErrors({});
    setIsEditDialogOpen(true);
  };

  const cancelEdit = () => {
    setEditingCountry(null);
    setIsEditDialogOpen(false);
    resetForm();
  };

  const deleteCountry = (id: number) => {
    setCountries(countries.filter(c => c.id !== id));
  };

  const viewAuditLog = async (country: Country) => {
    setEditingCountry(country);
    setIsAuditDialogOpen(true);
    setLoadingAudit(true);
    
    try {
      const response = await fetch(`/api/audit?table=countries&recordId=${country.id}`);
      if (response.ok) {
        const logs = await response.json();
        setAuditLogs(logs);
      } else {
        console.error('Failed to fetch audit logs');
        setAuditLogs([]);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      setAuditLogs([]);
    } finally {
      setLoadingAudit(false);
    }
  };

  // Get unique values for column filters
  const getUniqueValues = (column: ColumnKey) => {
    return [...new Set(countries.map(country => String(country[column])))].sort();
  };

  // Column settings dialog
  const ColumnSettings = () => (
    <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Columns
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Column Settings</DialogTitle>
          <DialogDescription>
            Configure which columns to show and their visibility.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {columns.map(column => (
            <div key={column.key} className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`col-${column.key}`}
                  checked={column.visible}
                  onCheckedChange={(checked) => {
                    setColumns(cols => cols.map(col =>
                      col.key === column.key
                        ? { ...col, visible: checked as boolean }
                        : col
                    ));
                  }}
                />
                <Label htmlFor={`col-${column.key}`} className="text-sm">
                  {column.label}
                </Label>
              </div>
              {column.visible ? (
                <Eye className="h-4 w-4 text-green-600" />
              ) : (
                <EyeOff className="h-4 w-4 text-gray-400" />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end space-x-2">
          <Button
            variant="outline"
            onClick={() => {
              setColumns(defaultColumns);
              setIsSettingsOpen(false);
            }}
          >
            Reset
          </Button>
          <Button onClick={() => setIsSettingsOpen(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  // Visible columns only
  const visibleColumns = columns.filter(col => col.visible);
  
  // Calculate total table width based on column widths + Actions column (96px)
  const tableWidth = useMemo(() => {
    const columnsWidth = visibleColumns.reduce((sum, col) => sum + col.width, 0);
    return columnsWidth + 96; // 96px for Actions column (w-24)
  }, [visibleColumns]);

  return (
    <div className="p-6 space-y-6 bg-background">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-foreground">Countries</h1>
        </div>
        <div className="flex items-center gap-2">
          <ColumnSettings />
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Add Country
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Country</DialogTitle>
                <DialogDescription>
                  Enter the details for the new country. All fields are required.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-nameEn" className="text-right">
                    Name EN
                  </Label>
                  <div className="col-span-3">
                    <Input
                      id="add-nameEn"
                      value={formData.nameEn}
                      onChange={(e) => {
                        setFormData({...formData, nameEn: e.target.value});
                        if (formErrors.nameEn) setFormErrors({...formErrors, nameEn: ''});
                      }}
                      className={formErrors.nameEn ? 'border-red-500' : ''}
                    />
                    {formErrors.nameEn && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.nameEn}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-nameKa" className="text-right">
                    Name GE
                  </Label>
                  <div className="col-span-3">
                    <Input
                      id="add-nameKa"
                      value={formData.nameKa}
                      onChange={(e) => {
                        setFormData({...formData, nameKa: e.target.value});
                        if (formErrors.nameKa) setFormErrors({...formErrors, nameKa: ''});
                      }}
                      className={formErrors.nameKa ? 'border-red-500' : ''}
                    />
                    {formErrors.nameKa && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.nameKa}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-iso2" className="text-right">
                    ISO2
                  </Label>
                  <div className="col-span-3">
                    <Input
                      id="add-iso2"
                      value={formData.iso2}
                      onChange={(e) => {
                        setFormData({...formData, iso2: e.target.value.toUpperCase()});
                        if (formErrors.iso2) setFormErrors({...formErrors, iso2: ''});
                      }}
                      className={formErrors.iso2 ? 'border-red-500' : ''}
                      maxLength={2}
                      placeholder="US"
                    />
                    {formErrors.iso2 && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.iso2}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-iso3" className="text-right">
                    ISO3
                  </Label>
                  <div className="col-span-3">
                    <Input
                      id="add-iso3"
                      value={formData.iso3}
                      onChange={(e) => {
                        setFormData({...formData, iso3: e.target.value.toUpperCase()});
                        if (formErrors.iso3) setFormErrors({...formErrors, iso3: ''});
                      }}
                      className={formErrors.iso3 ? 'border-red-500' : ''}
                      maxLength={3}
                      placeholder="USA"
                    />
                    {formErrors.iso3 && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.iso3}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-unCode" className="text-right">
                    UN Code
                  </Label>
                  <div className="col-span-3">
                    <Input
                      id="add-unCode"
                      type="number"
                      value={formData.unCode}
                      onChange={(e) => {
                        setFormData({...formData, unCode: e.target.value});
                        if (formErrors.unCode) setFormErrors({...formErrors, unCode: ''});
                      }}
                      className={formErrors.unCode ? 'border-red-500' : ''}
                      placeholder="268"
                    />
                    {formErrors.unCode && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.unCode}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-isActive" className="text-right">
                    Status
                  </Label>
                  <div className="col-span-3">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="add-isActive"
                        checked={formData.isActive}
                        onCheckedChange={(checked) => setFormData({...formData, isActive: checked})}
                      />
                      <span className="text-sm text-muted-foreground">
                        {formData.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>Save Country</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit Country</DialogTitle>
                <DialogDescription>
                  Update the details for {editingCountry?.nameEn}. All fields are required.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-nameEn" className="text-right">
                    Name EN
                  </Label>
                  <div className="col-span-3">
                    <Input
                      id="edit-nameEn"
                      value={formData.nameEn}
                      onChange={(e) => {
                        setFormData({...formData, nameEn: e.target.value});
                        if (formErrors.nameEn) setFormErrors({...formErrors, nameEn: ''});
                      }}
                      className={formErrors.nameEn ? 'border-red-500' : ''}
                    />
                    {formErrors.nameEn && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.nameEn}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-nameKa" className="text-right">
                    Name GE
                  </Label>
                  <div className="col-span-3">
                    <Input
                      id="edit-nameKa"
                      value={formData.nameKa}
                      onChange={(e) => {
                        setFormData({...formData, nameKa: e.target.value});
                        if (formErrors.nameKa) setFormErrors({...formErrors, nameKa: ''});
                      }}
                      className={formErrors.nameKa ? 'border-red-500' : ''}
                    />
                    {formErrors.nameKa && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.nameKa}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-iso2" className="text-right">
                    ISO2
                  </Label>
                  <div className="col-span-3">
                    <Input
                      id="edit-iso2"
                      value={formData.iso2}
                      onChange={(e) => {
                        setFormData({...formData, iso2: e.target.value.toUpperCase()});
                        if (formErrors.iso2) setFormErrors({...formErrors, iso2: ''});
                      }}
                      className={formErrors.iso2 ? 'border-red-500' : ''}
                      maxLength={2}
                      placeholder="US"
                    />
                    {formErrors.iso2 && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.iso2}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-iso3" className="text-right">
                    ISO3
                  </Label>
                  <div className="col-span-3">
                    <Input
                      id="edit-iso3"
                      value={formData.iso3}
                      onChange={(e) => {
                        setFormData({...formData, iso3: e.target.value.toUpperCase()});
                        if (formErrors.iso3) setFormErrors({...formErrors, iso3: ''});
                      }}
                      className={formErrors.iso3 ? 'border-red-500' : ''}
                      maxLength={3}
                      placeholder="USA"
                    />
                    {formErrors.iso3 && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.iso3}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-unCode" className="text-right">
                    UN Code
                  </Label>
                  <div className="col-span-3">
                    <Input
                      id="edit-unCode"
                      type="number"
                      value={formData.unCode}
                      onChange={(e) => {
                        setFormData({...formData, unCode: e.target.value});
                        if (formErrors.unCode) setFormErrors({...formErrors, unCode: ''});
                      }}
                      className={formErrors.unCode ? 'border-red-500' : ''}
                      placeholder="268"
                    />
                    {formErrors.unCode && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.unCode}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-isActive" className="text-right">
                    Status
                  </Label>
                  <div className="col-span-3">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="edit-isActive"
                        checked={formData.isActive}
                        onCheckedChange={(checked) => setFormData({...formData, isActive: checked})}
                      />
                      <span className="text-sm text-muted-foreground">
                        {formData.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={cancelEdit}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>Update Country</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Audit History Dialog */}
          <Dialog open={isAuditDialogOpen} onOpenChange={setIsAuditDialogOpen}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Audit History</DialogTitle>
                <DialogDescription>
                  Change history for {editingCountry?.nameEn} (ID: {editingCountry?.id})
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto">
                {loadingAudit ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-muted-foreground">Loading audit logs...</div>
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-muted-foreground">No audit history found</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Badge variant={
                              log.action === 'create' ? 'default' :
                              log.action === 'update' ? 'secondary' :
                              log.action === 'delete' ? 'destructive' :
                              log.action === 'activate' ? 'success' :
                              'error'
                            }>
                              {log.action.toUpperCase()}
                            </Badge>
                            <span className="text-sm font-medium">{log.userEmail || 'Unknown user'}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {log.changes && Object.keys(log.changes).length > 0 && (
                          <div className="space-y-1 pl-4 border-l-2 border-muted">
                            {Object.entries(log.changes).map(([field, change]: [string, any]) => (
                              <div key={field} className="text-sm">
                                <span className="font-medium text-foreground">{field}:</span>{' '}
                                <span className="text-red-600 line-through">{String(change.from || 'null')}</span>
                                {' → '}
                                <span className="text-green-600">{String(change.to || 'null')}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => setIsAuditDialogOpen(false)}>Close</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search and Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-2 max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search across all fields..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} records
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="border border-input rounded px-2 py-1 text-sm bg-background"
            >
              {pageSizeOptions.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
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
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
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
      )}

      {/* Table */}
      <div className="border border-border rounded-lg bg-card shadow-sm overflow-hidden sticky-scrollbar-container">
        <div className="overflow-x-auto sticky-scrollbar" ref={scrollRef}>
          <Table style={{ tableLayout: 'fixed', width: `${tableWidth}px` }}>
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                {visibleColumns.map((column) => (
                  <TableHead
                    key={column.key}
                    draggable={!isResizing}
                    onDragStart={(e) => handleDragStart(e, column.key)}
                    onDragOver={(e) => handleDragOver(e, column.key)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, column.key)}
                    onDragEnd={handleDragEnd}
                    className={`${getResponsiveClass(column.responsive)} relative group bg-white transition-all ${
                      draggedColumn === column.key ? 'opacity-50' : ''
                    } ${
                      dragOverColumn === column.key ? 'border-l-4 border-l-blue-500' : ''
                    }`}
                    style={{ 
                      width: column.width,
                      cursor: isResizing ? 'col-resize' : 'grab'
                    }}
                  >
                    <div className="flex items-center justify-between min-h-[40px]">
                      <div className="flex items-center space-x-2">
                        {column.sortable ? (
                          <button
                            onClick={() => handleSort(column.key)}
                            className="flex items-center space-x-1 font-medium hover:text-primary transition-colors"
                          >
                            <span>{column.label}</span>
                            {getSortIcon(column.key)}
                          </button>
                        ) : (
                          <span className="font-medium">{column.label}</span>
                        )}
                        {column.filterable && (
                          <ColumnFilterPopover
                            columnKey={column.key}
                            columnLabel={column.label}
                            values={getUniqueValues(column.key)}
                            activeFilters={new Set(columnFilters[column.key] || [])}
                            onFilterChange={(values) =>
                              setColumnFilters({
                                ...columnFilters,
                                [column.key]: Array.from(values)
                              })
                            }
                            onSort={(direction) => {
                              setSortField(column.key);
                              setSortDirection(direction);
                            }}
                          />
                        )}
                      </div>
                      
                      {/* Resize handle - centered on column border */}
                      <div
                        className="absolute top-0 bottom-0 w-4 cursor-col-resize hover:bg-blue-400/30 active:bg-blue-500/50 transition-colors"
                        style={{ 
                          right: '-8px',
                          zIndex: 30 
                        }}
                        draggable={false}
                        onMouseDown={(e) => {
                          console.log('[Resize] MouseDown on column:', column.key, 'startX:', e.clientX, 'startWidth:', column.width);
                          e.preventDefault();
                          e.stopPropagation();
                          setIsResizing({
                            column: column.key,
                            startX: e.clientX,
                            startWidth: column.width
                          });
                        }}
                        onClick={(e) => {
                          // Prevent click from bubbling to sort
                          e.stopPropagation();
                        }}
                        title="Drag to resize column"
                      >
                        {/* Visual indicator line at center */}
                        <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[2px] bg-gray-300 hover:bg-blue-500 transition-colors" />
                      </div>
                    </div>
                  </TableHead>
                ))}
                <TableHead className="w-24 bg-white">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedCountries.map((country) => (
                <TableRow key={country.id} className="hover:bg-muted/50 transition-colors">
                  {visibleColumns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={`${getResponsiveClass(column.responsive)} relative bg-white`}
                      style={{ width: column.width }}
                    >
                      <div className="py-1 overflow-hidden text-ellipsis whitespace-nowrap">
                        {column.key === 'isActive' ? (
                          <Badge variant={country.isActive ? "success" : "error"} className="text-xs">
                            {country.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        ) : column.key === 'id' ? (
                          <span className="text-sm">{country.id}</span>
                        ) : column.key === 'createdAt' ? (
                          <span className="text-sm">{country.createdAt}</span>
                        ) : column.key === 'updatedAt' ? (
                          <span className="text-sm">{country.updatedAt}</span>
                        ) : column.key === 'ts' ? (
                          <span className="text-sm">{country.ts}</span>
                        ) : column.key === 'countryUuid' ? (
                          <span className="text-sm">{country.countryUuid}</span>
                        ) : column.key === 'nameEn' ? (
                          <span className="text-sm">{country.nameEn}</span>
                        ) : column.key === 'nameKa' ? (
                          <span className="text-sm">{country.nameKa}</span>
                        ) : column.key === 'iso2' ? (
                          <span className="text-sm">{country.iso2}</span>
                        ) : column.key === 'iso3' ? (
                          <span className="text-sm">{country.iso3}</span>
                        ) : column.key === 'unCode' ? (
                          <span className="text-sm">{country.unCode}</span>
                        ) : column.key === 'country' ? (
                          <span className="text-sm">{country.country}</span>
                        ) : (
                          <span className="text-sm">-</span>
                        )}
                      </div>
                    </TableCell>
                  ))}
                  <TableCell className="w-24">
                    <div className="flex items-center space-x-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(country)}
                        className="h-7 w-7 p-0"
                        title="Edit country"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => viewAuditLog(country)}
                        className="h-7 w-7 p-0"
                        title="View audit history"
                      >
                        <Info className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Empty state */}
      {sortedCountries.length === 0 && (
        <div className="text-center py-12">
          <div className="text-muted-foreground">
            {searchTerm || Object.values(columnFilters).some(f => f.length > 0) ? (
              <>
                <p className="text-lg font-medium mb-2">No countries found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
              </>
            ) : (
              <>
                <p className="text-lg font-medium mb-2">No countries added yet</p>
                <p className="text-sm">Get started by adding your first country</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Active filters indicator */}
      {Object.values(columnFilters).some(filters => filters.length > 0) && (
        <div className="flex items-center space-x-2 text-sm">
          <span className="text-muted-foreground">Active filters:</span>
          {Object.entries(columnFilters).map(([column, values]) =>
            values.length > 0 ? (
              <Badge key={column} variant="secondary" className="text-xs">
                {columns.find(c => c.key === column)?.label}: {values.length}
              </Badge>
            ) : null
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setColumnFilters({})}
            className="h-6 px-2 text-xs"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}