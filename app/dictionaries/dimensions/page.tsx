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
import { Download, Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { exportRowsToXlsx } from "@/lib/export-xlsx";

interface Dimension {
  id: number;
  uuid: string;
  dimension: string;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
}

// RS unit texts from waybill items (rs_unit_dimension_map), shown as draggable chips.
interface UnitText {
  id: number;
  unit_text: string;
  dimension_uuid: string | null;
  is_active: boolean;
  item_count: number;
}

const UNIT_DRAG_TYPE = "application/x-rs-unit-id";

export default function DimensionsPage() {
  const [rows, setRows] = useState<Dimension[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Dimension | null>(null);
  const [formData, setFormData] = useState({ dimension: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // RS unit texts: drag a chip onto a dimension row to map (or remap) it. The database moves every
  // waybill item with that unit text to the dimension and redoes their inventory suggestions.
  const [units, setUnits] = useState<UnitText[]>([]);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [movingUnitId, setMovingUnitId] = useState<number | null>(null);

  const fetchUnits = async () => {
    try {
      const res = await fetch("/api/rs-unit-dimension-map");
      if (res.ok) {
        const result = await res.json();
        setUnits(Array.isArray(result?.data) ? result.data : []);
      }
    } catch (err) { console.error("Failed to fetch RS unit texts:", err); }
  };

  useEffect(() => { fetchAll(); fetchUnits(); }, []);

  const unmappedUnits = units.filter((u) => u.is_active && !u.dimension_uuid);
  const unitsByDimension = new Map<string, UnitText[]>();
  units.forEach((u) => {
    if (!u.dimension_uuid) return;
    const list = unitsByDimension.get(u.dimension_uuid) ?? [];
    list.push(u);
    unitsByDimension.set(u.dimension_uuid, list);
  });
  unitsByDimension.forEach((list) => list.sort((a, b) => b.item_count - a.item_count));

  const moveUnit = async (unitId: number, dimension: Dimension) => {
    const unit = units.find((u) => u.id === unitId);
    if (!unit || unit.dimension_uuid === dimension.uuid) return;
    if (unit.dimension_uuid) {
      const from = rows.find((r) => r.uuid === unit.dimension_uuid)?.dimension ?? "another dimension";
      const ok = confirm(
        `Move unit "${unit.unit_text}" (${unit.item_count} waybill items) from ${from} to ${dimension.dimension}?\n\n` +
        "Its items move to the new dimension and their pending inventory suggestions are redone. Items already bound to an inventory of the old dimension will show Unit Check = Mismatch."
      );
      if (!ok) return;
    }
    setMovingUnitId(unitId);
    try {
      const res = await fetch(`/api/rs-unit-dimension-map?id=${unitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dimension_uuid: dimension.uuid }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to map unit");
      setUnits((current) => current.map((u) => (u.id === unitId ? { ...u, dimension_uuid: dimension.uuid } : u)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to map unit");
    } finally {
      setMovingUnitId(null);
    }
  };

  const renderUnitChip = (unit: UnitText, unmapped = false) => (
    <span
      key={unit.id}
      draggable={movingUnitId === null}
      onDragStart={(e) => {
        e.dataTransfer.setData(UNIT_DRAG_TYPE, String(unit.id));
        e.dataTransfer.effectAllowed = "move";
      }}
      title={`${unit.item_count} waybill items with unit "${unit.unit_text}". Drag onto a dimension to map it.`}
      className={`inline-flex cursor-grab items-center gap-1 rounded-md border px-2 py-0.5 text-xs active:cursor-grabbing ${
        unmapped ? "border-amber-400 bg-amber-50 text-amber-900" : "bg-background"
      } ${movingUnitId === unit.id ? "opacity-50" : ""}`}
    >
      <GripVertical className="h-3 w-3 opacity-40" />
      <span className="font-medium">{unit.unit_text}</span>
      <span className="text-muted-foreground">{unit.item_count}</span>
    </span>
  );

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

      <div className="mb-4 rounded-lg border p-3">
        <div className="mb-2 text-sm font-medium">
          Unmapped RS units{unmappedUnits.length > 0 ? ` (${unmappedUnits.length})` : ""}
        </div>
        {unmappedUnits.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Every RS unit text from waybill items is mapped. Drag a chip from the Matched RS Units column onto another dimension to remap it.
          </p>
        ) : (
          <>
            <p className="mb-2 text-sm text-muted-foreground">
              Waybill items with these units have no dimension, so no inventory can be bound to them. Drag each chip onto its dimension below.
            </p>
            <div className="flex flex-wrap gap-2">{unmappedUnits.map((u) => renderUnitChip(u, true))}</div>
          </>
        )}
      </div>

      {loading ? <div className="text-center py-12">Loading…</div> : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dimension</TableHead>
                <TableHead>Matched RS Units</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No dimensions found.</TableCell></TableRow>
              ) : rows.map((row) => (
                <TableRow
                  key={row.id}
                  onDragOver={(e) => {
                    if (!row.is_active || !e.dataTransfer.types.includes(UNIT_DRAG_TYPE)) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dropTarget !== row.uuid) setDropTarget(row.uuid);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDropTarget(null);
                    const unitId = Number(e.dataTransfer.getData(UNIT_DRAG_TYPE));
                    if (unitId) void moveUnit(unitId, row);
                  }}
                  className={dropTarget === row.uuid ? "bg-primary/10 outline outline-2 outline-primary" : ""}
                >
                  <TableCell className="font-medium">{row.dimension}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(unitsByDimension.get(row.uuid) ?? []).map((u) => renderUnitChip(u))}
                    </div>
                  </TableCell>
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
