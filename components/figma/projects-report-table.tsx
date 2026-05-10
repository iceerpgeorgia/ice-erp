'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Download, Filter, Plus, RefreshCw, Search, Settings, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Combobox } from '../ui/combobox';
import * as XLSX from 'xlsx-js-style';

// ─── Types ────────────────────────────────────────────────────────────────────

type MetricKey = 'accrual' | 'latestAccrual' | 'order' | 'lastMonthAccrual' | 'lastMonthOrder' | 'payment' | 'due' | 'balance' | 'paymentCount' | 'accrualPerFloor';

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
  accrualPerFloor: 'Accrual/Floor',
};

const NON_ADDITIVE_METRICS = new Set<MetricKey>(['paymentCount', 'accrualPerFloor']);

const ALL_METRICS = Object.keys(METRIC_LABELS) as MetricKey[];

type CellData = {
  jobUuid: string | null;
  jobName: string | null;
  financialCodeUuid: string;
  financialCodeValidation: string;
  financialCodeCode: string;
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
  accrualPerFloor: number;
  jobFloors: number;
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
  totalJobsInProject: number;
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
  if (metric === 'accrualPerFloor') return value === 0 ? '-' : formatMoney(value);
  return value === 0 ? '-' : formatMoney(value);
};

const NULL_JOB_KEY = '__NO_JOB__';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY_PROJECTS = 'projectsReportSelectedProjects';
const STORAGE_KEY_MAXDATE = 'projectsReportMaxDate';
const STORAGE_KEY_METRICS = 'projectsReportSelectedMetrics';
const STORAGE_KEY_CURRENCIES = 'projectsReportCurrencies';
const STORAGE_KEY_FC_FILTERS = 'projectsReportFcFilters';
const STORAGE_KEY_COLLAPSED = 'projectsReportCollapsed';
const STORAGE_KEY_COL_WIDTHS = 'projectsReportColWidths';
const STORAGE_KEY_ORDER = 'projectsReportOrder';
const STORAGE_KEY_FC_FULL = 'projectsReportFcFull';
const STORAGE_KEY_DEFAULT_CURRENCY = 'projectsReportDefaultCurrency';

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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [allProjects, setAllProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectUuids, setSelectedProjectUuids] = useState<Set<string>>(new Set());
  const [projectSearch, setProjectSearch] = useState('');
  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false);

  const [maxDate, setMaxDate] = useState('');
  const [selectedInsiderUuids, setSelectedInsiderUuids] = useState<string[]>([]);
  const [insidersList, setInsidersList] = useState<Array<{ value: string; label: string }>>([]);

  const [report, setReport] = useState<ProjectsReportResponse | null>(null);

  const [selectedMetrics, setSelectedMetrics] = useState<Set<MetricKey>>(new Set(['accrual']));
  const [projectFcFilters, setProjectFcFilters] = useState<Record<string, FcFilter>>({});
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());

  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [resizing, setResizing] = useState<{ key: string; startX: number; startWidth: number } | null>(null);
  const [fcFullMode, setFcFullMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [defaultCurrency, setDefaultCurrency] = useState<'GEL' | 'USD' | 'EUR'>('GEL');
  const [fcTooltip, setFcTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [projectCurrencies, setProjectCurrencies] = useState<Record<string, 'USD' | 'GEL' | 'EUR'>>({});
  const [projectOrder, setProjectOrder] = useState<string[]>([]);
  const [projectLoadingUuids, setProjectLoadingUuids] = useState<Set<string>>(new Set());
  // Ref so fetchReport/fetchOneProject always see latest currencies without re-creating callbacks
  const projectCurrenciesRef = useRef<Record<string, 'USD' | 'GEL' | 'EUR'>>({});
  useEffect(() => { projectCurrenciesRef.current = projectCurrencies; }, [projectCurrencies]);
  // Drag state (no React state — we don’t need re-renders mid-drag)
  const dragUuid = useRef<string | null>(null);
  const dragOverUuid = useRef<string | null>(null);

  // ── Add Ledger dialog state ──

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [addLedgerStep, setAddLedgerStep] = useState<'payment' | 'ledger'>('payment');
  const [cellPrefill, setCellPrefill] = useState<{
    projectUuid: string;
    projectLabel: string;
    financialCodeUuid: string;
    financialCodeLabel: string;
    jobUuid: string | null;
    jobLabel: string | null;
  } | null>(null);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [preSelectedPaymentId, setPreSelectedPaymentId] = useState<string | null>(null);
  const [selectedPaymentDetails, setSelectedPaymentDetails] = useState<{
    paymentId: string; counteragent: string; project: string;
    job: string; financialCode: string; incomeTax: boolean; currency: string;
  } | null>(null);
  const [dlgCounterAgents, setDlgCounterAgents] = useState<Array<{ counteragent_uuid?: string; counteragentUuid?: string; counteragent?: string; name?: string }>>([]);
  const [dlgFinancialCodes, setDlgFinancialCodes] = useState<Array<{ uuid: string; validation: string; code: string }>>([]);
  const [dlgCurrencies, setDlgCurrencies] = useState<Array<{ uuid: string; code: string; name: string }>>([]);
  const [dlgJobs, setDlgJobs] = useState<Array<{ jobUuid: string; jobName: string; jobDisplay?: string }>>([]);
  const [dlgPayments, setDlgPayments] = useState<Array<{
    paymentId: string; counteragentUuid?: string | null; counteragentName?: string | null;
    projectIndex?: string | null; projectName?: string | null; jobName?: string | null;
    financialCode?: string | null; incomeTax?: boolean | null; currencyCode?: string | null;
  }>>([]);
  const [dlgSelectedCounteragentUuid, setDlgSelectedCounteragentUuid] = useState('');
  const [dlgSelectedProjectUuid, setDlgSelectedProjectUuid] = useState('');
  const [dlgSelectedFinancialCodeUuid, setDlgSelectedFinancialCodeUuid] = useState('');
  const [dlgSelectedJobUuid, setDlgSelectedJobUuid] = useState('');
  const [dlgSelectedCurrencyUuid, setDlgSelectedCurrencyUuid] = useState('');
  const [dlgSelectedIncomeTax, setDlgSelectedIncomeTax] = useState(false);
  const [dlgSelectedLabel, setDlgSelectedLabel] = useState('');
  const [dlgSkipCounteragentFilter, setDlgSkipCounteragentFilter] = useState<{ uuid: string; name: string } | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [accrual, setAccrual] = useState('');
  const [ledgerOrder, setLedgerOrder] = useState('');
  const [ledgerComment, setLedgerComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Add Job dialog state ──
  const [addJobOpen, setAddJobOpen] = useState(false);
  const [addJobProjectUuid, setAddJobProjectUuid] = useState('');
  const [addJobProjectLabel, setAddJobProjectLabel] = useState('');
  const [addJobName, setAddJobName] = useState('');
  const [addJobFactoryNo, setAddJobFactoryNo] = useState('');
  const [addJobFloors, setAddJobFloors] = useState('');
  const [addJobWeight, setAddJobWeight] = useState('');
  const [addJobIsFf, setAddJobIsFf] = useState(false);
  const [addJobBrandUuid, setAddJobBrandUuid] = useState('');
  const [addJobInsiderUuid, setAddJobInsiderUuid] = useState('');
  const [addJobBrands, setAddJobBrands] = useState<Array<{ uuid: string; name: string }>>([]);
  const [isAddJobSubmitting, setIsAddJobSubmitting] = useState(false);

  // ── Restore preferences ──

  useEffect(() => {
    const savedProjects = localStorage.getItem(STORAGE_KEY_PROJECTS);
    const savedMaxDate = localStorage.getItem(STORAGE_KEY_MAXDATE);
    const savedMetrics = localStorage.getItem(STORAGE_KEY_METRICS);
    const savedCurrencies = localStorage.getItem(STORAGE_KEY_CURRENCIES);
    const savedFcFilters = localStorage.getItem(STORAGE_KEY_FC_FILTERS);
    const savedCollapsed = localStorage.getItem(STORAGE_KEY_COLLAPSED);
    const savedColWidths = localStorage.getItem(STORAGE_KEY_COL_WIDTHS);

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
    if (savedCurrencies) {
      try {
        const parsed = JSON.parse(savedCurrencies);
        if (parsed && typeof parsed === 'object') setProjectCurrencies(parsed);
      } catch { /* ignore */ }
    }
    if (savedFcFilters) {
      try {
        const parsed = JSON.parse(savedFcFilters);
        if (parsed && typeof parsed === 'object') setProjectFcFilters(parsed);
      } catch { /* ignore */ }
    }
    if (savedCollapsed) {
      try {
        const parsed = JSON.parse(savedCollapsed);
        if (Array.isArray(parsed)) setCollapsedProjects(new Set(parsed.map(String)));
      } catch { /* ignore */ }
    }
    if (savedColWidths) {
      try {
        const parsed = JSON.parse(savedColWidths);
        if (parsed && typeof parsed === 'object') setColWidths(parsed);
      } catch { /* ignore */ }
    }
    const savedFcFull = localStorage.getItem(STORAGE_KEY_FC_FULL);
    if (savedFcFull === 'true') setFcFullMode(true);
    const savedDefaultCurrency = localStorage.getItem(STORAGE_KEY_DEFAULT_CURRENCY);
    if (savedDefaultCurrency === 'USD' || savedDefaultCurrency === 'EUR') setDefaultCurrency(savedDefaultCurrency);
    const savedOrder = localStorage.getItem(STORAGE_KEY_ORDER);
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder);
        if (Array.isArray(parsed)) setProjectOrder(parsed.map(String));
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => { localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(Array.from(selectedProjectUuids))); }, [selectedProjectUuids]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_MAXDATE, maxDate || ''); }, [maxDate]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_METRICS, JSON.stringify(Array.from(selectedMetrics))); }, [selectedMetrics]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_CURRENCIES, JSON.stringify(projectCurrencies)); }, [projectCurrencies]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_FC_FILTERS, JSON.stringify(projectFcFilters)); }, [projectFcFilters]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_COLLAPSED, JSON.stringify(Array.from(collapsedProjects))); }, [collapsedProjects]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_COL_WIDTHS, JSON.stringify(colWidths)); }, [colWidths]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify(projectOrder)); }, [projectOrder]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_FC_FULL, String(fcFullMode)); }, [fcFullMode]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_DEFAULT_CURRENCY, defaultCurrency); }, [defaultCurrency]);

  // Apply defaultCurrency to newly-added projects (those without an explicit currency set)
  useEffect(() => {
    setProjectCurrencies((prev) => {
      const next = { ...prev };
      let changed = false;
      selectedProjectUuids.forEach((uuid) => {
        if (!next[uuid]) {
          next[uuid] = defaultCurrency;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectUuids, defaultCurrency]);

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
        const raw = Array.isArray(insiderData?.selectedInsiders) && insiderData.selectedInsiders.length > 0
          ? insiderData.selectedInsiders
          : (Array.isArray(insiderData?.options) ? insiderData.options : []);
        setInsidersList(raw.map((o: any) => ({ value: o.insiderUuid, label: o.insiderName })));
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load projects');
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // ── Fetch report ──

  const fetchReport = useCallback(async (options?: { silent?: boolean }) => {
    if (selectedProjectUuids.size === 0) { setReport({ projects: [] }); return; }
    if (!options?.silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const currencies = projectCurrenciesRef.current;
      // Group projects by their chosen currency and fetch each group
      const currencyGroups = new Map<string, string[]>();
      for (const uuid of selectedProjectUuids) {
        const curr = currencies[uuid] ?? 'GEL';
        if (!currencyGroups.has(curr)) currencyGroups.set(curr, []);
        currencyGroups.get(curr)!.push(uuid);
      }
      const groupResults = await Promise.all(
        Array.from(currencyGroups.entries()).map(async ([curr, uuids]) => {
          const gParams = new URLSearchParams();
          gParams.set('projectUuids', uuids.join(','));
          if (maxDate && /^\d{4}-\d{2}-\d{2}$/.test(maxDate)) gParams.set('maxDate', maxDate);
          if (selectedInsiderUuids.length > 0) gParams.set('insiderUuids', selectedInsiderUuids.join(','));
          gParams.set('targetCurrency', curr);
          const res = await fetch(`/api/projects-report?${gParams}`);
          if (!res.ok) throw new Error('Failed to load projects report');
          const data = await res.json() as ProjectsReportResponse;
          return data.projects;
        })
      );
      const allProjectData = groupResults.flat();
      // Preserve selected order
      const ordered = Array.from(selectedProjectUuids)
        .map((uuid) => allProjectData.find((p) => p.projectUuid === uuid))
        .filter(Boolean) as ProjectsReportResponse['projects'];
      setReport({ projects: ordered });
    } catch (err: any) {
      setError(err?.message || 'Failed to load projects report');
    } finally {
      if (!options?.silent) setLoading(false);
      else setRefreshing(false);
    }
  }, [selectedProjectUuids, maxDate, selectedInsiderUuids]);

  // ── Fetch a single project’s data silently (used when currency changes) ──
  const fetchOneProject = useCallback(async (uuid: string, currency: 'USD' | 'GEL' | 'EUR') => {
    setProjectLoadingUuids((prev) => new Set(prev).add(uuid));
    try {
      const gParams = new URLSearchParams();
      gParams.set('projectUuids', uuid);
      if (maxDate && /^\d{4}-\d{2}-\d{2}$/.test(maxDate)) gParams.set('maxDate', maxDate);
      if (selectedInsiderUuids.length > 0) gParams.set('insiderUuids', selectedInsiderUuids.join(','));
      gParams.set('targetCurrency', currency);
      const res = await fetch(`/api/projects-report?${gParams}`);
      if (!res.ok) return;
      const data = await res.json() as ProjectsReportResponse;
      const updated = data.projects[0];
      if (!updated) return;
      setReport((prev) => {
        if (!prev) return prev;
        return { projects: prev.projects.map((p) => p.projectUuid === uuid ? updated : p) };
      });
    } catch { /* silent */ } finally {
      setProjectLoadingUuids((prev) => { const n = new Set(prev); n.delete(uuid); return n; });
    }
  }, [maxDate, selectedInsiderUuids]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // Keep projectOrder in sync when selected projects change
  useEffect(() => {
    setProjectOrder((prev) => {
      const filtered = prev.filter((uuid) => selectedProjectUuids.has(uuid));
      const added = Array.from(selectedProjectUuids).filter((uuid) => !filtered.includes(uuid));
      return [...filtered, ...added];
    });
  }, [selectedProjectUuids]);

  // ── Add Ledger: lazy loaders ──

  const fetchDlgCounterAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/counteragents');
      if (res.ok) setDlgCounterAgents(await res.json());
    } catch { /* ignore */ }
  }, []);

  const fetchDlgDictionaries = useCallback(async () => {
    try {
      const [fcRes, cRes] = await Promise.all([fetch('/api/financial-codes?leafOnly=true'), fetch('/api/currencies')]);
      if (fcRes.ok) setDlgFinancialCodes(await fcRes.json());
      if (cRes.ok) { const d = await cRes.json(); setDlgCurrencies(Array.isArray(d) ? d : d?.data ?? []); }
    } catch { /* ignore */ }
  }, []);

  const fetchDlgPayments = useCallback(async () => {
    try {
      const res = await fetch('/api/payment-id-options?includeSalary=true&projectionMonths=36');
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data)) return;
      setDlgPayments(data.map((p: any) => ({
        paymentId: p.paymentId || p.payment_id,
        counteragentUuid: p.counteragentUuid || p.counteragent_uuid || null,
        counteragentName: p.counteragentName || p.counteragent_name || null,
        projectIndex: p.projectIndex || p.project_index || null,
        projectName: p.projectName || p.project_name || null,
        jobName: p.jobName || p.job_name || null,
        financialCode: p.financialCode || p.financialCodeValidation || p.financial_code || null,
        incomeTax: p.incomeTax ?? null,
        currencyCode: p.currencyCode || p.currency_code || null,
      })));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!dlgSelectedProjectUuid) { setDlgJobs([]); setDlgSelectedJobUuid(''); return; }
    fetch(`/api/jobs?projectUuid=${dlgSelectedProjectUuid}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { setDlgJobs(Array.isArray(d) ? d : []); setDlgSelectedJobUuid(''); })
      .catch(() => setDlgJobs([]));
  }, [dlgSelectedProjectUuid]);

  // When jobs load after a cell-prefill open, restore the pre-set job UUID
  useEffect(() => {
    if (cellPrefill?.jobUuid && dlgJobs.length > 0) {
      setDlgSelectedJobUuid(cellPrefill.jobUuid);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dlgJobs]);

  useEffect(() => {
    if (preSelectedPaymentId && dlgPayments.length > 0 && !selectedPaymentDetails) {
      const p = dlgPayments.find(x => x.paymentId === preSelectedPaymentId);
      if (p) setSelectedPaymentDetails({ paymentId: p.paymentId, counteragent: p.counteragentName || 'N/A', project: p.projectIndex || 'N/A', job: p.jobName || 'N/A', financialCode: p.financialCode || 'N/A', incomeTax: p.incomeTax || false, currency: p.currencyCode || 'N/A' });
    }
  }, [preSelectedPaymentId, dlgPayments, selectedPaymentDetails]);

  // ── Add Ledger: handlers ──

  const resetLedgerForm = () => {
    setSelectedPaymentId('');
    setPreSelectedPaymentId(null);
    setSelectedPaymentDetails(null);
    setEffectiveDate('');
    setAccrual('');
    setLedgerOrder('');
    setLedgerComment('');
    setIsSubmitting(false);
    setAddLedgerStep('payment');
    setDlgSelectedCounteragentUuid('');
    setDlgSkipCounteragentFilter(null);
    setDlgSelectedProjectUuid('');
    setDlgSelectedFinancialCodeUuid('');
    setCellPrefill(null);
    setDlgSelectedJobUuid('');
    setDlgSelectedCurrencyUuid('');
    setDlgSelectedIncomeTax(false);
    setDlgSelectedLabel('');
    setIsCreatingPayment(false);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      resetLedgerForm();
    } else {
      setAddLedgerStep('payment');
      fetchDlgCounterAgents();
      fetchDlgDictionaries();
      fetchDlgPayments();
    }
  };

  const fetchDlgJobsForProject = useCallback((projectUuid: string) => {
    if (!projectUuid) return;
    fetch(`/api/jobs?projectUuid=${encodeURIComponent(projectUuid)}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setDlgJobs(d); })
      .catch(() => {});
  }, []);

  const resetAddJobForm = () => {
    setAddJobName('');
    setAddJobFactoryNo('');
    setAddJobFloors('');
    setAddJobWeight('');
    setAddJobIsFf(false);
    setAddJobBrandUuid('');
    // Keep insider pre-filled
  };

  const handleOpenAddJob = (projectUuid: string, projectLabel: string) => {
    resetAddJobForm();
    setAddJobProjectUuid(projectUuid);
    setAddJobProjectLabel(projectLabel);
    // Pre-fill insider from selectedInsiderUuids if exactly one
    if (selectedInsiderUuids.length === 1) setAddJobInsiderUuid(selectedInsiderUuids[0]);
    // Lazy-load brands if not yet loaded
    if (addJobBrands.length === 0) {
      fetch('/api/brands')
        .then(r => r.ok ? r.json() : [])
        .then((d: any[]) => setAddJobBrands(Array.isArray(d) ? d.map((b: any) => ({ uuid: b.uuid || b.id?.toString(), name: b.name })) : []))
        .catch(() => {});
    }
    setAddJobOpen(true);
  };

  const handleAddJob = async () => {
    if (!addJobName.trim()) { alert('Job Name is required'); return; }
    if (!addJobProjectUuid) { alert('Project is required'); return; }
    if (!addJobInsiderUuid) { alert('Insider is required'); return; }
    setIsAddJobSubmitting(true);
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobName: addJobName.trim(),
          projectUuids: [addJobProjectUuid],
          projectUuid: addJobProjectUuid,
          factoryNo: addJobFactoryNo.trim() || null,
          floors: addJobFloors === '' ? null : Number(addJobFloors),
          weight: addJobWeight === '' ? null : Number(addJobWeight),
          isFf: addJobIsFf,
          brandUuid: addJobBrandUuid || null,
          insiderUuid: addJobInsiderUuid,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'Failed to create job');
      }
      setAddJobOpen(false);
      resetAddJobForm();
      // Refresh jobs in add-ledger dropdown for this project
      if (dlgSelectedProjectUuid === addJobProjectUuid) {
        fetchDlgJobsForProject(addJobProjectUuid);
      }
      // Refresh report grid silently
      fetchReport({ silent: true });
    } catch (err: any) {
      alert(err.message || 'Failed to create job');
    } finally {
      setIsAddJobSubmitting(false);
    }
  };

  const handleCellAddLedger = (ctx: {
    projectUuid: string; projectLabel: string;
    financialCodeUuid: string; financialCodeLabel: string;
    jobUuid: string | null; jobLabel: string | null;
  }) => {
    setCellPrefill(ctx);
    setDlgSelectedProjectUuid(ctx.projectUuid);
    setDlgSelectedFinancialCodeUuid(ctx.financialCodeUuid);
    // Job UUID will be set reactively once jobs load (see jobs useEffect)
    handleDialogOpenChange(true);
  };

  const handleCreatePayment = async () => {
    if (!dlgSelectedCounteragentUuid || !dlgSelectedFinancialCodeUuid || !dlgSelectedCurrencyUuid) {
      alert('Please fill Counteragent, Financial Code, and Currency');
      return;
    }
    setIsCreatingPayment(true);
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counteragentUuid: dlgSelectedCounteragentUuid,
          projectUuid: dlgSelectedProjectUuid || null,
          financialCodeUuid: dlgSelectedFinancialCodeUuid,
          jobUuid: dlgSelectedJobUuid || null,
          incomeTax: dlgSelectedIncomeTax,
          currencyUuid: dlgSelectedCurrencyUuid,
          label: dlgSelectedLabel || null,
        }),
      });
      if (!response.ok) { const e = await response.json(); throw new Error(e.error || 'Failed to create payment'); }
      const result = await response.json();
      const newPaymentId = result?.data?.payment_id || result?.data?.paymentId;
      if (!newPaymentId) throw new Error('Payment ID not returned from server');
      const ca = dlgCounterAgents.find(c => (c.counteragent_uuid || c.counteragentUuid) === dlgSelectedCounteragentUuid);
      const proj = allProjects.find(p => p.project_uuid === dlgSelectedProjectUuid);
      const job = dlgJobs.find(j => j.jobUuid === dlgSelectedJobUuid);
      const fc = dlgFinancialCodes.find(f => f.uuid === dlgSelectedFinancialCodeUuid);
      const curr = dlgCurrencies.find(c => c.uuid === dlgSelectedCurrencyUuid);
      setPreSelectedPaymentId(newPaymentId);
      setSelectedPaymentId(newPaymentId);
      setSelectedPaymentDetails({
        paymentId: newPaymentId,
        counteragent: ca?.name || ca?.counteragent || 'N/A',
        project: proj?.project_index || proj?.project_name || 'N/A',
        job: job?.jobDisplay || job?.jobName || 'N/A',
        financialCode: fc?.validation || fc?.code || 'N/A',
        incomeTax: dlgSelectedIncomeTax,
        currency: curr?.code || 'N/A',
      });
      await fetchDlgPayments();
      setAddLedgerStep('ledger');
    } catch (err: any) {
      alert(err.message || 'Failed to create payment');
    } finally {
      setIsCreatingPayment(false);
    }
  };

  const handleSkipToLedger = () => {
    if (dlgSelectedCounteragentUuid) {
      const ca = dlgCounterAgents.find(c => (c.counteragent_uuid || c.counteragentUuid) === dlgSelectedCounteragentUuid);
      setDlgSkipCounteragentFilter({ uuid: dlgSelectedCounteragentUuid, name: ca?.counteragent || ca?.name || dlgSelectedCounteragentUuid });
    } else {
      setDlgSkipCounteragentFilter(null);
    }
    setAddLedgerStep('ledger');
  };

  const handleAddLedgerEntry = async () => {
    if (isSubmitting) return;
    if (!selectedPaymentId) { alert('Please select a payment'); return; }
    const accrualValue = accrual ? parseFloat(accrual) : null;
    const orderValue = ledgerOrder ? parseFloat(ledgerOrder) : null;
    if ((!accrualValue || accrualValue === 0) && (!orderValue || orderValue === 0)) {
      alert('Either Accrual or Order must be provided and cannot be zero');
      return;
    }
    let isoDate: string | undefined;
    if (effectiveDate) {
      const match = effectiveDate.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      if (match) { isoDate = `${match[3]}-${match[2]}-${match[1]}`; }
      else { alert('Please enter date in dd.mm.yyyy format'); return; }
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/payments-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: selectedPaymentId, effectiveDate: isoDate, accrual: accrualValue, order: orderValue, comment: ledgerComment || undefined }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to create ledger entry'); }
      setIsDialogOpen(false);
      resetLedgerForm();
      fetchReport({ silent: true });
    } catch (err: any) {
      alert(err.message || 'Failed to add ledger entry');
    } finally {
      setIsSubmitting(false);
    }
  };

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

  // Build the union of all FCs across all projects so every grid shows the same columns
  const globalFcMap = useMemo(() => {
    const map = new Map<string, { uuid: string; validation: string; code: string; isIncome: boolean }>();
    if (!report?.projects) return map;
    for (const proj of report.projects) {
      for (const cell of proj.cells) {
        if (!map.has(cell.financialCodeUuid)) {
          map.set(cell.financialCodeUuid, { uuid: cell.financialCodeUuid, validation: cell.financialCodeValidation, code: cell.financialCodeCode, isIncome: cell.financialCodeIsIncome });
        }
      }
    }
    return map;
  }, [report]);

  function buildPivot(proj: ProjectData, fcFilter: FcFilter) {
    const jobMap = new Map<string, { key: string; label: string; jobUuid: string | null; floors: number }>();

    for (const cell of proj.cells) {
      if (fcFilter === 'income' && !cell.financialCodeIsIncome) continue;
      if (fcFilter === 'cost' && cell.financialCodeIsIncome) continue;
      const jobKey = cell.jobUuid ?? NULL_JOB_KEY;
      if (!jobMap.has(jobKey)) {
        jobMap.set(jobKey, { key: jobKey, label: cell.jobName ?? '(No Job)', jobUuid: cell.jobUuid, floors: cell.jobFloors ?? 0 });
      } else {
        // take max in case of multiple cells for same job
        const existing = jobMap.get(jobKey)!;
        existing.floors = Math.max(existing.floors, cell.jobFloors ?? 0);
      }
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
    const fcList = Array.from(globalFcMap.values())
      .filter((fc) => {
        if (fcFilter === 'income') return fc.isIncome;
        if (fcFilter === 'cost') return !fc.isIncome;
        return true;
      })
      .sort((a, b) => a.code.localeCompare(b.code));
    return { jobList, fcList, cellMap };
  }

  const activeMetrics = useMemo(() => ALL_METRICS.filter((m) => selectedMetrics.has(m)), [selectedMetrics]);

  // ── Per-column auto widths (shared across all grids) ──
  const autoColWidthsMap = useMemo((): Map<string, number> => {
    const map = new Map<string, number>();
    if (!report?.projects) return map;
    const PX_PER_CHAR = 7.5;
    const CELL_PAD = 16;

    for (const proj of report.projects) {
      const fcFilter = projectFcFilters[proj.projectUuid] ?? 'all';
      // Build job+cell maps (mirrors buildPivot)
      const jobMap = new Map<string, { key: string; label: string }>();
      const cellMap = new Map<string, CellData>();
      for (const cell of proj.cells) {
        if (fcFilter === 'income' && !cell.financialCodeIsIncome) continue;
        if (fcFilter === 'cost' && cell.financialCodeIsIncome) continue;
        const jobKey = cell.jobUuid ?? NULL_JOB_KEY;
        if (!jobMap.has(jobKey)) jobMap.set(jobKey, { key: jobKey, label: cell.jobName ?? '(No Job)' });
        cellMap.set(`${jobKey}:${cell.financialCodeUuid}`, cell);
      }
      const jobList = Array.from(jobMap.values());
      const fcList = Array.from(globalFcMap.values()).filter((fc) =>
        fcFilter === 'income' ? fc.isIncome : fcFilter === 'cost' ? !fc.isIncome : true
      );

      // Job column: fit longest label
      const maxJobChars = jobList.reduce((max, j) => Math.max(max, j.label.length), 5);
      map.set('job', Math.max(map.get('job') ?? 0, Math.max(50, Math.min(240, Math.ceil(maxJobChars * PX_PER_CHAR + CELL_PAD)))));

      // Floors column: fit longest floors value (header "Floors" = 6 chars)
      const maxFloorsChars = proj.cells.reduce((max, cell) => {
        const f = cell.jobFloors ?? 0;
        return f > 0 ? Math.max(max, String(f).length) : max;
      }, 6 /* "Floors" header */);
      map.set('floors', Math.max(map.get('floors') ?? 0, Math.max(44, Math.ceil(maxFloorsChars * PX_PER_CHAR + CELL_PAD))));

      // Data columns: individual width per fc×metric
      for (const fc of fcList) {
        for (const m of activeMetrics) {
          const colKey = `${fc.uuid}:${m}`;
          let maxChars = 1;
          for (const job of jobList) {
            const cell = cellMap.get(`${job.key}:${fc.uuid}`);
            const v = cell ? (cell[m] as number) : 0;
            const s = formatCell(v, m);
            if (s !== '-') maxChars = Math.max(maxChars, s.length);
          }
          if (!NON_ADDITIVE_METRICS.has(m)) {
            const colTotal = jobList.reduce((s, job) => {
              const cell = cellMap.get(`${job.key}:${fc.uuid}`);
              return s + (cell ? (cell[m] as number) : 0);
            }, 0);
            if (colTotal !== 0) maxChars = Math.max(maxChars, formatCell(colTotal, m).length);
          }
          const w = Math.max(38, Math.ceil(maxChars * PX_PER_CHAR + CELL_PAD));
          map.set(colKey, Math.max(map.get(colKey) ?? 0, w));
        }
      }

      // Total column: fit longest row-sum
      let maxTotalChars = 1;
      for (const job of jobList) {
        const rowTotal = fcList.reduce((sum, fc) => {
          const cell = cellMap.get(`${job.key}:${fc.uuid}`);
          if (!cell) return sum;
          return sum + activeMetrics.reduce((s, m) => NON_ADDITIVE_METRICS.has(m) ? s : s + (cell[m] as number), 0);
        }, 0);
        if (rowTotal !== 0) maxTotalChars = Math.max(maxTotalChars, formatMoney(rowTotal).length);
      }
      map.set('total', Math.max(map.get('total') ?? 0, Math.max(50, Math.ceil(maxTotalChars * PX_PER_CHAR + CELL_PAD))));
    }
    return map;
  }, [report, projectFcFilters, globalFcMap, activeMetrics]);

  // ── XLSX export ──

  const handleExport = () => {
    if (!report?.projects?.length) return;
    const wb = XLSX.utils.book_new();
    for (const proj of report.projects) {
      const fcFilter = projectFcFilters[proj.projectUuid] ?? 'all';
      const { jobList, fcList, cellMap } = buildPivot(proj, fcFilter);
      const sheetName = `${proj.projectIndex}`.replace(/[\\/:*?[\]]/g, '_').slice(0, 31);
      const headerRow = ['Job', ...fcList.flatMap((fc) => activeMetrics.map((m) => `${fc.code} / ${METRIC_LABELS[m]}`)), 'Total'];
      const dataRows = jobList.map((job) => {
        let rowTotal = 0;
        const cols = fcList.flatMap((fc) => activeMetrics.map((m) => {
          const cell = cellMap.get(`${job.key}:${fc.uuid}`);
          const v = cell ? getCellValue(cell, m) : 0;
          if (!NON_ADDITIVE_METRICS.has(m)) rowTotal += v;
          return v;
        }));
        return [job.label, ...cols, rowTotal];
      });
      const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
    XLSX.writeFile(wb, `projects-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const metricOptions = useMemo(() => ALL_METRICS.map((m) => ({ value: m, label: METRIC_LABELS[m] })), []);

  return (
    <div className="p-4 space-y-4">
      {/* Fixed FC tooltip — renders above all overflow-hidden/overflow-x-auto containers */}
      {fcTooltip && (
        <div
          className="fixed z-[9999] px-2 py-1 bg-gray-800 text-white text-[11px] rounded shadow-lg whitespace-normal max-w-[240px] text-center leading-snug pointer-events-none"
          style={{ left: fcTooltip.x, top: fcTooltip.y - 8, transform: 'translate(-50%, -100%)' }}
        >
          {fcTooltip.text}
        </div>
      )}
      {/* ── Toolbar ── */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 -mx-4 px-4 py-2 flex flex-wrap items-start gap-3">

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
              {/* Search + actions row */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                  <Input
                    placeholder="Search projects…"
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    className="h-7 text-xs pl-7"
                    autoFocus
                  />
                </div>
                <button
                  className="text-xs text-blue-600 hover:text-blue-800 shrink-0 whitespace-nowrap"
                  onClick={() => {
                    const filteredUuids = filteredProjects.map((p) => p.project_uuid);
                    const allChecked = filteredUuids.every((uuid) => selectedProjectUuids.has(uuid));
                    setSelectedProjectUuids((prev) => {
                      const next = new Set(prev);
                      if (allChecked) {
                        filteredUuids.forEach((uuid) => next.delete(uuid));
                      } else {
                        filteredUuids.forEach((uuid) => next.add(uuid));
                      }
                      return next;
                    });
                  }}
                >
                  {filteredProjects.every((p) => selectedProjectUuids.has(p.project_uuid)) && filteredProjects.length > 0
                    ? 'Deselect filtered'
                    : 'Select all filtered'}
                </button>
                <button className="text-xs text-gray-400 hover:text-gray-700 shrink-0" onClick={() => setSelectedProjectUuids(new Set())}>Clear all</button>
              </div>
              {/* Project list */}
              <div className="max-h-72 overflow-y-auto space-y-0.5">
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
                        {checked && <span className="ml-1 text-blue-500">✓</span>}
                      </span>
                    </label>
                  );
                })}
                {filteredProjects.length === 0 && <p className="text-xs text-gray-400 px-2 py-2">No projects found</p>}
              </div>
              {/* Footer */}
              <div className="flex items-center justify-between pt-1 border-t">
                <span className="text-[11px] text-gray-400">
                  {selectedProjectUuids.size > 0 ? `${selectedProjectUuids.size} selected` : 'None selected'}
                </span>
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

        <Button variant="outline" size="sm" onClick={() => fetchReport({ silent: true })} disabled={loading || selectedProjectUuids.size === 0} className="flex items-center gap-1">
          <RefreshCw className={`h-3.5 w-3.5 ${loading || refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>

        <Button variant="outline" size="sm" onClick={handleExport} disabled={!report?.projects?.length} className="flex items-center gap-1">
          <Download className="h-3.5 w-3.5" />
          Export XLSX
        </Button>

        {/* Settings */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
            onClick={() => setSettingsOpen((o) => !o)}
            title="Settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
          {settingsOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
              <div className="absolute right-0 top-8 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[210px]">
                <p className="text-xs font-semibold text-gray-600 mb-2">Display</p>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div
                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${fcFullMode ? 'bg-blue-600' : 'bg-gray-200'}`}
                    onClick={() => setFcFullMode((v) => !v)}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transition-transform ${fcFullMode ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                  <span className="text-xs text-gray-700">Show full FC description</span>
                </label>
                <div className="mt-3 pt-2 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Default currency for new projects</p>
                  <div className="flex gap-1">
                    {(['GEL', 'USD', 'EUR'] as const).map((c) => (
                      <button
                        key={c}
                        onClick={() => setDefaultCurrency(c)}
                        className={`px-2.5 py-1 text-xs rounded border transition-colors ${defaultCurrency === c ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Add Ledger */}
        <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button variant="default" size="sm" className="flex items-center gap-1">
              <Plus className="h-3.5 w-3.5" />
              Add Ledger
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[80%] max-w-3xl">
            <DialogHeader>
              <DialogTitle>{addLedgerStep === 'payment' ? 'Add Payment' : 'Add Ledger Entry'}</DialogTitle>
              <DialogDescription>
                {addLedgerStep === 'payment'
                  ? 'Create a payment first, or skip to add a ledger entry to an existing payment.'
                  : 'Add a new entry to the payments ledger.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {addLedgerStep === 'payment' ? (
                <>
                  {cellPrefill ? (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                      Pre-filled from grid cell — select a <strong>Counteragent</strong> and <strong>Currency</strong> to create the payment.
                    </div>
                  ) : (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                      Create a payment first, or skip to add a ledger entry to an existing payment.
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Counteragent <span className="text-red-500">*</span></Label>
                    <Combobox
                      value={dlgSelectedCounteragentUuid}
                      onValueChange={setDlgSelectedCounteragentUuid}
                      options={dlgCounterAgents.map(ca => ({ value: ca.counteragent_uuid || ca.counteragentUuid || '', label: ca.counteragent || ca.name || '' })).filter(o => o.value && o.label)}
                      placeholder="Select counteragent..."
                      searchPlaceholder="Search counteragents..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={!cellPrefill && !dlgSelectedCounteragentUuid ? 'text-muted-foreground' : ''}>Financial Code <span className="text-red-500">*</span></Label>
                    {cellPrefill ? (
                      <div className="flex h-9 w-full rounded-md border border-gray-200 bg-gray-100 px-3 py-1 text-sm items-center text-gray-500 cursor-not-allowed">
                        {cellPrefill.financialCodeLabel}
                      </div>
                    ) : (
                      <Combobox
                        value={dlgSelectedFinancialCodeUuid}
                        onValueChange={setDlgSelectedFinancialCodeUuid}
                        options={dlgFinancialCodes.map(fc => ({ value: fc.uuid, label: fc.validation }))}
                        placeholder="Select financial code..."
                        searchPlaceholder="Search financial codes..."
                        disabled={!dlgSelectedCounteragentUuid}
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className={!dlgSelectedFinancialCodeUuid ? 'text-muted-foreground' : ''}>Currency <span className="text-red-500">*</span></Label>
                    <Combobox
                      value={dlgSelectedCurrencyUuid}
                      onValueChange={setDlgSelectedCurrencyUuid}
                      options={dlgCurrencies.map(c => ({ value: c.uuid, label: c.code }))}
                      placeholder="Select currency..."
                      searchPlaceholder="Search currencies..."
                      disabled={!dlgSelectedFinancialCodeUuid}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={dlgSelectedIncomeTax} onCheckedChange={(v) => setDlgSelectedIncomeTax(v as boolean)} />
                    <Label>Income Tax</Label>
                  </div>
                  <div className="space-y-2">
                    <Label className={!cellPrefill && !dlgSelectedCurrencyUuid ? 'text-muted-foreground' : ''}>Project (Optional)</Label>
                    {cellPrefill ? (
                      <div className="flex h-9 w-full rounded-md border border-gray-200 bg-gray-100 px-3 py-1 text-sm items-center text-gray-500 cursor-not-allowed">
                        {cellPrefill.projectLabel}
                      </div>
                    ) : (
                      <Combobox
                        value={dlgSelectedProjectUuid}
                        onValueChange={setDlgSelectedProjectUuid}
                        options={allProjects.map(p => ({ value: p.project_uuid, label: `${p.project_index} – ${p.project_name}` }))}
                        placeholder="Select project..."
                        searchPlaceholder="Search projects..."
                        disabled={!dlgSelectedCurrencyUuid}
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className={!cellPrefill && !dlgSelectedProjectUuid ? 'text-muted-foreground' : ''}>Job (Optional)</Label>
                    {cellPrefill ? (
                      <div className="flex h-9 w-full rounded-md border border-gray-200 bg-gray-100 px-3 py-1 text-sm items-center text-gray-500 cursor-not-allowed">
                        {cellPrefill.jobLabel ?? '—'}
                      </div>
                    ) : (
                      <Combobox
                        value={dlgSelectedJobUuid}
                        onValueChange={setDlgSelectedJobUuid}
                        options={dlgJobs.map(j => ({ value: j.jobUuid, label: j.jobDisplay || j.jobName }))}
                        placeholder="Select job..."
                        searchPlaceholder="Search jobs..."
                        disabled={!dlgSelectedProjectUuid}
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Label (Optional)</Label>
                    <Input value={dlgSelectedLabel} onChange={(e) => setDlgSelectedLabel(e.target.value)} placeholder="Payment label" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button onClick={handleCreatePayment} className="flex-1" disabled={isCreatingPayment || !dlgSelectedCounteragentUuid || !dlgSelectedFinancialCodeUuid || !dlgSelectedCurrencyUuid}>
                      {isCreatingPayment ? 'Creating...' : 'Create Payment & Continue'}
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={handleSkipToLedger}>Skip – Use Existing Payment</Button>
                  </div>
                </>
              ) : (
                <>
                  {preSelectedPaymentId && selectedPaymentDetails ? (
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Payment Details</h3>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-600">Payment ID</Label>
                          <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center font-bold">{selectedPaymentDetails.paymentId}</div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-600">Currency</Label>
                          <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center font-bold">{selectedPaymentDetails.currency}</div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-600">Income Tax</Label>
                          <div className="flex items-center h-9 px-3 border-2 border-gray-300 rounded-md bg-gray-100">
                            <Checkbox checked={selectedPaymentDetails.incomeTax} disabled />
                            <span className="ml-2 text-sm font-bold">{selectedPaymentDetails.incomeTax ? 'Yes' : 'No'}</span>
                          </div>
                        </div>
                      </div>
                      {[['Counteragent', selectedPaymentDetails.counteragent], ['Project', selectedPaymentDetails.project], ['Job', selectedPaymentDetails.job], ['Financial Code', selectedPaymentDetails.financialCode]].map(([lbl, val]) => (
                        <div key={lbl} className="space-y-1">
                          <Label className="text-xs text-gray-600">{lbl}</Label>
                          <div className="flex h-9 w-full rounded-md border-2 border-gray-300 bg-gray-100 px-3 py-1 text-sm items-center font-bold">{val}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Payment</Label>
                      {dlgSkipCounteragentFilter && (
                        <div className="flex items-center gap-2 rounded-md bg-blue-50 border border-blue-200 px-3 py-1.5 text-sm text-blue-800">
                          <span className="flex-1">Showing payments for: <strong>{dlgSkipCounteragentFilter.name}</strong></span>
                          <button type="button" className="text-blue-500 hover:text-blue-700 font-bold" onClick={() => setDlgSkipCounteragentFilter(null)}>×</button>
                        </div>
                      )}
                      <Combobox
                        value={selectedPaymentId}
                        onValueChange={(value) => {
                          setSelectedPaymentId(value);
                          const p = dlgPayments.find(x => x.paymentId === value);
                          if (p) setSelectedPaymentDetails({ paymentId: p.paymentId, counteragent: p.counteragentName || 'N/A', project: p.projectIndex || 'N/A', job: p.jobName || 'N/A', financialCode: p.financialCode || 'N/A', incomeTax: p.incomeTax || false, currency: p.currencyCode || 'N/A' });
                        }}
                        filter={(value, search) => { try { return new RegExp(search, 'i').test(value) ? 1 : 0; } catch { return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0; } }}
                        options={dlgPayments.filter(p => !dlgSkipCounteragentFilter || p.counteragentUuid === dlgSkipCounteragentFilter.uuid).map(p => { const parts = [p.paymentId, p.counteragentName, p.projectName, p.jobName, p.financialCode, p.currencyCode].filter(Boolean); return { value: p.paymentId, label: parts.join(' | ') }; })}
                        placeholder="Select payment..."
                        searchPlaceholder="Search by payment ID, project, job..."
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Effective Date</Label>
                    <div className="relative flex gap-2">
                      <Input
                        type="text"
                        value={effectiveDate}
                        onChange={(e) => {
                          let v = e.target.value.replace(/[^\d.]/g, '');
                          if (v.length === 2 && !v.includes('.')) v += '.';
                          else if (v.length === 5 && v.split('.').length === 2) v += '.';
                          if (v.length <= 10) setEffectiveDate(v);
                        }}
                        placeholder="dd.mm.yyyy"
                        maxLength={10}
                        className="border-2 border-gray-400 flex-1"
                      />
                      <input
                        type="date"
                        onChange={(e) => { if (e.target.value) { const [y, m, d] = e.target.value.split('-'); setEffectiveDate(`${d}.${m}.${y}`); } }}
                        className="border-2 border-gray-400 rounded-md px-3 cursor-pointer w-12 flex-shrink-0"
                        title="Pick date from calendar"
                      />
                    </div>
                    <p className="text-xs text-gray-500">Optional. Defaults to today if not set. Format: dd.mm.yyyy</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Amount <span className="text-red-500">*</span></Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-600 mb-1 block">Accrual</Label>
                        <Input type="number" step="0.01" value={accrual} onChange={(e) => setAccrual(e.target.value)} placeholder="0.00" className="border-[3px] border-gray-400 focus-visible:border-blue-500" />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-600 mb-1 block">Order</Label>
                        <Input type="number" step="0.01" value={ledgerOrder} onChange={(e) => setLedgerOrder(e.target.value)} placeholder="0.00" className="border-[3px] border-gray-400 focus-visible:border-blue-500" />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">Enter at least one amount (Accrual or Order).</p>
                  </div>
                  <Button onClick={handleAddLedgerEntry} className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create Entry'}
                  </Button>
                  <div className="space-y-2">
                    <Label>Comment</Label>
                    <textarea
                      value={ledgerComment}
                      onChange={(e) => setLedgerComment(e.target.value)}
                      placeholder="Optional notes or description"
                      className="flex min-h-[120px] w-full rounded-md border-[3px] border-gray-400 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-blue-500"
                      rows={4}
                    />
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{error}</div>}

      {!loading && selectedProjectUuids.size === 0 && (
        <div className="text-sm text-gray-400 py-12 text-center">Select one or more projects to generate the report.</div>
      )}

      {loading && !report?.projects?.length && <div className="text-sm text-gray-500 py-8 text-center">Loading…</div>}

      {/* ── Project grids ── */}
      {(!loading || report?.projects?.length) && (() => {
        const orderedProjects = projectOrder
          .map((uuid) => report?.projects?.find((p) => p.projectUuid === uuid))
          .filter(Boolean) as ProjectData[];
        // append any that aren’t in order yet
        const unordered = (report?.projects ?? []).filter((p) => !projectOrder.includes(p.projectUuid));
        return [...orderedProjects, ...unordered];
      })().map((proj) => {
        const isProjectLoading = projectLoadingUuids.has(proj.projectUuid);
        const fcFilter = projectFcFilters[proj.projectUuid] ?? 'all';
        const { jobList, fcList, cellMap } = buildPivot(proj, fcFilter);
        const isCollapsed = collapsedProjects.has(proj.projectUuid);
        const jobColKey = 'job';
        const floorsColKey = 'floors';
        const totalColKey = 'total';
        const autoJobColW = autoColWidthsMap.get('job') ?? 50;
        const autoFloorsColW = autoColWidthsMap.get('floors') ?? 44;
        const autoTotalColW = autoColWidthsMap.get('total') ?? 50;
        const jobColW = getColWidth(jobColKey, autoJobColW);
        const floorsColW = getColWidth(floorsColKey, autoFloorsColW);
        const totalColW = getColWidth(totalColKey, autoTotalColW);

        return (
          <div
            key={proj.projectUuid}
            className="border border-gray-200 rounded-lg overflow-hidden transition-opacity"
            style={{ opacity: isProjectLoading || loading ? 0.6 : 1 }}
            draggable
            onDragStart={() => { dragUuid.current = proj.projectUuid; }}
            onDragOver={(e) => { e.preventDefault(); dragOverUuid.current = proj.projectUuid; }}
            onDrop={() => {
              const from = dragUuid.current;
              const to = dragOverUuid.current;
              if (!from || !to || from === to) { dragUuid.current = null; dragOverUuid.current = null; return; }
              setProjectOrder((prev) => {
                const list = prev.length ? prev : (report?.projects ?? []).map((p) => p.projectUuid);
                const a = list.indexOf(from);
                const b = list.indexOf(to);
                if (a === -1 || b === -1) return list;
                const next = [...list];
                next.splice(a, 1);
                next.splice(b, 0, from);
                return next;
              });
              dragUuid.current = null;
              dragOverUuid.current = null;
            }}
          >
            {/* Section header */}
            <div
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200 cursor-pointer select-none"
              onClick={() => toggleCollapse(proj.projectUuid)}
            >
              {/* Drag handle */}
              <span
                className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing mr-1 shrink-0"
                title="Drag to reorder"
                onClick={(e) => e.stopPropagation()}
              >☰</span>
              {isCollapsed ? <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />}
              <span className="font-mono font-semibold text-sm text-gray-800">{proj.projectIndex}</span>
              <span className="font-medium text-sm text-gray-700">{proj.projectName}</span>
              {proj.projectAddress && <span className="text-xs text-gray-500">· {proj.projectAddress}</span>}
              <a
                href={`/dictionaries/payments-report?projectUuid=${encodeURIComponent(proj.projectUuid)}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Open payments report filtered by this project"
                className="ml-1 text-gray-300 hover:text-blue-500 transition-colors shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <Filter className="h-3.5 w-3.5" />
              </a>

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

              {/* Per-project currency */}
              <div className="flex items-center gap-0.5 ml-1" onClick={(e) => e.stopPropagation()}>
                {(['GEL', 'USD', 'EUR'] as const).map((c) => {
                  const active = (projectCurrencies[proj.projectUuid] ?? 'GEL') === c;
                  return (
                    <button
                      key={c}
                      onClick={() => {
                        setProjectCurrencies((prev) => ({ ...prev, [proj.projectUuid]: c }));
                        fetchOneProject(proj.projectUuid, c);
                      }}
                      className={`px-1.5 py-0 h-6 text-[11px] rounded border transition-colors ${
                        active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>

              <span className="ml-auto flex items-center gap-3 text-xs text-gray-500">
                {proj.status && <span className="bg-gray-100 px-2 py-0.5 rounded">{proj.status}</span>}
                {proj.serviceState && proj.serviceState !== '-' && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{proj.serviceState}</span>}
                {proj.insiderName && proj.insiderName !== '-' && <span>Insider: {proj.insiderName}</span>}
                {proj.department && proj.department !== '-' && <span>Dept: {proj.department}</span>}
                <span className="text-gray-400">{fcList.length} FCs · {jobList.filter(j => j.key !== NULL_JOB_KEY).length} / {proj.totalJobsInProject} jobs paid</span>
                <button
                  type="button"
                  className="flex items-center gap-1 px-2 py-0.5 h-6 text-[11px] rounded border border-gray-200 bg-white text-gray-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors"
                  title="Add a new job to this project"
                  onClick={(e) => { e.stopPropagation(); handleOpenAddJob(proj.projectUuid, `${proj.projectIndex} – ${proj.projectName}`); }}
                >
                  <Plus className="h-3 w-3" />
                  Add Job
                </button>
              </span>
            </div>

            {!isCollapsed && (
              <div className="overflow-x-auto">
                {jobList.length === 0 ? (
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
                          <div className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-blue-300 opacity-0 hover:opacity-60" onMouseDown={(e) => startResize(e, jobColKey, autoJobColW)} />
                        </th>
                        {/* Floors column – spans both header rows */}
                        <th
                          className="bg-gray-100 border-r border-gray-200 relative overflow-hidden"
                          style={{ width: floorsColW, minWidth: floorsColW }}
                          rowSpan={2}
                        >
                          <div className="px-2 py-2 text-center font-semibold text-gray-700 text-xs">Floors</div>
                          <div className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-blue-300 opacity-0 hover:opacity-60" onMouseDown={(e) => startResize(e, floorsColKey, autoFloorsColW)} />
                        </th>
                        {fcList.map((fc) => (
                          <th
                            key={fc.uuid}
                            colSpan={activeMetrics.length}
                            style={{ minWidth: activeMetrics.reduce((s, m) => s + getColWidth(`${fc.uuid}:${m}`, autoColWidthsMap.get(`${fc.uuid}:${m}`) ?? 38), 0) }}
                            className="px-2 py-1.5 text-center font-semibold text-gray-700 border-r border-gray-200 text-xs bg-gray-100 overflow-visible"
                            onMouseEnter={!fcFullMode && fc.validation && fc.validation !== fc.code ? (e) => setFcTooltip({ text: fc.validation, x: e.clientX, y: e.clientY }) : undefined}
                            onMouseMove={!fcFullMode && fc.validation && fc.validation !== fc.code ? (e) => setFcTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : t) : undefined}
                            onMouseLeave={!fcFullMode && fc.validation && fc.validation !== fc.code ? () => setFcTooltip(null) : undefined}
                          >
                            <div className="inline-flex items-center justify-center gap-1 w-full group/fchdr">
                              <span className="truncate cursor-default">
                                {fcFullMode && fc.validation ? fc.validation : fc.code}
                              </span>
                              <a
                                href={`/dictionaries/payments-report?projectUuid=${encodeURIComponent(proj.projectUuid)}&financialCodeUuid=${encodeURIComponent(fc.uuid)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open payments report filtered by this project & FC"
                                className="opacity-0 group-hover/fchdr:opacity-100 text-gray-300 hover:text-blue-500 transition-opacity shrink-0"
                              >
                                <Filter className="h-3 w-3" />
                              </a>
                            </div>
                          </th>
                        ))}
                        <th
                          className="bg-gray-100 border-l border-gray-200 relative overflow-hidden"
                          style={{ width: totalColW, minWidth: totalColW }}
                          rowSpan={2}
                        >
                          <div className="px-3 py-2 text-right font-semibold text-gray-700 text-xs">Total</div>
                          <div className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-blue-300 opacity-0 hover:opacity-60" onMouseDown={(e) => startResize(e, totalColKey, autoTotalColW)} />
                        </th>
                      </tr>
                      {/* Row 2: metric sub-headers */}
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {fcList.flatMap((fc) =>
                          activeMetrics.map((m, mi) => {
                            const colKey = `${fc.uuid}:${m}`;
                            const autoW = autoColWidthsMap.get(colKey) ?? 38;
                            const colW = getColWidth(colKey, autoW);
                            const isLast = mi === activeMetrics.length - 1;
                            return (
                              <th
                                key={`${fc.uuid}:${m}`}
                                title={METRIC_LABELS[m]}
                                className={`relative overflow-hidden px-2 py-1 text-center text-[10px] font-medium text-gray-500 ${isLast ? 'border-r border-gray-200' : 'border-r border-gray-100'}`}
                                style={{ width: colW, minWidth: colW }}
                              >
                                <span className="truncate block">{METRIC_LABELS[m]}</span>
                                <div className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-blue-300 opacity-0 hover:opacity-60" onMouseDown={(e) => startResize(e, colKey, autoW)} />
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
                          return sum + activeMetrics.reduce((s, m) => NON_ADDITIVE_METRICS.has(m) ? s : s + getCellValue(cell, m), 0);
                        }, 0);

                        return (
                          <tr key={job.key} className={`border-b border-gray-100 ${rowBg} group/row`}>
                            <td
                              className={`sticky left-0 z-10 px-3 py-2 border-r border-gray-200 font-medium whitespace-nowrap overflow-hidden text-ellipsis ${stickyBg} ${isNoJob ? 'italic text-gray-400' : 'text-gray-800'}`}
                              style={{ width: jobColW, maxWidth: jobColW }}
                            >
                              {job.label}
                            </td>
                            {/* Floors */}
                            <td
                              className={`px-2 py-2 text-center tabular-nums border-r border-gray-200 ${stickyBg}`}
                              style={{ width: floorsColW, maxWidth: floorsColW }}
                            >
                              {job.floors > 0 ? <span className="text-gray-600">{job.floors}</span> : <span className="text-gray-200">—</span>}
                            </td>
                            {fcList.flatMap((fc) =>
                              activeMetrics.map((m, mi) => {
                                const colKey = `${fc.uuid}:${m}`;
                                const colW = getColWidth(colKey, autoColWidthsMap.get(colKey) ?? 38);
                                const isLast = mi === activeMetrics.length - 1;
                                const cell = cellMap.get(`${job.key}:${fc.uuid}`);
                                const value = cell ? getCellValue(cell, m) : 0;
                                return (
                                  <td
                                    key={`${fc.uuid}:${m}`}
                                    className={`relative px-3 py-2 text-right tabular-nums overflow-hidden ${isLast ? 'border-r border-gray-200' : 'border-r border-gray-100'}`}
                                    style={{ width: colW, maxWidth: colW }}
                                    title={cell?.paymentIds?.join(', ') || undefined}
                                  >
                                    {mi === 0 && (
                                      <button
                                        type="button"
                                        className="absolute left-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 hover:bg-blue-100 text-blue-400 hover:text-blue-600 rounded-sm w-4 h-4 flex items-center justify-center text-[11px] leading-none transition-opacity z-10"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCellAddLedger({
                                            projectUuid: proj.projectUuid,
                                            projectLabel: `${proj.projectIndex} – ${proj.projectName}`,
                                            financialCodeUuid: fc.uuid,
                                            financialCodeLabel: fc.validation || fc.code,
                                            jobUuid: isNoJob ? null : job.key,
                                            jobLabel: isNoJob ? null : job.label,
                                          });
                                        }}
                                        title="Add ledger entry for this project / FC / job"
                                      >
                                        +
                                      </button>
                                    )}
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
                        {/* Floors totals cell – show sum of all job floors */}
                        <td className="px-2 py-2 text-center tabular-nums bg-gray-100 border-r border-gray-200 text-gray-700" style={{ width: floorsColW, maxWidth: floorsColW }}>
                          {(() => { const total = jobList.reduce((s, j) => s + j.floors, 0); return total > 0 ? total : <span className="text-gray-300">—</span>; })()}
                        </td>
                        {fcList.flatMap((fc) =>
                          activeMetrics.map((m, mi) => {
                            const colKey = `${fc.uuid}:${m}`;
                            const colW = getColWidth(colKey, autoColWidthsMap.get(colKey) ?? 38);
                            const isLast = mi === activeMetrics.length - 1;
                            const colTotal = NON_ADDITIVE_METRICS.has(m) ? 0 : jobList.reduce((sum, job) => {
                              const cell = cellMap.get(`${job.key}:${fc.uuid}`);
                              return sum + (cell ? getCellValue(cell, m) : 0);
                            }, 0);
                            return (
                              <td
                                key={`${fc.uuid}:${m}`}
                                className={`px-3 py-2 text-right tabular-nums ${isLast ? 'border-r border-gray-200' : 'border-r border-gray-100'}`}
                                style={{ width: colW, maxWidth: colW }}
                              >
                                {NON_ADDITIVE_METRICS.has(m)
                                  ? <span className="text-gray-300">—</span>
                                  : <span className={colTotal !== 0 ? 'text-gray-800' : 'text-gray-400'}>{formatCell(colTotal, m)}</span>
                                }
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
                                if (NON_ADDITIVE_METRICS.has(m)) return s3;
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

      {/* ── Add Job Dialog ── */}
      <Dialog open={addJobOpen} onOpenChange={(open) => { if (!open) { setAddJobOpen(false); resetAddJobForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Job</DialogTitle>
            <DialogDescription>
              Add a new job to <span className="font-medium">{addJobProjectLabel}</span>
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => { e.preventDefault(); handleAddJob(); }}
          >
            {/* Insider */}
            <div>
              <Label>Insider *</Label>
              {selectedInsiderUuids.length === 1 ? (
                <div className="mt-1 px-3 py-2 bg-gray-100 border border-gray-200 rounded text-sm text-gray-500 cursor-not-allowed">
                  {insidersList.find(i => i.value === selectedInsiderUuids[0])?.label || selectedInsiderUuids[0]}
                  <span className="ml-2 text-xs text-gray-400">(fixed)</span>
                </div>
              ) : (
                <Combobox
                  options={insidersList}
                  value={addJobInsiderUuid}
                  onValueChange={setAddJobInsiderUuid}
                  placeholder="Select insider…"
                  searchPlaceholder="Search insiders…"
                  emptyText="No insider found."
                />
              )}
            </div>
            {/* Job Name */}
            <div>
              <Label htmlFor="ajJobName">Job Name *</Label>
              <Input
                id="ajJobName"
                value={addJobName}
                onChange={(e) => setAddJobName(e.target.value)}
                placeholder="Enter job name"
                autoFocus
              />
            </div>
            {/* Factory No */}
            <div>
              <Label htmlFor="ajFactoryNo">Factory No</Label>
              <Input
                id="ajFactoryNo"
                value={addJobFactoryNo}
                onChange={(e) => setAddJobFactoryNo(e.target.value)}
                placeholder="Optional"
              />
            </div>
            {/* Floors & Weight */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ajFloors">Floors</Label>
                <Input
                  id="ajFloors"
                  type="number"
                  value={addJobFloors}
                  onChange={(e) => setAddJobFloors(e.target.value)}
                  placeholder="e.g. 10"
                />
              </div>
              <div>
                <Label htmlFor="ajWeight">Weight (kg)</Label>
                <Input
                  id="ajWeight"
                  type="number"
                  value={addJobWeight}
                  onChange={(e) => setAddJobWeight(e.target.value)}
                  placeholder="e.g. 1200"
                />
              </div>
            </div>
            {/* Brand */}
            <div>
              <Label htmlFor="ajBrand">Brand</Label>
              <select
                id="ajBrand"
                value={addJobBrandUuid}
                onChange={(e) => setAddJobBrandUuid(e.target.value)}
                className="w-full h-9 border border-gray-200 rounded px-2 text-sm bg-white text-gray-700 mt-1"
              >
                <option value="">— Select brand —</option>
                {addJobBrands.map(b => (
                  <option key={b.uuid} value={b.uuid}>{b.name}</option>
                ))}
              </select>
            </div>
            {/* FF */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="ajIsFf"
                checked={addJobIsFf}
                onCheckedChange={(v) => setAddJobIsFf(Boolean(v))}
              />
              <Label htmlFor="ajIsFf" className="cursor-pointer">FF (firefighter)</Label>
            </div>
            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => { setAddJobOpen(false); resetAddJobForm(); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={isAddJobSubmitting}>
                <Plus className="h-4 w-4 mr-1" />
                {isAddJobSubmitting ? 'Saving…' : 'Add Job'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
