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

interface Dimension {
  id: number;
  uuid: string;
  dimension: string;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function DimensionsPage() {
  const [rows, setRows] = useState<Dimension[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Dimension | null>(null);
  const [formData, setFormData] = useState({ dimension: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/dimensions");
      if (res.ok) {
        const result = await res.json();
        setRows(Array.isArray(result?.data) ? result.data : []);
      }
    } catch (err) { console.error("Failed to fetch dimensions:", err); }
    finally { setLoading(false); }
  };

  const handleAdd = () => { setEditing(null); setFormData({ dimension: "" }); setErrors({}); setDialogOpen(true); };
  const handleEdit = (row: Dimension) => { setEditing(row); setFormData({ dimension: row.dimension }); setErrors({}); setDialogOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setErrors({});
    try {
      const url = editing ? `/api/dimensions?id=${editing.id}` : "/api/dimensions";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
      const data = await res.json();
      if (!res.ok) { if (data.details) setErrors(data.details); else setErrors({ _form: data.error || "Failed to save" }); return; }
      setDialogOpen(false); fetchAll();
    } catch { setErrors({ _form: "Failed to save" }); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Deactivate this dimension?")) return;
    try { const res = await fetch(`/api/dimensions?id=${id}`, { method: "DELETE" }); if (res.ok) fetchAll(); }
    catch (err) { console.error(err); }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Dimensions</h1>
          <p className="text-muted-foreground mt-1">Units of measurement for inventory items</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={rows.length === 0}
            onClick={() => exportRowsToXlsx({ rows, columns: [{ key: "dimension" as any, label: "Dimension", visible: true }, { key: "is_active" as any, label: "Active", visible: true }], fileName: `dimensions_${new Date().toISOString().slice(0,10)}.xlsx`, sheetName: "Dimensions" })}>
            <Download className="h-4 w-4 mr-2" />Export XLSX
          </Button>
          <Button onClick={handleAdd}><Plus className="w-4 h-4 mr-2" />Add Dimension</Button>
        </div>
      </div>

      {loading ? <div className="text-center py-12">Loading…</div> : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dimension</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">No dimensions found.</TableCell></TableRow>
              ) : rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.dimension}</TableCell>
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
            <DialogTitle>{editing ? "Edit Dimension" : "Add Dimension"}</DialogTitle>
            <DialogDescription>{editing ? "Update dimension name" : "Enter the unit of measurement name"}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="dimension">Dimension *</Label>
                <Input id="dimension" placeholder="e.g., ცალი, მეტრი, კგ" value={formData.dimension}
                  onChange={(e) => setFormData({ dimension: e.target.value })}
                  className={errors.dimension ? "border-destructive" : ""} />
                {errors.dimension && <p className="text-sm text-destructive">{errors.dimension}</p>}
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
