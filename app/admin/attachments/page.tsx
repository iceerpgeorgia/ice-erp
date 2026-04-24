'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Settings,
  Eye,
  EyeOff,
  Download,
  Edit2,
  FileText,
  ChevronLeft,
  ChevronRight,
  Trash2,
  ExternalLink,
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
import { useTableFilters } from '@/components/figma/shared/use-table-filters';
import type { ColumnFormat } from '@/components/figma/shared/table-filters';
import { Card, CardContent } from '@/components/figma/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/figma/ui/select';

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
  format?: ColumnFormat;
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
  const filtersStorageKey = 'attachments-table:column-filters';
  const [data, setData] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editAttachment, setEditAttachment] = useState<Attachment | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);

  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const versionKey = 'attachmentsColumnsVersion';
    const currentVersion = '2';
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
          const defaultColumnsMap = new Map(defaultColumns.map((column) => [column.key, column]));
          const validSavedColumns = savedColumns.filter((savedColumn) => defaultColumnsMap.has(savedColumn.key));
          const updatedSavedColumns = validSavedColumns.map((savedColumn) => {
            const defaultColumn = defaultColumnsMap.get(savedColumn.key);
            if (!defaultColumn) return savedColumn;
            return {
              ...defaultColumn,
              visible: savedColumn.visible,
              width: savedColumn.width,
            };
          });
          const savedKeys = new Set(validSavedColumns.map((column) => column.key));
          const newColumns = defaultColumns.filter((column) => !savedKeys.has(column.key));
          setColumns([...updatedSavedColumns, ...newColumns]);
        } catch (error) {
          console.error('Failed to parse saved columns:', error);
          setColumns(defaultColumns);
        }
      }
    }

    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
      localStorage.setItem('attachmentsColumns', JSON.stringify(columns));
    }
  }, [columns, isInitialized]);

  const handleDragStart = (event: React.DragEvent<HTMLTableCellElement>, key: ColumnKey) => {
    setDraggedColumn(key);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (event: React.DragEvent<HTMLTableCellElement>, key: ColumnKey) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (draggedColumn && draggedColumn !== key) {
      setDragOverColumn(key);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (event: React.DragEvent<HTMLTableCellElement>, targetKey: ColumnKey) => {
    event.preventDefault();
    if (!draggedColumn || draggedColumn === targetKey) return;

    setColumns((previous) => {
      const draggedIndex = previous.findIndex((column) => column.key === draggedColumn);
      const targetIndex = previous.findIndex((column) => column.key === targetKey);
      const updated = [...previous];
      const [draggedItem] = updated.splice(draggedIndex, 1);
      updated.splice(targetIndex, 0, draggedItem);
      return updated;
    });

    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const getColumnValue = useCallback((row: Attachment, key: string): any => {
    switch (key as ColumnKey) {
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
        const paymentLink = row.links.find((link) => link.owner_table === 'payments');
        return paymentLink?.entity_details?.payment_id || null;
      }
      case 'projectName': {
        const projectLink = row.links.find((link) => link.owner_table === 'projects');
        return projectLink?.entity_details?.project_name || null;
      }
      case 'financialCode': {
        const paymentLink = row.links.find((link) => link.owner_table === 'payments');
        return paymentLink?.entity_details?.financial_code || null;
      }
      case 'counteragentName': {
        const counteragentLink = row.links.find((link) => link.owner_table === 'counteragents');
        return counteragentLink?.entity_details?.name || null;
      }
      case 'jobName': {
        const jobLink = row.links.find((link) => link.owner_table === 'jobs');
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
  }, []);

  const {
    filters,
    searchTerm,
    sortColumn,
    sortDirection,
    currentPage,
    pageSize,
    filteredData,
    sortedData,
    paginatedData,
    totalPages,
    getColumnValues,
    setSearchTerm,
    handleSort,
    setSortColumn,
    setSortDirection,
    setCurrentPage,
    setPageSize,
    handleFilterChange,
    clearFilters,
    activeFilterCount,
  } = useTableFilters<Attachment, ColumnKey>({
    data,
    columns,
    defaultSortColumn: 'createdAt',
    defaultSortDirection: 'desc',
    filtersStorageKey,
    searchColumns: ['fileName', 'documentType', 'documentNo', 'paymentId', 'projectName', 'financialCode', 'counteragentName', 'jobName', 'mimeType', 'storageProvider', 'uploadedByUserId'],
    getRowValue: getColumnValue,
    pageSize: 100,
  });

  const fetchAttachments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/attachments?all=1', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to fetch attachments');
      }
      const result = await response.json();
      setData(result.attachments || []);
    } catch (error) {
      console.error('Error fetching attachments:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

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
      case 'date': {
        const date = new Date(value);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
      }
      case 'filesize': {
        if (typeof value !== 'number') return '-';
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = value;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
          size /= 1024;
          unitIndex += 1;
        }
        return `${size.toFixed(1)} ${units[unitIndex]}`;
      }
      default:
        return String(value);
    }
  };

  const toggleColumnVisibility = (key: ColumnKey) => {
    setColumns((previous) =>
      previous.map((column) => (column.key === key ? { ...column, visible: !column.visible } : column))
    );
  };

  const downloadAttachment = async (attachment: Attachment) => {
    try {
      const response = await fetch(`/api/attachments/${attachment.uuid}/download`);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = attachment.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(anchor);
    } catch (error) {
      console.error('Error downloading attachment:', error);
      alert('Failed to download file');
    }
  };

  const openPreview = async (attachment: Attachment) => {
    setPreviewAttachment(attachment);
    setPreviewDialogOpen(true);
    setPreviewError(null);
    setPreviewBlobUrl(null);
    setPreviewLoading(true);
    try {
      const response = await fetch(`/api/attachments/${attachment.uuid}/view`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to load preview');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPreviewBlobUrl(url);
    } catch (error: any) {
      setPreviewError(error?.message || 'Failed to load preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    };
  }, [previewBlobUrl]);

  const closePreview = () => {
    setPreviewDialogOpen(false);
    setPreviewAttachment(null);
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
    setPreviewError(null);
  };

  const deleteAttachment = async (attachment: Attachment) => {
    if (
      !confirm(
        `Delete attachment "${attachment.fileName}"?` +
          `\n\nThis hides it from this list. The file is retained in storage and any links to projects/payments are preserved.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/attachments/${attachment.uuid}`, {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Delete failed');
      }
      await fetchAttachments();
    } catch (error: any) {
      console.error('Error deleting attachment:', error);
      alert(error?.message || 'Failed to delete attachment');
    }
  };

  const visibleColumns = columns.filter((column) => column.visible);
  const visibleStart = sortedData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const visibleEnd = sortedData.length === 0 ? 0 : Math.min(currentPage * pageSize, sortedData.length);
  const totalLabel = filteredData.length === data.length
    ? `${data.length} total`
    : `${filteredData.length} filtered / ${data.length} total`;

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="flex-shrink-0 border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Attachments</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage document attachments and links</p>
          </div>
          <Badge variant="outline" className="ml-4">{totalLabel}</Badge>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setCurrentPage(1);
              }}
              className="pl-9"
            />
          </div>

          <ClearFiltersButton
            onClear={() => {
              clearFilters();
              setSearchTerm('');
              setCurrentPage(1);
            }}
            activeCount={activeFilterCount + (searchTerm.trim() ? 1 : 0)}
          />

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
                  {columns.map((column) => (
                    <div key={column.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={`col-${column.key}`}
                        checked={column.visible}
                        onCheckedChange={() => toggleColumnVisibility(column.key)}
                      />
                      <label htmlFor={`col-${column.key}`} className="text-sm cursor-pointer flex-1">
                        {column.label}
                      </label>
                      {column.visible ? (
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

          <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
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

          <Button variant="outline" size="sm" onClick={fetchAttachments}>Refresh</Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          ) : sortedData.length === 0 ? (
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
                  {visibleColumns.map((column) => (
                    <th
                      key={column.key}
                      className={`p-2 text-left border-b cursor-move ${
                        draggedColumn === column.key ? 'opacity-50' : ''
                      } ${
                        dragOverColumn === column.key ? 'border-l-4 border-blue-500' : ''
                      }`}
                      style={{ width: column.width }}
                      draggable
                      onDragStart={(event) => handleDragStart(event, column.key)}
                      onDragOver={(event) => handleDragOver(event, column.key)}
                      onDragLeave={handleDragLeave}
                      onDrop={(event) => handleDrop(event, column.key)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 hover:bg-transparent"
                          onClick={() => column.sortable && handleSort(column.key)}
                        >
                          <span className="text-xs font-medium">{column.label}</span>
                          {column.sortable && sortColumn === column.key && (
                            sortDirection === 'asc'
                              ? <ArrowUp className="h-3 w-3 ml-1" />
                              : <ArrowDown className="h-3 w-3 ml-1" />
                          )}
                          {column.sortable && sortColumn !== column.key && (
                            <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />
                          )}
                        </Button>
                        {column.filterable && (
                          <ColumnFilterPopover
                            columnKey={column.key}
                            columnLabel={column.label}
                            values={getColumnValues(column.key)}
                            activeFilters={filters.get(column.key)?.mode === 'facet' ? (filters.get(column.key) as any).values : new Set()}
                            activeFilter={filters.get(column.key)}
                            columnFormat={column.format}
                            onAdvancedFilterChange={(filter) => handleFilterChange(column.key, filter)}
                            onFilterChange={(values) => {
                              handleFilterChange(column.key, values.size > 0 ? { mode: 'facet', values } : null);
                            }}
                            onSort={(direction) => {
                              setSortColumn(column.key);
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
                {paginatedData.map((row, index) => (
                  <tr key={row.uuid} className="hover:bg-muted/30 border-b transition-colors">
                    <td className="p-2 text-xs text-muted-foreground">
                      {(currentPage - 1) * pageSize + index + 1}
                    </td>
                    {visibleColumns.map((column) => (
                      <td key={column.key} className="p-2 text-sm">
                        {formatValue(
                          getColumnValue(row, column.key),
                          column.key === 'fileSizeBytes'
                            ? 'filesize'
                            : column.format
                        )}
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
                        <Button variant="ghost" size="sm" onClick={() => openPreview(row)} title="Preview">
                          <FileText className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => downloadAttachment(row)} title="Download">
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteAttachment(row)} title="Delete">
                          <Trash2 className="h-3 w-3 text-red-600" />
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

      <div className="flex-shrink-0 border-t bg-background px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {visibleStart} to {visibleEnd} of {sortedData.length}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog
        open={previewDialogOpen}
        onOpenChange={(open) => (open ? setPreviewDialogOpen(true) : closePreview())}
      >
        <DialogContent className="max-w-5xl w-[90vw] h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span className="truncate">{previewAttachment?.fileName || 'Preview'}</span>
              {previewBlobUrl && (
                <a
                  href={previewBlobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  title="Open in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in new tab
                </a>
              )}
            </DialogTitle>
            <DialogDescription>{previewAttachment?.mimeType || 'Inline file preview'}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden border rounded bg-muted/20">
            {previewLoading && (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                Loading preview...
              </div>
            )}
            {!previewLoading && previewError && (
              <div className="h-full w-full flex flex-col items-center justify-center text-red-600 gap-2 p-4 text-center">
                <p>{previewError}</p>
                {previewAttachment && (
                  <Button variant="outline" size="sm" onClick={() => downloadAttachment(previewAttachment)}>
                    <Download className="h-3 w-3 mr-1" />
                    Download instead
                  </Button>
                )}
              </div>
            )}
            {!previewLoading && !previewError && previewBlobUrl && previewAttachment && (() => {
              const mime = previewAttachment.mimeType || '';
              if (mime.startsWith('image/')) {
                return (
                  <div className="h-full w-full overflow-auto flex items-center justify-center bg-checkerboard">
                    <img
                      src={previewBlobUrl}
                      alt={previewAttachment.fileName}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                );
              }
              if (mime === 'application/pdf') {
                return (
                  <iframe
                    src={previewBlobUrl}
                    title={previewAttachment.fileName}
                    className="h-full w-full"
                  />
                );
              }
              if (mime.startsWith('text/') || mime === 'application/json' || mime === 'application/xml') {
                return (
                  <iframe
                    src={previewBlobUrl}
                    title={previewAttachment.fileName}
                    className="h-full w-full bg-white"
                  />
                );
              }
              return (
                <div className="h-full w-full flex flex-col">
                  <embed
                    src={previewBlobUrl}
                    type={mime || 'application/octet-stream'}
                    className="flex-1"
                  />
                  <div className="p-2 text-xs text-muted-foreground text-center border-t">
                    Preview may not be supported for this file type.{' '}
                    <button
                      type="button"
                      className="text-blue-600 hover:underline"
                      onClick={() => downloadAttachment(previewAttachment)}
                    >
                      Download instead
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Attachment Details</DialogTitle>
            <DialogDescription>View complete information about this attachment</DialogDescription>
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
                            {link.is_primary && <Badge>Primary</Badge>}
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

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Attachment</DialogTitle>
            <DialogDescription>Update attachment metadata and document information</DialogDescription>
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
                <Button onClick={() => setEditDialogOpen(false)}>
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
