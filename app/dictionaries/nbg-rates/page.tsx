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
import { Plus, Pencil, Trash2, Settings, Eye, EyeOff, RefreshCw } from "lucide-react";

interface NBGRate {
  id: number;
  uuid: string;
  date: string;
  usd?: number;
  eur?: number;
  cny?: number;
  gbp?: number;
  rub?: number;
  try?: number;
  aed?: number;
  kzt?: number;
}

type ColumnKey = 'date' | 'usd' | 'eur' | 'cny' | 'gbp' | 'rub' | 'try' | 'aed' | 'kzt';

type ColumnConfig = {
  key: ColumnKey;
  label: string;
  visible: boolean;
};

const defaultColumns: ColumnConfig[] = [
  { key: "date", label: "Date", visible: true },
  { key: "usd", label: "USD", visible: true },
  { key: "eur", label: "EUR", visible: true },
  { key: "gbp", label: "GBP", visible: true },
  { key: "rub", label: "RUB", visible: true },
  { key: "cny", label: "CNY", visible: false },
  { key: "try", label: "TRY", visible: false },
  { key: "aed", label: "AED", visible: false },
  { key: "kzt", label: "KZT", visible: false },
];

export default function NBGRatesPage() {
  const [rates, setRates] = useState<NBGRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Column visibility
  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Filtering and pagination
  const [searchDate, setSearchDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Add/Edit dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<NBGRate | null>(null);
  const [formData, setFormData] = useState({
    date: "",
    usd: "",
    eur: "",
    cny: "",
    gbp: "",
    rub: "",
    try: "",
    aed: "",
    kzt: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/exchange-rates");
      if (!response.ok) throw new Error("Failed to fetch rates");
      const data = await response.json();
      setRates(data);
      setError("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    setEditingRate(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      usd: "",
      eur: "",
      cny: "",
      gbp: "",
      rub: "",
      try: "",
      aed: "",
      kzt: "",
    });
    setFormErrors({});
    setIsDialogOpen(true);
  };

  const handleEdit = (rate: NBGRate) => {
    setEditingRate(rate);
    setFormData({
      date: rate.date,
      usd: rate.usd?.toString() || "",
      eur: rate.eur?.toString() || "",
      cny: rate.cny?.toString() || "",
      gbp: rate.gbp?.toString() || "",
      rub: rate.rub?.toString() || "",
      try: rate.try?.toString() || "",
      aed: rate.aed?.toString() || "",
      kzt: rate.kzt?.toString() || "",
    });
    setFormErrors({});
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this exchange rate record?")) return;

    try {
      const response = await fetch(`/api/exchange-rates?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete");
      }

      await fetchRates();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    try {
      const url = editingRate
        ? `/api/exchange-rates?id=${editingRate.id}`
        : "/api/exchange-rates";
      
      const method = editingRate ? "PATCH" : "POST";

      const payload: any = { date: formData.date };
      
      // Only include non-empty rates
      if (formData.usd) payload.usd = parseFloat(formData.usd);
      if (formData.eur) payload.eur = parseFloat(formData.eur);
      if (formData.cny) payload.cny = parseFloat(formData.cny);
      if (formData.gbp) payload.gbp = parseFloat(formData.gbp);
      if (formData.rub) payload.rub = parseFloat(formData.rub);
      if (formData.try) payload.try = parseFloat(formData.try);
      if (formData.aed) payload.aed = parseFloat(formData.aed);
      if (formData.kzt) payload.kzt = parseFloat(formData.kzt);

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.details) {
          setFormErrors(errorData.details);
        } else {
          throw new Error(errorData.error || "Failed to save");
        }
        return;
      }

      setIsDialogOpen(false);
      await fetchRates();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateFromNBG = async () => {
    if (!confirm("This will fetch the latest rates from NBG API. Continue?")) return;

    try {
      setLoading(true);
      const response = await fetch("/api/exchange-rates/update", {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update from NBG");
      }

      alert("Successfully updated rates from NBG API!");
      await fetchRates();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter rates based on search
  const filteredRates = rates.filter(rate => {
    if (!searchDate) return true;
    return rate.date.includes(searchDate);
  });

  // Pagination
  const totalPages = Math.ceil(filteredRates.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRates = filteredRates.slice(startIndex, startIndex + itemsPerPage);

  const visibleColumns = columns.filter(col => col.visible);

  const formatRate = (rate?: number) => {
    if (!rate) return "-";
    return rate.toFixed(6);
  };

  const formatDate = (dateString: string) => {
    // Convert yyyy-mm-dd to dd.mm.yyyy
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">NBG Exchange Rates</h1>
          <p className="text-gray-600 mt-1">
            National Bank of Georgia exchange rates (1 unit = X GEL)
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleUpdateFromNBG} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Update from NBG
          </Button>
          <Button onClick={handleAddNew}>
            <Plus className="h-4 w-4 mr-2" />
            Add Rate
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="flex gap-4 mb-4">
        <div className="flex-1">
          <Input
            type="date"
            placeholder="Search by date..."
            value={searchDate}
            onChange={(e) => {
              setSearchDate(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
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
              {columns.map((column) => (
                <div
                  key={column.key}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={column.key}
                      checked={column.visible}
                      onCheckedChange={(checked) => {
                        setColumns((cols) =>
                          cols.map((col) =>
                            col.key === column.key
                              ? { ...col, visible: !!checked }
                              : col
                          )
                        );
                      }}
                    />
                    <Label htmlFor={column.key}>{column.label}</Label>
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
              <Button onClick={() => setIsSettingsOpen(false)}>Done</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  {visibleColumns.map((col) => (
                    <TableHead key={col.key}>{col.label}</TableHead>
                  ))}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRates.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={visibleColumns.length + 1}
                      className="text-center py-8 text-gray-500"
                    >
                      No exchange rates found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRates.map((rate) => (
                    <TableRow key={rate.id}>
                      {visibleColumns.map((col) => (
                        <TableCell key={col.key}>
                          {col.key === 'date' ? formatDate(rate.date) : formatRate(rate[col.key])}
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(rate)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(rate.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="px-4 py-2 text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRate ? "Edit Exchange Rate" : "Add Exchange Rate"}
            </DialogTitle>
            <DialogDescription>
              Enter exchange rates (how many GEL = 1 unit of currency)
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  required
                />
                {formErrors.date && (
                  <p className="text-sm text-red-500 mt-1">{formErrors.date}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="usd">USD Rate</Label>
                  <Input
                    id="usd"
                    type="number"
                    step="0.000001"
                    placeholder="e.g., 2.7064"
                    value={formData.usd}
                    onChange={(e) =>
                      setFormData({ ...formData, usd: e.target.value })
                    }
                  />
                  {formErrors.usd && (
                    <p className="text-sm text-red-500 mt-1">{formErrors.usd}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="eur">EUR Rate</Label>
                  <Input
                    id="eur"
                    type="number"
                    step="0.000001"
                    placeholder="e.g., 3.1321"
                    value={formData.eur}
                    onChange={(e) =>
                      setFormData({ ...formData, eur: e.target.value })
                    }
                  />
                  {formErrors.eur && (
                    <p className="text-sm text-red-500 mt-1">{formErrors.eur}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="gbp">GBP Rate</Label>
                  <Input
                    id="gbp"
                    type="number"
                    step="0.000001"
                    placeholder="e.g., 3.5557"
                    value={formData.gbp}
                    onChange={(e) =>
                      setFormData({ ...formData, gbp: e.target.value })
                    }
                  />
                  {formErrors.gbp && (
                    <p className="text-sm text-red-500 mt-1">{formErrors.gbp}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="rub">RUB Rate</Label>
                  <Input
                    id="rub"
                    type="number"
                    step="0.000001"
                    placeholder="e.g., 0.033255"
                    value={formData.rub}
                    onChange={(e) =>
                      setFormData({ ...formData, rub: e.target.value })
                    }
                  />
                  {formErrors.rub && (
                    <p className="text-sm text-red-500 mt-1">{formErrors.rub}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="cny">CNY Rate</Label>
                  <Input
                    id="cny"
                    type="number"
                    step="0.000001"
                    placeholder="e.g., 0.38013"
                    value={formData.cny}
                    onChange={(e) =>
                      setFormData({ ...formData, cny: e.target.value })
                    }
                  />
                  {formErrors.cny && (
                    <p className="text-sm text-red-500 mt-1">{formErrors.cny}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="try">TRY Rate</Label>
                  <Input
                    id="try"
                    type="number"
                    step="0.000001"
                    placeholder="e.g., 0.0641"
                    value={formData.try}
                    onChange={(e) =>
                      setFormData({ ...formData, try: e.target.value })
                    }
                  />
                  {formErrors.try && (
                    <p className="text-sm text-red-500 mt-1">{formErrors.try}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="aed">AED Rate</Label>
                  <Input
                    id="aed"
                    type="number"
                    step="0.000001"
                    placeholder="e.g., 0.73694"
                    value={formData.aed}
                    onChange={(e) =>
                      setFormData({ ...formData, aed: e.target.value })
                    }
                  />
                  {formErrors.aed && (
                    <p className="text-sm text-red-500 mt-1">{formErrors.aed}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="kzt">KZT Rate</Label>
                  <Input
                    id="kzt"
                    type="number"
                    step="0.000001"
                    placeholder="e.g., 0.005153"
                    value={formData.kzt}
                    onChange={(e) =>
                      setFormData({ ...formData, kzt: e.target.value })
                    }
                  />
                  {formErrors.kzt && (
                    <p className="text-sm text-red-500 mt-1">{formErrors.kzt}</p>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingRate ? "Save Changes" : "Add Rate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
