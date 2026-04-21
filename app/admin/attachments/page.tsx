'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Settings,
  Eye,
  EyeOff,
  Download,
  Edit2,
  X,
  FileText,
  Upload,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/figma/ui/button';
import { Input } from '@/components/figma/ui/input';
import { Badge } from '@/components/figma/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/figma/ui/popover';
import { Checkbox } from '@/components/figma/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/figma/ui/dialog';
import { Label } from '@/components/figma/ui/label';
import { ColumnFilterPopover } from '@/components/figma/shared/column-filter-popover';
import { ClearFiltersButton } from '@/components/figma/shared/clear-filters-button';
import type { ColumnFilter } from '@/components/figma/shared/table-filters';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/figma/ui/card';

type AttachmentLink = {
  link_uuid: string;
  owner_table: string;
  owner_uuid: string;
  owner_field: string | null;
  is_primary: boolean;
  created_at: string;
  entity_details: any;
};

type Attachment = {
  uuid: string;
  fileName: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  fileHashSha256: string | null;
  storageProvider: string;
  storageBucket: string | null;
  storagePath: string;
  documentType: {
    uuid: string;
    name: string;
  } | null;
  documentDate: string | null;
  documentNo: string | null;
  documentValue: number | null;
  currency: {
    uuid: string;
    code: string;
    name: string;
  } | null;
  metadata: any;
  uploadedByUserId: string | null;
  uploadedByUser: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
  } | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  links: AttachmentLink[];
};

type ColumnKey =
  | 'fileName'
  | 'documentType'
  | 'documentDate'
  | 'documentNo'
  | 'documentValue'
  | 'currency'
  | 'paymentId'
  | 'projectName'
  | 'financialCode'
  | 'counteragentName'
  | 'jobName'
  | 'mimeType'
  | 'fileSizeBytes'
  | 'storageProvider'
  | 'uploadedByUserId'
  | 'createdAt';

type ColumnConfig = {
  key: ColumnKey;
  label: string;
  visible: boolean;
  sortable: boolean;
  filterable: boolean;
  format?: 'currency' | 'number' | 'date';
  width: number;
};

const defaultColumns: ColumnConfig[] = [
  { key: 'fileName', label: 'File Name', visible: true, sortable: true, filterable: true, width: 300 },
  { key: 'documentType', label: 'Document Type', visible: true, sortable: true, filterable: true, width: 150 },
  { key: 'documentDate', label: 'Document Date', visible: true, sortable: true, filterable: true, format: 'date', width: 130 },
  { key: 'documentNo', label: 'Document No', visible: true, sortable: true, filterable: true, width: 150 },
  { key: 'documentValue', label: 'Value', visible: true, sortable: true, filterable: true, format: 'currency', width: 120 },
  { key: 'currency', label: 'Currency', visible: true, sortable: true, filterable: true, width: 100 },
  { key: 'paymentId', label: 'Payment ID', visible: true, sortable: true, filterable: true, width: 150 },
  { key: 'projectName', label: 'Project', visible: true, sortable: true, filterable: true, width: 200 },
  { key: 'financialCode', label: 'Financial Code', visible: false, sortable: true, filterable: true, width: 150 },
  { key: 'counteragentName', label: 'Counteragent', visible: false, sortable: true, filterable: true, width: 200 },
  { key: 'jobName', label: 'Job', visible: false, sortable: true, filterable: true, width: 150 },
  { key: 'mimeType', label: 'Type', visible: true, sortable: true, filterable: true, width: 150 },
  { key: 'fileSizeBytes', label: 'Size', visible: true, sortable: true, filterable: true, width: 100 },
  { key: 'storageProvider', label: 'Storage', visible: false, sortable: true, filterable: true, width: 120 },
  { key: 'uploadedByUserId', label: 'Uploaded By', visible: false, sortable: true, filterable: true, width: 150 },
  { key: 'createdAt', label: 'Created', visible: true, sortable: true, filterable: true, format: 'date', width: 130 },
];

export default function AttachmentsPage() {
  const filtersStorageKey = 'attachmentsFiltersV1';
  const [data, setData] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOwnerTable, setSelectedOwnerTable] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editAttachment, setEditAttachment] = useState<Attachment | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Column drag and drop state
  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);

  // Table filters and sorting
  const [filters, setFilters] = useState<Record<string, ColumnFilter>>({});
  const [sortColumn, setSortColumn] = useState<ColumnKey | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const setFilter = (key: ColumnKey, filter: ColumnFilter | null) => {
    setFilters((prev) => {
      if (!filter) {
        const { [key]: removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: filter };
    });
  };

  const clearFilter = (key: ColumnKey) => {
    setFilters((prev) => {
      const { [key]: removed, ...rest } = prev;
      return rest;
    });
  };

  const clearAllFilters = () => {
    setFilters({});
  };

  const toggleSort = (key: ColumnKey) => {
    if (sortColumn === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(key);
      setSortDirection('asc');
    }
  };

  const hasActiveFilters = Object.keys(filters).length > 0;

  // Load saved column configuration from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const versionKey = 'attachmentsColumnsVersion';
    const currentVersion = '1';
    const savedVersion = localStorage.getItem(versionKey);
    const shouldLoadSavedColumns = savedVersion === currentVersion;

    if (!shouldLoadSavedColumns) {
      localStorage.setItem('attachmentsColumns', JSON.stringify(defaultColumns));
      localStorage.setItem(versionKey, currentVersion);
      setColumns(defaultColumns);
    } else {
      const saved = localStorage.getItem('attachmentsColumns');
      if (saved) {
        try {
          const savedColumns = JSON.parse(saved) as ColumnConfig[];
          
          // Create a map of default columns for easy lookup
          const defaultColumnsMap = new Map(defaultColumns.map(col => [col.key, col]));
          
          // Filter out any columns that don't exist in defaultColumns
          const validSavedColumns = savedColumns.filter(savedCol => defaultColumnsMap.has(savedCol.key));
          
          // Update saved columns with latest defaults while preserving user preferences
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
          
          // Add any new columns from defaults that aren't in saved config
          const savedKeys = new Set(validSavedColumns.map(col => col.key));
          const newColumns = defaultColumns.filter(col => !savedKeys.has(col.key));
          
          setColumns([...updatedSavedColumns, ...newColumns]);
        } catch (e) {
          console.error('Failed to parse saved columns:', e);
          setColumns(defaultColumns);
        }
      }
    }

    setIsInitialized(true);
  }, []);

  // Save column configuration to localStorage whenever it changes
  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
      localStorage.setItem('attachmentsColumns', JSON.stringify(columns));
    }
  }, [columns, isInitialized]);

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

  const fetchAttachments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      if (searchQuery) params.append('search', searchQuery);
      if (selectedOwnerTable) params.append('ownerTable', selectedOwnerTable);

      const response = await fetch(`/api/attachments?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch attachments');
      }

      const result = await response.json();
      setData(result.attachments || []);
      setTotal(result.pagination?.total || 0);
    } catch (error) {
      console.error('Error fetching attachments:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttachments();
  }, [page, searchQuery, selectedOwnerTable]);

  // Extract value for filtering/sorting
  const getColumnValue = (row: Attachment, key: ColumnKey): any => {
    switch (key) {
      case 'fileName':
        return row.fileName;
      case 'documentType':
        return row.documentType?.name || null;
      case 'documentDate':
        return row.documentDate;
      case 'documentNo':
        return row.documentNo;
      case 'documentValue':
        return row.documentValue;
      case 'currency':
        return row.currency?.code || null;
      case 'paymentId': {
        const paymentLink = row.links.find((l) => l.owner_table === 'payments');
        return paymentLink?.entity_details?.payment_id || null;
      }
      case 'projectName': {
        const projectLink = row.links.find((l) => l.owner_table === 'projects');
        return projectLink?.entity_details?.project_name || null;
      }
      case 'financialCode': {
        const paymentLink = row.links.find((l) => l.owner_table === 'payments');
        return paymentLink?.entity_details?.financial_code || null;
      }
      case 'counteragentName': {
        const counteragentLink = row.links.find((l) => l.owner_table === 'counteragents');
        return counteragentLink?.entity_details?.name || null;
      }
      case 'jobName': {
        const jobLink = row.links.find((l) => l.owner_table === 'jobs');
        return jobLink?.entity_details?.job_name || null;
      }
      case 'mimeType':
        return row.mimeType;
      case 'fileSizeBytes':
        return row.fileSizeBytes;
      case 'storageProvider':
        return row.storageProvider;
      case 'uploadedByUserId':
        return row.uploadedByUser?.name || row.uploadedByUser?.email || row.uploadedByUserId || null;
      case 'createdAt':
        return row.createdAt;
      default:
        return null;
    }
  };

  // Format value for display
  const formatValue = (value: any, format?: ColumnConfig['format'] | 'filesize'): string => {
    if (value === null || value === undefined) return '-';

    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'decimal',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(value);
      case 'number':
        return new Intl.NumberFormat('en-US').format(value);
      case 'date':
        if (!value) return '-';
        const date = new Date(value);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
      case 'filesize':
        if (typeof value !== 'number') return '-';
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = value;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
          size /= 1024;
          unitIndex++;
        }
        return `${size.toFixed(1)} ${units[unitIndex]}`;
      default:
        return String(value);
    }
  };

  // Apply filters and sorting
  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Apply column filters
    columns.forEach((col) => {
      if (!col.filterable) return;
      const filter = filters[col.key];
      if (!filter) return;

      result = result.filter((row) => {
        const value = getColumnValue(row, col.key);
        
        if (filter.mode === 'facet') {
          return filter.values.has(value);
        }
        // Add other filter modes as needed
        return true;
      });
    });

    // Apply sorting
    if (sortColumn) {
      result.sort((a, b) => {
        const aValue = getColumnValue(a, sortColumn);
        const bValue = getColumnValue(b, sortColumn);

        if (aValue === null && bValue === null) return 0;
        if (aValue === null) return 1;
        if (bValue === null) return -1;

        let comparison = 0;
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } else {
          comparison = String(aValue).localeCompare(String(bValue));
        }

        return sortDirection === 'desc' ? -comparison : comparison;
      });
    }

    return result;
  }, [data, filters, sortColumn, sortDirection, columns]);

  // Column visibility toggle
  const toggleColumnVisibility = (key: ColumnKey) => {
    setColumns((prev) =>
      prev.map((col) => (col.key === key ? { ...col, visible: !col.visible } : col))
    );
  };

  // Download attachment
  const downloadAttachment = async (attachment: Attachment) => {
    try {
      const response = await fetch(`/api/attachments/${attachment.uuid}/download`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading attachment:', error);
      alert('Failed to download file');
    }
  };

  const visibleColumns = columns.filter((col) => col.visible);
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Attachments</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage document attachments and links
            </p>
          </div>
          <Badge variant="outline" className="ml-4">
            {total} total
          </Badge>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 mt-4">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <ClearFiltersButton onClear={clearAllFilters} activeCount={Object.keys(filters).length} />
          )}

          {/* Columns Settings */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Toggle Columns</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {columns.map((col) => (
                    <div key={col.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={`col-${col.key}`}
                        checked={col.visible}
                        onCheckedChange={() => toggleColumnVisibility(col.key)}
                      />
                      <label
                        htmlFor={`col-${col.key}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {col.label}
                      </label>
                      {col.visible ? (
                        <Eye className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <EyeOff className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Refresh */}
          <Button variant="outline" size="sm" onClick={() => fetchAttachments()}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          ) : filteredAndSortedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No attachments found</p>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-muted/50 backdrop-blur-sm z-10">
                <tr>
                  <th className="w-12 p-2 text-left border-b">
                    <span className="text-xs font-medium">#</span>
                  </th>
                  {visibleColumns.map((col) => (
                    <th
                      key={col.key}
                      className={`p-2 text-left border-b cursor-move ${
                        draggedColumn === col.key ? 'opacity-50' : ''
                      } ${
                        dragOverColumn === col.key ? 'border-l-4 border-blue-500' : ''
                      }`}
                      style={{ width: col.width }}
                      draggable
                      onDragStart={(e) => handleDragStart(e, col.key)}
                      onDragOver={(e) => handleDragOver(e, col.key)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, col.key)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 hover:bg-transparent"
                          onClick={() => col.sortable && toggleSort(col.key)}
                        >
                          <span className="text-xs font-medium">{col.label}</span>
                          {col.sortable && sortColumn === col.key && (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="h-3 w-3 ml-1" />
                            ) : (
                              <ArrowDown className="h-3 w-3 ml-1" />
                            )
                          )}
                          {col.sortable && sortColumn !== col.key && (
                            <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />
                          )}
                        </Button>
                        {col.filterable && (
                          <ColumnFilterPopover
                            columnKey={col.key}
                            columnLabel={col.label}
                            values={data.map((row) => getColumnValue(row, col.key))}
                            activeFilters={filters[col.key]?.mode === 'facet' ? (filters[col.key] as any).values : new Set()}
                            activeFilter={filters[col.key]}
                            columnFormat={col.format}
                            onAdvancedFilterChange={(filter) => setFilter(col.key, filter as any)}
                            onFilterChange={(values) => {
                              if (values.size > 0) {
                                setFilter(col.key, { mode: 'facet', values });
                              } else {
                                clearFilter(col.key);
                              }
                            }}
                            onSort={(direction) => {
                              setSortColumn(col.key);
                              setSortDirection(direction);
                            }}
                          />
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="w-32 p-2 text-left border-b">
                    <span className="text-xs font-medium">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedData.map((row, index) => (
                  <tr
                    key={row.uuid}
                    className="hover:bg-muted/30 border-b transition-colors"
                  >
                    <td className="p-2 text-xs text-muted-foreground">
                      {(page - 1) * limit + index + 1}
                    </td>
                    {visibleColumns.map((col) => (
                      <td key={col.key} className="p-2 text-sm">
                        {formatValue(getColumnValue(row, col.key), col.format)}
                      </td>
                    ))}
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedAttachment(row);
                            setViewDialogOpen(true);
                          }}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditAttachment(row);
                            setEditDialogOpen(true);
                          }}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadAttachment(row)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Pagination */}
      <div className="flex-shrink-0 border-t bg-background px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Attachment Details</DialogTitle>
            <DialogDescription>
              View complete information about this attachment
            </DialogDescription>
          </DialogHeader>
          {selectedAttachment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">File Name</Label>
                  <p className="text-sm font-medium">{selectedAttachment.fileName}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Document Type</Label>
                  <p className="text-sm">{selectedAttachment.documentType?.name || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Document Date</Label>
                  <p className="text-sm">{selectedAttachment.documentDate ? formatValue(selectedAttachment.documentDate, 'date') : '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Document No</Label>
                  <p className="text-sm">{selectedAttachment.documentNo || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Value</Label>
                  <p className="text-sm">
                    {selectedAttachment.documentValue
                      ? formatValue(selectedAttachment.documentValue, 'currency')
                      : '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Currency</Label>
                  <p className="text-sm">{selectedAttachment.currency?.code || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">File Size</Label>
                  <p className="text-sm">{formatValue(selectedAttachment.fileSizeBytes, 'filesize')}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">MIME Type</Label>
                  <p className="text-sm">{selectedAttachment.mimeType || '-'}</p>
                </div>
              </div>

              {selectedAttachment.links.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Linked Entities</Label>
                  <div className="mt-2 space-y-2">
                    {selectedAttachment.links.map((link) => (
                      <Card key={link.link_uuid}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <Badge variant="outline" className="mb-2">
                                {link.owner_table}
                              </Badge>
                              {link.entity_details && (
                                <div className="text-sm space-y-1">
                                  {link.owner_table === 'payments' && (
                                    <>
                                      <p><strong>Payment ID:</strong> {link.entity_details.payment_id}</p>
                                      <p><strong>Label:</strong> {link.entity_details.label || '-'}</p>
                                      {link.entity_details.financial_code && (
                                        <p><strong>Financial Code:</strong> {link.entity_details.financial_code}</p>
                                      )}
                                    </>
                                  )}
                                  {link.owner_table === 'projects' && (
                                    <>
                                      <p><strong>Project:</strong> {link.entity_details.project_name}</p>
                                      <p><strong>Contract:</strong> {link.entity_details.contract_no || '-'}</p>
                                    </>
                                  )}
                                  {link.owner_table === 'jobs' && (
                                    <p><strong>Job:</strong> {link.entity_details.job_name}</p>
                                  )}
                                  {link.owner_table === 'counteragents' && (
                                    <p><strong>Counteragent:</strong> {link.entity_details.name}</p>
                                  )}
                                </div>
                              )}
                            </div>
                            {link.is_primary && (
                              <Badge>Primary</Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Attachment</DialogTitle>
            <DialogDescription>
              Update attachment metadata and document information
            </DialogDescription>
          </DialogHeader>
          {editAttachment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Document Type</Label>
                  <Input defaultValue={editAttachment.documentType?.name || ''} />
                </div>
                <div>
                  <Label>Document Date</Label>
                  <Input type="date" defaultValue={editAttachment.documentDate || ''} />
                </div>
                <div>
                  <Label>Document No</Label>
                  <Input defaultValue={editAttachment.documentNo || ''} />
                </div>
                <div>
                  <Label>Document Value</Label>
                  <Input
                    type="number"
                    step="0.01"
                    defaultValue={editAttachment.documentValue || ''}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => {
                  // TODO: Implement save
                  setEditDialogOpen(false);
                }}>
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
