"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { BankTransaction } from "@/components/figma/bank-transactions-table";

// Dynamically import the heavy table component
const BankTransactionsTableDynamic = dynamic(
  () => import("@/components/figma/bank-transactions-table"),
  { ssr: false }
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

  useEffect(() => {
    async function loadTransactions() {
      try {
        const res = await fetch("/api/bank-transactions");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();

        const mapped = data.map((row: any) => ({
          id: row.id || row.ID,
          uuid: row.uuid || "",
          accountUuid: row.account_uuid || "",
          accountCurrencyUuid: row.account_currency_uuid || "",
          accountCurrencyAmount: row.account_currency_amount || "0",
          paymentUuid: row.payment_uuid || null,
          counteragentUuid: row.counteragent_uuid || null,
          projectUuid: row.project_uuid || null,
          financialCodeUuid: row.financial_code_uuid || null,
          nominalCurrencyUuid: row.nominal_currency_uuid || null,
          nominalAmount: row.nominal_amount || null,
          date: toYMD(toValidDate(row.date)),
          correctionDate: row.correction_date ? toYMD(toValidDate(row.correction_date)) : null,
          id1: row.id_1 || null,
          id2: row.id_2 || null,
          recordUuid: row.record_uuid || "",
          counteragentAccountNumber: row.counteragent_account_number || null,
          description: row.description || null,
          createdAt: toISO(toValidDate(row.created_at || row.createdAt)),
          updatedAt: toISO(toValidDate(row.updated_at || row.updatedAt)),
          
          // Display fields (from joins)
          accountNumber: row.account_number || null,
          bankName: row.bank_name || null,
          counteragentName: row.counteragent_name || null,
          projectIndex: row.project_index || null,
          financialCode: row.financial_code || null,
          paymentId: row.payment_id || null,
        }));

        setTransactions(mapped);
      } catch (err) {
        console.error("[BankTransactionsTableFigma] Load error:", err);
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

  return <BankTransactionsTableDynamic data={transactions} />;
}
