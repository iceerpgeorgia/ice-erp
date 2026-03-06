'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

type FinancialCode = {
  uuid: string;
  code: string;
  validation?: string;
  name?: string;
};

type ServicesRow = {
  projectUuid: string;
  status: string;
  project: string;
  projectName: string;
  counteragent: string;
  currency: string;
  paymentCount: number;
  jobsCount: number;
  accrual: number;
  order: number;
  payment: number;
  due: number;
  balance: number;
  confirmed: boolean;
  latestDate: string | null;
};

type ServicesSummaryRow = {
  status: string;
  projectsCount: number;
  jobsCount: number;
  paymentCount: number;
  accrual: number;
  order: number;
  payment: number;
  due: number;
  balance: number;
};

type ServicesReportResponse = {
  rows: ServicesRow[];
  summaryByStatus: ServicesSummaryRow[];
  totals: {
    projectsCount: number;
    jobsCount: number;
    paymentCount: number;
    accrual: number;
    order: number;
    payment: number;
    due: number;
    balance: number;
  };
};

const formatMoney = (value: number) =>
  value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDate = (value: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB');
};

export function ServicesReportTable() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [maxDate, setMaxDate] = useState('');
  const [financialCodeSearch, setFinancialCodeSearch] = useState('');
  const [financialCodes, setFinancialCodes] = useState<FinancialCode[]>([]);
  const [selectedFinancialCodeUuids, setSelectedFinancialCodeUuids] = useState<Set<string>>(new Set());
  const [report, setReport] = useState<ServicesReportResponse>({
    rows: [],
    summaryByStatus: [],
    totals: {
      projectsCount: 0,
      jobsCount: 0,
      paymentCount: 0,
      accrual: 0,
      order: 0,
      payment: 0,
      due: 0,
      balance: 0,
    },
  });

  useEffect(() => {
    const savedCodes = localStorage.getItem('servicesReportFinancialCodeUuids');
    const savedMaxDate = localStorage.getItem('servicesReportMaxDate');
    if (savedCodes) {
      try {
        const parsed = JSON.parse(savedCodes);
        if (Array.isArray(parsed)) {
          setSelectedFinancialCodeUuids(new Set(parsed.map((item) => String(item))));
        }
      } catch {
        // ignore
      }
    }
    if (savedMaxDate && /^\d{4}-\d{2}-\d{2}$/.test(savedMaxDate)) {
      setMaxDate(savedMaxDate);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('servicesReportFinancialCodeUuids', JSON.stringify(Array.from(selectedFinancialCodeUuids)));
  }, [selectedFinancialCodeUuids]);

  useEffect(() => {
    localStorage.setItem('servicesReportMaxDate', maxDate || '');
  }, [maxDate]);

  const fetchFinancialCodes = useCallback(async () => {
    const response = await fetch('/api/financial-codes?leafOnly=true&isIncome=true');
    if (!response.ok) throw new Error('Failed to load financial codes');
    const data = await response.json();
    if (!Array.isArray(data)) {
      setFinancialCodes([]);
      return;
    }
    const mapped = data.map((item: any) => ({
      uuid: item.uuid,
      code: item.code,
      validation: item.validation,
      name: item.name,
    }));
    setFinancialCodes(mapped);
  }, []);

  const fetchReport = useCallback(async () => {
    if (selectedFinancialCodeUuids.size === 0) {
      setReport({
        rows: [],
        summaryByStatus: [],
        totals: {
          projectsCount: 0,
          jobsCount: 0,
          paymentCount: 0,
          accrual: 0,
          order: 0,
          payment: 0,
          due: 0,
          balance: 0,
        },
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('financialCodeUuids', Array.from(selectedFinancialCodeUuids).join(','));
      if (maxDate && /^\d{4}-\d{2}-\d{2}$/.test(maxDate)) {
        params.set('maxDate', maxDate);
      }
      const response = await fetch(`/api/services-report?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to load services report');
      const data = (await response.json()) as ServicesReportResponse;
      setReport({
        rows: Array.isArray(data.rows) ? data.rows : [],
        summaryByStatus: Array.isArray(data.summaryByStatus) ? data.summaryByStatus : [],
        totals: data.totals || {
          projectsCount: 0,
          jobsCount: 0,
          paymentCount: 0,
          accrual: 0,
          order: 0,
          payment: 0,
          due: 0,
          balance: 0,
        },
      });
    } catch (fetchError: any) {
      setError(fetchError?.message || 'Failed to load services report');
    } finally {
      setLoading(false);
    }
  }, [maxDate, selectedFinancialCodeUuids]);

  useEffect(() => {
    fetchFinancialCodes().catch((fetchError: any) => {
      setError(fetchError?.message || 'Failed to load financial codes');
      setLoading(false);
    });
  }, [fetchFinancialCodes]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return report.rows;
    return report.rows.filter((row) =>
      [row.status, row.project, row.projectName, row.counteragent, row.currency]
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [report.rows, search]);

  const filteredFinancialCodes = useMemo(() => {
    const term = financialCodeSearch.trim().toLowerCase();
    if (!term) return financialCodes;
    return financialCodes.filter((code) =>
      `${code.code} ${code.validation || ''} ${code.name || ''}`.toLowerCase().includes(term)
    );
  }, [financialCodeSearch, financialCodes]);

  const toggleFinancialCode = (uuid: string) => {
    setSelectedFinancialCodeUuids((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };

  const selectAllCodes = () => {
    setSelectedFinancialCodeUuids(new Set(financialCodes.map((code) => code.uuid)));
  };

  const clearAllCodes = () => {
    setSelectedFinancialCodeUuids(new Set());
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Services Report</h1>
        <Input
          type="date"
          value={maxDate}
          onChange={(event) => setMaxDate(event.target.value)}
          className="w-[180px]"
        />
        <Input
          placeholder="Search in report..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-[260px]"
        />
        <Button variant="outline" onClick={fetchReport}>Refresh</Button>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="text-sm font-medium">Report Settings</div>
        <div className="text-sm text-gray-600">
          Select financial codes that define service projects for this report.
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search financial code..."
            value={financialCodeSearch}
            onChange={(event) => setFinancialCodeSearch(event.target.value)}
            className="w-[320px]"
          />
          <Button variant="outline" onClick={selectAllCodes}>Select All</Button>
          <Button variant="outline" onClick={clearAllCodes}>Clear</Button>
          <div className="text-sm text-gray-600">
            Selected: {selectedFinancialCodeUuids.size}
          </div>
        </div>
        <div className="max-h-44 overflow-y-auto rounded border p-2">
          {filteredFinancialCodes.length === 0 ? (
            <div className="text-sm text-gray-500 px-2 py-1">No financial codes found.</div>
          ) : (
            filteredFinancialCodes.map((code) => {
              const label = code.validation || `${code.code} ${code.name || ''}`.trim();
              const checked = selectedFinancialCodeUuids.has(code.uuid);
              return (
                <label key={code.uuid} className="flex items-center gap-2 px-2 py-1 text-sm">
                  <Checkbox checked={checked} onCheckedChange={() => toggleFinancialCode(code.uuid)} />
                  <span>{label}</span>
                </label>
              );
            })
          )}
        </div>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <div className="rounded border p-3"><div className="text-xs text-gray-500">Projects</div><div className="font-semibold">{report.totals.projectsCount}</div></div>
        <div className="rounded border p-3"><div className="text-xs text-gray-500">Jobs</div><div className="font-semibold">{report.totals.jobsCount}</div></div>
        <div className="rounded border p-3"><div className="text-xs text-gray-500">Payments</div><div className="font-semibold">{report.totals.paymentCount}</div></div>
        <div className="rounded border p-3"><div className="text-xs text-gray-500">Accrual</div><div className="font-semibold">{formatMoney(report.totals.accrual)}</div></div>
        <div className="rounded border p-3"><div className="text-xs text-gray-500">Order</div><div className="font-semibold">{formatMoney(report.totals.order)}</div></div>
        <div className="rounded border p-3"><div className="text-xs text-gray-500">Payment</div><div className="font-semibold">{formatMoney(report.totals.payment)}</div></div>
        <div className="rounded border p-3"><div className="text-xs text-gray-500">Due</div><div className="font-semibold">{formatMoney(report.totals.due)}</div></div>
        <div className="rounded border p-3"><div className="text-xs text-gray-500">Balance</div><div className="font-semibold">{formatMoney(report.totals.balance)}</div></div>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <div className="px-3 py-2 text-sm font-medium border-b bg-gray-50">Category Summary</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Projects</th>
              <th className="px-3 py-2 text-right">Jobs</th>
              <th className="px-3 py-2 text-right">Payments</th>
              <th className="px-3 py-2 text-right">Accrual</th>
              <th className="px-3 py-2 text-right">Order</th>
              <th className="px-3 py-2 text-right">Payment</th>
              <th className="px-3 py-2 text-right">Due</th>
              <th className="px-3 py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {report.summaryByStatus.map((row) => (
              <tr key={row.status} className="border-t">
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2 text-right">{row.projectsCount}</td>
                <td className="px-3 py-2 text-right">{row.jobsCount}</td>
                <td className="px-3 py-2 text-right">{row.paymentCount}</td>
                <td className="px-3 py-2 text-right">{formatMoney(row.accrual)}</td>
                <td className="px-3 py-2 text-right">{formatMoney(row.order)}</td>
                <td className="px-3 py-2 text-right">{formatMoney(row.payment)}</td>
                <td className="px-3 py-2 text-right">{formatMoney(row.due)}</td>
                <td className="px-3 py-2 text-right">{formatMoney(row.balance)}</td>
              </tr>
            ))}
            {report.summaryByStatus.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-gray-500">No summary data.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <div className="px-3 py-2 text-sm font-medium border-b bg-gray-50">Services Details</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Project</th>
              <th className="px-3 py-2 text-left">Counteragent</th>
              <th className="px-3 py-2 text-right">Payments</th>
              <th className="px-3 py-2 text-right">Jobs</th>
              <th className="px-3 py-2 text-left">Currency</th>
              <th className="px-3 py-2 text-right">Accrual</th>
              <th className="px-3 py-2 text-right">Order</th>
              <th className="px-3 py-2 text-right">Payment</th>
              <th className="px-3 py-2 text-right">Due</th>
              <th className="px-3 py-2 text-right">Balance</th>
              <th className="px-3 py-2 text-left">Confirmed</th>
              <th className="px-3 py-2 text-left">Latest Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={14} className="px-3 py-8 text-center text-gray-500">Loading...</td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={14} className="px-3 py-8 text-center text-gray-500">
                  {selectedFinancialCodeUuids.size === 0
                    ? 'Select at least one financial code to load report data.'
                    : 'No rows match current filters.'}
                </td>
              </tr>
            ) : (
              filteredRows.map((row, index) => (
                <tr key={row.projectUuid} className="border-t">
                  <td className="px-3 py-2">{index + 1}</td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2">{row.project} {row.projectName ? `| ${row.projectName}` : ''}</td>
                  <td className="px-3 py-2">{row.counteragent}</td>
                  <td className="px-3 py-2 text-right">{row.paymentCount}</td>
                  <td className="px-3 py-2 text-right">{row.jobsCount}</td>
                  <td className="px-3 py-2">{row.currency}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(row.accrual)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(row.order)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(row.payment)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(row.due)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(row.balance)}</td>
                  <td className="px-3 py-2">{row.confirmed ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-2">{formatDate(row.latestDate)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
