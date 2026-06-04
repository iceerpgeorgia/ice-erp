'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { RefreshCw, Loader2 } from 'lucide-react';
import { JobDistributionGrid } from './job-distribution-grid';

type JobDistribution = {
  uuid: string;
  payment_uuid: string;
  job_uuid: string;
  job_name: string;
  factory_no: string | null;
  selling_price: number | null;
  amount: string;
  amount_account_curr: string | null;
  allocation_type: string;
  allocation_percent: string | null;
  is_auto_distributed: boolean;
};

type Props = {
  projectUuid: string;
};

export function HandoverJobDistributionsGrid({ projectUuid }: Props) {
  const [distributions, setDistributions] = useState<JobDistribution[]>([]);
  const [incomePayments, setIncomePayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDistributionsAndPayments = useCallback(async () => {
    if (!projectUuid) {
      setDistributions([]);
      setIncomePayments([]);
      return;
    }
    setLoading(true);
    try {
      const [distRes, incomeRes] = await Promise.all([
        fetch(`/api/payments-jobs?project_uuid=${projectUuid}`),
        fetch(`/api/payments-report?projectUuid=${projectUuid}`),
      ]);

      if (distRes.ok) {
        const distData = await distRes.json();
        setDistributions(distData);
      } else {
        setDistributions([]);
      }

      if (incomeRes.ok) {
        const incomeData = await incomeRes.json();
        const incomeOnly = incomeData.filter((r: any) => r.financialCodeIsIncome);
        setIncomePayments(incomeOnly);
      } else {
        setIncomePayments([]);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setDistributions([]);
      setIncomePayments([]);
    } finally {
      setLoading(false);
    }
  }, [projectUuid]);

  useEffect(() => {
    fetchDistributionsAndPayments();
  }, [fetchDistributionsAndPayments]);

  const combinedPayments = useMemo(() => {
    const distributionMap = new Map<string, any[]>();
    distributions.forEach(dist => {
      const paymentUuid = dist.payment_uuid;
      if (!distributionMap.has(paymentUuid)) {
        distributionMap.set(paymentUuid, []);
      }
      distributionMap.get(paymentUuid)!.push(dist);
    });

    return incomePayments.map(payment => {
      const paymentDistributions = distributionMap.get(payment.paymentUuid) || [];
      return {
        ...payment,
        distributions: paymentDistributions,
      };
    });
  }, [incomePayments, distributions]);

  const totalDistributedAmount = useMemo(() => {
    return distributions.reduce((sum, dist) => sum + parseFloat(dist.amount || '0'), 0);
  }, [distributions]);

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
        <Button variant="outline" size="sm" onClick={fetchDistributionsAndPayments} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '20%' }}>Payment</th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '20%' }}>Job</th>
                <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '10%' }}>%</th>
                <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '15%' }}>Amount</th>
                <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '15%' }}>Amount (GEL)</th>
                <th scope="col" className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '10%' }}>Type</th>
                <th scope="col" className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '10%' }}>Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {combinedPayments.map((payment, paymentIndex) => {
                const hasDistributions = payment.distributions.length > 0;
                const totalPercent = payment.distributions.reduce((sum: number, dist: any) => sum + parseFloat(dist.allocation_percent || 0), 0);
                const totalAmount = payment.distributions.reduce((sum: number, dist: any) => sum + parseFloat(dist.amount || 0), 0);
                const totalAmountGEL = payment.distributions.reduce((sum: number, dist: any) => sum + parseFloat(dist.amount_account_curr || 0), 0);

                return (
                  <React.Fragment key={payment.paymentUuid || paymentIndex}>
                    {/* Payment Header Row */}
                    <tr className={hasDistributions ? "bg-gray-50" : "bg-white"}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900" rowSpan={hasDistributions ? payment.distributions.length + 2 : 2}>
                        <div>{payment.paymentId}</div>
                        <div className="text-xs text-gray-500">{payment.counteragentName}</div>
                        <div className="text-xs text-gray-500">{payment.financialCode}</div>
                        <div className="font-bold">{payment.accrual.toLocaleString('en-US', { style: 'currency', currency: payment.currencyCode || 'GEL' })}</div>
                      </td>
                      {!hasDistributions && (
                        <>
                          <td className="px-4 py-2 text-sm text-gray-500 italic" colSpan={5}>No distributions yet.</td>
                          <td className="px-4 py-2 text-center">
                            <JobDistributionGrid
                              paymentUuid={payment.paymentUuid}
                              paymentId={payment.paymentId}
                              paymentAmount={payment.accrual || 0}
                              paymentCurrencyCode={payment.currencyCode || 'GEL'}
                              accountCurrencyRate={1}
                              projectUuid={projectUuid}
                              value={[]}
                              onChange={() => {}}
                              onSave={fetchDistributionsAndPayments}
                            />
                          </td>
                        </>
                      )}
                    </tr>

                    {/* Distribution Rows */}
                    {hasDistributions && payment.distributions.map((dist: any, distIndex: number) => (
                      <tr key={dist.uuid}>
                        {distIndex === 0 && <td className="px-4 py-2" rowSpan={payment.distributions.length + 1}></td>}
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                          <div>{dist.job_name}</div>
                          <div className="text-xs text-gray-400">{dist.factory_no}</div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">{parseFloat(dist.allocation_percent || 0).toFixed(2)}%</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">{parseFloat(dist.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">{parseFloat(dist.amount_account_curr || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-center">
                          <Badge variant={dist.is_auto_distributed ? 'secondary' : 'outline'}>
                            {dist.is_auto_distributed ? 'Auto' : dist.allocation_type}
                          </Badge>
                        </td>
                        {distIndex === 0 && (
                          <td className="px-4 py-2 text-center" rowSpan={payment.distributions.length + 1}>
                            <JobDistributionGrid
                              paymentUuid={payment.paymentUuid}
                              paymentId={payment.paymentId}
                              paymentAmount={payment.accrual || 0}
                              paymentCurrencyCode={payment.currencyCode || 'GEL'}
                              accountCurrencyRate={1}
                              projectUuid={projectUuid}
                              value={payment.distributions.map((d: any) => ({
                                jobUuid: d.job_uuid,
                                jobName: d.job_name,
                                factoryNo: d.factory_no,
                                sellingPrice: d.selling_price,
                                percentage: d.allocation_percent,
                                amount: d.amount,
                                amountAccountCurr: d.amount_account_curr,
                              }))}
                              onChange={() => {}}
                              onSave={fetchDistributionsAndPayments}
                            />
                          </td>
                        )}
                      </tr>
                    ))}

                    {/* Totals Row */}
                    {hasDistributions && (
                      <tr className="bg-gray-50 font-medium">
                        <td className="px-4 py-1 text-sm text-right">Total</td>
                        <td className={`px-4 py-1 text-sm text-right ${Math.abs(totalPercent - 100) > 0.01 ? 'text-red-600' : ''}`}>{totalPercent.toFixed(2)}%</td>
                        <td className={`px-4 py-1 text-sm text-right ${Math.abs(totalAmount - payment.accrual) > 0.01 ? 'text-red-600' : ''}`}>{totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-1 text-sm text-right">{totalAmountGEL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-1"></td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="text-right text-sm text-gray-500 mt-2">
        Total Distributed: {totalDistributedAmount.toLocaleString('en-US', { style: 'currency', currency: 'GEL' })} across {distributions.length} allocations.
      </div>
    </div>
  );
}
