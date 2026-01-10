'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { BatchEditor } from '@/components/batch-editor';
import { Plus, Split } from 'lucide-react';

interface RawRecord {
  uuid: string;
  dockey: string;
  entriesid: string;
  docvaluedate: string;
  docnomination: string;
  entrydbamt: number | null;
  entrycramt: number | null;
  accountCurrencyAmount: number;
  bankAccountUuid: string;
  hasBatch: boolean;
  batchCount: number;
}

export default function BankTransactionBatchesPage() {
  const [records, setRecords] = useState<RawRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RawRecord | null>(null);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/raw-bog-gel-records?limit=100');
      const data = await response.json();
      
      // Check each record for existing batches
      const recordsWithBatchStatus = await Promise.all(
        data.map(async (record: any) => {
          const batchResponse = await fetch(
            `/api/bank-transaction-batches?rawRecordUuid=${record.uuid}`
          );
          const batchData = await batchResponse.json();
          
          return {
            uuid: record.uuid,
            dockey: record.dockey,
            entriesid: record.entriesid,
            docvaluedate: record.docvaluedate,
            docnomination: record.docnomination,
            entrydbamt: record.entrydbamt,
            entrycramt: record.entrycramt,
            accountCurrencyAmount: (record.entrycramt || 0) - (record.entrydbamt || 0),
            bankAccountUuid: record.bank_account_uuid,
            hasBatch: batchData.hasBatch || false,
            batchCount: batchData.batchCount || 0,
          };
        })
      );
      
      setRecords(recordsWithBatchStatus);
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setLoading(false);
    }
  };

  const openEditor = (record: RawRecord | null = null) => {
    setSelectedRecord(record);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setSelectedRecord(null);
  };

  const handleSave = () => {
    closeEditor();
    fetchRecords();
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Bank Transaction Batches</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Split bank transactions into multiple payment allocations
          </p>
        </div>
        <Button onClick={() => openEditor(null)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Batch
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Transaction ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Amount</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {records.map((record) => (
                <tr key={record.uuid} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                  <td className="px-4 py-3 text-sm">{record.docvaluedate}</td>
                  <td className="px-4 py-3 text-sm font-mono">
                    {record.dockey}_{record.entriesid}
                  </td>
                  <td className="px-4 py-3 text-sm max-w-md truncate">
                    {record.docnomination}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium">
                    {record.accountCurrencyAmount.toFixed(2)} GEL
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    {record.hasBatch ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {record.batchCount} Batch{record.batchCount > 1 ? 'es' : ''}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                        No Batch
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditor(record)}
                    >
                      <Split className="h-4 w-4 mr-2" />
                      {record.hasBatch ? 'Edit' : 'Split'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      {editorOpen && selectedRecord && (
        <BatchEditor
          rawRecordUuid={selectedRecord.uuid}
          rawRecordId1={selectedRecord.dockey}
          rawRecordId2={selectedRecord.entriesid}
          bankAccountUuid={selectedRecord.bankAccountUuid}
          totalAmount={Math.abs(selectedRecord.accountCurrencyAmount)}
          description={selectedRecord.docnomination}
          onClose={closeEditor}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
