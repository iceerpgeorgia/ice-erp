'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  paymentCount: 'Payment Count',
};

type CellData = {
  jobUuid: string | null;
  jobName: string | null;
  financialCodeUuid: string;
  financialCodeValidation: string;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatMoney = (value: number) =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatCell = (value: number, metric: MetricKey) => {
  if (metric === 'paymentCount') return value === 0 ? '-' : String(value);
  return value === 0 ? '-' : formatMoney(value);
};

const NULL_JOB_KEY = '__NO_JOB__';

const METRIC_BG: Partial<Record<MetricKey, string>> = {
  accrual: '#fff3e0',
  latestAccrual: '#fff8e1',
  order: '#fff9e6',
  payment: '#e8f5e9',
  due: '#fce4ec',
  balance: '#e3f2fd',
};

// ─── Component ────────────────────────────────────────────────────────────────

const STORAGE_KEY_PROJECTS = 'projectsReportSelectedProjects';
const STORAGE_KEY_MAXDATE = 'projectsReportMaxDate';
const STORAGE_KEY_DEFAULT_METRIC = 'projectsReportDefaultMetric';

export function ProjectsReportTable() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Project selection
  const [allProjects, setAllProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectUuids, setSelectedProjectUuids] = useState<Set<string>>(new Set());
  const [projectSearch, setProjectSearch] = useState('');
  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false);

  // Filters
  const [maxDate, setMaxDate] = useState('');
  const [selectedInsiderUuids, setSelectedInsiderUuids] = useState<string[]>([]);

  // Report data
  const [report, setReport] = useState<ProjectsReportResponse | null>(null);

  // Per-column metric override: financialCodeUuid → MetricKey
  const [columnMetrics, setColumnMetrics] = useState<Record<string, MetricKey>>({});
  // Global default metric (applied to columns without a specific override)
  const [defaultMetric, setDefaultMetric] = useState<MetricKey>('accrual');

  // Collapsed sections
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());

  // Restore preferences
  useEffect(() => {
    const savedProjects = localStorage.getItem(STORAGE_KEY_PROJECTS);
    const savedMaxDate = localStorage.getItem(STORAGE_KEY_MAXDATE);
    const savedMetric = localStorage.getItem(STORAGE_KEY_DEFAULT_METRIC) as MetricKey | null;

    if (savedProjects) {
      try {
        const parsed = JSON.parse(savedProjects);
        if (Array.isArray(parsed)) setSelectedProjectUuids(new Set(parsed.map(String)));
      } catch { /* ignore */ }
    }
    if (savedMaxDate && /^\d{4}-\d{2}-\d{2}$/.test(savedMaxDate)) setMaxDate(savedMaxDate);
    if (savedMetric && savedMetric in METRIC_LABELS) setDefaultMetric(savedMetric);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(Array.from(selectedProjectUuids)));
  }, [selectedProjectUuids]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MAXDATE, maxDate || '');
  }, [maxDate]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DEFAULT_METRIC, defaultMetric);
  }, [defaultMetric]);

  // Load project list + insider selection
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

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Fetch report
  const fetchReport = useCallback(async () => {
    if (selectedProjectUuids.size === 0) {
      setReport({ projects: [] });
      return;
    }
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

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Filtered project list for selector
  const filteredProjects = useMemo(() => {
    const term = projectSearch.trim().toLowerCase();
    if (!term) return allProjects;
    return allProjects.filter((p) =>
      `${p.project_index} ${p.project_name}`.toLowerCase().includes(term)
    );
  }, [projectSearch, allProjects]);

  // Toggle section collapse
  const toggleCollapse = (uuid: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      next.has(uuid) ? next.delete(uuid) : next.add(uuid);
      return next;
    });
  };

  // Get metric value for a cell
  const getCellValue = (cell: CellData, metric: MetricKey): number => {
    return cell[metric] as number;
  };

  const getColumnMetric = (fcUuid: string): MetricKey =>
    columnMetrics[fcUuid] ?? defaultMetric;

  // XLSX export
  const handleExport = () => {
    if (!report?.projects?.length) return;
    const wb = XLSX.utils.book_new();

    for (const proj of report.projects) {
      const { jobList, fcList, cellMap } = buildPivot(proj);
      const sheetName = `${proj.projectIndex}`.replace(/[\\/:*?[\]]/g, '_').slice(0, 31);

      const headerRow = [
        'Job',
        ...fcList.map((fc) => `${fc.validation} (${METRIC_LABELS[getColumnMetric(fc.uuid)]})`),
        'Total',
      ];

      const dataRows = jobList.map((job) => {
        const rowTotal = fcList.reduce((sum, fc) => {
          const cell = cellMap.get(`${job.key}:${fc.uuid}`);
          return sum + (cell ? getCellValue(cell, getColumnMetric(fc.uuid)) : 0);
        }, 0);
        return [
          job.label,
          ...fcList.map((fc) => {
            const cell = cellMap.get(`${job.key}:${fc.uuid}`);
            return cell ? getCellValue(cell, getColumnMetric(fc.uuid)) : 0;
          }),
          rowTotal,
        ];
      });

      const totalsRow = [
        'TOTAL',
        ...fcList.map((fc) => {
          return jobList.reduce((sum, job) => {
            const cell = cellMap.get(`${job.key}:${fc.uuid}`);
            return sum + (cell ? getCellValue(cell, getColumnMetric(fc.uuid)) : 0);
          }, 0);
        }),
        jobList.reduce((sum, job) => {
          return sum + fcList.reduce((s2, fc) => {
            const cell = cellMap.get(`${job.key}:${fc.uuid}`);
            return s2 + (cell ? getCellValue(cell, getColumnMetric(fc.uuid)) : 0);
          }, 0);
        }, 0),
      ];

      const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows, totalsRow]);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    XLSX.writeFile(wb, `projects-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ─── Pivot builder ──────────────────────────────────────────────────────────

  function buildPivot(proj: ProjectData) {
    // Collect distinct jobs and FCs
    const jobMap = new Map<string, { key: string; label: string; jobUuid: string | null }>();
    const fcMap = new Map<string, { uuid: string; validation: string }>();

    for (const cell of proj.cells) {
      const jobKey = cell.jobUuid ?? NULL_JOB_KEY;
      if (!jobMap.has(jobKey)) {
        jobMap.set(jobKey, {
          key: jobKey,
          label: cell.jobName ?? '(No Job)',
          jobUuid: cell.jobUuid,
        });
      }
      if (!fcMap.has(cell.financialCodeUuid)) {
        fcMap.set(cell.financialCodeUuid, {
          uuid: cell.financialCodeUuid,
          validation: cell.financialCodeValidation,
        });
      }
    }

    // Build cell lookup
    const cellMap = new Map<string, CellData>();
    for (const cell of proj.cells) {
      const jobKey = cell.jobUuid ?? NULL_JOB_KEY;
      cellMap.set(`${jobKey}:${cell.financialCodeUuid}`, cell);
    }

    // Sort jobs: named jobs first (alphabetically), then "No Job"
    const jobList = Array.from(jobMap.values()).sort((a, b) => {
      if (a.key === NULL_JOB_KEY && b.key !== NULL_JOB_KEY) return 1;
      if (a.key !== NULL_JOB_KEY && b.key === NULL_JOB_KEY) return -1;
      return a.label.localeCompare(b.label);
    });

    // Sort FCs alphabetically by validation
    const fcList = Array.from(fcMap.values()).sort((a, b) =>
      a.validation.localeCompare(b.validation)
    );

    return { jobList, fcList, cellMap };
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const selectedProjectLabels = useMemo(() => {
    return Array.from(selectedProjectUuids)
      .map((uuid) => {
        const p = allProjects.find((x) => x.project_uuid === uuid);
        return p ? `${p.project_index} – ${p.project_name}` : uuid;
      });
  }, [selectedProjectUuids, allProjects]);

  return (
    <div className="p-4 space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-start gap-3">

        {/* Project selector */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setProjectSelectorOpen((v) => !v)}
            className="flex items-center gap-1 min-w-[200px] justify-between"
          >
            <span className="truncate max-w-[300px]">
              {selectedProjectUuids.size === 0
                ? 'Select projects…'
                : `${selectedProjectUuids.size} project${selectedProjectUuids.size !== 1 ? 's' : ''} selected`}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0" />
          </Button>

          {projectSelectorOpen && (
            <div className="absolute z-50 top-full left-0 mt-1 w-[420px] bg-white border border-gray-200 rounded-lg shadow-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search projects…"
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  className="h-7 text-xs"
                  autoFocus
                />
                <button
                  className="text-xs text-gray-500 hover:text-gray-800 shrink-0"
                  onClick={() => setSelectedProjectUuids(new Set())}
                >
                  Clear all
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-0.5">
                {filteredProjects.map((p) => {
                  const checked = selectedProjectUuids.has(p.project_uuid);
                  return (
                    <label
                      key={p.project_uuid}
                      className="flex items-start gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedProjectUuids((prev) => {
                            const next = new Set(prev);
                            checked ? next.delete(p.project_uuid) : next.add(p.project_uuid);
                            return next;
                          });
                        }}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="font-mono font-semibold text-gray-700">{p.project_index}</span>
                        <span className="text-gray-500 ml-1">{p.project_name}</span>
                        {p.state && <span className="ml-1 text-gray-400">· {p.state}</span>}
                      </span>
                    </label>
                  );
                })}
                {filteredProjects.length === 0 && (
                  <p className="text-xs text-gray-400 px-2 py-2">No projects found</p>
                )}
              </div>
              <div className="flex justify-end pt-1 border-t">
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setProjectSelectorOpen(false)}
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Max date */}
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500 shrink-0">As of:</label>
          <Input
            type="date"
            value={maxDate}
            onChange={(e) => setMaxDate(e.target.value)}
            className="h-7 text-xs w-36"
          />
          {maxDate && (
            <button onClick={() => setMaxDate('')} className="text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Default metric */}
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500 shrink-0">Default metric:</label>
          <select
            value={defaultMetric}
            onChange={(e) => setDefaultMetric(e.target.value as MetricKey)}
            className="h-7 text-xs border border-gray-200 rounded px-2 bg-white"
          >
            {(Object.entries(METRIC_LABELS) as [MetricKey, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <Button
          variant="outline"
          size="sm"
          onClick={fetchReport}
          disabled={loading || selectedProjectUuids.size === 0}
          className="flex items-center gap-1"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={!report?.projects?.length}
          className="flex items-center gap-1"
        >
          <Download className="h-3.5 w-3.5" />
          Export XLSX
        </Button>
      </div>

      {/* Selected projects chips */}
      {selectedProjectLabels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedProjectLabels.map((label, i) => {
            const uuid = Array.from(selectedProjectUuids)[i];
            return (
              <span
                key={uuid}
                className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full border border-blue-200"
              >
                {label}
                <button
                  onClick={() => setSelectedProjectUuids((prev) => { const n = new Set(prev); n.delete(uuid); return n; })}
                  className="hover:text-blue-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{error}</div>
      )}

      {/* Empty state */}
      {!loading && selectedProjectUuids.size === 0 && (
        <div className="text-sm text-gray-400 py-12 text-center">
          Select one or more projects to generate the report.
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-sm text-gray-500 py-8 text-center">Loading…</div>
      )}

      {/* ── Project grids ── */}
      {!loading && report?.projects?.map((proj) => {
        const { jobList, fcList, cellMap } = buildPivot(proj);
        const isCollapsed = collapsedProjects.has(proj.projectUuid);

        return (
          <div key={proj.projectUuid} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Section header */}
            <div
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200 cursor-pointer select-none"
              onClick={() => toggleCollapse(proj.projectUuid)}
            >
              {isCollapsed
                ? <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />
                : <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />
              }
              <span className="font-mono font-semibold text-sm text-gray-800">{proj.projectIndex}</span>
              <span className="font-medium text-sm text-gray-700">{proj.projectName}</span>
              {proj.projectAddress && (
                <span className="text-xs text-gray-500">· {proj.projectAddress}</span>
              )}
              <span className="ml-auto flex items-center gap-3 text-xs text-gray-500">
                {proj.status && <span className="bg-gray-100 px-2 py-0.5 rounded">{proj.status}</span>}
                {proj.serviceState && proj.serviceState !== '-' && (
                  <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{proj.serviceState}</span>
                )}
                {proj.insiderName && proj.insiderName !== '-' && (
                  <span>Insider: {proj.insiderName}</span>
                )}
                {proj.department && proj.department !== '-' && (
                  <span>Dept: {proj.department}</span>
                )}
                <span className="text-gray-400">{fcList.length} FCs · {jobList.length} jobs</span>
              </span>
            </div>

            {!isCollapsed && (
              <div className="overflow-x-auto">
                {fcList.length === 0 ? (
                  <p className="text-xs text-gray-400 px-4 py-6 text-center">No payments data for this project.</p>
                ) : (
                  <table className="border-collapse text-xs" style={{ tableLayout: 'auto', minWidth: '100%' }}>
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {/* Job column header */}
                        <th
                          className="sticky left-0 z-10 bg-gray-50 text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-200 whitespace-nowrap"
                          style={{ minWidth: 180 }}
                        >
                          Job
                        </th>
                        {/* Financial code columns */}
                        {fcList.map((fc) => {
                          const metric = getColumnMetric(fc.uuid);
                          const bg = METRIC_BG[metric] ?? '#f9fafb';
                          return (
                            <th
                              key={fc.uuid}
                              className="px-2 py-1.5 text-center font-semibold text-gray-700 border-r border-gray-200"
                              style={{ minWidth: 140, background: bg }}
                            >
                              <div className="font-semibold text-xs text-gray-800 truncate max-w-[160px]" title={fc.validation}>
                                {fc.validation}
                              </div>
                              {/* Metric picker */}
                              <select
                                value={metric}
                                onChange={(e) => {
                                  const val = e.target.value as MetricKey;
                                  setColumnMetrics((prev) => ({ ...prev, [fc.uuid]: val }));
                                }}
                                className="mt-1 w-full text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-600 cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {(Object.entries(METRIC_LABELS) as [MetricKey, string][]).map(([k, v]) => (
                                  <option key={k} value={k}>{v}</option>
                                ))}
                              </select>
                            </th>
                          );
                        })}
                        {/* Total column */}
                        <th
                          className="px-3 py-2 text-right font-semibold text-gray-700 bg-gray-100 whitespace-nowrap"
                          style={{ minWidth: 120 }}
                        >
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobList.map((job, rowIdx) => {
                        const isNoJob = job.key === NULL_JOB_KEY;
                        const rowTotal = fcList.reduce((sum, fc) => {
                          const cell = cellMap.get(`${job.key}:${fc.uuid}`);
                          return sum + (cell ? getCellValue(cell, getColumnMetric(fc.uuid)) : 0);
                        }, 0);

                        return (
                          <tr
                            key={job.key}
                            className={`border-b border-gray-100 ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
                          >
                            {/* Job name cell */}
                            <td
                              className={`sticky left-0 z-10 px-3 py-2 border-r border-gray-200 font-medium whitespace-nowrap ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${isNoJob ? 'italic text-gray-400' : 'text-gray-800'}`}
                            >
                              {job.label}
                            </td>
                            {/* FC cells */}
                            {fcList.map((fc) => {
                              const cell = cellMap.get(`${job.key}:${fc.uuid}`);
                              const metric = getColumnMetric(fc.uuid);
                              const value = cell ? getCellValue(cell, metric) : 0;
                              const bg = METRIC_BG[metric] ?? 'transparent';
                              return (
                                <td
                                  key={fc.uuid}
                                  className="px-3 py-2 text-right border-r border-gray-100 tabular-nums"
                                  style={{ background: value !== 0 ? bg : undefined }}
                                  title={cell?.paymentIds?.join(', ') || undefined}
                                >
                                  {cell ? (
                                    <span className={value !== 0 ? 'text-gray-800' : 'text-gray-300'}>
                                      {formatCell(value, metric)}
                                    </span>
                                  ) : (
                                    <span className="text-gray-200">—</span>
                                  )}
                                </td>
                              );
                            })}
                            {/* Row total */}
                            <td className="px-3 py-2 text-right font-semibold bg-gray-50 tabular-nums text-gray-700">
                              {rowTotal !== 0
                                ? <span>{formatMoney(rowTotal)}</span>
                                : <span className="text-gray-300">—</span>
                              }
                            </td>
                          </tr>
                        );
                      })}

                      {/* Totals row */}
                      <tr className="border-t-2 border-gray-300 bg-gray-100 font-semibold">
                        <td className="sticky left-0 z-10 bg-gray-100 px-3 py-2 border-r border-gray-200 text-gray-800 whitespace-nowrap">
                          TOTAL
                        </td>
                        {fcList.map((fc) => {
                          const metric = getColumnMetric(fc.uuid);
                          const colTotal = jobList.reduce((sum, job) => {
                            const cell = cellMap.get(`${job.key}:${fc.uuid}`);
                            return sum + (cell ? getCellValue(cell, metric) : 0);
                          }, 0);
                          const bg = METRIC_BG[metric] ?? 'transparent';
                          return (
                            <td
                              key={fc.uuid}
                              className="px-3 py-2 text-right border-r border-gray-200 tabular-nums"
                              style={{ background: bg }}
                            >
                              <span className={colTotal !== 0 ? 'text-gray-800' : 'text-gray-400'}>
                                {formatCell(colTotal, metric)}
                              </span>
                            </td>
                          );
                        })}
                        {/* Grand total */}
                        <td className="px-3 py-2 text-right bg-gray-200 tabular-nums text-gray-900">
                          {formatMoney(
                            jobList.reduce((sum, job) => {
                              return sum + fcList.reduce((s2, fc) => {
                                const cell = cellMap.get(`${job.key}:${fc.uuid}`);
                                return s2 + (cell ? getCellValue(cell, getColumnMetric(fc.uuid)) : 0);
                              }, 0);
                            }, 0)
                          )}
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

      {/* No data after fetch */}
      {!loading && report?.projects?.length === 0 && selectedProjectUuids.size > 0 && (
        <div className="text-sm text-gray-400 py-8 text-center">
          No payment data found for the selected projects.
        </div>
      )}
    </div>
  );
}
