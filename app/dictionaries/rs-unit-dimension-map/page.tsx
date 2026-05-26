"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Pencil, Check, X, RefreshCw } from "lucide-react";

interface UnitMap {
  id: number;
  uuid: string;
  unit_text: string;
  dimension_uuid: string | null;
  dimension_name: string | null;
  is_active: boolean;
  item_count: number;
  updatedAt: string;
}

interface Dimension {
  id: number;
  uuid: string;
  dimension: string;
  is_active: boolean;
}

export default function RsUnitDimensionMapPage() {
  const [rows, setRows] = useState<UnitMap[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/rs-unit-dimension-map").then((r) => r.json()),
      fetch("/api/dimensions").then((r) => r.json()),
    ]).then(([mapRes, dimRes]) => {
      setRows(Array.isArray(mapRes?.data) ? mapRes.data : []);
      setDimensions(Array.isArray(dimRes?.data) ? dimRes.data.filter((d: Dimension) => d.is_active) : []);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const UNLINKED = "__none__";

  const startEdit = (row: UnitMap) => {
    setEditingId(row.id);
    setEditValue(row.dimension_uuid ?? UNLINKED);
  };

  const cancelEdit = () => { setEditingId(null); setEditValue(""); };

  const saveEdit = async (row: UnitMap) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/rs-unit-dimension-map?id=${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dimension_uuid: editValue === UNLINKED ? null : editValue }),
      });
      if (!res.ok) throw new Error("Failed");
      const updated = await res.json();
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...updated } : r)));
      setEditingId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const syncFromItems = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/rs-unit-dimension-map", { method: "POST" });
      const data = await res.json();
      if (data.added > 0) {
        setSyncMsg(`Added ${data.added} new unit text(s): ${data.new_texts?.join(", ")}`);
        load();
      } else {
        setSyncMsg("Already up to date — no new unit texts found.");
      }
    } catch (e) {
      setSyncMsg("Sync failed.");
      console.error(e);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Unit Text → Dimension Mapping</h1>
          <p className="text-muted-foreground mt-1">
            Maps unique unit text values from RS.ge waybill items to internal dimension records.
            Bind each text manually using the edit button.
          </p>
        </div>
        <Button variant="outline" onClick={syncFromItems} disabled={syncing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync from items"}
        </Button>
      </div>

      {syncMsg && (
        <div className="mb-4 text-sm px-4 py-2 rounded border bg-muted">{syncMsg}</div>
      )}

      {loading ? (
        <div className="text-center py-12">Loading…</div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit Text</TableHead>
                <TableHead>Mapped Dimension</TableHead>
                <TableHead className="text-right w-24">Items</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    No entries found. Click &quot;Sync from items&quot; to populate.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} className={!row.is_active ? "opacity-50" : ""}>
                    <TableCell className="font-medium">{row.unit_text}</TableCell>
                    <TableCell>
                      {editingId === row.id ? (
                        <Select value={editValue} onValueChange={setEditValue}>
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="— unlinked —" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={UNLINKED}>— unlinked —</SelectItem>
                            {dimensions.map((d) => (
                              <SelectItem key={d.uuid} value={d.uuid}>
                                {d.dimension}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={row.dimension_name ? "font-medium" : "text-muted-foreground italic"}>
                          {row.dimension_name ?? "— unlinked —"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {row.item_count > 0 ? row.item_count.toLocaleString() : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.updatedAt}</TableCell>
                    <TableCell className="text-right">
                      {editingId === row.id ? (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => saveEdit(row)} disabled={saving}>
                            <Check className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>
                            <X className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => startEdit(row)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
