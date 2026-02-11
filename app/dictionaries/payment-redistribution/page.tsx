"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { Combobox } from "../../../components/ui/combobox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../components/ui/popover";
import { Settings } from "lucide-react";

export const dynamic = "force-dynamic";

type CounteragentOption = {
  counteragent_uuid: string;
  counteragent: string | null;
  identification_number: string | null;
  name?: string | null;
};

type AccrualRow = {
  payment_id: string;
  accrual_sum: string | number;
  order_sum: string | number;
  currency_code: string | null;
  project_index: string | null;
  project_name: string | null;
  financial_code: string | null;
  job_name: string | null;
  income_tax: boolean | null;
};

type TransactionRow = {
  source_table: string;
  id: number;
  uuid: string;
  payment_id: string | null;
  transaction_date: string | null;
  description: string | null;
  nominal_amount: string | number | null;
  parsing_lock: boolean | null;
  nominal_currency_code: string | null;
  account_currency_amount: string | number | null;
};

type OptimizationResult = {
  objective_abs_deviation: number;
  payments: Record<
    string,
    {
      target: number;
      total: number;
      diff: number;
      transactions: Array<{
        source_table: string;
        id: number;
        uuid: string;
        payment_id: string | null;
        transaction_date: string | null;
        amount: number;
      }>;
    }
  >;
  updates: Array<{
    source_table: string;
    id: number;
    from_payment_id: string | null;
    to_payment_id: string;
  }>;
};

type FifoPartition = {
  payment_id: string | null;
  payment_uuid: string | null;
  counteragent_uuid: string | null;
  project_uuid: string | null;
  financial_code_uuid: string | null;
  nominal_currency_uuid: string | null;
  nominal_amount: number;
  partition_amount: number;
  partition_note: string | null;
};

type FifoBatch = {
  source_table: string;
  id: number;
  raw_record_uuid: string | null;
  bank_account_uuid: string | null;
  raw_record_id_1: string | null;
  raw_record_id_2: string | null;
  partitions: FifoPartition[];
};

type FifoAllocation = {
  source_table: string;
  id: number;
  transaction_date: string | null;
  nominal_amount: number;
  partitions: Array<{
    payment_id: string | null;
    amount: number;
    partition_amount: number;
    note: string | null;
  }>;
  batch_required: boolean;
};

type FifoResult = {
  updates: Array<{
    source_table: string;
    id: number;
    to_payment_id: string;
    counteragent_uuid: string | null;
    project_uuid: string | null;
    financial_code_uuid: string | null;
    nominal_currency_uuid: string | null;
    nominal_amount: number | null;
  }>;
  batches: FifoBatch[];
  allocations: FifoAllocation[];
  warnings: string[];
  unallocated: Array<{
    payment_id: string;
    remaining: number;
  }>;
};

type ColumnConfig<T extends string> = {
  key: T;
  label: string;
  visible: boolean;
};

type AccrualColumnKey = "payment_id" | "job" | "project" | "accrual";
type PaymentColumnKey =
  | "date"
  | "payment_id"
  | "project"
  | "job"
  | "financial_code"
  | "currency"
  | "lock"
  | "nominal";

const defaultAccrualColumns: ColumnConfig<AccrualColumnKey>[] = [
  { key: "payment_id", label: "Payment ID", visible: true },
  { key: "job", label: "Job", visible: true },
  { key: "project", label: "Project", visible: true },
  { key: "accrual", label: "Accrual", visible: true },
];

const defaultPaymentColumns: ColumnConfig<PaymentColumnKey>[] = [
  { key: "date", label: "Date", visible: true },
  { key: "payment_id", label: "Payment ID", visible: true },
  { key: "project", label: "Project", visible: true },
  { key: "job", label: "Job", visible: true },
  { key: "financial_code", label: "Fin. Code", visible: true },
  { key: "currency", label: "Curr", visible: true },
  { key: "lock", label: "Lock", visible: true },
  { key: "nominal", label: "Nominal", visible: true },
];

const formatAmount = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const absAmount = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") return 0;
  const num = Number(value);
  if (Number.isNaN(num)) return 0;
  return Math.abs(num);
};

const transactionKey = (tx: TransactionRow) => `${tx.source_table}:${tx.id}`;

export default function PaymentRedistributionPage() {
  const [counteragents, setCounteragents] = useState<CounteragentOption[]>([]);
  const [selectedCounteragent, setSelectedCounteragent] = useState("");
  const [accruals, setAccruals] = useState<AccrualRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(
    new Set()
  );
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(
    new Set()
  );
  const [accrualColumns, setAccrualColumns] = useState(
    defaultAccrualColumns
  );
  const [paymentColumns, setPaymentColumns] = useState(
    defaultPaymentColumns
  );
  const [splitPercent, setSplitPercent] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const [isSplitLayout, setIsSplitLayout] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const [accrualSearch, setAccrualSearch] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(
    null
  );
  const [fifoResult, setFifoResult] = useState<FifoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fifoRunning, setFifoRunning] = useState(false);
  const [fifoApplying, setFifoApplying] = useState(false);

  useEffect(() => {
    const loadCounteragents = async () => {
      try {
        const response = await fetch("/api/counteragents");
        const data = await response.json();
        setCounteragents(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setError(err.message || "Failed to load counteragents");
      }
    };

    loadCounteragents();
  }, []);

  useEffect(() => {
    if (!selectedCounteragent) {
      setAccruals([]);
      setTransactions([]);
      setSelectedPayments(new Set());
      setSelectedTransactions(new Set());
      setOptimization(null);
      setFifoResult(null);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);
      setOptimization(null);
      try {
        const response = await fetch(
          `/api/payment-redistribution?counteragentUuid=${encodeURIComponent(
            selectedCounteragent
          )}`
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to load data");
        }
        const nextAccruals = Array.isArray(data.accruals) ? data.accruals : [];
        const nextTransactions = Array.isArray(data.transactions)
          ? data.transactions
          : [];
        setAccruals(nextAccruals);
        setTransactions(nextTransactions);
        setSelectedPayments(new Set());
        setSelectedTransactions(new Set());
        setFifoResult(null);
      } catch (err: any) {
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedCounteragent]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(min-width: 1024px)");
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsSplitLayout(event.matches);
    };
    handleChange(media);
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    const handleMove = (event: MouseEvent) => {
      const container = splitContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const offset = event.clientX - rect.left;
      const nextPercent = (offset / rect.width) * 100;
      const clamped = Math.min(75, Math.max(25, nextPercent));
      setSplitPercent(clamped);
    };
    const handleUp = () => setIsResizing(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isResizing]);

  const counteragentOptions = useMemo(
    () =>
      counteragents.map((ca) => {
        const displayName = ca.counteragent || ca.name || "Unknown";
        const idLabel = ca.identification_number
          ? ` • ${ca.identification_number}`
          : "";
        return {
          value: ca.counteragent_uuid,
          label: `${displayName}${idLabel}`,
          keywords: [ca.counteragent, ca.name, ca.identification_number]
            .filter(Boolean)
            .join(" "),
        };
      }),
    [counteragents]
  );

  const filteredAccruals = useMemo(() => {
    if (!accrualSearch) return accruals;
    const searchLower = accrualSearch.toLowerCase();
    return accruals.filter((row) =>
      [row.payment_id, row.project_index, row.job_name, row.financial_code]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(searchLower))
    );
  }, [accruals, accrualSearch]);

  const paymentInfoById = useMemo(() => {
    const map = new Map<string, AccrualRow>();
    accruals.forEach((row) => {
      map.set(row.payment_id, row);
    });
    return map;
  }, [accruals]);

  const filteredTransactions = useMemo(() => {
    if (!paymentSearch) return transactions;
    const searchLower = paymentSearch.toLowerCase();
    return transactions.filter((row) => {
      const paymentInfo = row.payment_id
        ? paymentInfoById.get(row.payment_id)
        : null;
      return [
        row.payment_id,
        row.transaction_date,
        row.description,
        paymentInfo?.project_index,
        paymentInfo?.project_name,
        paymentInfo?.job_name,
        paymentInfo?.financial_code,
        paymentInfo?.currency_code,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(searchLower));
    });
  }, [transactions, paymentSearch, paymentInfoById]);

  const accrualColumnVisibility = useMemo(
    () => new Set(accrualColumns.filter((col) => col.visible).map((col) => col.key)),
    [accrualColumns]
  );

  const paymentColumnVisibility = useMemo(
    () => new Set(paymentColumns.filter((col) => col.visible).map((col) => col.key)),
    [paymentColumns]
  );

  const accrualColSpan = useMemo(
    () => 1 + accrualColumns.filter((col) => col.visible).length,
    [accrualColumns]
  );

  const paymentColSpan = useMemo(
    () => 1 + paymentColumns.filter((col) => col.visible).length,
    [paymentColumns]
  );

  const accrualTotal = useMemo(() => {
    return Array.from(selectedPayments).reduce((sum, paymentId) => {
      const row = accruals.find((item) => item.payment_id === paymentId);
      return sum + absAmount(row?.accrual_sum ?? 0);
    }, 0);
  }, [selectedPayments, accruals]);

  const paymentTotal = useMemo(() => {
    return Array.from(selectedTransactions).reduce((sum, key) => {
      const row = transactions.find((item) => transactionKey(item) === key);
      return sum + absAmount(row?.nominal_amount ?? 0);
    }, 0);
  }, [selectedTransactions, transactions]);

  const totalDifference = useMemo(
    () => accrualTotal - paymentTotal,
    [accrualTotal, paymentTotal]
  );

  const togglePayment = (paymentId: string) => {
    setSelectedPayments((prev) => {
      const next = new Set(prev);
      if (next.has(paymentId)) {
        next.delete(paymentId);
      } else {
        next.add(paymentId);
      }
      return next;
    });
  };

  const toggleAllPayments = () => {
    setSelectedPayments((prev) => {
      if (prev.size === accruals.length) {
        return new Set();
      }
      return new Set(accruals.map((row) => row.payment_id));
    });
  };

  const toggleTransaction = (key: string) => {
    setSelectedTransactions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleAllTransactions = () => {
    setSelectedTransactions((prev) => {
      if (prev.size === transactions.length) {
        return new Set();
      }
      return new Set(transactions.map(transactionKey));
    });
  };

    const toggleAccrualColumn = (key: AccrualColumnKey) => {
      setAccrualColumns((prev) =>
        prev.map((col) =>
          col.key === key ? { ...col, visible: !col.visible } : col
        )
      );
    };

    const togglePaymentColumn = (key: PaymentColumnKey) => {
      setPaymentColumns((prev) =>
        prev.map((col) =>
          col.key === key ? { ...col, visible: !col.visible } : col
        )
      );
    };

    const setAllAccrualColumns = (visible: boolean) => {
      setAccrualColumns((prev) => prev.map((col) => ({ ...col, visible })));
    };

    const setAllPaymentColumns = (visible: boolean) => {
      setPaymentColumns((prev) => prev.map((col) => ({ ...col, visible })));
    };

  const runOptimization = async () => {
    if (selectedPayments.size === 0 || selectedTransactions.size === 0) {
      alert("Select at least one accrual and one payment transaction.");
      return;
    }
    setOptimizing(true);
    setOptimization(null);
    setError(null);
    try {
      const response = await fetch("/api/payment-redistribution/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentIds: Array.from(selectedPayments),
          transactionKeys: Array.from(selectedTransactions).map((key) => {
            const [source_table, id] = key.split(":");
            return { source_table, id: Number(id) };
          }),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Optimization failed");
      }
      setOptimization(data);
    } catch (err: any) {
      setError(err.message || "Optimization failed");
    } finally {
      setOptimizing(false);
    }
  };

  const applyOptimization = async () => {
    if (!optimization || optimization.updates.length === 0) {
      alert("No changes to apply.");
      return;
    }
    if (!confirm(`Apply ${optimization.updates.length} updates?`)) return;

    setApplying(true);
    setError(null);
    try {
      const response = await fetch("/api/payment-redistribution/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: optimization.updates.map((u) => ({
          source_table: u.source_table,
          id: u.id,
          to_payment_id: u.to_payment_id,
        })) }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Apply failed");
      }

      setTransactions((prev) =>
        prev.map((tx) => {
          const update = optimization.updates.find(
            (u) => u.source_table === tx.source_table && u.id === tx.id
          );
          if (!update) return tx;
          return {
            ...tx,
            payment_id: update.to_payment_id,
            parsing_lock: true,
          };
        })
      );
      alert(`Applied ${data.updated ?? optimization.updates.length} updates.`);
    } catch (err: any) {
      setError(err.message || "Apply failed");
    } finally {
      setApplying(false);
    }
  };

  const runFifo = async () => {
    if (selectedPayments.size === 0 || selectedTransactions.size === 0) {
      alert("Select at least one accrual and one payment transaction.");
      return;
    }
    setFifoRunning(true);
    setFifoResult(null);
    setError(null);
    try {
      const response = await fetch("/api/payment-redistribution/fifo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentIds: Array.from(selectedPayments),
          transactionKeys: Array.from(selectedTransactions).map((key) => {
            const [source_table, id] = key.split(":");
            return { source_table, id: Number(id) };
          }),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "FIFO redistribution failed");
      }
      setFifoResult(data);
    } catch (err: any) {
      setError(err.message || "FIFO redistribution failed");
    } finally {
      setFifoRunning(false);
    }
  };

  const applyFifo = async () => {
    if (!fifoResult) {
      alert("Run FIFO redistribution first.");
      return;
    }
    if (!confirm("Apply FIFO redistribution?")) return;

    setFifoApplying(true);
    setError(null);
    try {
      const response = await fetch("/api/payment-redistribution/fifo/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: fifoResult.updates,
          batches: fifoResult.batches,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "FIFO apply failed");
      }

      const updateMap = new Map<string, string>();
      fifoResult.updates.forEach((u) => {
        updateMap.set(`${u.source_table}:${u.id}`, u.to_payment_id);
      });
      if (Array.isArray(data.batchAssignments)) {
        data.batchAssignments.forEach((b: any) => {
          updateMap.set(`${b.source_table}:${b.id}`, b.batch_id);
        });
      }

      setTransactions((prev) =>
        prev.map((tx) => {
          const key = `${tx.source_table}:${tx.id}`;
          const nextPaymentId = updateMap.get(key);
          if (!nextPaymentId) return tx;
          return {
            ...tx,
            payment_id: nextPaymentId,
            parsing_lock: true,
          };
        })
      );

      alert(
        `Applied ${data.updated ?? 0} updates and ${data.batchesCreated ?? 0} batches.`
      );
    } catch (err: any) {
      setError(err.message || "FIFO apply failed");
    } finally {
      setFifoApplying(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-none px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Payment Redistribution Tool</h1>
          <p className="text-sm text-gray-600">
            Select a counteragent, choose accrual targets and bank payments, then
            run optimization or FIFO redistribution (FIFO supports splits).
          </p>
        </div>

        <div className="space-y-2">
          <Label>Counteragent</Label>
          <Combobox
            options={counteragentOptions}
            value={selectedCounteragent}
            onValueChange={setSelectedCounteragent}
            placeholder="Select counteragent..."
            searchPlaceholder="Search counteragents..."
          />
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-gray-600">Loading data...</div>
        ) : (
          <div
            ref={splitContainerRef}
            className="flex flex-col gap-6 lg:flex-row lg:gap-0"
          >
            <div
              className="space-y-3 lg:pr-4"
              style={isSplitLayout ? { width: `${splitPercent}%` } : undefined}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Accruals</h2>
                  <p className="text-xs text-gray-500">
                    Selected: {selectedPayments.size}/{accruals.length} | Total: {formatAmount(accrualTotal)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={toggleAllPayments}>
                    {selectedPayments.size === accruals.length
                      ? "Clear"
                      : "Select All"}
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-2">
                        <Settings className="h-4 w-4" />
                        Columns
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Accrual Columns</h4>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setAllAccrualColumns(true)}
                            >
                              All
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setAllAccrualColumns(false)}
                            >
                              None
                            </Button>
                          </div>
                        </div>
                        {accrualColumns.map((col) => (
                          <div key={col.key} className="flex items-center space-x-2">
                            <Checkbox
                              id={`accrual-column-${col.key}`}
                              checked={col.visible}
                              onCheckedChange={() => toggleAccrualColumn(col.key)}
                            />
                            <label
                              htmlFor={`accrual-column-${col.key}`}
                              className="text-sm cursor-pointer"
                            >
                              {col.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <Input
                placeholder="Search accruals..."
                value={accrualSearch}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setAccrualSearch(event.target.value)
                }
              />
              <div className="rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      {accrualColumnVisibility.has("payment_id") && (
                        <TableHead>Payment ID</TableHead>
                      )}
                      {accrualColumnVisibility.has("job") && (
                        <TableHead>Job</TableHead>
                      )}
                      {accrualColumnVisibility.has("project") && (
                        <TableHead>Project</TableHead>
                      )}
                      {accrualColumnVisibility.has("accrual") && (
                        <TableHead className="text-right">Accrual</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccruals.map((row) => (
                      <TableRow key={row.payment_id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedPayments.has(row.payment_id)}
                            onCheckedChange={() => togglePayment(row.payment_id)}
                          />
                        </TableCell>
                        {accrualColumnVisibility.has("payment_id") && (
                          <TableCell className="font-mono text-xs">
                            {row.payment_id}
                          </TableCell>
                        )}
                        {accrualColumnVisibility.has("job") && (
                          <TableCell>{row.job_name || "-"}</TableCell>
                        )}
                        {accrualColumnVisibility.has("project") && (
                          <TableCell className="max-w-[240px] truncate">
                            {row.project_index || row.project_name || "-"}
                          </TableCell>
                        )}
                        {accrualColumnVisibility.has("accrual") && (
                          <TableCell className="text-right">
                            {formatAmount(row.accrual_sum)}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {filteredAccruals.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={accrualColSpan}
                          className="text-center text-sm text-gray-500"
                        >
                          No accruals found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div
              className="hidden lg:flex w-2 cursor-col-resize items-stretch"
              onMouseDown={() => setIsResizing(true)}
              role="separator"
              aria-orientation="vertical"
            >
              <div className="w-full rounded-full bg-gray-200 hover:bg-gray-300" />
            </div>

            <div
              className="space-y-3 lg:pl-4"
              style={isSplitLayout ? { width: `${100 - splitPercent}%` } : undefined}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Payments</h2>
                  <p className="text-xs text-gray-500">
                    Selected: {selectedTransactions.size}/{transactions.length} | Total: {formatAmount(paymentTotal)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={toggleAllTransactions}>
                    {selectedTransactions.size === transactions.length
                      ? "Clear"
                      : "Select All"}
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-2">
                        <Settings className="h-4 w-4" />
                        Columns
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Payment Columns</h4>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setAllPaymentColumns(true)}
                            >
                              All
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setAllPaymentColumns(false)}
                            >
                              None
                            </Button>
                          </div>
                        </div>
                        {paymentColumns.map((col) => (
                          <div key={col.key} className="flex items-center space-x-2">
                            <Checkbox
                              id={`payment-column-${col.key}`}
                              checked={col.visible}
                              onCheckedChange={() => togglePaymentColumn(col.key)}
                            />
                            <label
                              htmlFor={`payment-column-${col.key}`}
                              className="text-sm cursor-pointer"
                            >
                              {col.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                Difference (Accruals - Payments): {formatAmount(totalDifference)}
              </div>
              <Input
                placeholder="Search payments..."
                value={paymentSearch}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setPaymentSearch(event.target.value)
                }
              />
              <div className="rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      {paymentColumnVisibility.has("date") && (
                        <TableHead>Date</TableHead>
                      )}
                      {paymentColumnVisibility.has("payment_id") && (
                        <TableHead>Payment ID</TableHead>
                      )}
                      {paymentColumnVisibility.has("project") && (
                        <TableHead>Project</TableHead>
                      )}
                      {paymentColumnVisibility.has("job") && (
                        <TableHead>Job</TableHead>
                      )}
                      {paymentColumnVisibility.has("financial_code") && (
                        <TableHead>Fin. Code</TableHead>
                      )}
                      {paymentColumnVisibility.has("currency") && (
                        <TableHead>Curr</TableHead>
                      )}
                      {paymentColumnVisibility.has("lock") && (
                        <TableHead>Lock</TableHead>
                      )}
                      {paymentColumnVisibility.has("nominal") && (
                        <TableHead className="text-right">Nominal</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((row) => {
                      const key = transactionKey(row);
                      const paymentInfo = row.payment_id
                        ? paymentInfoById.get(row.payment_id)
                        : null;
                      return (
                        <TableRow key={key}>
                          <TableCell>
                            <Checkbox
                              checked={selectedTransactions.has(key)}
                              onCheckedChange={() => toggleTransaction(key)}
                            />
                          </TableCell>
                          {paymentColumnVisibility.has("date") && (
                            <TableCell className="text-xs">
                              {row.transaction_date || "-"}
                            </TableCell>
                          )}
                          {paymentColumnVisibility.has("payment_id") && (
                            <TableCell className="font-mono text-xs">
                              {row.payment_id || "-"}
                            </TableCell>
                          )}
                          {paymentColumnVisibility.has("project") && (
                            <TableCell className="max-w-[200px] truncate">
                              {paymentInfo?.project_index || paymentInfo?.project_name || "-"}
                            </TableCell>
                          )}
                          {paymentColumnVisibility.has("job") && (
                            <TableCell>{paymentInfo?.job_name || "-"}</TableCell>
                          )}
                          {paymentColumnVisibility.has("financial_code") && (
                            <TableCell className="max-w-[200px] truncate">
                              {paymentInfo?.financial_code || "-"}
                            </TableCell>
                          )}
                          {paymentColumnVisibility.has("currency") && (
                            <TableCell>
                              {paymentInfo?.currency_code ||
                                row.nominal_currency_code ||
                                "-"}
                            </TableCell>
                          )}
                          {paymentColumnVisibility.has("lock") && (
                            <TableCell>
                              {row.parsing_lock ? "Yes" : "No"}
                            </TableCell>
                          )}
                          {paymentColumnVisibility.has("nominal") && (
                            <TableCell className="text-right">
                              {formatAmount(row.nominal_amount)}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                    {filteredTransactions.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={paymentColSpan}
                          className="text-center text-sm text-gray-500"
                        >
                          No payments found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={runOptimization} disabled={optimizing || loading}>
            {optimizing ? "Optimizing..." : "Run Optimization"}
          </Button>
          <Button
            variant="outline"
            onClick={applyOptimization}
            disabled={applying || !optimization || optimization.updates.length === 0}
          >
            {applying ? "Applying..." : "Apply Updates"}
          </Button>
          <Button onClick={runFifo} disabled={fifoRunning || loading}>
            {fifoRunning ? "Running FIFO..." : "Run FIFO"}
          </Button>
          <Button
            variant="outline"
            onClick={applyFifo}
            disabled={fifoApplying || !fifoResult}
          >
            {fifoApplying ? "Applying FIFO..." : "Apply FIFO"}
          </Button>
          {optimization && (
            <span className="text-sm text-gray-600">
              Total deviation: {formatAmount(optimization.objective_abs_deviation)}
            </span>
          )}
          {fifoResult && (
            <span className="text-sm text-gray-600">
              FIFO: {fifoResult.updates.length} updates, {fifoResult.batches.length} batches
            </span>
          )}
        </div>

        {optimization && (
          <div className="space-y-4">
            <div className="rounded border bg-white p-4">
              <h3 className="text-lg font-semibold">Optimization Result</h3>
              <p className="text-sm text-gray-600">
                Updates required: {optimization.updates.length}
              </p>
              <div className="mt-4 grid gap-4">
                {Object.entries(optimization.payments).map(([paymentId, info]) => (
                  <div key={paymentId} className="rounded border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-mono text-sm">{paymentId}</div>
                      <div className="text-sm text-gray-600">
                        Target: {formatAmount(info.target)} | Total: {formatAmount(info.total)} | Diff: {formatAmount(info.diff)}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      {info.transactions.length} transaction(s)
                    </div>
                    <div className="mt-2 grid gap-1 text-xs">
                      {info.transactions.map((tx) => (
                        <div key={`${tx.source_table}:${tx.id}`} className="flex justify-between gap-2">
                          <span className="truncate">{tx.source_table}:{tx.id}</span>
                          <span>{formatAmount(tx.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {fifoResult && (
          <div className="space-y-4">
            <div className="rounded border bg-white p-4">
              <h3 className="text-lg font-semibold">FIFO Result</h3>
              {fifoResult.warnings.length > 0 && (
                <div className="mt-2 text-sm text-amber-700">
                  {fifoResult.warnings.join(" ")}
                </div>
              )}
              {fifoResult.unallocated.length > 0 && (
                <div className="mt-2 text-sm text-red-600">
                  Unallocated accruals: {fifoResult.unallocated.length}
                </div>
              )}
              <div className="mt-4 grid gap-2 text-xs text-gray-600">
                {fifoResult.allocations.map((row) => (
                  <div key={`${row.source_table}:${row.id}`} className="rounded border p-2">
                    <div className="flex justify-between">
                      <span>{row.source_table}:{row.id}</span>
                      <span>{formatAmount(row.nominal_amount)}</span>
                    </div>
                    <div className="mt-1 grid gap-1">
                      {row.partitions.map((part, idx) => (
                        <div key={`${row.source_table}:${row.id}:${idx}`} className="flex justify-between">
                          <span>{part.payment_id || "FREE"}</span>
                          <span>{formatAmount(part.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
