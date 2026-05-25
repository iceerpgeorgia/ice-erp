"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, Plus, Pencil, Trash2, Search, X, ExternalLink } from "lucide-react";
import { exportRowsToXlsx } from "@/lib/export-xlsx";

interface WaybillItem {
  id: number;
  uuid: string;
  rs_id: string | null;
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
  rs_id: "", waybill_no: "", goods_code: "", goods_name: "", unit: "",
  quantity: "", unit_price: "", total_price: "", taxation: "",
  inventory_uuid: "", project_uuid: "", financial_code_uuid: "",
  corresponding_account: "",
};

export default function WaybillItemsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlRsId = searchParams.get("rs_id") ?? "";

  const [rows, setRows] = useState<WaybillItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const LIMIT = 200;
  const [inventories, setInventories] = useState<Option[]>([]);
  const [projects, setProjects] = useState<Option[]>([]);
  const [finCodes, setFinCodes] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(urlRsId);
  const [searchInput, setSearchInput] = useState(urlRsId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WaybillItem | null>(null);
  const [formData, setFormData] = useState({ ...emptyForm, rs_id: urlRsId });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchAll(1, search); fetchLookups(); }, []);

  const fetchAll = async (p = 1, q = "") => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (q) params.set("q", q);
      const res = await fetch(`/api/waybill-items?${params}`);
      if (res.ok) {
        const r = await res.json();
        setRows(Array.isArray(r?.data) ? r.data : []);
        setTotal(r?.total ?? 0);
        setPage(r?.page ?? 1);
        setPages(r?.pages ?? 1);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSearch = () => {
    setSearch(searchInput);
    fetchAll(1, searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearch("");
    fetchAll(1, "");
    router.replace("/dictionaries/waybill-items");
  };

  const filteredRows = rows; // server-side now

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

  const handleAdd = () => { setEditing(null); setFormData({ ...emptyForm, rs_id: search }); setErrors({}); setDialogOpen(true); };
  const handleEdit = (row: WaybillItem) => {
    setEditing(row);
    setFormData({
      rs_id: row.rs_id || "",
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
        rs_id: formData.rs_id || null,
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
      setDialogOpen(false); fetchAll(page, search);
    } catch { setErrors({ _form: "Failed to save" }); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this waybill item? This action cannot be undone.")) return;
    try { const res = await fetch(`/api/waybill-items?id=${id}`, { method: "DELETE" }); if (res.ok) fetchAll(page, search); }
    catch (err) { console.error(err); }
  };

  const fmtNum = (v: number | null) => v != null ? v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "";
  const selectCls = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Waybill Items</h1>
          <p className="text-muted-foreground mt-1">
            RS waybill incoming items
            {search && <span className="ml-1">— filtered by <span className="font-mono text-foreground">{search}</span></span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={filteredRows.length === 0}
            onClick={() => exportRowsToXlsx({ rows: filteredRows, columns: [
              { key: "rs_id" as any, label: "RS ID", visible: true },
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

      {/* Search / filter bar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by RS ID, waybill #, name, code…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            className="pl-8 pr-8"
          />
          {searchInput && (
            <button
              className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
              onClick={handleClearSearch}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button size="sm" onClick={handleSearch} disabled={loading}>Search</Button>
        <span className="text-sm text-muted-foreground">
          {total > 0 ? `Showing ${rows.length} of ${total.toLocaleString()} rows` : "No results"}
        </span>
        {search && (
          <Button variant="outline" size="sm" asChild>
            <a href="/dictionaries/waybills">
              <ExternalLink className="h-3 w-3 mr-1" />Waybills
            </a>
          </Button>
        )}
      </div>

      {loading ? <div className="text-center py-12">Loading…</div> : (
        <>
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>RS ID</TableHead>
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
              {filteredRows.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                  {rows.length === 0 ? "No waybill items found." : "No items match the filter."}
                </TableCell></TableRow>
              ) : filteredRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">
                    {row.rs_id ? (
                      <button
                        className="text-blue-600 hover:underline"
                        onClick={() => { setSearchInput(row.rs_id!); setSearch(row.rs_id!); fetchAll(1, row.rs_id!); }}
                      >{row.rs_id}</button>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs">{row.waybill_no ?? <span className="text-muted-foreground">—</span>}</TableCell>
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
        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => fetchAll(page - 1, search)}>← Prev</Button>
            <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
            <Button variant="outline" size="sm" disabled={page >= pages || loading} onClick={() => fetchAll(page + 1, search)}>Next →</Button>
          </div>
        )}
        </>
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
                  <Label htmlFor="rs_id">RS ID</Label>
                  <Input id="rs_id" value={formData.rs_id}
                    onChange={(e) => setFormData({ ...formData, rs_id: e.target.value })}
                    placeholder="From rs_waybills_in_api" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="waybill_no">Waybill No</Label>
                  <Input id="waybill_no" value={formData.waybill_no}
                    onChange={(e) => setFormData({ ...formData, waybill_no: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="goods_name">Goods Name *</Label>
                <Input id="goods_name" value={formData.goods_name}
                  onChange={(e) => setFormData({ ...formData, goods_name: e.target.value })}
                  className={errors.goods_name ? "border-destructive" : ""} />
                {errors.goods_name && <p className="text-sm text-destructive">{errors.goods_name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="goods_code">Goods Code</Label>
                <Input id="goods_code" value={formData.goods_code}
                  onChange={(e) => setFormData({ ...formData, goods_code: e.target.value })} />
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
