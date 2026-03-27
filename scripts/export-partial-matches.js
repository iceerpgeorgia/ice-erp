BigInt.prototype.toJSON = function() { return Number(this); };
const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const p = new PrismaClient();

async function main() {
  const rows = await p.$queryRawUnsafe(`
    WITH auto_projects AS (
      SELECT 
        pr.project_uuid,
        pr.project_index,
        pr.project_name,
        pr.counteragent_uuid,
        pr.financial_code_uuid,
        pr.currency_uuid,
        pr.value as project_value,
        pr.date as project_date,
        ca.name as counteragent_name,
        ca.identification_number as counteragent_inn,
        fc.code as project_fc,
        fc.name as project_fc_name,
        cur.code as project_currency
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
    )
    SELECT
      ap.project_index,
      ap.project_name,
      ap.counteragent_name,
      ap.counteragent_inn,
      ap.project_fc as "Project FC",
      ap.project_fc_name as "Project FC Name",
      ap.project_currency as "Project Currency",
      ap.project_value as "Project Value",
      ap.project_date as "Project Date",
      pay.payment_id as "Payment ID",
      pay.is_active as "Payment Active",
      pay.is_project_derived as "Payment Auto",
      pay.income_tax as "Payment Income Tax",
      fc2.code as "Payment FC",
      fc2.name as "Payment FC Name",
      cur2.code as "Payment Currency",
      j.job_name as "Payment Job",
      CASE WHEN ap.project_fc != fc2.code THEN 'MISMATCH' ELSE 'OK' END as "FC Match",
      CASE WHEN ap.project_currency != cur2.code THEN 'MISMATCH' ELSE 'OK' END as "Currency Match",
      CASE WHEN pay.income_tax = true THEN 'MISMATCH (true vs false)' ELSE 'OK' END as "Income Tax Match",
      CASE WHEN pay.job_uuid IS NOT NULL THEN 'MISMATCH (has job)' ELSE 'OK' END as "Job Match"
    FROM auto_projects ap
    JOIN payments pay ON 
      pay.project_uuid = ap.project_uuid
      AND pay.counteragent_uuid = ap.counteragent_uuid
    LEFT JOIN financial_codes fc2 ON fc2.uuid = pay.financial_code_uuid
    LEFT JOIN currencies cur2 ON cur2.uuid = pay.currency_uuid
    LEFT JOIN jobs j ON j.job_uuid = pay.job_uuid
    WHERE ap.project_uuid NOT IN (SELECT project_uuid FROM exact_matches)
    ORDER BY ap.project_index, pay.payment_id
  `);

  // Format data for Excel
  const excelRows = rows.map(r => ({
    'Project Index': r.project_index,
    'Project Name': r.project_name,
    'Counteragent': r.counteragent_name,
    'Counteragent INN': r.counteragent_inn,
    'Project FC': r['Project FC'],
    'Project FC Name': r['Project FC Name'],
    'Project Currency': r['Project Currency'],
    'Project Value': r['Project Value'] ? Number(r['Project Value']) : null,
    'Project Date': r['Project Date'] ? new Date(r['Project Date']).toLocaleDateString('en-GB') : null,
    'Payment ID': r['Payment ID'],
    'Payment Active': r['Payment Active'],
    'Payment Auto (is_project_derived)': r['Payment Auto'],
    'Payment Income Tax': r['Payment Income Tax'],
    'Payment FC': r['Payment FC'],
    'Payment FC Name': r['Payment FC Name'],
    'Payment Currency': r['Payment Currency'],
    'Payment Job': r['Payment Job'] || '(none)',
    'FC Match': r['FC Match'],
    'Currency Match': r['Currency Match'],
    'Income Tax Match': r['Income Tax Match'],
    'Job Match': r['Job Match'],
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelRows);

  // Set column widths
  ws['!cols'] = [
    { wch: 15 },  // Project Index
    { wch: 35 },  // Project Name
    { wch: 30 },  // Counteragent
    { wch: 15 },  // INN
    { wch: 10 },  // Project FC
    { wch: 25 },  // Project FC Name
    { wch: 15 },  // Project Currency
    { wch: 15 },  // Project Value
    { wch: 12 },  // Project Date
    { wch: 20 },  // Payment ID
    { wch: 14 },  // Payment Active
    { wch: 14 },  // Payment Auto
    { wch: 18 },  // Payment Income Tax
    { wch: 10 },  // Payment FC
    { wch: 25 },  // Payment FC Name
    { wch: 15 },  // Payment Currency
    { wch: 20 },  // Payment Job
    { wch: 12 },  // FC Match
    { wch: 15 },  // Currency Match
    { wch: 25 },  // Income Tax Match
    { wch: 20 },  // Job Match
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Partial Matches');

  const outPath = 'exports/partial_payment_matches.xlsx';
  XLSX.writeFile(wb, outPath);
  console.log(`Written ${excelRows.length} rows to ${outPath}`);

  await p.$disconnect();
}

main().catch(e => { console.error(e); p.$disconnect(); });
