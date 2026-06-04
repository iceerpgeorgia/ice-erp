'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';
import { JobDistributionGrid, type JobDistributionRow } from './job-distribution-grid';

type BankTransactionRow = {
  id: number;
  transaction_date: string | null;
  account_number: string | null;
  counteragent_account_number: string | null;
  account_currency_amount: string | number | null;
  nominal_amount: string | number | null;
  financial_code: string | null;
  nominal_currency_code: string | null;
  payment_id: string | null;
  batch_id: string | null;
  description: string | null;
  dockey: string | null;
  entriesid: string | null;
  project_uuid: string | null;
  is_balance_record?: boolean | null;
};

type PaymentMapEntry = {
  paymentUuid: string;
  currencyCode: string | null;
};

type Props = {
  projectUuid: string;
};

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateString)) {
    const [year, month, day] = dateString.split('T')[0].split('-');
    return `${day}.${month}.${year}`;
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return String(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

const formatAmount = (value: string | number | null | undefined): string => {
  if (value == null || value === '') return '';
  const num = Number(value);
  if (Number.isNaN(num)) return '';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export function HandoverJobDistributionsGrid({ projectUuid }: Props) {
  const [transactions, setTransactions] = useState<BankTransactionRow[]>([]);
  const [paymentMap, setPaymentMap] = useState<Map<string, PaymentMapEntry>>(new Map());
  const [distributionMap, setDistributionMap] = useState<Map<string, JobDistributionRow[]>>(new Map());
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!projectUuid) {
      setTransactions([]);
      setPaymentMap(new Map());
      setDistributionMap(new Map());
      return;
    }

    setLoading(true);
    try {
      const [txRes, paymentsRes, distRes] = await Promise.all([
        fetch('/api/bank-transactions-test?limit=0'),
        fetch(`/api/payments-report?projectUuid=${encodeURIComponent(projectUuid)}`),
        fetch(`/api/payments-jobs?project_uuid=${encodeURIComponent(projectUuid)}`),
      ]);

      const txPayload = txRes.ok ? await txRes.json() : null;
      const txRows = Array.isArray(txPayload)
        ? txPayload
        : Array.isArray(txPayload?.data)
          ? txPayload.data
          : [];

      const filteredRows = txRows.filter((row: any) =>
        row.project_uuid === projectUuid &&
        !row.is_balance_record &&
        (row.payment_id || row.batch_id)
      );
      setTransactions(filteredRows);

      const nextPaymentMap = new Map<string, PaymentMapEntry>();
      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        paymentsData.forEach((payment: any) => {
          if (payment.paymentId && payment.paymentUuid) {
            nextPaymentMap.set(payment.paymentId, {
              paymentUuid: payment.paymentUuid,
              currencyCode: payment.currencyCode ?? null,
            });
          }
        });
      }
      setPaymentMap(nextPaymentMap);

      const nextDistributionMap = new Map<string, JobDistributionRow[]>();
      if (distRes.ok) {
        const distData = await distRes.json();
        distData.forEach((dist: any) => {
          if (!dist.payment_uuid) return;
          const row: JobDistributionRow = {
            jobUuid: dist.job_uuid,
            jobName: dist.job_name,
            factoryNo: dist.factory_no,
            sellingPrice: dist.selling_price,
            percentage: dist.allocation_percent != null ? Number(dist.allocation_percent).toFixed(2) : '',
            amount: dist.amount != null ? Number(dist.amount).toFixed(2) : '',
            amountAccountCurr: dist.amount_account_curr != null ? Number(dist.amount_account_curr).toFixed(2) : '',
          };
          const current = nextDistributionMap.get(dist.payment_uuid) || [];
          current.push(row);
          nextDistributionMap.set(dist.payment_uuid, current);
        });
      }
      setDistributionMap(nextDistributionMap);
    } catch (error) {
      console.error('Failed to fetch bank transactions:', error);
      setTransactions([]);
      setPaymentMap(new Map());
      setDistributionMap(new Map());
    } finally {
      setLoading(false);
    }
  }, [projectUuid]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!projectUuid) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center text-muted-foreground">
        Select a project to view job distributions
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Job Distributions</h3>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-lg border bg-white p-6 text-center text-muted-foreground">
          No matching bank transactions for this project.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CA Account</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Nominal Amount</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Financial Code</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom ISO</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment ID</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch ID</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID1</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID2</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.map((row) => {
                const paymentInfo = row.payment_id ? paymentMap.get(row.payment_id) : null;
                const paymentUuid = paymentInfo?.paymentUuid ?? null;
                const distributionValue = paymentUuid ? (distributionMap.get(paymentUuid) ?? []) : [];

                const nominalAmount = Number(row.nominal_amount ?? 0);
                const accountAmount = Number(row.account_currency_amount ?? 0);
                const hasNominal = Number.isFinite(nominalAmount) && nominalAmount !== 0;
                const paymentAmount = hasNominal
                  ? nominalAmount
                  : (Number.isFinite(accountAmount) ? accountAmount : 0);
                const rawRate = hasNominal && Number.isFinite(accountAmount)
                  ? accountAmount / nominalAmount
                  : 1;
                const accountCurrencyRate = Number.isFinite(rawRate) && rawRate !== 0 ? rawRate : 1;
                const paymentCurrencyCode = row.nominal_currency_code || paymentInfo?.currencyCode || 'GEL';

                return (
                  <tr key={row.id}>
                    <td className="px-4 py-2 text-sm">{formatDate(row.transaction_date)}</td>
                    <td className="px-4 py-2 text-sm">{row.account_number || ''}</td>
                    <td className="px-4 py-2 text-sm">{row.counteragent_account_number || ''}</td>
                    <td className="px-4 py-2 text-sm text-right">{formatAmount(row.account_currency_amount)}</td>
                    <td className="px-4 py-2 text-sm text-right">{formatAmount(row.nominal_amount)}</td>
                    <td className="px-4 py-2 text-sm">{row.financial_code || ''}</td>
                    <td className="px-4 py-2 text-sm">{row.nominal_currency_code || ''}</td>
                    <td className="px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span>{row.payment_id || ''}</span>
                        {paymentUuid && row.payment_id && (
                          <JobDistributionGrid
                            paymentUuid={paymentUuid}
                            paymentId={row.payment_id}
                            paymentAmount={paymentAmount}
                            paymentCurrencyCode={paymentCurrencyCode}
                            accountCurrencyRate={accountCurrencyRate}
                            projectUuid={projectUuid}
                            value={distributionValue}
                            onChange={() => {}}
                            onSave={fetchData}
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-sm">{row.batch_id || ''}</td>
                    <td className="px-4 py-2 text-sm max-w-[400px] truncate" title={row.description || ''}>
                      {row.description || ''}
                    </td>
                    <td className="px-4 py-2 text-sm">{row.dockey || ''}</td>
                    <td className="px-4 py-2 text-sm">{row.entriesid || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
