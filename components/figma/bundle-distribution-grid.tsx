"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { AlertCircle, Loader2 } from 'lucide-react';

export type BundleDistributionRow = {
  financialCodeUuid: string;
  financialCodeName: string;
  percentage: string;
  amount: string;
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
  const [childFinancialCodes, setChildFinancialCodes] = useState<Array<{
    uuid: string;
    code: string;
    name: string;
    validation: string | null;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [distributionMode, setDistributionMode] = useState<'percentage' | 'amount' | 'none'>('none');

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
              financialCodeName: fc.name,
              percentage: '',
              amount: ''
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

  // Detect distribution mode based on entered values
  useEffect(() => {
    const hasPercentage = value.some(row => row.percentage && parseFloat(row.percentage) > 0);
    const hasAmount = value.some(row => row.amount && parseFloat(row.amount) > 0);

    if (hasPercentage) {
      setDistributionMode('percentage');
    } else if (hasAmount) {
      setDistributionMode('amount');
    } else {
      setDistributionMode('none');
    }
  }, [value]);

  // Calculate totals
  const totals = useMemo(() => {
    const percentageSum = value.reduce((sum, row) => {
      const pct = parseFloat(row.percentage) || 0;
      return sum + pct;
    }, 0);

    const amountSum = value.reduce((sum, row) => {
      const amt = parseFloat(row.amount) || 0;
      return sum + amt;
    }, 0);

    return { percentageSum, amountSum };
  }, [value]);

  const handlePercentageChange = (index: number, newPercentage: string) => {
    if (disabled) return;

    const updated = [...value];
    updated[index].percentage = newPercentage;

    // If user enters percentage, calculate amount and clear amounts from other rows
    if (newPercentage && parseFloat(newPercentage) > 0) {
      const pct = parseFloat(newPercentage);
      updated[index].amount = ((projectValue * pct) / 100).toFixed(2);
      
      // Clear amounts for rows without percentage
      updated.forEach(row => {
        if (!row.percentage || parseFloat(row.percentage) === 0) {
          row.amount = '';
        }
      });
    } else {
      updated[index].amount = '';
    }

    onChange(updated);
  };

  const handleAmountChange = (index: number, newAmount: string) => {
    if (disabled) return;

    const updated = [...value];
    updated[index].amount = newAmount;

    // If user enters amount, clear ALL percentages
    if (newAmount && parseFloat(newAmount) > 0) {
      updated.forEach(row => {
        row.percentage = '';
      });
    }

    onChange(updated);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading financial codes...</span>
      </div>
    );
  }

  if (childFinancialCodes.length === 0) {
    return (
      <div className="flex items-center p-4 text-sm text-gray-500">
        <AlertCircle className="h-4 w-4 mr-2" />
        No child financial codes found for this bundle.
      </div>
    );
  }

  const percentageValid = Math.abs(totals.percentageSum - 100) < 0.01;
  const amountValid = Math.abs(totals.amountSum - projectValue) < 0.01;

  return (
    <div className="space-y-4">
      <Label className="text-sm font-semibold">Bundle Distribution</Label>
      
      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Financial Code</th>
              <th className="px-4 py-2 text-left font-medium">Percentage (%)</th>
              <th className="px-4 py-2 text-left font-medium">Sum</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {value.map((row, index) => (
              <tr key={row.financialCodeUuid} className="hover:bg-gray-50">
                <td className="px-4 py-2">
                  {row.financialCodeName}
                </td>
                <td className="px-4 py-2">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={row.percentage}
                    onChange={(e) => handlePercentageChange(index, e.target.value)}
                    disabled={disabled || distributionMode === 'amount'}
                    className="w-24"
                  />
                </td>
                <td className="px-4 py-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.amount}
                    onChange={(e) => handleAmountChange(index, e.target.value)}
                    disabled={disabled || distributionMode === 'percentage'}
                    className="w-32"
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 font-semibold">
            <tr>
              <td className="px-4 py-2">Total</td>
              <td className={`px-4 py-2 ${distributionMode === 'percentage' && !percentageValid ? 'text-red-600' : ''}`}>
                {totals.percentageSum.toFixed(2)}%
              </td>
              <td className={`px-4 py-2 ${distributionMode === 'amount' && !amountValid ? 'text-red-600' : ''}`}>
                {totals.amountSum.toFixed(2)}
              </td>
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

      {distributionMode === 'percentage' && (
        <div className="text-xs text-gray-500">
          Percentage mode: Enter percentages and sums will be calculated automatically.
        </div>
      )}

      {distributionMode === 'amount' && (
        <div className="text-xs text-gray-500">
          Amount mode: Enter specific amounts directly (percentages disabled).
        </div>
      )}
    </div>
  );
}
