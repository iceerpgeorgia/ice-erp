"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { AlertCircle, Loader2, LayoutGrid } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';

export type BundleDistributionRow = {
  financialCodeUuid: string;
  financialCodeName: string;
  percentage: string;
  amount: string;
  paymentId?: string | null;
  distributionDate: string;
};

type BundleDistributionGridProps = {
  bundleFinancialCodeUuid: string;
  projectValue: number;
  value: BundleDistributionRow[];
  onChange: (distribution: BundleDistributionRow[]) => void;
  disabled?: boolean;
};

export function BundleDistributionGrid({
  bundleFinancialCodeUuid,
  projectValue,
  value,
  onChange,
  disabled = false
}: BundleDistributionGridProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [childFinancialCodes, setChildFinancialCodes] = useState<Array<{
    uuid: string;
    code: string;
    name: string;
    validation: string | null;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [localValue, setLocalValue] = useState<BundleDistributionRow[]>([]);
  const [distributionMode, setDistributionMode] = useState<'percentage' | 'amount' | 'none'>('none');
  
  // Helper to format today's date as dd.mm.yyyy
  const getTodayFormatted = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  };

  // Fetch child financial codes when bundle FC changes
  useEffect(() => {
    if (!bundleFinancialCodeUuid) {
      setChildFinancialCodes([]);
      return;
    }

    setLoading(true);
    fetch(`/api/financial-codes/children/${bundleFinancialCodeUuid}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setChildFinancialCodes(data);

          // Initialize distribution if empty
          if (value.length === 0) {
            const initialDistribution = data.map(fc => ({
              financialCodeUuid: fc.uuid,
              financialCodeName: `${fc.code} - ${fc.name}`,
              percentage: '',
              amount: '',
              paymentId: null,
              distributionDate: '', // Leave blank, will use current date only if user doesn't fill
            }));
            onChange(initialDistribution);
          }
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading child financial codes:', err);
        setLoading(false);
      });
  }, [bundleFinancialCodeUuid]);

  // Sync local state when dialog opens (don't auto-fill dates)
  useEffect(() => {
    if (isOpen) {
      setLocalValue(value);
    }
  }, [isOpen, value]);

  // Detect distribution mode based on entered values
  useEffect(() => {
    const hasPercentage = localValue.some(row => row.percentage && parseFloat(row.percentage) > 0);
    const hasAmount = localValue.some(row => row.amount && parseFloat(row.amount) > 0);

    if (hasPercentage) {
      setDistributionMode('percentage');
    } else if (hasAmount) {
      setDistributionMode('amount');
    } else {
      setDistributionMode('none');
    }
  }, [localValue]);

  // Calculate totals
  const totals = useMemo(() => {
    const percentageSum = localValue.reduce((sum, row) => {
      const pct = parseFloat(row.percentage) || 0;
      return sum + pct;
    }, 0);

    const amountSum = localValue.reduce((sum, row) => {
      const amt = parseFloat(row.amount) || 0;
      return sum + amt;
    }, 0);

    return { percentageSum, amountSum };
  }, [localValue]);

  const handlePercentageChange = (index: number, newPercentage: string) => {
    if (disabled) return;

    const updated = [...localValue];
    updated[index] = { ...updated[index], percentage: newPercentage };

    if (newPercentage && parseFloat(newPercentage) > 0) {
      const pct = parseFloat(newPercentage);
      updated[index].amount = ((projectValue * pct) / 100).toFixed(2);

      updated.forEach((row, i) => {
        if (i !== index && (!row.percentage || parseFloat(row.percentage) === 0)) {
          updated[i] = { ...updated[i], amount: '' };
        }
      });
    } else {
      updated[index].amount = '';
    }

    setLocalValue(updated);
  };

  const handleAmountChange = (index: number, newAmount: string) => {
    if (disabled) return;

    const updated = [...localValue];
    updated[index] = { ...updated[index], amount: newAmount };

    if (newAmount && parseFloat(newAmount) > 0) {
      updated.forEach((row, i) => {
        updated[i] = { ...updated[i], percentage: '' };
      });
    }

    setLocalValue(updated);
  };

  const handleApply = () => {
    onChange(localValue);
    setIsOpen(false);
  };
  
  const handleDateChange = (index: number, newDate: string) => {
    if (disabled) return;
    const updated = [...localValue];
    updated[index] = { ...updated[index], distributionDate: newDate };
    setLocalValue(updated);
  };

  const filledCount = value.filter(r => (r.percentage && parseFloat(r.percentage) > 0) || (r.amount && parseFloat(r.amount) > 0)).length;
  const totalCount = value.length || childFinancialCodes.length;
  const hasPayments = value.some(r => r.paymentId);

  const percentageValid = Math.abs(totals.percentageSum - 100) < 0.01;
  const amountValid = Math.abs(totals.amountSum - projectValue) < 0.01;

  if (loading) {
    return (
      <div className="flex items-center p-2">
        <Loader2 className="h-4 w-4 animate-spin text-gray-400 mr-2" />
        <span className="text-sm text-gray-500">Loading distribution...</span>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsOpen(true)}
          disabled={disabled}
          className="gap-2"
        >
          <LayoutGrid className="h-4 w-4" />
          Bundle Distribution
          {totalCount > 0 && (
            <Badge variant={filledCount === totalCount && filledCount > 0 ? 'default' : 'secondary'} className="ml-1">
              {filledCount}/{totalCount}
            </Badge>
          )}
        </Button>
        {hasPayments && (
          <span className="text-xs text-muted-foreground">Payments exist</span>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bundle Distribution</DialogTitle>
            <DialogDescription>
              Distribute the project value ({projectValue.toFixed(2)}) across child financial codes.
              {distributionMode === 'percentage' && ' Enter percentages — amounts calculate automatically.'}
              {distributionMode === 'amount' && ' Enter amounts directly.'}
            </DialogDescription>
          </DialogHeader>

          {childFinancialCodes.length === 0 ? (
            <div className="flex items-center p-4 text-sm text-gray-500">
              <AlertCircle className="h-4 w-4 mr-2" />
              No child financial codes found for this bundle.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Financial Code</th>
                      <th className="px-3 py-2 text-left font-medium w-24">%</th>
                      <th className="px-3 py-2 text-left font-medium w-32">Amount</th>
                      <th className="px-3 py-2 text-left font-medium w-28">Date</th>
                      <th className="px-3 py-2 text-left font-medium w-40">Payment ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {localValue.map((row, index) => (
                      <tr key={row.financialCodeUuid} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-xs">
                          {row.financialCodeName}
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={row.percentage}
                            onChange={(e) => handlePercentageChange(index, e.target.value)}
                            disabled={disabled || distributionMode === 'amount'}
                            className="w-20 h-8 text-xs"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.amount}
                            onChange={(e) => handleAmountChange(index, e.target.value)}
                            disabled={disabled || distributionMode === 'percentage'}
                            className="w-28 h-8 text-xs"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="text"
                            placeholder="dd.mm.yyyy"
                            value={row.distributionDate}
                            onChange={(e) => handleDateChange(index, e.target.value)}
                            disabled={disabled}
                            className="w-24 h-8 text-xs"
                            maxLength={10}
                          />
                        </td>
                        <td className="px-3 py-2">
                          {row.paymentId ? (
                            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                              {row.paymentId}
                            </code>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 font-semibold text-sm">
                    <tr>
                      <td className="px-3 py-2">Total</td>
                      <td className={`px-3 py-2 ${distributionMode === 'percentage' && !percentageValid ? 'text-red-600' : ''}`}>
                        {totals.percentageSum.toFixed(2)}%
                      </td>
                      <td className={`px-3 py-2 ${distributionMode === 'amount' && !amountValid ? 'text-red-600' : ''}`}>
                        {totals.amountSum.toFixed(2)}
                      </td>
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2" />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {distributionMode === 'percentage' && !percentageValid && (
                <div className="flex items-center text-sm text-red-600">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Total percentage must equal 100%
                </div>
              )}

              {distributionMode === 'amount' && !amountValid && (
                <div className="flex items-center text-sm text-red-600">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Total amount must equal project value ({projectValue.toFixed(2)})
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                <Button onClick={handleApply} disabled={disabled}>Apply</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
