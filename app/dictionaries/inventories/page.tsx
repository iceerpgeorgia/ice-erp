"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, Plus, Pencil, Trash2, Search, Settings, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import { exportRowsToXlsx } from "@/lib/export-xlsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/figma/ui/popover";
import { ColumnFilterPopover } from "@/components/figma/shared/column-filter-popover";
import { ClearFiltersButton } from "@/components/figma/shared/clear-filters-button";
import { useTableFilters } from "@/components/figma/shared/use-table-filters";

interface Inventory {
  id: number;
  uuid: string;
  name: string;
  producer_uuid: string | null;
  inventory_group_uuid: string | null;
  dimension_uuid: string | null;
  internal_number: string | null;
  is_nonbalance: boolean;
  is_capex: boolean;
  is_active: boolean;
  inventory_group_name: string;
  dimension_name: string;
  createdAt: string;
  updatedAt: string;
}

interface Option { uuid: string; label: string; }
type ColumnKey = keyof Inventory;
type ColumnConfig = {
  key: ColumnKey;
  label: string;
  visible: boolean;
  sortable: boolean;
  filterable: boolean;
  width: number;
  format?: "boolean" | "date";
};

const defaultColumns: ColumnConfig[] = [
  { key: "name", label: "Name", visible: true, sortable: true, filterable: true, width: 260 },
  { key: "inventory_group_name", label: "Group", visible: true, sortable: true, filterable: true, width: 220 },
  { key: "dimension_name", label: "Dimension", visible: true, sortable: true, filterable: true, width: 180 },
  { key: "internal_number", label: "Internal #", visible: true, sortable: true, filterable: true, width: 160 },
  { key: "is_nonbalance", label: "Non-balance", visible: true, sortable: true, filterable: true, format: "boolean", width: 130 },
  { key: "is_capex", label: "CapEx", visible: true, sortable: true, filterable: true, format: "boolean", width: 100 },
  { key: "is_active", label: "Status", visible: true, sortable: true, filterable: true, format: "boolean", width: 110 },
  { key: "createdAt", label: "Created", visible: false, sortable: true, filterable: false, format: "date", width: 170 },
  { key: "updatedAt", label: "Updated", visible: false, sortable: true, filterable: false, format: "date", width: 170 },
];

const emptyForm = {
  name: "", producer_uuid: "", inventory_group_uuid: "", dimension_uuid: "",
  internal_number: "", is_nonbalance: false, is_capex: false,
};

export default function InventoriesPage() {
  const [rows, setRows] = useState<Inventory[]>([]);
  const [groups, setGroups] = useState<Option[]>([]);
  const [dims, setDims] = useState<Option[]>([]);
  const [producers, setProducers] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Inventory | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);

  const {
    filters,
    searchTerm,
    sortColumn,
    sortDirection,
    currentPage,
    pageSize,
    sortedData,
    paginatedData,
    totalPages,
    getColumnValues,
    setSearchTerm,
    handleSort,
    setCurrentPage,
    setPageSize,
    handleFilterChange,
    clearFilters,
    activeFilterCount,
  } = useTableFilters<Inventory, ColumnKey>({
    data: rows,
    columns,
    defaultSortColumn: "name",
    defaultSortDirection: "asc",
    filtersStorageKey: "inventoriesFiltersV1",
    pageSize: 200,
  });

  const visibleColumns = columns.filter((column) => column.visible);

  useEffect(() => { fetchAll(); fetchLookups(); }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/inventories");
      if (res.ok) { const r = await res.json(); setRows(Array.isArray(r?.data) ? r.data : []); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchLookups = async () => {
    try {
      const [gRes, dRes, pRes] = await Promise.all([
        fetch("/api/inventory-groups"),
        fetch("/api/dimensions"),
        fetch("/api/counteragents"),
      ]);

      if (gRes.ok) {
        const r = await gRes.json();
        setGroups((Array.isArray(r?.data) ? r.data : []).filter((x: any) => x.is_active).map((x: any) => ({ uuid: x.uuid, label: x.name })));
      }
      if (dRes.ok) {
        const r = await dRes.json();
        setDims((Array.isArray(r?.data) ? r.data : []).filter((x: any) => x.is_active).map((x: any) => ({ uuid: x.uuid, label: x.dimension })));
      }
      if (pRes.ok) {
        const r = await pRes.json();
        const list = Array.isArray(r?.data) ? r.data : [];
        setProducers(list.filter((x: any) => x.is_active !== false).map((x: any) => ({ uuid: x.uuid, label: x.name })));
      }
    } catch (err) { console.error(err); }
  };

  const handleAdd = () => { setEditing(null); setFormData({ ...emptyForm }); setErrors({}); setDialogOpen(true); };
  const handleEdit = (row: Inventory) => {
    setEditing(row);
    setFormData({
      name: row.name,
      producer_uuid: row.producer_uuid || "",
      inventory_group_uuid: row.inventory_group_uuid || "",
      dimension_uuid: row.dimension_uuid || "",
      internal_number: row.internal_number || "",
      is_nonbalance: row.is_nonbalance,
      is_capex: row.is_capex,
    });
    setErrors({});
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setErrors({});
    try {
      const url = editing ? `/api/inventories?id=${editing.id}` : "/api/inventories";
      const method = editing ? "PATCH" : "POST";
      const payload = {
        ...formData,
        producer_uuid: formData.producer_uuid || null,
        inventory_group_uuid: formData.inventory_group_uuid || null,
        dimension_uuid: formData.dimension_uuid || null,
        internal_number: formData.internal_number || null,
      };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { if (data.details) setErrors(data.details); else setErrors({ _form: data.error || "Failed to save" }); return; }
      setDialogOpen(false); fetchAll();
    } catch { setErrors({ _form: "Failed to save" }); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Deactivate this inventory item?")) return;
    try { const res = await fetch(`/api/inventories?id=${id}`, { method: "DELETE" }); if (res.ok) fetchAll(); }
    catch (err) { console.error(err); }
  };

  const selectCls = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="sticky top-0 z-30 flex-shrink-0 bg-white border-b shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Inventories</h1>
              <p className="text-sm text-muted-foreground mt-1">Manage inventory dictionary</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={sortedData.length === 0}
                onClick={() => exportRowsToXlsx({
                  rows: sortedData,
                  columns: columns.map((column) => ({ ...column, key: column.key as any })),
                  fileName: `inventories_${new Date().toISOString().slice(0, 10)}.xlsx`,
                  sheetName: "Inventories",
                })}
              >
                <Download className="h-4 w-4 mr-2" />Export XLSX
              </Button>
              <Button onClick={handleAdd}><Plus className="w-4 h-4 mr-2" />Add Inventory</Button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 mt-4">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search inventories..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-8"
                />
              </div>
              <ClearFiltersButton
                activeCount={activeFilterCount + (searchTerm ? 1 : 0)}
                onClear={() => {
                  clearFilters();
                  setSearchTerm("");
                }}
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm"><Settings className="h-4 w-4 mr-2" />Columns</Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-60">
                <div className="space-y-2">
                  {columns.map((column) => (
                    <label key={column.key} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={column.visible}
                        onCheckedChange={(checked) =>
                          setColumns((current) => current.map((item) =>
                            item.key === column.key ? { ...item, visible: Boolean(checked) } : item
                          ))
                        }
                      />
                      {column.label}
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 flex items-center justify-between px-6 py-2 bg-white border-b text-sm">
        <span>Total records: {sortedData.length}</span>
        <div className="flex items-center gap-2">
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
            className="h-8 rounded border bg-white px-2"
          >
            {[50, 100, 200, 500].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-white">
            <TableRow>
              {visibleColumns.map((column) => (
                <TableHead key={column.key} style={{ width: column.width, minWidth: column.width }}>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="flex items-center gap-1 min-w-0"
                      onClick={() => column.sortable && handleSort(column.key)}
                    >
                      <span className="truncate font-medium">{column.label}</span>
                      {sortColumn === column.key && (sortDirection === "asc"
                        ? <ArrowUp className="h-3 w-3 text-muted-foreground" />
                        : <ArrowDown className="h-3 w-3 text-muted-foreground" />)}
                    </button>
                    {column.filterable && (
                      <ColumnFilterPopover
                        columnKey={column.key}
                        columnLabel={column.label}
                        values={getColumnValues(column.key)}
                        activeFilter={filters.get(column.key)}
                        onAdvancedFilterChange={(filter) => handleFilterChange(column.key, filter)}
                        onSort={(direction) => handleSort(column.key)}
                        columnFormat={column.format}
                        renderValue={(value) => column.format === "boolean" ? (value ? "Yes" : "No") : String(value ?? "(Blank)")}
                      />
                    )}
                  </div>
                </TableHead>
              ))}
              <TableHead className="text-right" style={{ width: 100 }}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={visibleColumns.length + 1} className="text-center py-12">Loading...</TableCell></TableRow>
            ) : paginatedData.length === 0 ? (
              <TableRow><TableCell colSpan={visibleColumns.length + 1} className="text-center py-12 text-muted-foreground">No inventories found</TableCell></TableRow>
            ) : paginatedData.map((row) => (
              <TableRow key={row.id}>
                {visibleColumns.map((column) => (
                  <TableCell key={column.key} style={{ width: column.width, minWidth: column.width }}>
                    {column.key === "is_active" ? (
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${row.is_active ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>
                        {row.is_active ? "Active" : "Inactive"}
                      </span>
                    ) : column.format === "boolean" ? (
                      row[column.key] ? "Yes" : "No"
                    ) : (
                      String(row[column.key] ?? "")
                    )}
                  </TableCell>
                ))}
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(row)} title="Edit"><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(row.id)} title="Deactivate"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex-shrink-0 flex items-center justify-between bg-white border-t px-6 py-3 text-sm">
        <span>Showing {sortedData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} records</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span>Page {currentPage} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage >= totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Inventory" : "Add Inventory"}</DialogTitle>
            <DialogDescription>{editing ? "Update inventory details" : "Create a new inventory item"}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" placeholder="Inventory item name" value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={errors.name ? "border-destructive" : ""} />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="producer_uuid">Producer (Counteragent)</Label>
                <select id="producer_uuid" value={formData.producer_uuid}
                  onChange={(e) => setFormData({ ...formData, producer_uuid: e.target.value })}
                  className={selectCls}>
                  <option value="">— None —</option>
                  {producers.map((p) => <option key={p.uuid} value={p.uuid}>{p.label}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="inventory_group_uuid">Inventory Group</Label>
                <select id="inventory_group_uuid" value={formData.inventory_group_uuid}
                  onChange={(e) => setFormData({ ...formData, inventory_group_uuid: e.target.value })}
                  className={selectCls}>
                  <option value="">— None —</option>
                  {groups.map((g) => <option key={g.uuid} value={g.uuid}>{g.label}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dimension_uuid">Dimension</Label>
                <select id="dimension_uuid" value={formData.dimension_uuid}
                  onChange={(e) => setFormData({ ...formData, dimension_uuid: e.target.value })}
                  className={selectCls}>
                  <option value="">— None —</option>
                  {dims.map((d) => <option key={d.uuid} value={d.uuid}>{d.label}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="internal_number">Internal Number</Label>
                <Input id="internal_number" placeholder="e.g., INV-001" value={formData.internal_number}
                  onChange={(e) => setFormData({ ...formData, internal_number: e.target.value })} />
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox id="is_nonbalance" checked={formData.is_nonbalance}
                    onCheckedChange={(v) => setFormData({ ...formData, is_nonbalance: !!v })} />
                  <Label htmlFor="is_nonbalance">Non-balance</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="is_capex" checked={formData.is_capex}
                    onCheckedChange={(v) => setFormData({ ...formData, is_capex: !!v })} />
                  <Label htmlFor="is_capex">CapEx</Label>
                </div>
              </div>

              {errors._form && <div className="p-3 bg-destructive/10 text-destructive text-sm rounded">{errors._form}</div>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : editing ? "Update" : "Add"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
