'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
  EyeOff
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
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';

// Brand type for brand selection dropdown
export type Brand = {
  id: number;
  uuid: string;
  name: string;
};

export type Job = {
  id: number;
  jobUuid: string;
  projectUuid: string;
  jobName: string;
  floors: number;
  weight: number;
  isFf: boolean;
  brandUuid: string | null;
  projectIndex: string;
  projectName: string;
  brandName: string;
  jobIndex: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ColumnKey = keyof Job;

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
  { key: 'jobIndex', label: 'Job Index', width: 400, visible: true, sortable: true, filterable: true },
  { key: 'projectIndex', label: 'Project', width: 150, visible: true, sortable: true, filterable: true },
  { key: 'jobName', label: 'Job Name', width: 200, visible: true, sortable: true, filterable: true },
  { key: 'brandName', label: 'Brand', width: 150, visible: true, sortable: true, filterable: true },
  { key: 'floors', label: 'Floors', width: 100, visible: true, sortable: true, filterable: true },
  { key: 'weight', label: 'Weight (kg)', width: 120, visible: true, sortable: true, filterable: true },
  { key: 'isFf', label: 'FF', width: 80, visible: true, sortable: true, filterable: true },
  { key: 'createdAt', label: 'Created', width: 140, visible: false, sortable: true, filterable: true },
  { key: 'updatedAt', label: 'Updated', width: 140, visible: false, sortable: true, filterable: true },
];

export function JobsTable() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [projects, setProjects] = useState<Array<{ projectUuid: string; projectIndex: string; projectName: string }>>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('jobs-table-columns');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return defaultColumns;
        }
      }
    }
    return defaultColumns;
  });
  const [sortField, setSortField] = useState<ColumnKey | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Resize and drag state
  const [isResizing, setIsResizing] = useState<{ column: ColumnKey; startX: number; startWidth: number } | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);

  const [formData, setFormData] = useState({
    projectUuid: '',
    jobName: '',
    floors: 0,
    weight: 0,
    isFf: false,
    brandUuid: ''
  });

  // Save columns to localStorage
  useEffect(() => {
    localStorage.setItem('jobs-table-columns', JSON.stringify(columns));
  }, [columns]);
  
  // Handle column resizing
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

  // Fetch data
  useEffect(() => {
    fetchJobs();
    fetchProjects();
    fetchBrands();
  }, []);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/jobs');
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects-v2');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.map((p: any) => ({
          projectUuid: p.project_uuid,
          projectIndex: p.project_index,
          projectName: p.project_name
        })));
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const fetchBrands = async () => {
    try {
      const res = await fetch('/api/brands');
      if (res.ok) {
        const data: Brand[] = await res.json();
        setBrands(data);
      }
    } catch (error) {
      console.error('Failed to fetch brands:', error);
    }
  };

  const handleAdd = async () => {
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        await fetchJobs();
        setIsAddDialogOpen(false);
        resetForm();
      }
    } catch (error) {
      console.error('Failed to create job:', error);
    }
  };

  const handleEdit = async () => {
    if (!editingJob) return;

    try {
      const res = await fetch('/api/jobs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingJob.id,
          ...formData
        })
      });

      if (res.ok) {
        await fetchJobs();
        setIsEditDialogOpen(false);
        setEditingJob(null);
        resetForm();
      }
    } catch (error) {
      console.error('Failed to update job:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this job?')) return;

    try {
      const res = await fetch(`/api/jobs?id=${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        await fetchJobs();
      }
    } catch (error) {
      console.error('Failed to delete job:', error);
    }
  };

  const openEditDialog = (job: Job) => {
    setEditingJob(job);
    setFormData({
      projectUuid: job.projectUuid,
      jobName: job.jobName,
      floors: job.floors,
      weight: job.weight,
      isFf: job.isFf,
      brandUuid: job.brandUuid || ''
    });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      projectUuid: '',
      jobName: '',
      floors: 0,
      weight: 0,
      isFf: false,
      brandUuid: ''
    });
  };

  // Filtering and sorting
  const filteredJobs = useMemo(() => {
    let filtered = jobs;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(job =>
        (job.jobIndex || '').toLowerCase().includes(search) ||
        (job.projectIndex || '').toLowerCase().includes(search) ||
        (job.jobName || '').toLowerCase().includes(search) ||
        (job.brandName || '').toLowerCase().includes(search)
      );
    }

    Object.entries(columnFilters).forEach(([column, values]) => {
      if (values.length > 0) {
        filtered = filtered.filter(job => {
          const cellValue = String(job[column as ColumnKey]);
          return values.includes(cellValue);
        });
      }
    });

    return filtered;
  }, [jobs, searchTerm, columnFilters]);

  const sortedJobs = useMemo(() => {
    if (!sortField) return filteredJobs;

    return [...filteredJobs].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredJobs, sortField, sortDirection]);

  const totalRecords = sortedJobs.length;
  const totalPages = Math.ceil(totalRecords / pageSize);
  const paginatedJobs = sortedJobs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const visibleColumns = columns.filter(col => col.visible);

  const handleSort = (field: ColumnKey) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleColumnVisibility = (key: ColumnKey) => {
    setColumns(columns.map(col => 
      col.key === key ? { ...col, visible: !col.visible } : col
    ));
  };
  
  // Column drag handlers
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

  if (loading) {
    return <div className="p-8 text-center">Loading jobs...</div>;
  }

  return (
    <div className="w-full p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Jobs</h1>
          <p className="text-sm text-muted-foreground">
            {totalRecords} total jobs
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Job
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Job</DialogTitle>
              <DialogDescription>Create a new job entry</DialogDescription>
            </DialogHeader>
            <JobForm
              formData={formData}
              setFormData={setFormData}
              projects={projects}
              brands={brands}
              onSubmit={handleAdd}
              onCancel={() => setIsAddDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Column Visibility */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Columns
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-2">
              <div className="font-medium text-sm mb-2">Toggle columns</div>
              {columns.map(col => (
                <div key={col.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={`col-${col.key}`}
                    checked={col.visible}
                    onCheckedChange={() => toggleColumnVisibility(col.key)}
                  />
                  <Label htmlFor={`col-${col.key}`} className="text-sm cursor-pointer">
                    {col.label}
                  </Label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Page Size */}
        <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25 rows</SelectItem>
            <SelectItem value="50">50 rows</SelectItem>
            <SelectItem value="100">100 rows</SelectItem>
            <SelectItem value="200">200 rows</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumns.map(column => (
                  <TableHead 
                    key={column.key}
                    draggable={!isResizing}
                    onDragStart={(e) => handleDragStart(e, column.key)}
                    onDragOver={(e) => handleDragOver(e, column.key)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, column.key)}
                    onDragEnd={handleDragEnd}
                    className={`bg-muted/50 relative group ${
                      draggedColumn === column.key ? 'opacity-50' : ''
                    } ${
                      dragOverColumn === column.key ? 'border-l-4 border-l-blue-500' : ''
                    }`}
                    style={{ 
                      width: column.width,
                      cursor: isResizing ? 'col-resize' : 'grab'
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span>{column.label}</span>
                      {column.sortable && (
                        <button
                          onClick={() => handleSort(column.key)}
                          className="hover:bg-accent rounded p-1"
                        >
                          {sortField === column.key ? (
                            sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                          ) : (
                            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      )}
                    </div>
                    
                    {/* Resize handle */}
                    <div
                      className="absolute top-0 bottom-0 w-4 cursor-col-resize hover:bg-blue-400/30 active:bg-blue-500/50 transition-colors"
                      style={{ 
                        right: '-8px',
                        zIndex: 30 
                      }}
                      draggable={false}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsResizing({
                          column: column.key,
                          startX: e.clientX,
                          startWidth: column.width
                        });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      title="Drag to resize column"
                    >
                      <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[2px] bg-gray-300 hover:bg-blue-500 transition-colors" />
                    </div>
                  </TableHead>
                ))}
                <TableHead className="w-32 bg-muted/50">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedJobs.map(job => (
                <TableRow key={job.id}>
                  {visibleColumns.map(column => (
                    <TableCell key={column.key} style={{ width: column.width }}>
                      {column.key === 'isFf' ? (
                        <Badge variant={job.isFf ? 'default' : 'secondary'}>
                          {job.isFf ? 'FF' : 'NOT FF'}
                        </Badge>
                      ) : column.key === 'floors' ? (
                        <span>{job.floors} Floors</span>
                      ) : column.key === 'weight' ? (
                        <span>{job.weight} kg</span>
                      ) : (
                        <span className="text-sm">{String(job[column.key] ?? '-')}</span>
                      )}
                    </TableCell>
                  ))}
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(job)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(job.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Job</DialogTitle>
            <DialogDescription>Update job information</DialogDescription>
          </DialogHeader>
          <JobForm
            formData={formData}
            setFormData={setFormData}
            projects={projects}
            brands={brands}
            onSubmit={handleEdit}
            onCancel={() => { setIsEditDialogOpen(false); setEditingJob(null); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Job Form Component
function JobForm({
  formData,
  setFormData,
  projects,
  brands,
  onSubmit,
  onCancel
}: {
  formData: any;
  setFormData: (data: any) => void;
  projects: Array<{ projectUuid: string; projectIndex: string; projectName: string }>;
  brands: Array<{ id: number; name: string }>;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Project Selection */}
      <div>
        <Label htmlFor="project">Project *</Label>
        <Combobox
          options={projects.map(p => ({
            value: p.projectUuid,
            label: `${p.projectIndex} - ${p.projectName}`
          }))}
          value={formData.projectUuid}
          onValueChange={(value) => setFormData({ ...formData, projectUuid: value })}
          placeholder="Select project..."
          searchPlaceholder="Search projects..."
        />
      </div>

      {/* Job Name */}
      <div>
        <Label htmlFor="jobName">Job Name *</Label>
        <Input
          id="jobName"
          value={formData.jobName}
          onChange={(e) => setFormData({ ...formData, jobName: e.target.value })}
          placeholder="Enter job name"
        />
      </div>

      {/* Brand Selection */}
      <div>
        <Label htmlFor="brand">Brand *</Label>
        <Select
          value={formData.brandUuid}
          onValueChange={(value) => setFormData({ ...formData, brandUuid: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select brand..." />
          </SelectTrigger>
          <SelectContent>
            {brands.map(brand => (
              <SelectItem key={brand.uuid} value={brand.uuid}>
                {brand.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Floors */}
      <div>
        <Label htmlFor="floors">Floors *</Label>
        <Input
          id="floors"
          type="number"
          value={formData.floors}
          onChange={(e) => setFormData({ ...formData, floors: parseInt(e.target.value) || 0 })}
          placeholder="Enter number of floors"
        />
      </div>

      {/* Weight */}
      <div>
        <Label htmlFor="weight">Weight (kg) *</Label>
        <Input
          id="weight"
          type="number"
          value={formData.weight}
          onChange={(e) => setFormData({ ...formData, weight: parseInt(e.target.value) || 0 })}
          placeholder="Enter weight in kg"
        />
      </div>

      {/* Is FF Switch */}
      <div className="flex items-center space-x-2">
        <Switch
          id="isFf"
          checked={formData.isFf}
          onCheckedChange={(checked) => setFormData({ ...formData, isFf: checked })}
        />
        <Label htmlFor="isFf">FF (firefighter)</Label>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSubmit}>
          <Check className="h-4 w-4 mr-2" />
          Save
        </Button>
      </div>
    </div>
  );
}
