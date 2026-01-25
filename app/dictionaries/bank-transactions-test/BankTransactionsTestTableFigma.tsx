"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { BankTransaction } from "../../../components/figma/bank-transactions-table";

// Dynamically import the heavy table component
const BankTransactionsTableDynamic = dynamic(
  () => import("../../../components/figma/bank-transactions-table"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Loading table component...</p>
      </div>
    )
  }
);

// Safe date formatting helpers
function toValidDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function toYMD(d: Date | null): string {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toISO(d: Date | null): string {
  return d ? d.toISOString() : "";
}

// Convert dd.mm.yyyy to yyyy-mm-dd
function toApiDate(displayDate: string): string {
  if (!displayDate || displayDate.length !== 10) return "";
  const parts = displayDate.split(".");
  if (parts.length !== 3) return "";
  const [day, month, year] = parts;
  if (!day || !month || !year || year.length !== 4) return "";
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

// Convert yyyy-mm-dd to dd.mm.yyyy
function toDisplayDate(apiDate: string): string {
  if (!apiDate) return "";
  const parts = apiDate.split("-");
  if (parts.length !== 3) return "";
  const [year, month, day] = parts;
  return `${day}.${month}.${year}`;
}

// Format input value to dd.mm.yyyy as user types
function formatDateInput(value: string): string {
  // Remove non-digits
  const digits = value.replace(/\D/g, "");

  // Build formatted string
  if (digits.length === 0) return "";
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 8)}`;
}

export default function BankTransactionsTestTableFigma() {
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [currencySummaries, setCurrencySummaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Initialize from localStorage
  const [fromDateDisplay, setFromDateDisplay] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bankTransactionsTest_fromDate') || "";
    }
    return "";
  });
  const [toDateDisplay, setToDateDisplay] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bankTransactionsTest_toDate') || "";
    }
    return "";
  });

  // Applied filters - only these trigger data fetching
  const [appliedFromDate, setAppliedFromDate] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bankTransactionsTest_appliedFromDate') || "";
    }
    return "";
  });
  const [appliedToDate, setAppliedToDate] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bankTransactionsTest_appliedToDate') || "";
    }
    return "";
  });

  // Record limit setting
  const [recordLimitInput, setRecordLimitInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bankTransactionsTest_recordLimit') || "5000";
    }
    return "5000";
  });
  const [appliedRecordLimit, setAppliedRecordLimit] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bankTransactionsTest_appliedRecordLimit') || "5000";
    }
    return "5000";
  });

  // Save applied filters to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bankTransactionsTest_appliedFromDate', appliedFromDate);
      localStorage.setItem('bankTransactionsTest_appliedToDate', appliedToDate);
      localStorage.setItem('bankTransactionsTest_fromDate', appliedFromDate); // Sync display with applied
      localStorage.setItem('bankTransactionsTest_toDate', appliedToDate);
      localStorage.setItem('bankTransactionsTest_appliedRecordLimit', appliedRecordLimit);
      localStorage.setItem('bankTransactionsTest_recordLimit', appliedRecordLimit);
    }
  }, [appliedFromDate, appliedToDate, appliedRecordLimit]);

  // Validation helper - check if date is valid dd.mm.yyyy format
  const isValidDate = (date: string): boolean => {
    if (!date) return true; // Empty is valid (means no filter)
    if (date.length !== 10) return false;
    const parts = date.split(".");
    if (parts.length !== 3) return false;
    const [day, month, year] = parts;
    if (!day || !month || !year || year.length !== 4) return false;
    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);
    if (isNaN(dayNum) || isNaN(monthNum) || isNaN(yearNum)) return false;
    if (dayNum < 1 || dayNum > 31) return false;
    if (monthNum < 1 || monthNum > 12) return false;
    if (yearNum < 1900 || yearNum > 2100) return false;
    return true;
  };

  // Apply filters button handler
  const handleApplyFilters = () => {
    // Validate dates before applying
    const fromValid = isValidDate(fromDateDisplay);
    const toValid = isValidDate(toDateDisplay);

    if (!fromValid || !toValid) {
      alert("Please enter valid dates in dd.mm.yyyy format");
      return;
    }

    // Validate record limit
    const limitValue = recordLimitInput.toLowerCase();
    if (limitValue !== 'all' && limitValue !== '') {
      const limitNum = parseInt(limitValue, 10);
      if (isNaN(limitNum) || limitNum < 1) {
        alert("Please enter a valid number or 'all' for record limit");
        return;
      }
      // Warn if limit is too high (API caps at 10,000)
      if (limitNum > 10000) {
        if (!confirm(`⚠️ You requested ${limitNum} records.\n\nFor performance reasons, the API is capped at 10,000 records maximum.\n\nContinue with 10,000 records?`)) {
          return;
        }
        // Auto-adjust to 10,000
        setRecordLimitInput("10000");
        setAppliedRecordLimit("10000");
        return;
      }
    }

    // Apply the filters
    setAppliedFromDate(fromDateDisplay);
    setAppliedToDate(toDateDisplay);
    setAppliedRecordLimit(recordLimitInput);
  };

  // Clear filters
  const handleClearFilters = () => {
    setFromDateDisplay("");
    setToDateDisplay("");
    setAppliedFromDate("");
    setAppliedToDate("");
    setRecordLimitInput("5000");
    setAppliedRecordLimit("5000");
  };

  useEffect(() => {
    async function loadTransactions() {
      try {
        console.log('[BankTransactionsTestTableFigma] Fetching data...');
        const params = new URLSearchParams();
        // Database stores dates in dd.mm.yyyy format - send as-is
        console.log('[BankTransactionsTestTableFigma] Dates:', {
          fromDate: appliedFromDate,
          toDate: appliedToDate
        });
        if (appliedFromDate) params.set('fromDate', appliedFromDate);
        if (appliedToDate) params.set('toDate', appliedToDate);

        // Apply record limit (if not 'all')
        const limitValue = appliedRecordLimit.toLowerCase();
        if (limitValue !== 'all' && limitValue !== '') {
          params.set('limit', appliedRecordLimit);
        }
        // If 'all', don't set limit parameter (will use API default or fetch all available)

        const queryString = params.toString();
        const url = `/api/bank-transactions-test${queryString ? `?${queryString}` : ''}`;
        const res = await fetch(url);
        console.log('[BankTransactionsTestTableFigma] Response status:', res.status);

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Failed to fetch: ${res.status} ${errorText}`);
        }

        const json = await res.json();
        const data = json.data || [];
        const summaries = json.currency_summaries || [];
        const pagination = json.pagination || null;

        if (pagination) {
          console.log('[BankTransactionsTestTableFigma] Pagination info:', pagination);
        }

        if (summaries.length > 0) {
          console.log('[BankTransactionsTestTableFigma] Currency summaries:', summaries);
        } else {
          console.log('[BankTransactionsTestTableFigma] No currency summaries received');
        }

        console.log('[BankTransactionsTestTableFigma] Data received:', data.length, 'records');

        // Map date strings to Date objects for the table component
        const mapped = data.map((row: any) => ({
          ...row,
          createdAt: toValidDate(row.createdAt),
          updatedAt: toValidDate(row.updatedAt),
          transaction_date: row.transaction_date || null,
          correction_date: row.correction_date || null,
        }));

        console.log('[BankTransactionsTestTableFigma] Mapped data:', mapped.length, 'records');
        setTransactions(mapped);
        setCurrencySummaries(summaries);
        setError(null);
      } catch (err: any) {
        console.error("[BankTransactionsTestTableFigma] Load error:", err);
        setError(err.message || "Failed to load transactions");
      } finally {
        setLoading(false);
        setIsInitialLoad(false);
      }
    }

    loadTransactions();
  }, [appliedFromDate, appliedToDate, appliedRecordLimit]);

  if (loading && isInitialLoad) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Loading bank transactions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600 font-medium mb-2">Failed to load transactions</p>
        <p className="text-muted-foreground text-sm">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  console.log('[BankTransactionsTestTableFigma] Rendering table with', transactions.length, 'transactions');
  console.log('[BankTransactionsTestTableFigma] Currency summaries to pass:', currencySummaries);

  return (
    <div className="w-full">
      <div className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Bank Transactions Test</h1>
          <p className="text-muted-foreground">Deconsolidated transactions from GE78BG0000000893486000_BOG_GEL.</p>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col">
            <label className="text-sm font-medium mb-1">From Date</label>
            <input
              type="text"
              value={fromDateDisplay}
              onChange={(e) => setFromDateDisplay(formatDateInput(e.target.value))}
              placeholder="dd.mm.yyyy"
              className="border rounded px-3 py-2 w-[140px]"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium mb-1">To Date</label>
            <input
              type="text"
              value={toDateDisplay}
              onChange={(e) => setToDateDisplay(formatDateInput(e.target.value))}
              placeholder="dd.mm.yyyy"
              className="border rounded px-3 py-2 w-[140px]"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium mb-1">Record Limit</label>
            <input
              type="text"
              value={recordLimitInput}
              onChange={(e) => setRecordLimitInput(e.target.value)}
              placeholder="5000 or all"
              className="border rounded px-3 py-2 w-[140px]"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleApplyFilters}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Apply Filters
            </button>
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 bg-gray-200 text-gray-900 rounded hover:bg-gray-300"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <BankTransactionsTableDynamic data={transactions} currencySummaries={currencySummaries} />
    </div>
  );
}
