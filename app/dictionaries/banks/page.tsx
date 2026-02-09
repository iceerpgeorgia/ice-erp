"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Plus, Pencil, Trash2, Settings } from "lucide-react";
import { exportRowsToXlsx } from "@/lib/export-xlsx";

interface Bank {
  id: number;
  uuid: string;
  bankName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type ColumnConfig = {
  key: keyof Bank;
  label: string;
  visible: boolean;
};

const defaultColumns: ColumnConfig[] = [
  { key: "bankName", label: "Bank Name", visible: true },
  { key: "isActive", label: "Status", visible: true },
  { key: "createdAt", label: "Created", visible: true },
];

export default function BanksPage() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isColumnDialogOpen, setIsColumnDialogOpen] = useState(false);
  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);
  const [formData, setFormData] = useState({
    bankName: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchBanks();
  }, []);

  const fetchBanks = async () => {
    try {
      const response = await fetch("/api/banks");
      if (!response.ok) throw new Error("Failed to fetch banks");
      const data = await response.json();
      setBanks(data);
    } catch (error) {
      console.error("Error fetching banks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = isEditMode
        ? `/api/banks/${editingId}`
        : "/api/banks";
      const method = isEditMode ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to save bank");

      await fetchBanks();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error saving bank:", error);
    }
  };

  const handleEdit = (bank: Bank) => {
    setFormData({
      bankName: bank.bankName,
    });
    setEditingId(bank.uuid);
    setIsEditMode(true);
    setIsDialogOpen(true);
  };

  const handleDelete = async (uuid: string) => {
    if (!confirm("Are you sure you want to delete this bank?")) return;

    try {
      const response = await fetch(`/api/banks/${uuid}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete bank");

      await fetchBanks();
    } catch (error) {
      console.error("Error deleting bank:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      bankName: "",
    });
    setEditingId(null);
    setIsEditMode(false);
  };

  const toggleColumnVisibility = (key: keyof Bank) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.key === key ? { ...col, visible: !col.visible } : col
      )
    );
  };

  const handleExportXlsx = () => {
    const fileName = `banks_${new Date().toISOString().slice(0, 10)}.xlsx`;
    exportRowsToXlsx({
      rows: banks,
      columns,
      fileName,
      sheetName: "Banks",
    });
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Banks</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportXlsx} disabled={!banks.length}>
            <Download className="mr-2 h-4 w-4" />
            Export XLSX
          </Button>
          <Dialog open={isColumnDialogOpen} onOpenChange={setIsColumnDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Column Settings</DialogTitle>
                <DialogDescription>
                  Show or hide table columns
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {columns.map((column) => (
                  <div key={column.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={column.key}
                      checked={column.visible}
                      onCheckedChange={() => toggleColumnVisibility(column.key)}
                    />
                    <label
                      htmlFor={column.key}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {column.label}
                    </label>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Bank
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {isEditMode ? "Edit Bank" : "Add New Bank"}
                  </DialogTitle>
                  <DialogDescription>
                    {isEditMode
                      ? "Update the bank details"
                      : "Enter the details for the new bank"}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="bankName">Bank Name *</Label>
                    <Input
                      id="bankName"
                      value={formData.bankName}
                      onChange={(e) =>
                        setFormData({ ...formData, bankName: e.target.value })
                      }
                      placeholder="Enter bank name"
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    {isEditMode ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(
                (column) =>
                  column.visible && (
                    <TableHead key={column.key}>{column.label}</TableHead>
                  )
              )}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {banks.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.filter((c) => c.visible).length + 1}
                  className="text-center text-muted-foreground"
                >
                  No banks found. Add your first bank to get started.
                </TableCell>
              </TableRow>
            ) : (
              banks.map((bank) => (
                <TableRow key={bank.uuid}>
                  {columns.map((column) => {
                    if (!column.visible) return null;

                    let cellContent: React.ReactNode;

                    switch (column.key) {
                      case "bankName":
                        cellContent = bank.bankName;
                        break;
                      case "isActive":
                        cellContent = (
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              bank.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {bank.isActive ? "Active" : "Inactive"}
                          </span>
                        );
                        break;
                      case "createdAt":
                        cellContent = new Date(
                          bank.createdAt
                        ).toLocaleDateString();
                        break;
                      default:
                        cellContent = String(bank[column.key] ?? "");
                    }

                    return <TableCell key={column.key}>{cellContent}</TableCell>;
                  })}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(bank)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(bank.uuid)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
