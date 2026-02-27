import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

const HEADER_ALIASES: Record<string, string[]> = {
  employee_id: ['employee_id', 'employee id', 'identification_number', 'identification number', 'personal_id', 'personal id', 'პირადი ნომერი'],
  financial_code: ['financial_code', 'financial code', 'financial_code_validation', 'financial code validation', 'ფინანსური კოდი'],
  currency_code: ['currency_code', 'currency code', 'currency', 'ვალუტა'],
  net_sum: ['net_sum', 'net sum', 'net', 'salary_net', 'ხელზე', 'თანხა'],
  surplus_insurance: ['surplus_insurance', 'surplus insurance'],
  deducted_insurance: ['deducted_insurance', 'deducted insurance'],
  deducted_fitness: ['deducted_fitness', 'deducted fitness'],
  deducted_fine: ['deducted_fine', 'deducted fine'],
};

const normalizeHeader = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[_-]+/g, ' ');

const normalizeId = (value: unknown) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length >= 11) return digits;
  return digits.padStart(11, '0');
};

const parseAmount = (value: unknown) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  const raw = String(value).replace(/\s+/g, '').replace(/,/g, '.');
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseMonth = (value: string) => {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}-01T00:00:00`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00`);
  }
  const parsed = new Date(trimmed);
  return parsed;
};

function generatePaymentId(counteragentUuid: string, financialCodeUuid: string, salaryMonth: Date): string {
  const extractChars = (uuid: string) => uuid[1] + uuid[3] + uuid[5] + uuid[7] + uuid[9] + uuid[11];

  const counteragentPart = extractChars(counteragentUuid);
  const financialPart = extractChars(financialCodeUuid);

  const month = salaryMonth.getMonth() + 1;
  const year = salaryMonth.getFullYear();
  const monthStr = month < 10 ? `0${month}` : `${month}`;

  return `NP_${counteragentPart}_NJ_${financialPart}_PRL${monthStr}${year}`;
}

const resolveHeaderIndexes = (headers: string[]) => {
  const indexMap = new Map<string, number>();

  Object.entries(HEADER_ALIASES).forEach(([canonicalKey, aliases]) => {
    const idx = headers.findIndex((header) => aliases.includes(header));
    if (idx >= 0) {
      indexMap.set(canonicalKey, idx);
    }
  });

  return indexMap;
};

export async function GET() {
  const templateRows = [
    {
      employee_id: '01012345678',
      financial_code: 'Salary Net',
      currency_code: 'GEL',
      net_sum: 2500,
      surplus_insurance: 0,
      deducted_insurance: 0,
      deducted_fitness: 0,
      deducted_fine: 0,
    },
    {
      employee_id: '01087654321',
      financial_code: 'Salary Net',
      currency_code: 'GEL',
      net_sum: 3100,
      surplus_insurance: 0,
      deducted_insurance: 0,
      deducted_fitness: 0,
      deducted_fine: 0,
    },
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(templateRows);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'SalaryUploadTemplate');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="salary_accruals_period_upload_template.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const month = formData.get('month');
    const file = formData.get('file');
    const updatedBy = String(formData.get('updated_by') || 'user');

    if (typeof month !== 'string' || !month.trim()) {
      return NextResponse.json({ error: 'Missing month (yyyy-mm)' }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing XLSX file' }, { status: 400 });
    }

    const monthDate = parseMonth(month);
    if (Number.isNaN(monthDate.getTime())) {
      return NextResponse.json({ error: 'Invalid month format. Use yyyy-mm' }, { status: 400 });
    }

    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return NextResponse.json({ error: 'XLSX has no sheets' }, { status: 400 });
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as unknown[][];
    if (!rows.length) {
      return NextResponse.json({ error: 'XLSX is empty' }, { status: 400 });
    }

    const headers = (rows[0] || []).map(normalizeHeader);
    const headerIndexMap = resolveHeaderIndexes(headers);

    const required = ['employee_id', 'financial_code', 'currency_code', 'net_sum'];
    const missingHeaders = required.filter((key) => !headerIndexMap.has(key));
    if (missingHeaders.length > 0) {
      return NextResponse.json(
        { error: `Missing required columns: ${missingHeaders.join(', ')}` },
        { status: 400 }
      );
    }

    const parsedRows: Array<{
      rowNumber: number;
      employeeId: string;
      financialCode: string;
      currencyCode: string;
      netSum: number;
      surplusInsurance: number | null;
      deductedInsurance: number | null;
      deductedFitness: number | null;
      deductedFine: number | null;
    }> = [];

    const rowErrors: Array<{ row: number; error: string }> = [];

    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const rowNumber = i + 1;

      const employeeId = normalizeId(row[headerIndexMap.get('employee_id')!]);
      const financialCode = String(row[headerIndexMap.get('financial_code')!] ?? '').trim();
      const currencyCode = String(row[headerIndexMap.get('currency_code')!] ?? '').trim().toUpperCase();
      const netSum = parseAmount(row[headerIndexMap.get('net_sum')!]);

      const parseOptional = (key: 'surplus_insurance' | 'deducted_insurance' | 'deducted_fitness' | 'deducted_fine') => {
        const index = headerIndexMap.get(key);
        if (index === undefined) return null;
        const value = row[index];
        if (value === null || value === undefined || value === '') return null;
        return parseAmount(value);
      };

      const surplusInsurance = parseOptional('surplus_insurance');
      const deductedInsurance = parseOptional('deducted_insurance');
      const deductedFitness = parseOptional('deducted_fitness');
      const deductedFine = parseOptional('deducted_fine');

      if (!employeeId) {
        rowErrors.push({ row: rowNumber, error: 'employee_id is empty or invalid' });
        continue;
      }
      if (!financialCode) {
        rowErrors.push({ row: rowNumber, error: 'financial_code is empty' });
        continue;
      }
      if (!currencyCode) {
        rowErrors.push({ row: rowNumber, error: 'currency_code is empty' });
        continue;
      }
      if (netSum === null) {
        rowErrors.push({ row: rowNumber, error: 'net_sum is invalid' });
        continue;
      }
      if (
        surplusInsurance === null && headerIndexMap.has('surplus_insurance') &&
        row[headerIndexMap.get('surplus_insurance')!] !== null &&
        row[headerIndexMap.get('surplus_insurance')!] !== undefined &&
        row[headerIndexMap.get('surplus_insurance')!] !== ''
      ) {
        rowErrors.push({ row: rowNumber, error: 'surplus_insurance is invalid' });
        continue;
      }
      if (
        deductedInsurance === null && headerIndexMap.has('deducted_insurance') &&
        row[headerIndexMap.get('deducted_insurance')!] !== null &&
        row[headerIndexMap.get('deducted_insurance')!] !== undefined &&
        row[headerIndexMap.get('deducted_insurance')!] !== ''
      ) {
        rowErrors.push({ row: rowNumber, error: 'deducted_insurance is invalid' });
        continue;
      }
      if (
        deductedFitness === null && headerIndexMap.has('deducted_fitness') &&
        row[headerIndexMap.get('deducted_fitness')!] !== null &&
        row[headerIndexMap.get('deducted_fitness')!] !== undefined &&
        row[headerIndexMap.get('deducted_fitness')!] !== ''
      ) {
        rowErrors.push({ row: rowNumber, error: 'deducted_fitness is invalid' });
        continue;
      }
      if (
        deductedFine === null && headerIndexMap.has('deducted_fine') &&
        row[headerIndexMap.get('deducted_fine')!] !== null &&
        row[headerIndexMap.get('deducted_fine')!] !== undefined &&
        row[headerIndexMap.get('deducted_fine')!] !== ''
      ) {
        rowErrors.push({ row: rowNumber, error: 'deducted_fine is invalid' });
        continue;
      }

      parsedRows.push({
        rowNumber,
        employeeId,
        financialCode,
        currencyCode,
        netSum,
        surplusInsurance,
        deductedInsurance,
        deductedFitness,
        deductedFine,
      });
    }

    if (parsedRows.length === 0) {
      return NextResponse.json({
        error: rowErrors.length > 0 ? 'No valid rows in XLSX' : 'No data rows in XLSX',
        errors: rowErrors,
      }, { status: 400 });
    }

    const allEmployees = await prisma.counteragents.findMany({
      where: { identification_number: { not: null } },
      select: { counteragent_uuid: true, identification_number: true, counteragent: true },
    });
    const employeeMap = new Map<string, { uuid: string; name: string | null }>();
    allEmployees.forEach((employee) => {
      const normalized = normalizeId(employee.identification_number);
      if (normalized) {
        employeeMap.set(normalized, { uuid: employee.counteragent_uuid, name: employee.counteragent || null });
      }
    });

    const financialCodeValues = Array.from(new Set(parsedRows.map((row) => row.financialCode)));
    const financialCodes = await prisma.financial_codes.findMany({
      where: { validation: { in: financialCodeValues } },
      select: { uuid: true, validation: true },
    });
    const financialCodeMap = new Map(financialCodes.map((item) => [String(item.validation).trim(), item.uuid]));

    const currencyCodes = Array.from(new Set(parsedRows.map((row) => row.currencyCode)));
    const currencies = await prisma.currencies.findMany({
      where: { code: { in: currencyCodes } },
      select: { uuid: true, code: true },
    });
    const currencyMap = new Map(currencies.map((item) => [String(item.code).trim().toUpperCase(), item.uuid]));

    const unresolvedErrors: Array<{ row: number; error: string }> = [];
    const validRows = parsedRows
      .map((row) => {
        const employee = employeeMap.get(row.employeeId);
        const financialCodeUuid = financialCodeMap.get(row.financialCode);
        const currencyUuid = currencyMap.get(row.currencyCode);

        if (!employee) {
          unresolvedErrors.push({ row: row.rowNumber, error: `Employee not found for employee_id=${row.employeeId}` });
          return null;
        }
        if (!financialCodeUuid) {
          unresolvedErrors.push({ row: row.rowNumber, error: `Financial code not found: ${row.financialCode}` });
          return null;
        }
        if (!currencyUuid) {
          unresolvedErrors.push({ row: row.rowNumber, error: `Currency not found: ${row.currencyCode}` });
          return null;
        }

        return {
          ...row,
          counteragentUuid: employee.uuid,
          employeeName: employee.name,
          financialCodeUuid,
          currencyUuid,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    let inserted = 0;
    let updated = 0;

    for (const row of validRows) {
      const updateResult = await prisma.salary_accruals.updateMany({
        where: {
          salary_month: { gte: monthStart, lt: monthEnd },
          counteragent_uuid: row.counteragentUuid,
          financial_code_uuid: row.financialCodeUuid,
          nominal_currency_uuid: row.currencyUuid,
        },
        data: {
          net_sum: row.netSum,
          surplus_insurance: row.surplusInsurance,
          deducted_insurance: row.deductedInsurance,
          deducted_fitness: row.deductedFitness,
          deducted_fine: row.deductedFine,
          updated_at: new Date(),
          updated_by: updatedBy,
        },
      });

      if (updateResult.count > 0) {
        updated += updateResult.count;
        continue;
      }

      await prisma.salary_accruals.create({
        data: {
          counteragent_uuid: row.counteragentUuid,
          financial_code_uuid: row.financialCodeUuid,
          nominal_currency_uuid: row.currencyUuid,
          payment_id: generatePaymentId(row.counteragentUuid, row.financialCodeUuid, monthStart),
          salary_month: monthStart,
          net_sum: row.netSum,
          surplus_insurance: row.surplusInsurance,
          deducted_insurance: row.deductedInsurance,
          deducted_fitness: row.deductedFitness,
          deducted_fine: row.deductedFine,
          created_by: updatedBy,
          updated_by: updatedBy,
        },
      });
      inserted += 1;
    }

    return NextResponse.json({
      month: monthStart.toISOString().slice(0, 10),
      total_rows: parsedRows.length,
      valid_rows: validRows.length,
      inserted,
      updated,
      errors: [...rowErrors, ...unresolvedErrors],
    });
  } catch (error: any) {
    console.error('Error uploading salary accruals period XLSX:', error);
    return NextResponse.json({ error: error.message || 'Failed to upload salary accruals XLSX' }, { status: 500 });
  }
}
