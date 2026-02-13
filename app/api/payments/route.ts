import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { reparseByPaymentId } from '@/lib/bank-import/reparse';

export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit');
    const sort = searchParams.get('sort');

    const parsedLimit = Number.parseInt(limit ?? '', 10);
    const limitClause = Number.isFinite(parsedLimit) && parsedLimit > 0 ? `LIMIT ${parsedLimit}` : '';
    const orderClause = sort === 'desc' ? 'DESC' : 'ASC';
    
    const payments = await prisma.$queryRawUnsafe(`
      SELECT 
        p.id,
        p.project_uuid,
        p.counteragent_uuid,
        p.financial_code_uuid,
        p.job_uuid,
        p.income_tax,
        p.currency_uuid,
        p.accrual_source,
        to_jsonb(p)->>'label' as label,
        p.payment_id,
        p.record_uuid,
        p.is_active,
        p.created_at,
        p.updated_at,
        proj.project_index,
        proj.project_name,
        c.counteragent as counteragent_name,
        fc.validation as financial_code_validation,
        fc.validation as financial_code,
        j.job_name,
        j.job_uuid as job_identifier,
        curr.code as currency_code
      FROM payments p
      LEFT JOIN projects proj ON p.project_uuid = proj.project_uuid
      LEFT JOIN counteragents c ON p.counteragent_uuid = c.counteragent_uuid
      LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
      LEFT JOIN jobs j ON p.job_uuid = j.job_uuid
      LEFT JOIN currencies curr ON p.currency_uuid = curr.uuid
      ORDER BY p.created_at ${orderClause}
      ${limitClause}
    `) as any[];

    const formattedPayments = payments.map((payment) => ({
      id: Number(payment.id),
      project_uuid: payment.project_uuid,
      counteragent_uuid: payment.counteragent_uuid,
      financial_code_uuid: payment.financial_code_uuid,
      jobUuid: payment.job_uuid,
      incomeTax: payment.income_tax,
      currencyUuid: payment.currency_uuid,
      accrualSource: payment.accrual_source,
      label: payment.label ?? null,
      paymentId: payment.payment_id,
      recordUuid: payment.record_uuid,
      is_active: payment.is_active,
      createdAt: payment.created_at,
      updatedAt: payment.updated_at,
      projectIndex: payment.project_index,
      projectName: payment.project_name,
      counteragentName: payment.counteragent_name,
      financialCodeValidation: payment.financial_code_validation,
      financialCode: payment.financial_code,
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
    const { projectUuid, counteragentUuid, financialCodeUuid, jobUuid, incomeTax, currencyUuid, paymentId, accrualSource, label } = body;

    const paymentIdPattern = /^[0-9a-f]{6}_[0-9a-f]{2}_[0-9a-f]{6}$/i;

    // Validation - only counteragent, financial code, currency, and incomeTax are required
    if (!counteragentUuid || !financialCodeUuid || incomeTax === undefined || !currencyUuid) {
      return NextResponse.json(
        { error: 'Missing required fields: counteragentUuid, financialCodeUuid, incomeTax, and currencyUuid are required' },
        { status: 400 }
      );
    }

    // Validate payment_id format when provided
    if (paymentId && !paymentIdPattern.test(paymentId)) {
      return NextResponse.json(
        { error: 'Invalid payment_id format. Expected 6_2_6 hex format.' },
        { status: 400 }
      );
    }

    // Prevent duplicates by payment_id when provided
    if (paymentId) {
      const existingByPaymentId = await prisma.$queryRawUnsafe<Array<{ payment_id: string }>>(
        `SELECT payment_id FROM payments WHERE payment_id = $1 LIMIT 1`,
        paymentId
      );
      if (existingByPaymentId.length > 0) {
        return NextResponse.json(
          { error: 'Payment with this payment_id already exists', paymentId },
          { status: 409 }
        );
      }
    }

    // Prevent duplicates by composite fields (handles nulls)
    const existingByComposite = await prisma.$queryRawUnsafe<Array<{ payment_id: string }>>(
      `SELECT payment_id
       FROM payments
       WHERE counteragent_uuid = $1::uuid
         AND financial_code_uuid = $2::uuid
         AND currency_uuid = $3::uuid
         AND income_tax = $4::boolean
         AND project_uuid IS NOT DISTINCT FROM $5::uuid
         AND job_uuid IS NOT DISTINCT FROM $6::uuid
         AND is_active = true
       LIMIT 1`,
      counteragentUuid,
      financialCodeUuid,
      currencyUuid,
      incomeTax,
      projectUuid || null,
      jobUuid || null
    );

    if (existingByComposite.length > 0) {
      return NextResponse.json(
        {
          error: 'Payment with the same counteragent, financial code, currency, income tax, project, and job already exists',
          paymentId: existingByComposite[0].payment_id,
        },
        { status: 409 }
      );
    }

    const insertPayment = async (includeLabel: boolean) => {
      if (includeLabel) {
        return prisma.$queryRaw`
          INSERT INTO payments (
            project_uuid,
            counteragent_uuid,
            financial_code_uuid,
            job_uuid,
            income_tax,
            currency_uuid,
            accrual_source,
            label,
            payment_id,
            record_uuid,
            updated_at
          ) VALUES (
            ${projectUuid || null}::uuid,
            ${counteragentUuid}::uuid,
            ${financialCodeUuid}::uuid,
            ${jobUuid || null}::uuid,
            ${incomeTax}::boolean,
            ${currencyUuid}::uuid,
            ${accrualSource || null},
            ${label || null},
            ${paymentId || ''},
            '',
            NOW()
          )
          RETURNING *
        `;
      }

      return prisma.$queryRaw`
        INSERT INTO payments (
          project_uuid,
          counteragent_uuid,
          financial_code_uuid,
          job_uuid,
          income_tax,
          currency_uuid,
          accrual_source,
          payment_id,
          record_uuid,
          updated_at
        ) VALUES (
          ${projectUuid || null}::uuid,
          ${counteragentUuid}::uuid,
          ${financialCodeUuid}::uuid,
          ${jobUuid || null}::uuid,
          ${incomeTax}::boolean,
          ${currencyUuid}::uuid,
          ${accrualSource || null},
          ${paymentId || ''},
          '',
          NOW()
        )
        RETURNING *
      `;
    };

    let result;
    try {
      result = await insertPayment(label !== undefined);
    } catch (error: any) {
      const message = String(error?.message || '').toLowerCase();
      if (message.includes('label') && message.includes('column')) {
        result = await insertPayment(false);
      } else {
        throw error;
      }
    }

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
    const {
      projectUuid,
      counteragentUuid,
      financialCodeUuid,
      jobUuid,
      incomeTax,
      currencyUuid,
      paymentId,
      accrualSource,
      label,
      isActive,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Payment ID is required' },
        { status: 400 }
      );
    }

    const existingRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM payments WHERE id = $1 LIMIT 1`,
      BigInt(id)
    );

    if (!existingRows || existingRows.length === 0) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    const existing = existingRows[0];

    if (
      projectUuid === undefined &&
      counteragentUuid === undefined &&
      financialCodeUuid === undefined &&
      jobUuid === undefined &&
      incomeTax === undefined &&
      currencyUuid === undefined &&
      paymentId === undefined &&
      accrualSource === undefined &&
      label === undefined &&
      isActive === undefined
    ) {
      return NextResponse.json(
        { error: 'At least one field to update is required' },
        { status: 400 }
      );
    }

    const normalizedProjectUuid = projectUuid === '' ? null : projectUuid;
    const normalizedJobUuid = jobUuid === '' ? null : jobUuid;
    const normalizedPaymentId = paymentId === '' ? null : paymentId;
    const normalizedAccrualSource = accrualSource === '' ? null : accrualSource;
    const normalizedLabel = label === '' ? null : label;

    const nextCounteragentUuid = counteragentUuid ?? existing.counteragent_uuid;
    const nextFinancialCodeUuid = financialCodeUuid ?? existing.financial_code_uuid;
    const nextCurrencyUuid = currencyUuid ?? existing.currency_uuid;
    const nextIncomeTax = incomeTax ?? existing.income_tax;
    const nextProjectUuid = normalizedProjectUuid !== undefined ? normalizedProjectUuid : existing.project_uuid;
    const nextJobUuid = normalizedJobUuid !== undefined ? normalizedJobUuid : existing.job_uuid;

    if (!nextCounteragentUuid || !nextFinancialCodeUuid || !nextCurrencyUuid || typeof nextIncomeTax !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields: counteragentUuid, financialCodeUuid, currencyUuid, incomeTax' },
        { status: 400 }
      );
    }

    if (normalizedPaymentId !== undefined && normalizedPaymentId !== existing.payment_id) {
      if (normalizedPaymentId) {
        const existingByPaymentId = await prisma.$queryRawUnsafe<Array<{ payment_id: string }>>(
          `SELECT payment_id FROM payments WHERE payment_id = $1 AND id <> $2 LIMIT 1`,
          normalizedPaymentId,
          BigInt(id)
        );
        if (existingByPaymentId.length > 0) {
          return NextResponse.json(
            { error: 'Payment with this payment_id already exists', paymentId: normalizedPaymentId },
            { status: 409 }
          );
        }
      }
    }

    const existingByComposite = await prisma.$queryRawUnsafe<Array<{ payment_id: string }>>(
      `SELECT payment_id
       FROM payments
       WHERE counteragent_uuid = $1::uuid
         AND financial_code_uuid = $2::uuid
         AND currency_uuid = $3::uuid
         AND income_tax = $4::boolean
         AND project_uuid IS NOT DISTINCT FROM $5::uuid
         AND job_uuid IS NOT DISTINCT FROM $6::uuid
         AND is_active = true
         AND id <> $7
       LIMIT 1`,
      nextCounteragentUuid,
      nextFinancialCodeUuid,
      nextCurrencyUuid,
      nextIncomeTax,
      nextProjectUuid,
      nextJobUuid,
      BigInt(id)
    );

    if (existingByComposite.length > 0) {
      return NextResponse.json(
        {
          error: 'Payment with the same counteragent, financial code, currency, income tax, project, and job already exists',
          paymentId: existingByComposite[0].payment_id,
        },
        { status: 409 }
      );
    }

    const buildUpdate = (includeLabel: boolean) => {
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      const pushUpdate = (column: string, value: any, cast = '') => {
        updates.push(`${column} = $${paramIndex++}${cast}`);
        values.push(value);
      };

      if (normalizedProjectUuid !== undefined && normalizedProjectUuid !== existing.project_uuid) {
        pushUpdate('project_uuid', normalizedProjectUuid, '::uuid');
      }
      if (counteragentUuid !== undefined && counteragentUuid !== existing.counteragent_uuid) {
        pushUpdate('counteragent_uuid', counteragentUuid, '::uuid');
      }
      if (financialCodeUuid !== undefined && financialCodeUuid !== existing.financial_code_uuid) {
        pushUpdate('financial_code_uuid', financialCodeUuid, '::uuid');
      }
      if (normalizedJobUuid !== undefined && normalizedJobUuid !== existing.job_uuid) {
        pushUpdate('job_uuid', normalizedJobUuid, '::uuid');
      }
      if (incomeTax !== undefined && incomeTax !== existing.income_tax) {
        pushUpdate('income_tax', incomeTax, '::boolean');
      }
      if (currencyUuid !== undefined && currencyUuid !== existing.currency_uuid) {
        pushUpdate('currency_uuid', currencyUuid, '::uuid');
      }
      if (normalizedPaymentId !== undefined && normalizedPaymentId !== existing.payment_id) {
        pushUpdate('payment_id', normalizedPaymentId);
      }
      if (normalizedAccrualSource !== undefined && normalizedAccrualSource !== existing.accrual_source) {
        pushUpdate('accrual_source', normalizedAccrualSource);
      }
      if (includeLabel && normalizedLabel !== undefined && normalizedLabel !== existing.label) {
        pushUpdate('label', normalizedLabel);
      }
      if (isActive !== undefined && isActive !== existing.is_active) {
        pushUpdate('is_active', isActive, '::boolean');
      }

      return { updates, values, paramIndex };
    };
    let updatePayload = buildUpdate(true);

    if (updatePayload.updates.length === 0) {
      return NextResponse.json({ success: true, message: 'No changes to apply' });
    }

    updatePayload.updates.push('updated_at = NOW()');
    updatePayload.values.push(BigInt(id));

    try {
      await prisma.$executeRawUnsafe(
        `UPDATE payments SET ${updatePayload.updates.join(', ')} WHERE id = $${updatePayload.paramIndex}`,
        ...updatePayload.values
      );
    } catch (error: any) {
      const message = String(error?.message || '').toLowerCase();
      if (message.includes('label') && message.includes('column')) {
        updatePayload = buildUpdate(false);
        if (updatePayload.updates.length === 0) {
          return NextResponse.json({ success: true, message: 'No changes to apply' });
        }
        updatePayload.updates.push('updated_at = NOW()');
        updatePayload.values.push(BigInt(id));
        await prisma.$executeRawUnsafe(
          `UPDATE payments SET ${updatePayload.updates.join(', ')} WHERE id = $${updatePayload.paramIndex}`,
          ...updatePayload.values
        );
      } else {
        throw error;
      }
    }

    const paymentIdToReparse = normalizedPaymentId ?? existing.payment_id;
    if (paymentIdToReparse) {
      await reparseByPaymentId(paymentIdToReparse);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating payment:', error);
    return NextResponse.json(
      { error: 'Failed to update payment' },
      { status: 500 }
    );
  }
}

