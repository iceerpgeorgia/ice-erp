import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeSalary = searchParams.get('includeSalary') !== 'false';
    const projectionMonths = Math.max(0, parseInt(searchParams.get('projectionMonths') || '36', 10) || 36);

    const payments = await prisma.$queryRawUnsafe(`
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
      WHERE p.is_active = true
      ORDER BY p.created_at DESC
    `) as any[];

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
      return NextResponse.json(paymentOptions);
    }

    const salaryRows = await prisma.$queryRawUnsafe(`
      SELECT 
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
      WHERE sa.payment_id IS NOT NULL AND sa.payment_id <> ''
      ORDER BY sa.salary_month DESC, sa.created_at DESC
    `) as any[];

    const latestMonthResult = await prisma.$queryRawUnsafe(`
      SELECT MAX(salary_month) as latest_month
      FROM salary_accruals
    `) as any[];

    const latestMonthValue = latestMonthResult?.[0]?.latest_month as string | null;

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

    const projectionOptions: PaymentOption[] = [];
    if (latestMonthValue && projectionMonths > 0) {
      const latestMonthDate = new Date(latestMonthValue);
      const baseRows = salaryRows.filter((row) => String(row.salary_month) === String(latestMonthValue));
      for (let i = 1; i <= projectionMonths; i += 1) {
        const futureDate = new Date(latestMonthDate.getFullYear(), latestMonthDate.getMonth() + i, 1);
        baseRows.forEach((row) => {
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

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching payment ID options:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment ID options' },
      { status: 500 }
    );
  }
}
