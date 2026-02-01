"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { BankTransaction } from "@/components/figma/bank-transactions-table";

// Dynamically import the heavy table component
const BankTransactionsTableDynamic = dynamic(
  () => import("@/components/figma/bank-transactions-table"),
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

export default function BankTransactionsTableFigma() {
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [currencySummaries, setCurrencySummaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Initialize from localStorage
  const [fromDateDisplay, setFromDateDisplay] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bankTransactions_fromDate') || "";
    }
    return "";
  });
  const [toDateDisplay, setToDateDisplay] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bankTransactions_toDate') || "";
    }
    return "";
  });

  // Applied filters - only these trigger data fetching
  const [appliedFromDate, setAppliedFromDate] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bankTransactions_appliedFromDate') || "";
    }
    return "";
  });
  const [appliedToDate, setAppliedToDate] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bankTransactions_appliedToDate') || "";
    }
    return "";
  });

  // Record limit setting
  const [recordLimitInput, setRecordLimitInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bankTransactions_recordLimit') || "";
    }
    return "";
  });
  const [appliedRecordLimit, setAppliedRecordLimit] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bankTransactions_appliedRecordLimit') || "";
    }
    return "";
  });

  // Save applied filters to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bankTransactions_appliedFromDate', appliedFromDate);
      localStorage.setItem('bankTransactions_appliedToDate', appliedToDate);
      localStorage.setItem('bankTransactions_fromDate', appliedFromDate); // Sync display with applied
      localStorage.setItem('bankTransactions_toDate', appliedToDate);
      localStorage.setItem('bankTransactions_appliedRecordLimit', appliedRecordLimit);
      localStorage.setItem('bankTransactions_recordLimit', appliedRecordLimit);
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
    setRecordLimitInput("");
    setAppliedRecordLimit("");
  };

  useEffect(() => {
    async function loadTransactions() {
      try {
        console.log('[BankTransactionsTableFigma] Fetching data...');
        const params = new URLSearchParams();
        // Database stores dates in dd.mm.yyyy format - send as-is
        console.log('[BankTransactionsTableFigma] Dates:', {
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
        const url = `/api/bank-transactions${queryString ? `?${queryString}` : ''}`;
        const res = await fetch(url);
        console.log('[BankTransactionsTableFigma] Response status:', res.status);
        
        if (!res.ok) throw new Error("Failed to fetch");
        const response = await res.json();
        
        // Handle new response format with pagination
        const data = response.data || response; // Support both old and new formats
        const pagination = response.pagination;
        const summaries = response.currency_summaries || [];
        
        if (pagination) {
          console.log('[BankTransactionsTableFigma] Pagination info:', pagination);
        }
        
        if (summaries.length > 0) {
          console.log('[BankTransactionsTableFigma] Currency summaries:', summaries);
          setCurrencySummaries(summaries);
        } else {
          console.log('[BankTransactionsTableFigma] No currency summaries received');
          setCurrencySummaries([]);
        }
        
        console.log('[BankTransactionsTableFigma] Data received:', data.length, 'records');

        const mapped = data.map((row: any) => ({
          id: row.id || row.ID,
          uuid: row.uuid || "",
          accountUuid: row.bank_account_uuid || "",
          accountCurrencyUuid: row.account_currency_uuid || "",
          accountCurrencyAmount: row.account_currency_amount || "0",
          paymentUuid: null, // Not used in current schema
          counteragentUuid: row.counteragent_uuid || null,
          projectUuid: row.project_uuid || null,
          financialCodeUuid: row.financial_code_uuid || null,
          nominalCurrencyUuid: row.nominal_currency_uuid || null,
          nominalAmount: row.nominal_amount || null,
          date: row.transaction_date || "",
          correctionDate: row.correction_date || null,
          exchangeRate: row.nominal_exchange_rate || null,
          nominalExchangeRate: row.nominal_exchange_rate || null,
          usdGelRate: row.usd_gel_rate ?? null,
          id1: null, // Not in current schema
          id2: null, // Not in current schema
          recordUuid: row.raw_record_uuid || "",
          counteragentAccountNumber: row.counteragent_account_number ? String(row.counteragent_account_number) : null,
          description: row.description || null,
          processingCase: row.processing_case || null,
          appliedRuleId: row.applied_rule_id || null,
          parsingLock: Boolean(row.parsing_lock),
          createdAt: toISO(toValidDate(row.created_at || row.createdAt)),
          updatedAt: toISO(toValidDate(row.updated_at || row.updatedAt)),
          isBalanceRecord: row.is_balance_record || false, // Flag for balance records
          
          // Display fields (from joins)
          accountNumber: row.account_number || null,
          bankName: row.bank_name || null,
          counteragentName: row.counteragent_name || null,
          projectIndex: row.project_index || null,
          financialCode: row.financial_code || null,
          paymentId: row.payment_id || null,
          nominalCurrencyCode: row.nominal_currency_code || null,
        }));

        console.log('[BankTransactionsTableFigma] Mapped data:', mapped.length, 'records');
        setTransactions(mapped);
      } catch (err) {
        console.error("[BankTransactionsTableFigma] Load error:", err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
        setIsInitialLoad(false);
      }
    }

    // Only load if not currently loading to prevent race conditions
    if (!loading || isInitialLoad) {
      setLoading(true);
      loadTransactions();
    }
  }, [appliedFromDate, appliedToDate, appliedRecordLimit]); // Trigger only when applied filters change

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Loading bank transactions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <p className="text-red-600 font-semibold mb-2">Error loading transactions</p>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  console.log('[BankTransactionsTableFigma] Rendering table with', transactions.length, 'transactions');
  console.log('[BankTransactionsTableFigma] Currency summaries to pass:', currencySummaries);
  
  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <label htmlFor="fromDate" className="text-sm font-medium text-gray-700">
            From:
          </label>
          <input
            id="fromDate"
            type="text"
            value={fromDateDisplay}
            onChange={(e) => setFromDateDisplay(formatDateInput(e.target.value))}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleApplyFilters();
              }
            }}
            placeholder="dd.mm.yyyy"
            maxLength={10}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-32"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="toDate" className="text-sm font-medium text-gray-700">
            To:
          </label>
          <input
            id="toDate"
            type="text"
            value={toDateDisplay}
            onChange={(e) => setToDateDisplay(formatDateInput(e.target.value))}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleApplyFilters();
              }
            }}
            placeholder="dd.mm.yyyy"
            maxLength={10}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-32"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="recordLimit" className="text-sm font-medium text-gray-700">
            Records:
          </label>
          <input
            id="recordLimit"
            type="text"
            value={recordLimitInput}
            onChange={(e) => setRecordLimitInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleApplyFilters();
              }
            }}
            placeholder="Records (optional)"
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-32"
          />
        </div>
        <button
          onClick={handleApplyFilters}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Apply Filter
        </button>
        {(appliedFromDate || appliedToDate) && (
          <button
            onClick={handleClearFilters}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Clear Filters
          </button>
        )}
        <div className="ml-auto text-sm text-gray-600">
          Showing {transactions.length.toLocaleString()} transactions
        </div>
      </div>
      <BankTransactionsTableDynamic data={transactions} currencySummaries={currencySummaries} />
    </div>
  );
}
