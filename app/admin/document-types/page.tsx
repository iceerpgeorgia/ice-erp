"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Edit2,
  Eye,
  EyeOff,
  Plus,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/figma/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ColumnFilterPopover } from "@/components/figma/shared/column-filter-popover";
import { ClearFiltersButton } from "@/components/figma/shared/clear-filters-button";
import { useTableFilters } from "@/components/figma/shared/use-table-filters";
import type { ColumnFormat } from "@/components/figma/shared/table-filters";
import { exportRowsToXlsx } from "@/lib/export-xlsx";

// ─── Types ──────────────────────────────────────────────────────────────────

export type DocumentType = {
  id: string;
  uuid: string;
  name: string;
  isActive: boolean;
  requireDate: boolean;
  requireValue: boolean;
  requireCurrency: boolean;
  requireDocumentNo: boolean;
  requireProject: boolean;
  createdAt: string;
  updatedAt: string;
};

type ColumnKey = keyof DocumentType;

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
  { key: "id", label: "ID", width: 80, visible: false, sortable: true, filterable: true },
  { key: "uuid", label: "UUID", width: 280, visible: false, sortable: true, filterable: true },
  { key: "name", label: "Name", width: 280, visible: true, sortable: true, filterable: true },
  { key: "isActive", label: "Status", width: 120, visible: true, sortable: true, filterable: true },
  { key: "createdAt", label: "Created", width: 180, visible: false, sortable: true, filterable: true, format: "datetime" },
  { key: "updatedAt", label: "Updated", width: 180, visible: true, sortable: true, filterable: true, format: "datetime" },
];

const COLUMNS_STORAGE_KEY = "document-types-table-columns-v1";
const FILTERS_STORAGE_KEY = "document-types-table:column-filters";

// ─── Component ──────────────────────────────────────────────────────────────

export default function DocumentTypesPage() {
  const [rows, setRows] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(true);

  // Column state with localStorage persistence
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    if (typeof window === "undefined") return defaultColumns;
    try {
      const saved = localStorage.getItem(COLUMNS_STORAGE_KEY);
      if (!saved) return defaultColumns;
      const parsed = JSON.parse(saved) as ColumnConfig[];
      const byKey = new Map(parsed.map((c) => [c.key, c]));
      // Preserve saved ordering, but include any new default columns at the end
      const orderedFromSaved = parsed
        .map((c) => byKey.get(c.key) ? { ...defaultColumns.find((d) => d.key === c.key)!, ...c } : null)
        .filter(Boolean) as ColumnConfig[];
      const missing = defaultColumns.filter((d) => !byKey.has(d.key));
      return [...orderedFromSaved.filter((c) => defaultColumns.some((d) => d.key === c.key)), ...missing];
    } catch {
      return defaultColumns;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(columns));
    } catch {
      /* ignore quota errors */
    }
  }, [columns]);

  // Resize / drag-reorder
  const [isResizing, setIsResizing] = useState<{ column: ColumnKey; startX: number; startWidth: number } | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);

  useEffect(() => {
    if (!isResizing) {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      return;
    }
    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - isResizing.startX;
      const newWidth = Math.max(60, isResizing.startWidth + diff);
      setColumns((cols) =>
        cols.map((col) => (col.key === isResizing.column ? { ...col, width: newWidth } : col))
      );
    };
    const handleMouseUp = () => setIsResizing(null);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const handleDragStart = (e: React.DragEvent, key: ColumnKey) => {
    setDraggedColumn(key);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e: React.DragEvent, key: ColumnKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
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
    const draggedIndex = columns.findIndex((c) => c.key === draggedColumn);
    const targetIndex = columns.findIndex((c) => c.key === targetKey);
    if (draggedIndex === -1 || targetIndex === -1) return;
    const next = [...columns];
    const [removed] = next.splice(draggedIndex, 1);
    next.splice(targetIndex, 0, removed);
    setColumns(next);
    setDraggedColumn(null);
    setDragOverColumn(null);
  };
  const handleDragEnd = () => {
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  // Data fetching
  const fetchRows = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const url = showInactive
        ? "/api/document-types?includeInactive=true"
        : "/api/document-types";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to fetch");
      setRows((data.documentTypes || []).map((d: any) => ({
        id: String(d.id),
        uuid: d.uuid,
        name: d.name,
        isActive: d.isActive ?? d.is_active ?? true,
        requireDate: d.requireDate ?? false,
        requireValue: d.requireValue ?? false,
        requireCurrency: d.requireCurrency ?? false,
        requireDocumentNo: d.requireDocumentNo ?? false,
        requireProject: d.requireProject ?? false,
        createdAt: d.createdAt ?? d.created_at ?? "",
        updatedAt: d.updatedAt ?? d.updated_at ?? "",
      })));
    } catch (e: any) {
      setLoadError(e?.message || "Failed to fetch document types");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  // Filters / sort / pagination
  const pageSizeOptions = [50, 100, 200, 500, 1000];
  const {
    filters: columnFilters,
    searchTerm,
    sortColumn: sortField,
    sortDirection,
    currentPage,
    pageSize,
    sortedData,
    paginatedData,
    totalPages,
    getColumnValues: getUniqueValues,
    setSearchTerm,
    handleSort,
    setSortColumn: setSortField,
    setSortDirection,
    setCurrentPage,
    setPageSize,
    handleFilterChange,
    clearFilters,
    activeFilterCount,
  } = useTableFilters<DocumentType, ColumnKey>({
    data: rows,
    columns,
    defaultSortColumn: "name",
    defaultSortDirection: "asc",
    filtersStorageKey: FILTERS_STORAGE_KEY,
    pageSize: 100,
  });

  // Form / dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentType | null>(null);
  const [formName, setFormName] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formRequireDate, setFormRequireDate] = useState(false);
  const [formRequireValue, setFormRequireValue] = useState(false);
  const [formRequireCurrency, setFormRequireCurrency] = useState(false);
  const [formRequireDocumentNo, setFormRequireDocumentNo] = useState(false);
  const [formRequireProject, setFormRequireProject] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setFormName("");
    setFormActive(true);
    setFormRequireDate(false);
    setFormRequireValue(false);
    setFormRequireCurrency(false);
    setFormRequireDocumentNo(false);
    setFormRequireProject(false);
    setFormError(null);
    setDialogOpen(true);
  };
  const openEdit = (row: DocumentType) => {
    setEditing(row);
    setFormName(row.name);
    setFormActive(row.isActive);
    setFormRequireDate(row.requireDate);
    setFormRequireValue(row.requireValue);
    setFormRequireCurrency(row.requireCurrency);
    setFormRequireDocumentNo(row.requireDocumentNo);
    setFormRequireProject(row.requireProject);
    setFormError(null);
    setDialogOpen(true);
  };
  const handleSave = async () => {
    const name = formName.trim();
    if (!name) {
      setFormError("Name is required");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = editing
        ? await fetch(`/api/document-types/${editing.uuid}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              isActive: formActive,
              requireDate: formRequireDate,
              requireValue: formRequireValue,
              requireCurrency: formRequireCurrency,
              requireDocumentNo: formRequireDocumentNo,
              requireProject: formRequireProject,
            }),
          })
        : await fetch("/api/document-types", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              isActive: formActive,
              requireDate: formRequireDate,
              requireValue: formRequireValue,
              requireCurrency: formRequireCurrency,
              requireDocumentNo: formRequireDocumentNo,
              requireProject: formRequireProject,
            }),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed");
      setDialogOpen(false);
      await fetchRows();
    } catch (e: any) {
      setFormError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };
  const handleDelete = async (row: DocumentType) => {
    if (
      !confirm(
        `Delete document type "${row.name}"?\n\nIf it is referenced by attachments, it will be deactivated instead.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/document-types/${row.uuid}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      if (data?.deactivated) alert(data.message || "Document type deactivated.");
      await fetchRows();
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    }
  };

  const handleExportXlsx = () => {
    if (sortedData.length === 0) return;
    setIsExporting(true);
    try {
      const fileName = `document_types_${new Date().toISOString().slice(0, 10)}.xlsx`;
      exportRowsToXlsx({
        rows: sortedData,
        columns,
        fileName,
        sheetName: "Document Types",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const getSortIcon = (field: ColumnKey) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    return sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const visibleColumns = columns.filter((c) => c.visible);
  const tableWidth = useMemo(() => {
    return visibleColumns.reduce((sum, col) => sum + col.width, 0) + 96; // + Actions
  }, [visibleColumns]);

  const formatCell = (row: DocumentType, key: ColumnKey) => {
    if (key === "isActive") {
      return (
        <Badge variant={row.isActive ? "success" : "error"} className="text-xs">
          {row.isActive ? "Active" : "Inactive"}
        </Badge>
      );
    }
    if (key === "createdAt" || key === "updatedAt") {
      const v = row[key];
      return <span className="text-sm">{v ? new Date(v).toLocaleString() : "-"}</span>;
    }
    const v = row[key];
    return <span className="text-sm">{v == null || v === "" ? "-" : String(v)}</span>;
  };

  // Settings dialog
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
            Configure which columns to show. Drag a column header in the table to reorder; drag the right edge to resize.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {columns.map((column) => (
            <div key={column.key} className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`col-${column.key}`}
                  checked={column.visible}
                  onCheckedChange={(checked) => {
                    setColumns((cols) =>
                      cols.map((col) =>
                        col.key === column.key ? { ...col, visible: checked === true } : col
                      )
                    );
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
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setColumns(defaultColumns);
              setIsSettingsOpen(false);
            }}
          >
            Reset
          </Button>
          <Button onClick={() => setIsSettingsOpen(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="p-6 space-y-6 bg-background">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-foreground">Document Types</h1>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={showInactive}
              onCheckedChange={(v) => setShowInactive(v === true)}
            />
            Show inactive
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportXlsx}
            disabled={isExporting || sortedData.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? "Exporting..." : "Export XLSX"}
          </Button>
          <ColumnSettings />
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Document Type
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
          {loadError}
        </div>
      )}

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
            Showing {sortedData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-
            {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} records
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="border border-input rounded px-2 py-1 text-sm bg-background"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
              First
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
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
      <div className="border border-border rounded-lg bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table style={{ tableLayout: "fixed", width: `${tableWidth}px` }}>
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
                    className={`relative group bg-white transition-all ${
                      draggedColumn === column.key ? "opacity-50" : ""
                    } ${dragOverColumn === column.key ? "border-l-4 border-l-blue-500" : ""}`}
                    style={{
                      width: column.width,
                      cursor: isResizing ? "col-resize" : "grab",
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
                            activeFilters={
                              columnFilters.get(column.key)?.mode === "facet"
                                ? (columnFilters.get(column.key) as any).values
                                : new Set()
                            }
                            activeFilter={columnFilters.get(column.key)}
                            columnFormat={column.format as ColumnFormat | undefined}
                            onAdvancedFilterChange={(filter) => handleFilterChange(column.key, filter)}
                            onFilterChange={(values) => {
                              handleFilterChange(
                                column.key,
                                values.size > 0 ? { mode: "facet", values } : null
                              );
                            }}
                            onSort={(direction) => {
                              setSortField(column.key);
                              setSortDirection(direction);
                            }}
                          />
                        )}
                      </div>
                      <div
                        className="absolute top-0 bottom-0 w-4 cursor-col-resize hover:bg-blue-400/30 active:bg-blue-500/50 transition-colors"
                        style={{ right: "-8px", zIndex: 30 }}
                        draggable={false}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsResizing({
                            column: column.key,
                            startX: e.clientX,
                            startWidth: column.width,
                          });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        title="Drag to resize column"
                      >
                        <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[2px] bg-gray-300 hover:bg-blue-500 transition-colors" />
                      </div>
                    </div>
                  </TableHead>
                ))}
                <TableHead className="w-24 bg-white">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 1} className="text-center py-8 text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 1} className="text-center py-8 text-muted-foreground">
                    No document types found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((row) => (
                  <TableRow key={row.uuid} className="hover:bg-muted/50 transition-colors">
                    {visibleColumns.map((column) => (
                      <TableCell
                        key={column.key}
                        className="relative bg-white"
                        style={{ width: column.width }}
                      >
                        <div className="py-1 overflow-hidden text-ellipsis whitespace-nowrap">
                          {formatCell(row, column.key)}
                        </div>
                      </TableCell>
                    ))}
                    <TableCell className="w-24 bg-white">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(row)}
                          aria-label="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(row)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
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

      {/* Active filters indicator */}
      <div className="flex items-center space-x-2 text-sm">
        {columnFilters.size > 0 && (
          <>
            <span className="text-muted-foreground">Active filters:</span>
            {Array.from(columnFilters.entries()).map(([column, filter]) => (
              <Badge key={column} variant="secondary" className="text-xs">
                {columns.find((c) => c.key === column)?.label}:{" "}
                {filter.mode === "facet" ? filter.values.size : 1}
              </Badge>
            ))}
          </>
        )}
        <ClearFiltersButton
          activeCount={activeFilterCount + (searchTerm.trim() ? 1 : 0)}
          label="Clear All"
          onClear={() => {
            clearFilters();
            setSearchTerm("");
          }}
          className="h-6 px-2 text-xs"
        />
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Document Type" : "Add Document Type"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="dt-name">Name</Label>
              <Input
                id="dt-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Contract"
                autoFocus
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={formActive}
                onCheckedChange={(v) => setFormActive(v === true)}
              />
              Active
            </label>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Required Fields</Label>
              <div className="space-y-2 pl-1">
                {([
                  { key: 'date',    label: 'Document Date',    state: formRequireDate,       set: setFormRequireDate },
                  { key: 'value',   label: 'Value (Sum)',      state: formRequireValue,      set: setFormRequireValue },
                  { key: 'curr',    label: 'Currency',         state: formRequireCurrency,   set: setFormRequireCurrency },
                  { key: 'docno',   label: 'Document Number',  state: formRequireDocumentNo, set: setFormRequireDocumentNo },
                  { key: 'project', label: 'Project',          state: formRequireProject,    set: setFormRequireProject },
                ] as Array<{ key: string; label: string; state: boolean; set: (v: boolean) => void }>).map(({ key, label, state, set }) => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={state} onCheckedChange={(v) => set(v === true)} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            {formError && <div className="text-sm text-red-600">{formError}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
