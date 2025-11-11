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
import { Plus, Pencil, Trash2, Settings, Eye, EyeOff } from "lucide-react";

interface Currency {
  id: number;
  uuid: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type ColumnConfig = {
  key: keyof Currency;
  label: string;
  visible: boolean;
};

const defaultColumns: ColumnConfig[] = [
  { key: "code", label: "Code", visible: true },
  { key: "name", label: "Name", visible: true },
  { key: "isActive", label: "Status", visible: true },
  { key: "createdAt", label: "Created", visible: true },
];

export default function CurrenciesPage() {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);
  const [formData, setFormData] = useState({ code: "", name: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    fetchCurrencies();
  }, []);

  const fetchCurrencies = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/currencies");
      if (response.ok) {
        const data = await response.json();
        setCurrencies(data);
      }
    } catch (error) {
      console.error("Failed to fetch currencies:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingCurrency(null);
    setFormData({ code: "", name: "" });
    setErrors({});
    setDialogOpen(true);
  };

  const handleEdit = (currency: Currency) => {
    setEditingCurrency(currency);
    setFormData({ code: currency.code, name: currency.name });
    setErrors({});
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});

    try {
      const url = editingCurrency
        ? `/api/currencies?id=${editingCurrency.id}`
        : "/api/currencies";
      const method = editingCurrency ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.details) {
          setErrors(data.details);
        } else {
          setErrors({ _form: data.error || "Failed to save currency" });
        }
        return;
      }

      setDialogOpen(false);
      fetchCurrencies();
    } catch (error) {
      console.error("Failed to save currency:", error);
      setErrors({ _form: "Failed to save currency" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to deactivate this currency?")) return;

    try {
      const response = await fetch(`/api/currencies?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchCurrencies();
      }
    } catch (error) {
      console.error("Failed to delete currency:", error);
    }
  };

  const visibleColumns = columns.filter(col => col.visible);

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Currencies</h1>
          <p className="text-muted-foreground mt-1">
            Manage currency codes and names
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Columns
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Column Settings</DialogTitle>
                <DialogDescription>
                  Configure which columns to show and their visibility.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {columns.map(column => (
                  <div key={column.key} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`col-${column.key}`}
                        checked={column.visible}
                        onCheckedChange={(checked) => {
                          setColumns(cols => cols.map(col =>
                            col.key === column.key
                              ? { ...col, visible: checked as boolean }
                              : col
                          ));
                        }}
                      />
                      <Label htmlFor={`col-${column.key}`} className="text-sm">
                        {column.label}
                      </Label>
                    </div>
                    {column.visible ? (
                      <Eye className="h-4 w-4 text-green-600" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setColumns(defaultColumns);
                    setIsSettingsOpen(false);
                  }}
                >
                  Reset
                </Button>
                <Button onClick={() => setIsSettingsOpen(false)}>
                  Done
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Add Currency
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading currencies...</div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumns.map(col => col.key === "code" && (
                  <TableHead key="code">Code</TableHead>
                ))}
                {visibleColumns.map(col => col.key === "name" && (
                  <TableHead key="name">Name</TableHead>
                ))}
                {visibleColumns.map(col => col.key === "isActive" && (
                  <TableHead key="isActive">Status</TableHead>
                ))}
                {visibleColumns.map(col => col.key === "createdAt" && (
                  <TableHead key="createdAt">Created</TableHead>
                ))}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currencies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    No currencies found. Click "Add Currency" to create one.
                  </TableCell>
                </TableRow>
              ) : (
                currencies.map((currency) => (
                  <TableRow key={currency.id}>
                    {visibleColumns.some(col => col.key === "code") && (
                      <TableCell className="font-mono font-semibold">
                        {currency.code}
                      </TableCell>
                    )}
                    {visibleColumns.some(col => col.key === "name") && (
                      <TableCell>{currency.name}</TableCell>
                    )}
                    {visibleColumns.some(col => col.key === "isActive") && (
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            currency.isActive
                              ? "bg-success text-success-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {currency.isActive ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                    )}
                    {visibleColumns.some(col => col.key === "createdAt") && (
                      <TableCell className="text-sm text-muted-foreground">
                        {currency.createdAt}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(currency)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(currency.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCurrency ? "Edit Currency" : "Add Currency"}
            </DialogTitle>
            <DialogDescription>
              {editingCurrency
                ? "Update currency information"
                : "Enter the 3-letter currency code and name"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="code">Currency Code *</Label>
                <Input
                  id="code"
                  placeholder="USD"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                  maxLength={3}
                  className={errors.code ? "border-destructive" : ""}
                />
                {errors.code && (
                  <p className="text-sm text-destructive">{errors.code}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  3-letter code (e.g., USD, EUR, GBP)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Currency Name *</Label>
                <Input
                  id="name"
                  placeholder="US Dollar"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              {errors._form && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded">
                  {errors._form}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : editingCurrency ? "Update" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
