'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Download, FileSpreadsheet, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';

type SalaryRow = {
  id: string;
  payment_id: string;
  salary_month: string;
  net_sum: number;
  raw_net_sum: number;
  surplus_insurance: number | null;
  deducted_insurance: number | null;
  deducted_fitness: number | null;
  deducted_fine: number | null;
  paid: number;
  month_balance: number;
  cumulative_accrual: number;
  cumulative_payment: number;
  cumulative_balance: number;
  financial_code: string;
  currency_code: string;
  confirmed: boolean;
  pension_scheme: boolean;
};

type CounterInfo = {
  uuid: string;
  name: string;
  identification_number: string;
  sex: string;
  pension_scheme: boolean;
  iban: string;
};

type ReportData = {
  counteragent: CounterInfo;
  rows: SalaryRow[];
  totals: {
    net_sum: number;
    surplus_insurance: number;
    deducted_insurance: number;
    deducted_fitness: number;
    deducted_fine: number;
    paid: number;
    month_balance: number;
  };
  currency: string | null;
};

const formatCurrency = (val: number | null | undefined): string => {
  if (val === null || val === undefined) return '-';
  return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatPeriod = (dateStr: string): string => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};

export default function SalaryReportPage() {
  const params = useParams();
  const counteragentUuid = params?.counteragentUuid as string;

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!counteragentUuid) return;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/salary-report?counteragentUuid=${encodeURIComponent(counteragentUuid)}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }
        const result = await res.json();
        setData(result);
      } catch (err: any) {
        setError(err.message || 'Failed to load salary report');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [counteragentUuid]);

  const handleExportXlsx = useCallback(() => {
    if (!data) return;
    const ca = data.counteragent;

    const headerRows = [
      ['Salary Report'],
      ['Counteragent:', ca.name],
      ['ID Number:', ca.identification_number || '-'],
      ['Pension Scheme:', ca.pension_scheme ? 'Yes' : 'No'],
      ['Currency:', data.currency || '-'],
      ['IBAN:', ca.iban || '-'],
      [],
    ];

    const tableHeaders = [
      '#',
      'Period',
      'Payment ID',
      'Net Sum',
      'Surplus Insurance',
      'Ded. Insurance',
      'Ded. Fitness',
      'Ded. Fine',
      'Payment',
      'Month Balance',
      'Cumul. Accrual',
      'Cumul. Payment',
      'Cumul. Balance',
    ];

    const tableRows = data.rows.map((row, idx) => [
      idx + 1,
      formatPeriod(row.salary_month),
      row.payment_id || '-',
      row.net_sum,
      row.surplus_insurance ?? 0,
      row.deducted_insurance ?? 0,
      row.deducted_fitness ?? 0,
      row.deducted_fine ?? 0,
      row.paid,
      row.month_balance,
      row.cumulative_accrual,
      row.cumulative_payment,
      row.cumulative_balance,
    ]);

    const totalsRow = [
      '',
      'TOTALS',
      '',
      data.totals.net_sum,
      data.totals.surplus_insurance,
      data.totals.deducted_insurance,
      data.totals.deducted_fitness,
      data.totals.deducted_fine,
      data.totals.paid,
      data.totals.month_balance,
      data.rows.length > 0 ? data.rows[data.rows.length - 1].cumulative_accrual : 0,
      data.rows.length > 0 ? data.rows[data.rows.length - 1].cumulative_payment : 0,
      data.rows.length > 0 ? data.rows[data.rows.length - 1].cumulative_balance : 0,
    ];

    const sheetData = [...headerRows, tableHeaders, ...tableRows, totalsRow];
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 5 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 16 },
      { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 16 }, { wch: 16 }, { wch: 16 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Salary Report');
    const fileName = `salary_report_${ca.identification_number || ca.name}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }, [data]);

  const handleExportPdf = useCallback(() => {
    if (!data) return;
    // Use print dialog for PDF export
    window.print();
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 text-lg">Loading salary report...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  if (!data || data.rows.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">No salary data available for this counteragent</div>
      </div>
    );
  }

  const ca = data.counteragent;
  const lastRow = data.rows[data.rows.length - 1];

  return (
    <div className="min-h-screen bg-white print:bg-white">
      <div className="w-full max-w-[1400px] mx-auto px-4 py-6 print:px-2 print:py-2">
        <div className="space-y-6">
          {/* Header */}
          <div className="border-b pb-4 flex items-center justify-between print:border-b-0">
            <div>
              <h1 className="text-2xl font-bold">Salary Report</h1>
              <p className="text-gray-600 mt-1">{ca.name}</p>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <button
                onClick={handleExportXlsx}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
                title="Export to XLSX"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export XLSX
              </button>
              <button
                onClick={handleExportPdf}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                title="Export to PDF (Print)"
              >
                <Printer className="h-4 w-4" />
                Export PDF
              </button>
            </div>
          </div>

          {/* Counteragent Info */}
          <div className="bg-gray-50 p-4 rounded-lg print:bg-white print:border print:border-gray-300">
            <h3 className="font-semibold mb-3 text-lg">Counteragent Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600 block">Name</span>
                <span className="font-medium">{ca.name || '-'}</span>
              </div>
              <div>
                <span className="text-gray-600 block">ID Number</span>
                <span className="font-medium">{ca.identification_number || '-'}</span>
              </div>
              <div>
                <span className="text-gray-600 block">Sex</span>
                <span className="font-medium">{ca.sex || '-'}</span>
              </div>
              <div>
                <span className="text-gray-600 block">Pension Scheme</span>
                <span className="font-medium">{ca.pension_scheme ? '✓ Yes' : '✗ No'}</span>
              </div>
              <div>
                <span className="text-gray-600 block">IBAN</span>
                <span className="font-medium">{ca.iban || '-'}</span>
              </div>
              <div>
                <span className="text-gray-600 block">Currency</span>
                <span className="font-medium">{data.currency || '-'}</span>
              </div>
            </div>
          </div>

          {/* Table */}
          <div>
            <h3 className="font-semibold text-lg mb-3">
              Salary Transactions
              <span className="ml-2 text-sm font-normal text-gray-600">
                ({data.rows.length} {data.rows.length === 1 ? 'period' : 'periods'})
              </span>
            </h3>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 print:bg-gray-200">
                    <th className="px-3 py-2 text-left border-b font-semibold w-10">#</th>
                    <th className="px-3 py-2 text-left border-b font-semibold min-w-[100px]">Period</th>
                    <th className="px-3 py-2 text-left border-b font-semibold min-w-[130px]">Payment ID</th>
                    <th className="px-3 py-2 text-right border-b font-semibold min-w-[110px]">Net Sum</th>
                    <th className="px-3 py-2 text-right border-b font-semibold min-w-[130px]">Surplus Ins.</th>
                    <th className="px-3 py-2 text-right border-b font-semibold min-w-[120px]">Ded. Ins.</th>
                    <th className="px-3 py-2 text-right border-b font-semibold min-w-[110px]">Ded. Fitness</th>
                    <th className="px-3 py-2 text-right border-b font-semibold min-w-[100px]">Ded. Fine</th>
                    <th className="px-3 py-2 text-right border-b font-semibold min-w-[110px]">Payment</th>
                    <th className="px-3 py-2 text-right border-b font-semibold min-w-[120px]">Month Bal.</th>
                    <th className="px-3 py-2 text-right border-b font-semibold min-w-[130px]">Cumul. Accrual</th>
                    <th className="px-3 py-2 text-right border-b font-semibold min-w-[130px]">Cumul. Payment</th>
                    <th className="px-3 py-2 text-right border-b font-semibold min-w-[130px]">Cumul. Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, idx) => (
                    <tr
                      key={row.id}
                      className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors print:hover:bg-transparent`}
                    >
                      <td className="px-3 py-2 border-b text-gray-500">{idx + 1}</td>
                      <td className="px-3 py-2 border-b font-medium">{formatPeriod(row.salary_month)}</td>
                      <td className="px-3 py-2 border-b text-gray-700">{row.payment_id || '-'}</td>
                      <td className="px-3 py-2 border-b text-right">{formatCurrency(row.net_sum)}</td>
                      <td className="px-3 py-2 border-b text-right">{formatCurrency(row.surplus_insurance)}</td>
                      <td className="px-3 py-2 border-b text-right">{formatCurrency(row.deducted_insurance)}</td>
                      <td className="px-3 py-2 border-b text-right">{formatCurrency(row.deducted_fitness)}</td>
                      <td className="px-3 py-2 border-b text-right">{formatCurrency(row.deducted_fine)}</td>
                      <td className="px-3 py-2 border-b text-right">{formatCurrency(row.paid)}</td>
                      <td className={`px-3 py-2 border-b text-right font-medium ${
                        row.month_balance > 0.005 ? 'text-red-600' : row.month_balance < -0.005 ? 'text-green-600' : ''
                      }`}>{formatCurrency(row.month_balance)}</td>
                      <td className="px-3 py-2 border-b text-right">{formatCurrency(row.cumulative_accrual)}</td>
                      <td className="px-3 py-2 border-b text-right">{formatCurrency(row.cumulative_payment)}</td>
                      <td className={`px-3 py-2 border-b text-right font-medium ${
                        row.cumulative_balance > 0.005 ? 'text-red-600' : row.cumulative_balance < -0.005 ? 'text-green-600' : ''
                      }`}>{formatCurrency(row.cumulative_balance)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-bold print:bg-gray-200">
                    <td className="px-3 py-2 border-t-2" colSpan={3}>TOTALS</td>
                    <td className="px-3 py-2 border-t-2 text-right">{formatCurrency(data.totals.net_sum)}</td>
                    <td className="px-3 py-2 border-t-2 text-right">{formatCurrency(data.totals.surplus_insurance)}</td>
                    <td className="px-3 py-2 border-t-2 text-right">{formatCurrency(data.totals.deducted_insurance)}</td>
                    <td className="px-3 py-2 border-t-2 text-right">{formatCurrency(data.totals.deducted_fitness)}</td>
                    <td className="px-3 py-2 border-t-2 text-right">{formatCurrency(data.totals.deducted_fine)}</td>
                    <td className="px-3 py-2 border-t-2 text-right">{formatCurrency(data.totals.paid)}</td>
                    <td className={`px-3 py-2 border-t-2 text-right ${
                      data.totals.month_balance > 0.005 ? 'text-red-600' : data.totals.month_balance < -0.005 ? 'text-green-600' : ''
                    }`}>{formatCurrency(data.totals.month_balance)}</td>
                    <td className="px-3 py-2 border-t-2 text-right">{formatCurrency(lastRow.cumulative_accrual)}</td>
                    <td className="px-3 py-2 border-t-2 text-right">{formatCurrency(lastRow.cumulative_payment)}</td>
                    <td className={`px-3 py-2 border-t-2 text-right ${
                      lastRow.cumulative_balance > 0.005 ? 'text-red-600' : lastRow.cumulative_balance < -0.005 ? 'text-green-600' : ''
                    }`}>{formatCurrency(lastRow.cumulative_balance)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
