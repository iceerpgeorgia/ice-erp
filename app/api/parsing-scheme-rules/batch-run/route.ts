import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ruleIds } = await request.json();

    if (!Array.isArray(ruleIds) || ruleIds.length === 0) {
      return NextResponse.json(
        { error: 'Rule IDs array is required' },
        { status: 400 }
      );
    }

    console.log(`Processing ${ruleIds.length} rules...`);

    const results: Array<{
      ruleId: number;
      matchedRecords: number;
      success: boolean;
      error?: string;
    }> = [];

    for (const ruleId of ruleIds) {
      try {
        // Fetch rule details
        type RuleData = {
          id: bigint;
          condition: string;
          condition_script: string | null;
          counteragentUuid: string | null;
          financial_code_uuid: string | null;
          nominal_currency_uuid: string | null;
          payment_id: string | null;
        };

        const rules = await prisma.$queryRawUnsafe<RuleData[]>(`
          SELECT id, condition, condition_script, counteragent_uuid,
                 financial_code_uuid, nominal_currency_uuid, payment_id
          FROM parsing_scheme_rules
          WHERE id = $1
        `, Number(ruleId));

        if (rules.length === 0) {
          results.push({
            ruleId,
            matchedRecords: 0,
            success: false,
            error: 'Rule not found'
          });
          continue;
        }

        const ruleData = rules[0];

        if (!ruleData.condition_script) {
          results.push({
            ruleId,
            matchedRecords: 0,
            success: false,
            error: 'Rule has no compiled script'
          });
          continue;
        }

        // Fetch raw records
        type RawRecord = {
          uuid: string;
          transaction_date: Date | null;
          debit: string | null;
          credit: string | null;
          description: string | null;
          docinformation: string | null;
          sender_account: string | null;
          beneficiary_account: string | null;
          sender_name: string | null;
          beneficiary_name: string | null;
          processing_case: string | null;
          [key: string]: any;
        };

        const rawRecords = await prisma.$queryRawUnsafe<RawRecord[]>(`
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

        // Evaluate the condition script
        const evalFunction = eval(ruleData.condition_script);
        const matchingRecords = rawRecords.filter(record => {
          try {
            return evalFunction(record);
          } catch (err) {
            console.error('Error evaluating record:', err);
            return false;
          }
        });

        console.log(`Rule ${ruleId}: Found ${matchingRecords.length} matching records`);

        if (matchingRecords.length === 0) {
          results.push({
            ruleId,
            matchedRecords: 0,
            success: true
          });
          continue;
        }

        // Apply the rule
        const uuids = matchingRecords.map(r => r.uuid);

        // Update raw table
        await prisma.$queryRawUnsafe(`
          UPDATE bog_gel_raw_893486000
          SET 
            parsing_rule_applied = TRUE,
            parsing_rule_processed = TRUE,
            applied_rule_id = $1,
            updated_at = NOW()
          WHERE uuid = ANY($2::uuid[])
        `, Number(ruleData.id), uuids);

        // Fetch rule parameters
        const ruleWithParams = await prisma.$queryRawUnsafe<Array<{
          counteragentUuid: string | null;
          financial_code_uuid: string | null;
          nominal_currency_uuid: string | null;
        }>>(`
          SELECT counteragent_uuid, financial_code_uuid, nominal_currency_uuid
          FROM parsing_scheme_rules
          WHERE id = $1
        `, Number(ruleData.id));

        // Update consolidated table
        if (ruleWithParams.length > 0 && ruleWithParams[0].counteragent_uuid) {
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

        results.push({
          ruleId,
          matchedRecords: matchingRecords.length,
          success: true
        });

      } catch (error: any) {
        console.error(`Error processing rule ${ruleId}:`, error);
        results.push({
          ruleId,
          matchedRecords: 0,
          success: false,
          error: error.message
        });
      }
    }

    const totalMatched = results.reduce((sum, r) => sum + r.matchedRecords, 0);
    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      message: `Processed ${successCount} of ${ruleIds.length} rules. Applied to ${totalMatched} record(s).`,
      results
    });

  } catch (error: any) {
    console.error('Error in batch rule processing:', error);
    return NextResponse.json(
      { error: 'Failed to process rules', details: error.message },
      { status: 500 }
    );
  }
}
