import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import solver from "javascript-lp-solver";

export const revalidate = 0;
export const dynamic = "force-dynamic";

const SOURCE_TABLES = new Set([
  "GE78BG0000000893486000_BOG_GEL",
  "GE65TB7856036050100002_TBC_GEL",
]);

const toDateKey = (value: string | null): string | null => {
  if (!value) return null;
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

type TransactionKey = {
  source_table: string;
  id: number | string;
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

    const accrualRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
         p.payment_id,
         curr.code as currency_code,
         COALESCE(SUM(pl.accrual), 0) as accrual_sum
       FROM payments p
       LEFT JOIN payments_ledger pl
         ON p.payment_id = pl.payment_id
        AND (pl.is_deleted = false OR pl.is_deleted IS NULL)
       LEFT JOIN currencies curr ON p.currency_uuid = curr.uuid
       WHERE p.payment_id = ANY($1::text[])
       GROUP BY p.payment_id, curr.code
       ORDER BY p.payment_id`,
      paymentIds
    );

    const targets: Record<string, number> = {};
    const paymentCurrencyCodes = new Set<string>();
    accrualRows.forEach((row) => {
      targets[row.payment_id] = Number(row.accrual_sum || 0);
      if (row.currency_code) {
        paymentCurrencyCodes.add(row.currency_code);
      }
    });

    const missingTargets = paymentIds.filter((id: string) => targets[id] === undefined);
    if (missingTargets.length > 0) {
      return NextResponse.json(
        { error: `Missing accruals for payments: ${missingTargets.join(", ")}` },
        { status: 400 }
      );
    }

    if (paymentCurrencyCodes.size > 1) {
      return NextResponse.json(
        { error: "Selected payments have multiple currencies. Choose one currency." },
        { status: 400 }
      );
    }

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

    const transactionCurrencyCodes = new Set<string>();
    transactionRows.forEach((row) => {
      if (row.nominal_currency_code) {
        transactionCurrencyCodes.add(row.nominal_currency_code);
      }
    });

    if (transactionCurrencyCodes.size > 1) {
      return NextResponse.json(
        { error: "Selected transactions have multiple nominal currencies." },
        { status: 400 }
      );
    }

    if (
      paymentCurrencyCodes.size === 1 &&
      transactionCurrencyCodes.size === 1 &&
      paymentCurrencyCodes.values().next().value !==
        transactionCurrencyCodes.values().next().value
    ) {
      return NextResponse.json(
        { error: "Payments and transactions use different currencies." },
        { status: 400 }
      );
    }

    const targetCurrencyCode = paymentCurrencyCodes.values().next().value as
      | string
      | undefined;

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

    const items = transactionRows.map((row) => {
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

      return {
        source_table: row.source_table,
        id: Number(row.id),
        uuid: row.uuid,
        payment_id: row.payment_id,
        transaction_date: row.transaction_date,
        description: row.description,
        amount,
      };
    });

    const model: any = {
      optimize: "deviation",
      opType: "min",
      constraints: {},
      variables: {},
      binaries: {},
    };

    items.forEach((_item, index) => {
      model.constraints[`assign_${index}`] = { equal: 1 };
    });

    paymentIds.forEach((paymentId: string) => {
      model.constraints[`balance_${paymentId}`] = { equal: targets[paymentId] };
    });

    items.forEach((item, index) => {
      paymentIds.forEach((paymentId: string) => {
        const variable = `x_${index}_${paymentId}`;
        model.variables[variable] = {
          deviation: 0,
          [`assign_${index}`]: 1,
          [`balance_${paymentId}`]: item.amount,
        };
        model.binaries[variable] = 1;
      });
    });

    paymentIds.forEach((paymentId: string) => {
      model.variables[`dev_pos_${paymentId}`] = {
        deviation: 1,
        [`balance_${paymentId}`]: -1,
      };
      model.variables[`dev_neg_${paymentId}`] = {
        deviation: 1,
        [`balance_${paymentId}`]: 1,
      };
    });

    const solution = solver.Solve(model);

    if (!solution || !solution.feasible) {
      return NextResponse.json(
        { error: "No feasible redistribution found." },
        { status: 400 }
      );
    }

    const paymentsResult: Record<string, any> = {};
    const updates: Array<{
      source_table: string;
      id: number;
      from_payment_id: string | null;
      to_payment_id: string;
    }> = [];

    paymentIds.forEach((paymentId: string) => {
      paymentsResult[paymentId] = {
        target: targets[paymentId],
        total: 0,
        diff: 0,
        transactions: [],
      };
    });

    items.forEach((item, index) => {
      paymentIds.forEach((paymentId: string) => {
        const variable = `x_${index}_${paymentId}`;
        if (solution[variable] && solution[variable] >= 0.5) {
          paymentsResult[paymentId].transactions.push({
            source_table: item.source_table,
            id: item.id,
            uuid: item.uuid,
            payment_id: item.payment_id,
            transaction_date: item.transaction_date,
            amount: item.amount,
          });
          paymentsResult[paymentId].total += item.amount;
          if (item.payment_id !== paymentId) {
            updates.push({
              source_table: item.source_table,
              id: item.id,
              from_payment_id: item.payment_id || null,
              to_payment_id: paymentId,
            });
          }
        }
      });
    });

    Object.keys(paymentsResult).forEach((paymentId) => {
      const total = paymentsResult[paymentId].total;
      paymentsResult[paymentId].diff = total - targets[paymentId];
    });

    const objectiveAbsDeviation = Object.values(paymentsResult).reduce(
      (sum: number, row: any) => sum + Math.abs(row.diff),
      0
    );

    return NextResponse.json({
      objective_abs_deviation: objectiveAbsDeviation,
      payments: paymentsResult,
      updates,
    });
  } catch (error: any) {
    console.error("POST /api/payment-redistribution/optimize failed:", error);
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
