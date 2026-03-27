BigInt.prototype.toJSON = function() { return Number(this); };
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Find projects with auto-payment FC that DON'T have an exact composite key match
  // but DO have a payment matching just project_uuid + counteragent_uuid
  const partialMatches = await p.$queryRawUnsafe(`
    WITH auto_projects AS (
      SELECT 
        pr.project_uuid,
        pr.project_index,
        pr.project_name,
        pr.counteragent_uuid,
        pr.financial_code_uuid,
        pr.currency_uuid,
        ca.name as counteragent_name,
        fc.code as financial_code,
        cur.code as currency_code
      FROM projects pr
      JOIN financial_codes fc ON fc.uuid = pr.financial_code_uuid
      LEFT JOIN counteragents ca ON ca.counteragent_uuid = pr.counteragent_uuid
      LEFT JOIN currencies cur ON cur.uuid = pr.currency_uuid
      WHERE fc.automated_payment_id = true
    ),
    exact_matches AS (
      SELECT ap.project_uuid
      FROM auto_projects ap
      JOIN payments pay ON 
        pay.project_uuid = ap.project_uuid
        AND pay.counteragent_uuid = ap.counteragent_uuid
        AND pay.financial_code_uuid = ap.financial_code_uuid
        AND pay.job_uuid IS NULL
        AND pay.income_tax = false
        AND pay.currency_uuid = ap.currency_uuid
    ),
    partial_only AS (
      SELECT DISTINCT
        ap.project_uuid,
        ap.project_index,
        ap.project_name,
        ap.counteragent_name,
        ap.financial_code,
        ap.currency_code,
        ap.financial_code_uuid as proj_fc_uuid,
        ap.currency_uuid as proj_cur_uuid,
        pay.payment_id,
        pay.is_active,
        pay.is_project_derived,
        fc2.code as pay_financial_code,
        cur2.code as pay_currency,
        pay.job_uuid,
        pay.income_tax,
        j.job_name as pay_job_name
      FROM auto_projects ap
      JOIN payments pay ON 
        pay.project_uuid = ap.project_uuid
        AND pay.counteragent_uuid = ap.counteragent_uuid
      LEFT JOIN financial_codes fc2 ON fc2.uuid = pay.financial_code_uuid
      LEFT JOIN currencies cur2 ON cur2.uuid = pay.currency_uuid
      LEFT JOIN jobs j ON j.job_uuid = pay.job_uuid
      WHERE ap.project_uuid NOT IN (SELECT project_uuid FROM exact_matches)
    )
    SELECT * FROM partial_only
    ORDER BY project_index, payment_id
  `);

  console.log(`=== Partial matches (project_uuid + counteragent_uuid only, outside the 202 exact matches) ===`);
  console.log(`Total: ${partialMatches.length}\n`);

  for (const m of partialMatches) {
    const diffs = [];
    if (m.financial_code !== m.pay_financial_code) diffs.push(`FC: ${m.financial_code} vs ${m.pay_financial_code}`);
    if (m.currency_code !== m.pay_currency) diffs.push(`Currency: ${m.currency_code} vs ${m.pay_currency}`);
    if (m.job_uuid) diffs.push(`Job: ${m.pay_job_name || m.job_uuid}`);
    if (m.income_tax) diffs.push(`IncomeTax: true`);
    
    console.log(`  ${m.project_index} | ${m.counteragent_name} | payment=${m.payment_id} | active=${m.is_active} | DIFFS: ${diffs.join(', ')}`);
  }

  await p.$disconnect();
}

main().catch(e => { console.error(e); p.$disconnect(); });
