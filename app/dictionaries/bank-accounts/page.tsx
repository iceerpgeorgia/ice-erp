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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Settings, Eye, EyeOff } from "lucide-react";

interface BankAccount {
  id: number;
  uuid: string;
  accountNumber: string;
  currencyUuid: string;
  currencyCode?: string;
  currencyName?: string;
  bankUuid?: string;
  bankName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Currency {
  uuid: string;
  code: string;
  name: string;
}

interface Bank {
  uuid: string;
  bankName: string;
}

type ColumnConfig = {
  key: keyof BankAccount;
  label: string;
  visible: boolean;
};

const defaultColumns: ColumnConfig[] = [
  { key: "accountNumber", label: "Account Number", visible: true },
  { key: "bankName", label: "Bank", visible: true },
  { key: "currencyCode", label: "Currency", visible: true },
  { key: "isActive", label: "Status", visible: true },
  { key: "createdAt", label: "Created", visible: true },
];

export default function BankAccountsPage() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isColumnDialogOpen, setIsColumnDialogOpen] = useState(false);
  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);
  const [formData, setFormData] = useState({
    accountNumber: "",
    currencyUuid: "",
    bankUuid: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchBankAccounts();
    fetchCurrencies();
    fetchBanks();
  }, []);

  const fetchBankAccounts = async () => {
    try {
      const response = await fetch("/api/bank-accounts");
      if (!response.ok) throw new Error("Failed to fetch bank accounts");
      const data = await response.json();
      setBankAccounts(data);
    } catch (error) {
      console.error("Error fetching bank accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrencies = async () => {
    try {
      const response = await fetch("/api/currencies");
      if (!response.ok) throw new Error("Failed to fetch currencies");
      const data = await response.json();
      setCurrencies(data.filter((c: Currency & { isActive: boolean }) => c.isActive));
    } catch (error) {
      console.error("Error fetching currencies:", error);
    }
  };

  const fetchBanks = async () => {
    try {
      const response = await fetch("/api/banks");
      if (!response.ok) throw new Error("Failed to fetch banks");
      const data = await response.json();
      setBanks(data.filter((b: Bank & { isActive: boolean }) => b.isActive));
    } catch (error) {
      console.error("Error fetching banks:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = isEditMode
        ? `/api/bank-accounts/${editingId}`
        : "/api/bank-accounts";
      const method = isEditMode ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to save bank account");

      await fetchBankAccounts();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error saving bank account:", error);
    }
  };

  const handleEdit = (account: BankAccount) => {
    setFormData({
      accountNumber: account.accountNumber,
      currencyUuid: account.currencyUuid,
      bankUuid: account.bankUuid || "",
    });
    setEditingId(account.uuid);
    setIsEditMode(true);
    setIsDialogOpen(true);
  };

  const handleDelete = async (uuid: string) => {
    if (!confirm("Are you sure you want to delete this bank account?")) return;

    try {
      const response = await fetch(`/api/bank-accounts/${uuid}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete bank account");

      await fetchBankAccounts();
    } catch (error) {
      console.error("Error deleting bank account:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      accountNumber: "",
      currencyUuid: "",
      bankUuid: "",
    });
    setEditingId(null);
    setIsEditMode(false);
  };

  const toggleColumnVisibility = (key: keyof BankAccount) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.key === key ? { ...col, visible: !col.visible } : col
      )
    );
  };

  const getCurrencyDisplay = (account: BankAccount) => {
    return account.currencyCode || account.currencyUuid;
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Bank Accounts</h1>
        <div className="flex gap-2">
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
                Add Bank Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {isEditMode ? "Edit Bank Account" : "Add New Bank Account"}
                  </DialogTitle>
                  <DialogDescription>
                    {isEditMode
                      ? "Update the bank account details"
                      : "Enter the details for the new bank account"}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="accountNumber">Account Number *</Label>
                    <Input
                      id="accountNumber"
                      value={formData.accountNumber}
                      onChange={(e) =>
                        setFormData({ ...formData, accountNumber: e.target.value })
                      }
                      placeholder="Enter account number"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="bankUuid">Bank</Label>
                    <Select
                      value={formData.bankUuid}
                      onValueChange={(value) =>
                        setFormData({ ...formData, bankUuid: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select bank (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {banks.map((bank) => (
                          <SelectItem key={bank.uuid} value={bank.uuid}>
                            {bank.bankName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="currencyUuid">Currency *</Label>
                    <Select
                      value={formData.currencyUuid}
                      onValueChange={(value) =>
                        setFormData({ ...formData, currencyUuid: value })
                      }
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((currency) => (
                          <SelectItem key={currency.uuid} value={currency.uuid}>
                            {currency.code} - {currency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
            {bankAccounts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.filter((c) => c.visible).length + 1}
                  className="text-center text-muted-foreground"
                >
                  No bank accounts found. Add your first bank account to get started.
                </TableCell>
              </TableRow>
            ) : (
              bankAccounts.map((account) => (
                <TableRow key={account.uuid}>
                  {columns.map((column) => {
                    if (!column.visible) return null;

                    let cellContent: React.ReactNode;

                    switch (column.key) {
                      case "accountNumber":
                        cellContent = account.accountNumber;
                        break;
                      case "bankName":
                        cellContent = account.bankName || "-";
                        break;
                      case "currencyCode":
                        cellContent = getCurrencyDisplay(account);
                        break;
                      case "isActive":
                        cellContent = (
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              account.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {account.isActive ? "Active" : "Inactive"}
                          </span>
                        );
                        break;
                      case "createdAt":
                        cellContent = new Date(
                          account.createdAt
                        ).toLocaleDateString();
                        break;
                      default:
                        cellContent = String(account[column.key] ?? "");
                    }

                    return <TableCell key={column.key}>{cellContent}</TableCell>;
                  })}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(account)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(account.uuid)}
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
