import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper function to generate payment_id
function generatePaymentId(counteragentUuid: string, financial_code_uuid: string, salaryMonth: Date): string {
  // Extract characters at positions 2, 4, 6, 8, 10, 12 (1-indexed Excel MID)
  // This corresponds to indices 1, 3, 5, 7, 9, 11 (0-indexed) from UUID WITH hyphens
  const extractChars = (uuid: string) => {
    // Excel MID works on UUID WITH hyphens, so we DON'T remove them
    return uuid[1] + uuid[3] + uuid[5] + uuid[7] + uuid[9] + uuid[11];
  };
  
  const counteragentPart = extractChars(counteragentUuid);
  const financialPart = extractChars(financialCodeUuid);
  
  const month = salaryMonth.getMonth() + 1;
  const year = salaryMonth.getFullYear();
  const monthStr = month < 10 ? `0${month}` : `${month}`;
  
  return `NP_${counteragentPart}_NJ_${financialPart}_PRL${monthStr}${year}`;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (id) {
      // Fetch single record
      const accrual = await prisma.salary_accruals.findUnique({
        where: { id: BigInt(id) },
      });

      if (!accrual) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      // Fetch related data
      const [counteragent, financial_code, currency] = await Promise.all([
        prisma.$queryRaw<any[]>`
          SELECT counteragent_uuid, counteragent FROM counteragents WHERE counteragent_uuid = ${accrual.counteragent_uuid}::uuid LIMIT 1
        `,
        prisma.$queryRaw<any[]>`
          SELECT uuid, validation FROM financial_codes WHERE uuid = ${accrual.financial_code_uuid}::uuid LIMIT 1
        `,
        prisma.$queryRaw<any[]>`
          SELECT uuid, code FROM currencies WHERE uuid = ${accrual.nominal_currency_uuid}::uuid LIMIT 1
        `,
      ]);

      return NextResponse.json({
        ...accrual,
        id: accrual.id.toString(),
        counteragent_name: counteragent[0]?.counteragent || 'Unknown',
        financial_code: financial_code[0]?.validation || 'Unknown',
        currency_code: currency[0]?.code || 'Unknown',
        net_sum: accrual.net_sum.toString(),
        surplus_insurance: accrual.surplus_insurance?.toString() || null,
        deducted_insurance: accrual.deducted_insurance?.toString() || null,
        deducted_fitness: accrual.deducted_fitness?.toString() || null,
        deducted_fine: accrual.deducted_fine?.toString() || null,
      });
    }

    // Fetch all records with related data
    const accruals = await prisma.$queryRaw<any[]>`
      SELECT 
        sa.id,
        sa.uuid,
        sa.counteragent_uuid,
        sa.financial_code_uuid,
        sa.nominal_currency_uuid,
        sa.payment_id,
        sa.salary_month,
        sa.net_sum,
        sa.surplus_insurance,
        sa.deducted_insurance,
        sa.deducted_fitness,
        sa.deducted_fine,
        sa.created_at,
        sa.updated_at,
        c.counteragent as counteragent_name,
        fc.validation as financial_code,
        cur.code as currency_code
      FROM salary_accruals sa
      LEFT JOIN counteragents c ON sa.counteragent_uuid = c.counteragent_uuid
      LEFT JOIN financial_codes fc ON sa.financial_code_uuid = fc.uuid
      LEFT JOIN currencies cur ON sa.nominal_currency_uuid = cur.uuid
      ORDER BY sa.salary_month DESC, sa.created_at DESC
    `;

    const formattedAccruals = accruals.map((accrual) => ({
      ...accrual,
      id: accrual.id.toString(),
      net_sum: accrual.net_sum.toString(),
      surplus_insurance: accrual.surplus_insurance?.toString() || null,
      deducted_insurance: accrual.deducted_insurance?.toString() || null,
      deducted_fitness: accrual.deducted_fitness?.toString() || null,
      deducted_fine: accrual.deducted_fine?.toString() || null,
    }));

    return NextResponse.json(formattedAccruals);
  } catch (error: any) {
    console.error('Error fetching salary accruals:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      counteragent_uuid,
      financial_code_uuid,
      nominal_currency_uuid,
      salary_month,
      net_sum,
      surplus_insurance,
      deducted_insurance,
      deducted_fitness,
      deducted_fine,
      created_by,
    } = body;

    // Validate required fields
    if (!counteragent_uuid || !financial_code_uuid || !nominal_currency_uuid || !salary_month || net_sum === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Generate payment_id
    const salaryDate = new Date(salary_month);
    const payment_id = generatePaymentId(counteragent_uuid, financial_code_uuid, salaryDate);

    // Create the accrual
    const accrual = await prisma.salary_accruals.create({
      data: {
        counteragent_uuid,
        financial_code_uuid,
        nominal_currency_uuid,
        payment_id,
        salary_month: salaryDate,
        net_sum: parseFloat(net_sum),
        surplus_insurance: surplus_insurance ? parseFloat(surplus_insurance) : null,
        deducted_insurance: deducted_insurance ? parseFloat(deducted_insurance) : null,
        deducted_fitness: deducted_fitness ? parseFloat(deducted_fitness) : null,
        deducted_fine: deducted_fine ? parseFloat(deducted_fine) : null,
        created_by: created_by || 'system',
        updated_by: created_by || 'system',
      },
    });

    return NextResponse.json({
      ...accrual,
      id: accrual.id.toString(),
      payment_id,
    });
  } catch (error: any) {
    console.error('Error creating salary accrual:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      counteragent_uuid,
      financial_code_uuid,
      nominal_currency_uuid,
      salary_month,
      net_sum,
      surplus_insurance,
      deducted_insurance,
      deducted_fitness,
      deducted_fine,
      updated_by,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Regenerate payment_id if key fields changed
    const salaryDate = new Date(salary_month);
    const payment_id = generatePaymentId(counteragent_uuid, financial_code_uuid, salaryDate);

    const accrual = await prisma.salary_accruals.update({
      where: { id: BigInt(id) },
      data: {
        counteragent_uuid,
        financial_code_uuid,
        nominal_currency_uuid,
        payment_id,
        salary_month: salaryDate,
        net_sum: parseFloat(net_sum),
        surplus_insurance: surplus_insurance ? parseFloat(surplus_insurance) : null,
        deducted_insurance: deducted_insurance ? parseFloat(deducted_insurance) : null,
        deducted_fitness: deducted_fitness ? parseFloat(deducted_fitness) : null,
        deducted_fine: deducted_fine ? parseFloat(deducted_fine) : null,
        updatedAt: new Date(),
        updated_by: updated_by || 'system',
      },
    });

    return NextResponse.json({
      ...accrual,
      id: accrual.id.toString(),
    });
  } catch (error: any) {
    console.error('Error updating salary accrual:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await prisma.salary_accruals.delete({
      where: { id: BigInt(id) },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting salary accrual:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

