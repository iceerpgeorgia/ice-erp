'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toGenitiveCase } from '@/lib/georgian-genitive';

type ProjectRecord = {
  project_uuid: string;
  project_index: string | null;
  project_name: string | null;
  department: string | null;
  date: string | null;
  address: string | null;
  entity_type: string | null;
  name: string | null;
  director: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  identification_number: string | null;
  insider_entity_type: string | null;
  insider_name_field: string | null;
  insider_director: string | null;
  insider_address_line_1: string | null;
  insider_address_line_2: string | null;
  insider_identification_number: string | null;
  currency: string | null;
};

type JobRecord = {
  jobUuid: string;
  jobName: string;
  factoryNo: string | null;
  brandName: string | null;
  floors: number | null;
  weight: number | null;
  sellingPrice: number | null;
};

type PaymentReportRecord = {
  paymentId?: string | null;
  financialCodeIsIncome?: boolean;
};

type DistributionRecord = {
  payment_id?: string | null;
  job_uuid?: string | null;
  amount?: string | number | null;
  amount_account_curr?: string | number | null;
};

type LiftCertInfo = {
  date: string | null;
  docNo: string | null;
};

type PrintableRow = {
  index: number;
  jobName: string;
  brandName: string;
  factoryNo: string;
  weight: number | null;
  floors: number | null;
  liftCertDocNo: string | null;
  sellingPrice: number;
  totalGel: number | null;
  certDateKey: string | null;
};

const MONTHS_NOMINATIVE = [
  'იანვარი',
  'თებერვალი',
  'მარტი',
  'აპრილი',
  'მაისი',
  'ივნისი',
  'ივლისი',
  'აგვისტო',
  'სექტემბერი',
  'ოქტომბერი',
  'ნოემბერი',
  'დეკემბერი',
];

const MONTHS_GENITIVE = [
  'იანვარის',
  'თებერვალის',
  'მარტის',
  'აპრილის',
  'მაისის',
  'ივნისის',
  'ივლისის',
  'აგვისტოს',
  'სექტემბრის',
  'ოქტომბრის',
  'ნოემბრის',
  'დეკემბრის',
];

function toDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  const isoPrefix = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoPrefix) return isoPrefix[1];
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

function formatDateDdMmYyyy(dateKey: string | null | undefined): string {
  if (!dateKey) return '-';
  const [year, month, day] = dateKey.split('-');
  if (!year || !month || !day) return '-';
  return `${day}.${month}.${year}`;
}

function formatGeorgianDate(dateKey: string | null | undefined, genitive: boolean): string {
  if (!dateKey) return '';
  const [yearRaw, monthRaw, dayRaw] = dateKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day) || month < 1 || month > 12) {
    return '';
  }
  const months = genitive ? MONTHS_GENITIVE : MONTHS_NOMINATIVE;
  return `${day} ${months[month - 1]} ${year}`;
}

function formatMoney(value: number | null | undefined): string {
  if (value == null) return '-';
  return Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function resolveCityLabel(department: string | null | undefined): string {
  const normalized = String(department || '').toLowerCase();
  if (normalized.includes('tbilisi')) return 'ქ. თბილისი';
  if (normalized.includes('თბილის')) return 'ქ. თბილისი';
  return 'ქ. ბათუმი';
}

function HandoversPrintPageContent() {
  const searchParams = useSearchParams();
  const projectUuid = searchParams.get('projectUuid')?.trim() || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [rows, setRows] = useState<PrintableRow[]>([]);
  const [handoverDateKey, setHandoverDateKey] = useState<string | null>(null);

  const lookupRate = useCallback(async (dateKey: string, currencyCode: string | null): Promise<number | null> => {
    const normalizedCurrency = currencyCode ? currencyCode.toUpperCase() : null;
    if (!normalizedCurrency) return null;
    if (normalizedCurrency === 'GEL') return 1;

    const res = await fetch(
      `/api/exchange-rates?date=${encodeURIComponent(dateKey)}&currency=${encodeURIComponent(normalizedCurrency)}`,
      { credentials: 'include' },
    );
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const rate = Number(data?.rate);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!projectUuid) {
        setLoading(false);
        setError('Project UUID is missing.');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [projectRes, jobsRes, paymentsRes, distributionsRes] = await Promise.all([
          fetch(`/api/projects?uuid=${encodeURIComponent(projectUuid)}`, { credentials: 'include', cache: 'no-store' }),
          fetch(`/api/jobs?projectUuid=${encodeURIComponent(projectUuid)}`, { credentials: 'include', cache: 'no-store' }),
          fetch(`/api/payments-report?projectUuid=${encodeURIComponent(projectUuid)}`, { credentials: 'include', cache: 'no-store' }),
          fetch(`/api/payments-jobs?project_uuid=${encodeURIComponent(projectUuid)}`, { credentials: 'include', cache: 'no-store' }),
        ]);

        if (!projectRes.ok) {
          throw new Error(`Failed to load project (${projectRes.status})`);
        }
        if (!jobsRes.ok) {
          throw new Error(`Failed to load jobs (${jobsRes.status})`);
        }

        const projectPayload = await projectRes.json();
        const projectRecord: ProjectRecord | null = Array.isArray(projectPayload)
          ? (projectPayload[0] ?? null)
          : (projectPayload ?? null);

        if (!projectRecord) {
          throw new Error('Project not found.');
        }

        const jobsPayload: JobRecord[] = await jobsRes.json();
        const paymentsPayload: PaymentReportRecord[] = paymentsRes.ok ? await paymentsRes.json() : [];
        const distributionsPayload: DistributionRecord[] = distributionsRes.ok ? await distributionsRes.json() : [];

        const jobUuids = jobsPayload.map((j) => j.jobUuid).filter(Boolean);
        const liftInfo: Record<string, LiftCertInfo> = {};

        if (jobUuids.length > 0) {
          const liftRes = await fetch(
            `/api/jobs/attachments?liftCertInfo=1&jobUuids=${encodeURIComponent(jobUuids.join(','))}`,
            { credentials: 'include', cache: 'no-store' },
          );
          if (liftRes.ok) {
            const liftPayload = await liftRes.json();
            Object.assign(liftInfo, liftPayload?.info ?? {});
          }
        }

        const incomePaymentIds = new Set<string>();
        (Array.isArray(paymentsPayload) ? paymentsPayload : []).forEach((payment) => {
          if (payment?.financialCodeIsIncome && payment?.paymentId) {
            incomePaymentIds.add(String(payment.paymentId));
          }
        });

        const paidNominalByJob = new Map<string, number>();
        const paidGelByJob = new Map<string, number>();

        (Array.isArray(distributionsPayload) ? distributionsPayload : []).forEach((dist) => {
          if (!dist?.payment_id || !incomePaymentIds.has(String(dist.payment_id))) return;
          if (!dist?.job_uuid) return;
          const jobKey = String(dist.job_uuid);
          paidNominalByJob.set(jobKey, (paidNominalByJob.get(jobKey) ?? 0) + Number(dist.amount ?? 0));
          paidGelByJob.set(jobKey, (paidGelByJob.get(jobKey) ?? 0) + Number(dist.amount_account_curr ?? 0));
        });

        const uniqueCertDateKeys = Array.from(
          new Set(
            Object.values(liftInfo)
              .map((item) => toDateKey(item?.date ?? null))
              .filter((v): v is string => Boolean(v)),
          ),
        );

        const rateByDate = new Map<string, number | null>();
        await Promise.all(uniqueCertDateKeys.map(async (dateKey) => {
          const rate = await lookupRate(dateKey, projectRecord.currency);
          rateByDate.set(dateKey, rate);
        }));

        const computedRows: PrintableRow[] = jobsPayload.map((job) => {
          const sellingPrice = job.sellingPrice != null ? Number(job.sellingPrice) : 0;
          const paidNominal = paidNominalByJob.get(String(job.jobUuid)) ?? 0;
          const paidGel = paidGelByJob.get(String(job.jobUuid)) ?? 0;
          const debitNominal = sellingPrice - paidNominal;

          const certDateKey = toDateKey(liftInfo[job.jobUuid]?.date ?? null);
          const rate = certDateKey ? (rateByDate.get(certDateKey) ?? null) : null;
          const debitGel = certDateKey && rate != null ? Number((debitNominal * rate).toFixed(2)) : null;
          const totalGel = certDateKey && debitGel != null ? Number((paidGel + debitGel).toFixed(2)) : null;

          return {
            index: 0,
            jobName: String(job.jobName || ''),
            brandName: String(job.brandName || ''),
            factoryNo: String(job.factoryNo || ''),
            weight: job.weight == null ? null : Number(job.weight),
            floors: job.floors == null ? null : Number(job.floors),
            liftCertDocNo: liftInfo[job.jobUuid]?.docNo ?? null,
            sellingPrice,
            totalGel,
            certDateKey,
          };
        });

        const normalizedHandoverDate = toDateKey(projectRecord.date);
        const printableRows = computedRows
          .filter((row) => row.certDateKey && normalizedHandoverDate && row.certDateKey === normalizedHandoverDate)
          .sort((a, b) => a.jobName.localeCompare(b.jobName, 'en'))
          .map((row, idx) => ({ ...row, index: idx + 1 }));

        if (cancelled) return;
        setProject(projectRecord);
        setRows(printableRows);
        setHandoverDateKey(normalizedHandoverDate);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || 'Failed to load handover print form data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [lookupRate, projectUuid]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.nominal += Number(row.sellingPrice || 0);
        if (row.totalGel != null) {
          acc.gel += Number(row.totalGel);
          acc.gelCount += 1;
        }
        return acc;
      },
      { nominal: 0, gel: 0, gelCount: 0 },
    );
  }, [rows]);

  const cityLabel = resolveCityLabel(project?.department);
  const handoverDateDisplay = formatDateDdMmYyyy(handoverDateKey);
  const handoverDateText = formatGeorgianDate(handoverDateKey, false);
  const contractDateText = formatGeorgianDate(toDateKey(project?.date ?? null), true);
  const currencyCode = String(project?.currency || 'GEL').toUpperCase();

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Loading print form...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold mb-2">Handover Print Form</h1>
        <p className="text-sm text-red-600">{error || 'Project data unavailable.'}</p>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #handover-print-root,
          #handover-print-root * {
            visibility: visible !important;
          }
          #handover-print-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            margin: 0;
            padding: 0;
          }
        }
      `}</style>

      <div className="p-6 print:p-0">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <div>
            <h1 className="text-lg font-semibold">Handover Print Form</h1>
            <p className="text-sm text-muted-foreground">
              {project.project_index} - {project.project_name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
            >
              Print
            </button>
          </div>
        </div>

        <div id="handover-print-root" className="mx-auto max-w-[1100px] bg-white p-8 text-black print:p-6">
          <div className="mb-5 text-center">
            <h2 className="text-xl font-bold">მიღება-ჩაბარების აქტი</h2>
            <p className="mt-1 text-sm">{cityLabel}, {handoverDateDisplay}</p>
          </div>

          <p className="mb-6 whitespace-pre-line text-sm leading-6">
            {`ერთი მხრივ ${project.entity_type || ''} ${project.name || ''} - წარმოდგენილი დირექტორის ${toGenitiveCase(project.director)} სახით (შემდგომში დამკვეთი).
მისამართი: ${project.address_line_1 || ''} ${project.address_line_2 || ''}
საიდენტიფიკაციო კოდი: ${project.identification_number || ''}

მეორე მხრივ ${project.insider_entity_type || ''} ${project.insider_name_field || ''} - წარმოდგენილი დირექტორის ${toGenitiveCase(project.insider_director)} სახით (შემდგომში შემსრულებელი).
მისამართი: ${project.insider_address_line_1 || ''} ${project.insider_address_line_2 || ''}
საიდენტიფიკაციო ნომერი: ${project.insider_identification_number || ''}

${contractDateText ? `${contractDateText} ხელშეკრულების თანახმად` : 'ხელშეკრულების თანახმად'} დამკვეთმა მიიღო, ხოლო შემსრულებელმა ჩააბარა დამკვეთის ობიექტზე მისამართზე ${project.address || ''} ქვემოთ მოცემული ერთეულები:`}
          </p>

          <table className="w-full border-collapse border border-black text-xs">
            <thead>
              <tr>
                <th className="border border-black p-2">#</th>
                <th className="border border-black p-2">Job Name</th>
                <th className="border border-black p-2">Brand</th>
                <th className="border border-black p-2">Factory No</th>
                <th className="border border-black p-2">Weight</th>
                <th className="border border-black p-2">Floors</th>
                <th className="border border-black p-2">Doc. No</th>
                <th className="border border-black p-2 text-right">თანხა ({currencyCode})</th>
                <th className="border border-black p-2 text-right">თანხა (GEL)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.jobName}-${row.factoryNo}-${row.index}`}>
                  <td className="border border-black p-2 text-center">{row.index}</td>
                  <td className="border border-black p-2">{row.jobName || '-'}</td>
                  <td className="border border-black p-2">{row.brandName || '-'}</td>
                  <td className="border border-black p-2">{row.factoryNo || '-'}</td>
                  <td className="border border-black p-2 text-center">
                    {row.weight == null ? '-' : `${row.weight} კგ`}
                  </td>
                  <td className="border border-black p-2 text-center">{row.floors == null ? '-' : row.floors}</td>
                  <td className="border border-black p-2 text-center">{row.liftCertDocNo || '-'}</td>
                  <td className="border border-black p-2 text-right">{formatMoney(row.sellingPrice)}</td>
                  <td className="border border-black p-2 text-right">{formatMoney(row.totalGel)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="border border-black p-3 text-center" colSpan={9}>
                    {handoverDateText
                      ? `No jobs matched handover date ${handoverDateText}.`
                      : 'No jobs matched handover date.'}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="border border-black p-2 text-right" colSpan={7}>Total</td>
                <td className="border border-black p-2 text-right">{formatMoney(totals.nominal)}</td>
                <td className="border border-black p-2 text-right">{totals.gelCount > 0 ? formatMoney(totals.gel) : '-'}</td>
              </tr>
            </tfoot>
          </table>

          <div className="mt-10 grid grid-cols-2 gap-12 text-sm">
            <div>
              <p className="mb-6 font-medium">დამკვეთი</p>
              <p>{project.entity_type || ''} {project.name || ''}</p>
              <p>დირექტორი: {project.director || '-'}</p>
              <p className="mt-8">ხელმოწერა: ____________________</p>
            </div>
            <div>
              <p className="mb-6 font-medium">შემსრულებელი</p>
              <p>{project.insider_entity_type || ''} {project.insider_name_field || ''}</p>
              <p>დირექტორი: {project.insider_director || '-'}</p>
              <p className="mt-8">ხელმოწერა: ____________________</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function HandoversPrintPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading print form...</div>}>
      <HandoversPrintPageContent />
    </Suspense>
  );
}
