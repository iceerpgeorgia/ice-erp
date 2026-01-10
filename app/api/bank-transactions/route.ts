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
    project_uuid: row.projectUuid,
    financial_code_uuid: row.financialCodeUuid,
    account_currency_uuid: row.accountCurrencyUuid,
    account_currency_amount: row.accountCurrencyAmount?.toString() ?? null,
    nominal_currency_uuid: row.nominalCurrencyUuid,
    nominal_amount: row.nominalAmount?.toString() ?? null,
    created_at: row.createdAt?.toISOString() ?? null,
    updated_at: row.updatedAt?.toISOString() ?? null,
    
    // Join data
    account_number: row.bankAccount?.accountNumber ?? null,
    bank_name: row.bankAccount?.bank?.bankName ?? null,
    counteragent_name: null, // Will be populated by separate query
    project_index: null, // Will be populated by separate query
    financial_code: null, // Will be populated by separate query
  };
}

export async function GET(req: NextRequest) {
  try {
    const transactions = await prisma.consolidatedBankAccount.findMany({
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
      take: 5000 // Limit for performance
    });

    // Get related data for lookups
    const counteragentUuids = [...new Set(transactions.map(t => t.counteragentUuid).filter(Boolean))];
    const projectUuids = [...new Set(transactions.map(t => t.projectUuid).filter(Boolean))];
    const financialCodeUuids = [...new Set(transactions.map(t => t.financialCodeUuid).filter(Boolean))];
    const accountCurrencyUuids = [...new Set(transactions.map(t => t.accountCurrencyUuid).filter(Boolean))];
    const nominalCurrencyUuids = [...new Set(transactions.map(t => t.nominalCurrencyUuid).filter(Boolean))];

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

    // Map transactions with lookup data
    const result = transactions.map(row => {
      const base = toApi(row);
      const accountCurrencyCode = row.accountCurrencyUuid ? currencyMap.get(row.accountCurrencyUuid) ?? null : null;
      const nominalCurrencyCode = row.nominalCurrencyUuid ? currencyMap.get(row.nominalCurrencyUuid) ?? null : null;
      const accountNumber = row.bankAccount?.accountNumber ?? null;
      
      return {
        ...base,
        counteragent_name: row.counteragentUuid ? counteragentMap.get(row.counteragentUuid) ?? null : null,
        project_index: row.projectUuid ? projectMap.get(row.projectUuid) ?? null : null,
        financial_code: row.financialCodeUuid ? financialCodeMap.get(row.financialCodeUuid) ?? null : null,
        account_number: accountNumber && accountCurrencyCode ? `${accountNumber}${accountCurrencyCode}` : accountNumber,
        nominal_currency_code: nominalCurrencyCode,
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[GET /api/bank-transactions] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch bank transactions" },
      { status: 500 }
    );
  }
}
