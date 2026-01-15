// app/api/bank-transactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 0;

// Map Prisma (camelCase) to snake_case JSON keys
function toApi(row: any) {
  return {
    id: Number(row.id),
    uuid: row.uuid,
    bank_account_uuid: row.bankAccountUuid,
    raw_record_uuid: row.rawRecordUuid,
    transaction_date: row.transactionDate,
    description: row.description,
    counteragent_uuid: row.counteragentUuid,
    counteragent_account_number: row.counteragentAccountNumber ? String(row.counteragentAccountNumber) : null,
    project_uuid: row.projectUuid,
    financial_code_uuid: row.financialCodeUuid,
    account_currency_uuid: row.accountCurrencyUuid,
    account_currency_amount: row.accountCurrencyAmount?.toString() ?? null,
    nominal_currency_uuid: row.nominalCurrencyUuid,
    nominal_amount: row.nominalAmount?.toString() ?? null,
    payment_id: row.paymentId ?? null,
    processing_case: row.processingCase,
    created_at: row.createdAt?.toISOString() ?? null,
    updated_at: row.updatedAt?.toISOString() ?? null,
    is_balance_record: false, // Regular transaction
    
    // Join data
    account_number: row.bankAccount?.accountNumber ?? null,
    bank_name: row.bankAccount?.bank?.bankName ?? null,
    counteragent_name: null, // Will be populated by separate query
    project_index: null, // Will be populated by separate query
    financial_code: null, // Will be populated by separate query
  };
}

// Map balance records from bank_accounts table to transaction format
function balanceToApi(row: any, currencyCode: string) {
  const balanceDate = row.balance_date ? 
    new Date(row.balance_date).toLocaleDateString('en-GB').split('/').join('.') : // dd.mm.yyyy
    null;
  
  return {
    id: Number(row.id) * -1, // Negative ID to distinguish from real transactions
    uuid: `balance-${row.uuid}`, // Prefix to distinguish from real UUIDs
    bank_account_uuid: row.uuid,
    raw_record_uuid: null,
    transaction_date: balanceDate,
    description: 'Balance Depiction',
    counteragent_uuid: null,
    counteragent_account_number: `${row.accountNumber}${currencyCode}`, // Account number + currency
    project_uuid: null,
    financial_code_uuid: null,
    account_currency_uuid: row.currencyUuid,
    account_currency_amount: row.balance?.toString() ?? null,
    nominal_currency_uuid: row.currencyUuid,
    nominal_amount: row.balance?.toString() ?? null,
    processing_case: null,
    created_at: null,
    updated_at: null,
    is_balance_record: true, // Flag to disable view/edit actions
    applied_rule_id: null,
    
    // Join data
    account_number: row.accountNumber && currencyCode ? `${row.accountNumber}${currencyCode}` : row.accountNumber,
    bank_name: row.bank?.bankName ?? null,
    counteragent_name: null,
    project_index: null,
    financial_code: null,
    nominal_currency_code: currencyCode,
  };
}

export async function GET(req: NextRequest) {
  try {
    // Parse query parameters for date filtering and ID filtering
    const searchParams = req.nextUrl.searchParams;
    const fromDate = searchParams.get('fromDate'); // dd.mm.yyyy format
    const toDate = searchParams.get('toDate');     // dd.mm.yyyy format
    const idsParam = searchParams.get('ids');      // Comma-separated IDs for fetching specific records
    
    console.log('[API] Query params:', { fromDate, toDate, idsParam });
    
    // Helper to convert dd.mm.yyyy to yyyy-mm-dd for comparison
    const toComparableDate = (ddmmyyyy: string | null): string | null => {
      if (!ddmmyyyy || ddmmyyyy.length !== 10) return null;
      const parts = ddmmyyyy.split('.');
      if (parts.length !== 3) return null;
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    };
    
    // Database stores dates as dd.mm.yyyy strings
    // We need to fetch all and filter in memory since string comparison doesn't work correctly
    const whereClause: any = {};
    
    // If specific IDs requested, fetch only those
    if (idsParam) {
      const ids = idsParam.split(',').map(id => BigInt(id.trim()));
      whereClause.id = { in: ids };
      console.log('[API] Fetching specific IDs:', ids);
    }
    
    const transactions = await prisma.consolidatedBankAccount.findMany({
      where: whereClause,
      include: {
        bankAccount: {
          include: {
            bank: true
          }
        }
      },
      orderBy: [
        { id: 'desc' }
      ],
      take: idsParam ? undefined : 100000 // No limit when fetching specific IDs
    });

    // Filter in memory by converting dates to comparable format
    let filteredTransactions = transactions;
    if ((fromDate || toDate) && !idsParam) { // Skip date filtering when fetching specific IDs
      const fromComparable = toComparableDate(fromDate);
      const toComparable = toComparableDate(toDate);
      console.log('[API] Comparable dates:', { fromComparable, toComparable });
      
      filteredTransactions = transactions.filter(t => {
        const txDateComparable = toComparableDate(t.transactionDate);
        if (!txDateComparable) return true; // Include if date is invalid
        
        if (fromComparable && txDateComparable < fromComparable) return false;
        if (toComparable && txDateComparable > toComparable) return false;
        return true;
      });
      
      console.log('[API] Filtered from', transactions.length, 'to', filteredTransactions.length, 'records');
    }

    // Get related data for lookups
    const counteragentUuids = [...new Set(filteredTransactions.map(t => t.counteragentUuid).filter(Boolean))];
    const projectUuids = [...new Set(filteredTransactions.map(t => t.projectUuid).filter(Boolean))];
    const financialCodeUuids = [...new Set(filteredTransactions.map(t => t.financialCodeUuid).filter(Boolean))];
    const accountCurrencyUuids = [...new Set(filteredTransactions.map(t => t.accountCurrencyUuid).filter(Boolean))];
    const nominalCurrencyUuids = [...new Set(filteredTransactions.map(t => t.nominalCurrencyUuid).filter(Boolean))];
    const rawRecordUuids = [...new Set(filteredTransactions.map(t => t.rawRecordUuid).filter(Boolean))];

    // Fetch balance records from bank_accounts table
    const balanceRecords = await prisma.bankAccount.findMany({
      where: {
        balance: { not: null },
        balance_date: { not: null },
        isActive: true
      },
      include: {
        bank: true,
        currency: true
      }
    });

    // Fetch applied_rule_id from raw table (optional - may not exist on all environments)
    let rawRecordsWithRules: Array<{ uuid: string; applied_rule_id: number | null }> = [];
    try {
      if (rawRecordUuids.length > 0) {
        rawRecordsWithRules = await prisma.$queryRawUnsafe<Array<{ uuid: string; applied_rule_id: number | null }>>(
          `SELECT uuid, applied_rule_id FROM bog_gel_raw_893486000 WHERE uuid = ANY($1::uuid[])`,
          rawRecordUuids
        );
      }
    } catch (rawTableError) {
      console.warn('[API] Could not fetch applied_rule_id from raw table:', rawTableError);
      // Continue without applied_rule_id data
    }
    const appliedRuleMap = new Map(rawRecordsWithRules.map(r => [r.uuid, r.applied_rule_id]));

    // Fetch lookup data
    const [counteragents, projects, financialCodes, currencies] = await Promise.all([
      counteragentUuids.length > 0
        ? prisma.counteragent.findMany({
            where: { counteragent_uuid: { in: counteragentUuids as string[] } },
            select: { counteragent_uuid: true, counteragent: true }
          })
        : [],
      projectUuids.length > 0
        ? prisma.project.findMany({
            where: { projectUuid: { in: projectUuids as string[] } },
            select: { projectUuid: true, projectIndex: true }
          })
        : [],
      financialCodeUuids.length > 0
        ? prisma.financialCode.findMany({
            where: { uuid: { in: financialCodeUuids as string[] } },
            select: { uuid: true, code: true, validation: true }
          })
        : [],
      (accountCurrencyUuids.length > 0 || nominalCurrencyUuids.length > 0)
        ? prisma.currency.findMany({
            where: { uuid: { in: [...accountCurrencyUuids, ...nominalCurrencyUuids] as string[] } },
            select: { uuid: true, code: true }
          })
        : []
    ]);

    // Create lookup maps
    const counteragentMap = new Map(counteragents.map(c => [
      c.counteragent_uuid, 
      c.counteragent || 'Unknown'
    ]));
    const projectMap = new Map(projects.map(p => [p.projectUuid, p.projectIndex]));
    const financialCodeMap = new Map(financialCodes.map(f => [f.uuid, f.validation || f.code]));
    const currencyMap = new Map(currencies.map(c => [c.uuid, c.code]));

    // Map filteredTransactions (not all transactions) with lookup data
    const result = filteredTransactions.map(row => {
      const base = toApi(row);
      const accountCurrencyCode = row.accountCurrencyUuid ? currencyMap.get(row.accountCurrencyUuid) ?? null : null;
      const nominalCurrencyCode = row.nominalCurrencyUuid ? currencyMap.get(row.nominalCurrencyUuid) ?? null : null;
      const accountNumber = row.bankAccount?.accountNumber ?? null;
      const appliedRuleId = row.rawRecordUuid ? appliedRuleMap.get(row.rawRecordUuid) ?? null : null;
      
      return {
        ...base,
        applied_rule_id: appliedRuleId,
        counteragent_name: row.counteragentUuid ? counteragentMap.get(row.counteragentUuid) ?? null : null,
        project_index: row.projectUuid ? projectMap.get(row.projectUuid) ?? null : null,
        financial_code: row.financialCodeUuid ? financialCodeMap.get(row.financialCodeUuid) ?? null : null,
        account_number: accountNumber && accountCurrencyCode ? `${accountNumber}${accountCurrencyCode}` : accountNumber,
        nominal_currency_code: nominalCurrencyCode,
      };
    });

    // Map balance records and apply date filtering
    const balanceResults = balanceRecords
      .map(row => balanceToApi(row, row.currency?.code ?? ''))
      .filter(balanceRecord => {
        if (!fromDate && !toDate) return true;
        const balanceDateComparable = toComparableDate(balanceRecord.transaction_date);
        if (!balanceDateComparable) return false;
        
        const fromComparable = toComparableDate(fromDate);
        const toComparable = toComparableDate(toDate);
        
        if (fromComparable && balanceDateComparable < fromComparable) return false;
        if (toComparable && balanceDateComparable > toComparable) return false;
        return true;
      });

    // Combine regular transactions and balance records
    const combinedResult = [...result, ...balanceResults];

    return NextResponse.json(combinedResult);
  } catch (error: any) {
    console.error("[GET /api/bank-transactions] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch bank transactions" },
      { status: 500 }
    );
  }
}
