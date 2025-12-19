"use client";

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
  Info
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Combobox } from '@/components/ui/combobox';
import { MultiCombobox } from '@/components/ui/multi-combobox';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';



export type Project = {
  id: number;
  createdAt: string;
  updatedAt: string;
  projectUuid: string;
  projectName: string;
  date: string;
  value: string | number;
  oris1630: string | null;
  counteragentUuid: string;
  financialCodeUuid: string;
  currencyUuid: string;
  stateUuid: string;
  counteragent: string | null;
  financialCode: string | null;
  currency: string | null;
  state: string | null;
  contractNo: string | null;
  projectIndex: string | null;
  employees?: Array<{
    employeeUuid: string;
    employeeName: string;
  }>;
};

type ColumnKey = keyof Project;

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
  { key: 'createdAt', label: 'Created', width: 140, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'updatedAt', label: 'Updated', width: 140, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'projectUuid', label: 'UUID', width: 200, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'projectName', label: 'Project Name', width: 200, visible: true, sortable: true, filterable: true },
  { key: 'date', label: 'Date', width: 120, visible: true, sortable: true, filterable: true },
  { key: 'value', label: 'Value', width: 120, visible: true, sortable: true, filterable: true },
  { key: 'oris1630', label: 'ORIS 1630', width: 120, visible: true, sortable: true, filterable: true },
  { key: 'counteragent', label: 'Counteragent', width: 200, visible: true, sortable: true, filterable: true },
  { key: 'financialCode', label: 'Financial Code', width: 150, visible: true, sortable: true, filterable: true },
  { key: 'currency', label: 'Currency', width: 100, visible: true, sortable: true, filterable: true },
  { key: 'state', label: 'State', width: 120, visible: true, sortable: true, filterable: true },
  { key: 'contractNo', label: 'Contract No', width: 150, visible: true, sortable: true, filterable: true },
  { key: 'projectIndex', label: 'Project Index', width: 250, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'counteragentUuid', label: 'Counteragent UUID', width: 200, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'financialCodeUuid', label: 'Financial Code UUID', width: 200, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'currencyUuid', label: 'Currency UUID', width: 200, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'stateUuid', label: 'State UUID', width: 200, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'employees', label: 'Employees', width: 200, visible: true, sortable: true, filterable: true, responsive: 'lg' }
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

// Helper function to map API response to Project with proper defaults
const mapProjectData = (row: any): Project => ({
  id: row.id || row.ID,
  createdAt: row.created_at || row.createdAt || '',
  updatedAt: row.updated_at || row.updatedAt || '',
  projectUuid: row.project_uuid || row.projectUuid || '',
  projectName: row.project_name || row.projectName || '',
  date: row.date || row.DATE || '',
  value: row.value || row.VALUE || 0,
  oris1630: row.oris_1630 || row.oris1630 || null,
  counteragentUuid: row.counteragent_uuid || row.counteragentUuid || '',
  financialCodeUuid: row.financial_code_uuid || row.financialCodeUuid || '',
  currencyUuid: row.currency_uuid || row.currencyUuid || '',
  stateUuid: row.state_uuid || row.stateUuid || '',
  counteragent: row.counteragent || row.COUNTERAGENT || null,
  financialCode: row.financial_code || row.financialCode || null,
  currency: row.currency || row.CURRENCY || null,
  state: row.state || row.STATE || null,
  contractNo: row.contract_no || row.contractNo || null,
  projectIndex: row.project_index || row.projectIndex || null,
  employees: row.employees || []
});

export function ProjectsTable({ data }: { data?: Project[] }) {
  const [projects, setProjects] = useState<Project[]>(data ?? []);
  // Dropdown data
  const [counteragentsList, setCounteragentsList] = useState<Array<{id: number, name: string, counteragentUuid: string}>>([]);
  const [financialCodesList, setFinancialCodesList] = useState<Array<{id: number, validation: string, uuid: string}>>([]);
  const [currenciesList, setCurrenciesList] = useState<Array<{id: number, code: string, uuid: string}>>([]);
  const [statesList, setStatesList] = useState<Array<{id: number, name: string, uuid: string}>>([]);
  const [employeesList, setEmployeesList] = useState<Array<{id: number, name: string, counteragentUuid: string}>>([]);
  
  // Horizontal scroll synchronization between the table and a sticky bottom scroller
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const [needsBottomScroller, setNeedsBottomScroller] = useState(false);
  const [scrollContentWidth, setScrollContentWidth] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<ColumnKey | null>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuditDialogOpen, setIsAuditDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  
  // Initialize columns from localStorage or use defaults
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    if (typeof window !== 'undefined') {
      const savedColumns = localStorage.getItem('projects-table-columns');
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
    projectName: '',
    date: '',
    value: '',
    oris1630: '',
    counteragentUuid: '',
    financialCodeUuid: '',
    currencyUuid: '',
    stateUuid: '',
    employees: [] as string[]
  });
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const pageSizeOptions = [50, 100, 200, 500, 1000];

  // Respond to external data updates
  useEffect(() => {
    if (data) setProjects(data);
  }, [data]);

// Fetch dropdown data
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        // Fetch counteragents
        const counteragentsRes = await fetch('/api/counteragents');
        if (counteragentsRes.ok) {
          const counteragentsData = await counteragentsRes.json();
          setCounteragentsList(counteragentsData.map((c: any) => ({
            id: c.id,
            name: c.counteragent || c.name,
            counteragentUuid: c.counteragent_uuid || c.counteragentUuid
          })));
        }
        
        // Fetch financial codes (filtered by is_income=true and applies_to_pl=true)
        const financialCodesRes = await fetch('/api/financial-codes');
        if (financialCodesRes.ok) {
          const financialCodesData = await financialCodesRes.json();
          const filteredCodes = financialCodesData.filter((fc: any) => 
            fc.isIncome === true && fc.appliesToPL === true
          );
          setFinancialCodesList(filteredCodes.map((fc: any) => ({
            id: fc.id,
            validation: fc.validation,
            uuid: fc.uuid || fc.financial_code_uuid
          })));
        }
        
        // Fetch currencies (limited to USD, GEL, EUR)
        const currenciesRes = await fetch('/api/currencies');
        if (currenciesRes.ok) {
          const currenciesData = await currenciesRes.json();
          const allowedCurrencies = ['USD', 'GEL', 'EUR'];
          const filteredCurrencies = allowedCurrencies
            .map(code => currenciesData.find((c: any) => c.code === code))
            .filter(Boolean);
          setCurrenciesList(filteredCurrencies.map((c: any) => ({
            id: c.id,
            code: c.code,
            uuid: c.uuid || c.currency_uuid
          })));
        }
        
        // Fetch states
        const statesRes = await fetch('/api/project-states');
        if (statesRes.ok) {
          const statesData = await statesRes.json();
          setStatesList(statesData.map((s: any) => ({
            id: s.id,
            name: s.name,
            uuid: s.uuid || s.state_uuid
          })));
        }
        
        // Fetch employees (counteragents with is_emploee=true)
        const employeesRes = await fetch('/api/counteragents?is_emploee=true');
        if (employeesRes.ok) {
          const employeesData = await employeesRes.json();
          setEmployeesList(employeesData.map((e: any) => ({
            id: e.id,
            name: e.counteragent || e.name,
            counteragentUuid: e.counteragent_uuid || e.counteragentUuid
          })));
        }
      } catch (error) {
        console.error('Failed to fetch dropdown data:', error);
      }
    };
    
    fetchDropdownData();
  }, []);

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
  }, [projects, columns]);

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
    localStorage.setItem('projects-table-columns', JSON.stringify(columns));
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
  const validateForm = async () => {
    const errors: Record<string, string> = {};
    
    // Project Name - mandatory, alphanumeric
    if (!formData.projectName.trim()) {
      errors.projectName = 'Project name is required';
    } else if (!/^[a-zA-Z0-9\s]+$/.test(formData.projectName)) {
      errors.projectName = 'Project name must contain only English letters and numbers';
    }
    
    // Date - mandatory, valid date
    if (!formData.date) {
      errors.date = 'Date is required';
    } else if (isNaN(new Date(formData.date).getTime())) {
      errors.date = 'Valid date is required';
    }
    
    // Value - mandatory, must be > 0
    if (!formData.value) {
      errors.value = 'Value is required';
    } else if (parseFloat(formData.value) <= 0) {
      errors.value = 'Value must be greater than 0';
    }
    
    // Counteragent - mandatory
    if (!formData.counteragentUuid) {
      errors.counteragentUuid = 'Counteragent is required';
    }
    
    // Financial Code - mandatory
    if (!formData.financialCodeUuid) {
      errors.financialCodeUuid = 'Financial code is required';
    }
    
    // Currency - mandatory
    if (!formData.currencyUuid) {
      errors.currencyUuid = 'Currency is required';
    }
    
    // State - mandatory
    if (!formData.stateUuid) {
      errors.stateUuid = 'State is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  

  

  // Filter and search logic
  const filteredProjects = useMemo(() => {
    let filtered = projects;

    // Apply search across all visible text fields
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(project =>
        (project.projectName || '').toLowerCase().includes(search) ||
        (project.counteragent || '').toLowerCase().includes(search) ||
        (project.financialCode || '').toLowerCase().includes(search) ||
        (project.currency || '').toLowerCase().includes(search) ||
        (project.state || '').toLowerCase().includes(search) ||
        (project.contractNo || '').toLowerCase().includes(search) ||
        (project.employees?.some(e => e.employeeName?.toLowerCase().includes(search)))
      );
    }

    // Apply column filters
    Object.entries(columnFilters).forEach(([column, values]) => {
      if (values.length > 0) {
        filtered = filtered.filter(project => {
          if (column === 'employees') {
            // For employees, check if any employee name matches the selected values
            const employeeNames = project.employees?.map(e => e.employeeName) || [];
            return values.some(selectedName => employeeNames.includes(selectedName));
          }
          const cellValue = String(project[column as ColumnKey]);
          return values.includes(cellValue);
        });
      }
    });

    return filtered;
  }, [projects, searchTerm, columnFilters]);

  // Sort logic
  const sortedProjects = useMemo(() => {
    if (!sortField) return filteredProjects;

    return [...filteredProjects].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      
      // Handle nulls
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredProjects, sortField, sortDirection]);

  // Pagination
  const totalRecords = sortedProjects.length;
  const totalPages = Math.ceil(totalRecords / pageSize);
  
  const paginatedProjects = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return sortedProjects.slice(startIndex, endIndex);
  }, [sortedProjects, currentPage, pageSize]);

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
    if (!(await validateForm())) return;
    
    if (editingProject) {
      // Update existing project via API
      try {
        const response = await fetch(`/api/projects?id=${editingProject.id}`, {
          method: 'PATCH',
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
            employees: formData.employees
          })
        });
        
        if (!response.ok) {
          const error = await response.json();
          console.error('[Edit] API error:', error);
          alert(`Failed to update: ${error.error || 'Unknown error'}`);
          return;
        }
        
        // Refresh data
        const refreshResponse = await fetch('/api/projects');
        const refreshedData = await refreshResponse.json();
        const mappedData = refreshedData.map(mapProjectData);
        setProjects(mappedData);
        
        setIsEditDialogOpen(false);
        setEditingProject(null);
      } catch (error) {
        console.error('[Edit] Network error:', error);
        alert('Failed to update project. Please try again.');
        return;
      }
    } else {
      // Add new project via API
      try {
        const response = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectName: formData.projectName,
            date: formData.date,
            value: parseFloat(formData.value),
            oris1630: formData.oris1630 || null,
            counteragentUuid: formData.counteragentUuid,
            financialCodeUuid: formData.financialCodeUuid,
            currencyUuid: formData.currencyUuid,
            stateUuid: formData.stateUuid,
            employees: formData.employees
          })
        });
        
        if (!response.ok) {
          const error = await response.json();
          console.error('[Add] API error:', error);
          alert(`Failed to add: ${error.error || 'Unknown error'}`);
          return;
        }
        
        // Refresh data
        const refreshResponse = await fetch('/api/projects');
        const refreshedData = await refreshResponse.json();
        const mappedData = refreshedData.map(mapProjectData);
        setProjects(mappedData);
        
        setIsAddDialogOpen(false);
      } catch (error) {
        console.error('[Add] Network error:', error);
        alert('Failed to add project. Please try again.');
        return;
      }
    }
    
    resetForm();
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
      employees: []
    });
    setFormErrors({});
  };

  const startEdit = (project: Project) => {
    setEditingProject(project);
    // Format date to YYYY-MM-DD for input[type="date"]
    const formatDateForInput = (dateStr: string | null) => {
      if (!dateStr) return '';
      try {
        const date = new Date(dateStr);
        return date.toISOString().split('T')[0];
      } catch {
        return '';
      }
    };
    setFormData({
      projectName: project.projectName || '',
      date: formatDateForInput(project.date),
      value: String(project.value || ''),
      oris1630: project.oris1630 || '',
      counteragentUuid: project.counteragentUuid || '',
      financialCodeUuid: project.financialCodeUuid || '',
      currencyUuid: project.currencyUuid || '',
      stateUuid: project.stateUuid || '',
      employees: (project.employees || []).map(e => e.employeeUuid)
    });
    setFormErrors({});
    setIsEditDialogOpen(true);
  };

  const cancelEdit = () => {
    setEditingProject(null);
    setIsEditDialogOpen(false);
    resetForm();
  };

  const deleteProject = (id: number) => {
    setProjects(projects.filter(p => p.id !== id));
  };

  const viewAuditLog = async (project: Project) => {
    setEditingProject(project);
    setIsAuditDialogOpen(true);
    setLoadingAudit(true);
    
    try {
      const response = await fetch(`/api/audit?table=Projects&recordId=${project.id}`);
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
    if (column === 'employees') {
      // For employees, extract all unique employee names from the nested array
      const allEmployees = projects.flatMap(project => 
        project.employees?.map(e => e.employeeName) || []
      );
      return [...new Set(allEmployees)].sort();
    }
    return [...new Set(projects.map(Project => String(Project[column])))].sort();
  };

  // Column filter component with Google Sheets-style search
  const ColumnFilter = ({ column }: { column: ColumnConfig }) => {
    const uniqueValues = getUniqueValues(column.key);
    const selectedValues = columnFilters[column.key] || [];
    const [filterSearchTerm, setFilterSearchTerm] = useState('');
    const [tempSelectedValues, setTempSelectedValues] = useState<string[]>(selectedValues);
    const [isOpen, setIsOpen] = useState(false);

    // Filter unique values based on search term
    const filteredUniqueValues = useMemo(() => {
      if (!filterSearchTerm) return uniqueValues;
      return uniqueValues.filter(value => 
        value.toLowerCase().includes(filterSearchTerm.toLowerCase())
      );
    }, [uniqueValues, filterSearchTerm]);

    // Reset temp values when opening
    const handleOpenChange = (open: boolean) => {
      setIsOpen(open);
      if (open) {
        setTempSelectedValues(selectedValues);
        setFilterSearchTerm('');
      }
    };

    // Apply filters
    const handleApply = () => {
      setColumnFilters({
        ...columnFilters,
        [column.key]: tempSelectedValues
      });
      setIsOpen(false);
    };

    // Cancel changes
    const handleCancel = () => {
      setTempSelectedValues(selectedValues);
      setIsOpen(false);
    };

    // Clear all selections
    const handleClearAll = () => {
      setTempSelectedValues([]);
    };

    // Select all visible values
    const handleSelectAll = () => {
      setTempSelectedValues(filteredUniqueValues);
    };

    // Sort values - numbers first, then text
    const sortedFilteredValues = useMemo(() => {
      return [...filteredUniqueValues].sort((a, b) => {
        const aIsNum = !isNaN(Number(a));
        const bIsNum = !isNaN(Number(b));
        
        if (aIsNum && bIsNum) {
          return Number(a) - Number(b);
        } else if (aIsNum && !bIsNum) {
          return -1;
        } else if (!aIsNum && bIsNum) {
          return 1;
        } else {
          return a.localeCompare(b);
        }
      });
    }, [filteredUniqueValues]);

    return (
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className={`h-6 px-1 ${selectedValues.length > 0 ? 'text-blue-600' : ''}`}
          >
            <Filter className="h-3 w-3" />
            {selectedValues.length > 0 && (
              <span className="ml-1 text-xs">{selectedValues.length}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="start">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-2">
              <div className="font-medium text-sm">{column.label}</div>
              <div className="text-xs text-muted-foreground">
                Displaying {filteredUniqueValues.length}
              </div>
            </div>

            {/* Sort Options */}
            <div className="space-y-1">
              <button 
                className="w-full text-left text-sm py-1 px-2 hover:bg-muted rounded"
                onClick={() => {
                  const sorted = [...uniqueValues].sort();
                  setTempSelectedValues(tempSelectedValues.filter(v => sorted.includes(v)));
                }}
              >
                Sort A to Z
              </button>
              <button 
                className="w-full text-left text-sm py-1 px-2 hover:bg-muted rounded"
                onClick={() => {
                  const sorted = [...uniqueValues].sort().reverse();
                  setTempSelectedValues(tempSelectedValues.filter(v => sorted.includes(v)));
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
                    Select all {filteredUniqueValues.length}
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
                    <div key={value} className="flex items-center space-x-2 py-1">
                      <Checkbox
                        id={`${column.key}-${value}`}
                        checked={tempSelectedValues.includes(value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setTempSelectedValues([...tempSelectedValues, value]);
                          } else {
                            setTempSelectedValues(tempSelectedValues.filter(v => v !== value));
                          }
                        }}
                      />
                      <Label htmlFor={`${column.key}-${value}`} className="text-sm flex-1 cursor-pointer">
                        {value}
                      </Label>
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
          <h1 className="text-2xl font-medium text-foreground">Projects</h1>
        </div>
        <div className="flex items-center gap-2">
          <ColumnSettings />
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Add Project
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Project</DialogTitle>
                <DialogDescription>
                  Enter the details for the new project. Fields marked with * are required.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {/* Project Name - mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-projectName" className="text-right">Project Name *</Label>
                  <div className="col-span-3">
                    <Input
                      id="add-projectName"
                      value={formData.projectName}
                      onChange={(e) => {
                        setFormData({...formData, projectName: e.target.value});
                        if (formErrors.projectName) setFormErrors({...formErrors, projectName: ''});
                      }}
                      className={formErrors.projectName ? 'border-red-500' : ''}
                      placeholder="Only English letters and numbers"
                    />
                    {formErrors.projectName && <p className="text-xs text-red-500 mt-1">{formErrors.projectName}</p>}
                  </div>
                </div>

                {/* Date - mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-date" className="text-right">Date *</Label>
                  <div className="col-span-3">
                    <Input
                      id="add-date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => {
                        setFormData({...formData, date: e.target.value});
                        if (formErrors.date) setFormErrors({...formErrors, date: ''});
                      }}
                      className={formErrors.date ? 'border-red-500' : ''}
                    />
                    {formErrors.date && <p className="text-xs text-red-500 mt-1">{formErrors.date}</p>}
                  </div>
                </div>

                {/* Value - mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-value" className="text-right">Value *</Label>
                  <div className="col-span-3">
                    <Input
                      id="add-value"
                      type="number"
                      step="0.01"
                      value={formData.value}
                      onChange={(e) => {
                        setFormData({...formData, value: e.target.value});
                        if (formErrors.value) setFormErrors({...formErrors, value: ''});
                      }}
                      className={formErrors.value ? 'border-red-500' : ''}
                      placeholder="Must be greater than 0"
                    />
                    {formErrors.value && <p className="text-xs text-red-500 mt-1">{formErrors.value}</p>}
                  </div>
                </div>

                {/* ORIS 1630 - optional */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-oris1630" className="text-right">ORIS 1630</Label>
                  <div className="col-span-3">
                    <Input
                      id="add-oris1630"
                      value={formData.oris1630}
                      onChange={(e) => setFormData({...formData, oris1630: e.target.value})}
                    />
                  </div>
                </div>

                {/* Counteragent - mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-counteragent" className="text-right">Counteragent *</Label>
                  <div className="col-span-3">
                    <Combobox
                      options={counteragentsList.map(c => ({ value: c.counteragentUuid, label: c.name, keywords: c.name }))}
                      value={formData.counteragentUuid}
                      onValueChange={(value: string) => {
                        setFormData({...formData, counteragentUuid: value});
                        if (formErrors.counteragentUuid) setFormErrors({...formErrors, counteragentUuid: ''});
                      }}
                      placeholder="Select counteragent"
                      searchPlaceholder="Search counteragents..."
                      emptyText="No counteragent found."
                      triggerClassName={formErrors.counteragentUuid ? 'border-red-500' : ''}
                    />
                    {formErrors.counteragentUuid && <p className="text-xs text-red-500 mt-1">{formErrors.counteragentUuid}</p>}
                  </div>
                </div>

                {/* Financial Code - mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-financialCode" className="text-right">Financial Code *</Label>
                  <div className="col-span-3">
                    <Combobox
                      options={financialCodesList.map(fc => ({ value: fc.uuid, label: fc.validation, keywords: fc.validation }))}
                      value={formData.financialCodeUuid}
                      onValueChange={(value: string) => {
                        setFormData({...formData, financialCodeUuid: value});
                        if (formErrors.financialCodeUuid) setFormErrors({...formErrors, financialCodeUuid: ''});
                      }}
                      placeholder="Select financial code"
                      searchPlaceholder="Search financial codes..."
                      emptyText="No financial code found."
                      triggerClassName={formErrors.financialCodeUuid ? 'border-red-500' : ''}
                    />
                    {formErrors.financialCodeUuid && <p className="text-xs text-red-500 mt-1">{formErrors.financialCodeUuid}</p>}
                  </div>
                </div>

                {/* Currency - mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-currency" className="text-right">Currency *</Label>
                  <div className="col-span-3">
                    <Combobox
                      options={currenciesList.map(c => ({ value: c.uuid, label: c.code, keywords: c.code }))}
                      value={formData.currencyUuid}
                      onValueChange={(value: string) => {
                        setFormData({...formData, currencyUuid: value});
                        if (formErrors.currencyUuid) setFormErrors({...formErrors, currencyUuid: ''});
                      }}
                      placeholder="Select currency"
                      searchPlaceholder="Search currencies..."
                      emptyText="No currency found."
                      triggerClassName={formErrors.currencyUuid ? 'border-red-500' : ''}
                    />
                    {formErrors.currencyUuid && <p className="text-xs text-red-500 mt-1">{formErrors.currencyUuid}</p>}
                  </div>
                </div>

                {/* State - mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-state" className="text-right">State *</Label>
                  <div className="col-span-3">
                    <Combobox
                      options={statesList.map(s => ({ value: s.uuid, label: s.name, keywords: s.name }))}
                      value={formData.stateUuid}
                      onValueChange={(value: string) => {
                        setFormData({...formData, stateUuid: value});
                        if (formErrors.stateUuid) setFormErrors({...formErrors, stateUuid: ''});
                      }}
                      placeholder="Select state"
                      searchPlaceholder="Search states..."
                      emptyText="No state found."
                      triggerClassName={formErrors.stateUuid ? 'border-red-500' : ''}
                    />
                    {formErrors.stateUuid && <p className="text-xs text-red-500 mt-1">{formErrors.stateUuid}</p>}
                  </div>
                </div>

                {/* Employees - optional, multi-select */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Employees</Label>
                  <div className="col-span-3">
                    <MultiCombobox
                      options={employeesList.map(e => ({
                        value: e.counteragentUuid,
                        label: e.name,
                        keywords: e.name
                      }))}
                      value={formData.employees}
                      onValueChange={(values) => setFormData({ ...formData, employees: values })}
                      placeholder="Select employees..."
                      searchPlaceholder="Search employees..."
                      emptyText="No employee found."
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave}>Save Project</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Project</DialogTitle>
                <DialogDescription>
                  Update the details for {editingProject?.projectName}. Fields marked with * are required.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {/* Project Name - mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-projectName" className="text-right">Project Name *</Label>
                  <div className="col-span-3">
                    <Input
                      id="edit-projectName"
                      value={formData.projectName}
                      onChange={(e) => {
                        setFormData({...formData, projectName: e.target.value});
                        if (formErrors.projectName) setFormErrors({...formErrors, projectName: ''});
                      }}
                      className={formErrors.projectName ? 'border-red-500' : ''}
                      placeholder="Only English letters and numbers"
                    />
                    {formErrors.projectName && <p className="text-xs text-red-500 mt-1">{formErrors.projectName}</p>}
                  </div>
                </div>

                {/* Date - mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-date" className="text-right">Date *</Label>
                  <div className="col-span-3">
                    <Input
                      id="edit-date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => {
                        setFormData({...formData, date: e.target.value});
                        if (formErrors.date) setFormErrors({...formErrors, date: ''});
                      }}
                      className={formErrors.date ? 'border-red-500' : ''}
                    />
                    {formErrors.date && <p className="text-xs text-red-500 mt-1">{formErrors.date}</p>}
                  </div>
                </div>

                {/* Value - mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-value" className="text-right">Value *</Label>
                  <div className="col-span-3">
                    <Input
                      id="edit-value"
                      type="number"
                      step="0.01"
                      value={formData.value}
                      onChange={(e) => {
                        setFormData({...formData, value: e.target.value});
                        if (formErrors.value) setFormErrors({...formErrors, value: ''});
                      }}
                      className={formErrors.value ? 'border-red-500' : ''}
                      placeholder="Must be greater than 0"
                    />
                    {formErrors.value && <p className="text-xs text-red-500 mt-1">{formErrors.value}</p>}
                  </div>
                </div>

                {/* ORIS 1630 - optional */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-oris1630" className="text-right">ORIS 1630</Label>
                  <div className="col-span-3">
                    <Input
                      id="edit-oris1630"
                      value={formData.oris1630}
                      onChange={(e) => setFormData({...formData, oris1630: e.target.value})}
                    />
                  </div>
                </div>

                {/* Counteragent - mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-counteragent" className="text-right">Counteragent *</Label>
                  <div className="col-span-3">
                    <Combobox
                      options={counteragentsList.map(c => ({ value: c.counteragentUuid, label: c.name, keywords: c.name }))}
                      value={formData.counteragentUuid}
                      onValueChange={(value: string) => {
                        setFormData({...formData, counteragentUuid: value});
                        if (formErrors.counteragentUuid) setFormErrors({...formErrors, counteragentUuid: ''});
                      }}
                      placeholder="Select counteragent"
                      searchPlaceholder="Search counteragents..."
                      emptyText="No counteragent found."
                      triggerClassName={formErrors.counteragentUuid ? 'border-red-500' : ''}
                    />
                    {formErrors.counteragentUuid && <p className="text-xs text-red-500 mt-1">{formErrors.counteragentUuid}</p>}
                  </div>
                </div>

                {/* Financial Code - mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-financialCode" className="text-right">Financial Code *</Label>
                  <div className="col-span-3">
                    <Combobox
                      options={financialCodesList.map(fc => ({ value: fc.uuid, label: fc.validation, keywords: fc.validation }))}
                      value={formData.financialCodeUuid}
                      onValueChange={(value: string) => {
                        setFormData({...formData, financialCodeUuid: value});
                        if (formErrors.financialCodeUuid) setFormErrors({...formErrors, financialCodeUuid: ''});
                      }}
                      placeholder="Select financial code"
                      searchPlaceholder="Search financial codes..."
                      emptyText="No financial code found."
                      triggerClassName={formErrors.financialCodeUuid ? 'border-red-500' : ''}
                    />
                    {formErrors.financialCodeUuid && <p className="text-xs text-red-500 mt-1">{formErrors.financialCodeUuid}</p>}
                  </div>
                </div>

                {/* Currency - mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-currency" className="text-right">Currency *</Label>
                  <div className="col-span-3">
                    <Combobox
                      options={currenciesList.map(c => ({ value: c.uuid, label: c.code, keywords: c.code }))}
                      value={formData.currencyUuid}
                      onValueChange={(value: string) => {
                        setFormData({...formData, currencyUuid: value});
                        if (formErrors.currencyUuid) setFormErrors({...formErrors, currencyUuid: ''});
                      }}
                      placeholder="Select currency"
                      searchPlaceholder="Search currencies..."
                      emptyText="No currency found."
                      triggerClassName={formErrors.currencyUuid ? 'border-red-500' : ''}
                    />
                    {formErrors.currencyUuid && <p className="text-xs text-red-500 mt-1">{formErrors.currencyUuid}</p>}
                  </div>
                </div>

                {/* State - mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-state" className="text-right">State *</Label>
                  <div className="col-span-3">
                    <Combobox
                      options={statesList.map(s => ({ value: s.uuid, label: s.name, keywords: s.name }))}
                      value={formData.stateUuid}
                      onValueChange={(value: string) => {
                        setFormData({...formData, stateUuid: value});
                        if (formErrors.stateUuid) setFormErrors({...formErrors, stateUuid: ''});
                      }}
                      placeholder="Select state"
                      searchPlaceholder="Search states..."
                      emptyText="No state found."
                      triggerClassName={formErrors.stateUuid ? 'border-red-500' : ''}
                    />
                    {formErrors.stateUuid && <p className="text-xs text-red-500 mt-1">{formErrors.stateUuid}</p>}
                  </div>
                </div>

                {/* Employees - optional, multi-select */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Employees</Label>
                  <div className="col-span-3">
                    <MultiCombobox
                      options={employeesList.map(e => ({
                        value: e.counteragentUuid,
                        label: e.name,
                        keywords: e.name
                      }))}
                      value={formData.employees}
                      onValueChange={(values) => setFormData({ ...formData, employees: values })}
                      placeholder="Select employees..."
                      searchPlaceholder="Search employees..."
                      emptyText="No employee found."
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={cancelEdit}>Cancel</Button>
                <Button onClick={handleSave}>Update Project</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Audit History Dialog */}
          <Dialog open={isAuditDialogOpen} onOpenChange={setIsAuditDialogOpen}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Audit History</DialogTitle>
                <DialogDescription>
                  Change history for {editingProject?.projectName} (ID: {editingProject?.id})
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
                        {column.filterable && <ColumnFilter column={column} />}
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
              {paginatedProjects.map((project) => (
                <TableRow key={project.id} className="hover:bg-muted/50 transition-colors">
                  {visibleColumns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={`${getResponsiveClass(column.responsive)} relative bg-white`}
                      style={{ width: column.width }}
                    >
                      <div className="py-1 overflow-hidden text-ellipsis whitespace-nowrap">
                        {column.key === 'id' ? (
                          <span className="text-sm">{project.id}</span>
                        ) : column.key === 'createdAt' ? (
                          <span className="text-sm">{new Date(project.createdAt).toLocaleDateString()}</span>
                        ) : column.key === 'updatedAt' ? (
                          <span className="text-sm">{new Date(project.updatedAt).toLocaleDateString()}</span>
                        ) : column.key === 'projectUuid' ? (
                          <span className="text-sm">{project.projectUuid}</span>
                        ) : column.key === 'projectName' ? (
                          <span className="text-sm font-medium">{project.projectName}</span>
                        ) : column.key === 'date' ? (
                          <span className="text-sm">{project.date}</span>
                        ) : column.key === 'value' ? (
                          <span className="text-sm">{Number(project.value).toLocaleString()}</span>
                        ) : column.key === 'oris1630' ? (
                          <span className="text-sm">{project.oris1630 || '-'}</span>
                        ) : column.key === 'counteragent' ? (
                          <span className="text-sm">{project.counteragent || '-'}</span>
                        ) : column.key === 'financialCode' ? (
                          <span className="text-sm">{project.financialCode || '-'}</span>
                        ) : column.key === 'currency' ? (
                          <span className="text-sm">{project.currency || '-'}</span>
                        ) : column.key === 'state' ? (
                          <span className="text-sm">{project.state || '-'}</span>
                        ) : column.key === 'contractNo' ? (
                          <span className="text-sm">{project.contractNo || '-'}</span>
                        ) : column.key === 'projectIndex' ? (
                          <span className="text-sm">{project.projectIndex || '-'}</span>
                        ) : column.key === 'counteragentUuid' ? (
                          <span className="text-sm">{project.counteragentUuid}</span>
                        ) : column.key === 'financialCodeUuid' ? (
                          <span className="text-sm">{project.financialCodeUuid}</span>
                        ) : column.key === 'currencyUuid' ? (
                          <span className="text-sm">{project.currencyUuid}</span>
                        ) : column.key === 'stateUuid' ? (
                          <span className="text-sm">{project.stateUuid}</span>
                        ) : column.key === 'employees' ? (
                          <span className="text-sm">
                            {project.employees && project.employees.length > 0 
                              ? project.employees.map(e => e.employeeName).join(', ')
                              : '-'}
                          </span>
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
                        onClick={() => startEdit(project)}
                        className="h-7 w-7 p-0"
                        title="Edit project"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => viewAuditLog(project)}
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
      {sortedProjects.length === 0 && (
        <div className="text-center py-12">
          <div className="text-muted-foreground">
            {searchTerm || Object.values(columnFilters).some(f => f.length > 0) ? (
              <>
                <p className="text-lg font-medium mb-2">No projects found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
              </>
            ) : (
              <>
                <p className="text-lg font-medium mb-2">No projects added yet</p>
                <p className="text-sm">Get started by adding your first project</p>
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
export default ProjectsTable;

