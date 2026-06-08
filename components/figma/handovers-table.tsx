'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Edit2,
  Settings,
  RefreshCw,
  Download,
} from 'lucide-react';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Combobox } from '@/components/ui/combobox';
import { JobAttachments } from './job-attachments';
import { ProjectAttachments } from './project-attachments';
import { JobForm } from './jobs-table';
import type { Job, Brand } from './jobs-table';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { ColumnFilterPopover } from './shared/column-filter-popover';
import { ClearFiltersButton } from './shared/clear-filters-button';
import { useTableFilters } from './shared/use-table-filters';
import type { ColumnFormat } from './shared/table-filters';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { HandoverPaymentsGrid } from './handover-payments-grid';
import { HandoverJobDistributionsGrid } from './handover-job-distributions-grid';
import { exportMultiSheetsToXlsx } from '@/lib/export-xlsx';

type ColumnKey = keyof HandoverJob;

type HandoverJob = Job & {
  paidNominal: number;
  paidGel: number;
  debitNominal: number;
  debitGel: number | null;
  totalGel: number | null;
};

type HandoverProject = {
  projectUuid: string;
  projectIndex: string;
  projectName: string;
  currencyCode: string | null;
};

type ColumnConfig = {
  key: ColumnKey;
  label: string;
  width: number;
  visible: boolean;
  sortable: boolean;
  filterable: boolean;
  format?: ColumnFormat;
};

const defaultColumns: ColumnConfig[] = [
  { key: 'jobName', label: 'Job Name', width: 180, visible: true, sortable: true, filterable: true },
  { key: 'factoryNo', label: 'Factory No', width: 140, visible: true, sortable: true, filterable: true },
  { key: 'brandName', label: 'Brand', width: 130, visible: true, sortable: true, filterable: true },
  { key: 'floors', label: 'Floors', width: 90, visible: true, sortable: true, filterable: true },
  { key: 'weight', label: 'Weight (kg)', width: 110, visible: true, sortable: true, filterable: true },
  { key: 'sellingPrice', label: 'Selling Price', width: 140, visible: true, sortable: true, filterable: true, format: 'number' },
  { key: 'paidNominal', label: 'Paid Nominal', width: 140, visible: true, sortable: true, filterable: false, format: 'number' },
  { key: 'paidGel', label: 'Paid GEL', width: 140, visible: true, sortable: true, filterable: false, format: 'number' },
  { key: 'debitNominal', label: 'Debit Nominal', width: 140, visible: true, sortable: true, filterable: false, format: 'number' },
  { key: 'debitGel', label: 'Debit GEL', width: 140, visible: true, sortable: true, filterable: false, format: 'number' },
  { key: 'totalGel', label: 'Total GEL', width: 140, visible: true, sortable: true, filterable: false, format: 'number' },
  { key: 'isFf', label: 'FF', width: 80, visible: true, sortable: true, filterable: true },
  { key: 'liftCertDate', label: 'Cert. Date', width: 130, visible: true, sortable: true, filterable: false },
  { key: 'liftCertDocNo', label: 'Doc. No', width: 150, visible: true, sortable: true, filterable: false },
];

const STORAGE_KEY = 'handovers-table-columns';
const STORAGE_VERSION = '4';

type Project = HandoverProject;
type InsiderOption = { value: string; label: string; keywords?: string };

type FormData = {
  projectUuid: string;
  projectUuids: string[];
  jobName: string;
  factoryNo: string;
  floors: string | number;
  weight: string | number;
  sellingPrice: string | number;
  isFf: boolean;
  brandUuid: string;
  insiderUuid: string;
};

export function HandoversTable() {
  // ── Project / Job state ──────────────────────────────────────────────────
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectUuid, setSelectedProjectUuid] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('handovers-last-project') ?? '';
    }
    return '';
  });
  const [jobs, setJobs] = useState<HandoverJob[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [insidersList, setInsidersList] = useState<{ insiderUuid: string; insiderName: string }[]>([]);
  const [selectedInsiderUuids, setSelectedInsiderUuids] = useState<string[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // ── Attachment state ──────────────────────────────────────────────────────
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  // ── Edit dialog ──────────────────────────────────────────────────────────
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [formData, setFormData] = useState<FormData>({
    projectUuid: '',
    projectUuids: [],
    jobName: '',
    factoryNo: '',
    floors: '',
    weight: '',
    sellingPrice: '',
    isFf: false,
    brandUuid: '',
    insiderUuid: '',
  });

  // ── Column config ─────────────────────────────────────────────────────────
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        const version = localStorage.getItem(`${STORAGE_KEY}-v`);
        if (saved && version === STORAGE_VERSION) return JSON.parse(saved);
      } catch {}
    }
    return defaultColumns;
  });

  // ── Resize ────────────────────────────────────────────────────────────────
  const [isResizing, setIsResizing] = useState<{
    column: ColumnKey;
    startX: number;
    startWidth: number;
  } | null>(null);

  // ── Drag reorder ─────────────────────────────────────────────────────────
  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────
  const isInsiderFixed = selectedInsiderUuids.length === 1;
  const fixedInsider = useMemo(
    () =>
      isInsiderFixed
        ? (insidersList.find(i => i.insiderUuid === selectedInsiderUuids[0]) ?? null)
        : null,
    [isInsiderFixed, insidersList, selectedInsiderUuids],
  );
  const insiderOptions: InsiderOption[] = useMemo(
    () => insidersList.map(i => ({ value: i.insiderUuid, label: i.insiderName, keywords: i.insiderName })),
    [insidersList],
  );
  const visibleColumns = useMemo(() => columns.filter(c => c.visible), [columns]);

  const selectedProject = useMemo(
    () => projects.find(p => p.projectUuid === selectedProjectUuid) ?? null,
    [projects, selectedProjectUuid],
  );

  const formatMoney = (value: number) => Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const rateCacheRef = useRef<Map<string, number | null>>(new Map());

  // ── Grid refs for global export ────────────────────────────────────────────
  const paymentsGridRef = useRef<any>(null);
  const distributionsGridRef = useRef<any>(null);

  const lookupNbgRate = useCallback(async (date: string | null, currencyCode: string | null) => {
    const normalizedCurrency = currencyCode ? currencyCode.toUpperCase() : null;
    if (!date || !normalizedCurrency) return null;
    if (normalizedCurrency === 'GEL') return 1;

    // Extract just the date part (YYYY-MM-DD) from ISO date strings like "2026-05-27T00:00:00.000Z"
    const dateOnly = date.split('T')[0];

    const cacheKey = `${dateOnly}|${normalizedCurrency}`;
    if (rateCacheRef.current.has(cacheKey)) {
      return rateCacheRef.current.get(cacheKey) ?? null;
    }

    try {
      const res = await fetch(
        `/api/exchange-rates?date=${encodeURIComponent(dateOnly)}&currency=${encodeURIComponent(normalizedCurrency)}`,
        { credentials: 'include' }
      );

      if (!res.ok) {
        rateCacheRef.current.set(cacheKey, null);
        return null;
      }

      const data = await res.json().catch(() => null);
      const rate = Number(data?.rate);
      const normalizedRate = Number.isFinite(rate) && rate > 0 ? rate : null;
      rateCacheRef.current.set(cacheKey, normalizedRate);
      return normalizedRate;
    } catch (e) {
      console.error(`[Handovers] Failed to fetch rate for ${dateOnly} ${normalizedCurrency}:`, e);
      rateCacheRef.current.set(cacheKey, null);
      return null;
    }
  }, []);

  // ── useTableFilters ───────────────────────────────────────────────────────
  const {
    filters,
    searchTerm,
    sortColumn,
    sortDirection,
    currentPage,
    pageSize,
    sortedData: sortedJobs,
    paginatedData: paginatedJobs,
    totalPages,
    getColumnValues,
    setSearchTerm,
    handleSort,
    setSortColumn,
    setSortDirection,
    setCurrentPage,
    handleFilterChange,
    clearFilters,
    activeFilterCount,
  } = useTableFilters<HandoverJob, ColumnKey>({
    data: jobs,
    columns,
    defaultSortColumn: 'jobName',
    defaultSortDirection: 'asc',
    filtersStorageKey: 'handovers-table:filters',
  });

  // ── Persist column config ─────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
    localStorage.setItem(`${STORAGE_KEY}-v`, STORAGE_VERSION);
  }, [columns]);

  // ── Resize mouse events ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isResizing) {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      return;
    }
    const onMove = (e: MouseEvent) => {
      const diff = e.clientX - isResizing.startX;
      const newWidth = Math.max(60, isResizing.startWidth + diff);
      setColumns(cols =>
        cols.map(c => (c.key === isResizing.column ? { ...c, width: newWidth } : c)),
      );
    };
    const onUp = () => setIsResizing(null);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isResizing]);

  // ── Initial data fetch ────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        console.log('[Handovers] Starting initial data fetch...');
        const [projRes, brandRes, insiderRes] = await Promise.all([
          fetch('/api/projects-v2', { credentials: 'include' }),
          fetch('/api/brands', { credentials: 'include' }),
          fetch('/api/insider-selection', { cache: 'no-store', credentials: 'include' }),
        ]);
        
        console.log('[Handovers] API responses:', { 
          projRes: { ok: projRes.ok, status: projRes.status },
          brandRes: { ok: brandRes.ok, status: brandRes.status },
          insiderRes: { ok: insiderRes.ok, status: insiderRes.status }
        });
        
        if (projRes.ok) {
          const data = await projRes.json();
          console.log('[Handovers] Projects fetched:', { count: data?.length, firstProject: data?.[0] });
          
          // Safely extract projects, with fallback if not an array
          const projectsArray = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
          console.log('[Handovers] Projects array after fallback:', { count: projectsArray.length });
          
          setProjects(
            projectsArray.map((p: any) => {
              console.log('[Handovers] Mapping project:', { uuid: p.project_uuid, name: p.project_name });
              return {
                projectUuid: p.project_uuid,
                projectIndex: p.project_index,
                projectName: p.project_name,
                currencyCode: p.currency ?? null,
              };
            }),
          );
        } else {
          console.error('[Handovers] projRes not ok:', { status: projRes.status });
          const text = await projRes.text();
          console.error('[Handovers] Response body:', text.substring(0, 500));
          setProjects([]); // Set empty array on error
        }
        
        if (brandRes.ok) setBrands(await brandRes.json());
        else console.error('[Handovers] brandRes not ok:', { status: brandRes.status });
        
        if (insiderRes.ok) {
          const data = await insiderRes.json();
          console.log('[Handovers] Insider data fetched:', data);
          const selectedUuids: string[] = Array.isArray(data?.selectedUuids) ? data.selectedUuids : [];
          const options: any[] = Array.isArray(data?.options) ? data.options : [];
          const selectedInsiders: any[] = Array.isArray(data?.selectedInsiders) ? data.selectedInsiders : [];
          const list = (selectedInsiders.length > 0 ? selectedInsiders : options).map((i: any) => ({
            insiderUuid: i.insiderUuid,
            insiderName: i.insiderName,
          }));
          setSelectedInsiderUuids(selectedUuids);
          setInsidersList(list);
        } else {
          console.error('[Handovers] insiderRes not ok:', { status: insiderRes.status });
        }
      } catch (e) {
        console.error('Failed to fetch initial data:', e);
        console.error('[Handovers] Error details:', { message: e instanceof Error ? e.message : String(e) });
      } finally {
        setLoadingProjects(false);
      }
    })();
  }, []);

  // ── Jobs fetch ────────────────────────────────────────────────────────────
  const fetchJobs = async (projectUuid: string, projectCurrencyCode: string | null) => {
    if (!projectUuid) {
      setJobs([]);
      setAttachmentCounts({});
      return;
    }
    setLoadingJobs(true);
    try {
      const res = await fetch(`/api/jobs?projectUuid=${encodeURIComponent(projectUuid)}`, { credentials: 'include' });
      if (res.ok) {
        const data: any[] = await res.json();
        const jobUuids = data.map((j: any) => j.jobUuid).filter(Boolean);

        // Bulk-fetch lift cert info, attachment counts, distributions, bank transactions, and income payments in parallel
        const [countRes, liftRes, paymentsRes, distRes, bankTxRes] = await Promise.all([
          jobUuids.length > 0
            ? fetch(`/api/jobs/attachments?countsOnly=1&jobUuids=${encodeURIComponent(jobUuids.join(','))}`, { credentials: 'include' })
            : Promise.resolve(null),
          jobUuids.length > 0
            ? fetch(`/api/jobs/attachments?liftCertInfo=1&jobUuids=${encodeURIComponent(jobUuids.join(','))}`, { credentials: 'include' })
            : Promise.resolve(null),
          fetch(`/api/payments-report?projectUuid=${encodeURIComponent(projectUuid)}`, { credentials: 'include' }),
          fetch(`/api/payments-jobs?project_uuid=${encodeURIComponent(projectUuid)}`, { credentials: 'include' }),
          fetch(`/api/bank-transactions?project_uuid=${encodeURIComponent(projectUuid)}&limit=0`, { credentials: 'include' }),
        ]);

        const countsMap: Record<string, number> = countRes?.ok ? (await countRes.json()).counts ?? {} : {};
        const liftCertMap: Record<string, { date: string | null; docNo: string | null }> = liftRes?.ok ? (await liftRes.json()).info ?? {} : {};
        console.log(`[Handovers] Lift cert info fetched:`, { liftCertOk: liftRes?.ok, mapSize: Object.keys(liftCertMap).length });

        const incomePaymentIds = new Set<string>();
        if (paymentsRes.ok) {
          const paymentsData = await paymentsRes.json();
          (Array.isArray(paymentsData) ? paymentsData : []).forEach((payment: any) => {
            if (payment?.financialCodeIsIncome && payment?.paymentId) {
              incomePaymentIds.add(String(payment.paymentId));
            }
          });
        }

        // Calculate Paid Nominal and Paid GEL: sum bank transactions by job (matching bottom grid)
        const paidNominalByJob = new Map<string, number>();
        const paidGelByJob = new Map<string, number>();

        // Build distribution map for matching bank transactions to jobs
        const distributionsByBankTx = new Map<string, Array<{ jobUuid: string; amountAccount: number; amount: number }>>();
        const unmappedDistributions: Array<{ jobUuid: string; amountAccount: number; amount: number }> = [];
        
        if (distRes.ok) {
          const distData = await distRes.json();
          if (Array.isArray(distData)) {
            distData.forEach((dist: any) => {
              // Only include distributions for income payments
              if (!dist?.payment_id || !incomePaymentIds.has(String(dist.payment_id))) return;
              if (!dist?.job_uuid) return;

              const distEntry = {
                jobUuid: String(dist.job_uuid),
                amountAccount: Number(dist.amount_account_curr ?? 0),
                amount: Number(dist.amount ?? 0),
              };

              // Try to match to bank transaction via composite key
              let key: string | null = null;
              if (dist.batch_partition_uuid) {
                key = `batch:${dist.batch_partition_uuid}`;
              } else if (dist.raw_record_uuid) {
                key = `raw:${dist.raw_record_uuid}`;
              }

              if (key) {
                if (!distributionsByBankTx.has(key)) {
                  distributionsByBankTx.set(key, []);
                }
                distributionsByBankTx.get(key)?.push(distEntry);
              } else {
                // No key to match - store as unmapped
                unmappedDistributions.push(distEntry);
              }
            });
          }
        }

        // First, add unmapped distributions directly to job totals
        unmappedDistributions.forEach((dist) => {
          const jobKey = String(dist.jobUuid);
          paidNominalByJob.set(
            jobKey,
            (paidNominalByJob.get(jobKey) ?? 0) + dist.amount,
          );
          paidGelByJob.set(
            jobKey,
            (paidGelByJob.get(jobKey) ?? 0) + dist.amountAccount,
          );
        });

        // Then, filter bank transactions (same filters as bottom grid) and sum by job via distributions
        const bankTxPayload = bankTxRes.ok ? await bankTxRes.json() : null;
        const bankTxRows = Array.isArray(bankTxPayload)
          ? bankTxPayload
          : Array.isArray(bankTxPayload?.data)
          ? bankTxPayload.data
          : [];

        bankTxRows.forEach((row: any) => {
          // Apply same filters as bottom grid: project, not balance, has payment_id, is income
          if (row.project_uuid !== projectUuid || row.is_balance_record || !row.payment_id) return;
          if (!incomePaymentIds.has(String(row.payment_id))) return;

          // Find distributions for this bank transaction
          let key: string | null = null;
          if (row.batch_partition_uuid) {
            key = `batch:${row.batch_partition_uuid}`;
          } else if (row.raw_record_uuid) {
            key = `raw:${row.raw_record_uuid}`;
          }

          if (key) {
            const distributions = distributionsByBankTx.get(key) || [];
            distributions.forEach((dist) => {
              const jobKey = String(dist.jobUuid);
              paidNominalByJob.set(
                jobKey,
                (paidNominalByJob.get(jobKey) ?? 0) + dist.amount,
              );
              paidGelByJob.set(
                jobKey,
                (paidGelByJob.get(jobKey) ?? 0) + dist.amountAccount,
              );
            });
          }
        });

        const uniqueCertDates = Array.from(
          new Set(
            data
              .map((job: any) => liftCertMap[job.jobUuid]?.date ?? null)
              .filter((date: string | null): date is string => Boolean(date)),
          ),
        );

        const rateByDate = new Map<string, number | null>();
        if (uniqueCertDates.length > 0) {
          console.log(`[Handovers] Looking up rates for ${uniqueCertDates.length} unique cert dates, currency: ${projectCurrencyCode}`);
          await Promise.all(uniqueCertDates.map(async (date) => {
            const rate = await lookupNbgRate(date, projectCurrencyCode);
            rateByDate.set(date, rate);
            console.log(`[Handovers] Rate for ${date} (${projectCurrencyCode}): ${rate}`);
          }));
        }

        setAttachmentCounts(countsMap);
        setJobs(
          data.map((job, idx) => ({
            id: Number(job.id ?? 0),
            jobUuid: String(job.jobUuid ?? ''),
            jobName: String(job.jobName ?? ''),
            factoryNo: job.factoryNo ?? null,
            floors: job.floors ?? null,
            weight: job.weight ?? null,
            sellingPrice: job.sellingPrice != null ? Number(job.sellingPrice) : null,
            isFf: Boolean(job.isFf),
            brandUuid: job.brandUuid ?? null,
            brandName: String(job.brandName ?? ''),
            jobIndex: String(job.jobDisplay ?? ''),
            projectUuid,
            projectIndex: '',
            projectName: '',
            bindingCount: 1,
            isActive: true,
            createdAt: '',
            updatedAt: '',
            insiderName: job.insiderName ?? null,
            certificateDate: null,
            liftCertDate: liftCertMap[job.jobUuid]?.date ?? null,
            liftCertDocNo: liftCertMap[job.jobUuid]?.docNo ?? null,
            paidNominal: paidNominalByJob.get(String(job.jobUuid)) ?? 0,
            paidGel: paidGelByJob.get(String(job.jobUuid)) ?? 0,
            debitNominal: (job.sellingPrice != null ? Number(job.sellingPrice) : 0) - (paidNominalByJob.get(String(job.jobUuid)) ?? 0),
            debitGel: (() => {
              const certDate = liftCertMap[job.jobUuid]?.date ?? null;
              if (!certDate) return null;
              const rate = rateByDate.get(certDate);
              if (rate === undefined) return null; // Rate not fetched yet
              if (rate == null) return null; // Rate lookup failed
              const debitNominal = (job.sellingPrice != null ? Number(job.sellingPrice) : 0) - (paidNominalByJob.get(String(job.jobUuid)) ?? 0);
              const calculated = Number((debitNominal * rate).toFixed(2));
              console.log(`[Handovers] Job ${job.jobUuid} debitGel: ${debitNominal} × ${rate} = ${calculated}`);
              return calculated;
            })(),
            totalGel: (() => {
              const certDate = liftCertMap[job.jobUuid]?.date ?? null;
              if (!certDate) return null;
              const paidGel = paidGelByJob.get(String(job.jobUuid)) ?? 0;
              const rate = rateByDate.get(certDate);
              if (rate === undefined) return null; // Rate not fetched yet
              if (rate == null) return null; // Rate lookup failed
              const debitNominal = (job.sellingPrice != null ? Number(job.sellingPrice) : 0) - (paidNominalByJob.get(String(job.jobUuid)) ?? 0);
              const debitGel = Number((debitNominal * rate).toFixed(2));
              const total = Number((paidGel + debitGel).toFixed(2));
              console.log(`[Handovers] Job ${job.jobUuid} totalGel: ${paidGel} + ${debitGel} = ${total}`);
              return total;
            })(),
            _rowKey: String(job.jobUuid ?? idx),
          })),
        );
      }
    } catch (e) {
      console.error('Failed to fetch jobs:', e);
    } finally {
      setLoadingJobs(false);
    }
  };

  useEffect(() => {
    fetchJobs(selectedProjectUuid, selectedProject?.currencyCode ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectUuid, selectedProject?.currencyCode]);

  const projectOptions = useMemo(
    () =>
      projects.map(p => ({
        value: p.projectUuid,
        label: `${p.projectIndex} — ${p.projectName}`,
        keywords: `${p.projectIndex} ${p.projectName}`,
      })),
    [projects],
  );

  // ── Column helpers ────────────────────────────────────────────────────────
  const toggleColumnVisibility = (key: ColumnKey) =>
    setColumns(cols => cols.map(c => (c.key === key ? { ...c, visible: !c.visible } : c)));

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, key: ColumnKey) => {
    setDraggedColumn(key);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: React.DragEvent, key: ColumnKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedColumn && draggedColumn !== key) setDragOverColumn(key);
  };
  const handleDragLeave = () => setDragOverColumn(null);
  const handleDrop = (e: React.DragEvent, targetKey: ColumnKey) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetKey) {
      setDraggedColumn(null);
      setDragOverColumn(null);
      return;
    }
    const from = columns.findIndex(c => c.key === draggedColumn);
    const to = columns.findIndex(c => c.key === targetKey);
    if (from === -1 || to === -1) return;
    const next = [...columns];
    const [removed] = next.splice(from, 1);
    next.splice(to, 0, removed);
    setColumns(next);
    setDraggedColumn(null);
    setDragOverColumn(null);
  };
  const handleDragEnd = () => {
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  // ── Edit dialog ───────────────────────────────────────────────────────────
  const openEditDialog = (job: Job) => {
    setEditingJob(job);
    setFormData({
      projectUuid: selectedProjectUuid,
      projectUuids: [selectedProjectUuid],
      jobName: job.jobName,
      factoryNo: job.factoryNo ?? '',
      floors: job.floors ?? '',
      weight: job.weight ?? '',
      sellingPrice: job.sellingPrice ?? '',
      isFf: job.isFf,
      brandUuid: job.brandUuid ?? '',
      insiderUuid: isInsiderFixed ? (fixedInsider?.insiderUuid ?? '') : '',
    });
    setIsEditDialogOpen(true);
  };

  const handleEdit = async () => {
    if (!editingJob) return;
    try {
      const res = await fetch('/api/jobs', { credentials: 'include',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingJob.id,
          projectUuids:
            formData.projectUuids.length > 0 ? formData.projectUuids : [selectedProjectUuid],
          jobName: formData.jobName,
          factoryNo: String(formData.factoryNo).trim() || null,
          floors: formData.floors === '' ? null : Number(formData.floors),
          weight: formData.weight === '' ? null : Number(formData.weight),
          sellingPrice: formData.sellingPrice === '' ? null : Number(formData.sellingPrice),
          isFf: formData.isFf,
          brandUuid: formData.brandUuid || null,
          insiderUuid: formData.insiderUuid || null,
        }),
      });
      if (res.ok) {
        await fetchJobs(selectedProjectUuid, selectedProject?.currencyCode ?? null);
        setIsEditDialogOpen(false);
        setEditingJob(null);
      }
    } catch (e) {
      console.error('Failed to update job:', e);
    }
  };

  // ── Cell renderer ─────────────────────────────────────────────────────────
  const renderCell = (job: HandoverJob, col: ColumnConfig) => {
    switch (col.key) {
      case 'liftCertDate':
        if (!job.liftCertDate) return <span className="text-muted-foreground text-sm">—</span>;
        const d = new Date(job.liftCertDate);
        const formatted = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
        return <span className="text-sm">{formatted}</span>;
      case 'paidNominal':
        return <span>{formatMoney(job.paidNominal)}</span>;
      case 'paidGel':
        return <span>{formatMoney(job.paidGel)}</span>;
      case 'debitNominal':
        return <span>{formatMoney(job.debitNominal)}</span>;
      case 'debitGel':
        if (!job.liftCertDate || job.debitGel == null) {
          return <span className="text-muted-foreground text-sm">—</span>;
        }
        return <span>{formatMoney(job.debitGel)}</span>;
      case 'totalGel':
        if (!job.liftCertDate || job.totalGel == null) {
          return <span className="text-muted-foreground text-sm">—</span>;
        }
        return <span>{formatMoney(job.totalGel)}</span>;
      case 'liftCertDocNo':
        return job.liftCertDocNo ? (
          <span className="text-sm font-mono">{job.liftCertDocNo}</span>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        );
      case 'isFf':
        return (
          <Badge variant={job.isFf ? 'default' : 'secondary'}>
            {job.isFf ? 'FF' : 'NOT FF'}
          </Badge>
        );
      case 'floors':
        return <span>{job.floors == null ? '—' : `${job.floors} Floors`}</span>;
      case 'weight':
        return <span>{job.weight == null ? '—' : `${job.weight} kg`}</span>;
      case 'sellingPrice':
        return (
          <span>{job.sellingPrice == null ? '—' : formatMoney(job.sellingPrice)}</span>
        );
      case 'factoryNo':
        return <span className="font-mono text-sm">{job.factoryNo ?? '—'}</span>;
      default:
        return <span className="text-sm">{String((job as any)[col.key] ?? '—')}</span>;
    }
  };

  // ── Global XLSX Export ─────────────────────────────────────────────────────
  const handleGlobalExport = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const projectName = selectedProject?.projectIndex || 'Handovers';
      const fileName = `handovers-${projectName}-${today}.xlsx`;

      // Get the most recent certificate date from jobs (for template filtering)
      const jobsWithCertDate = sortedJobs.filter((job) => job.liftCertDate);
      const certificateDate = jobsWithCertDate.length > 0 
        ? new Date(jobsWithCertDate[0].liftCertDate!)
        : new Date();

      // Prepare jobs data for template
      const jobsDataForTemplate = sortedJobs.map((job) => ({
        counteragentId: job.jobName || '',
        factoryNo: job.factoryNo || '',
        manufacturerName: job.brandName || '',
        weight: job.weight ?? 0,
        floors: job.floors ?? 0,
        nominalAmount: job.sellingPrice ?? 0,
        gelAmount: job.paidGel ?? 0,
        certificateNo: job.liftCertDocNo || '',
        liftCertDate: job.liftCertDate || today,
      }));

      // Prepare counteragent and company info
      const counteragentInfo = 'შ.პ.ს აკმე ელვატორი'; // TODO: fetch from project
      const companyName = 'შპს აი-სი-ი'; // Default: ICE LLC

      // Call API to generate template-based export
      const response = await fetch('/api/export/handover-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          jobsData: jobsDataForTemplate,
          certificateDate: certificateDate.toISOString(),
          counteragentInfo,
          companyName,
          fileName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Handovers Export] API error:', errorData);
        throw new Error(errorData.error || `Export failed with status ${response.status}`);
      }

      // Get the file from response
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log(`[Handovers Export] Template export successful: ${fileName}`);
    } catch (error) {
      console.error('[Handovers Export] Template export failed:', error);
      // Fallback to old export method if template fails
      console.log('[Handovers Export] Falling back to programmatic export');
      handleGlobalExportLegacy();
    }
  }, [sortedJobs, selectedProject]);

  // ── Legacy Export (Fallback) ───────────────────────────────────────────────
  const handleGlobalExportLegacy = useCallback(() => {
    const sheets: any[] = [];

    // Sheet 1: Jobs Table
    const jobsSheetRows = sortedJobs.map(job => ({
      jobName: job.jobName || '',
      factoryNo: job.factoryNo || '',
      brandName: job.brandName || '',
      floors: job.floors ?? '',
      weight: job.weight ?? '',
      sellingPrice: job.sellingPrice ?? 0,
      paidNominal: job.paidNominal ?? 0,
      paidGel: job.paidGel ?? 0,
      debitNominal: job.debitNominal ?? 0,
      debitGel: job.debitGel ?? 0,
      totalGel: job.totalGel ?? 0,
      isFf: job.isFf ? 'FF' : 'NOT FF',
      liftCertDate: job.liftCertDate ? job.liftCertDate.split('T')[0] : '',
      liftCertDocNo: job.liftCertDocNo || '',
    }));

    sheets.push({
      name: 'Jobs',
      rows: jobsSheetRows,
      columns: [
        { key: 'jobName', label: 'Job Name', visible: true },
        { key: 'factoryNo', label: 'Factory No', visible: true },
        { key: 'brandName', label: 'Brand Name', visible: true },
        { key: 'floors', label: 'Floors', visible: true },
        { key: 'weight', label: 'Weight (kg)', visible: true },
        { key: 'sellingPrice', label: 'Selling Price', visible: true, format: 'currency' },
        { key: 'paidNominal', label: 'Paid Nominal', visible: true, format: 'currency' },
        { key: 'paidGel', label: 'Paid GEL', visible: true, format: 'currency' },
        { key: 'debitNominal', label: 'Debit Nominal', visible: true, format: 'currency' },
        { key: 'debitGel', label: 'Debit GEL', visible: true, format: 'currency' },
        { key: 'totalGel', label: 'Total GEL', visible: true, format: 'currency' },
        { key: 'isFf', label: 'Type', visible: true },
        { key: 'liftCertDate', label: 'Lift Cert Date', visible: true, format: 'date' },
        { key: 'liftCertDocNo', label: 'Lift Cert Doc No', visible: true },
      ],
    });

    // Sheet 2: Income Payments
    const paymentsData = paymentsGridRef.current?.getExportData?.();
    if (paymentsData) {
      sheets.push({
        name: paymentsData.sheetName || 'Income Payments',
        rows: paymentsData.rows,
        columns: paymentsData.columns,
      });
    }

    // Sheet 3: Job Distributions
    const distributionsData = distributionsGridRef.current?.getExportData?.();
    if (distributionsData) {
      sheets.push({
        name: distributionsData.sheetName || 'Job Distributions',
        rows: distributionsData.rows,
        columns: distributionsData.columns,
      });
    }

    // Export to XLSX
    if (sheets.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const projectName = selectedProject?.projectIndex || 'Handovers';
      const fileName = `handovers-${projectName}-${today}.xlsx`;
      exportMultiSheetsToXlsx({ sheets, fileName });
    }
  }, [sortedJobs, selectedProject]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Handovers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select a project to view and manage its jobs for handover.
        </p>
      </div>

      {/* Project selector */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Project</label>
        <div className="flex items-center gap-3">
          <div className="max-w-xl flex-1">
            <Combobox
              options={projectOptions}
              value={selectedProjectUuid}
              onValueChange={(uuid) => {
                setSelectedProjectUuid(uuid);
                if (typeof window !== 'undefined') {
                  if (uuid) localStorage.setItem('handovers-last-project', uuid);
                  else localStorage.removeItem('handovers-last-project');
                }
              }}
              placeholder={loadingProjects ? 'Loading projects…' : 'Select a project…'}
              searchPlaceholder="Search projects…"
              emptyText="No project found."
            />
          </div>
          {selectedProjectUuid && (
            <ProjectAttachments
              projectUuid={selectedProjectUuid}
              projectName={projects.find(p => p.projectUuid === selectedProjectUuid)?.projectName ?? null}
              lazyLoad={false}
            />
          )}
        </div>
      </div>

      {/* Jobs grid — only shown when a project is selected */}
      {selectedProjectUuid && (
        <div className="space-y-3">
          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search jobs…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <ClearFiltersButton
              activeCount={activeFilterCount + (searchTerm.trim() ? 1 : 0)}
              onClear={() => {
                clearFilters();
                setSearchTerm('');
              }}
            />

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Columns
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Toggle Columns</h4>
                  {columns.map(col => (
                    <div key={col.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={`hcol-${col.key}`}
                        checked={col.visible}
                        onCheckedChange={() => toggleColumnVisibility(col.key)}
                      />
                      <Label htmlFor={`hcol-${col.key}`} className="text-sm cursor-pointer">
                        {col.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchJobs(selectedProjectUuid, selectedProject?.currencyCode ?? null)}
              disabled={loadingJobs}
              title="Refresh jobs"
            >
              <RefreshCw className={`h-4 w-4 ${loadingJobs ? 'animate-spin' : ''}`} />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleGlobalExport}
              title="Export all grids to XLSX"
              disabled={!selectedProjectUuid || sortedJobs.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>

            <span className="text-sm text-muted-foreground ml-auto">
              {loadingJobs
                ? 'Loading…'
                : `${sortedJobs.length} job${sortedJobs.length !== 1 ? 's' : ''}`}
            </span>
          </div>

          {/* Table */}
          <div className="rounded-lg border bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {visibleColumns.map(column => (
                      <TableHead
                        key={column.key}
                        draggable={!isResizing}
                        onDragStart={e => handleDragStart(e, column.key)}
                        onDragOver={e => handleDragOver(e, column.key)}
                        onDragLeave={handleDragLeave}
                        onDrop={e => handleDrop(e, column.key)}
                        onDragEnd={handleDragEnd}
                        className={[
                          'bg-muted/50 relative group select-none',
                          draggedColumn === column.key ? 'opacity-50' : '',
                          dragOverColumn === column.key ? 'border-l-4 border-l-blue-500' : '',
                        ].join(' ')}
                        style={{ width: column.width, minWidth: column.width }}
                      >
                        <div className={[
                          'flex items-center gap-1 pr-3',
                          column.key === 'floors' ||
                          column.key === 'weight' ||
                          column.key === 'sellingPrice' ||
                          column.key === 'paidNominal' ||
                          column.key === 'paidGel' ||
                          column.key === 'debitNominal' ||
                          column.key === 'debitGel' ||
                          column.key === 'totalGel'
                            ? 'justify-end'
                            : 'justify-between',
                        ].join(' ')}>
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-medium">{column.label}</span>
                            {column.sortable && (
                              <button
                                onClick={() => handleSort(column.key)}
                                className="hover:bg-accent rounded p-0.5 shrink-0"
                              >
                                {sortColumn === column.key ? (
                                  sortDirection === 'asc' ? (
                                    <ArrowUp className="h-3 w-3" />
                                  ) : (
                                    <ArrowDown className="h-3 w-3" />
                                  )
                                ) : (
                                  <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                                )}
                              </button>
                            )}
                          </div>
                          {column.filterable && (
                            <ColumnFilterPopover
                              columnKey={column.key}
                              columnLabel={column.label}
                              values={getColumnValues(column.key)}
                              activeFilters={
                                filters.get(column.key)?.mode === 'facet'
                                  ? (filters.get(column.key) as any).values
                                  : new Set<string>()
                              }
                              activeFilter={filters.get(column.key)}
                              columnFormat={column.format as ColumnFormat | undefined}
                              onAdvancedFilterChange={filter =>
                                handleFilterChange(column.key, filter)
                              }
                              onFilterChange={values =>
                                handleFilterChange(
                                  column.key,
                                  values.size > 0 ? { mode: 'facet', values } : null,
                                )
                              }
                              onSort={dir => {
                                setSortColumn(column.key);
                                setSortDirection(dir);
                              }}
                            />
                          )}
                        </div>
                        {/* Resize handle */}
                        <div
                          className="absolute top-0 bottom-0 z-30 w-3 cursor-col-resize"
                          style={{ right: '-6px' }}
                          draggable={false}
                          onMouseDown={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsResizing({
                              column: column.key,
                              startX: e.clientX,
                              startWidth: column.width,
                            });
                          }}
                          onClick={e => e.stopPropagation()}
                        />
                      </TableHead>
                    ))}
                    <TableHead className="bg-muted/50 w-24 shrink-0">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingJobs ? (
                    <TableRow>
                      <TableCell
                        colSpan={visibleColumns.length + 1}
                        className="text-center py-8 text-muted-foreground"
                      >
                        Loading jobs…
                      </TableCell>
                    </TableRow>
                  ) : paginatedJobs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={visibleColumns.length + 1}
                        className="text-center py-8 text-muted-foreground"
                      >
                        {sortedJobs.length === 0 && !searchTerm && activeFilterCount === 0
                          ? 'No jobs found for this project.'
                          : 'No jobs match the current filters.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {paginatedJobs.map(job => (
                        <TableRow key={job._rowKey}>
                          {visibleColumns.map(col => (
                            <TableCell
                              key={col.key}
                              style={{ width: col.width, maxWidth: col.width }}
                              className={[
                                col.key === 'floors' ||
                                col.key === 'weight' ||
                                col.key === 'sellingPrice' ||
                                col.key === 'paidNominal' ||
                                col.key === 'paidGel' ||
                                col.key === 'debitNominal' ||
                                col.key === 'debitGel' ||
                                col.key === 'totalGel'
                                  ? 'text-right tabular-nums'
                                  : '',
                              ].join(' ')}
                            >
                              {renderCell(job, col)}
                            </TableCell>
                          ))}
                          <TableCell className="w-24">
                            <div className="flex items-center gap-1">
                              <JobAttachments
                                jobUuid={job.jobUuid}
                                jobName={job.jobName}
                                triggerTitle="Attachments"
                                initialCount={attachmentCounts[job.jobUuid] ?? null}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Edit job"
                                onClick={() => openEditDialog(job)}
                                disabled={!job.id}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(() => {
                        const totalFloors = sortedJobs.reduce((s, j) => s + (j.floors ?? 0), 0);
                        const totalPrice = sortedJobs.reduce((s, j) => s + (j.sellingPrice ?? 0), 0);
                        const totalPaidNominal = sortedJobs.reduce((s, j) => s + (j.paidNominal ?? 0), 0);
                        const totalPaidGel = sortedJobs.reduce((s, j) => s + (j.paidGel ?? 0), 0);
                        const totalDebitNominal = sortedJobs.reduce((s, j) => s + (j.debitNominal ?? 0), 0);
                        const totalDebitGel = sortedJobs.reduce((s, j) => s + (j.debitGel ?? 0), 0);
                        const totalGel = sortedJobs.reduce((s, j) => s + (j.totalGel ?? 0), 0);
                        const hasFloors = visibleColumns.some(c => c.key === 'floors');
                        const hasPrice = visibleColumns.some(c => c.key === 'sellingPrice');
                        const hasPaidNominal = visibleColumns.some(c => c.key === 'paidNominal');
                        const hasPaidGel = visibleColumns.some(c => c.key === 'paidGel');
                        const hasDebitNominal = visibleColumns.some(c => c.key === 'debitNominal');
                        const hasDebitGel = visibleColumns.some(c => c.key === 'debitGel');
                        const hasTotalGel = visibleColumns.some(c => c.key === 'totalGel');
                        if (!hasFloors && !hasPrice && !hasPaidNominal && !hasPaidGel && !hasDebitNominal && !hasDebitGel && !hasTotalGel) return null;
                        return (
                          <TableRow className="bg-muted/40 font-semibold border-t-2">
                            {visibleColumns.map(col => (
                              <TableCell
                                key={col.key}
                                style={{ width: col.width, maxWidth: col.width }}
                                className={[
                                  'text-xs',
                                  col.key === 'floors' ||
                                  col.key === 'weight' ||
                                  col.key === 'sellingPrice' ||
                                  col.key === 'paidNominal' ||
                                  col.key === 'paidGel' ||
                                  col.key === 'debitNominal' ||
                                  col.key === 'debitGel' ||
                                  col.key === 'totalGel'
                                    ? 'text-right tabular-nums'
                                    : '',
                                ].join(' ')}
                              >
                                {col.key === 'jobName' ? (
                                  <span className="text-muted-foreground">
                                    Total ({sortedJobs.length})
                                  </span>
                                ) : col.key === 'floors' ? (
                                  <span>{totalFloors.toLocaleString()}</span>
                                ) : col.key === 'sellingPrice' ? (
                                  <span>{totalPrice.toLocaleString()}</span>
                                ) : col.key === 'paidNominal' ? (
                                  <span>{formatMoney(totalPaidNominal)}</span>
                                ) : col.key === 'paidGel' ? (
                                  <span>{formatMoney(totalPaidGel)}</span>
                                ) : col.key === 'debitNominal' ? (
                                  <span>{formatMoney(totalDebitNominal)}</span>
                                ) : col.key === 'debitGel' ? (
                                  <span>{formatMoney(totalDebitGel)}</span>
                                ) : col.key === 'totalGel' ? (
                                  <span>{formatMoney(totalGel)}</span>
                                ) : null}
                              </TableCell>
                            ))}
                            <TableCell className="w-24" />
                          </TableRow>
                        );
                      })()}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, sortedJobs.length)} of {sortedJobs.length}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="flex items-center px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Income Payments Grid */}
      {selectedProjectUuid && (
        <HandoverPaymentsGrid ref={paymentsGridRef} projectUuid={selectedProjectUuid} />
      )}

      {/* Job Distributions Grid */}
      {selectedProjectUuid && (
        <div className="mt-6">
          <HandoverJobDistributionsGrid ref={distributionsGridRef} projectUuid={selectedProjectUuid} />
        </div>
      )}

      {/* Edit Job Dialog */}
      <Dialog
        open={isEditDialogOpen}
        onOpenChange={open => {
          setIsEditDialogOpen(open);
          if (!open) setEditingJob(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Job</DialogTitle>
            <DialogDescription>
              Update job information for {editingJob?.jobName}
            </DialogDescription>
          </DialogHeader>
          <JobForm
            formData={formData}
            setFormData={setFormData}
            projects={projects}
            brands={brands}
            insiderOptions={insiderOptions}
            isInsiderFixed={isInsiderFixed}
            fixedInsiderName={fixedInsider?.insiderName ?? null}
            onSubmit={handleEdit}
            onCancel={() => {
              setIsEditDialogOpen(false);
              setEditingJob(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
