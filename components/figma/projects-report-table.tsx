'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Download, RefreshCw, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import * as XLSX from 'xlsx-js-style';

// ─── Types ────────────────────────────────────────────────────────────────────

type MetricKey = 'accrual' | 'latestAccrual' | 'order' | 'lastMonthAccrual' | 'lastMonthOrder' | 'payment' | 'due' | 'balance' | 'paymentCount';

const METRIC_LABELS: Record<MetricKey, string> = {
  accrual: 'Accrual',
  latestAccrual: 'Latest Accrual',
  order: 'Order',
  lastMonthAccrual: 'Last Month Accrual',
  lastMonthOrder: 'Last Month Order',
  payment: 'Payment',
  due: 'Due',
  balance: 'Balance',
  paymentCount: 'Count',
};

const ALL_METRICS = Object.keys(METRIC_LABELS) as MetricKey[];

type CellData = {
  jobUuid: string | null;
  jobName: string | null;
  financialCodeUuid: string;
  financialCodeValidation: string;
  financialCodeIsIncome: boolean;
  accrual: number;
  latestAccrual: number;
  order: number;
  lastMonthAccrual: number;
  lastMonthOrder: number;
  payment: number;
  due: number;
  balance: number;
  confirmed: boolean;
  paymentCount: number;
  paymentIds: string[];
  latestDate: string | null;
};

type ProjectData = {
  projectUuid: string;
  projectIndex: string;
  projectName: string;
  projectAddress: string | null;
  status: string;
  serviceState: string;
  insiderName: string;
  department: string;
  cells: CellData[];
};

type ProjectsReportResponse = {
  projects: ProjectData[];
};

type ProjectOption = {
  project_uuid: string;
  project_index: string;
  project_name: string;
  state?: string;
  service_state?: string;
  insider_name?: string;
};

type FcFilter = 'all' | 'income' | 'cost';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatMoney = (value: number) =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatCell = (value: number, metric: MetricKey) => {
  if (metric === 'paymentCount') return value === 0 ? '-' : String(value);
  return value === 0 ? '-' : formatMoney(value);
};

const NULL_JOB_KEY = '__NO_JOB__';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY_PROJECTS = 'projectsReportSelectedProjects';
const STORAGE_KEY_MAXDATE = 'projectsReportMaxDate';
const STORAGE_KEY_METRICS = 'projectsReportSelectedMetrics';

const JOB_COL_DEFAULT_WIDTH = 180;
const FC_COL_DEFAULT_WIDTH = 120;
const TOTAL_COL_DEFAULT_WIDTH = 120;

// ─── Multi-select dropdown ────────────────────────────────────────────────────

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        className="inline-flex items-center gap-1 h-7 px-2 text-xs border border-gray-200 rounded bg-white hover:bg-gray-50 whitespace-nowrap"
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <ChevronDown className="h-3 w-3 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg p-2 space-y-0.5">
          {options.map((opt) => {
            const checked = selected.has(opt.value);
            return (
              <label
                key={opt.value}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer text-xs"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const next = new Set(selected);
                    checked ? next.delete(opt.value) : next.add(opt.value);
                    onChange(next);
                  }}
                />
                {opt.label}
              </label>
            );
          })}
          <div className="flex justify-between pt-1 border-t gap-2">
            <button className="text-xs text-blue-600 hover:underline" onClick={() => onChange(new Set(options.map((o) => o.value)))}>All</button>
            <button className="text-xs text-gray-500 hover:underline" onClick={() => onChange(new Set())}>None</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProjectsReportTable() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [allProjects, setAllProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectUuids, setSelectedProjectUuids] = useState<Set<string>>(new Set());
  const [projectSearch, setProjectSearch] = useState('');
  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false);

  const [maxDate, setMaxDate] = useState('');
  const [selectedInsiderUuids, setSelectedInsiderUuids] = useState<string[]>([]);

  const [report, setReport] = useState<ProjectsReportResponse | null>(null);

  const [selectedMetrics, setSelectedMetrics] = useState<Set<MetricKey>>(new Set(['accrual']));
  const [projectFcFilters, setProjectFcFilters] = useState<Record<string, FcFilter>>({});
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());

  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [resizing, setResizing] = useState<{ key: string; startX: number; startWidth: number } | null>(null);

  // ── Restore preferences ──

  useEffect(() => {
    const savedProjects = localStorage.getItem(STORAGE_KEY_PROJECTS);
    const savedMaxDate = localStorage.getItem(STORAGE_KEY_MAXDATE);
    const savedMetrics = localStorage.getItem(STORAGE_KEY_METRICS);

    if (savedProjects) {
      try {
        const parsed = JSON.parse(savedProjects);
        if (Array.isArray(parsed)) setSelectedProjectUuids(new Set(parsed.map(String)));
      } catch { /* ignore */ }
    }
    if (savedMaxDate && /^\d{4}-\d{2}-\d{2}$/.test(savedMaxDate)) setMaxDate(savedMaxDate);
    if (savedMetrics) {
      try {
        const parsed = JSON.parse(savedMetrics);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelectedMetrics(new Set(parsed.filter((m: string) => m in METRIC_LABELS) as MetricKey[]));
        }
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => { localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(Array.from(selectedProjectUuids))); }, [selectedProjectUuids]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_MAXDATE, maxDate || ''); }, [maxDate]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_METRICS, JSON.stringify(Array.from(selectedMetrics))); }, [selectedMetrics]);

  // ── Column resize ──

  useEffect(() => {
    if (!resizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizing.startX;
      const next = Math.max(50, resizing.startWidth + delta);
      setColWidths((prev) => ({ ...prev, [resizing.key]: next }));
    };
    const handleMouseUp = () => setResizing(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing]);

  const getColWidth = (key: string, defaultW: number) => colWidths[key] ?? defaultW;
  const startResize = (e: React.MouseEvent, key: string, defaultW: number) => {
    e.preventDefault();
    setResizing({ key, startX: e.clientX, startWidth: getColWidth(key, defaultW) });
  };

  // ── Fetch project list ──

  const fetchProjects = useCallback(async () => {
    try {
      const [projectsRes, insiderRes] = await Promise.all([
        fetch('/api/projects-v2'),
        fetch('/api/insider-selection'),
      ]);
      if (!projectsRes.ok) throw new Error('Failed to load projects');
      const data = await projectsRes.json();
      const list: ProjectOption[] = Array.isArray(data)
        ? data.map((p: any) => ({
            project_uuid: p.project_uuid,
            project_index: p.project_index || '-',
            project_name: p.project_name || '-',
            state: p.state,
            service_state: p.service_state,
            insider_name: p.insider_name,
          }))
        : [];
      setAllProjects(list);
      if (insiderRes.ok) {
        const insiderData = await insiderRes.json();
        const uuids = Array.isArray(insiderData?.selectedUuids) ? insiderData.selectedUuids : [];
        setSelectedInsiderUuids(uuids);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load projects');
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // ── Fetch report ──

  const fetchReport = useCallback(async () => {
    if (selectedProjectUuids.size === 0) { setReport({ projects: [] }); return; }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('projectUuids', Array.from(selectedProjectUuids).join(','));
      if (maxDate && /^\d{4}-\d{2}-\d{2}$/.test(maxDate)) params.set('maxDate', maxDate);
      if (selectedInsiderUuids.length > 0) params.set('insiderUuids', selectedInsiderUuids.join(','));
      const res = await fetch(`/api/projects-report?${params}`);
      if (!res.ok) throw new Error('Failed to load projects report');
      const data = await res.json() as ProjectsReportResponse;
      setReport(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load projects report');
    } finally {
      setLoading(false);
    }
  }, [selectedProjectUuids, maxDate, selectedInsiderUuids]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // ── Helpers ──

  const filteredProjects = useMemo(() => {
    const term = projectSearch.trim().toLowerCase();
    if (!term) return allProjects;
    return allProjects.filter((p) => `${p.project_index} ${p.project_name}`.toLowerCase().includes(term));
  }, [projectSearch, allProjects]);

  const toggleCollapse = (uuid: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      next.has(uuid) ? next.delete(uuid) : next.add(uuid);
      return next;
    });
  };

  const getCellValue = (cell: CellData, metric: MetricKey): number => cell[metric] as number;

  function buildPivot(proj: ProjectData, fcFilter: FcFilter) {
    const jobMap = new Map<string, { key: string; label: string; jobUuid: string | null }>();
    const fcMap = new Map<string, { uuid: string; validation: string; isIncome: boolean }>();

    for (const cell of proj.cells) {
      if (fcFilter === 'income' && !cell.financialCodeIsIncome) continue;
      if (fcFilter === 'cost' && cell.financialCodeIsIncome) continue;
      const jobKey = cell.jobUuid ?? NULL_JOB_KEY;
      if (!jobMap.has(jobKey)) jobMap.set(jobKey, { key: jobKey, label: cell.jobName ?? '(No Job)', jobUuid: cell.jobUuid });
      if (!fcMap.has(cell.financialCodeUuid)) fcMap.set(cell.financialCodeUuid, { uuid: cell.financialCodeUuid, validation: cell.financialCodeValidation, isIncome: cell.financialCodeIsIncome });
    }

    const cellMap = new Map<string, CellData>();
    for (const cell of proj.cells) {
      if (fcFilter === 'income' && !cell.financialCodeIsIncome) continue;
      if (fcFilter === 'cost' && cell.financialCodeIsIncome) continue;
      const jobKey = cell.jobUuid ?? NULL_JOB_KEY;
      cellMap.set(`${jobKey}:${cell.financialCodeUuid}`, cell);
    }

    const jobList = Array.from(jobMap.values()).sort((a, b) => {
      if (a.key === NULL_JOB_KEY && b.key !== NULL_JOB_KEY) return 1;
      if (a.key !== NULL_JOB_KEY && b.key === NULL_JOB_KEY) return -1;
      return a.label.localeCompare(b.label);
    });
    const fcList = Array.from(fcMap.values()).sort((a, b) => a.validation.localeCompare(b.validation));
    return { jobList, fcList, cellMap };
  }

  const activeMetrics = useMemo(() => ALL_METRICS.filter((m) => selectedMetrics.has(m)), [selectedMetrics]);

  // ── XLSX export ──

  const handleExport = () => {
    if (!report?.projects?.length) return;
    const wb = XLSX.utils.book_new();
    for (const proj of report.projects) {
      const fcFilter = projectFcFilters[proj.projectUuid] ?? 'all';
      const { jobList, fcList, cellMap } = buildPivot(proj, fcFilter);
      const sheetName = `${proj.projectIndex}`.replace(/[\\/:*?[\]]/g, '_').slice(0, 31);
      const headerRow = ['Job', ...fcList.flatMap((fc) => activeMetrics.map((m) => `${fc.validation} / ${METRIC_LABELS[m]}`)), 'Total'];
      const dataRows = jobList.map((job) => {
        let rowTotal = 0;
        const cols = fcList.flatMap((fc) => activeMetrics.map((m) => {
          const cell = cellMap.get(`${job.key}:${fc.uuid}`);
          const v = cell ? getCellValue(cell, m) : 0;
          if (m !== 'paymentCount') rowTotal += v;
          return v;
        }));
        return [job.label, ...cols, rowTotal];
      });
      const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
    XLSX.writeFile(wb, `projects-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const selectedProjectLabels = useMemo(() =>
    Array.from(selectedProjectUuids).map((uuid) => {
      const p = allProjects.find((x) => x.project_uuid === uuid);
      return p ? `${p.project_index} – ${p.project_name}` : uuid;
    }), [selectedProjectUuids, allProjects]);

  const metricOptions = useMemo(() => ALL_METRICS.map((m) => ({ value: m, label: METRIC_LABELS[m] })), []);

  return (
    <div className="p-4 space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-start gap-3">

        {/* Project selector */}
        <div className="relative">
          <Button
            variant="outline" size="sm"
            onClick={() => setProjectSelectorOpen((v) => !v)}
            className="flex items-center gap-1 min-w-[200px] justify-between"
          >
            <span className="truncate max-w-[300px]">
              {selectedProjectUuids.size === 0 ? 'Select projects…' : `${selectedProjectUuids.size} project${selectedProjectUuids.size !== 1 ? 's' : ''} selected`}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0" />
          </Button>

          {projectSelectorOpen && (
            <div className="absolute z-50 top-full left-0 mt-1 w-[420px] bg-white border border-gray-200 rounded-lg shadow-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input placeholder="Search projects…" value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)} className="h-7 text-xs" autoFocus />
                <button className="text-xs text-gray-500 hover:text-gray-800 shrink-0" onClick={() => setSelectedProjectUuids(new Set())}>Clear all</button>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-0.5">
                {filteredProjects.map((p) => {
                  const checked = selectedProjectUuids.has(p.project_uuid);
                  return (
                    <label key={p.project_uuid} className="flex items-start gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer text-xs">
                      <input type="checkbox" checked={checked} onChange={() => {
                        setSelectedProjectUuids((prev) => {
                          const next = new Set(prev);
                          checked ? next.delete(p.project_uuid) : next.add(p.project_uuid);
                          return next;
                        });
                      }} className="mt-0.5" />
                      <span>
                        <span className="font-mono font-semibold text-gray-700">{p.project_index}</span>
                        <span className="text-gray-500 ml-1">{p.project_name}</span>
                        {p.state && <span className="ml-1 text-gray-400">· {p.state}</span>}
                      </span>
                    </label>
                  );
                })}
                {filteredProjects.length === 0 && <p className="text-xs text-gray-400 px-2 py-2">No projects found</p>}
              </div>
              <div className="flex justify-end pt-1 border-t">
                <Button size="sm" className="h-7 text-xs" onClick={() => setProjectSelectorOpen(false)}>Done</Button>
              </div>
            </div>
          )}
        </div>

        {/* Max date */}
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500 shrink-0">As of:</label>
          <Input type="date" value={maxDate} onChange={(e) => setMaxDate(e.target.value)} className="h-7 text-xs w-36" />
          {maxDate && (
            <button onClick={() => setMaxDate('')} className="text-gray-400 hover:text-gray-600"><X className="h-3.5 w-3.5" /></button>
          )}
        </div>

        {/* Metrics multi-select */}
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500 shrink-0">Metrics:</label>
          <MultiSelectDropdown
            label={selectedMetrics.size === 0 ? 'None selected' : `${selectedMetrics.size} metric${selectedMetrics.size !== 1 ? 's' : ''}`}
            options={metricOptions}
            selected={selectedMetrics}
            onChange={(next) => setSelectedMetrics(next as Set<MetricKey>)}
          />
        </div>

        <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading || selectedProjectUuids.size === 0} className="flex items-center gap-1">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>

        <Button variant="outline" size="sm" onClick={handleExport} disabled={!report?.projects?.length} className="flex items-center gap-1">
          <Download className="h-3.5 w-3.5" />
          Export XLSX
        </Button>
      </div>

      {/* Selected project chips */}
      {selectedProjectLabels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedProjectLabels.map((label, i) => {
            const uuid = Array.from(selectedProjectUuids)[i];
            return (
              <span key={uuid} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full border border-blue-200">
                {label}
                <button onClick={() => setSelectedProjectUuids((prev) => { const n = new Set(prev); n.delete(uuid); return n; })} className="hover:text-blue-900">
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{error}</div>}

      {!loading && selectedProjectUuids.size === 0 && (
        <div className="text-sm text-gray-400 py-12 text-center">Select one or more projects to generate the report.</div>
      )}

      {loading && <div className="text-sm text-gray-500 py-8 text-center">Loading…</div>}

      {/* ── Project grids ── */}
      {!loading && report?.projects?.map((proj) => {
        const fcFilter = projectFcFilters[proj.projectUuid] ?? 'all';
        const { jobList, fcList, cellMap } = buildPivot(proj, fcFilter);
        const isCollapsed = collapsedProjects.has(proj.projectUuid);
        const jobColKey = `${proj.projectUuid}:job`;
        const totalColKey = `${proj.projectUuid}:total`;
        const jobColW = getColWidth(jobColKey, JOB_COL_DEFAULT_WIDTH);
        const totalColW = getColWidth(totalColKey, TOTAL_COL_DEFAULT_WIDTH);

        return (
          <div key={proj.projectUuid} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Section header */}
            <div
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200 cursor-pointer select-none"
              onClick={() => toggleCollapse(proj.projectUuid)}
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />}
              <span className="font-mono font-semibold text-sm text-gray-800">{proj.projectIndex}</span>
              <span className="font-medium text-sm text-gray-700">{proj.projectName}</span>
              {proj.projectAddress && <span className="text-xs text-gray-500">· {proj.projectAddress}</span>}

              {/* FC filter */}
              <div className="flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                <span className="text-xs text-gray-400">FCs:</span>
                <select
                  value={fcFilter}
                  onChange={(e) => setProjectFcFilters((prev) => ({ ...prev, [proj.projectUuid]: e.target.value as FcFilter }))}
                  className="h-6 text-[11px] border border-gray-200 rounded px-1.5 bg-white text-gray-600 cursor-pointer"
                >
                  <option value="all">All</option>
                  <option value="income">Incomes</option>
                  <option value="cost">Costs</option>
                </select>
              </div>

              <span className="ml-auto flex items-center gap-3 text-xs text-gray-500">
                {proj.status && <span className="bg-gray-100 px-2 py-0.5 rounded">{proj.status}</span>}
                {proj.serviceState && proj.serviceState !== '-' && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{proj.serviceState}</span>}
                {proj.insiderName && proj.insiderName !== '-' && <span>Insider: {proj.insiderName}</span>}
                {proj.department && proj.department !== '-' && <span>Dept: {proj.department}</span>}
                <span className="text-gray-400">{fcList.length} FCs · {jobList.length} jobs</span>
              </span>
            </div>

            {!isCollapsed && (
              <div className="overflow-x-auto">
                {fcList.length === 0 ? (
                  <p className="text-xs text-gray-400 px-4 py-6 text-center">No payments data for this project.</p>
                ) : activeMetrics.length === 0 ? (
                  <p className="text-xs text-gray-400 px-4 py-6 text-center">Select at least one metric to display data.</p>
                ) : (
                  <table
                    className="border-collapse text-xs"
                    style={{ tableLayout: 'fixed', minWidth: '100%', userSelect: resizing ? 'none' : undefined } as React.CSSProperties}
                  >
                    <thead>
                      {/* Row 1: FC group headers */}
                      <tr className="bg-gray-100 border-b border-gray-200">
                        <th
                          className="sticky left-0 z-10 bg-gray-100 border-r border-gray-200 relative overflow-hidden"
                          style={{ width: jobColW, minWidth: jobColW }}
                          rowSpan={2}
                        >
                          <div className="px-3 py-2 text-left font-semibold text-gray-700 text-xs">Job</div>
                          <div className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-blue-300 opacity-0 hover:opacity-60" onMouseDown={(e) => startResize(e, jobColKey, JOB_COL_DEFAULT_WIDTH)} />
                        </th>
                        {fcList.map((fc) => (
                          <th
                            key={fc.uuid}
                            colSpan={activeMetrics.length}
                            className="px-2 py-1.5 text-center font-semibold text-gray-700 border-r border-gray-200 text-xs bg-gray-100"
                          >
                            <span className="truncate block max-w-full" title={fc.validation}>{fc.validation}</span>
                          </th>
                        ))}
                        <th
                          className="bg-gray-100 border-l border-gray-200 relative overflow-hidden"
                          style={{ width: totalColW, minWidth: totalColW }}
                          rowSpan={2}
                        >
                          <div className="px-3 py-2 text-right font-semibold text-gray-700 text-xs">Total</div>
                          <div className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-blue-300 opacity-0 hover:opacity-60" onMouseDown={(e) => startResize(e, totalColKey, TOTAL_COL_DEFAULT_WIDTH)} />
                        </th>
                      </tr>
                      {/* Row 2: metric sub-headers */}
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {fcList.flatMap((fc) =>
                          activeMetrics.map((m, mi) => {
                            const colKey = `${proj.projectUuid}:${fc.uuid}:${m}`;
                            const colW = getColWidth(colKey, FC_COL_DEFAULT_WIDTH);
                            const isLast = mi === activeMetrics.length - 1;
                            return (
                              <th
                                key={`${fc.uuid}:${m}`}
                                className={`relative overflow-hidden px-2 py-1 text-center text-[10px] font-medium text-gray-500 ${isLast ? 'border-r border-gray-200' : 'border-r border-gray-100'}`}
                                style={{ width: colW, minWidth: colW }}
                              >
                                {METRIC_LABELS[m]}
                                <div className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-blue-300 opacity-0 hover:opacity-60" onMouseDown={(e) => startResize(e, colKey, FC_COL_DEFAULT_WIDTH)} />
                              </th>
                            );
                          })
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {jobList.map((job, rowIdx) => {
                        const isNoJob = job.key === NULL_JOB_KEY;
                        const rowBg = rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40';
                        const stickyBg = rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                        const rowTotal = fcList.reduce((sum, fc) => {
                          const cell = cellMap.get(`${job.key}:${fc.uuid}`);
                          if (!cell) return sum;
                          return sum + activeMetrics.reduce((s, m) => m === 'paymentCount' ? s : s + getCellValue(cell, m), 0);
                        }, 0);

                        return (
                          <tr key={job.key} className={`border-b border-gray-100 ${rowBg}`}>
                            <td
                              className={`sticky left-0 z-10 px-3 py-2 border-r border-gray-200 font-medium whitespace-nowrap overflow-hidden text-ellipsis ${stickyBg} ${isNoJob ? 'italic text-gray-400' : 'text-gray-800'}`}
                              style={{ width: jobColW, maxWidth: jobColW }}
                            >
                              {job.label}
                            </td>
                            {fcList.flatMap((fc) =>
                              activeMetrics.map((m, mi) => {
                                const colKey = `${proj.projectUuid}:${fc.uuid}:${m}`;
                                const colW = getColWidth(colKey, FC_COL_DEFAULT_WIDTH);
                                const isLast = mi === activeMetrics.length - 1;
                                const cell = cellMap.get(`${job.key}:${fc.uuid}`);
                                const value = cell ? getCellValue(cell, m) : 0;
                                return (
                                  <td
                                    key={`${fc.uuid}:${m}`}
                                    className={`px-3 py-2 text-right tabular-nums overflow-hidden ${isLast ? 'border-r border-gray-200' : 'border-r border-gray-100'}`}
                                    style={{ width: colW, maxWidth: colW }}
                                    title={cell?.paymentIds?.join(', ') || undefined}
                                  >
                                    {value !== 0 ? <span className="text-gray-800">{formatCell(value, m)}</span> : <span className="text-gray-200">—</span>}
                                  </td>
                                );
                              })
                            )}
                            <td
                              className="px-3 py-2 text-right font-semibold bg-gray-50 tabular-nums text-gray-700 border-l border-gray-200"
                              style={{ width: totalColW, maxWidth: totalColW }}
                            >
                              {rowTotal !== 0 ? <span>{formatMoney(rowTotal)}</span> : <span className="text-gray-300">—</span>}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Totals row */}
                      <tr className="border-t-2 border-gray-300 bg-gray-100 font-semibold">
                        <td className="sticky left-0 z-10 bg-gray-100 px-3 py-2 border-r border-gray-200 text-gray-800 whitespace-nowrap" style={{ width: jobColW, maxWidth: jobColW }}>TOTAL</td>
                        {fcList.flatMap((fc) =>
                          activeMetrics.map((m, mi) => {
                            const colKey = `${proj.projectUuid}:${fc.uuid}:${m}`;
                            const colW = getColWidth(colKey, FC_COL_DEFAULT_WIDTH);
                            const isLast = mi === activeMetrics.length - 1;
                            const colTotal = jobList.reduce((sum, job) => {
                              const cell = cellMap.get(`${job.key}:${fc.uuid}`);
                              return sum + (cell ? getCellValue(cell, m) : 0);
                            }, 0);
                            return (
                              <td
                                key={`${fc.uuid}:${m}`}
                                className={`px-3 py-2 text-right tabular-nums ${isLast ? 'border-r border-gray-200' : 'border-r border-gray-100'}`}
                                style={{ width: colW, maxWidth: colW }}
                              >
                                <span className={colTotal !== 0 ? 'text-gray-800' : 'text-gray-400'}>{formatCell(colTotal, m)}</span>
                              </td>
                            );
                          })
                        )}
                        <td
                          className="px-3 py-2 text-right bg-gray-200 tabular-nums text-gray-900 border-l border-gray-200"
                          style={{ width: totalColW, maxWidth: totalColW }}
                        >
                          {formatMoney(jobList.reduce((sum, job) =>
                            sum + fcList.reduce((s2, fc) =>
                              s2 + activeMetrics.reduce((s3, m) => {
                                if (m === 'paymentCount') return s3;
                                const cell = cellMap.get(`${job.key}:${fc.uuid}`);
                                return s3 + (cell ? getCellValue(cell, m) : 0);
                              }, 0)
                            , 0)
                          , 0))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        );
      })}

      {!loading && report?.projects?.length === 0 && selectedProjectUuids.size > 0 && (
        <div className="text-sm text-gray-400 py-8 text-center">No payment data found for the selected projects.</div>
      )}
    </div>
  );
}
