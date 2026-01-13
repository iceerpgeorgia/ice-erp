import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Test a parsing rule against all transactions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ruleId, apply } = body;

    if (!ruleId) {
      return NextResponse.json(
        { error: 'ruleId is required' },
        { status: 400 }
      );
    }

    // Get the rule
    const rule = await prisma.$queryRawUnsafe(`
      SELECT id, column_name, condition, counteragent_uuid, 
             financial_code_uuid, nominal_currency_uuid, payment_id
      FROM parsing_scheme_rules
      WHERE id = $1
    `, ruleId);

    if (!rule || rule.length === 0) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      );
    }

    const ruleData = rule[0];

    // Parse the condition to extract column and value
    let columnName = ruleData.column_name;
    let conditionValue = ruleData.condition;

    if (!columnName && conditionValue && conditionValue.includes('=')) {
      const parts = conditionValue.split('=', 2);
      columnName = parts[0].trim();
      conditionValue = parts[1].trim().replace(/["']/g, '');
    }

    if (!columnName || !conditionValue) {
      return NextResponse.json(
        { error: 'Invalid rule format - missing column_name or condition' },
        { status: 400 }
      );
    }

    // Count matching records
    const countQuery = `
      SELECT COUNT(*) as count
      FROM bog_gel_raw_893486000
      WHERE LOWER(${columnName}) = LOWER($1)
    `;

    const countResult = await prisma.$queryRawUnsafe(countQuery, conditionValue);
    const matchCount = Number(countResult[0].count);

    if (matchCount === 0) {
      return NextResponse.json({
        success: true,
        matchCount: 0,
        records: [],
        message: 'No records match this rule',
        applied: false
      });
    }

    // If not applying, return count and sample records
    if (!apply) {
      // Get matching records (limit to 100 for preview)
      const recordsQuery = `
        SELECT 
          uuid,
          DocRecDate as transaction_date,
          EntryDbAmt as debit,
          EntryCrAmt as credit,
          DocInformation as description,
          DocSenderAcctNo as sender_account,
          DocBenefAcctNo as beneficiary_account,
          DocSenderName as sender_name,
          DocBenefName as beneficiary_name,
          ${columnName} as matched_column_value,
          processing_case
        FROM bog_gel_raw_893486000
        WHERE LOWER(${columnName}) = LOWER($1)
        ORDER BY DocRecDate DESC
        LIMIT 100
      `;

      const records = await prisma.$queryRawUnsafe(recordsQuery, conditionValue);

      return NextResponse.json({
        success: true,
        matchCount,
        records,
        ruleId,
        column: columnName,
        value: conditionValue,
        message: `Found ${matchCount} record(s) matching this rule`,
        applied: false
      });
    }

    // Apply the rule to all matching records
    const updateQuery = `
      UPDATE bog_gel_raw_893486000
      SET 
        parsing_rule_applied = TRUE,
        parsing_rule_processed = TRUE,
        applied_rule_id = $1,
        updated_at = NOW()
      WHERE LOWER(${columnName}) = LOWER($2)
    `;

    await prisma.$queryRawUnsafe(updateQuery, ruleId, conditionValue);

    // Trigger backparse to update consolidated table
    // (Could be done via API call or background job)

    return NextResponse.json({
      success: true,
      matchCount,
      ruleId,
      column: columnName,
      value: conditionValue,
      message: `Applied rule to ${matchCount} record(s)`,
      applied: true
    });

  } catch (error: any) {
    console.error('Error testing/applying rule:', error);
    return NextResponse.json(
      { error: 'Failed to test/apply rule', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/parsing-scheme-rules/test-rule',
    method: 'POST',
    description: 'Test or apply a parsing rule across all bank transactions',
    body: {
      ruleId: 'number (required) - The ID of the parsing rule to test/apply',
      apply: 'boolean (optional) - If true, applies the rule. If false/omitted, just counts matches'
    },
    example: {
      ruleId: 1,
      apply: false
    }
  });
}
