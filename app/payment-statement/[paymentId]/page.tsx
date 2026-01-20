'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const formatDate = (date: string | Date): string => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
};

type TransactionRow = {
  id: string;
  type: 'ledger' | 'bank';
  date: string;
  accrual: number;
  payment: number;
  order: number;
  ppc: number;
  paidPercent: number;
  due: number;
  balance: number;
  comment: string;
  user: string;
  caAccount: string;
  account: string;
  createdAt: string;
};

type ColumnConfig = {
  key: keyof TransactionRow;
  label: string;
  visible: boolean;
  width: number;
  align?: 'left' | 'right';
};

const defaultColumns: ColumnConfig[] = [
  { key: 'date', label: 'Date', visible: true, width: 120, align: 'left' },
  { key: 'accrual', label: 'Accrual', visible: true, width: 120, align: 'right' },
  { key: 'payment', label: 'Payment', visible: true, width: 120, align: 'right' },
  { key: 'order', label: 'Order', visible: true, width: 120, align: 'right' },
  { key: 'ppc', label: 'PPC', visible: true, width: 120, align: 'right' },
  { key: 'paidPercent', label: 'Paid %', visible: true, width: 100, align: 'right' },
  { key: 'due', label: 'Due', visible: true, width: 120, align: 'right' },
  { key: 'balance', label: 'Balance', visible: true, width: 120, align: 'right' },
  { key: 'comment', label: 'Comment', visible: true, width: 300, align: 'left' },
  { key: 'user', label: 'User', visible: true, width: 180, align: 'left' },
  { key: 'caAccount', label: 'CA Account', visible: true, width: 180, align: 'left' },
  { key: 'account', label: 'Account', visible: true, width: 200, align: 'left' },
  { key: 'createdAt', label: 'Created At', visible: true, width: 180, align: 'left' },
];

export default function PaymentStatementPage() {
  const params = useParams();
  const paymentId = params.paymentId as string;
  const [statementData, setStatementData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);
  const [isResizing, setIsResizing] = useState<{ column: keyof TransactionRow; startX: number; startWidth: number; element: HTMLElement } | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<keyof TransactionRow | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<keyof TransactionRow | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load saved column configuration from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedColumns = localStorage.getItem('paymentStatementColumns');
      if (savedColumns) {
        try {
          const parsed = JSON.parse(savedColumns);
          
          // Validate saved columns structure
          const validSavedColumns = parsed.filter((col: any) => 
            col.key && col.label && typeof col.width === 'number' && typeof col.visible === 'boolean'
          );
          
          // Merge saved columns with defaults to handle new columns
          const updatedSavedColumns = validSavedColumns.map((savedCol: any) => {
            const defaultCol = defaultColumns.find(col => col.key === savedCol.key);
            return defaultCol ? { ...defaultCol, ...savedCol } : savedCol;
          });
          
          // Find new columns that don't exist in saved columns
          const savedKeys = new Set(validSavedColumns.map((col: any) => col.key));
          const newColumns = defaultColumns.filter(col => !savedKeys.has(col.key));
          
          setColumns([...updatedSavedColumns, ...newColumns]);
        } catch (e) {
          console.error('Failed to parse saved columns:', e);
          setColumns(defaultColumns);
        }
      }
    }
    setIsInitialized(true);
  }, []);

  // Save column configuration to localStorage whenever it changes
  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
      localStorage.setItem('paymentStatementColumns', JSON.stringify(columns));
    }
  }, [columns, isInitialized]);

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

  // Column resize handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const deltaX = e.clientX - isResizing.startX;
        const newWidth = Math.max(50, isResizing.startWidth + deltaX);
        
        isResizing.element.style.width = `${newWidth}px`;
        isResizing.element.style.minWidth = `${newWidth}px`;
        isResizing.element.style.maxWidth = `${newWidth}px`;
      }
    };

    const handleMouseUp = () => {
      if (isResizing) {
        const finalWidth = parseInt(isResizing.element.style.width);
        setColumns(prev =>
          prev.map(col =>
            col.key === isResizing.column ? { ...col, width: finalWidth } : col
          )
        );
        
        setIsResizing(null);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  const handleResizeStart = (e: React.MouseEvent, column: keyof TransactionRow) => {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.target as HTMLElement).parentElement as HTMLElement;
    setIsResizing({
      column,
      startX: e.clientX,
      startWidth: th.offsetWidth,
      element: th
    });
  };

  const handleDragStart = (e: React.DragEvent, columnKey: keyof TransactionRow) => {
    setDraggedColumn(columnKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, columnKey: keyof TransactionRow) => {
    e.preventDefault();
    if (draggedColumn && draggedColumn !== columnKey) {
      setDragOverColumn(columnKey);
    }
  };

  const handleDrop = (e: React.DragEvent, targetKey: keyof TransactionRow) => {
    e.preventDefault();
    if (draggedColumn && draggedColumn !== targetKey) {
      const draggedIndex = columns.findIndex(col => col.key === draggedColumn);
      const targetIndex = columns.findIndex(col => col.key === targetKey);
      
      const newColumns = [...columns];
      const [removed] = newColumns.splice(draggedIndex, 1);
      newColumns.splice(targetIndex, 0, removed);
      
      setColumns(newColumns);
    }
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const mergedTransactions: TransactionRow[] = statementData ? [
    ...statementData.ledgerEntries.map((entry: any) => ({
      id: `ledger-${entry.id}`,
      type: 'ledger' as const,
      date: formatDate(entry.effectiveDate),
      dateSort: new Date(entry.effectiveDate).getTime(),
      accrual: entry.accrual,
      payment: 0,
      order: entry.order,
      ppc: 0,
      paidPercent: 0,
      due: 0,
      balance: 0,
      comment: entry.comment || '-',
      user: entry.userEmail,
      caAccount: '-',
      account: '-',
      createdAt: `${formatDate(entry.createdAt)} ${new Date(entry.createdAt).toLocaleTimeString()}`,
    })),
    ...statementData.bankTransactions.map((tx: any) => ({
      id: `bank-${tx.id}`,
      type: 'bank' as const,
      date: formatDate(tx.date),
      dateSort: new Date(tx.date).getTime(),
      accrual: 0,
      payment: Math.abs(tx.nominalAmount),
      order: 0,
      ppc: Math.abs(tx.accountCurrencyAmount),
      paidPercent: 0,
      due: 0,
      balance: 0,
      comment: tx.description || '-',
      user: '-',
      caAccount: tx.counteragentAccountNumber || '-',
      account: tx.accountLabel || '-',
      createdAt: `${formatDate(tx.createdAt)} ${new Date(tx.createdAt).toLocaleTimeString()}`,
    }))
  ].sort((a, b) => a.dateSort - b.dateSort) : []; // Sort by date ascending for cumulative calculation

  // Calculate cumulative values for each row (from oldest to newest)
  if (mergedTransactions.length > 0) {
    let cumulativeAccrual = 0;
    let cumulativePayment = 0;
    let cumulativeOrder = 0;

    mergedTransactions.forEach(row => {
      cumulativeAccrual += row.accrual;
      cumulativePayment += row.payment; // Already absolute value
      cumulativeOrder += row.order;

      // Calculate Paid % = (cumulative payment / cumulative accrual) * 100
      row.paidPercent = cumulativeAccrual !== 0 
        ? parseFloat(((cumulativePayment / cumulativeAccrual) * 100).toFixed(2))
        : 0;

      // Calculate Due = cumulative order - cumulative payment
      row.due = parseFloat((cumulativeOrder - cumulativePayment).toFixed(2));

      // Calculate Balance = cumulative accrual - cumulative payment
      row.balance = parseFloat((cumulativeAccrual - cumulativePayment).toFixed(2));
    });

    // Now reverse to show newest first in the table
    mergedTransactions.reverse();
  }


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
    <div className="min-h-screen bg-white">
      <div className="w-full">
        <div className="space-y-6">
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

          {/* Merged Payment Transactions */}
          <div>
            <h3 className="font-semibold mb-3 text-lg">
              Payment Transactions 
              <span className="ml-2 text-sm font-normal text-gray-600">
                ({mergedTransactions.length} {mergedTransactions.length === 1 ? 'entry' : 'entries'})
              </span>
            </h3>
            {mergedTransactions.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                    <thead className="bg-gray-100">
                      <tr>
                        {columns.filter(col => col.visible).map((column) => (
                          <th
                            key={column.key}
                            draggable
                            onDragStart={(e) => handleDragStart(e, column.key)}
                            onDragOver={(e) => handleDragOver(e, column.key)}
                            onDrop={(e) => handleDrop(e, column.key)}
                            className={`px-4 py-3 font-semibold relative cursor-move select-none ${
                              column.align === 'right' ? 'text-right' : 'text-left'
                            } ${dragOverColumn === column.key ? 'bg-blue-100' : ''}`}
                            style={{
                              width: `${column.width}px`,
                              minWidth: `${column.width}px`,
                              maxWidth: `${column.width}px`,
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className={column.align === 'right' ? 'ml-auto' : ''}>{column.label}</span>
                              <div
                                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-10"
                                onMouseDown={(e) => handleResizeStart(e, column.key)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mergedTransactions.map((row, index) => (
                        <tr key={row.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          {columns.filter(col => col.visible).map((column) => {
                            let displayValue = row[column.key];
                            
                            // Format numeric values
                            if (column.align === 'right' && typeof displayValue === 'number') {
                              if (column.key === 'paidPercent') {
                                displayValue = `${displayValue.toFixed(2)}%`;
                              } else {
                                displayValue = displayValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                              }
                            }
                            
                            return (
                              <td
                                key={column.key}
                                className={`px-4 py-3 ${
                                  column.align === 'right' ? 'text-right font-mono' : 'text-left'
                                }`}
                                style={{
                                  width: `${column.width}px`,
                                  minWidth: `${column.width}px`,
                                  maxWidth: `${column.width}px`,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {displayValue}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 border rounded-lg">No transactions found</div>
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
