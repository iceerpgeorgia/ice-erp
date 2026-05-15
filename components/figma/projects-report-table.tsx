'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookmarkPlus, Check, ChevronDown, ChevronRight, Download, Filter, LayoutGrid, Pencil, Plus, RefreshCw, Search, Settings, X } from 'lucide-react';
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
  accrualTax: number;
  latestAccrualTax: number;
  orderTax: number;
  lastMonthAccrualTax: number;
  lastMonthOrderTax: number;
  paymentTax: number;
  pensionOnTax: boolean;
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
  allJobs: { jobUuid: string; jobName: string; floors: number }[];
  waybillSum: number;
  projectFcUuid: string | null;
  waybillPairedFcCode: string | null;
  waybillPairedFcUuid: string | null;
  waybillPairedFcValidation: string | null;
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
const STORAGE_KEY_FC_DISPLAY = 'projectsReportFcDisplay';

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
  const [fcDisplayMode, setFcDisplayMode] = useState<'global' | 'perProject'>('global');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showTaxMultiplier, setShowTaxMultiplier] = useState(false);
  const [defaultCurrency, setDefaultCurrency] = useState<'GEL' | 'USD' | 'EUR'>('GEL');
  const [fcTooltip, setFcTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [projectCurrencies, setProjectCurrencies] = useState<Record<string, 'USD' | 'GEL' | 'EUR'>>({});
  const [projectOrder, setProjectOrder] = useState<string[]>([]);
  const [projectLoadingUuids, setProjectLoadingUuids] = useState<Set<string>>(new Set());
  // Ref so fetchReport/fetchOneProject always see latest currencies without re-creating callbacks
  const projectCurrenciesRef = useRef<Record<string, 'USD' | 'GEL' | 'EUR'>>({});
  useEffect(() => { projectCurrenciesRef.current = projectCurrencies; }, [projectCurrencies]);
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('projectsReportTaxMult') === 'true') {
      setShowTaxMultiplier(true);
    }
  }, []);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('projectsReportTaxMult', String(showTaxMultiplier));
    }
  }, [showTaxMultiplier]);
  // Drag state (no React state — we don’t need re-renders mid-drag)
  const dragUuid = useRef<string | null>(null);
  const dragOverUuid = useRef<string | null>(null);

  // ── Views state ──
  const [views, setViews] = useState<Array<{ uuid: string; name: string; config: Record<string, unknown>; isDefault: boolean }>>([]);
  const [activeViewUuid, setActiveViewUuid] = useState<string | null>(null);
  const [viewsReady, setViewsReady] = useState(false);
  const isLoadingViewRef = useRef(false);
  const [renamingViewUuid, setRenamingViewUuid] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [newViewName, setNewViewName] = useState('');
  const [newViewOpen, setNewViewOpen] = useState(false);
  const [viewsDropdownOpen, setViewsDropdownOpen] = useState(false);
  // Persist last selected view UUID to localStorage
  useEffect(() => {
    if (activeViewUuid && typeof window !== 'undefined') {
      localStorage.setItem('projectsReportActiveView', activeViewUuid);
    }
  }, [activeViewUuid]);
  const saveViewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    projectUuid?: string | null; projectIndex?: string | null; projectName?: string | null; jobName?: string | null;
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

  // ── FC Bulk Ledger dialog state ──
  const [fcBulkOpen, setFcBulkOpen] = useState(false);
  const [fcBulkProjectUuid, setFcBulkProjectUuid] = useState('');
  const [fcBulkProjectLabel, setFcBulkProjectLabel] = useState('');
  const [fcBulkFcUuid, setFcBulkFcUuid] = useState('');
  const [fcBulkFcLabel, setFcBulkFcLabel] = useState('');
  const [fcBulkCounteragentUuid, setFcBulkCounteragentUuid] = useState('');
  const [fcBulkCurrencyUuid, setFcBulkCurrencyUuid] = useState('');
  const [fcBulkIncomeTax, setFcBulkIncomeTax] = useState(false);
  const [fcBulkLabel, setFcBulkLabel] = useState('');
  const [fcBulkJobs, setFcBulkJobs] = useState<Array<{
    jobUuid: string | null; jobLabel: string;
    accrual: string; order: string; date: string;
  }>>([]);
  const [isFcBulkSubmitting, setIsFcBulkSubmitting] = useState(false);

  // ── Project Bulk Ledger dialog state ──
  const [projBulkOpen, setProjBulkOpen] = useState(false);
  const [projBulkProjectUuid, setProjBulkProjectUuid] = useState('');
  const [projBulkProjectLabel, setProjBulkProjectLabel] = useState('');
  const [projBulkCounteragentUuid, setProjBulkCounteragentUuid] = useState('');
  const [projBulkCurrencyUuid, setProjBulkCurrencyUuid] = useState('');
  const [projBulkIncomeTax, setProjBulkIncomeTax] = useState(false);
  const [projBulkLabel, setProjBulkLabel] = useState('');
  const [projBulkFcUuid, setProjBulkFcUuid] = useState('');
  const [projBulkRows, setProjBulkRows] = useState<Array<{
    jobUuid: string | null; jobLabel: string;
    accrual: string; order: string; date: string;
  }>>([]);
  const [isProjBulkSubmitting, setIsProjBulkSubmitting] = useState(false);
  const [fcBulkSums, setFcBulkSums] = useState<Map<string, { accrual: number; order: number }>>(new Map());
  const [projBulkSums, setProjBulkSums] = useState<Map<string, { accrual: number; order: number }>>(new Map());
  const [bulkDragCopy, setBulkDragCopy] = useState<{
    table: 'fc' | 'proj'; col: 'accrual' | 'order'; srcRow: number; dstRow: number; value: string;
  } | null>(null);

  // ── Ledger sums for bulk dialogs ──
  useEffect(() => {
    if (!fcBulkOpen || !fcBulkCounteragentUuid || !fcBulkCurrencyUuid || !fcBulkProjectUuid || !fcBulkFcUuid) {
      setFcBulkSums(new Map());
      return;
    }
    const params = new URLSearchParams({ projectUuid: fcBulkProjectUuid, counteragentUuid: fcBulkCounteragentUuid, financialCodeUuid: fcBulkFcUuid, currencyUuid: fcBulkCurrencyUuid, incomeTax: String(fcBulkIncomeTax) });
    fetch(`/api/payments-ledger/sums?${params}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Array<{ jobUuid: string | null; accrualSum: number; orderSum: number }>) => {
        const m = new Map<string, { accrual: number; order: number }>();
        for (const row of data) m.set(row.jobUuid ?? 'null', { accrual: row.accrualSum, order: row.orderSum });
        setFcBulkSums(m);
      })
      .catch(() => setFcBulkSums(new Map()));
  }, [fcBulkOpen, fcBulkCounteragentUuid, fcBulkCurrencyUuid, fcBulkIncomeTax, fcBulkProjectUuid, fcBulkFcUuid]);

  useEffect(() => {
    if (!projBulkOpen || !projBulkCounteragentUuid || !projBulkCurrencyUuid || !projBulkFcUuid || !projBulkProjectUuid) {
      setProjBulkSums(new Map());
      return;
    }
    const params = new URLSearchParams({ projectUuid: projBulkProjectUuid, counteragentUuid: projBulkCounteragentUuid, financialCodeUuid: projBulkFcUuid, currencyUuid: projBulkCurrencyUuid, incomeTax: String(projBulkIncomeTax) });
    fetch(`/api/payments-ledger/sums?${params}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Array<{ jobUuid: string | null; accrualSum: number; orderSum: number }>) => {
        const m = new Map<string, { accrual: number; order: number }>();
        for (const row of data) m.set(row.jobUuid ?? 'null', { accrual: row.accrualSum, order: row.orderSum });
        setProjBulkSums(m);
      })
      .catch(() => setProjBulkSums(new Map()));
  }, [projBulkOpen, projBulkCounteragentUuid, projBulkCurrencyUuid, projBulkIncomeTax, projBulkFcUuid, projBulkProjectUuid]);

  // ── Drag-copy apply on mouse release ──
  useEffect(() => {
    const handleMouseUp = () => {
      if (!bulkDragCopy) return;
      const { table, col, srcRow, dstRow, value } = bulkDragCopy;
      const lo = Math.min(srcRow, dstRow);
      const hi = Math.max(srcRow, dstRow);
      if (table === 'fc') {
        setFcBulkJobs(prev => prev.map((r, i) => (i >= lo && i <= hi) ? { ...r, [col]: value } : r));
      } else {
        setProjBulkRows(prev => prev.map((r, i) => (i >= lo && i <= hi) ? { ...r, [col]: value } : r));
      }
      setBulkDragCopy(null);
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [bulkDragCopy]);

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
    const savedFcDisplay = localStorage.getItem(STORAGE_KEY_FC_DISPLAY);
    if (savedFcDisplay === 'perProject') setFcDisplayMode('perProject');
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
  useEffect(() => { localStorage.setItem(STORAGE_KEY_FC_DISPLAY, fcDisplayMode); }, [fcDisplayMode]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_DEFAULT_CURRENCY, defaultCurrency); }, [defaultCurrency]);

  // ── View config helpers ──
  const getViewConfig = (): Record<string, unknown> => ({
    selectedProjectUuids: Array.from(selectedProjectUuids),
    maxDate,
    selectedMetrics: Array.from(selectedMetrics),
    projectCurrencies,
    projectFcFilters,
    collapsedProjects: Array.from(collapsedProjects),
    colWidths,
    projectOrder,
    fcFullMode,
    fcDisplayMode,
    defaultCurrency,
    selectedInsiderUuids,
  });

  const applyViewConfig = (config: Record<string, unknown>) => {
    isLoadingViewRef.current = true;
    const c = config;
    if (Array.isArray(c.selectedProjectUuids)) setSelectedProjectUuids(new Set(c.selectedProjectUuids as string[]));
    if (typeof c.maxDate === 'string') setMaxDate(c.maxDate as string);
    if (Array.isArray(c.selectedMetrics) && c.selectedMetrics.length > 0)
      setSelectedMetrics(new Set((c.selectedMetrics as unknown[]).filter((m): m is MetricKey => typeof m === 'string' && m in METRIC_LABELS)));
    if (c.projectCurrencies && typeof c.projectCurrencies === 'object') setProjectCurrencies(c.projectCurrencies as Record<string, 'USD' | 'GEL' | 'EUR'>);
    if (c.projectFcFilters && typeof c.projectFcFilters === 'object') setProjectFcFilters(c.projectFcFilters as Record<string, FcFilter>);
    if (Array.isArray(c.collapsedProjects)) setCollapsedProjects(new Set(c.collapsedProjects as string[]));
    if (c.colWidths && typeof c.colWidths === 'object') setColWidths(c.colWidths as Record<string, number>);
    if (Array.isArray(c.projectOrder)) setProjectOrder(c.projectOrder as string[]);
    if (typeof c.fcFullMode === 'boolean') setFcFullMode(c.fcFullMode as boolean);
    if (c.fcDisplayMode === 'global' || c.fcDisplayMode === 'perProject') setFcDisplayMode(c.fcDisplayMode as 'global' | 'perProject');
    if (c.defaultCurrency === 'GEL' || c.defaultCurrency === 'USD' || c.defaultCurrency === 'EUR')
      setDefaultCurrency(c.defaultCurrency as 'GEL' | 'USD' | 'EUR');
    if (Array.isArray(c.selectedInsiderUuids)) setSelectedInsiderUuids(c.selectedInsiderUuids as string[]);
    setTimeout(() => { isLoadingViewRef.current = false; }, 300);
  };

  // Load views from DB on mount (after localStorage restore)
  useEffect(() => {
    let cancelled = false;
    async function loadViews() {
      try {
        const res = await fetch('/api/project-report-views');
        if (!res.ok || cancelled) return;
        const data: Array<{ uuid: string; name: string; config: Record<string, unknown>; isDefault: boolean }> = await res.json();
        if (cancelled) return;
        setViews(data);
        const savedUuid = typeof window !== 'undefined' ? localStorage.getItem('projectsReportActiveView') : null;
        const savedView = savedUuid ? data.find((v) => v.uuid === savedUuid) : null;
        const viewToLoad = savedView ?? data.find((v) => v.isDefault) ?? data[0];
        if (viewToLoad) {
          setActiveViewUuid(viewToLoad.uuid);
          applyViewConfig(viewToLoad.config);
        }
      } catch { /* ignore */ } finally {
        if (!cancelled) setViewsReady(true);
      }
    }
    loadViews();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save active view to DB (debounced 800 ms) whenever config state changes
  useEffect(() => {
    if (!viewsReady || !activeViewUuid || isLoadingViewRef.current) return;
    if (saveViewTimerRef.current) clearTimeout(saveViewTimerRef.current);
    const config = {
      selectedProjectUuids: Array.from(selectedProjectUuids),
      maxDate,
      selectedMetrics: Array.from(selectedMetrics),
      projectCurrencies,
      projectFcFilters,
      collapsedProjects: Array.from(collapsedProjects),
      colWidths,
      projectOrder,
      fcFullMode,
      fcDisplayMode,
      defaultCurrency,
      selectedInsiderUuids,
    };
    saveViewTimerRef.current = setTimeout(() => {
      fetch(`/api/project-report-views/${activeViewUuid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      }).then((r) => {
        if (r.ok) setViews((prev) => prev.map((v) => v.uuid === activeViewUuid ? { ...v, config } : v));
      }).catch(() => {});
    }, 800);
    return () => { if (saveViewTimerRef.current) clearTimeout(saveViewTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectUuids, maxDate, selectedMetrics, projectCurrencies, projectFcFilters,
      collapsedProjects, colWidths, projectOrder, fcFullMode, fcDisplayMode, defaultCurrency,
      selectedInsiderUuids, viewsReady, activeViewUuid]);

  // View management handlers
  async function handleCreateView() {
    const name = newViewName.trim() || `View ${views.length + 1}`;
    const config = getViewConfig();
    try {
      const res = await fetch('/api/project-report-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, config }),
      });
      if (!res.ok) return;
      const view: { uuid: string; name: string; config: Record<string, unknown>; isDefault: boolean } = await res.json();
      setViews((prev) => [...prev, view]);
      setActiveViewUuid(view.uuid);
      setNewViewOpen(false);
      setNewViewName('');
      // Clear projects so user picks fresh projects for this new view
      setSelectedProjectUuids(new Set());
      setReport({ projects: [] });
    } catch { /* ignore */ }
  }

  async function handleDeleteView(uuid: string) {
    if (views.length <= 1) { alert('Cannot delete the last view'); return; }
    if (!confirm('Delete this view?')) return;
    try {
      await fetch(`/api/project-report-views/${uuid}`, { method: 'DELETE' });
      setViews((prev) => prev.filter((v) => v.uuid !== uuid));
      if (activeViewUuid === uuid) {
        const remaining = views.filter((v) => v.uuid !== uuid);
        const next = remaining[0];
        if (next) { setActiveViewUuid(next.uuid); applyViewConfig(next.config); }
      }
    } catch { /* ignore */ }
  }

  async function handleRenameView(uuid: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const res = await fetch(`/api/project-report-views/${uuid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) setViews((prev) => prev.map((v) => v.uuid === uuid ? { ...v, name: trimmed } : v));
    } catch { /* ignore */ }
    setRenamingViewUuid(null);
  }

  function handleSwitchView(uuid: string) {
    if (uuid === activeViewUuid) return;
    const view = views.find((v) => v.uuid === uuid);
    if (!view) return;
    setActiveViewUuid(uuid);
    applyViewConfig(view.config);
  }

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
        projectUuid: p.projectUuid || p.project_uuid || null,
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

  const handleOpenFcBulkDialog = (ctx: {
    projectUuid: string; projectLabel: string;
    fcUuid: string; fcLabel: string;
    jobs: Array<{ key: string; jobUuid: string | null; label: string }>;
  }) => {
    setFcBulkProjectUuid(ctx.projectUuid);
    setFcBulkProjectLabel(ctx.projectLabel);
    setFcBulkFcUuid(ctx.fcUuid);
    setFcBulkFcLabel(ctx.fcLabel);
    setFcBulkCounteragentUuid('');
    setFcBulkCurrencyUuid('');
    setFcBulkIncomeTax(false);
    setFcBulkLabel('');
    setFcBulkJobs(
      ctx.jobs
        .filter(j => j.key !== NULL_JOB_KEY)
        .map(j => ({ jobUuid: j.jobUuid, jobLabel: j.label, accrual: '', order: '', date: '' }))
    );
    if (dlgCounterAgents.length === 0) fetchDlgCounterAgents();
    if (dlgCurrencies.length === 0) fetchDlgDictionaries();
    setFcBulkOpen(true);
  };

  const handleFcBulkSubmit = async () => {
    if (!fcBulkCounteragentUuid || !fcBulkCurrencyUuid) {
      alert('Please select Counteragent and Currency');
      return;
    }
    const filledJobs = fcBulkJobs.filter(j => j.accrual || j.order);
    if (filledJobs.length === 0) {
      alert('Please enter at least one Accrual or Order value');
      return;
    }
    setIsFcBulkSubmitting(true);
    try {
      for (const row of filledJobs) {
        let isoDate: string | undefined;
        if (row.date) {
          const match = row.date.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
          if (match) isoDate = `${match[3]}-${match[2]}-${match[1]}`;
        }
        const payRes = await fetch('/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            counteragentUuid: fcBulkCounteragentUuid,
            projectUuid: fcBulkProjectUuid,
            financialCodeUuid: fcBulkFcUuid,
            jobUuid: row.jobUuid || null,
            incomeTax: fcBulkIncomeTax,
            currencyUuid: fcBulkCurrencyUuid,
            label: fcBulkLabel || null,
          }),
        });
        if (!payRes.ok) { const e = await payRes.json(); throw new Error(e.error || 'Failed to create payment'); }
        const payData = await payRes.json();
        const paymentId = payData?.data?.payment_id || payData?.data?.paymentId;
        if (!paymentId) throw new Error('Payment ID not returned from server');
        const accrualVal = row.accrual ? parseFloat(row.accrual) : null;
        const orderVal = row.order ? parseFloat(row.order) : null;
        const ledgerRes = await fetch('/api/payments-ledger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId, effectiveDate: isoDate, accrual: accrualVal, order: orderVal }),
        });
        if (!ledgerRes.ok) { const e = await ledgerRes.json(); throw new Error(e.error || 'Failed to create ledger entry'); }
      }
      setFcBulkOpen(false);
      fetchReport({ silent: true });
    } catch (err: any) {
      alert(err.message || 'Failed');
    } finally {
      setIsFcBulkSubmitting(false);
    }
  };

  const handleOpenProjBulkDialog = (ctx: {
    projectUuid: string; projectLabel: string;
    jobs: Array<{ key: string; jobUuid: string | null; label: string }>;
  }) => {
    setProjBulkProjectUuid(ctx.projectUuid);
    setProjBulkProjectLabel(ctx.projectLabel);
    setProjBulkCounteragentUuid('');
    setProjBulkCurrencyUuid('');
    setProjBulkIncomeTax(false);
    setProjBulkLabel('');
    setProjBulkFcUuid('');
    setProjBulkRows(
      ctx.jobs
        .filter(j => j.key !== NULL_JOB_KEY)
        .map(j => ({ jobUuid: j.jobUuid, jobLabel: j.label, accrual: '', order: '', date: '' }))
    );
    if (dlgCounterAgents.length === 0) fetchDlgCounterAgents();
    if (dlgCurrencies.length === 0 || dlgFinancialCodes.length === 0) fetchDlgDictionaries();
    if (dlgPayments.length === 0) fetchDlgPayments();
    setProjBulkOpen(true);
  };

  const handleProjBulkSubmit = async () => {
    if (!projBulkCounteragentUuid || !projBulkCurrencyUuid || !projBulkFcUuid) {
      alert('Please select Counteragent, Currency, and Financial Code');
      return;
    }
    const filledRows = projBulkRows.filter(r => r.accrual || r.order);
    if (filledRows.length === 0) {
      alert('Please enter at least one value (Accrual or Order) for at least one job');
      return;
    }
    setIsProjBulkSubmitting(true);
    try {
      for (const row of filledRows) {
        let isoDate: string | undefined;
        if (row.date) {
          const match = row.date.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
          if (match) isoDate = `${match[3]}-${match[2]}-${match[1]}`;
        }
        const payRes = await fetch('/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            counteragentUuid: projBulkCounteragentUuid,
            projectUuid: projBulkProjectUuid,
            financialCodeUuid: projBulkFcUuid,
            jobUuid: row.jobUuid || null,
            incomeTax: projBulkIncomeTax,
            currencyUuid: projBulkCurrencyUuid,
            label: projBulkLabel || null,
          }),
        });
        if (!payRes.ok) { const e = await payRes.json(); throw new Error(e.error || 'Failed to create payment'); }
        const payData = await payRes.json();
        const paymentId = payData?.data?.payment_id || payData?.data?.paymentId;
        if (!paymentId) throw new Error('Payment ID not returned from server');
        const accrualVal = row.accrual ? parseFloat(row.accrual) : null;
        const orderVal = row.order ? parseFloat(row.order) : null;
        const ledgerRes = await fetch('/api/payments-ledger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId, effectiveDate: isoDate, accrual: accrualVal, order: orderVal }),
        });
        if (!ledgerRes.ok) { const e = await ledgerRes.json(); throw new Error(e.error || 'Failed to create ledger entry'); }
      }
      setProjBulkOpen(false);
      fetchReport({ silent: true });
    } catch (err: any) {
      alert(err.message || 'Failed');
    } finally {
      setIsProjBulkSubmitting(false);
    }
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

  const effectiveValue = (cell: CellData, metric: MetricKey): number => {
    if (!showTaxMultiplier) return cell[metric] as number;
    const factor = cell.pensionOnTax ? 1.25 * 1.04 : 1.25;
    switch (metric) {
      case 'accrual': return (cell.accrual - cell.accrualTax) + cell.accrualTax * factor;
      case 'latestAccrual': return (cell.latestAccrual - cell.latestAccrualTax) + cell.latestAccrualTax * factor;
      case 'order': return (cell.order - cell.orderTax) + cell.orderTax * factor;
      case 'lastMonthAccrual': return (cell.lastMonthAccrual - cell.lastMonthAccrualTax) + cell.lastMonthAccrualTax * factor;
      case 'lastMonthOrder': return (cell.lastMonthOrder - cell.lastMonthOrderTax) + cell.lastMonthOrderTax * factor;
      case 'payment': return (cell.payment - cell.paymentTax) + cell.paymentTax * factor;
      case 'due': {
        const o = (cell.order - cell.orderTax) + cell.orderTax * factor;
        const p = (cell.payment - cell.paymentTax) + cell.paymentTax * factor;
        return Number((o - Math.abs(p)).toFixed(2));
      }
      case 'balance': {
        const a = (cell.accrual - cell.accrualTax) + cell.accrualTax * factor;
        const p = (cell.payment - cell.paymentTax) + cell.paymentTax * factor;
        return Number((a - Math.abs(p)).toFixed(2));
      }
      case 'accrualPerFloor': {
        const a = (cell.accrual - cell.accrualTax) + cell.accrualTax * factor;
        return cell.jobFloors > 0 ? Number((a / cell.jobFloors).toFixed(2)) : 0;
      }
      default:
        return cell[metric] as number;
    }
  };
  const getCellValue = (cell: CellData, metric: MetricKey): number => effectiveValue(cell, metric);

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
    // Also ensure cost FCs from waybill data are in the map (so col appears even with no direct payments)
    for (const proj of report.projects) {
      if (proj.waybillPairedFcUuid && proj.waybillPairedFcCode && !map.has(proj.waybillPairedFcUuid)) {
        map.set(proj.waybillPairedFcUuid, { uuid: proj.waybillPairedFcUuid, validation: proj.waybillPairedFcValidation ?? proj.waybillPairedFcCode, code: proj.waybillPairedFcCode, isIncome: false });
      }
    }
    return map;
  }, [report]);

  function buildPivot(proj: ProjectData, fcFilter: FcFilter) {
    const jobMap = new Map<string, { key: string; label: string; jobUuid: string | null; floors: number }>();

    // First: add ALL registered jobs so grid shows them even without payments
    for (const job of (proj.allJobs ?? [])) {
      jobMap.set(job.jobUuid, { key: job.jobUuid, label: job.jobName || '(No Job)', jobUuid: job.jobUuid, floors: job.floors });
    }

    for (const cell of proj.cells) {
      if (fcFilter === 'income' && !cell.financialCodeIsIncome) continue;
      if (fcFilter === 'cost' && cell.financialCodeIsIncome) continue;
      const jobKey = cell.jobUuid ?? NULL_JOB_KEY;
      if (!jobMap.has(jobKey)) {
        jobMap.set(jobKey, { key: jobKey, label: cell.jobName ?? '(No Job)', jobUuid: cell.jobUuid, floors: cell.jobFloors ?? 0 });
      } else {
        // take max floors in case of multiple cells for same job
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
    const fcSource = fcDisplayMode === 'perProject'
      ? Array.from(new Map(proj.cells.map(c => [c.financialCodeUuid, { uuid: c.financialCodeUuid, validation: c.financialCodeValidation, code: c.financialCodeCode, isIncome: c.financialCodeIsIncome }])).values())
      : Array.from(globalFcMap.values());
    const fcList = fcSource
      .filter((fc) => {
        if (fcFilter === 'income') return fc.isIncome;
        if (fcFilter === 'cost') return !fc.isIncome;
        return true;
      })
      .sort((a, b) => a.code.localeCompare(b.code));
    // waybillFcMap: key = cost FC UUID (financial_codes.default_code_fc), value = column label.
    // The amber sub-column appears inside the cost FC column (e.g. 2.1.1.6).
    const waybillFcMap = new Map();
    if (proj.waybillSum > 0 && proj.waybillPairedFcUuid) {
      waybillFcMap.set(proj.waybillPairedFcUuid, "Waybill");
    }
        return { jobList, fcList, cellMap, waybillFcMap };
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
      const fcList = fcDisplayMode === 'perProject'
        ? Array.from(new Map(
            proj.cells
              .filter(c => !(fcFilter === 'income' && !c.financialCodeIsIncome) && !(fcFilter === 'cost' && c.financialCodeIsIncome))
              .map(c => [c.financialCodeUuid, { uuid: c.financialCodeUuid, validation: c.financialCodeValidation, code: c.financialCodeCode, isIncome: c.financialCodeIsIncome }])
          ).values())
        : Array.from(globalFcMap.values()).filter((fc) =>
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
            const v = cell ? effectiveValue(cell, m) : 0;
            const s = formatCell(v, m);
            if (s !== '-') maxChars = Math.max(maxChars, s.length);
          }
          if (!NON_ADDITIVE_METRICS.has(m)) {
            const colTotal = jobList.reduce((s, job) => {
              const cell = cellMap.get(`${job.key}:${fc.uuid}`);
              return s + (cell ? effectiveValue(cell, m) : 0);
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
          return sum + activeMetrics.reduce((s, m) => NON_ADDITIVE_METRICS.has(m) ? s : s + effectiveValue(cell, m), 0);
        }, 0);
        if (rowTotal !== 0) maxTotalChars = Math.max(maxTotalChars, formatMoney(rowTotal).length);
      }
      map.set('total', Math.max(map.get('total') ?? 0, Math.max(50, Math.ceil(maxTotalChars * PX_PER_CHAR + CELL_PAD))));
    }
    return map;
  }, [report, projectFcFilters, globalFcMap, fcDisplayMode, activeMetrics]);

  // ── Grand totals across all selected projects (grouped by currency) ──

  const grandTotals = useMemo(() => {
    if (!report?.projects?.length) return null;

    const byCurrency = new Map<string, { projectCount: number; totalJobs: number; totalFcs: Set<string>; paidJobs: Set<string> }>();

    for (const proj of report.projects) {
      const currency = projectCurrencies[proj.projectUuid] ?? 'GEL';
      if (!byCurrency.has(currency)) byCurrency.set(currency, { projectCount: 0, totalJobs: 0, totalFcs: new Set(), paidJobs: new Set() });
      const entry = byCurrency.get(currency)!;
      entry.projectCount++;

      const fcFilter = projectFcFilters[proj.projectUuid] ?? 'all';
      const { jobList, fcList } = buildPivot(proj, fcFilter);

      entry.totalJobs += jobList.filter(j => j.key !== NULL_JOB_KEY).length;
      for (const fc of fcList) entry.totalFcs.add(fc.uuid);

      // a job is "paid" if it has any cell with accrual or payment
      for (const job of jobList) {
        if (job.key === NULL_JOB_KEY) continue;
        const hasPaid = proj.cells.some(c => c.jobUuid === job.jobUuid && (c.accrual !== 0 || c.payment !== 0));
        if (hasPaid) entry.paidJobs.add(`${proj.projectUuid}:${job.jobUuid}`);
      }
    }

    return Array.from(byCurrency.entries()).map(([currency, entry]) => ({
      currency,
      projectCount: entry.projectCount,
      totalJobs: entry.totalJobs,
      totalFcs: entry.totalFcs.size,
      paidJobs: entry.paidJobs.size,
    }));
  }, [report, projectCurrencies, projectFcFilters, buildPivot]);

  // ── XLSX export ──

  const handleExport = () => {
    if (!report?.projects?.length) return;
    const wb = XLSX.utils.book_new();

    // Pre-compute pivot data for each project once
    const pivotByProject = report.projects.map((proj) => {
      const fcFilter = projectFcFilters[proj.projectUuid] ?? 'all';
      return { proj, ...buildPivot(proj, fcFilter) };
    });

    // ── Summary sheet (FCs × Projects) ──────────────────────────────────────
    const summaryMetric: MetricKey = activeMetrics.includes('payment')
      ? 'payment'
      : (activeMetrics.find((m) => !NON_ADDITIVE_METRICS.has(m)) ?? 'payment');

    // Collect all FCs that appear in any project, sorted by code
    const allFcMap = new Map<string, { uuid: string; code: string; validation: string; isIncome: boolean }>();
    for (const { fcList } of pivotByProject) {
      for (const fc of fcList) {
        if (!allFcMap.has(fc.uuid)) allFcMap.set(fc.uuid, fc);
      }
    }
    const allFcs = Array.from(allFcMap.values()).sort((a, b) => a.code.localeCompare(b.code));

    const summaryHeader = [
      'FC Code', 'FC Name', 'Income/Cost',
      ...report.projects.map((p) => `${p.projectIndex}`),
    ];
    const summaryRows: (string | number)[][] = [];
    for (const fc of allFcs) {
      const projectTotals = pivotByProject.map(({ jobList, cellMap }) => {
        const total = jobList.reduce((sum, job) => {
          const cell = cellMap.get(`${job.key}:${fc.uuid}`);
          return sum + (cell ? getCellValue(cell, summaryMetric) : 0);
        }, 0);
        return total !== 0 ? Math.round(total * 100) / 100 : '';
      });
      if (projectTotals.some((v) => v !== '' && v !== 0)) {
        summaryRows.push([fc.code, fc.validation || fc.code, fc.isIncome ? 'Income' : 'Cost', ...projectTotals]);
      }
    }
    // Totals row in summary
    const summaryTotals: (string | number)[] = ['', 'TOTAL', '', ...pivotByProject.map(({ jobList, fcList, cellMap }) =>
      fcList.reduce((fcSum, fc) =>
        fcSum + jobList.reduce((jSum, job) => {
          const cell = cellMap.get(`${job.key}:${fc.uuid}`);
          return jSum + (cell && !NON_ADDITIVE_METRICS.has(summaryMetric) ? getCellValue(cell, summaryMetric) : 0);
        }, 0), 0)
    )];
    const summaryWs = XLSX.utils.aoa_to_sheet([summaryHeader, ...summaryRows, summaryTotals]);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    // ── Per-project sheets ────────────────────────────────────────────────────
    for (const { proj, jobList, fcList, cellMap, waybillFcMap } of pivotByProject) {
      const rawName = `${proj.projectIndex} ${proj.projectName}`.replace(/[\\/:*?[\]]/g, '_');
      const sheetName = rawName.slice(0, 31);
      const headerRow = [
        'Job', 'Floors',
        ...fcList.flatMap((fc) => [
          ...activeMetrics.map((m) => `${fc.code} / ${METRIC_LABELS[m]}`),
          ...(waybillFcMap.has(fc.uuid) ? [`${fc.code} / Waybill`] : []),
        ]),
        'Total',
      ];
      const dataRows = jobList.map((job) => {
        let rowTotal = 0;
        const cols = fcList.flatMap((fc) => {
          const metricCols = activeMetrics.map((m) => {
            const cell = cellMap.get(`${job.key}:${fc.uuid}`);
            const v = cell ? getCellValue(cell, m) : 0;
            if (!NON_ADDITIVE_METRICS.has(m)) rowTotal += v;
            return v;
          });
          const waybillCols = waybillFcMap.has(fc.uuid) ? ['-'] : [];
          return [...metricCols, ...waybillCols];
        });
        return [job.label || '(No Job)', job.floors || 0, ...cols, rowTotal];
      });
      // Totals row
      const totalsRow = [
        'TOTAL', '',
        ...fcList.flatMap((fc) => {
          const metricCols = activeMetrics.map((m) => {
            if (NON_ADDITIVE_METRICS.has(m)) return '';
            return jobList.reduce((sum, job) => {
              const cell = cellMap.get(`${job.key}:${fc.uuid}`);
              return sum + (cell ? getCellValue(cell, m) : 0);
            }, 0);
          });
          const waybillCols = waybillFcMap.has(fc.uuid) ? [proj.waybillSum > 0 ? Math.round(proj.waybillSum * 100) / 100 : '-'] : [];
          return [...metricCols, ...waybillCols];
        }),
        '',
      ];
      const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows, totalsRow]);
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
      {/* ── Views bar ── */}
      {viewsReady && (
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              className="flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700 select-none"
              onClick={() => setViewsDropdownOpen((v) => !v)}
            >
              <LayoutGrid className="h-3.5 w-3.5 text-gray-400" />
              <span>{views.find((v) => v.uuid === activeViewUuid)?.name ?? 'Views'}</span>
              <ChevronDown className="h-3 w-3 text-gray-400" />
            </button>
            {viewsDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setViewsDropdownOpen(false)} />
                <div className="absolute left-0 top-8 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px]">
                  {views.map((view) => (
                    <button
                      key={view.uuid}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50 ${view.uuid === activeViewUuid ? 'font-semibold text-blue-600' : 'text-gray-700'}`}
                      onClick={() => { handleSwitchView(view.uuid); setViewsDropdownOpen(false); }}
                    >
                      {view.uuid === activeViewUuid ? <Check className="h-3 w-3 shrink-0" /> : <span className="w-3 shrink-0" />}
                      {view.name}
                    </button>
                  ))}
                  {views.length === 0 && <p className="px-3 py-1.5 text-xs text-gray-400">No saved views</p>}
                  <div className="border-t border-gray-100 my-1" />
                  {activeViewUuid && (
                    <button
                      className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                      onClick={() => {
                        setViewsDropdownOpen(false);
                        const v = views.find((v) => v.uuid === activeViewUuid);
                        if (v) { setRenamingViewUuid(v.uuid); setRenameValue(v.name); }
                      }}
                    >
                      <Pencil className="h-3 w-3" /> Rename
                    </button>
                  )}
                  {views.length > 1 && activeViewUuid && (
                    <button
                      className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 flex items-center gap-2"
                      onClick={() => { setViewsDropdownOpen(false); handleDeleteView(activeViewUuid); }}
                    >
                      <X className="h-3 w-3" /> Delete
                    </button>
                  )}
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    className="w-full text-left px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                    onClick={() => { setViewsDropdownOpen(false); setNewViewOpen(true); }}
                  >
                    <BookmarkPlus className="h-3 w-3" /> New view
                  </button>
                </div>
              </>
            )}
          </div>
          {renamingViewUuid && (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                className="h-6 px-2 text-xs border border-gray-300 rounded outline-none focus:border-blue-400 w-32"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => handleRenameView(renamingViewUuid, renameValue)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameView(renamingViewUuid, renameValue);
                  if (e.key === 'Escape') setRenamingViewUuid(null);
                }}
              />
              <button className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700" onClick={() => setRenamingViewUuid(null)}>Cancel</button>
            </div>
          )}
          {newViewOpen && (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                className="h-6 px-2 text-xs border border-gray-300 rounded outline-none focus:border-blue-400 w-32"
                placeholder="View name…"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateView();
                  if (e.key === 'Escape') { setNewViewOpen(false); setNewViewName(''); }
                }}
              />
              <button className="h-6 px-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700" onClick={handleCreateView}>Save</button>
              <button className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700" onClick={() => { setNewViewOpen(false); setNewViewName(''); }}>Cancel</button>
            </div>
          )}
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
                  <p className="text-xs font-semibold text-gray-600 mb-2">Display financial codes</p>
                  <div className="flex flex-col gap-1">
                    {([
                      { value: 'global', label: 'Binded to selected projects' },
                      { value: 'perProject', label: 'Unique to each project' },
                    ] as const).map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="radio"
                          name="fcDisplayMode"
                          checked={fcDisplayMode === opt.value}
                          onChange={() => setFcDisplayMode(opt.value)}
                          className="accent-blue-600"
                        />
                        <span className="text-xs text-gray-700">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Calculation</p>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div
                      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${showTaxMultiplier ? 'bg-blue-600' : 'bg-gray-200'}`}
                      onClick={() => setShowTaxMultiplier((v) => !v)}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transition-transform ${showTaxMultiplier ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                    <span className="text-xs text-gray-700">Income/Pension Tax gross-up</span>
                  </label>
                  <p className="text-[10px] text-gray-400 mt-1 ml-11">×1.25 income tax · ×1.04 pension</p>
                </div>
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

      {/* ── Grand Total Summary ── */}
      {grandTotals && grandTotals.length > 0 && (
        <div className="space-y-1">
          {grandTotals.map(({ currency, projectCount, totalJobs, totalFcs, paidJobs }) => (
            <div key={currency} className="border border-gray-300 rounded-lg overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-700">
                <span className="font-semibold text-sm text-white">
                  Total · {projectCount} project{projectCount !== 1 ? 's' : ''} · {currency}
                </span>
                <span className="ml-auto text-xs text-gray-300">
                  {totalFcs} FCs · {paidJobs} / {totalJobs} jobs paid
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

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
        const { jobList, fcList, cellMap, waybillFcMap } = buildPivot(proj, fcFilter);
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
                  className="flex items-center gap-1 px-2 py-0.5 h-6 text-[11px] rounded border border-gray-200 bg-white text-gray-600 hover:bg-green-50 hover:text-green-700 hover:border-green-300 transition-colors"
                  title="Bulk add ledger entries per job (select FC per job)"
                  onClick={(e) => { e.stopPropagation(); handleOpenProjBulkDialog({ projectUuid: proj.projectUuid, projectLabel: `${proj.projectIndex} – ${proj.projectName}`, jobs: jobList }); }}
                >
                  <Plus className="h-3 w-3" />
                  Add Ledger
                </button>
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
                            colSpan={activeMetrics.length + (waybillFcMap.has(fc.uuid) ? 1 : 0)}
                            style={{ minWidth: activeMetrics.reduce((s, m) => s + getColWidth(`${fc.uuid}:${m}`, autoColWidthsMap.get(`${fc.uuid}:${m}`) ?? 38), 0) + (waybillFcMap.has(fc.uuid) ? getColWidth(`${fc.uuid}:waybillSum`, autoColWidthsMap.get(`${fc.uuid}:waybillSum`) ?? 60) : 0) }}
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
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleOpenFcBulkDialog({ projectUuid: proj.projectUuid, projectLabel: `${proj.projectIndex} – ${proj.projectName}`, fcUuid: fc.uuid, fcLabel: fc.validation || fc.code, jobs: jobList }); }}
                                title="Bulk add ledger entries for all jobs in this FC"
                                className="opacity-0 group-hover/fchdr:opacity-100 text-gray-300 hover:text-green-500 transition-opacity shrink-0"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
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
                        {fcList.flatMap((fc) => {
                          const metricThs = activeMetrics.map((m, mi) => {
                            const colKey = `${fc.uuid}:${m}`;
                            const autoW = autoColWidthsMap.get(colKey) ?? 38;
                            const colW = getColWidth(colKey, autoW);
                            const isLast = mi === activeMetrics.length - 1 && !waybillFcMap.has(fc.uuid);
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
                          });
                          if (waybillFcMap.has(fc.uuid)) {
                            const wKey = `${fc.uuid}:waybillSum`;
                            const wAutoW = autoColWidthsMap.get(wKey) ?? 60;
                            const wColW = getColWidth(wKey, wAutoW);
                            const pairedCode = waybillFcMap.get(fc.uuid) ?? 'Waybills';
                            metricThs.push(
                              <th
                                key={wKey}
                                title={pairedCode}
                                className="relative overflow-hidden px-2 py-1 text-center text-[10px] font-medium text-amber-700 border-r border-gray-200 bg-amber-50"
                                style={{ width: wColW, minWidth: wColW }}
                              >
                                <span className="truncate block">{pairedCode}</span>
                                <div className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-blue-300 opacity-0 hover:opacity-60" onMouseDown={(e) => startResize(e, wKey, wAutoW)} />
                              </th>
                            );
                          }
                          return metricThs;
                        })}
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
                            {fcList.flatMap((fc) => {
                              const cell = cellMap.get(`${job.key}:${fc.uuid}`);
                              const metricTds = activeMetrics.map((m, mi) => {
                                const colKey = `${fc.uuid}:${m}`;
                                const colW = getColWidth(colKey, autoColWidthsMap.get(colKey) ?? 38);
                                const isLast = mi === activeMetrics.length - 1 && !waybillFcMap.has(fc.uuid);
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
                              });
                              if (waybillFcMap.has(fc.uuid)) {
                                const wKey = `${fc.uuid}:waybillSum`;
                                const wColW = getColWidth(wKey, autoColWidthsMap.get(wKey) ?? 60);
                                metricTds.push(
                                  <td
                                    key={`${job.key}:${fc.uuid}:waybillSum`}
                                    className="px-2 py-1 text-right text-[11px] text-amber-600 bg-amber-50 border-r border-amber-200"
                                    style={{ width: wColW, minWidth: wColW }}
                                  >
                                    {/* Waybill is project-level; shown in totals row only */}
                                    <span className="text-gray-300">-</span>
                                  </td>
                                );
                              }
                              return metricTds;
                            })}
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
                        {fcList.flatMap((fc) => {
                          const totMetricTds = activeMetrics.map((m, mi) => {
                            const colKey = `${fc.uuid}:${m}`;
                            const colW = getColWidth(colKey, autoColWidthsMap.get(colKey) ?? 38);
                            const isLast = mi === activeMetrics.length - 1 && !waybillFcMap.has(fc.uuid);
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
                          });
                          if (waybillFcMap.has(fc.uuid)) {
                            // Waybill total comes from project-level aggregate (not summed per-job)
                            const waybillTotal = proj.waybillSum;
                            const wKey = `${fc.uuid}:waybillSum`;
                            const wColW = getColWidth(wKey, autoColWidthsMap.get(wKey) ?? 60);
                            totMetricTds.push(
                              <td
                                key={`${fc.uuid}:waybillSum:total`}
                                className="px-2 py-1 text-right text-[11px] font-semibold text-amber-700 bg-amber-100 border-r border-amber-200"
                                style={{ width: wColW, minWidth: wColW }}
                              >
                                {waybillTotal > 0 ? formatMoney(waybillTotal) : '-'}
                              </td>
                            );
                          }
                          return totMetricTds;
                        })}
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

      {/* ── FC Bulk Ledger Dialog ── */}
      <Dialog open={fcBulkOpen} onOpenChange={setFcBulkOpen}>
        <DialogContent className="w-[90%] max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Bulk Add Ledger Entries</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-gray-800">{fcBulkFcLabel}</span>
              {' · '}
              <span className="font-medium text-gray-800">{fcBulkProjectLabel}</span>
              <br />Select a counteragent and currency, then enter values per job.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 space-y-4 pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Counteragent <span className="text-red-500">*</span></Label>
                <Combobox
                  value={fcBulkCounteragentUuid}
                  onValueChange={setFcBulkCounteragentUuid}
                  options={dlgCounterAgents.map(ca => ({ value: ca.counteragent_uuid || ca.counteragentUuid || '', label: ca.counteragent || ca.name || '' })).filter(o => o.value && o.label)}
                  placeholder="Select counteragent..."
                  searchPlaceholder="Search counteragents..."
                />
              </div>
              <div className="space-y-1">
                <Label>Currency <span className="text-red-500">*</span></Label>
                <Combobox
                  value={fcBulkCurrencyUuid}
                  onValueChange={setFcBulkCurrencyUuid}
                  options={dlgCurrencies.map(c => ({ value: c.uuid, label: c.code }))}
                  placeholder="Select currency..."
                  searchPlaceholder="Search currencies..."
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox id="fcBulkIncomeTax" checked={fcBulkIncomeTax} onCheckedChange={(v) => setFcBulkIncomeTax(Boolean(v))} />
                <Label htmlFor="fcBulkIncomeTax">Income Tax</Label>
              </div>
              <div className="flex-1">
                <Input value={fcBulkLabel} onChange={(e) => setFcBulkLabel(e.target.value)} placeholder="Payment label (optional)" className="h-8 text-sm" />
              </div>
            </div>
            {fcBulkJobs.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-4">No jobs found for this project.</div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Job</th>
                      <th className="text-center px-2 py-2 text-xs font-semibold text-gray-600 w-28">Accrual</th>
                      <th className="text-center px-2 py-2 text-xs font-semibold text-gray-600 w-28">Order</th>
                      <th className="text-center px-2 py-2 text-xs font-semibold text-gray-600 w-36">Date</th>
                      <th className="text-center px-2 py-2 text-xs font-semibold text-gray-600 w-28">In Ledger</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fcBulkJobs.map((row, i) => {
                      const isDragHighlighted = bulkDragCopy?.table === 'fc' && i >= Math.min(bulkDragCopy.srcRow, bulkDragCopy.dstRow) && i <= Math.max(bulkDragCopy.srcRow, bulkDragCopy.dstRow);
                      return (
                      <tr key={i}
                        className={isDragHighlighted ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}
                        onMouseEnter={() => { if (bulkDragCopy?.table === 'fc') setBulkDragCopy(prev => prev ? { ...prev, dstRow: i } : null); }}
                      >
                        <td className="px-3 py-1.5 text-xs text-gray-700 font-medium">{row.jobLabel}</td>
                        <td className="px-2 py-1">
                          <div className="relative">
                            <Input
                              type="number"
                              step="0.01"
                              value={row.accrual}
                              onChange={(e) => setFcBulkJobs(prev => prev.map((r, j) => j === i ? { ...r, accrual: e.target.value } : r))}
                              placeholder="0.00"
                              className="h-7 text-xs text-center"
                            />
                            <div
                              className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-blue-400 hover:bg-blue-600 cursor-crosshair select-none"
                              title="Drag to copy value"
                              onMouseDown={(e) => { e.preventDefault(); setBulkDragCopy({ table: 'fc', col: 'accrual', srcRow: i, dstRow: i, value: row.accrual }); }}
                            />
                          </div>
                        </td>
                        <td className="px-2 py-1">
                          <div className="relative">
                            <Input
                              type="number"
                              step="0.01"
                              value={row.order}
                              onChange={(e) => setFcBulkJobs(prev => prev.map((r, j) => j === i ? { ...r, order: e.target.value } : r))}
                              placeholder="0.00"
                              className="h-7 text-xs text-center"
                            />
                            <div
                              className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-blue-400 hover:bg-blue-600 cursor-crosshair select-none"
                              title="Drag to copy value"
                              onMouseDown={(e) => { e.preventDefault(); setBulkDragCopy({ table: 'fc', col: 'order', srcRow: i, dstRow: i, value: row.order }); }}
                            />
                          </div>
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            type="text"
                            value={row.date}
                            onChange={(e) => {
                              let v = e.target.value.replace(/[^\d.]/g, '');
                              if (v.length === 2 && !v.includes('.')) v += '.';
                              else if (v.length === 5 && v.split('.').length === 2) v += '.';
                              if (v.length <= 10) setFcBulkJobs(prev => prev.map((r, j) => j === i ? { ...r, date: v } : r));
                            }}
                            placeholder="dd.mm.yyyy"
                            maxLength={10}
                            className="h-7 text-xs text-center"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {(() => {
                            const selReady = !!(fcBulkCounteragentUuid && fcBulkCurrencyUuid);
                            const s = fcBulkSums.get(row.jobUuid ?? 'null');
                            if (!s || (s.accrual === 0 && s.order === 0)) return selReady ? <span className="text-[10px] text-gray-300">—</span> : null;
                            return (
                              <div className="text-[10px] font-mono leading-tight space-y-0.5">
                                {s.accrual !== 0 && <div className="text-blue-700 font-semibold">{formatMoney(s.accrual)}</div>}
                                {s.order !== 0 && <div className="text-gray-500">ord: {formatMoney(s.order)}</div>}
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-gray-400">Only rows with at least one value (Accrual or Order) will be submitted. One payment + ledger entry created per job row.</p>
          </div>
          <div className="flex gap-3 pt-3 border-t border-gray-100 mt-2">
            <Button variant="outline" onClick={() => setFcBulkOpen(false)} disabled={isFcBulkSubmitting} className="flex-1">Cancel</Button>
            <Button
              onClick={handleFcBulkSubmit}
              disabled={isFcBulkSubmitting || !fcBulkCounteragentUuid || !fcBulkCurrencyUuid}
              className="flex-1"
            >
              {isFcBulkSubmitting
                ? 'Submitting…'
                : `Submit${fcBulkJobs.filter(j => j.accrual || j.order).length > 0 ? ` (${fcBulkJobs.filter(j => j.accrual || j.order).length} rows)` : ''}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Project Bulk Ledger Dialog ── */}
      <Dialog open={projBulkOpen} onOpenChange={setProjBulkOpen}>
        <DialogContent className="w-[95%] max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Bulk Add Ledger Entries</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-gray-800">{projBulkProjectLabel}</span>
              <br />Select counteragent, currency &amp; financial code once, then enter values per job.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 space-y-4 pr-1">
            {/* Shared header fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Counteragent <span className="text-red-500">*</span></Label>
                <Combobox
                  value={projBulkCounteragentUuid}
                  onValueChange={setProjBulkCounteragentUuid}
                  options={dlgCounterAgents.map(ca => ({ value: ca.counteragent_uuid || ca.counteragentUuid || '', label: ca.counteragent || ca.name || '' })).filter(o => o.value && o.label)}
                  placeholder="Select counteragent..."
                  searchPlaceholder="Search counteragents..."
                />
              </div>
              <div className="space-y-1">
                <Label>Currency <span className="text-red-500">*</span></Label>
                <Combobox
                  value={projBulkCurrencyUuid}
                  onValueChange={setProjBulkCurrencyUuid}
                  options={dlgCurrencies.map(c => ({ value: c.uuid, label: c.code }))}
                  placeholder="Select currency..."
                  searchPlaceholder="Search currencies..."
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Financial Code <span className="text-red-500">*</span></Label>
              <Combobox
                value={projBulkFcUuid}
                onValueChange={setProjBulkFcUuid}
                options={dlgFinancialCodes.map(fc => ({ value: fc.uuid, label: fc.validation || fc.code }))}
                placeholder="Select financial code..."
                searchPlaceholder="Search financial codes..."
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox id="projBulkIncomeTax" checked={projBulkIncomeTax} onCheckedChange={(v) => setProjBulkIncomeTax(Boolean(v))} />
                <Label htmlFor="projBulkIncomeTax">Income Tax</Label>
              </div>
              <div className="flex-1">
                <Input value={projBulkLabel} onChange={(e) => setProjBulkLabel(e.target.value)} placeholder="Payment label (optional)" className="h-8 text-sm" />
              </div>
            </div>
            {/* Per-job rows */}
            {projBulkRows.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-4">No jobs found for this project.</div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Job</th>
                      <th className="text-center px-2 py-2 text-xs font-semibold text-gray-600 w-24">Accrual</th>
                      <th className="text-center px-2 py-2 text-xs font-semibold text-gray-600 w-24">Order</th>
                      <th className="text-center px-2 py-2 text-xs font-semibold text-gray-600 w-28">Date</th>
                      <th className="text-center px-2 py-2 text-xs font-semibold text-gray-600 w-32">In Ledger</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projBulkRows.map((row, i) => {
                      // Find existing matching payment when header fields + shared FC are all selected
                      const existingPayment = (() => {
                        if (!projBulkCounteragentUuid || !projBulkCurrencyUuid || !projBulkFcUuid) return null;
                        const currCode = dlgCurrencies.find(c => c.uuid === projBulkCurrencyUuid)?.code;
                        const fcValidation = dlgFinancialCodes.find(f => f.uuid === projBulkFcUuid)?.validation;
                        if (!currCode || !fcValidation) return null;
                        return dlgPayments.find(p =>
                          p.projectUuid === projBulkProjectUuid &&
                          p.counteragentUuid === projBulkCounteragentUuid &&
                          p.currencyCode === currCode &&
                          (p.incomeTax ?? false) === projBulkIncomeTax &&
                          p.financialCode === fcValidation
                        ) || null;
                      })();
                      const isDragHighlightedP = bulkDragCopy?.table === 'proj' && i >= Math.min(bulkDragCopy.srcRow, bulkDragCopy.dstRow) && i <= Math.max(bulkDragCopy.srcRow, bulkDragCopy.dstRow);
                      return (
                        <tr key={i}
                          className={isDragHighlightedP ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}
                          onMouseEnter={() => { if (bulkDragCopy?.table === 'proj') setBulkDragCopy(prev => prev ? { ...prev, dstRow: i } : null); }}
                        >
                          <td className="px-3 py-1.5 text-xs text-gray-700 font-medium">{row.jobLabel}</td>
                          <td className="px-2 py-1">
                            <div className="relative">
                              <Input
                                type="number" step="0.01" value={row.accrual}
                                onChange={(e) => setProjBulkRows(prev => prev.map((r, j) => j === i ? { ...r, accrual: e.target.value } : r))}
                                placeholder="0.00" className="h-7 text-xs text-center"
                              />
                              <div
                                className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-blue-400 hover:bg-blue-600 cursor-crosshair select-none"
                                title="Drag to copy value"
                                onMouseDown={(e) => { e.preventDefault(); setBulkDragCopy({ table: 'proj', col: 'accrual', srcRow: i, dstRow: i, value: row.accrual }); }}
                              />
                            </div>
                          </td>
                          <td className="px-2 py-1">
                            <div className="relative">
                              <Input
                                type="number" step="0.01" value={row.order}
                                onChange={(e) => setProjBulkRows(prev => prev.map((r, j) => j === i ? { ...r, order: e.target.value } : r))}
                                placeholder="0.00" className="h-7 text-xs text-center"
                              />
                              <div
                                className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-blue-400 hover:bg-blue-600 cursor-crosshair select-none"
                                title="Drag to copy value"
                                onMouseDown={(e) => { e.preventDefault(); setBulkDragCopy({ table: 'proj', col: 'order', srcRow: i, dstRow: i, value: row.order }); }}
                              />
                            </div>
                          </td>
                          <td className="px-2 py-1">
                            <Input
                              type="text" value={row.date}
                              onChange={(e) => {
                                let v = e.target.value.replace(/[^\d.]/g, '');
                                if (v.length === 2 && !v.includes('.')) v += '.';
                                else if (v.length === 5 && v.split('.').length === 2) v += '.';
                                if (v.length <= 10) setProjBulkRows(prev => prev.map((r, j) => j === i ? { ...r, date: v } : r));
                              }}
                              placeholder="dd.mm.yyyy" maxLength={10} className="h-7 text-xs text-center"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            {(() => {
                              const selReady = !!(projBulkCounteragentUuid && projBulkCurrencyUuid && projBulkFcUuid);
                              const sm = projBulkSums.get(row.jobUuid ?? 'null');
                              if (!sm || (sm.accrual === 0 && sm.order === 0)) return selReady ? <span className="text-[10px] text-gray-300">—</span> : null;
                              return (
                                <div className="text-[10px] font-mono leading-tight space-y-0.5">
                                  {sm.accrual !== 0 && <div className="text-blue-700 font-semibold">{formatMoney(sm.accrual)}</div>}
                                  {sm.order !== 0 && <div className="text-gray-500">ord: {formatMoney(sm.order)}</div>}
                                </div>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-gray-400">Only rows with at least one value (Accrual or Order) will be submitted. Existing payment IDs shown in amber are informational — a new payment will still be created per job row.</p>
          </div>
          <div className="flex gap-3 pt-3 border-t border-gray-100 mt-2">
            <Button variant="outline" onClick={() => setProjBulkOpen(false)} disabled={isProjBulkSubmitting} className="flex-1">Cancel</Button>
            <Button
              onClick={handleProjBulkSubmit}
              disabled={isProjBulkSubmitting || !projBulkCounteragentUuid || !projBulkCurrencyUuid || !projBulkFcUuid}
              className="flex-1"
            >
              {isProjBulkSubmitting
                ? 'Submitting…'
                : `Submit${projBulkRows.filter(r => r.accrual || r.order).length > 0 ? ` (${projBulkRows.filter(r => r.accrual || r.order).length} rows)` : ''}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
