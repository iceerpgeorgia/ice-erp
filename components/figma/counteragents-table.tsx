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
import { CounteragentFormDialog } from './CounteragentFormDialog';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';

// FEATURE FLAG: Set to true to use new form, false to use old form
const USE_NEW_FORM = true;



export type Counteragent = {
  id: number;
  createdAt: string;
  updatedAt: string;
  ts: string;
  counteragentUuid: string;
  name: string;
  identificationNumber: string | null;
  birthOrIncorporationDate: string | null;
  entityType: string | null;
  sex: string | null;
  pensionScheme: boolean | null;
  country: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  zipCode: string | null;
  iban: string | null;
  swift: string | null;
  director: string | null;
  directorId: string | null;
  email: string | null;
  phone: string | null;
  orisId: string | null;
  counteragent: string | null;
  countryUuid: string | null;
  entityTypeUuid: string | null;
  internalNumber: string | null;
  isActive: boolean;
  isEmploye: boolean | null;
  wasEmploye: boolean | null;
};

type ColumnKey = keyof Counteragent;

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
  { key: 'ts', label: 'Timestamp', width: 140, visible: false, sortable: true, filterable: true, responsive: 'lg' },
  { key: 'counteragentUuid', label: 'UUID', width: 200, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'name', label: 'Name', width: 200, visible: true, sortable: true, filterable: true },
  { key: 'identificationNumber', label: 'ID Number', width: 150, visible: true, sortable: true, filterable: true },
  { key: 'birthOrIncorporationDate', label: 'Birth/Inc Date', width: 140, visible: true, sortable: true, filterable: true },
  { key: 'entityType', label: 'Entity Type', width: 130, visible: true, sortable: true, filterable: true },
  { key: 'sex', label: 'Sex', width: 80, visible: false, sortable: true, filterable: true },
  { key: 'pensionScheme', label: 'Pension', width: 100, visible: false, sortable: true, filterable: true },
  { key: 'country', label: 'Country', width: 100, visible: true, sortable: true, filterable: true },
  { key: 'addressLine1', label: 'Address 1', width: 180, visible: true, sortable: true, filterable: true },
  { key: 'addressLine2', label: 'Address 2', width: 180, visible: false, sortable: true, filterable: true },
  { key: 'zipCode', label: 'Zip', width: 90, visible: false, sortable: true, filterable: true },
  { key: 'iban', label: 'IBAN', width: 150, visible: false, sortable: true, filterable: true },
  { key: 'swift', label: 'SWIFT', width: 120, visible: false, sortable: true, filterable: true },
  { key: 'director', label: 'Director', width: 150, visible: false, sortable: true, filterable: true },
  { key: 'directorId', label: 'Director ID', width: 120, visible: false, sortable: true, filterable: true },
  { key: 'email', label: 'Email', width: 180, visible: true, sortable: true, filterable: true },
  { key: 'phone', label: 'Phone', width: 130, visible: true, sortable: true, filterable: true },
  { key: 'orisId', label: 'ORIS ID', width: 120, visible: false, sortable: true, filterable: true },
  { key: 'counteragent', label: 'Counteragent', width: 150, visible: false, sortable: true, filterable: true },
  { key: 'countryUuid', label: 'Country UUID', width: 200, visible: false, sortable: true, filterable: true },
  { key: 'entityTypeUuid', label: 'Entity Type UUID', width: 200, visible: false, sortable: true, filterable: true },
  { key: 'internalNumber', label: 'Internal #', width: 120, visible: true, sortable: true, filterable: true },
  { key: 'isActive', label: 'Status', width: 100, visible: true, sortable: true, filterable: true },
  { key: 'isEmploye', label: 'Is Employee', width: 120, visible: true, sortable: true, filterable: true },
  { key: 'wasEmploye', label: 'Was Employee', width: 130, visible: false, sortable: true, filterable: true }
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

// Helper function to map API response to Counteragent with proper defaults
const mapCounteragentData = (row: any): Counteragent => ({
  id: row.id || row.ID,
  createdAt: row.created_at || row.createdAt || '',
  updatedAt: row.updated_at || row.updatedAt || '',
  ts: row.ts || row.TS || '',
  counteragentUuid: row.counteragent_uuid || row.counteragentUuid || '',
  name: row.name || row.NAME || '',
  identificationNumber: row.identification_number || row.identificationNumber || null,
  birthOrIncorporationDate: row.birth_or_incorporation_date || row.birthOrIncorporationDate || null,
  entityType: row.entity_type || row.entityType || null,
  sex: row.sex || row.SEX || null,
  pensionScheme: row.pension_scheme || row.pensionScheme || null,
  country: row.country || row.COUNTRY || null,
  addressLine1: row.address_line_1 || row.addressLine1 || null,
  addressLine2: row.address_line_2 || row.addressLine2 || null,
  zipCode: row.zip_code || row.zipCode || null,
  iban: row.iban || row.IBAN || null,
  swift: row.swift || row.SWIFT || null,
  director: row.director || row.DIRECTOR || null,
  directorId: row.director_id || row.directorId || null,
  email: row.email || row.EMAIL || null,
  phone: row.phone || row.PHONE || null,
  orisId: row.oris_id || row.orisId || null,
  counteragent: row.counteragent || row.COUNTERAGENT || null,
  countryUuid: row.country_uuid || row.countryUuid || null,
  entityTypeUuid: row.entity_type_uuid || row.entityTypeUuid || null,
  internalNumber: row.internal_number || row.internalNumber || null,
  isActive: row.is_active ?? row.isActive ?? true,
  isEmploye: row.is_emploee ?? row.isEmploye ?? null,
  wasEmploye: row.was_emploee ?? row.wasEmploye ?? null,
});

export function CounteragentsTable({ data }: { data?: Counteragent[] }) {
  const [entityTypes, setEntityTypes] = useState<Counteragent[]>(data ?? []);
  // Dropdown data
  const [entityTypesList, setEntityTypesList] = useState<Array<{id: number, nameKa: string, entityTypeUuid: string}>>([]);
  const [countriesList, setCountriesList] = useState<Array<{id: number, country: string, countryUuid: string}>>([]);
  
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
  const [editingEntityType, setEditingEntityType] = useState<Counteragent | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  
  // Initialize columns from localStorage or use defaults
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    if (typeof window !== 'undefined') {
      const savedColumns = localStorage.getItem('counteragents-table-columns');
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
    name: '',
    identificationNumber: '',
    birthOrIncorporationDate: '',
    entityType: '',
    entityTypeUuid: '', // Track UUID for conditional logic
    sex: '',
    pensionScheme: '',
    country: '',
    countryUuid: '', // Track UUID for auto-fill
    addressLine1: '',
    addressLine2: '',
    zipCode: '',
    iban: '',
    swift: '',
    director: '',
    directorId: '',
    email: '',
    phone: '',
    orisId: '',
    isActive: true,
    isEmploye: false,
    wasEmploye: false,
  });
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const pageSizeOptions = [50, 100, 200, 500, 1000];

  // Respond to external data updates
  useEffect(() => {
    if (data) setEntityTypes(data);
  }, [data]);

  // Fetch entity types and countries for dropdowns
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        // Fetch entity types
        const entityTypesRes = await fetch('/api/entity-types');
        if (entityTypesRes.ok) {
          const entityTypesData = await entityTypesRes.json();
          setEntityTypesList(entityTypesData);
        }
        
        // Fetch countries
        const countriesRes = await fetch('/api/countries');
        if (countriesRes.ok) {
          const countriesData = await countriesRes.json();
          setCountriesList(countriesData);
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
  }, [entityTypes, columns]);

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
    localStorage.setItem('counteragents-table-columns', JSON.stringify(columns));
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

  // Form validation with conditional logic based on entity_type_uuid
  const validateForm = async () => {
    const errors: Record<string, string> = {};
    
    // UUID constants for conditional logic
    const EXEMPT_IDS = ['f5c3c745-eaa4-4e27-a73b-badc9ebb49c0', '7766e9c2-0094-4090-adf4-ef017062457f', '5747f8e6-a8a6-4a23-91cc-c427c3a22597'];
    const INDIVIDUAL_IDS = ['bf4d83f9-5064-4958-af6e-e4c21b2e4880', '470412f4-e2c0-4f9d-91f1-1c0630a02364', 'ba538574-e93f-4ce8-a780-667b61fc970a'];
    const NATURAL_PERSON_IDS = ['bf4d83f9-5064-4958-af6e-e4c21b2e4880', '5747f8e6-a8a6-4a23-91cc-c427c3a22597', 'ba538574-e93f-4ce8-a780-667b61fc970a'];
    const EMPLOYEE_ID = 'bf4d83f9-5064-4958-af6e-e4c21b2e4880';
    
    const entityTypeUuid = formData.entityTypeUuid;
    const isExempt = EXEMPT_IDS.includes(entityTypeUuid);
    
    // 1. Name - always mandatory
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }
    
    // 2. Entity Type - always mandatory
    if (!formData.entityType.trim()) {
      errors.entityType = 'Entity Type is required';
    }
    
    // 3. Country - always mandatory
    if (!formData.country.trim()) {
      errors.country = 'Country is required';
    }
    
    // 4. Identification Number - conditional mandatory and validation
    if (!isExempt && !formData.identificationNumber?.trim()) {
      errors.identificationNumber = 'ID Number is required';
    } else if (formData.identificationNumber?.trim()) {
      // Validation based on entity type
      if (INDIVIDUAL_IDS.includes(entityTypeUuid)) {
        // 11 digits for individuals
        if (!/^\d{11}$/.test(formData.identificationNumber)) {
          errors.identificationNumber = 'ID Number must be exactly 11 digits';
        }
      } else if (!isExempt) {
        // 9 digits for legal entities
        if (!/^\d{9}$/.test(formData.identificationNumber)) {
          errors.identificationNumber = 'ID Number must be exactly 9 digits';
        }
      }
      
      // Check for duplicates (except for exempt types)
      if (!isExempt && formData.identificationNumber?.trim()) {
        try {
          const response = await fetch('/api/counteragents');
          if (response.ok) {
            const allCounteragents = await response.json();
            const duplicate = allCounteragents.find((c: any) => 
              c.identification_number === formData.identificationNumber &&
              c.id !== editingEntityType?.id
            );
            if (duplicate) {
              errors.identificationNumber = 'This ID Number already exists';
            }
          }
        } catch (error) {
          console.error('Error checking duplicate ID:', error);
        }
      }
    }
    
    // 5. Birth or Incorporation Date - OPTIONAL (no longer mandatory)
    // Removed mandatory validation per user request
    
    // 6. Sex - conditional mandatory for natural persons
    if (NATURAL_PERSON_IDS.includes(entityTypeUuid)) {
      if (!formData.sex) {
        errors.sex = 'Sex is required for natural persons';
      } else if (!['Male', 'Female'].includes(formData.sex)) {
        errors.sex = 'Sex must be Male or Female';
      }
    }
    
    // 7. Pension Scheme - conditional mandatory for employees
    if (entityTypeUuid === EMPLOYEE_ID) {
      if (formData.pensionScheme === null) {
        errors.pensionScheme = 'Pension Scheme is required for employees';
      }
    }
    
    // 8. Email validation (optional but if provided should be valid)
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Auto-calculation helpers
  const calculateInternalNumber = (id: number): string => {
    // Format: "ICE" + REPT(0, 6-len(id)) + id
    // Example: id=5 -> "ICE000005", id=3285 -> "ICE003285"
    const idStr = id.toString();
    const zeros = '0'.repeat(Math.max(0, 6 - idStr.length));
    return `ICE${zeros}${idStr}`;
  };

  const calculateCounteragent = (name: string, idNumber: string, internalNumber: string, entityTypeName: string): string => {
    // Format: name & "(ს.კ. " & if(identification_number<>"", identification_number, internal_number) & " - " & entity_type_name_ka
    const displayId = idNumber || internalNumber;
    return `${name}(ს.კ. ${displayId} - ${entityTypeName})`;
  };

  // Handler for entity type dropdown change
  const handleEntityTypeChange = (entityTypeUuid: string) => {
    // Combobox now passes entityTypeUuid directly as the value
    const selectedEntityType = entityTypesList.find(et => et.entityTypeUuid === entityTypeUuid);
    
    // UUID constants for conditional logic
    const EXEMPT_IDS = ['f5c3c745-eaa4-4e27-a73b-badc9ebb49c0', '7766e9c2-0094-4090-adf4-ef017062457f', '5747f8e6-a8a6-4a23-91cc-c427c3a22597'];
    const NATURAL_PERSON_IDS = ['bf4d83f9-5064-4958-af6e-e4c21b2e4880', '5747f8e6-a8a6-4a23-91cc-c427c3a22597', 'ba538574-e93f-4ce8-a780-667b61fc970a'];
    const EMPLOYEE_ID = 'bf4d83f9-5064-4958-af6e-e4c21b2e4880';
    
    // Clear sex if not natural person
    const shouldClearSex = !NATURAL_PERSON_IDS.includes(entityTypeUuid);
    // Clear pension_scheme if not employee
    const shouldClearPension = entityTypeUuid !== EMPLOYEE_ID;
    
    setFormData({
      ...formData,
      entityType: selectedEntityType?.nameKa || '',
      entityTypeUuid: entityTypeUuid,
      sex: shouldClearSex ? '' : formData.sex,
      pensionScheme: shouldClearPension ? null : formData.pensionScheme,
    });
    
    // Clear related errors
    if (formErrors.entityType) {
      setFormErrors({...formErrors, entityType: ''});
    }
  };

  // Handler for country dropdown change
  const handleCountryChange = (countryUuid: string) => {
    // Combobox now passes countryUuid directly as the value
    const selectedCountry = countriesList.find(c => c.countryUuid === countryUuid);
    
    setFormData({
      ...formData,
      country: selectedCountry?.country || '',
      countryUuid: countryUuid,
    });
    
    // Clear error
    if (formErrors.country) {
      setFormErrors({...formErrors, country: ''});
    }
  };

  // Filter and search logic
  const filteredEntityTypes = useMemo(() => {
    let filtered = entityTypes;

    // Apply search across all visible text fields
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(counteragent =>
        counteragent.name.toLowerCase().includes(search) ||
        (counteragent.identificationNumber || '').toLowerCase().includes(search) ||
        (counteragent.entityType || '').toLowerCase().includes(search) ||
        (counteragent.country || '').toLowerCase().includes(search) ||
        (counteragent.email || '').toLowerCase().includes(search) ||
        (counteragent.phone || '').toLowerCase().includes(search) ||
        (counteragent.isActive ? 'active' : 'inactive').includes(search)
      );
    }

    // Apply column filters
    Object.entries(columnFilters).forEach(([column, values]) => {
      if (values.length > 0) {
        filtered = filtered.filter(counteragent => {
          const cellValue = String(counteragent[column as ColumnKey]);
          return values.includes(cellValue);
        });
      }
    });

    return filtered;
  }, [entityTypes, searchTerm, columnFilters]);

  // Sort logic
  const sortedEntityTypes = useMemo(() => {
    if (!sortField) return filteredEntityTypes;

    return [...filteredEntityTypes].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      
      // Handle nulls
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredEntityTypes, sortField, sortDirection]);

  // Pagination
  const totalRecords = sortedEntityTypes.length;
  const totalPages = Math.ceil(totalRecords / pageSize);
  
  const paginatedEntityTypes = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return sortedEntityTypes.slice(startIndex, endIndex);
  }, [sortedEntityTypes, currentPage, pageSize]);

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
    
    if (editingEntityType) {
      // Update existing via API
      try {
        const response = await fetch(`/api/counteragents?id=${editingEntityType.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            identification_number: formData.identificationNumber || null,
            birth_or_incorporation_date: formData.birthOrIncorporationDate || null,
            sex: formData.sex || null,
            pension_scheme: formData.pensionScheme === 'true' ? true : formData.pensionScheme === 'false' ? false : null,
            // Don't send country/entity_type - let trigger populate from UUIDs
            address_line_1: formData.addressLine1 || null,
            address_line_2: formData.addressLine2 || null,
            zip_code: formData.zipCode || null,
            iban: formData.iban || null,
            swift: formData.swift || null,
            director: formData.director || null,
            director_id: formData.directorId || null,
            email: formData.email || null,
            phone: formData.phone || null,
            oris_id: formData.orisId || null,
            country_uuid: formData.countryUuid ? formData.countryUuid : null,
            entity_type_uuid: formData.entityTypeUuid ? formData.entityTypeUuid : null,
            is_active: formData.isActive,
            is_emploee: formData.isEmploye || false,
            was_emploee: formData.wasEmploye || false
          })
        });
        
        if (!response.ok) {
          const error = await response.json();
          console.error('[Edit] API error:', error);
          
          // Handle specific error cases
          if (response.status === 409) {
            // Duplicate identification number
            setFormErrors({
              ...formErrors,
              identificationNumber: error.error || 'This identification number already exists'
            });
            return;
          }
          
          alert(`Failed to update: ${error.error || 'Unknown error'}`);
          return;
        }
        
        const updated = await response.json();
        
        // Transform API response (snake_case) to component format (camelCase)
        const transformedUpdate: Counteragent = {
          id: updated.id,
          createdAt: updated.created_at,
          updatedAt: updated.updated_at,
          ts: updated.ts,
          counteragentUuid: updated.counteragent_uuid,
          name: updated.name,
          identificationNumber: updated.identification_number,
          birthOrIncorporationDate: updated.birth_or_incorporation_date,
          entityType: updated.entity_type,
          sex: updated.sex,
          pensionScheme: updated.pension_scheme,
          country: updated.country,
          addressLine1: updated.address_line_1,
          addressLine2: updated.address_line_2,
          zipCode: updated.zip_code,
          iban: updated.iban,
          swift: updated.swift,
          director: updated.director,
          directorId: updated.director_id,
          email: updated.email,
          phone: updated.phone,
          orisId: updated.oris_id,
          counteragent: updated.counteragent,
          countryUuid: updated.country_uuid,
          entityTypeUuid: updated.entity_type_uuid,
          internalNumber: updated.internal_number,
          isActive: updated.is_active,
          isEmploye: updated.is_emploee || false,
          wasEmploye: updated.was_emploee || false,
        };
        
        // Update local state with transformed response
        setEntityTypes(entityTypes.map(counteragent =>
          counteragent.id === editingEntityType.id ? transformedUpdate : counteragent
        ));
        
        setIsEditDialogOpen(false);
        setEditingEntityType(null);
      } catch (error) {
        console.error('[Edit] Network error:', error);
        alert('Failed to update counteragent. Please try again.');
        return;
      }
    } else {
      // Add new via API
      try {
        const response = await fetch('/api/counteragents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            identification_number: formData.identificationNumber || null,
            birth_or_incorporation_date: formData.birthOrIncorporationDate || null,
            sex: formData.sex || null,
            pension_scheme: formData.pensionScheme === 'true' ? true : formData.pensionScheme === 'false' ? false : null,
            // Don't send country/entity_type - let trigger populate from UUIDs
            address_line_1: formData.addressLine1 || null,
            address_line_2: formData.addressLine2 || null,
            zip_code: formData.zipCode || null,
            iban: formData.iban || null,
            swift: formData.swift || null,
            director: formData.director || null,
            director_id: formData.directorId || null,
            email: formData.email || null,
            phone: formData.phone || null,
            oris_id: formData.orisId || null,
            country_uuid: formData.countryUuid ? formData.countryUuid : null,
            entity_type_uuid: formData.entityTypeUuid ? formData.entityTypeUuid : null,
            is_active: formData.isActive,
            is_emploee: formData.isEmploye || false,
            was_emploee: formData.wasEmploye || false
          })
        });
        
        if (!response.ok) {
          const error = await response.json();
          console.error('[Add] API error:', error);
          
          // Handle specific error cases
          if (response.status === 409) {
            // Duplicate identification number
            setFormErrors({
              ...formErrors,
              identificationNumber: error.error || 'This identification number already exists'
            });
            return;
          }
          
          alert(`Failed to add: ${error.error || 'Unknown error'}`);
          return;
        }
        
        const created = await response.json();
        
        // Fetch fresh data from API to get all fields properly formatted
        const refreshResponse = await fetch('/api/counteragents');
        const refreshedData = await refreshResponse.json();
        const mappedData = refreshedData.map(mapCounteragentData);
        setEntityTypes(mappedData);
        
        setIsAddDialogOpen(false);
      } catch (error) {
        console.error('[Add] Network error:', error);
        alert('Failed to add counteragent. Please try again.');
        return;
      }
    }
    
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      identificationNumber: '',
      birthOrIncorporationDate: '',
      entityType: '',
      entityTypeUuid: '',
      sex: '',
      pensionScheme: null,
      country: '',
      countryUuid: '',
      addressLine1: '',
      addressLine2: '',
      zipCode: '',
      iban: '',
      swift: '',
      director: '',
      directorId: '',
      email: '',
      phone: '',
      orisId: '',
      isActive: true,
      isEmploye: false,
      wasEmploye: false,
    });
    setFormErrors({});
  };

  const startEdit = (counteragent: Counteragent) => {
    setEditingEntityType(counteragent);
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
      name: counteragent.name,
      identificationNumber: counteragent.identificationNumber || '',
      birthOrIncorporationDate: formatDateForInput(counteragent.birthOrIncorporationDate),
      entityType: counteragent.entityType || '',
      entityTypeUuid: counteragent.entityTypeUuid || '',
      sex: counteragent.sex || '',
      pensionScheme: counteragent.pensionScheme === true ? 'true' : counteragent.pensionScheme === false ? 'false' : '',
      country: counteragent.country || '',
      countryUuid: counteragent.countryUuid || '',
      addressLine1: counteragent.addressLine1 || '',
      addressLine2: counteragent.addressLine2 || '',
      zipCode: counteragent.zipCode || '',
      iban: counteragent.iban || '',
      swift: counteragent.swift || '',
      director: counteragent.director || '',
      directorId: counteragent.directorId || '',
      email: counteragent.email || '',
      phone: counteragent.phone || '',
      orisId: counteragent.orisId || '',
      isActive: counteragent.isActive ?? true,
      isEmploye: counteragent.isEmploye ?? false,
      wasEmploye: counteragent.wasEmploye ?? false,
    });
    setFormErrors({});
    setIsEditDialogOpen(true);
  };

  const cancelEdit = () => {
    setEditingEntityType(null);
    setIsEditDialogOpen(false);
    resetForm();
  };

  const deleteEntityType = (id: number) => {
    setEntityTypes(entityTypes.filter(c => c.id !== id));
  };

  const viewAuditLog = async (counteragent: Counteragent) => {
    setEditingEntityType(counteragent);
    setIsAuditDialogOpen(true);
    setLoadingAudit(true);
    
    try {
      const response = await fetch(`/api/audit?table=counteragents&recordId=${counteragent.id}`);
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
    return [...new Set(entityTypes.map(counteragent => String(counteragent[column])))].sort();
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
          <h1 className="text-2xl font-medium text-foreground">Counteragents</h1>
        </div>
        <div className="flex items-center gap-2">
          <ColumnSettings />
          
          {/* NEW FORM IMPLEMENTATION - Toggle with USE_NEW_FORM flag */}
          {USE_NEW_FORM ? (
            <>
              {/* New Form Dialog */}
              <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Counteragent
              </Button>
              
              <CounteragentFormDialog
                isOpen={isAddDialogOpen}
                onClose={() => setIsAddDialogOpen(false)}
                onSave={async (payload) => {
                  const response = await fetch('/api/counteragents', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                  });
                  
                  if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to create counteragent');
                  }
                  
                  const refreshResponse = await fetch('/api/counteragents');
                  const refreshedData = await refreshResponse.json();
                  const mappedData = refreshedData.map(mapCounteragentData);
                  setEntityTypes(mappedData);
                }}
                editData={null}
                entityTypes={entityTypesList.map(et => ({ 
                  entityTypeUuid: et.entityTypeUuid, 
                  entityType: et.nameKa 
                }))}
                countries={countriesList.map(c => ({ 
                  countryUuid: c.countryUuid, 
                  country: c.country 
                }))}
              />
              
              <CounteragentFormDialog
                isOpen={isEditDialogOpen}
                onClose={() => { setIsEditDialogOpen(false); setEditingEntityType(null); }}
                onSave={async (payload) => {
                  const response = await fetch(`/api/counteragents?id=${editingEntityType?.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                  });
                  
                  if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to update counteragent');
                  }
                  
                  const updated = await response.json();
                  const transformedUpdate: Counteragent = {
                    id: updated.id,
                    createdAt: updated.created_at,
                    updatedAt: updated.updated_at,
                    ts: updated.ts,
                    counteragentUuid: updated.counteragent_uuid,
                    name: updated.name,
                    identificationNumber: updated.identification_number,
                    birthOrIncorporationDate: updated.birth_or_incorporation_date,
                    entityType: updated.entity_type,
                    sex: updated.sex,
                    pensionScheme: updated.pension_scheme,
                    country: updated.country,
                    addressLine1: updated.address_line_1,
                    addressLine2: updated.address_line_2,
                    zipCode: updated.zip_code,
                    iban: updated.iban,
                    swift: updated.swift,
                    director: updated.director,
                    directorId: updated.director_id,
                    email: updated.email,
                    phone: updated.phone,
                    orisId: updated.oris_id,
                    counteragent: updated.counteragent,
                    countryUuid: updated.country_uuid,
                    entityTypeUuid: updated.entity_type_uuid,
                    internalNumber: updated.internal_number,
                    isActive: updated.is_active,
                    isEmploye: updated.is_emploee || false,
                    wasEmploye: updated.was_emploee || false,
                  };
                  
                  setEntityTypes(entityTypes.map(counteragent =>
                    counteragent.id === editingEntityType?.id ? transformedUpdate : counteragent
                  ));
                }}
                editData={editingEntityType}
                entityTypes={entityTypesList.map(et => ({ 
                  entityTypeUuid: et.entityTypeUuid, 
                  entityType: et.nameKa 
                }))}
                countries={countriesList.map(c => ({ 
                  countryUuid: c.countryUuid, 
                  country: c.country 
                }))}
              />
            </>
          ) : (
            <>
          {/* OLD FORM IMPLEMENTATION - Will be used when USE_NEW_FORM = false */}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Add Counteragent
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Counteragent</DialogTitle>
                <DialogDescription>
                  Enter the details for the new counteragent. Fields marked with * are required.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {/* Name - always mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-name" className="text-right">Name *</Label>
                  <div className="col-span-3">
                    <Input
                      id="add-name"
                      value={formData.name}
                      onChange={(e) => {
                        setFormData({...formData, name: e.target.value});
                        if (formErrors.name) setFormErrors({...formErrors, name: ''});
                      }}
                      className={formErrors.name ? 'border-red-500' : ''}
                    />
                    {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
                  </div>
                </div>

                {/* Entity Type - dropdown, always mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-entityType" className="text-right">Entity Type *</Label>
                  <div className="col-span-3">
                    <Select value={formData.entityTypeUuid} onValueChange={handleEntityTypeChange}>
                      <SelectTrigger className={formErrors.entityType ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select entity type" />
                      </SelectTrigger>
                      <SelectContent>
                        {entityTypesList.map(et => (
                          <SelectItem key={et.id} value={et.entityTypeUuid}>{et.nameKa}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formErrors.entityType && <p className="text-xs text-red-500 mt-1">{formErrors.entityType}</p>}
                  </div>
                </div>

                {/* ID Number - conditional mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-idNumber" className="text-right">
                    ID Number {!['f5c3c745-eaa4-4e27-a73b-badc9ebb49c0', '7766e9c2-0094-4090-adf4-ef017062457f'].includes(formData.entityTypeUuid) ? '*' : ''}
                  </Label>
                  <div className="col-span-3">
                    <Input
                      id="add-idNumber"
                      value={formData.identificationNumber}
                      onChange={(e) => {
                        setFormData({...formData, identificationNumber: e.target.value});
                        if (formErrors.identificationNumber) setFormErrors({...formErrors, identificationNumber: ''});
                      }}
                      className={formErrors.identificationNumber ? 'border-red-500' : ''}
                    />
                    {formErrors.identificationNumber && <p className="text-xs text-red-500 mt-1">{formErrors.identificationNumber}</p>}
                  </div>
                </div>

                {/* Birth or Incorporation Date - conditional mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-birthDate" className="text-right">
                    Birth/Inc Date
                  </Label>
                  <div className="col-span-3">
                    <Input
                      id="add-birthDate"
                      type="date"
                      value={formData.birthOrIncorporationDate}
                      onChange={(e) => {
                        setFormData({...formData, birthOrIncorporationDate: e.target.value});
                        if (formErrors.birthOrIncorporationDate) setFormErrors({...formErrors, birthOrIncorporationDate: ''});
                      }}
                      className={formErrors.birthOrIncorporationDate ? 'border-red-500' : ''}
                    />
                    {formErrors.birthOrIncorporationDate && <p className="text-xs text-red-500 mt-1">{formErrors.birthOrIncorporationDate}</p>}
                  </div>
                </div>

                {/* Sex - conditional mandatory for natural persons */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-sex" className="text-right">
                    Sex {['bf4d83f9-5064-4958-af6e-e4c21b2e4880', '5747f8e6-a8a6-4a23-91cc-c427c3a22597', 'ba538574-e93f-4ce8-a780-667b61fc970a'].includes(formData.entityTypeUuid) ? '*' : ''}
                  </Label>
                  <div className="col-span-3">
                    <Select 
                      value={formData.sex || ''} 
                      onValueChange={(value) => {
                        setFormData({...formData, sex: value});
                        if (formErrors.sex) setFormErrors({...formErrors, sex: ''});
                      }}
                    >
                      <SelectTrigger className={formErrors.sex ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select sex" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                    {formErrors.sex && <p className="text-xs text-red-500 mt-1">{formErrors.sex}</p>}
                  </div>
                </div>

                {/* Pension Scheme - conditional mandatory for employees */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-pension" className="text-right">
                    Pension Scheme {formData.entityTypeUuid === 'bf4d83f9-5064-4958-af6e-e4c21b2e4880' ? '*' : ''}
                  </Label>
                  <div className="col-span-3">
                    <Select 
                      value={formData.pensionScheme || ''} 
                      onValueChange={(value) => {
                        setFormData({...formData, pensionScheme: value});
                        if (formErrors.pensionScheme) setFormErrors({...formErrors, pensionScheme: ''});
                      }}
                    >
                      <SelectTrigger className={formErrors.pensionScheme ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select pension scheme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">True</SelectItem>
                        <SelectItem value="false">False</SelectItem>
                      </SelectContent>
                    </Select>
                    {formErrors.pensionScheme && <p className="text-xs text-red-500 mt-1">{formErrors.pensionScheme}</p>}
                  </div>
                </div>

                {/* Country - dropdown, always mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-country" className="text-right">Country *</Label>
                  <div className="col-span-3">
                    <Combobox
                      options={countriesList.map(c => ({ value: c.countryUuid, label: c.country, keywords: c.country }))}
                      value={formData.countryUuid}
                      onValueChange={handleCountryChange}
                      placeholder="Select country"
                      searchPlaceholder="Search countries..."
                      emptyText="No country found."
                      triggerClassName={formErrors.country ? 'border-red-500' : ''}
                    />
                    {formErrors.country && <p className="text-xs text-red-500 mt-1">{formErrors.country}</p>}
                  </div>
                </div>

                {/* Address Line 1 */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-addr1" className="text-right">Address Line 1</Label>
                  <div className="col-span-3">
                    <Input
                      id="add-addr1"
                      value={formData.addressLine1}
                      onChange={(e) => setFormData({...formData, addressLine1: e.target.value})}
                    />
                  </div>
                </div>

                {/* Address Line 2 */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-addr2" className="text-right">Address Line 2</Label>
                  <div className="col-span-3">
                    <Input
                      id="add-addr2"
                      value={formData.addressLine2}
                      onChange={(e) => setFormData({...formData, addressLine2: e.target.value})}
                    />
                  </div>
                </div>

                {/* ZIP Code */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-zip" className="text-right">ZIP Code</Label>
                  <div className="col-span-3">
                    <Input
                      id="add-zip"
                      value={formData.zipCode}
                      onChange={(e) => setFormData({...formData, zipCode: e.target.value})}
                    />
                  </div>
                </div>

                {/* IBAN */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-iban" className="text-right">IBAN</Label>
                  <div className="col-span-3">
                    <Input
                      id="add-iban"
                      value={formData.iban}
                      onChange={(e) => setFormData({...formData, iban: e.target.value})}
                    />
                  </div>
                </div>

                {/* SWIFT */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-swift" className="text-right">SWIFT</Label>
                  <div className="col-span-3">
                    <Input
                      id="add-swift"
                      value={formData.swift}
                      onChange={(e) => setFormData({...formData, swift: e.target.value})}
                    />
                  </div>
                </div>

                {/* Director */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-director" className="text-right">Director</Label>
                  <div className="col-span-3">
                    <Input
                      id="add-director"
                      value={formData.director}
                      onChange={(e) => setFormData({...formData, director: e.target.value})}
                    />
                  </div>
                </div>

                {/* Director ID */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-directorId" className="text-right">Director ID</Label>
                  <div className="col-span-3">
                    <Input
                      id="add-directorId"
                      value={formData.directorId}
                      onChange={(e) => setFormData({...formData, directorId: e.target.value})}
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-email" className="text-right">Email</Label>
                  <div className="col-span-3">
                    <Input
                      id="add-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({...formData, email: e.target.value});
                        if (formErrors.email) setFormErrors({...formErrors, email: ''});
                      }}
                      className={formErrors.email ? 'border-red-500' : ''}
                    />
                    {formErrors.email && <p className="text-xs text-red-500 mt-1">{formErrors.email}</p>}
                  </div>
                </div>

                {/* Phone */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-phone" className="text-right">Phone</Label>
                  <div className="col-span-3">
                    <Input
                      id="add-phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                </div>

                {/* ORIS ID */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-oris" className="text-right">ORIS ID</Label>
                  <div className="col-span-3">
                    <Input
                      id="add-oris"
                      value={formData.orisId}
                      onChange={(e) => setFormData({...formData, orisId: e.target.value})}
                    />
                  </div>
                </div>

                {/* Status */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-isActive" className="text-right">Status</Label>
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

                {/* Is Employee */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-isEmploye" className="text-right">Is Employee</Label>
                  <div className="col-span-3">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="add-isEmploye"
                        checked={formData.isEmploye || false}
                        onCheckedChange={(checked) => setFormData({...formData, isEmploye: checked})}
                      />
                      <span className="text-sm text-muted-foreground">
                        {formData.isEmploye ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Was Employee */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="add-wasEmploye" className="text-right">Was Employee</Label>
                  <div className="col-span-3">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="add-wasEmploye"
                        checked={formData.wasEmploye || false}
                        onCheckedChange={(checked) => setFormData({...formData, wasEmploye: checked})}
                      />
                      <span className="text-sm text-muted-foreground">
                        {formData.wasEmploye ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave}>Save Counteragent</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Counteragent</DialogTitle>
                <DialogDescription>
                  Update the details for {editingEntityType?.name}. Fields marked with * are required.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {/* Name - always mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-name" className="text-right">Name *</Label>
                  <div className="col-span-3">
                    <Input
                      id="edit-name"
                      value={formData.name}
                      onChange={(e) => {
                        setFormData({...formData, name: e.target.value});
                        if (formErrors.name) setFormErrors({...formErrors, name: ''});
                      }}
                      className={formErrors.name ? 'border-red-500' : ''}
                    />
                    {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
                  </div>
                </div>

                {/* Entity Type - dropdown, always mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-entityType" className="text-right">Entity Type *</Label>
                  <div className="col-span-3">
                    <Select value={formData.entityTypeUuid} onValueChange={handleEntityTypeChange}>
                      <SelectTrigger className={formErrors.entityType ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select entity type" />
                      </SelectTrigger>
                      <SelectContent>
                        {entityTypesList.map(et => (
                          <SelectItem key={et.id} value={et.entityTypeUuid}>{et.nameKa}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formErrors.entityType && <p className="text-xs text-red-500 mt-1">{formErrors.entityType}</p>}
                  </div>
                </div>

                {/* ID Number - conditional mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-idNumber" className="text-right">
                    ID Number {!['f5c3c745-eaa4-4e27-a73b-badc9ebb49c0', '7766e9c2-0094-4090-adf4-ef017062457f'].includes(formData.entityTypeUuid) ? '*' : ''}
                  </Label>
                  <div className="col-span-3">
                    <Input
                      id="edit-idNumber"
                      value={formData.identificationNumber}
                      onChange={(e) => {
                        setFormData({...formData, identificationNumber: e.target.value});
                        if (formErrors.identificationNumber) setFormErrors({...formErrors, identificationNumber: ''});
                      }}
                      className={formErrors.identificationNumber ? 'border-red-500' : ''}
                    />
                    {formErrors.identificationNumber && <p className="text-xs text-red-500 mt-1">{formErrors.identificationNumber}</p>}
                  </div>
                </div>

                {/* Birth or Incorporation Date - conditional mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-birthDate" className="text-right">
                    Birth/Inc Date
                  </Label>
                  <div className="col-span-3">
                    <Input
                      id="edit-birthDate"
                      type="date"
                      value={formData.birthOrIncorporationDate}
                      onChange={(e) => {
                        setFormData({...formData, birthOrIncorporationDate: e.target.value});
                        if (formErrors.birthOrIncorporationDate) setFormErrors({...formErrors, birthOrIncorporationDate: ''});
                      }}
                      className={formErrors.birthOrIncorporationDate ? 'border-red-500' : ''}
                    />
                    {formErrors.birthOrIncorporationDate && <p className="text-xs text-red-500 mt-1">{formErrors.birthOrIncorporationDate}</p>}
                  </div>
                </div>

                {/* Sex - conditional mandatory for natural persons */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-sex" className="text-right">
                    Sex {['bf4d83f9-5064-4958-af6e-e4c21b2e4880', '5747f8e6-a8a6-4a23-91cc-c427c3a22597', 'ba538574-e93f-4ce8-a780-667b61fc970a'].includes(formData.entityTypeUuid) ? '*' : ''}
                  </Label>
                  <div className="col-span-3">
                    <Select 
                      value={formData.sex || ''} 
                      onValueChange={(value) => {
                        setFormData({...formData, sex: value});
                        if (formErrors.sex) setFormErrors({...formErrors, sex: ''});
                      }}
                    >
                      <SelectTrigger className={formErrors.sex ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select sex" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                    {formErrors.sex && <p className="text-xs text-red-500 mt-1">{formErrors.sex}</p>}
                  </div>
                </div>

                {/* Pension Scheme - conditional mandatory for employees */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-pension" className="text-right">
                    Pension Scheme {formData.entityTypeUuid === 'bf4d83f9-5064-4958-af6e-e4c21b2e4880' ? '*' : ''}
                  </Label>
                  <div className="col-span-3">
                    <Select 
                      value={formData.pensionScheme || ''} 
                      onValueChange={(value) => {
                        setFormData({...formData, pensionScheme: value});
                        if (formErrors.pensionScheme) setFormErrors({...formErrors, pensionScheme: ''});
                      }}
                    >
                      <SelectTrigger className={formErrors.pensionScheme ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select pension scheme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">True</SelectItem>
                        <SelectItem value="false">False</SelectItem>
                      </SelectContent>
                    </Select>
                    {formErrors.pensionScheme && <p className="text-xs text-red-500 mt-1">{formErrors.pensionScheme}</p>}
                  </div>
                </div>

                {/* Country - dropdown, always mandatory */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-country" className="text-right">Country *</Label>
                  <div className="col-span-3">
                    <Combobox
                      options={countriesList.map(c => ({ value: c.countryUuid, label: c.country, keywords: c.country }))}
                      value={formData.countryUuid}
                      onValueChange={handleCountryChange}
                      placeholder="Select country"
                      searchPlaceholder="Search countries..."
                      emptyText="No country found."
                      triggerClassName={formErrors.country ? 'border-red-500' : ''}
                    />
                    {formErrors.country && <p className="text-xs text-red-500 mt-1">{formErrors.country}</p>}
                  </div>
                </div>

                {/* Address Line 1 */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-addr1" className="text-right">Address Line 1</Label>
                  <div className="col-span-3">
                    <Input
                      id="edit-addr1"
                      value={formData.addressLine1}
                      onChange={(e) => setFormData({...formData, addressLine1: e.target.value})}
                    />
                  </div>
                </div>

                {/* Address Line 2 */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-addr2" className="text-right">Address Line 2</Label>
                  <div className="col-span-3">
                    <Input
                      id="edit-addr2"
                      value={formData.addressLine2}
                      onChange={(e) => setFormData({...formData, addressLine2: e.target.value})}
                    />
                  </div>
                </div>

                {/* ZIP Code */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-zip" className="text-right">ZIP Code</Label>
                  <div className="col-span-3">
                    <Input
                      id="edit-zip"
                      value={formData.zipCode}
                      onChange={(e) => setFormData({...formData, zipCode: e.target.value})}
                    />
                  </div>
                </div>

                {/* IBAN */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-iban" className="text-right">IBAN</Label>
                  <div className="col-span-3">
                    <Input
                      id="edit-iban"
                      value={formData.iban}
                      onChange={(e) => setFormData({...formData, iban: e.target.value})}
                    />
                  </div>
                </div>

                {/* SWIFT */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-swift" className="text-right">SWIFT</Label>
                  <div className="col-span-3">
                    <Input
                      id="edit-swift"
                      value={formData.swift}
                      onChange={(e) => setFormData({...formData, swift: e.target.value})}
                    />
                  </div>
                </div>

                {/* Director */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-director" className="text-right">Director</Label>
                  <div className="col-span-3">
                    <Input
                      id="edit-director"
                      value={formData.director}
                      onChange={(e) => setFormData({...formData, director: e.target.value})}
                    />
                  </div>
                </div>

                {/* Director ID */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-directorId" className="text-right">Director ID</Label>
                  <div className="col-span-3">
                    <Input
                      id="edit-directorId"
                      value={formData.directorId}
                      onChange={(e) => setFormData({...formData, directorId: e.target.value})}
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-email" className="text-right">Email</Label>
                  <div className="col-span-3">
                    <Input
                      id="edit-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({...formData, email: e.target.value});
                        if (formErrors.email) setFormErrors({...formErrors, email: ''});
                      }}
                      className={formErrors.email ? 'border-red-500' : ''}
                    />
                    {formErrors.email && <p className="text-xs text-red-500 mt-1">{formErrors.email}</p>}
                  </div>
                </div>

                {/* Phone */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-phone" className="text-right">Phone</Label>
                  <div className="col-span-3">
                    <Input
                      id="edit-phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                </div>

                {/* ORIS ID */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-oris" className="text-right">ORIS ID</Label>
                  <div className="col-span-3">
                    <Input
                      id="edit-oris"
                      value={formData.orisId}
                      onChange={(e) => setFormData({...formData, orisId: e.target.value})}
                    />
                  </div>
                </div>

                {/* Status */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-isActive" className="text-right">Status</Label>
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

                {/* Is Employee */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-isEmploye" className="text-right">Is Employee</Label>
                  <div className="col-span-3">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="edit-isEmploye"
                        checked={formData.isEmploye || false}
                        onCheckedChange={(checked) => setFormData({...formData, isEmploye: checked})}
                      />
                      <span className="text-sm text-muted-foreground">
                        {formData.isEmploye ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Was Employee */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-wasEmploye" className="text-right">Was Employee</Label>
                  <div className="col-span-3">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="edit-wasEmploye"
                        checked={formData.wasEmploye || false}
                        onCheckedChange={(checked) => setFormData({...formData, wasEmploye: checked})}
                      />
                      <span className="text-sm text-muted-foreground">
                        {formData.wasEmploye ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={cancelEdit}>Cancel</Button>
                <Button onClick={handleSave}>Update Counteragent</Button>
              </div>
            </DialogContent>
          </Dialog>
          </>
          )}
          {/* END OF OLD/NEW FORM TOGGLE */}

          {/* Audit History Dialog */}
          <Dialog open={isAuditDialogOpen} onOpenChange={setIsAuditDialogOpen}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Audit History</DialogTitle>
                <DialogDescription>
                  Change history for {editingEntityType?.name} (ID: {editingEntityType?.id})
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
                                {(field === 'country_uuid' || field === 'country_uuid_label') ? (
                                  <>
                                    <span className="text-red-600 line-through">
                                      {(() => {
                                        if (field === 'country_uuid') {
                                          const label = countriesList.find(c => c.countryUuid === change.from)?.country;
                                          return label || (change.from === null || change.from === undefined ? 'N/A' : String(change.from));
                                        } else {
                                          // country_uuid_label
                                          const label = countriesList.find(c => c.country === change.from)?.country;
                                          return label || (change.from === null || change.from === undefined ? 'N/A' : String(change.from));
                                        }
                                      })()}
                                    </span>
                                    {' → '}
                                    <span className="text-green-600">
                                      {(() => {
                                        if (field === 'country_uuid') {
                                          const label = countriesList.find(c => c.countryUuid === change.to)?.country;
                                          return label || (change.to === null || change.to === undefined ? 'N/A' : String(change.to));
                                        } else {
                                          // country_uuid_label
                                          const label = countriesList.find(c => c.country === change.to)?.country;
                                          return label || (change.to === null || change.to === undefined ? 'N/A' : String(change.to));
                                        }
                                      })()}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-red-600 line-through">{String(change.from || 'null')}</span>
                                    {' → '}
                                    <span className="text-green-600">{String(change.to || 'null')}</span>
                                  </>
                                )}
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
              {paginatedEntityTypes.map((counteragent) => (
                <TableRow key={counteragent.id} className="hover:bg-muted/50 transition-colors">
                  {visibleColumns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={`${getResponsiveClass(column.responsive)} relative bg-white`}
                      style={{ width: column.width }}
                    >
                      <div className="py-1 overflow-hidden text-ellipsis whitespace-nowrap">
                        {column.key === 'isActive' ? (
                          <Badge variant={counteragent.isActive ? "success" : "error"} className="text-xs">
                            {counteragent.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        ) : column.key === 'id' ? (
                          <span className="text-sm">{counteragent.id}</span>
                        ) : column.key === 'createdAt' ? (
                          <span className="text-sm">{counteragent.createdAt}</span>
                        ) : column.key === 'updatedAt' ? (
                          <span className="text-sm">{counteragent.updatedAt}</span>
                        ) : column.key === 'ts' ? (
                          <span className="text-sm">{counteragent.ts}</span>
                        ) : column.key === 'counteragentUuid' ? (
                          <span className="text-sm">{counteragent.counteragentUuid}</span>
                        ) : column.key === 'name' ? (
                          <span className="text-sm">{counteragent.name}</span>
                        ) : column.key === 'identificationNumber' ? (
                          <span className="text-sm">{counteragent.identificationNumber || '-'}</span>
                        ) : column.key === 'birthOrIncorporationDate' ? (
                          <span className="text-sm">{counteragent.birthOrIncorporationDate || '-'}</span>
                        ) : column.key === 'entityType' ? (
                          <span className="text-sm">{counteragent.entityType || '-'}</span>
                        ) : column.key === 'sex' ? (
                          <span className="text-sm">{counteragent.sex || '-'}</span>
                        ) : column.key === 'pensionScheme' ? (
                          <span className="text-sm">{counteragent.pensionScheme || '-'}</span>
                        ) : column.key === 'country' ? (
                          <span className="text-sm">{counteragent.country || '-'}</span>
                        ) : column.key === 'addressLine1' ? (
                          <span className="text-sm">{counteragent.addressLine1 || '-'}</span>
                        ) : column.key === 'addressLine2' ? (
                          <span className="text-sm">{counteragent.addressLine2 || '-'}</span>
                        ) : column.key === 'zipCode' ? (
                          <span className="text-sm">{counteragent.zipCode || '-'}</span>
                        ) : column.key === 'iban' ? (
                          <span className="text-sm">{counteragent.iban || '-'}</span>
                        ) : column.key === 'swift' ? (
                          <span className="text-sm">{counteragent.swift || '-'}</span>
                        ) : column.key === 'director' ? (
                          <span className="text-sm">{counteragent.director || '-'}</span>
                        ) : column.key === 'directorId' ? (
                          <span className="text-sm">{counteragent.directorId || '-'}</span>
                        ) : column.key === 'email' ? (
                          <span className="text-sm">{counteragent.email || '-'}</span>
                        ) : column.key === 'phone' ? (
                          <span className="text-sm">{counteragent.phone || '-'}</span>
                        ) : column.key === 'orisId' ? (
                          <span className="text-sm">{counteragent.orisId || '-'}</span>
                        ) : column.key === 'counteragent' ? (
                          <span className="text-sm">{counteragent.counteragent || '-'}</span>
                        ) : column.key === 'countryUuid' ? (
                          <span className="text-sm">{counteragent.countryUuid || '-'}</span>
                        ) : column.key === 'entityTypeUuid' ? (
                          <span className="text-sm">{counteragent.entityTypeUuid || '-'}</span>
                        ) : column.key === 'internalNumber' ? (
                          <span className="text-sm">{counteragent.internalNumber || '-'}</span>
                        ) : column.key === 'isEmploye' ? (
                          <Badge variant={counteragent.isEmploye ? "default" : "secondary"} className="text-xs">
                            {counteragent.isEmploye ? 'Yes' : 'No'}
                          </Badge>
                        ) : column.key === 'wasEmploye' ? (
                          <Badge variant={counteragent.wasEmploye ? "default" : "secondary"} className="text-xs">
                            {counteragent.wasEmploye ? 'Yes' : 'No'}
                          </Badge>
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
                        onClick={() => startEdit(counteragent)}
                        className="h-7 w-7 p-0"
                        title="Edit counteragent"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => viewAuditLog(counteragent)}
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
      {sortedEntityTypes.length === 0 && (
        <div className="text-center py-12">
          <div className="text-muted-foreground">
            {searchTerm || Object.values(columnFilters).some(f => f.length > 0) ? (
              <>
                <p className="text-lg font-medium mb-2">No entityTypes found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
              </>
            ) : (
              <>
                <p className="text-lg font-medium mb-2">No entityTypes added yet</p>
                <p className="text-sm">Get started by adding your first counteragent</p>
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
export default CounteragentsTable;
