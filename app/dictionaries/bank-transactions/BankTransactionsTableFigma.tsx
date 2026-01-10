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

export default function BankTransactionsTableFigma() {
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTransactions() {
      try {
        console.log('[BankTransactionsTableFigma] Fetching data...');
        const res = await fetch("/api/bank-transactions");
        console.log('[BankTransactionsTableFigma] Response status:', res.status);
        
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
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
          correctionDate: null, // Not in current schema
          id1: null, // Not in current schema
          id2: null, // Not in current schema
          recordUuid: row.raw_record_uuid || "",
          counteragentAccountNumber: null, // Not in current schema
          description: row.description || null,
          createdAt: toISO(toValidDate(row.created_at || row.createdAt)),
          updatedAt: toISO(toValidDate(row.updated_at || row.updatedAt)),
          
          // Display fields (from joins)
          accountNumber: row.account_number || null,
          bankName: row.bank_name || null,
          counteragentName: row.counteragent_name || null,
          projectIndex: row.project_index || null,
          financialCode: row.financial_code || null,
          paymentId: null, // Not used in current schema
          nominalCurrencyCode: row.nominal_currency_code || null,
        }));

        console.log('[BankTransactionsTableFigma] Mapped data:', mapped.length, 'records');
        setTransactions(mapped);
      } catch (err) {
        console.error("[BankTransactionsTableFigma] Load error:", err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    loadTransactions();
  }, []);

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
  return <BankTransactionsTableDynamic data={transactions} />;
}
