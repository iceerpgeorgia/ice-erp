import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

const normalizeId = (value: unknown) => {
  const digits = String(value ?? '').replace(/\s+/g, '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.length >= 11) return digits;
  return digits.padStart(11, '0');
};

const normalizeHeader = (value: unknown) => String(value ?? '').trim();

const parseAmount = (value: unknown) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const raw = String(value).replace(/\s+/g, '').replace(/,/g, '.');
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const parseMonth = (value: string) => {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}-01T00:00:00`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00`);
  }
  const monthNameMatch = trimmed.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i);
  if (monthNameMatch) {
    const monthMap: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    const month = monthMap[monthNameMatch[1].toLowerCase()];
    return new Date(`${monthNameMatch[2]}-${String(month).padStart(2, '0')}-01T00:00:00`);
  }
  const parsed = new Date(trimmed);
  return parsed;
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const month = formData.get('month');
    const action = formData.get('action');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing XLSX file' }, { status: 400 });
    }
    if (typeof month !== 'string' || !month.trim()) {
      return NextResponse.json({ error: 'Missing month' }, { status: 400 });
    }

    const monthDate = parseMonth(month);
    if (Number.isNaN(monthDate.getTime())) {
      return NextResponse.json({ error: 'Invalid month format' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ error: 'XLSX has no sheets' }, { status: 400 });
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as unknown[][];

    const headerIndex = rows.findIndex((row) => {
      const headers = row.map(normalizeHeader);
      return headers.includes('პირადი ნომერი') && headers.includes('გრაფიკის მიხედვით');
    });

    if (headerIndex === -1) {
      return NextResponse.json({ error: 'Missing required columns: პირადი ნომერი, გრაფიკის მიხედვით' }, { status: 400 });
    }

    const headers = rows[headerIndex].map(normalizeHeader);
    const idIndex = headers.indexOf('პირადი ნომერი');
    const amountIndex = headers.indexOf('გრაფიკის მიხედვით');

    const idAmountMap = new Map<string, number>();
    for (let i = headerIndex + 1; i < rows.length; i += 1) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const personalId = normalizeId(row[idIndex]);
      if (!personalId) continue;
      const amount = parseAmount(row[amountIndex]);
      idAmountMap.set(personalId, (idAmountMap.get(personalId) || 0) + amount);
    }

    const allEmployees = await prisma.counteragents.findMany({
      where: { identification_number: { not: null }, is_emploee: true },
      select: { counteragent_uuid: true, identification_number: true, counteragent: true },
    });

    const idToEmployee = new Map<string, { counteragent_uuid: string; name: string | null; personal_id: string }>();
    allEmployees.forEach((emp) => {
      const key = normalizeId(emp.identification_number);
      if (key) {
        idToEmployee.set(key, { counteragent_uuid: emp.counteragent_uuid, name: emp.counteragent || null, personal_id: key });
      }
    });

    const matchedEmployees = new Map<string, { counteragent_uuid: string; name: string | null; personal_id: string }>();
    const missingEmployees: string[] = [];

    idAmountMap.forEach((_amount, personalId) => {
      const matched = idToEmployee.get(personalId);
      if (matched) {
        matchedEmployees.set(personalId, matched);
      } else {
        missingEmployees.push(personalId);
      }
    });

    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
    const matchedUuids = Array.from(new Set(Array.from(matchedEmployees.values()).map((item) => item.counteragent_uuid)));
    const uuidToPersonalId = new Map<string, string>();
    matchedEmployees.forEach((employee, personalId) => {
      uuidToPersonalId.set(employee.counteragent_uuid, personalId);
    });

    const accruals = await prisma.salary_accruals.findMany({
      where: {
        salary_month: { gte: monthStart, lt: monthEnd },
        counteragent_uuid: { in: matchedUuids },
      },
      select: {
        id: true,
        counteragent_uuid: true,
        surplus_insurance: true,
      },
    });

    const negativeResults: Array<{ personal_id: string; counteragent_uuid: string; counteragent_name: string | null; graph_amount: number; surplus_insurance: number; deducted_insurance: number; total_insurance: number }> = [];
    const updatedDetails: Array<{ personal_id: string; counteragent_uuid: string; counteragent_name: string | null; graph_amount: number; surplus_insurance: number; deducted_insurance: number; total_insurance: number }> = [];
    let updatedRecords = 0;

    for (const record of accruals) {
      const personalId = uuidToPersonalId.get(record.counteragent_uuid);
      if (!personalId) continue;
      const graphAmount = idAmountMap.get(personalId) || 0;
      const surplusInsurance = record.surplus_insurance ? Number(record.surplus_insurance) : 0;
      const deductedInsurance = graphAmount - surplusInsurance;

      const totalInsurance = surplusInsurance + deductedInsurance;

      if (deductedInsurance < 0) {
        const employee = matchedEmployees.get(personalId);
        negativeResults.push({
          personal_id: personalId,
          counteragent_uuid: record.counteragent_uuid,
          counteragent_name: employee?.name || null,
          graph_amount: graphAmount,
          surplus_insurance: surplusInsurance,
          deducted_insurance: deductedInsurance,
          total_insurance: totalInsurance,
        });
      }

      const employee = matchedEmployees.get(personalId);
      updatedDetails.push({
        personal_id: personalId,
        counteragent_uuid: record.counteragent_uuid,
        counteragent_name: employee?.name || null,
        graph_amount: graphAmount,
        surplus_insurance: surplusInsurance,
        deducted_insurance: deductedInsurance,
        total_insurance: totalInsurance,
      });

      if (action !== 'preview') {
        await prisma.salary_accruals.update({
          where: { id: record.id },
          data: { deducted_insurance: deductedInsurance },
        });
        updatedRecords += 1;
      }
    }

    return NextResponse.json({
      month: monthStart.toISOString().slice(0, 10),
      total_rows: idAmountMap.size,
      matched_employees: matchedEmployees.size,
      missing_employees: missingEmployees,
      updated_records: updatedRecords,
      negative_results: negativeResults,
      updated_details: updatedDetails,
    });
  } catch (error: any) {
    console.error('Error uploading TBC insurance:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
