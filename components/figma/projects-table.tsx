'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, 
  Plus, 
  Edit2, 
  Check, 
  X, 
  Filter, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Settings,
  Eye,
  EyeOff,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Upload,
  Download,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';

export type Project = {
  id: number;
  createdAt: string;
  updatedAt: string;
  projectUuid: string;
  projectName: string;
  date: string;
  value: number;
  oris1630: string | null;
  contractNo: string | null;
  projectIndex: string | null;
  counteragentUuid: string;
  financialCodeUuid: string;
  currencyUuid: string;
  stateUuid: string;
  counteragent: string | null;
  financialCode: string | null;
  currency: string | null;
  state: string | null;
  employees?: Array<{ employeeUuid: string; employeeName: string | null }>;
};

type ColumnKey = keyof Omit<Project, 'employees'>;

type ColumnConfig = {
  key: ColumnKey | 'employees';
  label: string;
  width: number;
  visible: boolean;
  sortable: boolean;
  filterable: boolean;
  responsive?: 'sm' | 'md' | 'lg' | 'xl';
};

const defaultColumns: ColumnConfig[] = [
  { key: 'id', label: 'ID', width: 80, visible: false, sortable: true, filterable: true },
  { key: 'createdAt', label: 'Created', width: 140, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'updatedAt', label: 'Updated', width: 140, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'projectUuid', label: 'UUID', width: 200, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'projectName', label: 'Project Name', width: 200, visible: true, sortable: true, filterable: true },
  { key: 'contractNo', label: 'Contract No', width: 150, visible: true, sortable: true, filterable: true },
  { key: 'projectIndex', label: 'Project Index', width: 300, visible: true, sortable: true, filterable: true },
  { key: 'date', label: 'Date', width: 120, visible: true, sortable: true, filterable: true },
  { key: 'value', label: 'Value', width: 150, visible: true, sortable: true, filterable: true },
  { key: 'currency', label: 'Currency', width: 100, visible: true, sortable: true, filterable: true },
  { key: 'counteragent', label: 'Counteragent', width: 200, visible: true, sortable: true, filterable: true },
  { key: 'financialCode', label: 'Financial Code', width: 150, visible: true, sortable: true, filterable: true },
  { key: 'state', label: 'State', width: 120, visible: true, sortable: true, filterable: true },
  { key: 'employees', label: 'Employees', width: 200, visible: true, sortable: false, filterable: false },
  { key: 'oris1630', label: 'ORIS 1630', width: 120, visible: false, sortable: true, filterable: true },
  { key: 'counteragentUuid', label: 'Counteragent UUID', width: 200, visible: false, sortable: false, filterable: false },
  { key: 'financialCodeUuid', label: 'Financial Code UUID', width: 200, visible: false, sortable: false, filterable: false },
  { key: 'currencyUuid', label: 'Currency UUID', width: 200, visible: false, sortable: false, filterable: false },
  { key: 'stateUuid', label: 'State UUID', width: 200, visible: false, sortable: false, filterable: false },
];

type LookupData = {
  counteragents: Array<{ uuid: string; name: string; internalNumber: string | null }>;
  financialCodes: Array<{ uuid: string; code: string }>;
  currencies: Array<{ uuid: string; code: string }>;
  states: Array<{ uuid: string; name: string }>;
  employees: Array<{ uuid: string; name: string }>;
};

export default function ProjectsTable() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [lookupData, setLookupData] = useState<LookupData>({
    counteragents: [],
    financialCodes: [],
    currencies: [],
    states: [],
    employees: []
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: ColumnKey | null; direction: 'asc' | 'desc' }>({
    key: null,
    direction: 'asc'
  });
  
  // Load column settings from localStorage
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('projects-table-columns');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse saved columns:', e);
        }
      }
    }
    return defaultColumns;
  });
  
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [isResizing, setIsResizing] = useState<{ column: ColumnKey | 'employees'; startX: number; startWidth: number } | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | 'employees' | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | 'employees' | null>(null);
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isImportMenuOpen, setIsImportMenuOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    projectName: '',
    date: '',
    value: '',
    oris1630: '',
    counteragentUuid: '',
    financialCodeUuid: '',
    currencyUuid: '',
    stateUuid: '',
    employeeUuids: [] as string[]
  });
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const pageSizeOptions = [50, 100, 200, 500, 1000];

  // Scroll refs for syncing
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const [scrollContentWidth, setScrollContentWidth] = useState(0);
  const [needsBottomScroller, setNeedsBottomScroller] = useState(false);

  // Fetch projects
  useEffect(() => {
    fetchProjects();
  }, []);

  // Fetch lookup data
  useEffect(() => {
    fetchLookupData();
  }, []);

  // Save column settings to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('projects-table-columns', JSON.stringify(columns));
    }
  }, [columns]);

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
  }, [projects, columns]);

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

  // Mouse events for column resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const diff = e.clientX - isResizing.startX;
      const newWidth = Math.max(60, isResizing.startWidth + diff);
      
      setColumns(cols => cols.map(col => 
        col.key === isResizing.column 
          ? { ...col, width: newWidth }
          : col
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

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/projects');
      if (!response.ok) throw new Error('Failed to fetch projects');
      const data = await response.json();
      setProjects(data.map((p: any) => ({
        id: p.id,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        projectUuid: p.project_uuid,
        projectName: p.project_name,
        date: p.date,
        value: parseFloat(p.value),
        oris1630: p.oris_1630,
        contractNo: p.contract_no,
        projectIndex: p.project_index,
        counteragentUuid: p.counteragent_uuid,
        financialCodeUuid: p.financial_code_uuid,
        currencyUuid: p.currency_uuid,
        stateUuid: p.state_uuid,
        counteragent: p.counteragent,
        financialCode: p.financial_code,
        currency: p.currency,
        state: p.state,
        employees: p.employees || []
      })));
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLookupData = async () => {
    try {
      const counteragentsRes = await fetch('/api/counteragents');
      const counteragentsData = await counteragentsRes.json();
      const employees = counteragentsData
        .filter((c: any) => c.is_emploee === true)
        .map((c: any) => ({
          uuid: c.counteragent_uuid,
          name: c.name || 'Unnamed',
          internalNumber: c.internal_number
        }));

      const allCounteragents = counteragentsData.map((c: any) => ({
        uuid: c.counteragent_uuid,
        name: c.name || 'Unnamed',
        internalNumber: c.internal_number
      }));

      const financialCodesRes = await fetch('/api/financial-codes');
      const financialCodesData = await financialCodesRes.json();
      const financialCodes = financialCodesData.map((fc: any) => ({
        uuid: fc.financial_code_uuid || fc.uuid,
        code: fc.code
      }));

      const currenciesRes = await fetch('/api/currencies');
      const currenciesData = await currenciesRes.json();
      const currencies = currenciesData.map((c: any) => ({
        uuid: c.currency_uuid,
        code: c.code
      }));

      const statesRes = await fetch('/api/project-states');
      const statesData = await statesRes.json();
      const states = statesData.map((s: any) => ({
        uuid: s.state_uuid,
        name: s.name
      }));

      setLookupData({
        counteragents: allCounteragents,
        financialCodes,
        currencies,
        states,
        employees
      });
    } catch (error) {
      console.error('Error fetching lookup data:', error);
    }
  };

  const handleSort = (key: ColumnKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleDownloadTemplate = () => {
    // Download the template file
    window.location.href = '/projects_template.xlsx';
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setIsImportMenuOpen(false);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/projects/import', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Import failed');
      }

      const result = await response.json();
      alert(`Import successful!\nCreated: ${result.created}\nUpdated: ${result.updated}\nFailed: ${result.failed}`);
      
      // Refresh the projects list
      await fetchProjects();
    } catch (error: any) {
      console.error('Import error:', error);
      alert(`Import failed: ${error.message}`);
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleColumnVisibility = (key: ColumnKey | 'employees', visible: boolean) => {
    setColumns(prev => prev.map(col => 
      col.key === key ? { ...col, visible } : col
    ));
  };

  const handleDragStart = (e: React.DragEvent, columnKey: ColumnKey | 'employees') => {
    setDraggedColumn(columnKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, columnKey: ColumnKey | 'employees') => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedColumn && draggedColumn !== columnKey) {
      setDragOverColumn(columnKey);
    }
  };

  const handleDrop = (e: React.DragEvent, targetColumnKey: ColumnKey | 'employees') => {
    e.preventDefault();
    
    if (!draggedColumn || draggedColumn === targetColumnKey) {
      setDragOverColumn(null);
      return;
    }

    setColumns(cols => {
      const newCols = [...cols];
      const draggedIndex = newCols.findIndex(col => col.key === draggedColumn);
      const targetIndex = newCols.findIndex(col => col.key === targetColumnKey);
      
      const [removed] = newCols.splice(draggedIndex, 1);
      newCols.splice(targetIndex, 0, removed);
      
      return newCols;
    });
    
    setDragOverColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const resetForm = () => {
    setFormData({
      projectName: '',
      date: '',
      value: '',
      oris1630: '',
      counteragentUuid: '',
      financialCodeUuid: '',
      currencyUuid: '',
      stateUuid: '',
      employeeUuids: []
    });
  };

  const startAdd = () => {
    resetForm();
    setIsAddDialogOpen(true);
  };

  const startEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      projectName: project.projectName,
      date: project.date,
      value: project.value.toString(),
      oris1630: project.oris1630 || '',
      counteragentUuid: project.counteragentUuid,
      financialCodeUuid: project.financialCodeUuid,
      currencyUuid: project.currencyUuid,
      stateUuid: project.stateUuid,
      employeeUuids: project.employees?.map(e => e.employeeUuid) || []
    });
    setIsEditDialogOpen(true);
  };

  const handleAdd = async () => {
    if (!formData.projectName || !formData.date || !formData.value || 
        !formData.counteragentUuid || !formData.financialCodeUuid || 
        !formData.currencyUuid || !formData.stateUuid) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name: formData.projectName,
          date: formData.date,
          value: parseFloat(formData.value),
          oris_1630: formData.oris1630 || null,
          counteragent_uuid: formData.counteragentUuid,
          financial_code_uuid: formData.financialCodeUuid,
          currency_uuid: formData.currencyUuid,
          state_uuid: formData.stateUuid,
          employee_uuids: formData.employeeUuids
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create project');
      }

      await fetchProjects();
      setIsAddDialogOpen(false);
      resetForm();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingProject || !formData.projectName || !formData.date || !formData.value || 
        !formData.counteragentUuid || !formData.financialCodeUuid || 
        !formData.currencyUuid || !formData.stateUuid) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/projects/${editingProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name: formData.projectName,
          date: formData.date,
          value: parseFloat(formData.value),
          oris_1630: formData.oris1630 || null,
          counteragent_uuid: formData.counteragentUuid,
          financial_code_uuid: formData.financialCodeUuid,
          currency_uuid: formData.currencyUuid,
          state_uuid: formData.stateUuid,
          employee_uuids: formData.employeeUuids
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update project');
      }

      await fetchProjects();
      setIsEditDialogOpen(false);
      setEditingProject(null);
      resetForm();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (project: Project) => {
    if (!confirm(`Are you sure you want to delete project "${project.projectName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete project');
      }

      await fetchProjects();
    } catch (error: any) {
      alert(error.message);
    }
  };

  // Filtered data
  const filteredProjects = useMemo(() => {
    let result = [...projects];

    // Apply search filter
    if (searchTerm) {
      result = result.filter(project => 
        project.projectName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.contractNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.projectIndex?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.counteragent?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.state?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply column filters
    Object.entries(columnFilters).forEach(([column, values]) => {
      if (values.length > 0) {
        result = result.filter(project => {
          const value = String(project[column as keyof Project] || '');
          return values.includes(value);
        });
      }
    });

    return result;
  }, [projects, searchTerm, columnFilters]);

  // Sorted data
  const sortedProjects = useMemo(() => {
    if (!sortConfig.key) return filteredProjects;

    return [...filteredProjects].sort((a, b) => {
      const aValue = a[sortConfig.key as ColumnKey];
      const bValue = b[sortConfig.key as ColumnKey];
      
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredProjects, sortConfig]);

  // Pagination
  const totalRecords = sortedProjects.length;
  const totalPages = Math.ceil(totalRecords / pageSize);
  
  const paginatedProjects = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return sortedProjects.slice(startIndex, endIndex);
  }, [sortedProjects, currentPage, pageSize]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, columnFilters, pageSize]);

  const visibleColumns = columns.filter(col => col.visible);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatValue = (value: number, currency?: string | null) => {
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
    return currency ? `${formatted} ${currency}` : formatted;
  };

  // Get unique values for filters
  const getUniqueValues = (column: ColumnKey) => {
    const values = projects.map(p => String(p[column] || ''));
    return [...new Set(values)].filter(v => v).sort();
  };

  const FilterPopover = ({ column }: { column: ColumnConfig }) => {
    const uniqueValues = getUniqueValues(column.key as ColumnKey);
    const selectedValues = columnFilters[String(column.key)] || [];

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 w-6 p-0 ${selectedValues.length > 0 ? 'text-blue-600' : ''}`}
          >
            <Filter className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="start">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Filter {column.label}</h4>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {uniqueValues.map(value => (
                <div key={value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${column.key}-${value}`}
                    checked={selectedValues.includes(value)}
                    onCheckedChange={(checked) => {
                      setColumnFilters({
                        ...columnFilters,
                        [column.key]: checked
                          ? [...selectedValues, value]
                          : selectedValues.filter(v => v !== value)
                      });
                    }}
                  />
                  <label
                    htmlFor={`${column.key}-${value}`}
                    className="text-sm cursor-pointer flex-1"
                  >
                    {value}
                  </label>
                </div>
              ))}
            </div>
            {selectedValues.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  const newFilters = { ...columnFilters };
                  delete newFilters[String(column.key)];
                  setColumnFilters(newFilters);
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className="p-6 space-y-6 bg-background">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-foreground">Projects</h1>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Column Visibility</h4>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {columns.map(col => (
                    <div key={String(col.key)} className="flex items-center space-x-2">
                      <Checkbox
                        id={String(col.key)}
                        checked={col.visible}
                        onCheckedChange={(checked) => 
                          handleColumnVisibility(col.key, checked as boolean)
                        }
                      />
                      <label
                        htmlFor={String(col.key)}
                        className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {col.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
          {/* Import Button with Dropdown */}
          <Popover open={isImportMenuOpen} onOpenChange={setIsImportMenuOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" disabled={isImporting}>
                <Upload className="h-4 w-4 mr-2" />
                {isImporting ? 'Importing...' : 'Import'}
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
              <div className="grid gap-2">
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center px-3 py-2 text-sm hover:bg-gray-100 rounded"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </button>
                <button
                  onClick={handleImportClick}
                  className="flex items-center px-3 py-2 text-sm hover:bg-gray-100 rounded"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import from File
                </button>
              </div>
            </PopoverContent>
          </Popover>
          
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={startAdd}>
                <Plus className="h-4 w-4 mr-2" />
                Add Project
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Project</DialogTitle>
              <DialogDescription>
                Create a new project. All fields marked with * are required.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="projectName">Project Name *</Label>
                <Input
                  id="projectName"
                  value={formData.projectName}
                  onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                  placeholder="Enter project name (alphanumeric only)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="value">Value *</Label>
                  <Input
                    id="value"
                    type="number"
                    step="0.01"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="counteragent">Counteragent *</Label>
                <Combobox
                  value={formData.counteragentUuid}
                  onValueChange={(value) => setFormData({ ...formData, counteragentUuid: value })}
                  options={lookupData.counteragents.map(c => ({
                    value: c.uuid,
                    label: `${c.name}${c.internalNumber ? ` (${c.internalNumber})` : ''}`
                  }))}
                  placeholder="Select counteragent..."
                  searchPlaceholder="Search counteragents..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="financialCode">Financial Code *</Label>
                  <Combobox
                    value={formData.financialCodeUuid}
                    onValueChange={(value) => setFormData({ ...formData, financialCodeUuid: value })}
                    options={lookupData.financialCodes.map(fc => ({
                      value: fc.uuid,
                      label: fc.code
                    }))}
                    placeholder="Select code..."
                    searchPlaceholder="Search codes..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="currency">Currency *</Label>
                  <Combobox
                    value={formData.currencyUuid}
                    onValueChange={(value) => setFormData({ ...formData, currencyUuid: value })}
                    options={lookupData.currencies.map(c => ({
                      value: c.uuid,
                      label: c.code
                    }))}
                    placeholder="Select currency..."
                    searchPlaceholder="Search currencies..."
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="state">State *</Label>
                <Combobox
                  value={formData.stateUuid}
                  onValueChange={(value) => setFormData({ ...formData, stateUuid: value })}
                  options={lookupData.states.map(s => ({
                    value: s.uuid,
                    label: s.name
                  }))}
                  placeholder="Select state..."
                  searchPlaceholder="Search states..."
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="employees">Employees</Label>
                <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                  {lookupData.employees.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No employees available</p>
                  ) : (
                    lookupData.employees.map(emp => (
                      <div key={emp.uuid} className="flex items-center space-x-2">
                        <Checkbox
                          id={`emp-${emp.uuid}`}
                          checked={formData.employeeUuids.includes(emp.uuid)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFormData({
                                ...formData,
                                employeeUuids: [...formData.employeeUuids, emp.uuid]
                              });
                            } else {
                              setFormData({
                                ...formData,
                                employeeUuids: formData.employeeUuids.filter(id => id !== emp.uuid)
                              });
                            }
                          }}
                        />
                        <Label htmlFor={`emp-${emp.uuid}`} className="text-sm font-normal cursor-pointer">
                          {emp.name}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="oris1630">ORIS 1630</Label>
                <Input
                  id="oris1630"
                  value={formData.oris1630}
                  onChange={(e) => setFormData({ ...formData, oris1630: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Project'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ძებნა"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <div 
          ref={scrollRef}
          className="overflow-x-auto"
          style={{ overflowX: 'auto' }}
        >
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumns.map(column => (
                  <TableHead
                    key={String(column.key)}
                    style={{ width: column.width, minWidth: column.width }}
                    className={`relative ${dragOverColumn === column.key ? 'bg-blue-50' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, column.key)}
                    onDragOver={(e) => handleDragOver(e, column.key)}
                    onDrop={(e) => handleDrop(e, column.key)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className={`flex-1 flex items-center gap-1 ${column.sortable ? 'cursor-pointer select-none hover:bg-muted' : ''}`}
                        onClick={() => column.sortable && column.key !== 'employees' && handleSort(column.key as ColumnKey)}
                      >
                        <span>{column.label}</span>
                        {column.sortable && sortConfig.key === column.key && (
                          sortConfig.direction === 'asc' ? 
                            <ArrowUp className="h-4 w-4" /> : 
                            <ArrowDown className="h-4 w-4" />
                        )}
                      </div>
                      {column.filterable && column.key !== 'employees' && (
                        <FilterPopover column={column} />
                      )}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setIsResizing({
                            column: column.key,
                            startX: e.clientX,
                            startWidth: column.width
                          });
                        }}
                      />
                    </div>
                  </TableHead>
                ))}
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 1} className="text-center py-8">
                    Loading projects...
                  </TableCell>
                </TableRow>
              ) : paginatedProjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 1} className="text-center py-8">
                    No projects found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProjects.map(project => (
                  <TableRow key={project.id}>
                    {visibleColumns.map(col => {
                      const key = col.key;
                      let value: any;

                      if (key === 'employees') {
                        value = project.employees && project.employees.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {project.employees.map(emp => (
                              <Badge key={emp.employeeUuid} variant="secondary" className="text-xs">
                                {emp.employeeName}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        );
                      } else if (key === 'date') {
                        value = formatDate(project.date);
                      } else if (key === 'value') {
                        value = formatValue(project.value, project.currency);
                      } else if (key === 'state') {
                        value = project.state ? (
                          <Badge variant={
                            project.state === 'Active' || project.state === 'მიმდინარე' ? 'default' :
                            project.state === 'Completed' || project.state === 'დახურული' ? 'secondary' :
                            project.state === 'Cancelled' || project.state === 'გაუქმებული' ? 'destructive' :
                            'outline'
                          }>
                            {project.state}
                          </Badge>
                        ) : '-';
                      } else {
                        value = project[key as keyof Project];
                        if (value === null || value === undefined || value === '') {
                          value = <span className="text-muted-foreground">-</span>;
                        }
                      }

                      return (
                        <TableCell key={String(key)} style={{ minWidth: col.width }}>
                          {value}
                        </TableCell>
                      );
                    })}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEdit(project)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(project)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Bottom scroller */}
      {needsBottomScroller && typeof window !== 'undefined' && createPortal(
        <div 
          className="fixed bottom-0 left-0 right-0 overflow-x-auto bg-gray-100 border-t"
          style={{ height: '12px', zIndex: 40 }}
        >
          <div 
            ref={bottomScrollRef}
            className="overflow-x-scroll"
            style={{ height: '100%', overflowY: 'hidden' }}
          >
            <div style={{ width: scrollContentWidth, height: '1px' }} />
          </div>
        </div>,
        document.body
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update project details. All fields marked with * are required.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-projectName">Project Name *</Label>
              <Input
                id="edit-projectName"
                value={formData.projectName}
                onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                placeholder="Enter project name (alphanumeric only)"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-date">Date *</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-value">Value *</Label>
                <Input
                  id="edit-value"
                  type="number"
                  step="0.01"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-counteragent">Counteragent *</Label>
              <Combobox
                value={formData.counteragentUuid}
                onValueChange={(value) => setFormData({ ...formData, counteragentUuid: value })}
                options={lookupData.counteragents.map(c => ({
                  value: c.uuid,
                  label: `${c.name}${c.internalNumber ? ` (${c.internalNumber})` : ''}`
                }))}
                placeholder="Select counteragent..."
                searchPlaceholder="Search counteragents..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-financialCode">Financial Code *</Label>
                <Combobox
                  value={formData.financialCodeUuid}
                  onValueChange={(value) => setFormData({ ...formData, financialCodeUuid: value })}
                  options={lookupData.financialCodes.map(fc => ({
                    value: fc.uuid,
                    label: fc.code
                  }))}
                  placeholder="Select code..."
                  searchPlaceholder="Search codes..."
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-currency">Currency *</Label>
                <Combobox
                  value={formData.currencyUuid}
                  onValueChange={(value) => setFormData({ ...formData, currencyUuid: value })}
                  options={lookupData.currencies.map(c => ({
                    value: c.uuid,
                    label: c.code
                  }))}
                  placeholder="Select currency..."
                  searchPlaceholder="Search currencies..."
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-state">State *</Label>
              <Combobox
                value={formData.stateUuid}
                onValueChange={(value) => setFormData({ ...formData, stateUuid: value })}
                options={lookupData.states.map(s => ({
                  value: s.uuid,
                  label: s.name
                }))}
                placeholder="Select state..."
                searchPlaceholder="Search states..."
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-employees">Employees</Label>
              <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                {lookupData.employees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No employees available</p>
                ) : (
                  lookupData.employees.map(emp => (
                    <div key={emp.uuid} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-emp-${emp.uuid}`}
                        checked={formData.employeeUuids.includes(emp.uuid)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({
                              ...formData,
                              employeeUuids: [...formData.employeeUuids, emp.uuid]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              employeeUuids: formData.employeeUuids.filter(id => id !== emp.uuid)
                            });
                          }
                        }}
                      />
                      <Label htmlFor={`edit-emp-${emp.uuid}`} className="text-sm font-normal cursor-pointer">
                        {emp.name}
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-oris1630">ORIS 1630</Label>
              <Input
                id="edit-oris1630"
                value={formData.oris1630}
                onChange={(e) => setFormData({ ...formData, oris1630: e.target.value })}
                placeholder="Optional"
              />
            </div>

            {editingProject && (
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Read-only computed fields:</Label>
                <div className="space-y-1 text-sm">
                  <div><strong>Contract No:</strong> {editingProject.contractNo || 'Will be generated'}</div>
                  <div><strong>Project Index:</strong> {editingProject.projectIndex || 'Will be generated'}</div>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingProject(null);
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update Project'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-muted-foreground">
          Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} records
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => setPageSize(Number(value))}
            >
              <SelectTrigger className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map(size => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm px-3">
              {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
