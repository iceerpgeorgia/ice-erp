'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Combobox } from '@/components/ui/combobox';
import { X, Plus, Check, AlertCircle } from 'lucide-react';

interface Payment {
  recordUuid: string;
  paymentId: string;
  label?: string | null;
  counteragentName: string;
  currencyCode: string;
  currencyUuid: string;
  projectUuid: string | null;
  financialCodeUuid: string | null;
  projectIndex: string | null;
  financialCode: string;
  counteragentUuid: string;
}

interface Partition {
  id: string;
  partitionAmount: number;
  paymentUuid: string | null;
  paymentId: string | null;
  paymentLabel?: string | null;
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

const BATCH_PAYMENT_ID_REGEX = /^BTC_[A-F0-9]{6}_[A-F0-9]{2}_[A-F0-9]{6}$/i;
const sanitizePaymentId = (value?: string | null) =>
  value && BATCH_PAYMENT_ID_REGEX.test(value) ? null : value ?? null;
const normalizePaymentId = (value: string) => value.trim().toLowerCase();

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const stripCounteragentFromLabel = (label?: string | null, counteragent?: string | null) => {
  if (!label) return null;
  if (!counteragent) return label.trim();
  const pattern = new RegExp(escapeRegExp(counteragent), 'ig');
  const cleaned = label
    .replace(pattern, '')
    .replace(/[\s\-–—|:]+/g, ' ')
    .trim();
  return cleaned || null;
};

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
      paymentLabel: null,
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
  const [paymentIdsInput, setPaymentIdsInput] = useState('');
  const [paymentLabelSelect, setPaymentLabelSelect] = useState('');
  const [missingPaymentIds, setMissingPaymentIds] = useState<string[]>([]);
  const [autoAddRemaining, setAutoAddRemaining] = useState(true);

  const filteredPayments = counteragentUuid
    ? payments.filter((payment) => payment.counteragentUuid === counteragentUuid)
    : payments;

  const counteragentLabel = counteragentUuid
    ? (filteredPayments[0]?.counteragentName || null)
    : null;

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
      const sanitized = initialPartitions.map((partition) => ({
        ...partition,
        paymentId: sanitizePaymentId(partition.paymentId),
      }));
      setPartitions(ensureTrailingPartition(sanitized));
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
            label: payment.label ?? payment.payment_label ?? null,
            counteragentName: payment.counteragentName || payment.counteragent_name || '',
            currencyCode: payment.currencyCode || payment.currency_code || '',
            currencyUuid: payment.currencyUuid || payment.currency_uuid || '',
            projectUuid: payment.projectUuid || payment.project_uuid || null,
            financialCodeUuid: payment.financialCodeUuid || payment.financial_code_uuid || null,
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
    if (!autoAddRemaining) return input;
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
        paymentLabel: null,
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
            paymentLabel: payment.label ?? null,
            counteragentUuid: payment.counteragentUuid || null,
            projectUuid: payment.projectUuid || null,
            financialCodeUuid: payment.financialCodeUuid || null,
            nominalCurrencyUuid: payment.currencyUuid || null,
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

  const appendPaymentIdToInput = (nextId: string) => {
    setPaymentIdsInput((prev) => {
      const existing = prev
        .split(/[,;\n]+/)
        .map((id) => id.trim())
        .filter(Boolean);
      if (existing.some((id) => normalizePaymentId(id) === normalizePaymentId(nextId))) {
        return prev;
      }
      return [...existing, nextId].join(', ');
    });
  };

  const handlePaymentLabelSelect = (value: string) => {
    setPaymentLabelSelect(value);
    const payment = payments.find((p) => p.recordUuid === value);
    if (payment?.paymentId) {
      appendPaymentIdToInput(payment.paymentId);
      setPaymentLabelSelect('');
    }
  };

  const handlePaymentIdChange = (partitionId: string, value: string) => {
    const trimmed = value.trim();
    setPartitions((prev) => {
      const updated = prev.map((partition) => {
        if (partition.id !== partitionId) return partition;
        if (!trimmed) {
          return {
            ...partition,
            paymentId: null,
            paymentUuid: null,
            paymentLabel: null,
            counteragentUuid: null,
            projectUuid: null,
            financialCodeUuid: null,
            nominalCurrencyUuid: null,
            nominalAmount: null,
          };
        }

        const payment = payments.find(
          (p) => normalizePaymentId(p.paymentId) === normalizePaymentId(trimmed)
        );

        if (!payment) {
          return {
            ...partition,
            paymentId: trimmed,
            paymentUuid: null,
            paymentLabel: null,
            counteragentUuid: null,
            projectUuid: null,
            financialCodeUuid: null,
            nominalCurrencyUuid: null,
            nominalAmount: null,
          };
        }

        const next = {
          ...partition,
          paymentId: payment.paymentId,
          paymentUuid: payment.recordUuid,
          paymentLabel: payment.label ?? null,
          counteragentUuid: payment.counteragentUuid || null,
          projectUuid: payment.projectUuid || null,
          financialCodeUuid: payment.financialCodeUuid || null,
          nominalCurrencyUuid: payment.currencyUuid || null,
        };
        return applyNominalForPartition(next, payment);
      });

      return ensureTrailingPartition(updated);
    });
  };

  const buildPartitionsFromPaymentIds = () => {
    const ids = paymentIdsInput
      .split(/[,;\n]+/)
      .map((id) => id.trim())
      .filter(Boolean);
    if (ids.length === 0) return;

    const paymentById = new Map(payments.map((payment) => [normalizePaymentId(payment.paymentId), payment]));
    const missing: string[] = [];
    const next = ids.map((id, idx) => {
      const payment = paymentById.get(normalizePaymentId(id)) || null;
      if (!payment) missing.push(id);
      const base: Partition = {
        id: String(idx + 1),
        partitionAmount: 0,
        paymentUuid: payment?.recordUuid ?? null,
        paymentId: payment?.paymentId ?? id,
        paymentLabel: payment?.label ?? null,
        counteragentUuid: payment?.counteragentUuid ?? null,
        projectUuid: payment?.projectUuid ?? null,
        financialCodeUuid: payment?.financialCodeUuid ?? null,
        nominalCurrencyUuid: payment?.currencyUuid ?? null,
        nominalAmount: null,
        partitionNote: '',
      };
      return payment ? applyNominalForPartition(base, payment) : base;
    });

    setMissingPaymentIds(missing);
    setAutoAddRemaining(false);
    setPartitions(next);
    setPaymentIdsInput('');
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
      const normalizedPartitions = partitions.map((partition) => {
        const sanitizedPaymentId = sanitizePaymentId(partition.paymentId);
        if (!partition.paymentUuid) {
          return {
            ...partition,
            paymentId: sanitizedPaymentId,
          };
        }
        const payment = payments.find((p) => p.recordUuid === partition.paymentUuid) || null;
        if (!payment) return partition;

        return {
          ...partition,
          paymentId: sanitizedPaymentId || payment.paymentId,
          counteragentUuid: partition.counteragentUuid || payment.counteragentUuid || null,
          projectUuid: partition.projectUuid || payment.projectUuid || null,
          financialCodeUuid: partition.financialCodeUuid || payment.financialCodeUuid || null,
          nominalCurrencyUuid: partition.nominalCurrencyUuid || payment.currencyUuid || null,
        };
      });

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
          partitions: normalizedPartitions.map((p) => ({
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

        <div className="mb-6 rounded-lg border bg-gray-50 dark:bg-gray-900 p-4">
          <div className="grid grid-cols-1 gap-3">
            {counteragentLabel && (
              <div className="text-sm">
                <span className="font-medium">Counteragent:</span> {counteragentLabel}
              </div>
            )}
            <div>
              <Label htmlFor="payment-label-select">Add payment by label</Label>
              <Combobox
                options={filteredPayments.map((p) => ({
                  value: p.recordUuid,
                  label: `${stripCounteragentFromLabel(p.label, counteragentLabel ?? p.counteragentName) ? `${stripCounteragentFromLabel(p.label, counteragentLabel ?? p.counteragentName)} — ` : ''}${p.paymentId} | ${p.projectIndex || 'No Project'}`,
                }))}
                value={paymentLabelSelect}
                onValueChange={handlePaymentLabelSelect}
                placeholder="Select payment by label..."
                searchPlaceholder="Search by label or payment ID..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Selecting a payment adds its ID to the list below.
              </p>
            </div>
            <div>
              <Label htmlFor="payment-ids-input">Payment IDs (comma-separated)</Label>
              <Textarea
                id="payment-ids-input"
                value={paymentIdsInput}
                onChange={(e) => setPaymentIdsInput(e.target.value)}
                placeholder="e.g. 12ab34_cd_56ef78, 90ab12_cd_34ef56"
                rows={3}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" size="sm" onClick={buildPartitionsFromPaymentIds}>
                Create Partitions from Payment IDs
              </Button>
              <p className="text-xs text-muted-foreground">
                Creates one partition per payment ID so you only enter amounts.
              </p>
            </div>
            {missingPaymentIds.length > 0 && (
              <div className="text-xs text-red-600">
                Missing payments: {missingPaymentIds.join(', ')}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 mb-6">
          {partitions.map((partition, index) => {
            const matchedPayment =
              payments.find((p) => p.recordUuid === partition.paymentUuid) ||
              payments.find((p) =>
                normalizePaymentId(p.paymentId) === normalizePaymentId(partition.paymentId ?? '')
              );
            const paymentLabel = stripCounteragentFromLabel(
              partition.paymentLabel ?? matchedPayment?.label ?? null,
              counteragentLabel ?? matchedPayment?.counteragentName ?? null
            );

            return (
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
                  <div className="space-y-2">
                    <Input
                      id={`payment-${partition.id}`}
                      value={partition.paymentId ?? ''}
                      onChange={(e) => handlePaymentIdChange(partition.id, e.target.value)}
                      placeholder="Enter payment ID or pick from the list"
                    />
                    <Combobox
                      options={filteredPayments.map((p) => ({
                        value: p.recordUuid,
                        label: `${stripCounteragentFromLabel(p.label, counteragentLabel ?? p.counteragentName) ? `${stripCounteragentFromLabel(p.label, counteragentLabel ?? p.counteragentName)} — ` : ''}${p.paymentId} | ${p.projectIndex || 'No Project'}`,
                      }))}
                      value={partition.paymentUuid || ''}
                      onValueChange={(value) => selectPayment(partition.id, value)}
                      placeholder="Select payment..."
                      searchPlaceholder="Search payments..."
                    />
                    {paymentLabel && (
                      <p className="text-xs text-muted-foreground">Label: {paymentLabel}</p>
                    )}
                  </div>
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
            );
          })}
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
