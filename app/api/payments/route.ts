import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const payments = await prisma.$queryRawUnsafe(`
      SELECT 
        p.id,
        p.project_uuid,
        p.counteragent_uuid,
        p.financial_code_uuid,
        p.job_uuid,
        p.income_tax,
        p.currency_uuid,
        p.payment_id,
        p.record_uuid,
        p.is_active,
        p.created_at,
        p.updated_at,
        proj.project_index,
        c.counteragent as counteragent_name,
        fc.validation as financial_code_validation,
        j.job_name,
        j.job_uuid as job_identifier,
        curr.code as currency_code
      FROM payments p
      LEFT JOIN projects proj ON p.project_uuid = proj.project_uuid
      LEFT JOIN counteragents c ON p.counteragent_uuid = c.counteragent_uuid
      LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
      LEFT JOIN jobs j ON p.job_uuid = j.job_uuid
      LEFT JOIN currencies curr ON p.currency_uuid = curr.uuid
      ORDER BY p.created_at DESC
    `) as any[];

    const formattedPayments = payments.map((payment) => ({
      id: Number(payment.id),
      projectUuid: payment.project_uuid,
      counteragentUuid: payment.counteragent_uuid,
      financialCodeUuid: payment.financial_code_uuid,
      jobUuid: payment.job_uuid,
      incomeTax: payment.income_tax,
      currencyUuid: payment.currency_uuid,
      paymentId: payment.payment_id,
      recordUuid: payment.record_uuid,
      isActive: payment.is_active,
      createdAt: payment.created_at,
      updatedAt: payment.updated_at,
      projectIndex: payment.project_index,
      counteragentName: payment.counteragent_name,
      financialCodeValidation: payment.financial_code_validation,
      jobName: payment.job_name,
      jobIdentifier: payment.job_identifier,
      currencyCode: payment.currency_code,
    }));

    return NextResponse.json(formattedPayments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectUuid, counteragentUuid, financialCodeUuid, jobUuid, incomeTax, currencyUuid } = body;

    // Validation
    if (!projectUuid || !counteragentUuid || !financialCodeUuid || incomeTax === undefined || !currencyUuid) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Insert new payment (triggers will generate payment_id and record_uuid)
    const result = await prisma.$queryRaw`
      INSERT INTO payments (
        project_uuid,
        counteragent_uuid,
        financial_code_uuid,
        job_uuid,
        income_tax,
        currency_uuid,
        payment_id,
        record_uuid,
        updated_at
      ) VALUES (
        ${projectUuid}::uuid,
        ${counteragentUuid}::uuid,
        ${financialCodeUuid}::uuid,
        ${jobUuid ? `${jobUuid}` : null}::uuid,
        ${incomeTax}::boolean,
        ${currencyUuid}::uuid,
        '',
        '',
        NOW()
      )
      RETURNING *
    `;

    // Serialize BigInt values for JSON response
    const payment = Array.isArray(result) ? result[0] : result;
    const serializedPayment = {
      ...payment,
      id: Number((payment as any).id),
    };

    return NextResponse.json({ success: true, data: serializedPayment });
  } catch (error: any) {
    console.error('Error creating payment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create payment' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const body = await request.json();
    const { incomeTax } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Payment ID is required' },
        { status: 400 }
      );
    }

    if (incomeTax === undefined) {
      return NextResponse.json(
        { error: 'Income tax value is required' },
        { status: 400 }
      );
    }

    await prisma.$executeRaw`
      UPDATE payments 
      SET income_tax = ${incomeTax}::boolean, updated_at = NOW()
      WHERE id = ${BigInt(id)}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating payment:', error);
    return NextResponse.json(
      { error: 'Failed to update payment' },
      { status: 500 }
    );
  }
}
