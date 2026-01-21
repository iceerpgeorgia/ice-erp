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

    // Get the rule with its compiled script
    const rule = await prisma.$queryRawUnsafe<Array<{
      id: bigint;
      condition: string;
      condition_script: string | null;
      counteragentUuid: string | null;
      financial_code_uuid: string | null;
      nominal_currency_uuid: string | null;
      payment_id: string | null;
    }>>(`
      SELECT id, condition, condition_script, counteragent_uuid, 
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
    
    if (!ruleData.condition_script) {
      return NextResponse.json(
        { error: 'Rule has no compiled script - condition_script is null' },
        { status: 400 }
      );
    }

    
    // Get all raw records and evaluate the formula against each one
    const allRecords = await prisma.$queryRawUnsafe<Array<any>>(`
      SELECT 
        uuid,
        DocRecDate as transaction_date,
        EntryDbAmt as debit,
        EntryCrAmt as credit,
        DocInformation as description,
        DocInformation as docinformation,
        DocSenderAcctNo as sender_account,
        DocBenefAcctNo as beneficiary_account,
        DocSenderName as sender_name,
        DocBenefName as beneficiary_name,
        processing_case,
        DocProdGroup,
        DocCorAcct,
        DocSenderInn,
        DocBenefInn
      FROM bog_gel_raw_893486000
      LIMIT 50000
    `);

    // Evaluate the condition_script against each record
    const matchingRecords: any[] = [];
    
    console.log('Testing rule with compiled script:', ruleData.condition_script);
    
    for (const record of allRecords) {
      try {
        // Evaluate the compiled function (which is wrapped as a function)
        const evalFunc = eval(ruleData.condition_script);
        
        if (evalFunc(record)) {
          matchingRecords.push(record);
        }
      } catch (evalError) {
        console.error(`Error evaluating rule ${ruleId} against record ${record.uuid}:`, evalError);
        // Continue processing other records even if one fails
      }
    }

    const matchCount = matchingRecords.length;

    if (matchCount === 0) {
      return NextResponse.json({
        success: true,
        matchCount: 0,
        records: [],
        message: 'No records match this rule',
        applied: false,
        formula: ruleData.condition
      });
    }

    // If not applying, return count and all matching records
    if (!apply) {
      return NextResponse.json({
        success: true,
        matchCount,
        records: matchingRecords, // Return all matching records
        ruleId: Number(ruleData.id),
        formula: ruleData.condition,
        message: `Found ${matchCount} record(s) matching this rule`,
        applied: false
      });
    }

    // Apply the rule to all matching records
    const uuids = matchingRecords.map(r => r.uuid);
    
    await prisma.$queryRawUnsafe(`
      UPDATE bog_gel_raw_893486000
      SET 
        parsing_rule_applied = TRUE,
        parsing_rule_processed = TRUE,
        applied_rule_id = $1,
        updated_at = NOW()
      WHERE uuid = ANY($2::uuid[])
    `, Number(ruleData.id), uuids);

    // Now update consolidated_bank_accounts with the rule's parameters
    // Get the rule's counteragent, project, financial code, and currency
    const ruleWithParams = await prisma.$queryRawUnsafe<Array<{
      counteragentUuid: string | null;
      financial_code_uuid: string | null;
      nominal_currency_uuid: string | null;
    }>>(`
      SELECT counteragent_uuid, financial_code_uuid, nominal_currency_uuid
      FROM parsing_scheme_rules
      WHERE id = $1
    `, Number(ruleData.id));
    
    if (ruleWithParams.length > 0 && ruleWithParams[0].counteragent_uuid) {
      // Update consolidated records with the rule's parameters
      await prisma.$queryRawUnsafe(`
        UPDATE consolidated_bank_accounts
        SET 
          counteragent_uuid = $1::uuid,
          financial_code_uuid = COALESCE($2::uuid, financial_code_uuid),
          nominal_currency_uuid = COALESCE($3::uuid, nominal_currency_uuid),
          processing_case = $5,
          updated_at = NOW()
        WHERE raw_record_uuid = ANY($4::uuid[])
      `, 
        ruleWithParams[0].counteragent_uuid,
        ruleWithParams[0].financial_code_uuid,
        ruleWithParams[0].nominal_currency_uuid,
        uuids,
        `Applied rule manually, rule ID ${ruleData.id}`
      );
    }

    return NextResponse.json({
      success: true,
      matchCount,
      ruleId: Number(ruleData.id),
      formula: ruleData.condition,
      message: `Applied rule to ${matchCount} record(s) and updated consolidated table`,
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
