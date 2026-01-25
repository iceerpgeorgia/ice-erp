'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Edit2, X } from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

const formatDate = (date: string | Date): string => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
};

type TransactionRow = {
  id: string;
  ledgerId?: number; // Add ledger ID for editing
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

  // Edit dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<{
    id: number;
    paymentId: string;
    date: string;
    accrual: number;
    order: number;
    comment: string;
  } | null>(null);
  const [newPaymentId, setNewPaymentId] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newAccrual, setNewAccrual] = useState('');
  const [newOrder, setNewOrder] = useState('');
  const [newComment, setNewComment] = useState('');
  const [allPayments, setAllPayments] = useState<Array<{ 
    paymentId: string; 
    counteragent: string; 
    project: string; 
    job: string;
    financialCode: string;
    currency: string;
    incomeTax: boolean;
  }>>([]);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<{
    counteragent: string;
    project: string;
    job: string;
    financialCode: string;
    currency: string;
    incomeTax: boolean;
  } | null>(null);

  // BroadcastChannel for cross-tab updates
  const [broadcastChannel] = useState(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      return new BroadcastChannel('payments-ledger-updates');
    }
    return null;
  });

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

  // Fetch all payments for the payment ID dropdown
  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const response = await fetch('/api/payments?limit=5000');
        if (!response.ok) throw new Error('Failed to fetch payments');
        const data = await response.json();
        setAllPayments(data.map((p: any) => ({
          paymentId: p.paymentId,
          counteragent: p.counteragentName || 'N/A',
          project: p.projectIndex || 'N/A',
          job: p.jobName || 'N/A',
          financialCode: p.financialCode || 'N/A',
          currency: p.currencyCode || 'N/A',
          incomeTax: p.incomeTax || false
        })));
      } catch (error) {
        console.error('Error fetching payments:', error);
      }
    };
    fetchPayments();
  }, []);

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
      ledgerId: entry.id, // Store ledger ID for editing
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

  const handleEditEntry = (row: TransactionRow) => {
    if (row.type === 'ledger' && row.ledgerId) {
      // Convert dd.mm.yyyy to yyyy-MM-dd for input[type="date"]
      const dateParts = row.date.split('.');
      const isoDate = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}` : '';
      
      setEditingEntry({
        id: row.ledgerId,
        paymentId: statementData.payment.paymentId,
        date: row.date,
        accrual: row.accrual,
        order: row.order,
        comment: row.comment === '-' ? '' : row.comment
      });
      setNewPaymentId(statementData.payment.paymentId);
      setNewDate(isoDate);
      setNewAccrual(row.accrual.toString());
      setNewOrder(row.order.toString());
      setNewComment(row.comment === '-' ? '' : row.comment);
      setPaymentSearch('');
      
      // Fetch current payment details
      const payment = allPayments.find(p => p.paymentId === statementData.payment.paymentId);
      if (payment) {
        setPaymentDetails({
          counteragent: payment.counteragent,
          project: payment.project,
          job: payment.job,
          financialCode: payment.financialCode,
          currency: payment.currency,
          incomeTax: payment.incomeTax
        });
      }
      
      setIsEditDialogOpen(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingEntry || !newPaymentId) return;

    // Close confirmation and start saving
    setShowConfirmation(false);
    setIsSaving(true);
    try {
      const response = await fetch(`/api/payments-ledger/${editingEntry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: newPaymentId,
          effectiveDate: newDate,
          accrual: parseFloat(newAccrual) || 0,
          order: parseFloat(newOrder) || 0,
          comment: newComment || null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update entry');
      }

      console.log('[Payment Statement] Update successful, updating local state...');
      console.log('[Payment Statement] statementData structure:', statementData ? Object.keys(statementData) : 'null');

      // Update the statement data locally without full page reload
      if (statementData && statementData.ledgerEntries) {
        console.log('[Payment Statement] Updating ledgerEntries, entry ID:', editingEntry.id);
        
        const updatedLedgerEntries = statementData.ledgerEntries.map((entry: any) => {
          if (entry.id === editingEntry.id) {
            console.log('[Payment Statement] Found matching entry, updating...');
            // Update the changed entry
            return {
              ...entry,
              effectiveDate: newDate,
              accrual: parseFloat(newAccrual) || 0,
              order: parseFloat(newOrder) || 0,
              comment: newComment || null
            };
          }
          return entry;
        });

        console.log('[Payment Statement] Updated ledger entries count:', updatedLedgerEntries.length);

        // Update state with new data
        setStatementData({
          ...statementData,
          ledgerEntries: updatedLedgerEntries
        });

        console.log('[Payment Statement] State updated, broadcasting to other tabs...');

        // Broadcast the update to other tabs/windows
        if (broadcastChannel) {
          const message = {
            type: 'ledger-updated',
            paymentId: newPaymentId,
            ledgerId: editingEntry.id,
            timestamp: Date.now()
          };
          console.log('[Payment Statement] Broadcasting message:', message);
          broadcastChannel.postMessage(message);
        } else {
          console.log('[Payment Statement] BroadcastChannel not available');
        }
      } else {
        console.warn('[Payment Statement] Cannot update: statementData or ledgerEntries missing');
        console.log('[Payment Statement] statementData:', statementData);
      }

      // Close dialog
      setIsEditDialogOpen(false);
      setEditingEntry(null);
    } catch (error: any) {
      console.error('Error updating ledger entry:', error);
      alert(error.message || 'Failed to update entry');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditDialogOpen(false);
    setEditingEntry(null);
    setNewPaymentId('');
    setNewDate('');
    setNewAccrual('');
    setNewOrder('');
    setNewComment('');
    setPaymentSearch('');
    setPaymentDetails(null);
    setShowConfirmation(false);
  };

  const filteredPayments = allPayments.filter(p => {
    if (!paymentSearch) return true;
    const searchLower = paymentSearch.toLowerCase();
    return (
      p.paymentId.toLowerCase().includes(searchLower) ||
      p.counteragent.toLowerCase().includes(searchLower) ||
      p.project.toLowerCase().includes(searchLower)
    );
  });


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
                        <th className="px-4 py-3 font-semibold text-left" style={{ width: '80px' }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {mergedTransactions.map((row, index) => (
                        <tr key={row.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          {columns.filter(col => col.visible).map((column) => {
                            let displayValue = row[column.key];
                            
                            // Format numeric values
                            if (column.align === 'right' && typeof displayValue === 'number') {
                              // Show blank for 0.00 in accrual, order, payment, and ppc columns
                              if ((column.key === 'accrual' || column.key === 'order' || column.key === 'payment' || column.key === 'ppc') && displayValue === 0) {
                                displayValue = '';
                              } else if (column.key === 'paidPercent') {
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
                          <td className="px-4 py-3" style={{ width: '80px' }}>
                            {row.type === 'ledger' && row.ledgerId && (
                              <button
                                onClick={() => handleEditEntry(row)}
                                className="p-1 hover:bg-gray-200 rounded"
                                title="Edit entry"
                              >
                                <Edit2 className="h-4 w-4 text-blue-600" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      
                      {/* Totals Row */}
                      <tr className="bg-blue-50 font-bold border-t-2 border-blue-300">
                        {columns.filter(col => col.visible).map((column) => {
                          let totalValue: string | number = '';
                          
                          if (column.key === 'date') {
                            totalValue = 'TOTAL';
                          } else if (column.key === 'accrual') {
                            const total = mergedTransactions.reduce((sum, row) => sum + row.accrual, 0);
                            totalValue = total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          } else if (column.key === 'order') {
                            const total = mergedTransactions.reduce((sum, row) => sum + row.order, 0);
                            totalValue = total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          } else if (column.key === 'payment') {
                            const total = mergedTransactions.reduce((sum, row) => sum + row.payment, 0);
                            totalValue = total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          } else if (column.key === 'ppc') {
                            const total = mergedTransactions.reduce((sum, row) => sum + row.ppc, 0);
                            totalValue = total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
                              {totalValue}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3" style={{ width: '80px' }}></td>
                      </tr>
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

      {/* Edit Dialog */}
      {isEditDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Edit Ledger Entry</h2>
              <button
                onClick={handleCancelEdit}
                className="p-1 hover:bg-gray-100 rounded"
                disabled={isSaving}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Payment ID Selection with Combobox */}
              <div className="space-y-2">
                <Label>Payment ID <span className="text-red-500">*</span></Label>
                <Combobox
                  value={newPaymentId}
                  onValueChange={(value) => {
                    setNewPaymentId(value);
                    // Fetch and set payment details when payment changes
                    const payment = allPayments.find(p => p.paymentId === value);
                    if (payment) {
                      setPaymentDetails({
                        counteragent: payment.counteragent,
                        project: payment.project,
                        job: payment.job,
                        financialCode: payment.financialCode,
                        currency: payment.currency,
                        incomeTax: payment.incomeTax
                      });
                    }
                  }}
                  filter={(value, search) => {
                    if (!search) return 1;
                    try {
                      const regex = new RegExp(search, 'i');
                      return regex.test(value) ? 1 : 0;
                    } catch {
                      return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                    }
                  }}
                  options={allPayments.map(p => {
                    const parts = [p.paymentId];
                    if (p.counteragent) parts.push(p.counteragent);
                    if (p.project) parts.push(p.project);
                    if (p.job) parts.push(p.job);
                    if (p.financialCode) parts.push(p.financialCode);
                    if (p.currency) parts.push(p.currency);
                    
                    const fullLabel = parts.join(' | ');
                    const searchKeywords = [
                      p.paymentId,
                      p.counteragent || '',
                      p.project || '',
                      p.job || '',
                      p.financialCode || '',
                      p.currency || ''
                    ].filter(Boolean).join(' ');
                    
                    return {
                      value: p.paymentId,
                      label: fullLabel,
                      displayLabel: fullLabel,
                      keywords: searchKeywords
                    };
                  })}
                  placeholder="Select payment..."
                  searchPlaceholder="Search by payment ID, project, job..."
                />
              </div>

              {/* Payment Details Display */}
              {paymentDetails && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700">Payment Details</h3>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-600">Payment ID</Label>
                      <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                        <span className="font-bold" style={{ color: '#000' }}>{newPaymentId}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-600">Currency</Label>
                      <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                        <span className="font-bold" style={{ color: '#000' }}>{paymentDetails.currency}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-600">Income Tax</Label>
                      <div className="flex items-center h-9 px-3 border-2 border-gray-300 rounded-md bg-gray-100">
                        <Checkbox checked={paymentDetails.incomeTax} disabled />
                        <span className="ml-2 text-sm font-bold" style={{ color: '#000' }}>{paymentDetails.incomeTax ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Counteragent</Label>
                    <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                      <span className="font-bold" style={{ color: '#000' }}>{paymentDetails.counteragent}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Project</Label>
                    <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                      <span className="font-bold" style={{ color: '#000' }}>{paymentDetails.project}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Job</Label>
                    <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                      <span className="font-bold" style={{ color: '#000' }}>{paymentDetails.job}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Financial Code</Label>
                    <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center">
                      <span className="font-bold" style={{ color: '#000' }}>{paymentDetails.financialCode}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Date Field */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Effective Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Comment Field */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Comment
                </label>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Enter comment..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Accrual and Order Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Accrual Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newAccrual}
                    onChange={(e) => setNewAccrual(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Order Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newOrder}
                    onChange={(e) => setNewOrder(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Current Entry Info */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <h3 className="text-sm font-semibold text-gray-700">Current Entry</h3>
                <div className="text-sm text-gray-600">
                  <div>Original Payment ID: <span className="font-medium">{editingEntry?.paymentId}</span></div>
                  <div>Original Date: <span className="font-medium">{editingEntry?.date}</span></div>
                  <div>Original Accrual: <span className="font-medium">{editingEntry?.accrual.toFixed(2)}</span></div>
                  <div>Original Order: <span className="font-medium">{editingEntry?.order.toFixed(2)}</span></div>
                  <div>Original Comment: <span className="font-medium">{editingEntry?.comment || '(none)'}</span></div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end gap-3">
              <button
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowConfirmation(true)}
                disabled={isSaving || !newPaymentId}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 rounded-t-lg">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="text-2xl">⚠️</span>
                Confirm Changes
              </h2>
            </div>
            
            <div className="p-6">
              <p className="text-gray-700 mb-4 font-medium">You are about to update the following fields:</p>
              
              <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-4 space-y-3">
                {newPaymentId !== editingEntry?.paymentId && (
                  <div className="flex items-center gap-2 bg-white rounded p-3 border border-amber-200">
                    <span className="font-semibold text-gray-700 min-w-[120px]">Payment ID:</span>
                    <span className="text-red-600 line-through">{editingEntry?.paymentId}</span>
                    <span className="text-gray-400 text-xl">→</span>
                    <span className="text-green-600 font-bold">{newPaymentId}</span>
                  </div>
                )}
                {newDate !== editingEntry?.date.split('.').reverse().join('-') && (
                  <div className="flex items-center gap-2 bg-white rounded p-3 border border-amber-200">
                    <span className="font-semibold text-gray-700 min-w-[120px]">Date:</span>
                    <span className="text-red-600 line-through">{editingEntry?.date}</span>
                    <span className="text-gray-400 text-xl">→</span>
                    <span className="text-green-600 font-bold">{newDate.split('-').reverse().join('.')}</span>
                  </div>
                )}
                {parseFloat(newAccrual) !== editingEntry?.accrual && (
                  <div className="flex items-center gap-2 bg-white rounded p-3 border border-amber-200">
                    <span className="font-semibold text-gray-700 min-w-[120px]">Accrual:</span>
                    <span className="text-red-600 line-through">{editingEntry?.accrual.toFixed(2)}</span>
                    <span className="text-gray-400 text-xl">→</span>
                    <span className="text-green-600 font-bold">{parseFloat(newAccrual || '0').toFixed(2)}</span>
                  </div>
                )}
                {parseFloat(newOrder) !== editingEntry?.order && (
                  <div className="flex items-center gap-2 bg-white rounded p-3 border border-amber-200">
                    <span className="font-semibold text-gray-700 min-w-[120px]">Order:</span>
                    <span className="text-red-600 line-through">{editingEntry?.order.toFixed(2)}</span>
                    <span className="text-gray-400 text-xl">→</span>
                    <span className="text-green-600 font-bold">{parseFloat(newOrder || '0').toFixed(2)}</span>
                  </div>
                )}
                {newComment !== editingEntry?.comment && (
                  <div className="flex items-start gap-2 bg-white rounded p-3 border border-amber-200">
                    <span className="font-semibold text-gray-700 min-w-[120px]">Comment:</span>
                    <div className="flex-1 space-y-1">
                      <div className="text-red-600 line-through">{editingEntry?.comment || '(none)'}</div>
                      <span className="text-gray-400 text-xl">↓</span>
                      <div className="text-green-600 font-bold">{newComment || '(none)'}</div>
                    </div>
                  </div>
                )}
              </div>
              
              <p className="text-sm text-gray-600 mt-4 italic">
                These changes will be saved immediately and cannot be undone.
              </p>
            </div>
            
            <div className="bg-gray-50 border-t px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 font-semibold"
              >
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
