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
import { Download, Plus, Pencil, Trash2 } from "lucide-react";
import { exportRowsToXlsx } from "@/lib/export-xlsx";

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
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Inventories</h1>
          <p className="text-muted-foreground mt-1">Manage inventory dictionary</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={rows.length === 0}
            onClick={() => exportRowsToXlsx({ rows, columns: [
              { key: "name" as any, label: "Name", visible: true },
              { key: "inventory_group_name" as any, label: "Group", visible: true },
              { key: "dimension_name" as any, label: "Dimension", visible: true },
              { key: "internal_number" as any, label: "Internal #", visible: true },
              { key: "is_nonbalance" as any, label: "Non-balance", visible: true },
              { key: "is_capex" as any, label: "CapEx", visible: true },
              { key: "is_active" as any, label: "Active", visible: true },
            ], fileName: `inventories_${new Date().toISOString().slice(0,10)}.xlsx`, sheetName: "Inventories" })}>
            <Download className="h-4 w-4 mr-2" />Export XLSX
          </Button>
          <Button onClick={handleAdd}><Plus className="w-4 h-4 mr-2" />Add Inventory</Button>
        </div>
      </div>

      {loading ? <div className="text-center py-12">Loading…</div> : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Group</TableHead>
                <TableHead>Dimension</TableHead>
                <TableHead>Internal #</TableHead>
                <TableHead>Non-balance</TableHead>
                <TableHead>CapEx</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No inventories found.</TableCell></TableRow>
              ) : rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.inventory_group_name}</TableCell>
                  <TableCell>{row.dimension_name}</TableCell>
                  <TableCell>{row.internal_number}</TableCell>
                  <TableCell>{row.is_nonbalance ? "Yes" : "No"}</TableCell>
                  <TableCell>{row.is_capex ? "Yes" : "No"}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${row.is_active ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>
                      {row.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
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
