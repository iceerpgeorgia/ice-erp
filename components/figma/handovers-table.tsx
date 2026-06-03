'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Edit2,
  Settings,
  RefreshCw,
} from 'lucide-react';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Combobox } from '@/components/ui/combobox';
import { JobAttachments } from './job-attachments';
import { ProjectAttachments } from './project-attachments';
import { JobForm } from './jobs-table';
import type { Job, Brand } from './jobs-table';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { ColumnFilterPopover } from './shared/column-filter-popover';
import { ClearFiltersButton } from './shared/clear-filters-button';
import { useTableFilters } from './shared/use-table-filters';
import type { ColumnFormat } from './shared/table-filters';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { HandoverPaymentsGrid } from './handover-payments-grid';

type ColumnKey = keyof Job;

type ColumnConfig = {
  key: ColumnKey;
  label: string;
  width: number;
  visible: boolean;
  sortable: boolean;
  filterable: boolean;
  format?: ColumnFormat;
};

const defaultColumns: ColumnConfig[] = [
  { key: 'jobName', label: 'Job Name', width: 180, visible: true, sortable: true, filterable: true },
  { key: 'factoryNo', label: 'Factory No', width: 140, visible: true, sortable: true, filterable: true },
  { key: 'brandName', label: 'Brand', width: 130, visible: true, sortable: true, filterable: true },
  { key: 'floors', label: 'Floors', width: 90, visible: true, sortable: true, filterable: true },
  { key: 'weight', label: 'Weight (kg)', width: 110, visible: true, sortable: true, filterable: true },
  { key: 'sellingPrice', label: 'Selling Price', width: 140, visible: true, sortable: true, filterable: true, format: 'number' },
  { key: 'isFf', label: 'FF', width: 80, visible: true, sortable: true, filterable: true },
  { key: 'certificateDate', label: 'Certificate Date', width: 150, visible: true, sortable: true, filterable: false },
];

const STORAGE_KEY = 'handovers-table-columns';
const STORAGE_VERSION = '1';

type Project = { projectUuid: string; projectIndex: string; projectName: string };
type InsiderOption = { value: string; label: string; keywords?: string };

type FormData = {
  projectUuid: string;
  projectUuids: string[];
  jobName: string;
  factoryNo: string;
  floors: string | number;
  weight: string | number;
  sellingPrice: string | number;
  isFf: boolean;
  brandUuid: string;
  insiderUuid: string;
};

export function HandoversTable() {
  // ── Project / Job state ──────────────────────────────────────────────────
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectUuid, setSelectedProjectUuid] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('handovers-last-project') ?? '';
    }
    return '';
  });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [insidersList, setInsidersList] = useState<{ insiderUuid: string; insiderName: string }[]>([]);
  const [selectedInsiderUuids, setSelectedInsiderUuids] = useState<string[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // ── Attachment state ──────────────────────────────────────────────────────
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  // ── Edit dialog ──────────────────────────────────────────────────────────
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [formData, setFormData] = useState<FormData>({
    projectUuid: '',
    projectUuids: [],
    jobName: '',
    factoryNo: '',
    floors: '',
    weight: '',
    sellingPrice: '',
    isFf: false,
    brandUuid: '',
    insiderUuid: '',
  });

  // ── Column config ─────────────────────────────────────────────────────────
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        const version = localStorage.getItem(`${STORAGE_KEY}-v`);
        if (saved && version === STORAGE_VERSION) return JSON.parse(saved);
      } catch {}
    }
    return defaultColumns;
  });

  // ── Resize ────────────────────────────────────────────────────────────────
  const [isResizing, setIsResizing] = useState<{
    column: ColumnKey;
    startX: number;
    startWidth: number;
  } | null>(null);

  // ── Drag reorder ─────────────────────────────────────────────────────────
  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────
  const isInsiderFixed = selectedInsiderUuids.length === 1;
  const fixedInsider = useMemo(
    () =>
      isInsiderFixed
        ? (insidersList.find(i => i.insiderUuid === selectedInsiderUuids[0]) ?? null)
        : null,
    [isInsiderFixed, insidersList, selectedInsiderUuids],
  );
  const insiderOptions: InsiderOption[] = useMemo(
    () => insidersList.map(i => ({ value: i.insiderUuid, label: i.insiderName, keywords: i.insiderName })),
    [insidersList],
  );
  const visibleColumns = useMemo(() => columns.filter(c => c.visible), [columns]);

  // ── useTableFilters ───────────────────────────────────────────────────────
  const {
    filters,
    searchTerm,
    sortColumn,
    sortDirection,
    currentPage,
    pageSize,
    sortedData: sortedJobs,
    paginatedData: paginatedJobs,
    totalPages,
    getColumnValues,
    setSearchTerm,
    handleSort,
    setSortColumn,
    setSortDirection,
    setCurrentPage,
    handleFilterChange,
    clearFilters,
    activeFilterCount,
  } = useTableFilters<Job, ColumnKey>({
    data: jobs,
    columns,
    defaultSortColumn: 'jobName',
    defaultSortDirection: 'asc',
    filtersStorageKey: 'handovers-table:filters',
  });

  // ── Persist column config ─────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
    localStorage.setItem(`${STORAGE_KEY}-v`, STORAGE_VERSION);
  }, [columns]);

  // ── Resize mouse events ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isResizing) {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      return;
    }
    const onMove = (e: MouseEvent) => {
      const diff = e.clientX - isResizing.startX;
      const newWidth = Math.max(60, isResizing.startWidth + diff);
      setColumns(cols =>
        cols.map(c => (c.key === isResizing.column ? { ...c, width: newWidth } : c)),
      );
    };
    const onUp = () => setIsResizing(null);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isResizing]);

  // ── Initial data fetch ────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [projRes, brandRes, insiderRes] = await Promise.all([
          fetch('/api/projects-v2'),
          fetch('/api/brands'),
          fetch('/api/insider-selection', { cache: 'no-store' }),
        ]);
        if (projRes.ok) {
          const data = await projRes.json();
          setProjects(
            data.map((p: any) => ({
              projectUuid: p.project_uuid,
              projectIndex: p.project_index,
              projectName: p.project_name,
            })),
          );
        }
        if (brandRes.ok) setBrands(await brandRes.json());
        if (insiderRes.ok) {
          const data = await insiderRes.json();
          const selectedUuids: string[] = Array.isArray(data?.selectedUuids) ? data.selectedUuids : [];
          const options: any[] = Array.isArray(data?.options) ? data.options : [];
          const selectedInsiders: any[] = Array.isArray(data?.selectedInsiders) ? data.selectedInsiders : [];
          const list = (selectedInsiders.length > 0 ? selectedInsiders : options).map((i: any) => ({
            insiderUuid: i.insiderUuid,
            insiderName: i.insiderName,
          }));
          setSelectedInsiderUuids(selectedUuids);
          setInsidersList(list);
        }
      } catch (e) {
        console.error('Failed to fetch initial data:', e);
      } finally {
        setLoadingProjects(false);
      }
    })();
  }, []);

  // ── Jobs fetch ────────────────────────────────────────────────────────────
  const fetchJobs = async (projectUuid: string) => {
    if (!projectUuid) {
      setJobs([]);
      setAttachmentCounts({});
      return;
    }
    setLoadingJobs(true);
    try {
      const res = await fetch(`/api/jobs?projectUuid=${encodeURIComponent(projectUuid)}`);
      if (res.ok) {
        const data: any[] = await res.json();
        const jobUuids = data.map((j: any) => j.jobUuid).filter(Boolean);

        // Bulk-fetch certificate dates and attachment counts in parallel
        const [certRes, countRes] = await Promise.all([
          jobUuids.length > 0
            ? fetch(`/api/jobs/attachments?certDates=1&jobUuids=${encodeURIComponent(jobUuids.join(','))}`)
            : Promise.resolve(null),
          jobUuids.length > 0
            ? fetch(`/api/jobs/attachments?countsOnly=1&jobUuids=${encodeURIComponent(jobUuids.join(','))}`)
            : Promise.resolve(null),
        ]);

        const certDatesMap: Record<string, string | null> = certRes?.ok ? (await certRes.json()).dates ?? {} : {};
        const countsMap: Record<string, number> = countRes?.ok ? (await countRes.json()).counts ?? {} : {};

        setAttachmentCounts(countsMap);
        setJobs(
          data.map((job, idx) => ({
            id: Number(job.id ?? 0),
            jobUuid: String(job.jobUuid ?? ''),
            jobName: String(job.jobName ?? ''),
            factoryNo: job.factoryNo ?? null,
            floors: job.floors ?? null,
            weight: job.weight ?? null,
            sellingPrice: job.sellingPrice != null ? Number(job.sellingPrice) : null,
            isFf: Boolean(job.isFf),
            brandUuid: job.brandUuid ?? null,
            brandName: String(job.brandName ?? ''),
            jobIndex: String(job.jobDisplay ?? ''),
            projectUuid,
            projectIndex: '',
            projectName: '',
            bindingCount: 1,
            isActive: true,
            createdAt: '',
            updatedAt: '',
            insiderName: job.insiderName ?? null,
            certificateDate: certDatesMap[job.jobUuid] ?? null,
            _rowKey: String(job.jobUuid ?? idx),
          })),
        );
      }
    } catch (e) {
      console.error('Failed to fetch jobs:', e);
    } finally {
      setLoadingJobs(false);
    }
  };

  useEffect(() => {
    fetchJobs(selectedProjectUuid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectUuid]);

  const projectOptions = useMemo(
    () =>
      projects.map(p => ({
        value: p.projectUuid,
        label: `${p.projectIndex} — ${p.projectName}`,
        keywords: `${p.projectIndex} ${p.projectName}`,
      })),
    [projects],
  );

  // ── Column helpers ────────────────────────────────────────────────────────
  const toggleColumnVisibility = (key: ColumnKey) =>
    setColumns(cols => cols.map(c => (c.key === key ? { ...c, visible: !c.visible } : c)));

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, key: ColumnKey) => {
    setDraggedColumn(key);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: React.DragEvent, key: ColumnKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedColumn && draggedColumn !== key) setDragOverColumn(key);
  };
  const handleDragLeave = () => setDragOverColumn(null);
  const handleDrop = (e: React.DragEvent, targetKey: ColumnKey) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetKey) {
      setDraggedColumn(null);
      setDragOverColumn(null);
      return;
    }
    const from = columns.findIndex(c => c.key === draggedColumn);
    const to = columns.findIndex(c => c.key === targetKey);
    if (from === -1 || to === -1) return;
    const next = [...columns];
    const [removed] = next.splice(from, 1);
    next.splice(to, 0, removed);
    setColumns(next);
    setDraggedColumn(null);
    setDragOverColumn(null);
  };
  const handleDragEnd = () => {
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  // ── Edit dialog ───────────────────────────────────────────────────────────
  const openEditDialog = (job: Job) => {
    setEditingJob(job);
    setFormData({
      projectUuid: selectedProjectUuid,
      projectUuids: [selectedProjectUuid],
      jobName: job.jobName,
      factoryNo: job.factoryNo ?? '',
      floors: job.floors ?? '',
      weight: job.weight ?? '',
      sellingPrice: job.sellingPrice ?? '',
      isFf: job.isFf,
      brandUuid: job.brandUuid ?? '',
      insiderUuid: isInsiderFixed ? (fixedInsider?.insiderUuid ?? '') : '',
    });
    setIsEditDialogOpen(true);
  };

  const handleEdit = async () => {
    if (!editingJob) return;
    try {
      const res = await fetch('/api/jobs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingJob.id,
          projectUuids:
            formData.projectUuids.length > 0 ? formData.projectUuids : [selectedProjectUuid],
          jobName: formData.jobName,
          factoryNo: String(formData.factoryNo).trim() || null,
          floors: formData.floors === '' ? null : Number(formData.floors),
          weight: formData.weight === '' ? null : Number(formData.weight),
          sellingPrice: formData.sellingPrice === '' ? null : Number(formData.sellingPrice),
          isFf: formData.isFf,
          brandUuid: formData.brandUuid || null,
          insiderUuid: formData.insiderUuid || null,
        }),
      });
      if (res.ok) {
        await fetchJobs(selectedProjectUuid);
        setIsEditDialogOpen(false);
        setEditingJob(null);
      }
    } catch (e) {
      console.error('Failed to update job:', e);
    }
  };

  // ── Cell renderer ─────────────────────────────────────────────────────────
  const renderCell = (job: Job, col: ColumnConfig) => {
    switch (col.key) {
      case 'certificateDate':
        return job.certificateDate ? (
          <span className="text-sm">{new Date(job.certificateDate).toLocaleDateString()}</span>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        );
      case 'isFf':
        return (
          <Badge variant={job.isFf ? 'default' : 'secondary'}>
            {job.isFf ? 'FF' : 'NOT FF'}
          </Badge>
        );
      case 'floors':
        return <span>{job.floors == null ? '—' : `${job.floors} Floors`}</span>;
      case 'weight':
        return <span>{job.weight == null ? '—' : `${job.weight} kg`}</span>;
      case 'sellingPrice':
        return (
          <span>{job.sellingPrice == null ? '—' : job.sellingPrice.toLocaleString()}</span>
        );
      case 'factoryNo':
        return <span className="font-mono text-sm">{job.factoryNo ?? '—'}</span>;
      default:
        return <span className="text-sm">{String((job as any)[col.key] ?? '—')}</span>;
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Handovers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select a project to view and manage its jobs for handover.
        </p>
      </div>

      {/* Project selector */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Project</label>
        <div className="flex items-center gap-3">
          <div className="max-w-xl flex-1">
            <Combobox
              options={projectOptions}
              value={selectedProjectUuid}
              onValueChange={(uuid) => {
                setSelectedProjectUuid(uuid);
                if (typeof window !== 'undefined') {
                  if (uuid) localStorage.setItem('handovers-last-project', uuid);
                  else localStorage.removeItem('handovers-last-project');
                }
              }}
              placeholder={loadingProjects ? 'Loading projects…' : 'Select a project…'}
              searchPlaceholder="Search projects…"
              emptyText="No project found."
            />
          </div>
          {selectedProjectUuid && (
            <ProjectAttachments
              projectUuid={selectedProjectUuid}
              projectName={projects.find(p => p.projectUuid === selectedProjectUuid)?.projectName ?? null}
              lazyLoad={false}
            />
          )}
        </div>
      </div>

      {/* Jobs grid — only shown when a project is selected */}
      {selectedProjectUuid && (
        <div className="space-y-3">
          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search jobs…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <ClearFiltersButton
              activeCount={activeFilterCount + (searchTerm.trim() ? 1 : 0)}
              onClear={() => {
                clearFilters();
                setSearchTerm('');
              }}
            />

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Columns
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Toggle Columns</h4>
                  {columns.map(col => (
                    <div key={col.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={`hcol-${col.key}`}
                        checked={col.visible}
                        onCheckedChange={() => toggleColumnVisibility(col.key)}
                      />
                      <Label htmlFor={`hcol-${col.key}`} className="text-sm cursor-pointer">
                        {col.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchJobs(selectedProjectUuid)}
              disabled={loadingJobs}
              title="Refresh jobs"
            >
              <RefreshCw className={`h-4 w-4 ${loadingJobs ? 'animate-spin' : ''}`} />
            </Button>

            <span className="text-sm text-muted-foreground ml-auto">
              {loadingJobs
                ? 'Loading…'
                : `${sortedJobs.length} job${sortedJobs.length !== 1 ? 's' : ''}`}
            </span>
          </div>

          {/* Table */}
          <div className="rounded-lg border bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {visibleColumns.map(column => (
                      <TableHead
                        key={column.key}
                        draggable={!isResizing}
                        onDragStart={e => handleDragStart(e, column.key)}
                        onDragOver={e => handleDragOver(e, column.key)}
                        onDragLeave={handleDragLeave}
                        onDrop={e => handleDrop(e, column.key)}
                        onDragEnd={handleDragEnd}
                        className={[
                          'bg-muted/50 relative group select-none',
                          draggedColumn === column.key ? 'opacity-50' : '',
                          dragOverColumn === column.key ? 'border-l-4 border-l-blue-500' : '',
                        ].join(' ')}
                        style={{ width: column.width, minWidth: column.width }}
                      >
                        <div className="flex items-center justify-between gap-1 pr-3">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-medium">{column.label}</span>
                            {column.sortable && (
                              <button
                                onClick={() => handleSort(column.key)}
                                className="hover:bg-accent rounded p-0.5 shrink-0"
                              >
                                {sortColumn === column.key ? (
                                  sortDirection === 'asc' ? (
                                    <ArrowUp className="h-3 w-3" />
                                  ) : (
                                    <ArrowDown className="h-3 w-3" />
                                  )
                                ) : (
                                  <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                                )}
                              </button>
                            )}
                          </div>
                          {column.filterable && (
                            <ColumnFilterPopover
                              columnKey={column.key}
                              columnLabel={column.label}
                              values={getColumnValues(column.key)}
                              activeFilters={
                                filters.get(column.key)?.mode === 'facet'
                                  ? (filters.get(column.key) as any).values
                                  : new Set<string>()
                              }
                              activeFilter={filters.get(column.key)}
                              columnFormat={column.format as ColumnFormat | undefined}
                              onAdvancedFilterChange={filter =>
                                handleFilterChange(column.key, filter)
                              }
                              onFilterChange={values =>
                                handleFilterChange(
                                  column.key,
                                  values.size > 0 ? { mode: 'facet', values } : null,
                                )
                              }
                              onSort={dir => {
                                setSortColumn(column.key);
                                setSortDirection(dir);
                              }}
                            />
                          )}
                        </div>
                        {/* Resize handle */}
                        <div
                          className="absolute top-0 bottom-0 z-30 w-3 cursor-col-resize"
                          style={{ right: '-6px' }}
                          draggable={false}
                          onMouseDown={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsResizing({
                              column: column.key,
                              startX: e.clientX,
                              startWidth: column.width,
                            });
                          }}
                          onClick={e => e.stopPropagation()}
                        />
                      </TableHead>
                    ))}
                    <TableHead className="bg-muted/50 w-24 shrink-0">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingJobs ? (
                    <TableRow>
                      <TableCell
                        colSpan={visibleColumns.length + 1}
                        className="text-center py-8 text-muted-foreground"
                      >
                        Loading jobs…
                      </TableCell>
                    </TableRow>
                  ) : paginatedJobs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={visibleColumns.length + 1}
                        className="text-center py-8 text-muted-foreground"
                      >
                        {sortedJobs.length === 0 && !searchTerm && activeFilterCount === 0
                          ? 'No jobs found for this project.'
                          : 'No jobs match the current filters.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedJobs.map(job => (
                      <TableRow key={job._rowKey}>
                        {visibleColumns.map(col => (
                          <TableCell
                            key={col.key}
                            style={{ width: col.width, maxWidth: col.width }}
                          >
                            {renderCell(job, col)}
                          </TableCell>
                        ))}
                        <TableCell className="w-24">
                          <div className="flex items-center gap-1">
                            <JobAttachments
                              jobUuid={job.jobUuid}
                              jobName={job.jobName}
                              triggerTitle="Attachments"
                              initialCount={attachmentCounts[job.jobUuid] ?? null}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Edit job"
                              onClick={() => openEditDialog(job)}
                              disabled={!job.id}
                            >
                              <Edit2 className="h-4 w-4" />
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, sortedJobs.length)} of {sortedJobs.length}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="flex items-center px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Income Payments Grid */}
      {selectedProjectUuid && (
        <HandoverPaymentsGrid projectUuid={selectedProjectUuid} />
      )}

      {/* Edit Job Dialog */}
      <Dialog
        open={isEditDialogOpen}
        onOpenChange={open => {
          setIsEditDialogOpen(open);
          if (!open) setEditingJob(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Job</DialogTitle>
            <DialogDescription>
              Update job information for {editingJob?.jobName}
            </DialogDescription>
          </DialogHeader>
          <JobForm
            formData={formData}
            setFormData={setFormData}
            projects={projects}
            brands={brands}
            insiderOptions={insiderOptions}
            isInsiderFixed={isInsiderFixed}
            fixedInsiderName={fixedInsider?.insiderName ?? null}
            onSubmit={handleEdit}
            onCancel={() => {
              setIsEditDialogOpen(false);
              setEditingJob(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
