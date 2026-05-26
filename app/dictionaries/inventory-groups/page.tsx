"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, Plus, Pencil, Trash2, Search, X, ToggleLeft, ToggleRight } from "lucide-react";
import { exportRowsToXlsx } from "@/lib/export-xlsx";

interface InventoryGroup {
  id: number;
  uuid: string;
  name: string;
  dimension_uuid: string;
  dimension_name: string;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DimensionOption {
  uuid: string;
  dimension: string;
}

type StatusFilter = "all" | "active" | "inactive";

export default function InventoryGroupsPage() {
  const [rows, setRows] = useState<InventoryGroup[]>([]);
  const [dimensions, setDimensions] = useState<DimensionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryGroup | null>(null);
  const [formData, setFormData] = useState({ name: "", dimension_uuid: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [dimFilter, setDimFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");

  useEffect(() => { fetchAll(); fetchDimensions(); }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/inventory-groups");
      if (res.ok) { const result = await res.json(); setRows(Array.isArray(result?.data) ? result.data : []); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchDimensions = async () => {
    try {
      const res = await fetch("/api/dimensions");
      if (res.ok) {
        const result = await res.json();
        const all = Array.isArray(result?.data) ? result.data : [];
        setDimensions(all.filter((d: any) => d.is_active).map((d: any) => ({ uuid: d.uuid, dimension: d.dimension })));
      }
    } catch (err) { console.error(err); }
  };

  // Derived: filtered rows
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter === "active" && !r.is_active) return false;
      if (statusFilter === "inactive" && r.is_active) return false;
      if (dimFilter && r.dimension_uuid !== dimFilter) return false;
      if (q && !r.name.toLowerCase().includes(q) && !r.dimension_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, dimFilter, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.is_active).length;
    const byDim: Record<string, number> = {};
    rows.filter((r) => r.is_active).forEach((r) => {
      byDim[r.dimension_name] = (byDim[r.dimension_name] || 0) + 1;
    });
    const topDims = Object.entries(byDim).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { total, active, inactive: total - active, topDims };
  }, [rows]);

  // Unique dimensions present in loaded rows (for filter dropdown)
  const dimOptions = useMemo(() => {
    const seen = new Map<string, string>();
    rows.forEach((r) => { if (!seen.has(r.dimension_uuid)) seen.set(r.dimension_uuid, r.dimension_name); });
    return Array.from(seen.entries()).map(([uuid, name]) => ({ uuid, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const handleAdd = () => { setEditing(null); setFormData({ name: "", dimension_uuid: "" }); setErrors({}); setDialogOpen(true); };
  const handleEdit = (row: InventoryGroup) => { setEditing(row); setFormData({ name: row.name, dimension_uuid: row.dimension_uuid }); setErrors({}); setDialogOpen(true); };

  const handleToggleActive = async (row: InventoryGroup) => {
    try {
      const res = await fetch(`/api/inventory-groups?id=${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !row.is_active }),
      });
      if (res.ok) fetchAll();
    } catch (err) { console.error(err); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setErrors({});
    try {
      const url = editing ? `/api/inventory-groups?id=${editing.id}` : "/api/inventory-groups";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
      const data = await res.json();
      if (!res.ok) { if (data.details) setErrors(data.details); else setErrors({ _form: data.error || "Failed to save" }); return; }
      setDialogOpen(false); fetchAll();
    } catch { setErrors({ _form: "Failed to save" }); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("გსურთ ამ ჯგუფის დეაქტივაცია?")) return;
    try { const res = await fetch(`/api/inventory-groups?id=${id}`, { method: "DELETE" }); if (res.ok) fetchAll(); }
    catch (err) { console.error(err); }
  };

  const clearFilters = () => { setSearch(""); setDimFilter(""); setStatusFilter("active"); };
  const hasFilters = search || dimFilter || statusFilter !== "active";

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">საინვენტარო ჯგუფები</h1>
          <p className="text-muted-foreground mt-1">Inventory Groups — გაზომვის ერთეულების მიხედვით</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={filtered.length === 0}
            onClick={() => exportRowsToXlsx({
              rows: filtered,
              columns: [
                { key: "name" as any, label: "დასახელება", visible: true },
                { key: "dimension_name" as any, label: "ერთეული", visible: true },
                { key: "is_active" as any, label: "აქტიური", visible: true },
                { key: "createdAt" as any, label: "შეიქმნა", visible: true },
              ],
              fileName: `inventory_groups_${new Date().toISOString().slice(0, 10)}.xlsx`,
              sheetName: "საინვენტარო ჯგუფები",
            })}>
            <Download className="h-4 w-4 mr-2" />Excel
          </Button>
          <Button onClick={handleAdd}><Plus className="w-4 h-4 mr-2" />ჯგუფის დამატება</Button>
        </div>
      </div>

      {/* Stats cards */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="border rounded-lg p-4 bg-card">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">სულ ჯგუფი</p>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </div>
          <div className="border rounded-lg p-4 bg-card">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">აქტიური</p>
            <p className="text-2xl font-bold mt-1 text-green-600">{stats.active}</p>
          </div>
          <div className="border rounded-lg p-4 bg-card">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">არააქტიური</p>
            <p className="text-2xl font-bold mt-1 text-muted-foreground">{stats.inactive}</p>
          </div>
          <div className="border rounded-lg p-4 bg-card">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">ნაჩვენებია</p>
            <p className="text-2xl font-bold mt-1">{filtered.length}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ძიება დასახელებით…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <select
          value={dimFilter}
          onChange={(e) => setDimFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[160px]"
        >
          <option value="">ყველა ერთეული</option>
          {dimOptions.map((d) => (
            <option key={d.uuid} value={d.uuid}>{d.name}</option>
          ))}
        </select>

        <div className="flex rounded-md border border-input overflow-hidden text-sm">
          {(["all", "active", "inactive"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
            >
              {s === "all" ? "ყველა" : s === "active" ? "აქტიური" : "არააქტიური"}
            </button>
          ))}
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
            <X className="h-3 w-3 mr-1" />გასუფთავება
          </Button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">იტვირთება…</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-8 text-center text-xs">#</TableHead>
                <TableHead>დასახელება</TableHead>
                <TableHead className="w-32">ერთეული</TableHead>
                <TableHead className="w-24 text-center">სტატუსი</TableHead>
                <TableHead className="w-28 text-right">მოქმედებები</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    {rows.length === 0 ? "ჯგუფები ვერ მოიძებნა." : "ფილტრის პირობებს არ შეესაბამება."}
                  </TableCell>
                </TableRow>
              ) : filtered.map((row, idx) => (
                <TableRow key={row.id} className={!row.is_active ? "opacity-50" : undefined}>
                  <TableCell className="text-center text-xs text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                      {row.dimension_name}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <button
                      onClick={() => handleToggleActive(row)}
                      title={row.is_active ? "დეაქტივაცია" : "აქტივაცია"}
                      className="inline-flex items-center gap-1"
                    >
                      {row.is_active ? (
                        <ToggleRight className="h-5 w-5 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(row)} title="რედაქტირება">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(row.id)} title="წაშლა" className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length > 0 && (
            <div className="px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
              {filtered.length} ჩანაწერი{filtered.length !== rows.length ? ` (სულ ${rows.length}-დან)` : ""}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "ჯგუფის რედაქტირება" : "ჯგუფის დამატება"}</DialogTitle>
            <DialogDescription>{editing ? "განაახლეთ ჯგუფის მონაცემები" : "შექმენით ახალი საინვენტარო ჯგუფი"}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">დასახელება *</Label>
                <Input id="name" placeholder="მაგ. ლიფტის ძრავი" value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={errors.name ? "border-destructive" : ""} />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="dimension_uuid">გაზომვის ერთეული *</Label>
                <select id="dimension_uuid" value={formData.dimension_uuid}
                  onChange={(e) => setFormData({ ...formData, dimension_uuid: e.target.value })}
                  className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ${errors.dimension_uuid ? "border-destructive" : ""}`}>
                  <option value="">აირჩიეთ ერთეული…</option>
                  {dimensions.map((d) => <option key={d.uuid} value={d.uuid}>{d.dimension}</option>)}
                </select>
                {errors.dimension_uuid && <p className="text-sm text-destructive">{errors.dimension_uuid}</p>}
              </div>
              {errors._form && <div className="p-3 bg-destructive/10 text-destructive text-sm rounded">{errors._form}</div>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>გაუქმება</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "ინახება…" : editing ? "განახლება" : "დამატება"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
