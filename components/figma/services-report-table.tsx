'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Columns3, FileText, Link2, Settings, User, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Combobox } from '@/components/ui/combobox';

type FinancialCode = {
  uuid: string;
  code: string;
  validation?: string;
  name?: string;
};

type ServicesRow = {
  financialCodeUuid: string;
  financialCodeValidation: string;
  projectUuid: string;
  counteragentUuid: string | null;
  status: string;
  project: string;
  projectName: string;
  sum: number;
  counteragent: string;
  paymentIds: string[];
  hasUnboundCounteragentTransactions?: boolean;
  currency: string;
  paymentCount: number;
  jobsCount: number;
  jobNames: string[];
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

type JobOption = {
  jobUuid: string;
  jobName: string;
  jobDisplay: string;
};

type JobLinkDialogState = {
  open: boolean;
  projectUuid: string;
  paymentIds: string[];
  jobs: JobOption[];
  assignments: Record<string, string>;
  numericIds: Record<string, number>;
  loading: boolean;
  saving: boolean;
};

type SectionColumnKey =
  | 'status'
  | 'financialCodeValidation'
  | 'projectName'
  | 'currency'
  | 'sum'
  | 'counteragent'
  | 'paymentIds'
  | 'paymentCount'
  | 'jobsCount'
  | 'accrual'
  | 'order'
  | 'payment'
  | 'due'
  | 'balance'
  | 'confirmed'
  | 'latestDate'
  | 'actions';

type SectionColumn = {
  key: SectionColumnKey;
  label: string;
  visible: boolean;
  width: number;
  align?: 'left' | 'right';
};

type SectionData = {
  financialCodeUuid: string;
  financialCodeValidation: string;
  rows: ServicesRow[];
};

const DEFAULT_TOTALS = {
  projectsCount: 0,
  jobsCount: 0,
  paymentCount: 0,
  accrual: 0,
  order: 0,
  payment: 0,
  due: 0,
  balance: 0,
};

const SERVICES_REPORT_COLUMNS_STORAGE_KEY = 'servicesReportSectionColumnsV4';

const DEFAULT_SECTION_COLUMNS: SectionColumn[] = [
  { key: 'status', label: 'Status', visible: true, width: 120, align: 'left' },
  { key: 'financialCodeValidation', label: 'Financial Code', visible: true, width: 220, align: 'left' },
  { key: 'projectName', label: 'Project', visible: true, width: 260, align: 'left' },
  { key: 'currency', label: 'Currency', visible: true, width: 110, align: 'left' },
  { key: 'sum', label: 'Sum', visible: true, width: 130, align: 'right' },
  { key: 'counteragent', label: 'Counteragent', visible: true, width: 220, align: 'left' },
  { key: 'paymentIds', label: 'Payment IDs', visible: true, width: 260, align: 'left' },
  { key: 'paymentCount', label: 'Payments', visible: true, width: 100, align: 'right' },
  { key: 'jobsCount', label: 'Jobs', visible: true, width: 90, align: 'right' },
  { key: 'accrual', label: 'Accrual', visible: true, width: 130, align: 'right' },
  { key: 'order', label: 'Order', visible: true, width: 130, align: 'right' },
  { key: 'payment', label: 'Payment', visible: true, width: 130, align: 'right' },
  { key: 'due', label: 'Due', visible: true, width: 130, align: 'right' },
  { key: 'balance', label: 'Balance', visible: true, width: 130, align: 'right' },
  { key: 'confirmed', label: 'Confirmed', visible: true, width: 110, align: 'left' },
  { key: 'latestDate', label: 'Latest Date', visible: true, width: 130, align: 'left' },
  { key: 'actions', label: 'Actions', visible: true, width: 90, align: 'left' },
];

const formatMoney = (value: number) =>
  value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDate = (value: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

const COLUMN_BG: Partial<Record<SectionColumnKey, string>> = {
  accrual: '#ffebee',
  order: '#fff9e6',
  payment: '#e8f5e9',
};

const getColumnValue = (row: ServicesRow, key: SectionColumnKey) => {
  switch (key) {
    case 'sum':
      return row.sum;
    case 'latestDate':
      return formatDate(row.latestDate);
    case 'accrual':
      return row.accrual;
    case 'confirmed':
      return row.confirmed;
    case 'paymentIds':
      return row.paymentIds.join(', ');
    case 'actions':
      return '';
    default:
      return row[key as keyof ServicesRow] as unknown;
  }
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
    totals: DEFAULT_TOTALS,
  });

  const [sectionColumns, setSectionColumns] = useState<Record<string, SectionColumn[]>>({});
  const [draggedColumn, setDraggedColumn] = useState<{ sectionId: string; key: SectionColumnKey } | null>(null);
  const [resizing, setResizing] = useState<{
    sectionId: string;
    key: SectionColumnKey;
    startX: number;
    startWidth: number;
  } | null>(null);

  const [jobLinkDialog, setJobLinkDialog] = useState<JobLinkDialogState>({
    open: false,
    projectUuid: '',
    paymentIds: [],
    jobs: [],
    assignments: {},
    numericIds: {},
    loading: false,
    saving: false,
  });

  useEffect(() => {
    const savedCodes = localStorage.getItem('servicesReportFinancialCodeUuids');
    const savedMaxDate = localStorage.getItem('servicesReportMaxDate');
    const savedColumns = localStorage.getItem(SERVICES_REPORT_COLUMNS_STORAGE_KEY);

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

    if (savedColumns) {
      try {
        const parsed = JSON.parse(savedColumns) as Record<string, SectionColumn[]>;
        if (parsed && typeof parsed === 'object') {
          setSectionColumns(parsed);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('servicesReportFinancialCodeUuids', JSON.stringify(Array.from(selectedFinancialCodeUuids)));
  }, [selectedFinancialCodeUuids]);

  useEffect(() => {
    localStorage.setItem('servicesReportMaxDate', maxDate || '');
  }, [maxDate]);

  useEffect(() => {
    localStorage.setItem(SERVICES_REPORT_COLUMNS_STORAGE_KEY, JSON.stringify(sectionColumns));
  }, [sectionColumns]);

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (event: MouseEvent) => {
      const delta = event.clientX - resizing.startX;
      const nextWidth = Math.max(80, resizing.startWidth + delta);
      setSectionColumns((prev) => {
        const current = prev[resizing.sectionId] || DEFAULT_SECTION_COLUMNS;
        const updated = current.map((column) =>
          column.key === resizing.key ? { ...column, width: nextWidth } : column
        );
        return {
          ...prev,
          [resizing.sectionId]: updated,
        };
      });
    };

    const handleMouseUp = () => {
      setResizing(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing]);

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
        totals: DEFAULT_TOTALS,
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
        totals: data.totals || DEFAULT_TOTALS,
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
      [
        row.status,
        row.project,
        row.projectName,
        row.counteragent,
        row.currency,
        row.financialCodeValidation,
      ]
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

  const codeLabelByUuid = useMemo(() => {
    const map = new Map<string, string>();
    for (const code of financialCodes) {
      map.set(code.uuid, code.validation || `${code.code} ${code.name || ''}`.trim());
    }
    return map;
  }, [financialCodes]);

  const sections = useMemo(() => {
    const grouped = new Map<string, SectionData>();
    for (const row of filteredRows) {
      const key = row.financialCodeUuid || 'unknown';
      const existing = grouped.get(key);
      if (existing) {
        existing.rows.push(row);
      } else {
        grouped.set(key, {
          financialCodeUuid: key,
          financialCodeValidation:
            row.financialCodeValidation || codeLabelByUuid.get(key) || 'Unknown Financial Code',
          rows: [row],
        });
      }
    }

    return Array.from(grouped.values()).sort((a, b) =>
      a.financialCodeValidation.localeCompare(b.financialCodeValidation)
    );
  }, [filteredRows, codeLabelByUuid]);

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

  const getColumnsForSection = (sectionId: string) => {
    return sectionColumns[sectionId] || DEFAULT_SECTION_COLUMNS;
  };

  const setColumnsForSection = (sectionId: string, updater: (current: SectionColumn[]) => SectionColumn[]) => {
    setSectionColumns((prev) => {
      const current = prev[sectionId] || DEFAULT_SECTION_COLUMNS;
      return {
        ...prev,
        [sectionId]: updater(current),
      };
    });
  };

  const toggleColumnVisibility = (sectionId: string, key: SectionColumnKey) => {
    setColumnsForSection(sectionId, (current) =>
      current.map((column) =>
        column.key === key ? { ...column, visible: !column.visible } : column
      )
    );
  };

  const handleColumnDrop = (sectionId: string, targetKey: SectionColumnKey) => {
    if (!draggedColumn || draggedColumn.sectionId !== sectionId || draggedColumn.key === targetKey) return;
    setColumnsForSection(sectionId, (current) => {
      const fromIndex = current.findIndex((column) => column.key === draggedColumn.key);
      const toIndex = current.findIndex((column) => column.key === targetKey);
      if (fromIndex === -1 || toIndex === -1) return current;
      const reordered = [...current];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      return reordered;
    });
    setDraggedColumn(null);
  };

  const openJobLinkDialog = async (row: ServicesRow) => {
    setJobLinkDialog((prev) => ({ ...prev, open: true, projectUuid: row.projectUuid, paymentIds: row.paymentIds, loading: true, jobs: [], assignments: {}, numericIds: {}, saving: false }));
    try {
      const [jobsRes, paymentsRes] = await Promise.all([
        fetch(`/api/jobs?projectUuid=${row.projectUuid}`),
        fetch(`/api/payments?paymentIds=${encodeURIComponent(row.paymentIds.join(','))}`),
      ]);
      const jobsData = jobsRes.ok ? await jobsRes.json() : [];
      const paymentsData = paymentsRes.ok ? await paymentsRes.json() : [];
      const jobs: JobOption[] = (Array.isArray(jobsData) ? jobsData : []).map((j: any) => ({
        jobUuid: j.jobUuid,
        jobName: j.jobName,
        jobDisplay: j.jobDisplay || j.jobName,
      }));
      const assignments: Record<string, string> = {};
      const numericIds: Record<string, number> = {};
      for (const p of (Array.isArray(paymentsData) ? paymentsData : [])) {
        assignments[p.paymentId] = p.jobUuid || '';
        numericIds[p.paymentId] = p.id;
      }
      setJobLinkDialog((prev) => ({ ...prev, jobs, assignments, numericIds, loading: false }));
    } catch {
      setJobLinkDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  const updateJobAssignment = (paymentId: string, jobUuid: string) => {
    setJobLinkDialog((prev) => ({
      ...prev,
      assignments: { ...prev.assignments, [paymentId]: jobUuid },
    }));
  };

  const saveJobAssignments = async () => {
    setJobLinkDialog((prev) => ({ ...prev, saving: true }));
    try {
      const entries = Object.entries(jobLinkDialog.assignments);
      for (const [paymentId, jobUuid] of entries) {
        const numericId = jobLinkDialog.numericIds[paymentId];
        if (!numericId) continue;
        await fetch(`/api/payments?id=${numericId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobUuid: jobUuid || null }),
        });
      }
      setJobLinkDialog((prev) => ({ ...prev, open: false, saving: false }));
      fetchReport();
    } catch (err: any) {
      alert(err?.message || 'Failed to save job assignments');
      setJobLinkDialog((prev) => ({ ...prev, saving: false }));
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Services Report</h1>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[560px] p-4" align="start">
            <div className="space-y-3">
              <div className="text-sm font-medium">Report Settings</div>
              <div className="text-sm text-gray-600">
                Select financial codes that define service projects for this report.
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  placeholder="Search financial code..."
                  value={financialCodeSearch}
                  onChange={(event) => setFinancialCodeSearch(event.target.value)}
                  className="w-[300px]"
                />
                <Button variant="outline" onClick={selectAllCodes}>Select All</Button>
                <Button variant="outline" onClick={clearAllCodes}>Clear</Button>
                <div className="text-sm text-gray-600">Selected: {selectedFinancialCodeUuids.size}</div>
              </div>
              <div className="max-h-56 overflow-y-auto rounded border p-2">
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
          </PopoverContent>
        </Popover>
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

      <div className="text-sm text-gray-600">Selected financial codes: {selectedFinancialCodeUuids.size}</div>
      {loading ? (
        <div className="rounded-lg border px-3 py-8 text-center text-gray-500">Loading...</div>
      ) : sections.length === 0 ? (
        <div className="rounded-lg border px-3 py-8 text-center text-gray-500">
          {selectedFinancialCodeUuids.size === 0
            ? 'Select at least one financial code from settings to load report data.'
            : 'No rows match current filters.'}
        </div>
      ) : (
        sections.map((section) => {
          const columns = getColumnsForSection(section.financialCodeUuid);
          const visibleColumns = columns.filter((column) => column.visible);
          const selectorColumns = columns;
          return (
            <div key={section.financialCodeUuid} className="rounded-lg border overflow-x-auto">
              <div className="px-3 py-2 border-b bg-gray-50 flex items-center justify-between">
                <div className="text-sm font-medium">{section.financialCodeValidation} ({section.rows.length})</div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1">
                      <Columns3 className="h-4 w-4" />
                      Columns
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-2" align="end">
                    <div className="space-y-1 max-h-72 overflow-y-auto">
                      {selectorColumns.map((column) => (
                        <label key={column.key} className="flex items-center gap-2 px-2 py-1 text-sm">
                          <Checkbox
                            checked={column.visible}
                            onCheckedChange={() => toggleColumnVisibility(section.financialCodeUuid, column.key)}
                          />
                          <span>{column.label}</span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <table className="text-sm min-w-full">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left w-[56px]">#</th>
                    {visibleColumns.map((column) => {
                      const bg = COLUMN_BG[column.key];
                      return (
                      <th
                        key={column.key}
                        draggable
                        onDragStart={() => setDraggedColumn({ sectionId: section.financialCodeUuid, key: column.key })}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => handleColumnDrop(section.financialCodeUuid, column.key)}
                        className={`px-3 py-2 relative ${column.align === 'right' ? 'text-right' : 'text-left'}`}
                        style={{ width: `${column.width}px`, minWidth: `${column.width}px`, ...(bg ? { backgroundColor: bg } : {}) }}
                      >
                        <span>{column.label}</span>
                        <div
                          className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            setResizing({
                              sectionId: section.financialCodeUuid,
                              key: column.key,
                              startX: event.clientX,
                              startWidth: column.width,
                            });
                          }}
                        />
                      </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row, index) => {
                    const isConfirmedDue = Boolean(row.confirmed && row.due > 0);
                    const isConfirmedPaid = Boolean(row.confirmed && row.due === 0);
                    return (
                    <tr
                      key={`${section.financialCodeUuid}-${row.projectUuid}-${index}`}
                      className={`border-t hover:bg-gray-50 ${
                        isConfirmedPaid ? 'bg-gray-100' : isConfirmedDue ? 'bg-[#e8f5e9]' : ''
                      }`}
                    >
                      <td className="px-3 py-2">{index + 1}</td>
                      {visibleColumns.map((column) => {
                        const rawValue = getColumnValue(row, column.key);
                        const bg = COLUMN_BG[column.key];
                        if (column.key === 'confirmed') {
                          return (
                            <td
                              key={column.key}
                              className="px-3 py-2"
                              style={{ width: `${column.width}px`, minWidth: `${column.width}px` }}
                            >
                              <Checkbox checked={Boolean(rawValue)} disabled className="cursor-default" />
                            </td>
                          );
                        }
                        const value =
                          column.align === 'right' && typeof rawValue === 'number'
                            ? formatMoney(rawValue)
                            : String(rawValue ?? '-');
                        return (
                          <td
                            key={column.key}
                            className={`px-3 py-2 ${column.align === 'right' ? 'text-right' : 'text-left'}`}
                            style={{ width: `${column.width}px`, minWidth: `${column.width}px`, ...(bg ? { backgroundColor: bg } : {}) }}
                          >
                            {column.key === 'paymentIds' ? (
                              row.paymentIds.length > 0 ? (
                                <span className="text-xs text-gray-700">{row.paymentIds.join(', ')}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )
                            ) : column.key === 'jobsCount' ? (
                              <div className="flex items-center justify-end gap-1">
                                <span>{row.jobsCount}</span>
                                <button
                                  onClick={() => openJobLinkDialog(row)}
                                  title={row.jobNames.length > 0 ? `Jobs: ${row.jobNames.join(', ')}` : 'Link jobs to payments'}
                                  className="text-blue-600 hover:text-blue-800 p-0.5 rounded hover:bg-blue-50 transition-colors"
                                >
                                  <Link2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : column.key === 'actions' ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {row.paymentIds.map((paymentId) => (
                                  <a
                                    key={`${row.projectUuid}-${paymentId}`}
                                    href={`/payment-statement/${paymentId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1 rounded transition-colors"
                                    title={`Payment statement: ${paymentId}`}
                                  >
                                    <FileText className="w-4 h-4" />
                                  </a>
                                ))}
                                <a
                                  href={row.counteragentUuid ? `/counteragent-statement/${row.counteragentUuid}` : '#'}
                                  target={row.counteragentUuid ? '_blank' : undefined}
                                  rel={row.counteragentUuid ? 'noopener noreferrer' : undefined}
                                  className={`inline-block p-1 rounded transition-colors ${
                                    row.counteragentUuid
                                      ? row.hasUnboundCounteragentTransactions
                                        ? 'text-red-600 hover:text-red-800 hover:bg-red-50'
                                        : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
                                      : 'text-gray-400'
                                  }`}
                                  aria-disabled={!row.counteragentUuid}
                                  title={
                                    row.hasUnboundCounteragentTransactions
                                      ? 'Counteragent has transactions without payment ID'
                                      : 'View counteragent statement (opens in new tab)'
                                  }
                                  onClick={(event) => {
                                    if (!row.counteragentUuid) {
                                      event.preventDefault();
                                    }
                                  }}
                                >
                                  <User className="w-4 h-4" />
                                </a>
                              </div>
                            ) : (
                              value
                            )}
                          </td>
                        );
                      })}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })
      )}

      {jobLinkDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-[560px] max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="text-sm font-semibold">Link Jobs to Payment IDs</h2>
              <button
                onClick={() => setJobLinkDialog((prev) => ({ ...prev, open: false }))}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {jobLinkDialog.loading ? (
                <div className="text-sm text-gray-500 py-4 text-center">Loading...</div>
              ) : jobLinkDialog.paymentIds.length === 0 ? (
                <div className="text-sm text-gray-500 py-4 text-center">No payment IDs in this row.</div>
              ) : (
                jobLinkDialog.paymentIds.map((paymentId) => (
                  <div key={paymentId} className="flex items-center gap-3">
                    <span className="text-sm font-mono w-[140px] shrink-0 truncate" title={paymentId}>{paymentId}</span>
                    <Combobox
                      value={jobLinkDialog.assignments[paymentId] || ''}
                      onValueChange={(val) => updateJobAssignment(paymentId, val)}
                      options={[
                        { value: '', label: '— No job —' },
                        ...jobLinkDialog.jobs.map((j) => ({ value: j.jobUuid, label: j.jobDisplay })),
                      ]}
                      placeholder="Select job..."
                      className="flex-1"
                    />
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t">
              <Button variant="outline" onClick={() => setJobLinkDialog((prev) => ({ ...prev, open: false }))}>
                Cancel
              </Button>
              <Button onClick={saveJobAssignments} disabled={jobLinkDialog.saving || jobLinkDialog.loading}>
                {jobLinkDialog.saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
     </div>
   );
 }
