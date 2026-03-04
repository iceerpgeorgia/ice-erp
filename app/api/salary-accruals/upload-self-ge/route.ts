import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

const normalizeHeader = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[_-]+/g, ' ');

const normalizeId = (value: unknown) => {
  const digits = String(value ?? '')
    .replace(/'/g, '')
    .replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.length >= 11) return digits;
  return digits.padStart(11, '0');
};

const parseAmount = (value: unknown) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = String(value).replace(/\s+/g, '').replace(/,/g, '.');
  const parsed = Number(normalized);
  if (Number.isFinite(parsed)) return parsed;
  const fallback = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!fallback) return 0;
  const fallbackParsed = Number(fallback[0]);
  return Number.isFinite(fallbackParsed) ? fallbackParsed : 0;
};

const parseMonth = (value: string) => {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}-01T00:00:00`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00`);
  }
  return new Date(trimmed);
};

type ParsedSelfGeEmployee = {
  personal_id: string;
  employee_name: string;
  net_sum: number;
  iban: string | null;
};

const findHeaderIndex = (rows: unknown[][]) =>
  rows.findIndex((row) => row.map(normalizeHeader).includes(normalizeHeader('პირადი ნომერი')));

const findColumnIndex = (
  header: unknown[],
  header2: unknown[] | undefined,
  aliases: string[],
) => {
  const normalizedHeader = header.map(normalizeHeader);
  const normalizedHeader2 = (header2 || []).map(normalizeHeader);

  for (const alias of aliases) {
    const target = normalizeHeader(alias);

    const directIndex = normalizedHeader.indexOf(target);
    if (directIndex >= 0) return directIndex;

    const combinedIndex = normalizedHeader.findIndex((h, idx) => {
      const combined = normalizeHeader(`${h} ${normalizedHeader2[idx] || ''}`);
      return combined === target;
    });
    if (combinedIndex >= 0) return combinedIndex;
  }

  return -1;
};

const parseSelfGeRows = (rows: unknown[][]) => {
  const headerIndex = findHeaderIndex(rows);
  if (headerIndex === -1) {
    throw new Error('Missing required header: პირადი ნომერი');
  }

  const header = rows[headerIndex] || [];
  const maybeSubHeader = rows[headerIndex + 1] || [];

  const idIndex = findColumnIndex(header, maybeSubHeader, ['პირადი ნომერი']);
  const nameIndex = findColumnIndex(header, maybeSubHeader, ['თანამშრომელი']);
  const ibanIndex = findColumnIndex(header, maybeSubHeader, ['ანგარიშის ნომერი', 'IBAN']);
  const salaryIndex = findColumnIndex(header, maybeSubHeader, ['ხელფასი']);
  const earnedSalaryAmountIndex = header.findIndex((cell, idx) => {
    const parent = normalizeHeader(cell);
    const child = normalizeHeader(maybeSubHeader[idx]);
    return parent === normalizeHeader('გამომუშავებული ხელფასი') && child === normalizeHeader('თანხა');
  });

  const netIndex =
    earnedSalaryAmountIndex >= 0
      ? earnedSalaryAmountIndex
      : findColumnIndex(header, maybeSubHeader, [
          'გამომუშავებული ხელფასი თანხა',
          'თანხა',
          'net sum',
          'ხელზე',
        ]);

  if (idIndex < 0 || netIndex < 0) {
    throw new Error('Missing required columns: პირადი ნომერი and earned salary თანხა (I column)');
  }

  const startRow = headerIndex + 1;
  const aggregated = new Map<string, ParsedSelfGeEmployee>();

  for (let i = startRow; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const personalId = normalizeId(row[idIndex]);
    if (!personalId) continue;

    const employeeName = String(row[nameIndex] ?? '').trim();
    const rawIban = ibanIndex >= 0 ? String(row[ibanIndex] ?? '').trim() : '';
    const iban = rawIban || null;
    // Net sum = ხელფასი * 80% (salary * 0.8)
    // ხელფასი may contain comma-separated values like "2000,5000" — use the rightmost value
    const rawSalary = salaryIndex >= 0 ? row[salaryIndex] : undefined;
    let salaryAmount = 0;
    if (rawSalary !== null && rawSalary !== undefined && rawSalary !== '') {
      const salaryStr = String(rawSalary).trim();
      const parts = salaryStr.split(',').map((p) => p.trim()).filter(Boolean);
      if (parts.length > 1 && parts.every((p) => /^\d+(?:\.\d+)?$/.test(p))) {
        // Multiple comma-separated numbers like "2000,5000" → use rightmost
        salaryAmount = parseAmount(parts[parts.length - 1]);
      } else {
        salaryAmount = parseAmount(rawSalary);
      }
    }
    const netSum = salaryAmount > 0 ? round2(salaryAmount * 0.8) : parseAmount(row[netIndex]);

    const existing = aggregated.get(personalId);
    if (existing) {
      existing.net_sum += netSum;
      if (!existing.employee_name && employeeName) {
        existing.employee_name = employeeName;
      }
      if (!existing.iban && iban) {
        existing.iban = iban;
      }
      continue;
    }

    aggregated.set(personalId, {
      personal_id: personalId,
      employee_name: employeeName,
      net_sum: netSum,
      iban,
    });
  }

  return Array.from(aggregated.values());
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const handlePreview = async (formData: FormData) => {
  const file = formData.get('file');
  const month = formData.get('month');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing XLS/XLSX file' }, { status: 400 });
  }
  if (typeof month !== 'string' || !month.trim()) {
    return NextResponse.json({ error: 'Missing month' }, { status: 400 });
  }

  const monthDate = parseMonth(month);
  if (Number.isNaN(monthDate.getTime())) {
    return NextResponse.json({ error: 'Invalid month format' }, { status: 400 });
  }

  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return NextResponse.json({ error: 'XLS has no sheets' }, { status: 400 });
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as unknown[][];
  const selfGeRows = parseSelfGeRows(rows);

  const fileIdSet = new Set(selfGeRows.map((item) => item.personal_id));

  const allCounteragents = await prisma.counteragents.findMany({
    where: { identification_number: { not: null } },
    select: {
      counteragent_uuid: true,
      counteragent: true,
      name: true,
      identification_number: true,
      is_emploee: true,
    },
  });

  const counteragentById = new Map<string, {
    counteragent_uuid: string;
    counteragent_name: string | null;
    is_emploee: boolean;
  }>();
  for (const item of allCounteragents) {
    const personalId = normalizeId(item.identification_number);
    if (!personalId) continue;
    counteragentById.set(personalId, {
      counteragent_uuid: item.counteragent_uuid,
      counteragent_name: item.counteragent || item.name || null,
      is_emploee: Boolean(item.is_emploee),
    });
  }

  const salaryRows = await prisma.$queryRaw<any[]>`
    SELECT
      sa.id,
      sa.counteragent_uuid,
      sa.net_sum,
      sa.salary_month,
      c.identification_number,
      c.counteragent as counteragent_name,
      c.is_emploee
    FROM salary_accruals sa
    LEFT JOIN counteragents c ON sa.counteragent_uuid = c.counteragent_uuid
    WHERE sa.salary_month >= ${monthStart} AND sa.salary_month < ${monthEnd}
  `;

  const salaryById = new Map<string, {
    salary_net_sum: number;
    rows: Array<{
      accrual_id: string;
      counteragent_uuid: string;
      counteragent_name: string | null;
      net_sum: number;
    }>;
  }>();

  for (const row of salaryRows) {
    const personalId = normalizeId(row.identification_number);
    if (!personalId) continue;
    const netSum = row.net_sum ? Number(row.net_sum) : 0;
    if (!salaryById.has(personalId)) {
      salaryById.set(personalId, { salary_net_sum: 0, rows: [] });
    }
    const bucket = salaryById.get(personalId)!;
    bucket.salary_net_sum += netSum;
    bucket.rows.push({
      accrual_id: String(row.id),
      counteragent_uuid: String(row.counteragent_uuid),
      counteragent_name: row.counteragent_name || null,
      net_sum: netSum,
    });
  }

  const missingCounteragents: any[] = [];
  const notEmployeeCounteragents: any[] = [];
  const missingInSalary: any[] = [];
  const netDifferences: any[] = [];

  let totalSelfGeNet = 0;
  let totalSalaryNetForMatched = 0;

  for (const item of selfGeRows) {
    const counteragent = counteragentById.get(item.personal_id);
    const salary = salaryById.get(item.personal_id);
    const salaryNet = salary ? salary.salary_net_sum : 0;

    totalSelfGeNet += item.net_sum;
    totalSalaryNetForMatched += salaryNet;

    if (!counteragent) {
      missingCounteragents.push({
        personal_id: item.personal_id,
        employee_name: item.employee_name,
        self_ge_net_sum: round2(item.net_sum),
        iban: item.iban,
      });
    } else if (!counteragent.is_emploee) {
      notEmployeeCounteragents.push({
        personal_id: item.personal_id,
        employee_name: item.employee_name,
        counteragent_uuid: counteragent.counteragent_uuid,
        counteragent_name: counteragent.counteragent_name,
        self_ge_net_sum: round2(item.net_sum),
        iban: item.iban,
      });
    }

    if (!salary) {
      missingInSalary.push({
        personal_id: item.personal_id,
        employee_name: item.employee_name,
        counteragent_uuid: counteragent?.counteragent_uuid || null,
        counteragent_name: counteragent?.counteragent_name || null,
        self_ge_net_sum: round2(item.net_sum),
        salary_net_sum: 0,
        net_difference: round2(item.net_sum),
        iban: item.iban,
      });
      continue;
    }

    const diff = round2(item.net_sum - salaryNet);
    if (Math.abs(diff) > 0.009) {
      netDifferences.push({
        personal_id: item.personal_id,
        employee_name: item.employee_name,
        counteragent_uuid: counteragent?.counteragent_uuid || salary.rows[0]?.counteragent_uuid || null,
        counteragent_name:
          counteragent?.counteragent_name ||
          salary.rows[0]?.counteragent_name ||
          null,
        self_ge_net_sum: round2(item.net_sum),
        salary_net_sum: round2(salaryNet),
        net_difference: diff,
      });
    }
  }

  const missingInSelfGe: any[] = [];
  for (const [personalId, salary] of salaryById.entries()) {
    if (fileIdSet.has(personalId)) continue;
    for (const row of salary.rows) {
      missingInSelfGe.push({
        accrual_id: row.accrual_id,
        personal_id: personalId,
        counteragent_uuid: row.counteragent_uuid,
        counteragent_name: row.counteragent_name,
        salary_net_sum: round2(row.net_sum),
      });
    }
  }

  const summary = {
    month: monthStart.toISOString().slice(0, 10),
    self_ge_employee_count: selfGeRows.length,
    salary_employee_count: salaryById.size,
    missing_counteragents_count: missingCounteragents.length,
    not_employee_counteragents_count: notEmployeeCounteragents.length,
    missing_in_salary_count: missingInSalary.length,
    missing_in_self_ge_count: missingInSelfGe.length,
    net_differences_count: netDifferences.length,
    total_self_ge_net_sum: round2(totalSelfGeNet),
    total_salary_net_sum_for_self_ge_ids: round2(totalSalaryNetForMatched),
    total_net_difference: round2(totalSelfGeNet - totalSalaryNetForMatched),
  };

  return NextResponse.json({
    summary,
    missing_counteragents: missingCounteragents,
    not_employee_counteragents: notEmployeeCounteragents,
    missing_in_salary: missingInSalary,
    missing_in_self_ge: missingInSelfGe,
    net_differences: netDifferences,
  });
};

const handleCreateCounteragents = async (body: any) => {
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  if (rows.length === 0) {
    return NextResponse.json({ created: 0, skipped: 0, errors: [] });
  }

  const existingCounteragents = await prisma.counteragents.findMany({
    where: { identification_number: { not: null } },
    select: { identification_number: true },
  });
  const existingNormalizedIds = new Set(
    existingCounteragents
      .map((item) => normalizeId(item.identification_number))
      .filter(Boolean),
  );

  let created = 0;
  let skipped = 0;
  const errors: Array<{ personal_id: string; error: string }> = [];

  for (const row of rows) {
    const personalId = normalizeId(row.personal_id);
    const employeeName = String(row.employee_name || '').trim();
    if (!personalId) {
      skipped += 1;
      continue;
    }

    if (existingNormalizedIds.has(personalId)) {
      skipped += 1;
      continue;
    }

    const rowIban = row.iban ? String(row.iban).trim() : null;

    try {
      await prisma.counteragents.create({
        data: {
          counteragent_uuid: crypto.randomUUID(),
          name: employeeName || personalId,
          counteragent: employeeName || personalId,
          identification_number: personalId,
          iban: rowIban || null,
          is_emploee: true,
          was_emploee: true,
          is_active: true,
          updated_at: new Date(),
        },
      });
      created += 1;
      existingNormalizedIds.add(personalId);
    } catch (error: any) {
      errors.push({ personal_id: personalId, error: error?.message || 'Create failed' });
    }
  }

  return NextResponse.json({ created, skipped, errors });
};

const handleCreateSingleCounteragent = async (body: any) => {
  const personalId = normalizeId(body?.personal_id);
  const employeeName = String(body?.employee_name || '').trim();
  const iban = body?.iban ? String(body.iban).trim() : null;

  if (!personalId) {
    return NextResponse.json({ error: 'Missing personal_id' }, { status: 400 });
  }

  const existing = await prisma.counteragents.findFirst({
    where: { identification_number: personalId },
    select: { counteragent_uuid: true },
  });
  if (existing) {
    return NextResponse.json({ error: 'Counteragent already exists', counteragent_uuid: existing.counteragent_uuid }, { status: 409 });
  }

  const created = await prisma.counteragents.create({
    data: {
      counteragent_uuid: crypto.randomUUID(),
      name: employeeName || personalId,
      counteragent: employeeName || personalId,
      identification_number: personalId,
      iban: iban || null,
      is_emploee: true,
      was_emploee: true,
      is_active: true,
      updated_at: new Date(),
    },
  });

  return NextResponse.json({ created: true, counteragent_uuid: created.counteragent_uuid });
};

const handleAddToSalary = async (body: any) => {
  const counteragentUuid = body?.counteragent_uuid;
  const financialCodeUuid = body?.financial_code_uuid;
  const month = body?.month;
  const netSum = body?.net_sum;
  const iban = body?.iban ? String(body.iban).trim() : null;

  if (!counteragentUuid || !month || netSum === undefined || !financialCodeUuid) {
    return NextResponse.json({ error: 'Missing required fields: counteragent_uuid, financial_code_uuid, month, net_sum' }, { status: 400 });
  }

  // Look up the counteragent and potentially update IBAN
  const counteragent = await prisma.counteragents.findUnique({
    where: { counteragent_uuid: counteragentUuid },
    select: { counteragent_uuid: true, iban: true },
  });

  if (!counteragent) {
    return NextResponse.json({ error: 'Counteragent not found' }, { status: 404 });
  }

  // Update IBAN if self.ge has one and it differs
  if (iban && iban !== counteragent.iban) {
    await prisma.counteragents.update({
      where: { counteragent_uuid: counteragentUuid },
      data: { iban, updated_at: new Date() },
    });
  }

  // Find default currency for salary
  const defaultCurrency = await prisma.currencies.findFirst({
    where: { code: { equals: 'GEL', mode: 'insensitive' } },
    select: { uuid: true },
  });
  const currencyUuid = defaultCurrency?.uuid ||
    (await prisma.currencies.findFirst({ orderBy: { id: 'asc' }, select: { uuid: true } }))?.uuid;

  if (!currencyUuid) {
    return NextResponse.json({ error: 'No currencies found' }, { status: 500 });
  }

  const monthDate = parseMonth(month);

  const accrual = await prisma.salary_accruals.create({
    data: {
      counteragent_uuid: counteragentUuid,
      financial_code_uuid: financialCodeUuid,
      nominal_currency_uuid: currencyUuid,
      salary_month: monthDate,
      net_sum: netSum,
      payment_id: '',
      created_by: 'self.ge',
      updated_by: 'self.ge',
      created_at: new Date(),
      updated_at: new Date(),
    },
  });

  return NextResponse.json({ created: true, accrual_id: accrual.id?.toString() });
};

const handleMarkEmployees = async (body: any) => {
  const ids = Array.isArray(body?.personal_ids) ? body.personal_ids.map((item: unknown) => normalizeId(item)).filter(Boolean) : [];
  if (ids.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  const allCounteragents = await prisma.counteragents.findMany({
    where: { identification_number: { not: null } },
    select: { counteragent_uuid: true, identification_number: true },
  });
  const targetIds = new Set(ids);
  const uuidsToUpdate = allCounteragents
    .filter((item) => targetIds.has(normalizeId(item.identification_number)))
    .map((item) => item.counteragent_uuid);

  if (uuidsToUpdate.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  const result = await prisma.counteragents.updateMany({
    where: {
      counteragent_uuid: { in: uuidsToUpdate },
    },
    data: {
      is_emploee: true,
      was_emploee: true,
      updated_at: new Date(),
    },
  });

  return NextResponse.json({ updated: result.count });
};

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      const action = String(body?.action || '');

      if (action === 'create-counteragents') {
        return handleCreateCounteragents(body);
      }
      if (action === 'create-single-counteragent') {
        return handleCreateSingleCounteragent(body);
      }
      if (action === 'add-to-salary') {
        return handleAddToSalary(body);
      }
      if (action === 'mark-employees') {
        return handleMarkEmployees(body);
      }

      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }

    const formData = await request.formData();
    const action = String(formData.get('action') || 'preview');

    if (action !== 'preview') {
      return NextResponse.json({ error: 'Unsupported form action' }, { status: 400 });
    }

    return handlePreview(formData);
  } catch (error: any) {
    console.error('Error in upload-self-ge:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
