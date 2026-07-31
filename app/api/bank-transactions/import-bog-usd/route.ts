import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as XLSX from 'xlsx';

interface RawBogUsdRecord {
  transaction_date?: Date | null;
  document_number?: string | null;
  correspondent_account?: string | null;
  debit_amount?: number | null;
  credit_amount?: number | null;
  exchange_rate?: number | null;
  debit_gel?: number | null;
  credit_gel?: number | null;
  operation_description?: string | null;
  operation_type?: string | null;
  operation_id?: string | null;
  ref?: string | null;
  sender_name?: string | null;
  sender_inn?: string | null;
  sender_account?: string | null;
  sender_bank_code?: string | null;
  sender_bank_name?: string | null;
  beneficiary_name?: string | null;
  beneficiary_inn?: string | null;
  beneficiary_account?: string | null;
  beneficiary_bank_code?: string | null;
  beneficiary_bank_name?: string | null;
  purpose?: string | null;
  additional_info?: string | null;
  amount?: number | null;
  amount_gel?: number | null;
}

// Column mapping from Excel (Georgian) to database columns
const COLUMN_MAPPING: Record<string, string> = {
  'transaction_date': 'თარიღი',
  'document_number': 'საბუთის N',
  'correspondent_account': 'მოკორესპოდენტო ანგარიში',
  'debit_amount': 'დებეტი',
  'credit_amount': 'კრედიტი',
  'exchange_rate': 'კურსი',
  'debit_gel': 'დებეტი ექვ ლარში',
  'credit_gel': 'კრედიტი ექვ ლარში',
  'operation_description': 'ოპერაციის შინაარსი',
  'operation_type': 'ოპერაციის ტიპი',
  'operation_id': 'ოპერაციის იდ',
  'ref': 'Ref',
  'sender_name': 'გამგზავნის დასახელება',
  'sender_inn': 'გამგზავნის საიდენტიფიკაციო კოდი',
  'sender_account': 'გამგზავნის ანგარიშის ნომერი',
  'sender_bank_code': 'გამგზავნი ბანკის კოდი',
  'sender_bank_name': 'გამგზავნი ბანკის დასახელება',
  'beneficiary_name': 'მიმღების დასახელება',
  'beneficiary_inn': 'მიმღების საიდენტიფიკაციო კოდი',
  'beneficiary_account': 'მიმღების ანგარიშის ნომერი',
  'beneficiary_bank_code': 'მიმღები ბანკის კოდი',
  'beneficiary_bank_name': 'მიმღები ბანკის დასახელება',
  'purpose': 'დანიშნულება',
  'additional_info': 'დამატებითი ინფორმაცია',
  'amount': 'თანხა',
  'amount_gel': 'თანხა ექვ ლარში',
};

function excelDateToDate(excelDate: number): Date | null {
  if (!excelDate) return null;
  try {
    // Excel's epoch is 1900-01-01
    const epochDate = new Date(1900, 0, 1);
    epochDate.setDate(epochDate.getDate() + excelDate - 2);
    return epochDate;
  } catch {
    return null;
  }
}

function safeNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

export async function POST(request: NextRequest) {
  try {
    const filePath = join(process.cwd(), 'Chrome Logs', 'BOG USD 2018-2022.xlsx');

    console.log(`[BOG USD Import] Starting import from: ${filePath}`);

    // Read Excel file
    const fileBuffer = readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { cellDates: true });
    const worksheet = workbook.Sheets['Sheet1'];

    if (!worksheet) {
      return NextResponse.json(
        { error: 'Sheet1 not found in workbook' },
        { status: 400 }
      );
    }

    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: null });
    console.log(`[BOG USD Import] Loaded ${data.length} rows from Excel`);

    // Get existing operation IDs from database
    const existingRecords = await prisma.$queryRawUnsafe<Array<{ operation_id: string | null }>>(
      'SELECT DISTINCT operation_id FROM "GE78BG0000000893486000_BOG_USD" WHERE operation_id IS NOT NULL'
    );

    const existingIds = new Set(existingRecords.map(r => r.operation_id).filter(Boolean));
    console.log(`[BOG USD Import] Found ${existingIds.size} existing operation IDs in database`);

    // Filter new rows
    const newRows = data.filter((row: any) => {
      const operationId = String(row['ოპერაციის იდ'] || '').trim();
      return operationId && !existingIds.has(operationId);
    });

    console.log(`[BOG USD Import] Found ${newRows.length} new rows to import`);
    console.log(`[BOG USD Import] Skipping ${data.length - newRows.length} duplicate rows`);

    if (newRows.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: 'No new rows to import',
          inserted: 0,
          duplicates: data.length,
          totalInDb: existingIds.size,
        },
        { status: 200 }
      );
    }

    // Transform rows for insertion
    const rowsToInsert: RawBogUsdRecord[] = newRows.map((excelRow: any) => {
      const dbRow: any = {};

      // Map Excel columns to database columns
      for (const [dbCol, excelCol] of Object.entries(COLUMN_MAPPING)) {
        const value = excelRow[excelCol];

        if (value === null || value === undefined || value === '') {
          dbRow[dbCol as keyof RawBogUsdRecord] = null;
          continue;
        }

        // Special handling for date column
        if (dbCol === 'transaction_date') {
          if (typeof value === 'number') {
            dbRow[dbCol] = excelDateToDate(value);
          } else if (value instanceof Date) {
            dbRow[dbCol] = Number.isNaN(value.getTime()) ? null : value;
          } else {
            dbRow[dbCol] = null;
          }
        }
        // Special handling for numeric columns
        else if (
          ['debit_amount', 'credit_amount', 'exchange_rate', 'debit_gel', 'credit_gel', 'amount', 'amount_gel'].includes(dbCol)
        ) {
          dbRow[dbCol as keyof RawBogUsdRecord] = safeNumber(value);
        }
        // Text columns
        else {
          dbRow[dbCol as keyof RawBogUsdRecord] = String(value).trim();
        }
      }

      return dbRow;
    });

    // Build dynamic INSERT query
    const columns = Object.keys(rowsToInsert[0]);
    const columnsList = columns.map(col => `"${col}"`).join(', ');
    const placeholders = rowsToInsert
      .map((_, idx) => `(${columns.map((_, colIdx) => `$${idx * columns.length + colIdx + 1}`).join(', ')})`)
      .join(', ');

    const values = rowsToInsert.flatMap(row => columns.map(col => row[col as keyof RawBogUsdRecord]));

    const insertSQL = `
      INSERT INTO "GE78BG0000000893486000_BOG_USD" (${columnsList})
      VALUES ${placeholders}
      ON CONFLICT (operation_id) DO NOTHING
    `;

    console.log(`[BOG USD Import] Inserting ${rowsToInsert.length} rows...`);

    const result = await prisma.$executeRawUnsafe(insertSQL, ...values);

    console.log(`[BOG USD Import] Insert completed, rows affected: ${result}`);

    // Get updated row count
    const countResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*) as count FROM "GE78BG0000000893486000_BOG_USD"'
    );

    const totalRows = Number(countResult[0]?.count || 0);

    return NextResponse.json(
      {
        success: true,
        message: `Successfully imported ${result} new transactions`,
        inserted: result,
        duplicates: data.length - newRows.length,
        totalInDb: totalRows,
        dateRange: {
          min: rowsToInsert
            .filter(r => r.transaction_date)
            .sort((a, b) => (a.transaction_date!.getTime() - b.transaction_date!.getTime()))[0]?.transaction_date,
          max: rowsToInsert
            .filter(r => r.transaction_date)
            .sort((a, b) => (b.transaction_date!.getTime() - a.transaction_date!.getTime()))[0]?.transaction_date,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[BOG USD Import] Error:', error);
    return NextResponse.json(
      {
        error: 'Import failed',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
