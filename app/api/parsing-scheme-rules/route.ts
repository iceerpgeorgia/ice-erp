import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateFormulaSync } from '@/lib/formula-validator';
import { compileFormulaToJS } from '@/lib/formula-compiler';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const schemeUuid = searchParams.get('schemeUuid');

    type RuleRow = {
      id: bigint;
      scheme_uuid: string;
      scheme: string;
      condition: string;
      condition_script: string | null;
      payment_id: bigint | null;
    };

    let rules: RuleRow[];
    if (schemeUuid) {
      rules = await prisma.$queryRaw<RuleRow[]>`
        SELECT r.*, s.scheme
        FROM parsing_scheme_rules r
        JOIN parsing_schemes s ON r.scheme_uuid = s.uuid
        WHERE r.scheme_uuid = ${schemeUuid}::uuid
        ORDER BY r.id DESC
      `;
    } else {
      rules = await prisma.$queryRaw<RuleRow[]>`
        SELECT r.*, s.scheme
        FROM parsing_scheme_rules r
        JOIN parsing_schemes s ON r.scheme_uuid = s.uuid
        ORDER BY s.scheme, r.id DESC
      `;
    }

    const formattedRules = rules.map(rule => ({
      id: Number(rule.id),
      schemeUuid: rule.scheme_uuid,
      scheme: rule.scheme,
      condition: rule.condition,
      paymentId: rule.payment_id
    }));

    return NextResponse.json(formattedRules);
  } catch (error) {
    console.error('Error fetching parsing scheme rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch parsing scheme rules' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { schemeUuid, condition, paymentId } = body;

    if (!schemeUuid || !condition || !paymentId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate formula syntax
    const validation = validateFormulaSync(condition);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Invalid formula: ${validation.error}` },
        { status: 400 }
      );
    }

    // Compile formula to JavaScript
    const conditionScript = compileFormulaToJS(condition);

    const result = await prisma.$queryRaw<Array<{
      id: bigint;
      scheme_uuid: string;
      condition: string;
      condition_script: string | null;
      payment_id: bigint | null;
    }>>`
      INSERT INTO parsing_scheme_rules (scheme_uuid, condition, condition_script, payment_id)
      VALUES (${schemeUuid}::uuid, ${condition}, ${conditionScript}, ${paymentId})
      RETURNING *
    `;

    const rule = result[0];
    return NextResponse.json({
      id: Number(rule.id),
      schemeUuid: rule.scheme_uuid,
      condition: rule.condition,
      paymentId: rule.payment_id
    });
  } catch (error) {
    console.error('Error creating parsing scheme rule:', error);
    return NextResponse.json(
      { error: 'Failed to create parsing scheme rule' },
      { status: 500 }
    );
  }
}
