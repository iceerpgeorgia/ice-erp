"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, Plus, Pencil, Trash2 } from "lucide-react";
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

export default function InventoryGroupsPage() {
  const [rows, setRows] = useState<InventoryGroup[]>([]);
  const [dimensions, setDimensions] = useState<DimensionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryGroup | null>(null);
  const [formData, setFormData] = useState({ name: "", dimension_uuid: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

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

  const handleAdd = () => { setEditing(null); setFormData({ name: "", dimension_uuid: "" }); setErrors({}); setDialogOpen(true); };
  const handleEdit = (row: InventoryGroup) => { setEditing(row); setFormData({ name: row.name, dimension_uuid: row.dimension_uuid }); setErrors({}); setDialogOpen(true); };

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
    if (!confirm("Deactivate this inventory group?")) return;
    try { const res = await fetch(`/api/inventory-groups?id=${id}`, { method: "DELETE" }); if (res.ok) fetchAll(); }
    catch (err) { console.error(err); }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Inventory Groups</h1>
          <p className="text-muted-foreground mt-1">Groups of inventory items by dimension</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={rows.length === 0}
            onClick={() => exportRowsToXlsx({ rows, columns: [{ key: "name" as any, label: "Name", visible: true }, { key: "dimension_name" as any, label: "Dimension", visible: true }, { key: "is_active" as any, label: "Active", visible: true }], fileName: `inventory_groups_${new Date().toISOString().slice(0,10)}.xlsx`, sheetName: "Inventory Groups" })}>
            <Download className="h-4 w-4 mr-2" />Export XLSX
          </Button>
          <Button onClick={handleAdd}><Plus className="w-4 h-4 mr-2" />Add Group</Button>
        </div>
      </div>

      {loading ? <div className="text-center py-12">Loading…</div> : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Dimension</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No inventory groups found.</TableCell></TableRow>
              ) : rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.dimension_name}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${row.is_active ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>
                      {row.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.createdAt}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(row)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(row.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Inventory Group" : "Add Inventory Group"}</DialogTitle>
            <DialogDescription>{editing ? "Update group details" : "Create a new inventory group"}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Group Name *</Label>
                <Input id="name" placeholder="e.g., Building Materials" value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={errors.name ? "border-destructive" : ""} />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="dimension_uuid">Dimension *</Label>
                <select id="dimension_uuid" value={formData.dimension_uuid}
                  onChange={(e) => setFormData({ ...formData, dimension_uuid: e.target.value })}
                  className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ${errors.dimension_uuid ? "border-destructive" : ""}`}>
                  <option value="">Select dimension…</option>
                  {dimensions.map((d) => <option key={d.uuid} value={d.uuid}>{d.dimension}</option>)}
                </select>
                {errors.dimension_uuid && <p className="text-sm text-destructive">{errors.dimension_uuid}</p>}
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
