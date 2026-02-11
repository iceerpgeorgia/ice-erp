import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const revalidate = 0;
export const dynamic = "force-dynamic";

const SOURCE_TABLES = new Set([
  "GE78BG0000000893486000_BOG_GEL",
  "GE65TB7856036050100002_TBC_GEL",
]);

const toDateKey = (value: string | Date | null): string | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split(".");
    return `${year}-${month}-${day}`;
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
};

const getRateField = (code: string) => `${code.toLowerCase()}_rate`;

const computeNominalAmount = (
  accountAmount: number,
  accountCode: string,
  nominalCode: string,
  ratesRow: Record<string, any> | null
): number | null => {
  if (!Number.isFinite(accountAmount)) return null;
  if (!accountCode || !nominalCode) return null;
  if (accountCode === nominalCode) return accountAmount;
  if (!ratesRow) return null;

  if (accountCode === "GEL" && nominalCode !== "GEL") {
    const rate = Number(ratesRow[getRateField(nominalCode)]);
    if (!Number.isFinite(rate) || rate === 0) return null;
    return accountAmount * (1 / rate);
  }

  if (nominalCode === "GEL" && accountCode !== "GEL") {
    const rate = Number(ratesRow[getRateField(accountCode)]);
    if (!Number.isFinite(rate) || rate === 0) return null;
    return accountAmount * rate;
  }

  const accountRate = Number(ratesRow[getRateField(accountCode)]);
  const nominalRate = Number(ratesRow[getRateField(nominalCode)]);
  if (!Number.isFinite(accountRate) || !Number.isFinite(nominalRate) || nominalRate === 0) {
    return null;
  }
  const exchangeRate = accountRate / nominalRate;
  if (!Number.isFinite(exchangeRate) || exchangeRate === 0) return null;
  return accountAmount * (1 / exchangeRate);
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const salaryAccrualDate = (salaryMonth: Date) => {
  const year = salaryMonth.getUTCFullYear();
  const month = salaryMonth.getUTCMonth();
  return new Date(Date.UTC(year, month + 1, 1));
};

type TransactionKey = {
  source_table: string;
  id: number | string;
};

type TargetRow = {
  payment_id: string;
  payment_uuid: string | null;
  amount: number;
  remaining: number;
  accrual_date: Date | null;
  currency_code: string | null;
  nominal_currency_uuid: string | null;
  counteragent_uuid: string | null;
  project_uuid: string | null;
  financial_code_uuid: string | null;
  source: "salary" | "ledger";
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const paymentIds = Array.isArray(body.paymentIds) ? body.paymentIds : [];
    const transactionKeys = Array.isArray(body.transactionKeys)
      ? body.transactionKeys
      : [];

    if (paymentIds.length === 0 || transactionKeys.length === 0) {
      return NextResponse.json(
        { error: "Select at least one payment and one transaction." },
        { status: 400 }
      );
    }

    const warnings: string[] = [];

    const salaryRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
         sa.payment_id,
         sa.salary_month,
         sa.net_sum,
         sa.deducted_insurance,
         sa.deducted_fitness,
         sa.deducted_fine,
         sa.counteragent_uuid,
         sa.financial_code_uuid,
         sa.nominal_currency_uuid,
         curr.code as currency_code,
         p.record_uuid as payment_uuid,
         p.project_uuid
       FROM salary_accruals sa
       LEFT JOIN currencies curr ON sa.nominal_currency_uuid = curr.uuid
       LEFT JOIN payments p ON p.payment_id = sa.payment_id
       WHERE sa.payment_id = ANY($1::text[])`,
      paymentIds
    );

    const salaryByPaymentId = new Map<string, any>();
    salaryRows.forEach((row) => salaryByPaymentId.set(row.payment_id, row));

    const normalPaymentIds = paymentIds.filter(
      (id: string) => !salaryByPaymentId.has(id)
    );

    const ledgerRows = normalPaymentIds.length
      ? await prisma.$queryRawUnsafe<any[]>(
          `SELECT
             p.payment_id,
             p.record_uuid as payment_uuid,
             p.counteragent_uuid,
             p.project_uuid,
             p.financial_code_uuid,
             p.currency_uuid,
             curr.code as currency_code,
             MIN(pl.effective_date) as accrual_date,
             COALESCE(SUM(pl.accrual), 0) as accrual_sum
           FROM payments p
           LEFT JOIN payments_ledger pl
             ON p.payment_id = pl.payment_id
            AND (pl.is_deleted = false OR pl.is_deleted IS NULL)
           LEFT JOIN currencies curr ON p.currency_uuid = curr.uuid
           WHERE p.payment_id = ANY($1::text[])
           GROUP BY
             p.payment_id,
             p.record_uuid,
             p.counteragent_uuid,
             p.project_uuid,
             p.financial_code_uuid,
             p.currency_uuid,
             curr.code`,
          normalPaymentIds
        )
      : [];

    const targets: TargetRow[] = [];
    const seen = new Set<string>();

    salaryRows.forEach((row) => {
      const net = Number(row.net_sum || 0);
      const insurance = Number(row.deducted_insurance || 0);
      const fitness = Number(row.deducted_fitness || 0);
      const fine = Number(row.deducted_fine || 0);
      const amount = roundMoney(net - insurance - fitness - fine);
      const salaryMonth = row.salary_month ? new Date(row.salary_month) : null;
      const accrualDate = salaryMonth ? salaryAccrualDate(salaryMonth) : null;

      if (!salaryMonth) {
        warnings.push(`Missing salary_month for ${row.payment_id}.`);
      }

      targets.push({
        payment_id: row.payment_id,
        payment_uuid: row.payment_uuid || null,
        amount: amount > 0 ? amount : 0,
        remaining: amount > 0 ? amount : 0,
        accrual_date: accrualDate,
        currency_code: row.currency_code || null,
        nominal_currency_uuid: row.nominal_currency_uuid || null,
        counteragent_uuid: row.counteragent_uuid || null,
        project_uuid: row.project_uuid || null,
        financial_code_uuid: row.financial_code_uuid || null,
        source: "salary",
      });
      seen.add(row.payment_id);
    });

    ledgerRows.forEach((row) => {
      const amount = roundMoney(Number(row.accrual_sum || 0));
      const accrualDate = row.accrual_date ? new Date(row.accrual_date) : null;
      if (!accrualDate) {
        warnings.push(`Missing accrual date for ${row.payment_id}.`);
      }
      targets.push({
        payment_id: row.payment_id,
        payment_uuid: row.payment_uuid || null,
        amount: amount > 0 ? amount : 0,
        remaining: amount > 0 ? amount : 0,
        accrual_date: accrualDate,
        currency_code: row.currency_code || null,
        nominal_currency_uuid: row.currency_uuid || null,
        counteragent_uuid: row.counteragent_uuid || null,
        project_uuid: row.project_uuid || null,
        financial_code_uuid: row.financial_code_uuid || null,
        source: "ledger",
      });
      seen.add(row.payment_id);
    });

    const missingTargets = paymentIds.filter((id: string) => !seen.has(id));
    if (missingTargets.length > 0) {
      return NextResponse.json(
        { error: `Missing accrual data for payments: ${missingTargets.join(", ")}` },
        { status: 400 }
      );
    }

    const currencyCodes = Array.from(
      new Set(targets.map((row) => row.currency_code).filter(Boolean))
    ) as string[];

    if (currencyCodes.length === 0) {
      return NextResponse.json(
        { error: "Missing currency for selected payments." },
        { status: 400 }
      );
    }

    if (currencyCodes.length > 1) {
      return NextResponse.json(
        { error: "Selected payments have multiple currencies." },
        { status: 400 }
      );
    }

    const targetCurrencyCode = currencyCodes[0];

    const idsByTable: Record<string, Array<number | string>> = {};
    transactionKeys.forEach((key: TransactionKey) => {
      if (!SOURCE_TABLES.has(key.source_table)) return;
      if (!idsByTable[key.source_table]) idsByTable[key.source_table] = [];
      idsByTable[key.source_table].push(key.id);
    });

    const transactionRows: any[] = [];
    for (const [table, ids] of Object.entries(idsByTable)) {
      if (!ids.length) continue;
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT
           '${table}'::text as source_table,
           t.id,
           t.uuid,
           t.payment_id,
           t.transaction_date,
           t.description,
           t.nominal_amount,
           t.account_currency_amount,
           t.nominal_currency_uuid,
           t.account_currency_uuid,
           t.parsing_lock,
           t.raw_record_uuid,
           t.bank_account_uuid,
           t.dockey,
           t.entriesid,
           curr_nom.code as nominal_currency_code,
           curr_acc.code as account_currency_code
         FROM "${table}" t
         LEFT JOIN currencies curr_nom ON t.nominal_currency_uuid = curr_nom.uuid
         LEFT JOIN currencies curr_acc ON t.account_currency_uuid = curr_acc.uuid
         WHERE t.id = ANY($1::bigint[])`,
        ids.map((id) => BigInt(id))
      );
      transactionRows.push(...rows);
    }

    if (transactionRows.length === 0) {
      return NextResponse.json(
        { error: "No transactions found for selection." },
        { status: 400 }
      );
    }

    const uniqueDates = Array.from(
      new Set(
        transactionRows
          .map((row) => toDateKey(row.transaction_date))
          .filter(Boolean)
      )
    ) as string[];

    const ratesRows = uniqueDates.length
      ? await prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM nbg_exchange_rates WHERE date = ANY($1::date[])`,
          uniqueDates
        )
      : [];

    const ratesByDate = new Map<string, any>();
    ratesRows.forEach((row) => {
      const key = row.date ? new Date(row.date).toISOString().slice(0, 10) : null;
      if (key) ratesByDate.set(key, row);
    });

    const items = transactionRows
      .map((row) => {
        const nominalAmount = Number(row.nominal_amount || 0);
        let amount = Number.isFinite(nominalAmount) ? Math.abs(nominalAmount) : 0;

        if (!amount && targetCurrencyCode) {
          const accountAmount = Number(row.account_currency_amount || 0);
          const dateKey = toDateKey(row.transaction_date);
          const ratesRow = dateKey ? ratesByDate.get(dateKey) : null;
          const computed = computeNominalAmount(
            accountAmount,
            row.account_currency_code,
            targetCurrencyCode,
            ratesRow
          );
          if (computed !== null && Number.isFinite(computed)) {
            amount = Math.abs(computed);
          } else if (row.account_currency_code === targetCurrencyCode) {
            amount = Math.abs(accountAmount);
          }
        }

        const accountAmount = Number(row.account_currency_amount || 0);
        const accountAbs = Number.isFinite(accountAmount)
          ? Math.abs(accountAmount)
          : amount;

        return {
          source_table: row.source_table,
          id: Number(row.id),
          uuid: row.uuid,
          payment_id: row.payment_id,
          transaction_date: row.transaction_date,
          description: row.description,
          amount: roundMoney(amount),
          account_amount: roundMoney(accountAbs),
          nominal_currency_uuid: row.nominal_currency_uuid,
          account_currency_uuid: row.account_currency_uuid,
          raw_record_uuid: row.raw_record_uuid,
          bank_account_uuid: row.bank_account_uuid,
          raw_record_id_1: row.dockey,
          raw_record_id_2: row.entriesid,
        };
      })
      .filter((item) => {
        if (!item.amount || item.amount <= 0) {
          warnings.push(`Skipping transaction ${item.source_table}:${item.id} due to missing amount.`);
          return false;
        }
        return true;
      });

    const sortedTargets = targets
      .filter((row) => row.amount > 0)
      .sort((a, b) => {
        const aTime = a.accrual_date ? a.accrual_date.getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.accrual_date ? b.accrual_date.getTime() : Number.MAX_SAFE_INTEGER;
        if (aTime !== bTime) return aTime - bTime;
        return a.payment_id.localeCompare(b.payment_id);
      });

    const sortedItems = items.sort((a, b) => {
      const aKey = toDateKey(a.transaction_date) || "9999-12-31";
      const bKey = toDateKey(b.transaction_date) || "9999-12-31";
      if (aKey !== bKey) return aKey.localeCompare(bKey);
      return a.id - b.id;
    });

    let targetIndex = 0;

    const updates: Array<{
      source_table: string;
      id: number;
      to_payment_id: string;
    }> = [];

    const batches: Array<{
      source_table: string;
      id: number;
      raw_record_uuid: string | null;
      bank_account_uuid: string | null;
      raw_record_id_1: string | null;
      raw_record_id_2: string | null;
      partitions: Array<{
        payment_id: string | null;
        payment_uuid: string | null;
        counteragent_uuid: string | null;
        project_uuid: string | null;
        financial_code_uuid: string | null;
        nominal_currency_uuid: string | null;
        nominal_amount: number;
        partition_amount: number;
        partition_note: string | null;
      }>;
    }> = [];

    const allocations: Array<{
      source_table: string;
      id: number;
      transaction_date: string | null;
      nominal_amount: number;
      partitions: Array<{
        payment_id: string | null;
        amount: number;
        partition_amount: number;
        note: string | null;
      }>;
      batch_required: boolean;
    }> = [];

    for (const item of sortedItems) {
      let remainingTx = item.amount;
      const partitions: Array<{
        payment_id: string | null;
        amount: number;
        partition_amount: number;
        note: string | null;
      }> = [];

      const accountTotal = item.account_amount || item.amount;
      const nominalTotal = item.amount;
      let accountAllocated = 0;
      let nominalAllocated = 0;

      while (remainingTx > 0.0001 && targetIndex < sortedTargets.length) {
        const target = sortedTargets[targetIndex];
        if (target.remaining <= 0.0001) {
          targetIndex += 1;
          continue;
        }
        const alloc = Math.min(remainingTx, target.remaining);
        if (alloc <= 0) break;

        const nominalAlloc = roundMoney(alloc);
        const ratio = nominalTotal > 0 ? nominalAlloc / nominalTotal : 1;
        const accountAlloc = roundMoney(accountTotal * ratio);

        partitions.push({
          payment_id: target.payment_id,
          amount: nominalAlloc,
          partition_amount: accountAlloc,
          note: null,
        });

        target.remaining = roundMoney(target.remaining - nominalAlloc);
        remainingTx = roundMoney(remainingTx - nominalAlloc);
        nominalAllocated = roundMoney(nominalAllocated + nominalAlloc);
        accountAllocated = roundMoney(accountAllocated + accountAlloc);

        if (target.remaining <= 0.0001) {
          targetIndex += 1;
        }
      }

      if (remainingTx > 0.0001) {
        const nominalAlloc = roundMoney(remainingTx);
        const ratio = nominalTotal > 0 ? nominalAlloc / nominalTotal : 1;
        const accountAlloc = roundMoney(accountTotal * ratio);
        partitions.push({
          payment_id: null,
          amount: nominalAlloc,
          partition_amount: accountAlloc,
          note: "Free agent",
        });
        nominalAllocated = roundMoney(nominalAllocated + nominalAlloc);
        accountAllocated = roundMoney(accountAllocated + accountAlloc);
      }

      if (partitions.length > 0) {
        const adjustmentNominal = roundMoney(item.amount - nominalAllocated);
        if (Math.abs(adjustmentNominal) >= 0.01) {
          const last = partitions[partitions.length - 1];
          last.amount = roundMoney(last.amount + adjustmentNominal);
        }

        const adjustmentAccount = roundMoney(accountTotal - accountAllocated);
        if (Math.abs(adjustmentAccount) >= 0.01) {
          const last = partitions[partitions.length - 1];
          last.partition_amount = roundMoney(last.partition_amount + adjustmentAccount);
        }
      }

      const batchRequired =
        partitions.length > 1 || partitions.some((p) => p.payment_id === null);

      allocations.push({
        source_table: item.source_table,
        id: item.id,
        transaction_date: item.transaction_date,
        nominal_amount: item.amount,
        partitions,
        batch_required: batchRequired,
      });

      if (!batchRequired) {
        const targetPaymentId = partitions[0]?.payment_id;
        if (targetPaymentId) {
          updates.push({
            source_table: item.source_table,
            id: item.id,
            to_payment_id: targetPaymentId,
          });
        }
        continue;
      }

      if (!item.raw_record_uuid || !item.bank_account_uuid || !item.raw_record_id_1 || !item.raw_record_id_2) {
        return NextResponse.json(
          { error: `Missing raw record identifiers for ${item.source_table}:${item.id}.` },
          { status: 400 }
        );
      }

      const batchPartitions = partitions.map((partition) => {
        const target = partition.payment_id
          ? sortedTargets.find((row) => row.payment_id === partition.payment_id)
          : null;
        return {
          payment_id: partition.payment_id,
          payment_uuid: target?.payment_uuid || null,
          counteragent_uuid: target?.counteragent_uuid || null,
          project_uuid: target?.project_uuid || null,
          financial_code_uuid: target?.financial_code_uuid || null,
          nominal_currency_uuid: target?.nominal_currency_uuid || null,
          nominal_amount: partition.amount,
          partition_amount: partition.partition_amount,
          partition_note: partition.note,
        };
      });

      batches.push({
        source_table: item.source_table,
        id: item.id,
        raw_record_uuid: item.raw_record_uuid,
        bank_account_uuid: item.bank_account_uuid,
        raw_record_id_1: item.raw_record_id_1,
        raw_record_id_2: item.raw_record_id_2,
        partitions: batchPartitions,
      });
    }

    const unallocated = sortedTargets
      .filter((row) => row.remaining > 0.01)
      .map((row) => ({
        payment_id: row.payment_id,
        remaining: row.remaining,
      }));

    return NextResponse.json({
      updates,
      batches,
      allocations,
      warnings,
      unallocated,
    });
  } catch (error: any) {
    console.error("POST /api/payment-redistribution/fifo failed:", error);
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
