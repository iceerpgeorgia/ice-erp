import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
  convertInchesToTwip,
} from 'docx';
import { requireAuth, isAuthError } from '@/lib/auth-guard';
import { prisma, withRetry } from '@/lib/prisma';
import { getJobLiftCertInfo } from '@/lib/attachments';
import { toGenitiveCase } from '@/lib/georgian-genitive';
import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const serverRequire = createRequire(import.meta.url);

type ExportFormat = 'pdf' | 'docx';

type ProjectData = {
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

type JobData = {
  job_uuid: string;
  job_name: string | null;
  factory_no: string | null;
  brand_name: string | null;
  floors: number | null;
  weight: number | null;
  selling_price: number | null;
};

type DistributionData = {
  payment_id: string;
  job_uuid: string;
  amount: number;
  amount_account_curr: number;
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
};

type LiftCertInfo = {
  date: string | null;
  docNo: string | null;
};

type PrintableTotals = { nominal: number; gel: number; gelCount: number };

type PrintableData = {
  project: ProjectData;
  certDate: string;
  rows: PrintableRow[];
  totals: PrintableTotals;
};

type PrintableBaseData = {
  project: ProjectData;
  jobs: JobData[];
  liftInfo: Record<string, LiftCertInfo>;
  paidNominalByJob: Map<string, number>;
  paidGelByJob: Map<string, number>;
  rateByDate: Map<string, number | null>;
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DOCX_CELL_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
  left: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
  right: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
};

const TABLE_COLUMN_WIDTHS = [5, 20, 11, 12, 8, 7, 11, 13, 13];

function sanitizeFilePart(value: string | null | undefined, fallback: string): string {
  const normalized = String(value || '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/[\u0000-\u001F]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/_+/g, '_')
    .slice(0, 120);

  return normalized.length > 0 ? normalized : fallback;
}

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

function toPdfBuffer(doc: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer | Uint8Array) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

function toResponseArrayBuffer(bytes: Buffer | Uint8Array): ArrayBuffer {
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const arrayBuffer = new ArrayBuffer(source.byteLength);
  new Uint8Array(arrayBuffer).set(source);
  return arrayBuffer;
}

function multilineRuns(text: string, size: number, bold = false): TextRun[] {
  const lines = text.split('\n');
  return lines.map((line, idx) => new TextRun({ text: line, size, bold, break: idx > 0 ? 1 : 0 }));
}

function buildDocxCell(
  text: string,
  widthPct: number,
  opts: {
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    bold?: boolean;
    size?: number;
    shaded?: boolean;
    columnSpan?: number;
  } = {},
) {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    borders: DOCX_CELL_BORDERS,
    shading: opts.shaded
      ? {
          type: ShadingType.CLEAR,
          fill: 'EDEDED',
          color: 'auto',
        }
      : undefined,
    columnSpan: opts.columnSpan,
    children: [
      new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            bold: opts.bold,
            size: opts.size ?? 20,
          }),
        ],
      }),
    ],
  });
}

async function getRateForDate(dateKey: string, currencyCode: string | null): Promise<number | null> {
  const normalizedCurrency = currencyCode ? currencyCode.toUpperCase() : null;
  if (!normalizedCurrency) return null;
  if (normalizedCurrency === 'GEL') return 1;

  const rate = await withRetry(() =>
    prisma.nbg_exchange_rates.findFirst({
      where: { date: { lte: new Date(`${dateKey}T00:00:00Z`) } },
      orderBy: { date: 'desc' },
    }),
  );

  if (!rate) return null;
  const key = `${normalizedCurrency.toLowerCase()}_rate` as keyof typeof rate;
  const raw = rate[key];
  const numeric = raw != null ? Number(raw) : null;
  return numeric && Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

async function loadPrintableBaseData(projectUuid: string): Promise<PrintableBaseData> {
  const projects = await withRetry(() =>
    prisma.$queryRawUnsafe<ProjectData[]>(
      `SELECT
         p.project_uuid::text AS project_uuid,
         p.project_index,
         p.project_name,
         p.department,
         p.date::text AS date,
         p.address,
         ca.entity_type,
         ca.name,
         ca.director,
         ca.address_line_1,
         ca.address_line_2,
         ca.identification_number,
         ins.entity_type AS insider_entity_type,
         ins.name AS insider_name_field,
         ins.director AS insider_director,
         ins.address_line_1 AS insider_address_line_1,
         ins.address_line_2 AS insider_address_line_2,
         ins.identification_number AS insider_identification_number,
         curr.code AS currency
       FROM projects p
       LEFT JOIN counteragents ca ON ca.counteragent_uuid = p.counteragent_uuid
       LEFT JOIN counteragents ins ON ins.counteragent_uuid = p.insider_uuid
       LEFT JOIN currencies curr ON curr.uuid = p.currency_uuid
       WHERE p.project_uuid = $1::uuid
       LIMIT 1`,
      projectUuid,
    ),
  );

  const project = projects[0] ?? null;
  if (!project) {
    throw new Error('Project not found');
  }

  const jobs = await withRetry(() =>
    prisma.$queryRawUnsafe<JobData[]>(
      `SELECT
         j.job_uuid::text AS job_uuid,
         j.job_name,
         j.factory_no,
         b.name AS brand_name,
         j.floors,
         j.weight,
         j.selling_price::numeric AS selling_price
       FROM jobs j
       JOIN job_projects jp ON jp.job_uuid = j.job_uuid
       LEFT JOIN brands b ON b.uuid = j.brand_uuid
       WHERE jp.project_uuid = $1::uuid
         AND j.is_active = true
       ORDER BY j.job_name ASC`,
      projectUuid,
    ),
  );

  const jobUuids = jobs.map((j) => j.job_uuid).filter(Boolean);
  const liftInfo = (await getJobLiftCertInfo(jobUuids)) as Record<string, LiftCertInfo>;

  const incomePayments = await withRetry(() =>
    prisma.$queryRawUnsafe<Array<{ payment_id: string }>>(
      `SELECT p.payment_id
       FROM payments p
       LEFT JOIN financial_codes fc ON fc.uuid = p.financial_code_uuid
       WHERE p.project_uuid = $1::uuid
         AND p.is_active = true
         AND COALESCE(fc.is_income, false) = true`,
      projectUuid,
    ),
  );
  const incomePaymentIds = new Set(incomePayments.map((p) => String(p.payment_id)));

  const distributions = await withRetry(() =>
    prisma.$queryRawUnsafe<DistributionData[]>(
      `SELECT
         p.payment_id,
         pj.job_uuid::text AS job_uuid,
         pj.amount::numeric AS amount,
         COALESCE(pj.amount_account_curr, 0)::numeric AS amount_account_curr
       FROM payments_jobs pj
       JOIN payments p ON p.record_uuid = pj.payment_uuid
       WHERE pj.project_uuid = $1::uuid`,
      projectUuid,
    ),
  );

  const paidNominalByJob = new Map<string, number>();
  const paidGelByJob = new Map<string, number>();

  distributions.forEach((dist) => {
    if (!dist.payment_id || !incomePaymentIds.has(String(dist.payment_id))) return;
    const key = String(dist.job_uuid);
    paidNominalByJob.set(key, (paidNominalByJob.get(key) ?? 0) + Number(dist.amount ?? 0));
    paidGelByJob.set(key, (paidGelByJob.get(key) ?? 0) + Number(dist.amount_account_curr ?? 0));
  });

  const rateByDate = new Map<string, number | null>();
  const uniqueCertDates = Array.from(
    new Set(
      Object.values(liftInfo)
        .map((x) => toDateKey(x?.date ?? null))
        .filter((x): x is string => Boolean(x)),
    ),
  );

  await Promise.all(
    uniqueCertDates.map(async (dateKey) => {
      const rate = await getRateForDate(dateKey, project.currency);
      rateByDate.set(dateKey, rate);
    }),
  );

  return {
    project,
    jobs,
    liftInfo,
    paidNominalByJob,
    paidGelByJob,
    rateByDate,
  };
}

function buildPrintableDataForDate(base: PrintableBaseData, certDate: string): PrintableData {
  const { project, jobs, liftInfo, paidNominalByJob, paidGelByJob, rateByDate } = base;

  const normalizedSelectedDate = toDateKey(certDate);
  if (!normalizedSelectedDate) {
    throw new Error('Invalid cert date format. Use YYYY-MM-DD.');
  }

  const rows: PrintableRow[] = jobs
    .map((job) => {
      const sellingPrice = job.selling_price != null ? Number(job.selling_price) : 0;
      const paidNominal = paidNominalByJob.get(String(job.job_uuid)) ?? 0;
      const paidGel = paidGelByJob.get(String(job.job_uuid)) ?? 0;
      const debitNominal = sellingPrice - paidNominal;

      const certDateKey = toDateKey(liftInfo[job.job_uuid]?.date ?? null);
      const rate = certDateKey ? (rateByDate.get(certDateKey) ?? null) : null;
      const debitGel = certDateKey && rate != null ? Number((debitNominal * rate).toFixed(2)) : null;
      const totalGel = certDateKey && debitGel != null ? Number((paidGel + debitGel).toFixed(2)) : null;

      return {
        index: 0,
        jobName: String(job.job_name || ''),
        brandName: String(job.brand_name || ''),
        factoryNo: String(job.factory_no || ''),
        weight: job.weight == null ? null : Number(job.weight),
        floors: job.floors == null ? null : Number(job.floors),
        liftCertDocNo: liftInfo[job.job_uuid]?.docNo ?? null,
        sellingPrice,
        totalGel,
        certDateKey,
      } as PrintableRow & { certDateKey: string | null };
    })
    .filter((row: PrintableRow & { certDateKey: string | null }) => row.certDateKey === normalizedSelectedDate)
    .sort((a, b) => a.jobName.localeCompare(b.jobName, 'en'))
    .map((row, idx) => {
      const { certDateKey: _ignored, ...rest } = row as PrintableRow & { certDateKey?: string | null };
      return { ...rest, index: idx + 1 } as PrintableRow;
    });

  const totals = rows.reduce(
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

  return {
    project,
    certDate: normalizedSelectedDate,
    rows,
    totals,
  };
}

async function buildDocxPrintable(data: PrintableData): Promise<Buffer> {
  const { project, certDate, rows, totals } = data;
  const cityLabel = resolveCityLabel(project.department);
  const certDateDisplay = formatDateDdMmYyyy(certDate);
  const contractDateText = formatGeorgianDate(toDateKey(project.date), true);
  const currencyCode = String(project.currency || 'GEL').toUpperCase();

  const intro =
    `ერთი მხრივ ${project.entity_type || ''} ${project.name || ''} - წარმოდგენილი დირექტორის ${toGenitiveCase(project.director)} სახით (შემდგომში დამკვეთი).\n` +
    `მისამართი: ${project.address_line_1 || ''} ${project.address_line_2 || ''}\n` +
    `საიდენტიფიკაციო კოდი: ${project.identification_number || ''}\n\n` +
    `მეორე მხრივ ${project.insider_entity_type || ''} ${project.insider_name_field || ''} - წარმოდგენილი დირექტორის ${toGenitiveCase(project.insider_director)} სახით (შემდგომში შემსრულებელი).\n` +
    `მისამართი: ${project.insider_address_line_1 || ''} ${project.insider_address_line_2 || ''}\n` +
    `საიდენტიფიკაციო ნომერი: ${project.insider_identification_number || ''}\n\n` +
    `${contractDateText ? `${contractDateText} ხელშეკრულების თანახმად` : 'ხელშეკრულების თანახმად'} დამკვეთმა მიიღო, ხოლო შემსრულებელმა ჩააბარა დამკვეთის ობიექტზე მისამართზე ${project.address || ''} ქვემოთ მოცემული ერთეულები:`;

  const headers = [
    '#',
    'Job Name',
    'Brand',
    'Factory No',
    'Weight',
    'Floors',
    'Doc. No',
    `თანხა (${currencyCode})`,
    'თანხა (GEL)',
  ];

  const tableRows: TableRow[] = [
    new TableRow({
      children: headers.map((header, idx) =>
        buildDocxCell(header, TABLE_COLUMN_WIDTHS[idx], {
          align: AlignmentType.CENTER,
          bold: true,
          size: 18,
          shaded: true,
        }),
      ),
    }),
  ];

  if (rows.length === 0) {
    tableRows.push(
      new TableRow({
        children: [
          buildDocxCell('ამ სერტიფიკატის თარიღისთვის მონაცემები არ მოიძებნა.', 100, {
            align: AlignmentType.CENTER,
            size: 20,
            columnSpan: 9,
          }),
        ],
      }),
    );
  } else {
    rows.forEach((row) => {
      const values = [
        String(row.index),
        row.jobName || '-',
        row.brandName || '-',
        row.factoryNo || '-',
        row.weight == null ? '-' : `${row.weight} კგ`,
        row.floors == null ? '-' : String(row.floors),
        row.liftCertDocNo || '-',
        formatMoney(row.sellingPrice),
        formatMoney(row.totalGel),
      ];

      tableRows.push(
        new TableRow({
          children: values.map((value, idx) =>
            buildDocxCell(value, TABLE_COLUMN_WIDTHS[idx], {
              align:
                idx === 0 || idx === 4 || idx === 5 || idx === 6
                  ? AlignmentType.CENTER
                  : idx >= 7
                    ? AlignmentType.RIGHT
                    : AlignmentType.LEFT,
              size: 18,
            }),
          ),
        }),
      );
    });

    tableRows.push(
      new TableRow({
        children: [
          buildDocxCell('Total', 74, {
            align: AlignmentType.RIGHT,
            bold: true,
            size: 19,
            shaded: true,
            columnSpan: 7,
          }),
          buildDocxCell(formatMoney(totals.nominal), TABLE_COLUMN_WIDTHS[7], {
            align: AlignmentType.RIGHT,
            bold: true,
            size: 19,
            shaded: true,
          }),
          buildDocxCell(totals.gelCount > 0 ? formatMoney(totals.gel) : '-', TABLE_COLUMN_WIDTHS[8], {
            align: AlignmentType.RIGHT,
            bold: true,
            size: 19,
            shaded: true,
          }),
        ],
      }),
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.PORTRAIT,
              width: convertInchesToTwip(8.27),
              height: convertInchesToTwip(11.69),
            },
            margin: {
              top: convertInchesToTwip(0.8),
              bottom: convertInchesToTwip(0.8),
              left: convertInchesToTwip(0.7),
              right: convertInchesToTwip(0.7),
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun('Page '),
                  new TextRun({ children: [PageNumber.CURRENT] }),
                  new TextRun(' / '),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES] }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [new TextRun({ text: 'მიღება-ჩაბარების აქტი', bold: true, size: 36 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 220 },
            children: [new TextRun({ text: `${cityLabel}, ${certDateDisplay}`, size: 22, bold: true })],
          }),
          new Paragraph({
            spacing: { after: 240 },
            children: multilineRuns(intro, 21),
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            rows: tableRows,
          }),
          new Paragraph({ text: '', spacing: { after: 380 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: DOCX_CELL_BORDERS,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'დამკვეთი', bold: true, size: 22 })] }),
                      new Paragraph({ text: `${project.entity_type || ''} ${project.name || ''}` }),
                      new Paragraph({ text: `დირექტორი: ${project.director || '-'}` }),
                      new Paragraph({ text: 'ხელმოწერა: ____________________' }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: DOCX_CELL_BORDERS,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'შემსრულებელი', bold: true, size: 22 })] }),
                      new Paragraph({ text: `${project.insider_entity_type || ''} ${project.insider_name_field || ''}` }),
                      new Paragraph({ text: `დირექტორი: ${project.insider_director || '-'}` }),
                      new Paragraph({ text: 'ხელმოწერა: ____________________' }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

async function buildPdfPrintable(data: PrintableData): Promise<Buffer> {
  const { project, certDate, rows, totals } = data;
  const cityLabel = resolveCityLabel(project.department);
  const certDateDisplay = formatDateDdMmYyyy(certDate);
  const contractDateText = formatGeorgianDate(toDateKey(project.date), true);
  const currencyCode = String(project.currency || 'GEL').toUpperCase();

  const intro =
    `ერთი მხრივ ${project.entity_type || ''} ${project.name || ''} - წარმოდგენილი დირექტორის ${toGenitiveCase(project.director)} სახით (შემდგომში დამკვეთი).\n` +
    `მისამართი: ${project.address_line_1 || ''} ${project.address_line_2 || ''}\n` +
    `საიდენტიფიკაციო კოდი: ${project.identification_number || ''}\n\n` +
    `მეორე მხრივ ${project.insider_entity_type || ''} ${project.insider_name_field || ''} - წარმოდგენილი დირექტორის ${toGenitiveCase(project.insider_director)} სახით (შემდგომში შემსრულებელი).\n` +
    `მისამართი: ${project.insider_address_line_1 || ''} ${project.insider_address_line_2 || ''}\n` +
    `საიდენტიფიკაციო ნომერი: ${project.insider_identification_number || ''}\n\n` +
    `${contractDateText ? `${contractDateText} ხელშეკრულების თანახმად` : 'ხელშეკრულების თანახმად'} დამკვეთმა მიიღო, ხოლო შემსრულებელმა ჩააბარა დამკვეთის ობიექტზე მისამართზე ${project.address || ''} ქვემოთ მოცემული ერთეულები:`;

  const PDFDocument = serverRequire('pdfkit');

  const fontPath = path.join(
    process.cwd(),
    'app',
    'api',
    'export',
    'handover-print-form',
    'fonts',
    'noto-sans-georgian-georgian-400-normal.woff',
  );

  const hasGeoFont = fs.existsSync(fontPath);
  const geoFontBuffer = hasGeoFont ? fs.readFileSync(fontPath) : null;
  const latinFontPath = path.join(
    process.cwd(),
    'app',
    'api',
    'export',
    'handover-print-form',
    'fonts',
    'noto-sans-georgian-latin-400-normal.woff',
  );
  const hasLatinFont = fs.existsSync(latinFontPath);
  const latinFontBuffer = hasLatinFont ? fs.readFileSync(latinFontPath) : null;
  const activeFont = hasGeoFont ? 'Geo' : 'Helvetica';
  const numberFont = hasLatinFont ? 'Latin' : activeFont;

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'portrait',
    margins: { top: 42, right: 38, bottom: 42, left: 38 },
    bufferPages: true,
    font: hasGeoFont ? geoFontBuffer : 'Helvetica',
  });

  if (hasGeoFont && geoFontBuffer) {
    doc.registerFont('Geo', geoFontBuffer);
  }
  if (hasLatinFont && latinFontBuffer) {
    doc.registerFont('Latin', latinFontBuffer);
  }
  doc.font(activeFont);

  doc.fontSize(16).text('მიღება-ჩაბარების აქტი', { align: 'center' });
  doc.moveDown(0.2);
  doc.fontSize(11).text(`${cityLabel}, ${certDateDisplay}`, { align: 'center' });
  doc.moveDown(1);

  doc.fontSize(10.5).text(intro, {
    align: 'left',
    lineGap: 2,
  });
  doc.moveDown(1);

  const colRatios = [0.05, 0.17, 0.12, 0.12, 0.08, 0.07, 0.12, 0.14, 0.13];
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidths = colRatios.map((r) => Math.floor(tableWidth * r));
  const tableBottomPadding = 40;
  const minRowHeight = 20;

  const headers = [
    '#',
    'Job Name',
    'Brand',
    'Factory No',
    'Weight',
    'Floors',
    'Doc. No',
    `თანხა (${currencyCode})`,
    'თანხა (GEL)',
  ];

  let y = doc.y;
  const xStart = doc.page.margins.left;
  const textAlignByColumn: Array<'left' | 'center' | 'right'> = [
    'center',
    'left',
    'left',
    'left',
    'center',
    'center',
    'center',
    'right',
    'right',
  ];
  const shouldUseNumberFont = (index: number) => index === 0 || index === 4 || index === 5 || index === 7 || index === 8;

  const getContentBottom = () => doc.page.height - doc.page.margins.bottom - tableBottomPadding;

  const measureRowHeight = (cells: string[], opts: { isHeader?: boolean; isTotal?: boolean }) => {
    const fontSize = opts.isHeader || opts.isTotal ? 9.5 : 9;
    doc.font(activeFont).fontSize(fontSize);
    let maxHeight = minRowHeight;
    cells.forEach((cell, index) => {
      doc.font(shouldUseNumberFont(index) ? numberFont : activeFont).fontSize(fontSize);
      const width = Math.max((colWidths[index] ?? 80) - 8, 16);
      const measured = doc.heightOfString(cell, {
        width,
        align: textAlignByColumn[index],
      });
      maxHeight = Math.max(maxHeight, measured + 10);
    });
    return maxHeight;
  };

  const drawRow = (
    cells: string[],
    opts: { isHeader?: boolean; isTotal?: boolean; rowHeight: number },
  ) => {
    let x = xStart;
    cells.forEach((cell, index) => {
      const width = colWidths[index] ?? 80;
      if (opts.isHeader || opts.isTotal) {
        doc.save();
        doc.rect(x, y, width, opts.rowHeight).fillAndStroke('#EFEFEF', '#000000');
        doc.restore();
      } else {
        doc.rect(x, y, width, opts.rowHeight).stroke();
      }

      doc
        .font(shouldUseNumberFont(index) ? numberFont : activeFont)
        .fontSize(opts.isHeader || opts.isTotal ? 9.5 : 9)
        .fillColor('#000000');
      doc.text(cell, x + 4, y + 4, {
        width: width - 8,
        height: opts.rowHeight - 8,
        align: textAlignByColumn[index],
      });
      x += width;
    });
    y += opts.rowHeight;
  };

  const addPageAndHeader = () => {
    doc.addPage({ size: 'A4', layout: 'portrait', margins: { top: 42, right: 38, bottom: 42, left: 38 } });
    y = doc.page.margins.top;
    const headerHeight = measureRowHeight(headers, { isHeader: true });
    drawRow(headers, { isHeader: true, rowHeight: headerHeight });
  };

  const headerHeight = measureRowHeight(headers, { isHeader: true });
  drawRow(headers, { isHeader: true, rowHeight: headerHeight });

  if (rows.length === 0) {
    const noDataRow = ['', 'ამ სერტიფიკატის თარიღისთვის მონაცემები არ მოიძებნა.', '', '', '', '', '', '', ''];
    const noDataHeight = measureRowHeight(noDataRow, {});
    if (y + noDataHeight > getContentBottom()) {
      addPageAndHeader();
    }
    drawRow(noDataRow, { rowHeight: noDataHeight });
  } else {
    rows.forEach((row) => {
      const cells = [
        String(row.index),
        row.jobName || '-',
        row.brandName || '-',
        row.factoryNo || '-',
        row.weight == null ? '-' : `${row.weight} კგ`,
        row.floors == null ? '-' : String(row.floors),
        row.liftCertDocNo || '-',
        formatMoney(row.sellingPrice),
        formatMoney(row.totalGel),
      ];

      const rowHeight = measureRowHeight(cells, {});
      if (y + rowHeight > getContentBottom()) {
        addPageAndHeader();
      }

      drawRow(cells, { rowHeight });
    });

    const totalRow = [
      '',
      '',
      '',
      '',
      '',
      '',
      'Total',
      formatMoney(totals.nominal),
      totals.gelCount > 0 ? formatMoney(totals.gel) : '-',
    ];

    const totalHeight = measureRowHeight(totalRow, { isTotal: true });
    if (y + totalHeight > getContentBottom()) {
      addPageAndHeader();
    }
    drawRow(totalRow, { isTotal: true, rowHeight: totalHeight });
  }

  y += 22;
  if (y > doc.page.height - 150) {
    doc.addPage({ size: 'A4', layout: 'portrait', margins: { top: 42, right: 38, bottom: 42, left: 38 } });
    y = doc.page.margins.top;
  }

  doc.fontSize(10.5);
  doc.text('დამკვეთი', xStart, y);
  doc.text('შემსრულებელი', xStart + Math.floor(tableWidth / 2), y);
  y += 18;
  doc.text(`${project.entity_type || ''} ${project.name || ''}`, xStart, y, { width: Math.floor(tableWidth / 2) - 8 });
  doc.text(`${project.insider_entity_type || ''} ${project.insider_name_field || ''}`, xStart + Math.floor(tableWidth / 2), y, {
    width: Math.floor(tableWidth / 2) - 8,
  });
  y += 15;
  doc.text(`დირექტორი: ${project.director || '-'}`, xStart, y, { width: Math.floor(tableWidth / 2) - 8 });
  doc.text(`დირექტორი: ${project.insider_director || '-'}`, xStart + Math.floor(tableWidth / 2), y, {
    width: Math.floor(tableWidth / 2) - 8,
  });
  y += 28;
  doc.text('ხელმოწერა: ____________________', xStart, y);
  doc.text('ხელმოწერა: ____________________', xStart + Math.floor(tableWidth / 2), y);

  const pageRange = doc.bufferedPageRange();
  for (let i = 0; i < pageRange.count; i += 1) {
    doc.switchToPage(i);
    const pageLabel = `Page ${i + 1} / ${pageRange.count}`;
    doc.font(numberFont).fontSize(9);
    doc.text(pageLabel, 0, doc.page.height - 24, {
      align: 'center',
      width: doc.page.width,
    });
  }

  return toPdfBuffer(doc);
}

function buildContentDisposition(fileName: string) {
  const fileNameAscii = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}; filename="${fileNameAscii}"`;
}

function buildPerDateFileName(projectToken: string, certDate: string, today: string, format: ExportFormat) {
  const dateToken = sanitizeFilePart(certDate, 'cert-date');
  return `handover-print-${projectToken}-${dateToken}-${today}.${format}`;
}

function buildZipFileName(projectToken: string, today: string, format: ExportFormat) {
  return `handover-print-${projectToken}-${today}-${format}.zip`;
}

async function buildPrintableBuffer(data: PrintableData, format: ExportFormat): Promise<Buffer> {
  if (format === 'docx') {
    return buildDocxPrintable(data);
  }
  return buildPdfPrintable(data);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  try {
    const body = await req.json().catch(() => ({}));
    const projectUuid = String(body?.projectUuid || '').trim();
    const certDate = String(body?.certDate || '').trim();
    const certDates = Array.isArray(body?.certDates)
      ? body.certDates.map((x: unknown) => String(x || '').trim()).filter(Boolean)
      : [];
    const zipRequested = Boolean(body?.zip);
    const format = String(body?.format || '').toLowerCase() as ExportFormat;

    const requestedDates: string[] = certDates.length > 0 ? certDates : (certDate ? [certDate] : []);
    const uniqueDates: string[] = Array.from(new Set(requestedDates)).sort((a, b) => a.localeCompare(b));

    if (!projectUuid || !UUID_REGEX.test(projectUuid)) {
      return NextResponse.json({ error: 'Valid projectUuid is required' }, { status: 400 });
    }
    if (uniqueDates.length === 0) {
      return NextResponse.json({ error: 'At least one cert date is required' }, { status: 400 });
    }
    if (uniqueDates.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d))) {
      return NextResponse.json({ error: 'All certDates must use YYYY-MM-DD format' }, { status: 400 });
    }
    if (format !== 'pdf' && format !== 'docx') {
      return NextResponse.json({ error: 'format must be "pdf" or "docx"' }, { status: 400 });
    }

    const baseData = await loadPrintableBaseData(projectUuid);

    const today = new Date().toISOString().split('T')[0];
    const projectToken = sanitizeFilePart(baseData.project.project_index || baseData.project.project_name, 'project');
    const shouldZip = zipRequested || uniqueDates.length > 1;

    if (shouldZip) {
      const zip = new JSZip();

      for (const dateKey of uniqueDates) {
        const data = buildPrintableDataForDate(baseData, dateKey);
        const fileBuffer = await buildPrintableBuffer(data, format);
        const fileName = buildPerDateFileName(projectToken, dateKey, today, format);
        zip.file(fileName, fileBuffer);
      }

      const zipBytes = await zip.generateAsync({
        type: 'uint8array',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const zipFileName = buildZipFileName(projectToken, today, format);
      const responseBody = toResponseArrayBuffer(zipBytes);

      return new NextResponse(responseBody, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': buildContentDisposition(zipFileName),
          'Cache-Control': 'no-store',
        },
      });
    }

    const selectedDate = uniqueDates[0];
    const data = buildPrintableDataForDate(baseData, selectedDate);
    const fileName = buildPerDateFileName(projectToken, selectedDate, today, format);
    const responseBody = toResponseArrayBuffer(await buildPrintableBuffer(data, format));

    if (format === 'docx') {
      return new NextResponse(responseBody, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': buildContentDisposition(fileName),
          'Cache-Control': 'no-store',
        },
      });
    }

    return new NextResponse(responseBody, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': buildContentDisposition(fileName),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('POST /api/export/handover-print-form error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate printable handover form' },
      { status: 500 },
    );
  }
}
