"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { AlertCircle, Loader2, Briefcase, TrendingUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

export type JobDistributionRow = {
  jobUuid: string;
  jobName: string;
  factoryNo: string | null;
  sellingPrice: number | null;
  percentage: string;
  amount: string;
  amountAccountCurr: string;
  weight?: number;
};

type JobDistributionGridProps = {
  paymentUuid: string;
  paymentId: string;
  paymentAmount: number;
  paymentCurrencyCode: string;
  accountCurrencyRate?: number;
  projectUuid: string;
  value: JobDistributionRow[];
  onChange: (distribution: JobDistributionRow[]) => void;
  disabled?: boolean;
  onSave?: () => void;
};

export function JobDistributionGrid({
  paymentUuid,
  paymentId,
  paymentAmount,
  paymentCurrencyCode,
  accountCurrencyRate = 1,
  projectUuid,
  value,
  onChange,
  disabled = false,
  onSave,
}: JobDistributionGridProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [jobs, setJobs] = useState<Array<{
    uuid: string;
    name: string;
    factory_no: string | null;
    selling_price: number | null;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localValue, setLocalValue] = useState<JobDistributionRow[]>([]);
  const [distributionMode, setDistributionMode] = useState<'percentage' | 'nominal' | 'auto'>('nominal');

  // Load jobs when dialog opens
  useEffect(() => {
    if (!isOpen || !projectUuid) return;

    setLoading(true);
    fetch(`/api/jobs?project_uuid=${projectUuid}&is_active=true`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const jobsList = data.map(job => ({
            uuid: job.jobUuid,
            name: job.jobName,
            factory_no: job.factoryNo,
            selling_price: job.sellingPrice,
          }));
          setJobs(jobsList);

          // Initialize local value if empty
          if (value.length === 0) {
            const initialDistribution = data.map(job => ({
              jobUuid: job.uuid,
              jobName: job.name,
              factoryNo: job.factory_no,
              sellingPrice: job.selling_price,
              percentage: '',
              amount: '',
              amountAccountCurr: '',
            }));
            setLocalValue(initialDistribution);
          } else {
            setLocalValue(value);
          }
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading jobs:', err);
        setLoading(false);
      });
  }, [isOpen, projectUuid]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalPercent = localValue.reduce(
      (sum, row) => sum + (parseFloat(row.percentage) || 0),
      0
    );
    const totalAmount = localValue.reduce(
      (sum, row) => sum + (parseFloat(row.amount) || 0),
      0
    );
    const totalAmountAcct = localValue.reduce(
      (sum, row) => sum + (parseFloat(row.amountAccountCurr) || 0),
      0
    );

    return {
      percent: totalPercent,
      amount: totalAmount,
      amountAcct: totalAmountAcct,
      percentValid: Math.abs(totalPercent - 100) < 0.01,
      amountValid: Math.abs(totalAmount - paymentAmount) < 0.01,
    };
  }, [localValue, paymentAmount]);

  // Handle percentage change
  const handlePercentageChange = (index: number, value: string) => {
    const updated = [...localValue];
    updated[index].percentage = value;

    // Auto-calculate amount
    const percent = parseFloat(value) || 0;
    if (percent > 0) {
      const amount = (paymentAmount * percent) / 100;
      updated[index].amount = amount.toFixed(2);
      updated[index].amountAccountCurr = (amount * accountCurrencyRate).toFixed(2);
    }

    setLocalValue(updated);
  };

  // Handle amount change
  const handleAmountChange = (index: number, value: string) => {
    const updated = [...localValue];
    updated[index].amount = value;

    // Auto-calculate percentage and account currency amount
    const amount = parseFloat(value) || 0;
    if (amount > 0 && paymentAmount > 0) {
      const percent = (amount / paymentAmount) * 100;
      updated[index].percentage = percent.toFixed(2);
      updated[index].amountAccountCurr = (amount * accountCurrencyRate).toFixed(2);
    }

    setLocalValue(updated);
  };

  // Auto-distribute by selling price
  const handleAutoDistribute = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/payments-jobs/auto-distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_uuid: paymentUuid,
          project_uuid: projectUuid,
          payment_amount: paymentAmount,
          payment_currency_code: paymentCurrencyCode,
          account_currency_rate: accountCurrencyRate,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to auto-distribute');

      // Update local value with auto-distributed amounts
      const updated = localValue.map(row => {
        const dist = data.distributions.find((d: any) => d.job_uuid === row.jobUuid);
        if (dist) {
          return {
            ...row,
            percentage: dist.percent.toFixed(2),
            amount: dist.amount.toFixed(2),
            amountAccountCurr: dist.amount_account_curr.toFixed(2),
            weight: dist.weight,
          };
        }
        return row;
      });

      setLocalValue(updated);
      setDistributionMode('auto');
      setLoading(false);

      // Auto-save after auto-distribute
      await handleSave(updated);
    } catch (error: any) {
      console.error('Auto-distribute error:', error);
      alert(error.message || 'Failed to auto-distribute');
      setLoading(false);
    }
  };

  // Save distributions
  const handleSave = async (dataToSave = localValue) => {
    setSaving(true);
    try {
      // Filter out rows with no amount
      const distributions = dataToSave
        .filter(row => parseFloat(row.amount) > 0)
        .map(row => ({
          job_uuid: row.jobUuid,
          project_uuid: projectUuid,
          amount: parseFloat(row.amount),
          amount_account_curr: parseFloat(row.amountAccountCurr) || null,
          allocation_type: distributionMode === 'auto' ? 'auto_weighted' : distributionMode,
          allocation_percent: parseFloat(row.percentage) || null,
          is_auto_distributed: distributionMode === 'auto',
          weight_snapshot: row.weight || null,
        }));

      const response = await fetch('/api/payments-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_uuid: paymentUuid,
          distributions,
          replace_all: true,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save');

      onChange(dataToSave);
      setSaving(false);
      setIsOpen(false);
      if (onSave) onSave();
    } catch (error: any) {
      console.error('Save error:', error);
      alert(error.message || 'Failed to save job distribution');
      setSaving(false);
    }
  };

  // Clear all distributions
  const handleClear = async () => {
    if (!confirm('Clear all job distributions for this payment?')) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/payments-jobs?payment_uuid=${paymentUuid}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to clear');

      const cleared = localValue.map(row => ({
        ...row,
        percentage: '',
        amount: '',
        amountAccountCurr: '',
      }));

      setLocalValue(cleared);
      onChange(cleared);
      setSaving(false);
      setIsOpen(false);
      if (onSave) onSave();
    } catch (error: any) {
      console.error('Clear error:', error);
      alert(error.message || 'Failed to clear distributions');
      setSaving(false);
    }
  };

  const distributionCount = value.filter(v => parseFloat(v.amount) > 0).length;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className="gap-2"
      >
        <Briefcase className="h-4 w-4" />
        Job Distribution
        {distributionCount > 0 && (
          <Badge variant="secondary" className="ml-1">
            {distributionCount}
          </Badge>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Distribute Payment to Jobs</DialogTitle>
            <DialogDescription>
              Payment ID: {paymentId} | Amount: {paymentAmount.toFixed(2)} {paymentCurrencyCode}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Distribution Mode Selector */}
              <div className="flex items-center gap-4">
                <Label>Distribution Mode:</Label>
                <Select
                  value={distributionMode}
                  onValueChange={(val: any) => setDistributionMode(val)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nominal">Manual (Amount)</SelectItem>
                    <SelectItem value="percentage">Manual (Percent)</SelectItem>
                    <SelectItem value="auto">Auto (Selling Price)</SelectItem>
                  </SelectContent>
                </Select>

                {distributionMode === 'auto' && (
                  <Button
                    type="button"
                    onClick={handleAutoDistribute}
                    disabled={loading || !projectUuid}
                    className="gap-2"
                  >
                    <TrendingUp className="h-4 w-4" />
                    Calculate
                  </Button>
                )}
              </div>

              {/* Distribution Grid */}
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2">Job</th>
                      <th className="text-left p-2">Factory No</th>
                      <th className="text-right p-2">Selling Price</th>
                      <th className="text-right p-2">Percent %</th>
                      <th className="text-right p-2">Amount ({paymentCurrencyCode})</th>
                      {accountCurrencyRate !== 1 && (
                        <th className="text-right p-2">Amount (GEL)</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {localValue.map((row, index) => (
                      <tr key={row.jobUuid} className="border-t">
                        <td className="p-2">
                          <div className="font-medium">{row.jobName}</div>
                        </td>
                        <td className="p-2 text-muted-foreground">{row.factoryNo || '—'}</td>
                        <td className="p-2 text-right text-muted-foreground">
                          {row.sellingPrice ? row.sellingPrice.toFixed(2) : '—'}
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={row.percentage}
                            onChange={(e) => handlePercentageChange(index, e.target.value)}
                            className="text-right"
                            disabled={distributionMode === 'auto'}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={row.amount}
                            onChange={(e) => handleAmountChange(index, e.target.value)}
                            className="text-right"
                            disabled={distributionMode === 'auto'}
                          />
                        </td>
                        {accountCurrencyRate !== 1 && (
                          <td className="p-2 text-right text-muted-foreground">
                            {row.amountAccountCurr || '—'}
                          </td>
                        )}
                      </tr>
                    ))}
                    {/* Totals Row */}
                    <tr className="border-t bg-muted font-semibold">
                      <td colSpan={3} className="p-2">
                        Total
                      </td>
                      <td className="p-2 text-right">
                        <span className={totals.percentValid ? 'text-green-600' : 'text-red-600'}>
                          {totals.percent.toFixed(2)}%
                        </span>
                      </td>
                      <td className="p-2 text-right">
                        <span className={totals.amountValid ? 'text-green-600' : 'text-red-600'}>
                          {totals.amount.toFixed(2)}
                        </span>
                      </td>
                      {accountCurrencyRate !== 1 && (
                        <td className="p-2 text-right">{totals.amountAcct.toFixed(2)}</td>
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Validation Messages */}
              {!totals.percentValid && distributionMode === 'percentage' && (
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>Total percentage must equal 100%</span>
                </div>
              )}
              {!totals.amountValid && distributionMode === 'nominal' && (
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>Total amount must equal payment amount</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between pt-4">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleClear}
                  disabled={saving || distributionCount === 0}
                >
                  Clear All
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleSave()}
                    disabled={saving || (!totals.percentValid && distributionMode === 'percentage') || (!totals.amountValid && distributionMode === 'nominal')}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Distribution'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
