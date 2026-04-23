"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Plus, Trash2 } from "lucide-react";

type DocumentType = {
  id: string;
  uuid: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function DocumentTypesPage() {
  const [rows, setRows] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentType | null>(null);
  const [formName, setFormName] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = showInactive
        ? "/api/document-types?includeInactive=true"
        : "/api/document-types";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to fetch");
      setRows(data.documentTypes || []);
    } catch (e: any) {
      setError(e?.message || "Failed to fetch document types");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  const openAdd = () => {
    setEditing(null);
    setFormName("");
    setFormActive(true);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (row: DocumentType) => {
    setEditing(row);
    setFormName(row.name);
    setFormActive(row.isActive);
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
            body: JSON.stringify({ name, isActive: formActive }),
          })
        : await fetch(`/api/document-types`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, isActive: formActive }),
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
      const res = await fetch(`/api/document-types/${row.uuid}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      if (data?.deactivated) {
        alert(data.message || "Document type deactivated.");
      }
      await fetchRows();
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    }
  };

  return (
    <div className="container mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Document Types</h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={showInactive}
              onCheckedChange={(v) => setShowInactive(v === true)}
            />
            Show inactive
          </label>
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" /> Add Document Type
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Name</th>
              <th className="px-4 py-2 text-left font-medium w-32">Status</th>
              <th className="px-4 py-2 text-left font-medium w-48">Updated</th>
              <th className="px-4 py-2 text-right font-medium w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  No document types found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.uuid} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="px-4 py-2">{row.name}</td>
                  <td className="px-4 py-2">
                    {row.isActive ? (
                      <span className="inline-block rounded-full bg-green-100 text-green-800 px-2 py-0.5 text-xs">
                        Active
                      </span>
                    ) : (
                      <span className="inline-block rounded-full bg-gray-200 text-gray-700 px-2 py-0.5 text-xs">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {new Date(row.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(row)}
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(row)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
            {formError && (
              <div className="text-sm text-red-600">{formError}</div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
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
