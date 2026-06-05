import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getSourceTables } from '@/lib/source-tables';

const RATE_EPSILON = 0.01;

const round2 = (value: number) => Math.round(value * 100) / 100;

const sanitizeRate = (value: unknown): number | null => {
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return rate;
};

const calcRate = (accountSum: unknown, nominalSum: unknown): number | null => {
  const account = Number(accountSum ?? 0);
  const nominal = Number(nominalSum ?? 0);
  if (!Number.isFinite(account) || !Number.isFinite(nominal) || nominal === 0) return null;
  const rate = account / nominal;
  if (!Number.isFinite(rate) || rate === 0) return null;
  return rate;
};

const queryConsolidatedRate = async (paymentId: string, projectUuid?: string | null) => {
  if (!projectUuid) {
    const rows = await prisma.$queryRaw<{ account_sum: unknown; nominal_sum: unknown }[]>`
      SELECT SUM(account_currency_amount) as account_sum, SUM(nominal_amount) as nominal_sum 
      FROM consolidated_bank_accounts 
      WHERE payment_id = ${paymentId}`;
    const first = Array.isArray(rows) ? rows[0] : null;
    return calcRate(first?.account_sum, first?.nominal_sum);
  }

  const rows = await prisma.$queryRaw<{ account_sum: unknown; nominal_sum: unknown }[]>`
    SELECT SUM(account_currency_amount) as account_sum, SUM(nominal_amount) as nominal_sum 
    FROM consolidated_bank_accounts 
    WHERE payment_id = ${paymentId} AND project_uuid = ${projectUuid}::uuid`;
  const first = Array.isArray(rows) ? rows[0] : null;
  return calcRate(first?.account_sum, first?.nominal_sum);
};

const queryRawRate = async (paymentId: string, projectUuid?: string | null) => {
  const sourceTables = await getSourceTables();
  if (!sourceTables.length) return null;

  const projectFilter = projectUuid 
    ? Prisma.sql` AND project_uuid = ${projectUuid}::uuid`
    : Prisma.empty;

  const unions = sourceTables.map((name) => 
    Prisma.sql`SELECT account_currency_amount::numeric as account_sum, nominal_amount::numeric as nominal_sum FROM ${Prisma.raw(`"${name}"`)} WHERE payment_id = ${paymentId}${projectFilter}`
  );

  if (!unions.length) return null;

  const sql = Prisma.sql`SELECT SUM(account_sum) as account_sum, SUM(nominal_sum) as nominal_sum FROM (${Prisma.join(unions, ' UNION ALL ')}) t`;
  const rows = await prisma.$queryRaw<{ account_sum: unknown; nominal_sum: unknown }[]>(sql);
  const first = Array.isArray(rows) ? rows[0] : null;
  return calcRate(first?.account_sum, first?.nominal_sum);
};

export const resolveAccountCurrencyRate = async (
  paymentUuid: string,
  projectUuid?: string | null,
  fallbackRate?: number | null,
) => {
  const paymentRows = await prisma.$queryRaw<{ payment_id: string; project_uuid: string | null }[]>`
    SELECT payment_id, project_uuid::text as project_uuid 
    FROM payments 
    WHERE record_uuid = ${paymentUuid}::uuid`;
  const payment = Array.isArray(paymentRows) ? paymentRows[0] : null;
  const paymentId = payment?.payment_id ?? null;
  const resolvedProject = projectUuid ?? payment?.project_uuid ?? null;

  const fallback = sanitizeRate(fallbackRate) ?? 1;
  if (!paymentId) {
    return { rate: fallback, source: 'fallback' as const };
  }

  const consolidatedRate = await queryConsolidatedRate(paymentId, resolvedProject);
  if (consolidatedRate !== null) {
    return { rate: consolidatedRate, source: 'consolidated' as const };
  }

  const rawRate = await queryRawRate(paymentId, resolvedProject);
  if (rawRate !== null) {
    return { rate: rawRate, source: 'raw' as const };
  }

  return { rate: fallback, source: 'fallback' as const };
};

export const applyAccountCurrencyRate = (
  amount: number,
  amountAccountCurr: number | null | undefined,
  rate: number,
) => {
  if (!Number.isFinite(amount)) return amountAccountCurr ?? amount;
  const shouldRecalc = Number.isFinite(rate) && Math.abs(rate - 1) > RATE_EPSILON;
  const current = amountAccountCurr != null ? Number(amountAccountCurr) : null;

  if (!shouldRecalc) {
    return current ?? amount;
  }

  if (current == null || Math.abs(current - amount) < RATE_EPSILON) {
    return round2(amount * rate);
  }

  return current;
};
