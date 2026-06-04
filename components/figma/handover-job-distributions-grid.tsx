'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { RefreshCw, Briefcase } from 'lucide-react';

type JobDistribution = {
  uuid: string;
  paymentUuid: string;
  paymentId: string;
  jobUuid: string;
  jobName: string;
  factoryNo: string | null;
  projectUuid: string;
  amount: number;
  amountAccountCurr: number | null;
  allocationType: string;
  allocationPercent: number | null;
  isAutoDistributed: boolean;
  weightSnapshot: number | null;
  createdAt: string;
  updatedAt: string;
  // Payment details
  paymentCurrencyCode: string;
  paymentAmount: number;
  counteragentName: string | null;
  financialCodeCode: string | null;
};

type Props = {
  projectUuid: string;
};

export function HandoverJobDistributionsGrid({ projectUuid }: Props) {
  const [distributions, setDistributions] = useState<JobDistribution[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDistributions = async () => {
    if (!projectUuid) {
      setDistributions([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/payments-jobs?project_uuid=${projectUuid}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setDistributions(data);
      }
    } catch (error) {
      console.error('Error fetching job distributions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDistributions();
  }, [projectUuid]);

  // Group by payment ID
  const groupedByPayment = useMemo(() => {
    const groups = new Map<string, JobDistribution[]>();
    distributions.forEach(dist => {
      const existing = groups.get(dist.paymentId) || [];
      existing.push(dist);
      groups.set(dist.paymentId, existing);
    });
    return groups;
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Job Distributions</h3>
          <Badge variant="secondary">{distributions.length} allocations</Badge>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={fetchDistributions}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-2 font-semibold">Payment ID</th>
              <th className="text-left p-2 font-semibold">Counteragent</th>
              <th className="text-left p-2 font-semibold">FC</th>
              <th className="text-right p-2 font-semibold">Payment Amount</th>
              <th className="text-left p-2 font-semibold">Job</th>
              <th className="text-left p-2 font-semibold">Factory No</th>
              <th className="text-right p-2 font-semibold">%</th>
              <th className="text-right p-2 font-semibold">Allocated</th>
              <th className="text-right p-2 font-semibold">GEL</th>
              <th className="text-center p-2 font-semibold">Type</th>
            </tr>
          </thead>
          <tbody>
            {distributions.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-muted-foreground">
                  {loading ? 'Loading...' : 'No job distributions found for this project'}
                </td>
              </tr>
            ) : (
              Array.from(groupedByPayment.entries()).map(([paymentId, dists]) => {
                const first = dists[0];
                const totalAllocated = dists.reduce((sum, d) => sum + d.amount, 0);
                const totalPercent = dists.reduce((sum, d) => sum + (d.allocationPercent || 0), 0);

                return (
                  <React.Fragment key={paymentId}>
                    {/* Payment header row */}
                    <tr className="border-t bg-blue-50/30">
                      <td className="p-2 font-medium" rowSpan={dists.length + 1}>
                        <div className="font-mono text-xs">{paymentId}</div>
                      </td>
                      <td className="p-2" rowSpan={dists.length + 1}>
                        <div className="text-xs">{first.counteragentName || '—'}</div>
                      </td>
                      <td className="p-2" rowSpan={dists.length + 1}>
                        <div className="text-xs font-mono">{first.financialCodeCode || '—'}</div>
                      </td>
                      <td className="p-2 text-right font-semibold" rowSpan={dists.length + 1}>
                        <div>{first.paymentAmount.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">{first.paymentCurrencyCode}</div>
                      </td>
                    </tr>

                    {/* Job distribution rows */}
                    {dists.map((dist, idx) => (
                      <tr key={dist.uuid} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="p-2">
                          <div className="font-medium">{dist.jobName}</div>
                        </td>
                        <td className="p-2 text-muted-foreground">
                          {dist.factoryNo || '—'}
                        </td>
                        <td className="p-2 text-right">
                          {dist.allocationPercent ? dist.allocationPercent.toFixed(2) + '%' : '—'}
                        </td>
                        <td className="p-2 text-right font-medium">
                          {dist.amount.toFixed(2)}
                        </td>
                        <td className="p-2 text-right text-muted-foreground">
                          {dist.amountAccountCurr ? dist.amountAccountCurr.toFixed(2) : '—'}
                        </td>
                        <td className="p-2 text-center">
                          <Badge variant={dist.isAutoDistributed ? 'default' : 'secondary'} className="text-xs">
                            {dist.isAutoDistributed ? 'Auto' : dist.allocationType === 'percentage' ? '%' : '₾'}
                          </Badge>
                        </td>
                      </tr>
                    ))}

                    {/* Totals row */}
                    <tr className="border-t bg-blue-50/50 font-semibold text-xs">
                      <td colSpan={2} className="p-2 text-right">
                        Total ({dists.length} jobs):
                      </td>
                      <td className="p-2 text-right">
                        {totalPercent.toFixed(2)}%
                      </td>
                      <td className="p-2 text-right">
                        {totalAllocated.toFixed(2)}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      {distributions.length > 0 && (
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{groupedByPayment.size} payments distributed</span>
          <span>•</span>
          <span>{distributions.length} job allocations</span>
        </div>
      )}
    </div>
  );
}
