import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const payments = await prisma.$queryRaw<Array<{
      id: bigint;
      project_uuid: string;
      counteragent_uuid: string;
      financial_code_uuid: string;
      job_uuid: string;
      payment_id: string;
      record_uuid: string;
      is_active: boolean;
      created_at: Date;
      updated_at: Date;
      project_index: string | null;
      counteragent_name: string | null;
      financial_code_validation: string | null;
      job_name: string | null;
      job_identifier: string | null;
    }>>`
      SELECT 
        p.id,
        p.project_uuid,
        p.counteragent_uuid,
        p.financial_code_uuid,
        p.job_uuid,
        p.payment_id,
        p.record_uuid,
        p.is_active,
        p.created_at,
        p.updated_at,
        proj.project_index,
        c.name as counteragent_name,
        fc.validation as financial_code_validation,
        j.job_name,
        j.job_uuid as job_identifier
      FROM payments p
      LEFT JOIN projects proj ON p.project_uuid = proj.project_uuid
      LEFT JOIN counteragents c ON p.counteragent_uuid = c.counteragent_uuid
      LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
      LEFT JOIN jobs j ON p.job_uuid = j.job_uuid
      ORDER BY p.created_at DESC
    `;

    const formattedPayments = payments.map((payment) => ({
      id: Number(payment.id),
      projectUuid: payment.project_uuid,
      counteragentUuid: payment.counteragent_uuid,
      financialCodeUuid: payment.financial_code_uuid,
      jobUuid: payment.job_uuid,
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
    const { projectUuid, counteragentUuid, financialCodeUuid, jobUuid } = body;

    // Validation
    if (!projectUuid || !counteragentUuid || !financialCodeUuid || !jobUuid) {
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
        payment_id,
        record_uuid,
        updated_at
      ) VALUES (
        ${projectUuid}::uuid,
        ${counteragentUuid}::uuid,
        ${financialCodeUuid}::uuid,
        ${jobUuid}::uuid,
        '',
        '',
        NOW()
      )
      RETURNING *
    `;

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error creating payment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create payment' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Payment ID is required' },
        { status: 400 }
      );
    }

    await prisma.$executeRaw`
      DELETE FROM payments WHERE id = ${BigInt(id)}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return NextResponse.json(
      { error: 'Failed to delete payment' },
      { status: 500 }
    );
  }
}
