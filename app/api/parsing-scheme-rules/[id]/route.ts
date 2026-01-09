import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateFormulaSync } from '@/lib/formula-validator';
import { compileFormulaToJS } from '@/lib/formula-compiler';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = BigInt(params.id);
    const body = await request.json();
    const { schemeUuid, condition, paymentId, counteragentUuid, financialCodeUuid, nominalCurrencyUuid } = body;

    // Validate: if updating, ensure either paymentId OR all three UUIDs are provided
    if (paymentId === null || counteragentUuid !== undefined || financialCodeUuid !== undefined || nominalCurrencyUuid !== undefined) {
      const hasPaymentId = !!paymentId;
      const hasAllUuids = !!counteragentUuid && !!financialCodeUuid && !!nominalCurrencyUuid;
      const hasNoUuids = !counteragentUuid && !financialCodeUuid && !nominalCurrencyUuid;
      
      if (!hasPaymentId && !hasAllUuids && !hasNoUuids) {
        return NextResponse.json(
          { error: 'Either paymentId OR all three UUIDs (counteragentUuid, financialCodeUuid, nominalCurrencyUuid) must be provided' },
          { status: 400 }
        );
      }
    }

    // Validate formula syntax and compile if condition is being updated
    let conditionScript = undefined;
    if (condition) {
      const validation = validateFormulaSync(condition);
      if (!validation.valid) {
        return NextResponse.json(
          { error: `Invalid formula: ${validation.error}` },
          { status: 400 }
        );
      }
      conditionScript = compileFormulaToJS(condition);
    }

    const result = await prisma.$queryRaw<Array<{
      id: bigint;
      scheme_uuid: string;
      condition: string;
      condition_script: string | null;
      payment_id: string | null;
      counteragent_uuid: string | null;
      financial_code_uuid: string | null;
      nominal_currency_uuid: string | null;
    }>>`
      UPDATE parsing_scheme_rules
      SET 
        scheme_uuid = COALESCE(${schemeUuid}::uuid, scheme_uuid),
        condition = COALESCE(${condition}, condition),
        condition_script = COALESCE(${conditionScript}, condition_script),
        payment_id = COALESCE(${paymentId}, payment_id),
        counteragent_uuid = COALESCE(${counteragentUuid}::uuid, counteragent_uuid),
        financial_code_uuid = COALESCE(${financialCodeUuid}::uuid, financial_code_uuid),
        nominal_currency_uuid = COALESCE(${nominalCurrencyUuid}::uuid, nominal_currency_uuid)
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    const rule = result[0];
    return NextResponse.json({
      id: Number(rule.id),
      schemeUuid: rule.scheme_uuid,
      condition: rule.condition,
      paymentId: rule.payment_id,
      counteragentUuid: rule.counteragent_uuid,
      financialCodeUuid: rule.financial_code_uuid,
      nominalCurrencyUuid: rule.nominal_currency_uuid
    });
  } catch (error) {
    console.error('Error updating parsing scheme rule:', error);
    return NextResponse.json(
      { error: 'Failed to update parsing scheme rule' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = BigInt(params.id);

    await prisma.$executeRaw`
      DELETE FROM parsing_scheme_rules WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting parsing scheme rule:', error);
    return NextResponse.json(
      { error: 'Failed to delete parsing scheme rule' },
      { status: 500 }
    );
  }
}
