'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function PaymentStatementPage() {
  const params = useParams();
  const paymentId = params.paymentId as string;
  const [statementData, setStatementData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatement = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/payment-statement?paymentId=${paymentId}`);
        if (!response.ok) throw new Error('Failed to fetch statement');
        const result = await response.json();
        setStatementData(result);
      } catch (err: any) {
        setError(err.message || 'Failed to load statement');
      } finally {
        setLoading(false);
      }
    };

    if (paymentId) {
      fetchStatement();
    }
  }, [paymentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading statement...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  if (!statementData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">No data available</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
          {/* Header */}
          <div className="border-b pb-4">
            <h1 className="text-2xl font-bold">Payment Statement</h1>
            <p className="text-gray-600 mt-1">Payment ID: {statementData.payment.paymentId}</p>
          </div>

          {/* Payment Info */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-3 text-lg">Payment Information</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600 block">Payment ID</span>
                <span className="font-medium">{statementData.payment.paymentId}</span>
              </div>
              <div>
                <span className="text-gray-600 block">Project</span>
                <span className="font-medium">{statementData.payment.project || '-'}</span>
              </div>
              <div>
                <span className="text-gray-600 block">Counteragent</span>
                <span className="font-medium">{statementData.payment.counteragent || '-'}</span>
              </div>
              <div>
                <span className="text-gray-600 block">Counteragent ID</span>
                <span className="font-medium">{statementData.payment.counteragentId || '-'}</span>
              </div>
              <div>
                <span className="text-gray-600 block">Financial Code</span>
                <span className="font-medium">{statementData.payment.financialCode || '-'}</span>
              </div>
              <div>
                <span className="text-gray-600 block">Job</span>
                <span className="font-medium">{statementData.payment.job || '-'}</span>
              </div>
              <div>
                <span className="text-gray-600 block">Floors</span>
                <span className="font-medium">{statementData.payment.floors}</span>
              </div>
              <div>
                <span className="text-gray-600 block">Currency</span>
                <span className="font-medium">{statementData.payment.currency || '-'}</span>
              </div>
              <div>
                <span className="text-gray-600 block">Income Tax</span>
                <span className="font-medium">{statementData.payment.incomeTax ? '✓ Yes' : '✗ No'}</span>
              </div>
            </div>
          </div>

          {/* Ledger Entries */}
          <div>
            <h3 className="font-semibold mb-3 text-lg">
              Payment Ledger Entries 
              <span className="ml-2 text-sm font-normal text-gray-600">
                ({statementData.ledgerEntries.length} {statementData.ledgerEntries.length === 1 ? 'entry' : 'entries'})
              </span>
            </h3>
            {statementData.ledgerEntries.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Effective Date</th>
                        <th className="px-4 py-3 text-right font-semibold" style={{ backgroundColor: '#ffebee' }}>Accrual</th>
                        <th className="px-4 py-3 text-right font-semibold" style={{ backgroundColor: '#e8f5e9' }}>Payment</th>
                        <th className="px-4 py-3 text-right font-semibold" style={{ backgroundColor: '#fff9e6' }}>Order</th>
                        <th className="px-4 py-3 text-left font-semibold">Comment</th>
                        <th className="px-4 py-3 text-left font-semibold">User</th>
                        <th className="px-4 py-3 text-left font-semibold">Created At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statementData.ledgerEntries.map((entry: any, index: number) => (
                        <tr key={entry.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-3">{new Date(entry.effectiveDate).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-right font-mono" style={{ backgroundColor: '#ffebee' }}>
                            {entry.accrual ? entry.accrual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono" style={{ backgroundColor: '#e8f5e9' }}>
                            0.00
                          </td>
                          <td className="px-4 py-3 text-right font-mono" style={{ backgroundColor: '#fff9e6' }}>
                            {entry.order ? entry.order.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                          </td>
                          <td className="px-4 py-3">{entry.comment || '-'}</td>
                          <td className="px-4 py-3">{entry.userEmail}</td>
                          <td className="px-4 py-3">{new Date(entry.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 border rounded-lg">No ledger entries found</div>
            )}
          </div>

          {/* Bank Transactions */}
          <div>
            <h3 className="font-semibold mb-3 text-lg">
              Bank Transactions 
              <span className="ml-2 text-sm font-normal text-gray-600">
                ({statementData.bankTransactions.length} {statementData.bankTransactions.length === 1 ? 'transaction' : 'transactions'})
              </span>
            </h3>
            {statementData.bankTransactions.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Date</th>
                        <th className="px-4 py-3 text-right font-semibold">Account Amount</th>
                        <th className="px-4 py-3 text-right font-semibold">Nominal Amount</th>
                        <th className="px-4 py-3 text-left font-semibold">ID 1</th>
                        <th className="px-4 py-3 text-left font-semibold">ID 2</th>
                        <th className="px-4 py-3 text-left font-semibold">Account Number</th>
                        <th className="px-4 py-3 text-left font-semibold">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statementData.bankTransactions.map((tx: any, index: number) => (
                        <tr key={tx.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-3">{new Date(tx.date).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-right font-mono">
                            {tx.accountCurrencyAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {tx.nominalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3">{tx.id1 || '-'}</td>
                          <td className="px-4 py-3">{tx.id2 || '-'}</td>
                          <td className="px-4 py-3">{tx.counteragentAccountNumber || '-'}</td>
                          <td className="px-4 py-3">
                            <div className="max-w-md truncate" title={tx.description}>
                              {tx.description || '-'}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 border rounded-lg">No bank transactions found</div>
            )}
          </div>

          {/* Print Button */}
          <div className="flex justify-end pt-4 border-t">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Print Statement
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
