import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateFormulaSync } from '@/lib/formula-validator';
import { compileFormulaToJS } from '@/lib/formula-compiler';

const RAW_TABLE_NAME_RE = /^[A-Za-z0-9_]+$/;

const buildDeconsolidatedTableName = (
  accountNumber: string | null,
  schemeName: string | null,
  currencyCode: string | null
) => {
  if (!accountNumber || !schemeName) {
    return null;
  }
  if (schemeName.endsWith('_FX')) {
    if (!currencyCode) {
      return null;
    }
    const prefix = schemeName.replace(/_FX$/, '');
    return `${accountNumber}_${prefix}_${currencyCode}`;
  }
  return `${accountNumber}_${schemeName}`;
};

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
      payment_id: string | null;
      counteragent_uuid: string | null;
      financial_code_uuid: string | null;
      nominal_currency_uuid: string | null;
      active: boolean;
      counteragent_name: string | null;
      financial_code: string | null;
      currency_code: string | null;
      applied_count: bigint;
    };

    let rules: RuleRow[];
    if (schemeUuid) {
      rules = await prisma.$queryRaw<RuleRow[]>`
        SELECT r.*, s.scheme,
          ca.counteragent as counteragent_name,
          fc.code as financial_code,
          cur.code as currency_code,
          0::bigint as applied_count
        FROM parsing_scheme_rules r
        JOIN parsing_schemes s ON r.scheme_uuid = s.uuid
        LEFT JOIN counteragents ca ON r.counteragent_uuid = ca.counteragent_uuid
        LEFT JOIN financial_codes fc ON r.financial_code_uuid = fc.uuid
        LEFT JOIN currencies cur ON r.nominal_currency_uuid = cur.uuid
        WHERE r.scheme_uuid = ${schemeUuid}::uuid
        ORDER BY r.id DESC
      `;
    } else {
      rules = await prisma.$queryRaw<RuleRow[]>`
        SELECT r.*, s.scheme,
          ca.counteragent as counteragent_name,
          fc.code as financial_code,
          cur.code as currency_code,
          0::bigint as applied_count
        FROM parsing_scheme_rules r
        JOIN parsing_schemes s ON r.scheme_uuid = s.uuid
        LEFT JOIN counteragents ca ON r.counteragent_uuid = ca.counteragent_uuid
        LEFT JOIN financial_codes fc ON r.financial_code_uuid = fc.uuid
        LEFT JOIN currencies cur ON r.nominal_currency_uuid = cur.uuid
        ORDER BY s.scheme, r.id DESC
      `;
    }

    const appliedCounts = new Map<number, number>();
    const schemeUuids = Array.from(new Set(rules.map(rule => rule.scheme_uuid)));
    if (schemeUuids.length > 0) {
      try {
        const bankAccounts = await prisma.$queryRawUnsafe<Array<{
          raw_table_name: string;
          account_number: string | null;
          parsing_scheme_name: string | null;
          currency_code: string | null;
          scheme_uuid: string;
        }>>(`
          SELECT
            ba.raw_table_name,
            ba.account_number,
            ps.scheme as parsing_scheme_name,
            c.code as currency_code,
            ba.parsing_scheme_uuid as scheme_uuid
          FROM bank_accounts ba
          LEFT JOIN parsing_schemes ps ON ba.parsing_scheme_uuid = ps.uuid
          LEFT JOIN currencies c ON ba.currency_uuid = c.uuid
          WHERE ba.parsing_scheme_uuid = ANY($1::uuid[])
            AND ba.raw_table_name IS NOT NULL
        `, schemeUuids);

        const deconsolidatedTables = new Set<string>();
        for (const account of bankAccounts) {
          const tableName = buildDeconsolidatedTableName(
            account.account_number,
            account.parsing_scheme_name,
            account.currency_code
          );
          if (tableName && RAW_TABLE_NAME_RE.test(tableName)) {
            deconsolidatedTables.add(tableName);
          }
        }

        for (const tableName of deconsolidatedTables) {
          try {
            const counts = await prisma.$queryRawUnsafe<Array<{
              applied_rule_id: number;
              applied_count: number;
            }>>(`
              SELECT applied_rule_id, COUNT(*)::bigint as applied_count
              FROM "${tableName}"
              WHERE applied_rule_id IS NOT NULL
              GROUP BY applied_rule_id
            `);
            counts.forEach(row => {
              const id = Number(row.applied_rule_id);
              const current = appliedCounts.get(id) ?? 0;
              appliedCounts.set(id, current + Number(row.applied_count));
            });
          } catch (error) {
            console.error(`Error fetching applied counts from ${tableName}:`, error);
          }
        }
      } catch (error) {
        console.error('Error fetching applied counts from deconsolidated tables:', error);
      }
    }

    const formattedRules = rules.map(rule => ({
      id: Number(rule.id),
      appliedCount: appliedCounts.get(Number(rule.id)) ?? 0,
      schemeUuid: rule.scheme_uuid,
      scheme: rule.scheme,
      condition: rule.condition,
      paymentId: rule.payment_id,
      counteragent_uuid: rule.counteragent_uuid,
      financial_code_uuid: rule.financial_code_uuid,
      nominal_currency_uuid: rule.nominal_currency_uuid,
      counteragentName: rule.counteragent_name,
      financialCode: rule.financial_code,
      currencyCode: rule.currency_code,
      active: rule.active
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
    const { schemeUuid, condition, paymentId, counteragentUuid, financialCodeUuid, nominalCurrencyUuid, active } = body;

    if (!schemeUuid || !condition) {
      return NextResponse.json(
        { error: 'Missing required fields: schemeUuid and condition are required' },
        { status: 400 }
      );
    }

    // Validate: either paymentId OR counteragent must be provided (financialCode and currency are optional)
    const hasPaymentId = !!paymentId;
    const hasCounteragent = !!counteragentUuid;
    
    if (!hasPaymentId && !hasCounteragent) {
      return NextResponse.json(
        { error: 'Either paymentId OR counteragentUuid must be provided (financialCodeUuid and nominalCurrencyUuid are optional)' },
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

    // Convert empty strings to null for optional UUID fields
    const cleanCounteragentUuid = counteragentUuid || null;
    const cleanFinancialCodeUuid = financialCodeUuid || null;
    const cleanNominalCurrencyUuid = nominalCurrencyUuid || null;
    const cleanPaymentId = paymentId || null;

    await prisma.$executeRaw`
      SELECT setval(
        pg_get_serial_sequence('parsing_scheme_rules', 'id'),
        COALESCE((SELECT MAX(id) FROM parsing_scheme_rules), 0)
      )
    `;

    const result = await prisma.$queryRaw<Array<{
      id: bigint;
      scheme_uuid: string;
      condition: string;
      condition_script: string | null;
      payment_id: string | null;
      counteragent_uuid: string | null;
      financial_code_uuid: string | null;
      nominal_currency_uuid: string | null;
      active: boolean;
    }>>`
      INSERT INTO parsing_scheme_rules (
        scheme_uuid, condition, condition_script, payment_id,
        counteragent_uuid, financial_code_uuid, nominal_currency_uuid, active
      )
      VALUES (
        ${schemeUuid}::uuid, ${condition}, ${conditionScript}, ${cleanPaymentId},
        ${cleanCounteragentUuid}::uuid, ${cleanFinancialCodeUuid}::uuid, ${cleanNominalCurrencyUuid}::uuid, ${active ?? true}
      )
      RETURNING *
    `;

    const rule = result[0];
    return NextResponse.json({
      id: Number(rule.id),
      schemeUuid: rule.scheme_uuid,
      condition: rule.condition,
      paymentId: rule.payment_id,
      counteragent_uuid: rule.counteragent_uuid,
      financial_code_uuid: rule.financial_code_uuid,
      nominal_currency_uuid: rule.nominal_currency_uuid,
      active: rule.active
    });
  } catch (error) {
    console.error('Error creating parsing scheme rule:', error);
    return NextResponse.json(
      { error: 'Failed to create parsing scheme rule' },
      { status: 500 }
    );
  }
}

