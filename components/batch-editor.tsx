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
  projectIndex: string | null;
  financialCode: string;
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
  rawRecordUuid: string;
  rawRecordId1: string;
  rawRecordId2: string;
  bankAccountUuid: string;
  totalAmount: number;
  description: string;
  onClose: () => void;
  onSave: () => void;
}

export function BatchEditor({
  rawRecordUuid,
  rawRecordId1,
  rawRecordId2,
  bankAccountUuid,
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

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const response = await fetch('/api/payments');
      const data = await response.json();
      setPayments(data);
    } catch (error) {
      console.error('Error fetching payments:', error);
    }
  };

  const addPartition = () => {
    const newId = String(partitions.length + 1);
    setPartitions([
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
    ]);
  };

  const removePartition = (id: string) => {
    if (partitions.length > 1) {
      setPartitions(partitions.filter((p) => p.id !== id));
    }
  };

  const updatePartition = (id: string, field: keyof Partition, value: any) => {
    setPartitions(
      partitions.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const selectPayment = (partitionId: string, paymentUuid: string) => {
    const payment = payments.find((p) => p.recordUuid === paymentUuid);
    if (payment) {
      updatePartition(partitionId, 'paymentUuid', payment.recordUuid);
      updatePartition(partitionId, 'paymentId', payment.paymentId);
      // Note: We'll need to fetch full payment details for UUIDs
    }
  };

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
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
                  <Label htmlFor={`payment-${partition.id}`}>Payment ID</Label>
                  <Combobox
                    items={payments.map((p) => ({
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
