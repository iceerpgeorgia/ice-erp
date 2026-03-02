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

interface WaybillItem {
  id: number;
  uuid: string;
  waybill_no: string | null;
  goods_code: string | null;
  goods_name: string | null;
  unit: string | null;
  quantity: number | null;
  unit_price: number | null;
  total_price: number | null;
  taxation: string | null;
  inventory_uuid: string | null;
  inventory_name: string;
  project_uuid: string | null;
  financial_code_uuid: string | null;
  corresponding_account: string | null;
  import_batch_id: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Option { uuid: string; label: string; }

const emptyForm = {
  waybill_no: "", goods_code: "", goods_name: "", unit: "",
  quantity: "", unit_price: "", total_price: "", taxation: "",
  inventory_uuid: "", project_uuid: "", financial_code_uuid: "",
  corresponding_account: "",
};

export default function WaybillItemsPage() {
  const [rows, setRows] = useState<WaybillItem[]>([]);
  const [inventories, setInventories] = useState<Option[]>([]);
  const [projects, setProjects] = useState<Option[]>([]);
  const [finCodes, setFinCodes] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WaybillItem | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchAll(); fetchLookups(); }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/waybill-items");
      if (res.ok) { const r = await res.json(); setRows(Array.isArray(r?.data) ? r.data : []); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchLookups = async () => {
    try {
      const [iRes, pRes, fRes] = await Promise.all([
        fetch("/api/inventories"),
        fetch("/api/projects"),
        fetch("/api/financial-codes"),
      ]);
      if (iRes.ok) {
        const r = await iRes.json();
        setInventories((Array.isArray(r?.data) ? r.data : []).filter((x: any) => x.is_active !== false).map((x: any) => ({ uuid: x.uuid, label: x.name })));
      }
      if (pRes.ok) {
        const r = await pRes.json();
        const list = Array.isArray(r?.data) ? r.data : [];
        setProjects(list.filter((x: any) => x.is_active !== false).map((x: any) => ({ uuid: x.uuid, label: x.name || x.project_name || x.uuid })));
      }
      if (fRes.ok) {
        const r = await fRes.json();
        const list = Array.isArray(r?.data) ? r.data : [];
        setFinCodes(list.filter((x: any) => x.is_active !== false).map((x: any) => ({ uuid: x.uuid, label: x.code ? `${x.code} — ${x.name || ""}` : x.name || x.uuid })));
      }
    } catch (err) { console.error(err); }
  };

  const handleAdd = () => { setEditing(null); setFormData({ ...emptyForm }); setErrors({}); setDialogOpen(true); };
  const handleEdit = (row: WaybillItem) => {
    setEditing(row);
    setFormData({
      waybill_no: row.waybill_no || "",
      goods_code: row.goods_code || "",
      goods_name: row.goods_name || "",
      unit: row.unit || "",
      quantity: row.quantity != null ? String(row.quantity) : "",
      unit_price: row.unit_price != null ? String(row.unit_price) : "",
      total_price: row.total_price != null ? String(row.total_price) : "",
      taxation: row.taxation || "",
      inventory_uuid: row.inventory_uuid || "",
      project_uuid: row.project_uuid || "",
      financial_code_uuid: row.financial_code_uuid || "",
      corresponding_account: row.corresponding_account || "",
    });
    setErrors({});
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setErrors({});
    try {
      const url = editing ? `/api/waybill-items?id=${editing.id}` : "/api/waybill-items";
      const method = editing ? "PATCH" : "POST";
      const payload = {
        waybill_no: formData.waybill_no || null,
        goods_code: formData.goods_code || null,
        goods_name: formData.goods_name || null,
        unit: formData.unit || null,
        quantity: formData.quantity || null,
        unit_price: formData.unit_price || null,
        total_price: formData.total_price || null,
        taxation: formData.taxation || null,
        inventory_uuid: formData.inventory_uuid || null,
        project_uuid: formData.project_uuid || null,
        financial_code_uuid: formData.financial_code_uuid || null,
        corresponding_account: formData.corresponding_account || null,
      };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { if (data.details) setErrors(data.details); else setErrors({ _form: data.error || "Failed to save" }); return; }
      setDialogOpen(false); fetchAll();
    } catch { setErrors({ _form: "Failed to save" }); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this waybill item? This action cannot be undone.")) return;
    try { const res = await fetch(`/api/waybill-items?id=${id}`, { method: "DELETE" }); if (res.ok) fetchAll(); }
    catch (err) { console.error(err); }
  };

  const fmtNum = (v: number | null) => v != null ? v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "";
  const selectCls = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Waybill Items</h1>
          <p className="text-muted-foreground mt-1">RS Waybill incoming items</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={rows.length === 0}
            onClick={() => exportRowsToXlsx({ rows, columns: [
              { key: "waybill_no" as any, label: "Waybill #", visible: true },
              { key: "goods_code" as any, label: "Code", visible: true },
              { key: "goods_name" as any, label: "Name", visible: true },
              { key: "unit" as any, label: "Unit", visible: true },
              { key: "quantity" as any, label: "Qty", visible: true },
              { key: "unit_price" as any, label: "Unit Price", visible: true },
              { key: "total_price" as any, label: "Total", visible: true },
              { key: "taxation" as any, label: "Tax", visible: true },
              { key: "inventory_name" as any, label: "Inventory", visible: true },
              { key: "corresponding_account" as any, label: "Account", visible: true },
            ], fileName: `waybill_items_${new Date().toISOString().slice(0,10)}.xlsx`, sheetName: "Waybill Items" })}>
            <Download className="h-4 w-4 mr-2" />Export XLSX
          </Button>
          <Button onClick={handleAdd}><Plus className="w-4 h-4 mr-2" />Add Item</Button>
        </div>
      </div>

      {loading ? <div className="text-center py-12">Loading…</div> : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waybill #</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Tax</TableHead>
                <TableHead>Inventory</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">No waybill items found.</TableCell></TableRow>
              ) : rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.waybill_no}</TableCell>
                  <TableCell>{row.goods_code}</TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">{row.goods_name}</TableCell>
                  <TableCell>{row.unit}</TableCell>
                  <TableCell className="text-right">{fmtNum(row.quantity)}</TableCell>
                  <TableCell className="text-right">{fmtNum(row.unit_price)}</TableCell>
                  <TableCell className="text-right font-medium">{fmtNum(row.total_price)}</TableCell>
                  <TableCell>{row.taxation}</TableCell>
                  <TableCell className="max-w-[150px] truncate">{row.inventory_name}</TableCell>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Waybill Item" : "Add Waybill Item"}</DialogTitle>
            <DialogDescription>{editing ? "Update item details" : "Create a new waybill item"}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="waybill_no">Waybill No</Label>
                  <Input id="waybill_no" value={formData.waybill_no}
                    onChange={(e) => setFormData({ ...formData, waybill_no: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goods_code">Goods Code</Label>
                  <Input id="goods_code" value={formData.goods_code}
                    onChange={(e) => setFormData({ ...formData, goods_code: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="goods_name">Goods Name *</Label>
                <Input id="goods_name" value={formData.goods_name}
                  onChange={(e) => setFormData({ ...formData, goods_name: e.target.value })}
                  className={errors.goods_name ? "border-destructive" : ""} />
                {errors.goods_name && <p className="text-sm text-destructive">{errors.goods_name}</p>}
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Input id="unit" value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input id="quantity" type="number" step="any" value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit_price">Unit Price</Label>
                  <Input id="unit_price" type="number" step="any" value={formData.unit_price}
                    onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total_price">Total Price</Label>
                  <Input id="total_price" type="number" step="any" value={formData.total_price}
                    onChange={(e) => setFormData({ ...formData, total_price: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="taxation">Taxation</Label>
                  <Input id="taxation" value={formData.taxation}
                    onChange={(e) => setFormData({ ...formData, taxation: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="corresponding_account">Corresponding Account</Label>
                  <Input id="corresponding_account" value={formData.corresponding_account}
                    onChange={(e) => setFormData({ ...formData, corresponding_account: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="inventory_uuid">Inventory</Label>
                <select id="inventory_uuid" value={formData.inventory_uuid}
                  onChange={(e) => setFormData({ ...formData, inventory_uuid: e.target.value })}
                  className={selectCls}>
                  <option value="">— None —</option>
                  {inventories.map((i) => <option key={i.uuid} value={i.uuid}>{i.label}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="project_uuid">Project</Label>
                  <select id="project_uuid" value={formData.project_uuid}
                    onChange={(e) => setFormData({ ...formData, project_uuid: e.target.value })}
                    className={selectCls}>
                    <option value="">— None —</option>
                    {projects.map((p) => <option key={p.uuid} value={p.uuid}>{p.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="financial_code_uuid">Financial Code</Label>
                  <select id="financial_code_uuid" value={formData.financial_code_uuid}
                    onChange={(e) => setFormData({ ...formData, financial_code_uuid: e.target.value })}
                    className={selectCls}>
                    <option value="">— None —</option>
                    {finCodes.map((f) => <option key={f.uuid} value={f.uuid}>{f.label}</option>)}
                  </select>
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
