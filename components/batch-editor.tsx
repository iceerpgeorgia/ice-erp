'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import { X, Plus, Check, AlertCircle } from 'lucide-react';

interface Payment {
  recordUuid: string;
  paymentId: string;
  counteragentName: string;
  currencyCode: string;
  currencyUuid: string;
  projectIndex: string | null;
  financialCode: string;
  counteragentUuid: string;
}

interface Partition {
  id: string;
  partitionAmount: number;
  paymentUuid: string | null;
  paymentId: string | null;
  counteragentUuid: string | null;
  projectUuid: string | null;
  financialCodeUuid: string | null;
  nominalCurrencyUuid: string | null;
  nominalAmount: number | null;
  partitionNote: string;
}

interface BatchEditorProps {
  batchUuid?: string | null;
  initialPartitions?: Partition[];
  rawRecordUuid: string;
  rawRecordId1: string;
  rawRecordId2: string;
  bankAccountUuid: string;
  counteragentUuid?: string | null;
  accountCurrencyUuid?: string | null;
  accountCurrencyCode?: string | null;
  transactionDate?: string | null;
  totalAmount: number;
  description: string;
  onClose: () => void;
  onSave: () => void;
}

export function BatchEditor({
  batchUuid = null,
  initialPartitions,
  rawRecordUuid,
  rawRecordId1,
  rawRecordId2,
  bankAccountUuid,
  counteragentUuid = null,
  accountCurrencyUuid = null,
  accountCurrencyCode = null,
  transactionDate = null,
  totalAmount,
  description,
  onClose,
  onSave,
}: BatchEditorProps) {
  const [partitions, setPartitions] = useState<Partition[]>([
    {
      id: '1',
      partitionAmount: totalAmount,
      paymentUuid: null,
      paymentId: null,
      counteragentUuid: null,
      projectUuid: null,
      financialCodeUuid: null,
      nominalCurrencyUuid: null,
      nominalAmount: null,
      partitionNote: '',
    },
  ]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [currencyMap, setCurrencyMap] = useState<Record<string, string>>({});
  const [exchangeRates, setExchangeRates] = useState<any | null>(null);

  const filteredPayments = counteragentUuid
    ? payments.filter((payment) => payment.counteragentUuid === counteragentUuid)
    : payments;

  const resolvedAccountCurrencyCode =
    accountCurrencyCode || (accountCurrencyUuid ? currencyMap[accountCurrencyUuid] : undefined) || 'GEL';

  const toDateInput = (value?: string | null) => {
    if (!value) return '';
    const trimmed = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(trimmed)) {
      const [day, month, year] = trimmed.split('.');
      return `${year}-${month}-${day}`;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
    return '';
  };

  useEffect(() => {
    fetchPayments();
    fetchCurrencies();
  }, []);

  useEffect(() => {
    if (!transactionDate) return;
    const effectiveDate = toDateInput(transactionDate);
    if (!effectiveDate) return;
    fetchExchangeRates(effectiveDate);
  }, [transactionDate]);

  useEffect(() => {
    if (initialPartitions && initialPartitions.length > 0) {
      setPartitions(ensureTrailingPartition(initialPartitions));
    }
  }, [initialPartitions]);

  const fetchPayments = async () => {
    try {
      const response = await fetch('/api/payments');
      const data = await response.json();
      const normalized: Payment[] = Array.isArray(data)
        ? data.map((payment: any) => ({
            recordUuid: payment.recordUuid || payment.record_uuid || '',
            paymentId: payment.paymentId || payment.payment_id || '',
            counteragentName: payment.counteragentName || payment.counteragent_name || '',
            currencyCode: payment.currencyCode || payment.currency_code || '',
            currencyUuid: payment.currencyUuid || payment.currency_uuid || '',
            projectIndex: payment.projectIndex || payment.project_index || null,
            financialCode: payment.financialCode || payment.financial_code || '',
            counteragentUuid: payment.counteragentUuid || payment.counteragent_uuid || '',
          }))
        : [];
      setPayments(normalized);
    } catch (error) {
      console.error('Error fetching payments:', error);
    }
  };

  const fetchCurrencies = async () => {
    try {
      const response = await fetch('/api/currencies');
      const result = await response.json();
      const rows = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
      const nextMap: Record<string, string> = {};
      rows.forEach((currency: any) => {
        if (currency?.uuid && currency?.code) {
          nextMap[currency.uuid] = currency.code;
        }
      });
      setCurrencyMap(nextMap);
    } catch (error) {
      console.error('Error fetching currencies:', error);
    }
  };

  const fetchExchangeRates = async (date: string) => {
    try {
      const response = await fetch(`/api/exchange-rates?date=${date}`);
      if (!response.ok) return;
      const ratesData = await response.json();
      const rates = Array.isArray(ratesData) && ratesData.length > 0 ? ratesData[0] : null;
      setExchangeRates(rates);
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
    }
  };

  const getCurrencyCode = (currencyUuid?: string | null, fallbackCode?: string) => {
    if (fallbackCode) return fallbackCode;
    if (!currencyUuid) return undefined;
    return currencyMap[currencyUuid];
  };

  const getExchangeRate = (paymentCurrencyUuid?: string | null, paymentCurrencyCode?: string) => {
    const accountCode = resolvedAccountCurrencyCode;
    const paymentCode = getCurrencyCode(paymentCurrencyUuid, paymentCurrencyCode);
    if (!paymentCode || !accountCode) return null;
    if (!exchangeRates) return null;
    if (accountCode === paymentCode) return 1;

    const getRate = (code: string) =>
      exchangeRates?.[code.toLowerCase()] ?? exchangeRates?.[`${code.toLowerCase()}_rate`];

    if (accountCode === 'GEL' && paymentCode !== 'GEL') {
      const rate = getRate(paymentCode);
      return rate ? Number(rate) : null;
    }

    if (accountCode !== 'GEL' && paymentCode === 'GEL') {
      const rate = getRate(accountCode);
      return rate ? Number(rate) : null;
    }

    const accountRate = getRate(accountCode);
    const paymentRate = getRate(paymentCode);
    if (!accountRate || !paymentRate) return null;
    return Number(accountRate) / Number(paymentRate);
  };

  const convertAccountToNominal = (amount: number, paymentCurrencyUuid?: string | null, paymentCurrencyCode?: string) => {
    const rate = getExchangeRate(paymentCurrencyUuid, paymentCurrencyCode);
    if (!rate) return null;
    return Number(amount) * (1 / rate);
  };

  const convertNominalToAccount = (amount: number, paymentCurrencyUuid?: string | null, paymentCurrencyCode?: string) => {
    const rate = getExchangeRate(paymentCurrencyUuid, paymentCurrencyCode);
    if (!rate) return null;
    return Number(amount) / (1 / rate);
  };

  const applyNominalForPartition = (partition: Partition, payment?: Payment | null) => {
    if (!payment) {
      return {
        ...partition,
        nominalAmount: null,
        nominalCurrencyUuid: null,
      };
    }

    const nominalAmount = convertAccountToNominal(partition.partitionAmount, payment.currencyUuid, payment.currencyCode);
    return {
      ...partition,
      nominalAmount: nominalAmount !== null ? Number(nominalAmount.toFixed(2)) : null,
      nominalCurrencyUuid: payment.currencyUuid || null,
    };
  };

  const ensureTrailingPartition = (input: Partition[]) => {
    const totalAllocated = input.reduce((sum, p) => sum + (Number(p.partitionAmount) || 0), 0);
    const remaining = Number((totalAmount - totalAllocated).toFixed(2));
    if (remaining > 0.01) {
      const last = input[input.length - 1];
      if (
        last &&
        !last.paymentUuid &&
        !last.paymentId &&
        !last.partitionNote &&
        !last.nominalAmount &&
        !last.nominalCurrencyUuid &&
        Number(last.partitionAmount) === 0
      ) {
        return input.map((partition, idx) =>
          idx === input.length - 1 ? { ...partition, partitionAmount: remaining } : partition
        );
      }
      const nextId = String(input.length + 1);
      return [
        ...input,
        {
          id: nextId,
          partitionAmount: remaining,
          paymentUuid: null,
          paymentId: null,
          counteragentUuid: null,
          projectUuid: null,
          financialCodeUuid: null,
          nominalCurrencyUuid: null,
          nominalAmount: null,
          partitionNote: '',
        },
      ];
    }
    return input;
  };

  const addPartition = () => {
    const newId = String(partitions.length + 1);
    setPartitions(ensureTrailingPartition([
      ...partitions,
      {
        id: newId,
        partitionAmount: 0,
        paymentUuid: null,
        paymentId: null,
        counteragentUuid: null,
        projectUuid: null,
        financialCodeUuid: null,
        nominalCurrencyUuid: null,
        nominalAmount: null,
        partitionNote: '',
      },
    ]));
  };

  const removePartition = (id: string) => {
    if (partitions.length > 1) {
      setPartitions(ensureTrailingPartition(partitions.filter((p) => p.id !== id)));
    }
  };

  const updatePartition = (id: string, field: keyof Partition, value: any) => {
    const updated = partitions.map((partition) => {
      if (partition.id !== id) return partition;
      return { ...partition, [field]: value };
    });

    const recalculated = updated.map((partition) => {
      if (!partition.paymentUuid) return partition;
      if (field !== 'partitionAmount') return partition;
      const payment = payments.find((p) => p.recordUuid === partition.paymentUuid) || null;
      return applyNominalForPartition(partition, payment);
    });

    setPartitions(ensureTrailingPartition(recalculated));
  };

  const selectPayment = (partitionId: string, paymentUuid: string) => {
    const payment = payments.find((p) => p.recordUuid === paymentUuid);
    if (payment) {
      setPartitions((prev) => {
        const updated = prev.map((partition) => {
          if (partition.id !== partitionId) return partition;
          const next = {
            ...partition,
            paymentUuid: payment.recordUuid,
            paymentId: payment.paymentId,
          };
          return applyNominalForPartition(next, payment);
        });
        return ensureTrailingPartition(updated);
      });
    }
  };

  const handleNominalChange = (partitionId: string, value: string) => {
    const nominal = parseFloat(value);
    setPartitions((prev) => {
      const updated = prev.map((partition) => {
        if (partition.id !== partitionId) return partition;
        if (!partition.paymentUuid) return partition;
        const payment = payments.find((p) => p.recordUuid === partition.paymentUuid) || null;
        if (!payment) return partition;
        const accountAmount = Number.isNaN(nominal)
          ? null
          : convertNominalToAccount(nominal, payment.currencyUuid, payment.currencyCode);
        const nextPartitionAmount = accountAmount !== null ? Number(accountAmount.toFixed(2)) : partition.partitionAmount;
        return {
          ...partition,
          nominalAmount: Number.isNaN(nominal) ? null : nominal,
          nominalCurrencyUuid: payment.currencyUuid || null,
          partitionAmount: nextPartitionAmount,
        };
      });
      return ensureTrailingPartition(updated);
    });
  };

  useEffect(() => {
    if (!exchangeRates) return;
    if (payments.length === 0) return;
    setPartitions((prev) =>
      prev.map((partition) => {
        if (!partition.paymentUuid) return partition;
        if (partition.nominalAmount !== null && partition.nominalAmount !== undefined) return partition;
        const payment = payments.find((p) => p.recordUuid === partition.paymentUuid) || null;
        if (!payment) return partition;
        return applyNominalForPartition(partition, payment);
      })
    );
  }, [exchangeRates, payments]);

  const calculateRemaining = () => {
    const allocated = partitions.reduce(
      (sum, p) => sum + (parseFloat(String(p.partitionAmount)) || 0),
      0
    );
    return totalAmount - allocated;
  };

  const isValid = () => {
    const remaining = calculateRemaining();
    return Math.abs(remaining) < 0.01 && partitions.every((p) => p.partitionAmount > 0);
  };

  const handleSave = async () => {
    if (!isValid()) {
      alert('Partitions must sum to total amount and all amounts must be positive');
      return;
    }

    setLoading(true);
    try {
      if (batchUuid) {
        await fetch(`/api/bank-transaction-batches?batchUuid=${batchUuid}`, {
          method: 'DELETE',
        });
      }
      const response = await fetch('/api/bank-transaction-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankAccountUuid,
          rawRecordId1,
          rawRecordId2,
          rawRecordUuid,
          partitions: partitions.map((p) => ({
            partitionAmount: p.partitionAmount,
            paymentUuid: p.paymentUuid,
            paymentId: p.paymentId,
            counteragentUuid: p.counteragentUuid,
            projectUuid: p.projectUuid,
            financialCodeUuid: p.financialCodeUuid,
            nominalCurrencyUuid: p.nominalCurrencyUuid,
            nominalAmount: p.nominalAmount,
            partitionNote: p.partitionNote,
          })),
        }),
      });

      if (response.ok) {
        onSave();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error saving batch:', error);
      alert('Failed to save batch');
    } finally {
      setLoading(false);
    }
  };

  const remaining = calculateRemaining();
  const valid = isValid();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[95vw] max-w-6xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Split Transaction into Batches</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Transaction ID:</span> {rawRecordId1}_{rawRecordId2}
            </div>
            <div>
              <span className="font-medium">Total Amount:</span> {totalAmount.toFixed(2)} GEL
            </div>
            <div className="col-span-2">
              <span className="font-medium">Description:</span> {description}
            </div>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Partitions</h3>
          <div className="flex items-center gap-4">
            <div className={`text-sm font-medium ${Math.abs(remaining) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
              {remaining > 0 ? `Remaining: ${remaining.toFixed(2)} GEL` : remaining < 0 ? `Over by: ${Math.abs(remaining).toFixed(2)} GEL` : '✓ Balanced'}
            </div>
            <Button onClick={addPartition} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Partition
            </Button>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          {partitions.map((partition, index) => (
            <div key={partition.id} className="border rounded-lg p-4 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-medium">Partition {index + 1}</h4>
                {partitions.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePartition(partition.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`amount-${partition.id}`}>Amount (GEL)</Label>
                  <Input
                    id={`amount-${partition.id}`}
                    type="number"
                    step="0.01"
                    value={partition.partitionAmount}
                    onChange={(e) =>
                      updatePartition(partition.id, 'partitionAmount', parseFloat(e.target.value) || 0)
                    }
                  />
                </div>

                <div>
                  <Label htmlFor={`nominal-${partition.id}`}>Nominal Amount</Label>
                  <Input
                    id={`nominal-${partition.id}`}
                    type="number"
                    step="0.01"
                    value={partition.nominalAmount !== null ? partition.nominalAmount : ''}
                    onChange={(e) => handleNominalChange(partition.id, e.target.value)}
                    disabled={!partition.paymentUuid}
                  />
                  <p className="text-xs text-muted-foreground">
                    {partition.nominalCurrencyUuid
                      ? getCurrencyCode(partition.nominalCurrencyUuid) || ''
                      : ''}
                  </p>
                </div>

                <div className="col-span-2">
                  <Label htmlFor={`payment-${partition.id}`}>Payment ID</Label>
                  <Combobox
                    options={filteredPayments.map((p) => ({
                      value: p.recordUuid,
                      label: `${p.paymentId} | ${p.counteragentName} | ${p.currencyCode} | ${p.projectIndex || 'No Project'} | ${p.financialCode}`,
                    }))}
                    value={partition.paymentUuid || ''}
                    onValueChange={(value) => selectPayment(partition.id, value)}
                    placeholder="Select payment..."
                    searchPlaceholder="Search payments..."
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor={`note-${partition.id}`}>Note (Optional)</Label>
                  <Input
                    id={`note-${partition.id}`}
                    value={partition.partitionNote}
                    onChange={(e) =>
                      updatePartition(partition.id, 'partitionNote', e.target.value)
                    }
                    placeholder="Add a note about this partition..."
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {!valid && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <span>Partitions must sum to {totalAmount.toFixed(2)} GEL and all amounts must be positive</span>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!valid || loading}>
            {loading ? 'Saving...' : 'Save Batch'}
          </Button>
        </div>
      </div>
    </div>
  );
}
