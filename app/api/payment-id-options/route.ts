import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { prisma, withRetry } from '@/lib/prisma';
import { PAYMENT_OPTIONS_TAG } from '@/lib/cache-tags';

export const dynamic = 'force-dynamic';

type PaymentOption = {
  paymentId: string;
  counteragentUuid: string | null;
  projectUuid: string | null;
  jobUuid: string | null;
  financialCodeUuid: string | null;
  currencyUuid: string | null;
  projectIndex: string | null;
  projectName: string | null;
  counteragentName: string | null;
  financialCodeValidation: string | null;
  financialCode: string | null;
  jobName: string | null;
  currencyCode: string | null;
  incomeTax: boolean | null;
  source: 'payments' | 'salary_accruals' | 'salary_projection';
};

const updatePaymentIdForMonth = (paymentId: string, date: Date) => {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  if (/_PRL\d{2}\d{4}$/i.test(paymentId)) {
    return paymentId.replace(/_PRL\d{2}\d{4}$/i, `_PRL${mm}${yyyy}`);
  }
  if (paymentId.length >= 20) {
    return `${paymentId}_PRL${mm}${yyyy}`;
  }
  return paymentId;
};

// Persistent, tag-invalidatable cache. Shared across all Lambda instances on a
// single Vercel deployment. Refreshed on demand when payments / salary_accruals
// change (see revalidateTag(PAYMENT_OPTIONS_TAG) calls in mutation routes).
// Cache key is stable regardless of projectionMonths so all callers share the same entry.
const getCachedPaymentOptions = unstable_cache(
  async (
    includeSalary: boolean,
    projectionMonths: number,
    counteragentUuid: string | null,
    insiderUuid: string | null,
    currentPaymentId: string | null,
  ) =>
    buildPaymentOptions(includeSalary, projectionMonths, counteragentUuid, insiderUuid, currentPaymentId),
  ['payment-id-options-v5'],
  { tags: [PAYMENT_OPTIONS_TAG], revalidate: 300 },
);

export async function GET(request: NextRequest) {
  const t0 = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const includeSalary = searchParams.get('includeSalary') !== 'false';
    // Lower default from 36 to 12 months. Callers that genuinely need a wider
    // window can still pass ?projectionMonths=36 explicitly.
    const requestedProjectionMonths = searchParams.get('projectionMonths');
    const parsedProjectionMonths = requestedProjectionMonths === null
      ? 12
      : Number.parseInt(requestedProjectionMonths, 10);
    const projectionMonths = Number.isNaN(parsedProjectionMonths)
      ? 12
      : Math.max(0, parsedProjectionMonths);
    const requestedCounteragentUuid = searchParams.get('counteragentUuid')?.trim() || null;
    const validCounteragentUuid =
      !requestedCounteragentUuid ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        requestedCounteragentUuid
      );
    if (!validCounteragentUuid) {
      return NextResponse.json(
        { error: 'Invalid counteragentUuid' },
        { status: 400 }
      );
    }
    const counteragentUuid = requestedCounteragentUuid;
    const requestedBankAccountUuid = searchParams.get('bankAccountUuid')?.trim() || null;
    const validBankAccountUuid =
      !requestedBankAccountUuid ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        requestedBankAccountUuid
      );
    if (!validBankAccountUuid) {
      return NextResponse.json(
        { error: 'Invalid bankAccountUuid' },
        { status: 400 }
      );
    }

    let insiderUuid: string | null = null;
    if (requestedBankAccountUuid) {
      const bankAccount = await prisma.bankAccount.findUnique({
        where: { uuid: requestedBankAccountUuid },
        select: { insiderUuid: true },
      });
      if (!bankAccount) {
        return NextResponse.json(
          { error: 'Bank account not found' },
          { status: 404 }
        );
      }
      insiderUuid = bankAccount.insiderUuid;
    }
    const currentPaymentId = searchParams.get('currentPaymentId')?.trim() || null;

    const result = await getCachedPaymentOptions(
      includeSalary,
      projectionMonths,
      counteragentUuid,
      insiderUuid,
      currentPaymentId
    );
    const dur = Date.now() - t0;

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
        'Server-Timing': `total;dur=${dur}, rows;desc="${result.length}"`,
      },
    });
  } catch (error) {
    console.error('Error fetching payment ID options:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment ID options' },
      { status: 500 }
    );
  }
}

async function buildPaymentOptions(
  includeSalary: boolean,
  projectionMonths: number,
  counteragentUuid: string | null = null,
  insiderUuid: string | null = null,
  currentPaymentId: string | null = null,
): Promise<PaymentOption[]> {
  const paymentQueryArgs: string[] = [];
  const paymentConditions: string[] = [];

  if (counteragentUuid) {
    paymentQueryArgs.push(counteragentUuid);
    let condition = `p.counteragent_uuid = $${paymentQueryArgs.length}::uuid AND p.is_active = true`;
    if (insiderUuid) {
      paymentQueryArgs.push(insiderUuid);
      condition += ` AND COALESCE(proj.insider_uuid, p.insider_uuid) = $${paymentQueryArgs.length}::uuid`;
    }
    paymentConditions.push(condition);
  } else if (insiderUuid) {
    paymentQueryArgs.push(insiderUuid);
    paymentConditions.push(
      `COALESCE(proj.insider_uuid, p.insider_uuid) = $${paymentQueryArgs.length}::uuid AND p.is_active = true`
    );
  } else {
    paymentConditions.push('p.is_active = true');
  }

  if (currentPaymentId) {
    paymentQueryArgs.push(currentPaymentId);
    paymentConditions.push(`p.payment_id = $${paymentQueryArgs.length}`);
  }

  const payments = await withRetry(() => prisma.$queryRawUnsafe(`
      SELECT 
        p.project_uuid,
        p.counteragent_uuid,
        p.financial_code_uuid,
        p.job_uuid,
        p.income_tax,
        p.currency_uuid,
        p.payment_id,
        proj.project_index,
        proj.project_name,
        c.counteragent as counteragent_name,
        fc.validation as financial_code_validation,
        fc.validation as financial_code,
        j.job_name,
        curr.code as currency_code
      FROM payments p
      LEFT JOIN projects proj ON p.project_uuid = proj.project_uuid
      LEFT JOIN counteragents c ON p.counteragent_uuid = c.counteragent_uuid
      LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
      LEFT JOIN jobs j ON p.job_uuid = j.job_uuid
      LEFT JOIN currencies curr ON p.currency_uuid = curr.uuid
      WHERE ${paymentConditions.join(' OR ')}
      ORDER BY p.created_at DESC
    `, ...paymentQueryArgs)) as any[];

    const paymentOptions: PaymentOption[] = payments
      .filter((p) => p.payment_id)
      .map((p) => ({
        paymentId: p.payment_id,
        counteragentUuid: p.counteragent_uuid,
        projectUuid: p.project_uuid,
        jobUuid: p.job_uuid,
        financialCodeUuid: p.financial_code_uuid,
        currencyUuid: p.currency_uuid,
        projectIndex: p.project_index || null,
        projectName: p.project_name || null,
        counteragentName: p.counteragent_name || null,
        financialCodeValidation: p.financial_code_validation || null,
        financialCode: p.financial_code || null,
        jobName: p.job_name || null,
        currencyCode: p.currency_code || null,
        incomeTax: p.income_tax ?? null,
        source: 'payments',
      }));

    if (!includeSalary) {
      return paymentOptions;
    }

    const salaryQueryArgs: string[] = [];
    const salaryConditions = ["sa.payment_id IS NOT NULL AND sa.payment_id <> ''"];
    const salaryScopeConditions: string[] = [];
    if (counteragentUuid && insiderUuid) {
      salaryQueryArgs.push(counteragentUuid);
      salaryQueryArgs.push(insiderUuid);
      salaryScopeConditions.push(
        `(sa.counteragent_uuid = $${salaryQueryArgs.length - 1}::uuid AND sa.insider_uuid = $${salaryQueryArgs.length}::uuid)`
      );
    } else if (counteragentUuid) {
      salaryQueryArgs.push(counteragentUuid);
      salaryScopeConditions.push(`sa.counteragent_uuid = $${salaryQueryArgs.length}::uuid`);
    } else if (insiderUuid) {
      salaryQueryArgs.push(insiderUuid);
      salaryScopeConditions.push(`sa.insider_uuid = $${salaryQueryArgs.length}::uuid`);
    }
    if (currentPaymentId) {
      salaryQueryArgs.push(currentPaymentId);
      salaryScopeConditions.push(`sa.payment_id = $${salaryQueryArgs.length}`);
    }
    if (salaryScopeConditions.length > 0) {
      salaryConditions.push(`(${salaryScopeConditions.join(' OR ')})`);
    }

    const salaryRows = await withRetry(() => prisma.$queryRawUnsafe(`
      SELECT DISTINCT ON (sa.counteragent_uuid, sa.payment_id)
        sa.payment_id,
        sa.counteragent_uuid,
        sa.financial_code_uuid,
        sa.nominal_currency_uuid,
        sa.salary_month,
        ca.counteragent as counteragent_name,
        COALESCE(fc.validation, fc.code) as financial_code_validation,
        COALESCE(fc.validation, fc.code) as financial_code,
        curr.code as currency_code
      FROM salary_accruals sa
      LEFT JOIN counteragents ca ON sa.counteragent_uuid = ca.counteragent_uuid
      LEFT JOIN financial_codes fc ON sa.financial_code_uuid = fc.uuid
      LEFT JOIN currencies curr ON sa.nominal_currency_uuid = curr.uuid
      WHERE ${salaryConditions.join(' AND ')}
      ORDER BY sa.counteragent_uuid, sa.payment_id, sa.salary_month DESC
    `, ...salaryQueryArgs)) as any[];

    const salaryOptionsById = new Map<string, PaymentOption>();
    salaryRows.forEach((row) => {
      const paymentId = row.payment_id as string;
      const key = paymentId.toLowerCase();
      if (salaryOptionsById.has(key)) return;
      salaryOptionsById.set(key, {
        paymentId,
        counteragentUuid: row.counteragent_uuid,
        projectUuid: null,
        jobUuid: null,
        financialCodeUuid: row.financial_code_uuid,
        currencyUuid: row.nominal_currency_uuid,
        projectIndex: null,
        projectName: null,
        counteragentName: row.counteragent_name || null,
        financialCodeValidation: row.financial_code_validation || null,
        financialCode: row.financial_code || null,
        jobName: null,
        currencyCode: row.currency_code || null,
        incomeTax: null,
        source: 'salary_accruals',
      });
    });

    // Build projection base: for each counteragent, use their latest salary_month rows
    const projectionOptions: PaymentOption[] = [];
    if (projectionMonths > 0 && salaryRows.length > 0) {
      // Group rows by counteragent, keeping only the latest salary_month per counteragent
      const latestPerCA = new Map<string, { salaryMonth: Date; rows: any[] }>();
      for (const row of salaryRows) {
        const caUuid = row.counteragent_uuid as string;
        if (!caUuid) continue;
        const rowMonth = new Date(row.salary_month);
        const existing = latestPerCA.get(caUuid);
        if (!existing || rowMonth.getTime() > existing.salaryMonth.getTime()) {
          latestPerCA.set(caUuid, { salaryMonth: rowMonth, rows: [row] });
        } else if (rowMonth.getTime() === existing.salaryMonth.getTime()) {
          existing.rows.push(row);
        }
      }

      for (const [, { salaryMonth, rows }] of latestPerCA) {
        for (let i = 1; i <= projectionMonths; i += 1) {
          const futureDate = new Date(salaryMonth.getFullYear(), salaryMonth.getMonth() + i, 1);
          rows.forEach((row) => {
            const basePaymentId = row.payment_id as string;
            if (!basePaymentId) return;
            const projectedPaymentId = updatePaymentIdForMonth(basePaymentId, futureDate);
            projectionOptions.push({
              paymentId: projectedPaymentId,
              counteragentUuid: row.counteragent_uuid,
              projectUuid: null,
              jobUuid: null,
              financialCodeUuid: row.financial_code_uuid,
              currencyUuid: row.nominal_currency_uuid,
              projectIndex: null,
              projectName: null,
              counteragentName: row.counteragent_name || null,
              financialCodeValidation: row.financial_code_validation || null,
              financialCode: row.financial_code || null,
              jobName: null,
              currencyCode: row.currency_code || null,
              incomeTax: null,
              source: 'salary_projection',
            });
          });
        }
      }
    }

    const combined = new Map<string, PaymentOption>();
    paymentOptions.forEach((opt) => combined.set(opt.paymentId.toLowerCase(), opt));
    Array.from(salaryOptionsById.values()).forEach((opt) => {
      if (!combined.has(opt.paymentId.toLowerCase())) {
        combined.set(opt.paymentId.toLowerCase(), opt);
      }
    });
    projectionOptions.forEach((opt) => {
      if (!combined.has(opt.paymentId.toLowerCase())) {
        combined.set(opt.paymentId.toLowerCase(), opt);
      }
    });

    const result = Array.from(combined.values()).sort((a, b) =>
      a.paymentId.localeCompare(b.paymentId)
    );

    return result;
}
