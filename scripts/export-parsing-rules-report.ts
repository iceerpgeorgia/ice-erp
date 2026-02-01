import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { prisma } from '../lib/prisma';

const tableName = process.argv[2] ?? 'GE78BG0000000893486000_BOG_GEL';
const outputPath = process.argv[3] ?? 'reports/parsing-rules-report.xlsx';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadEnv();

  const summary = await prisma.$queryRawUnsafe<Array<{
    total: bigint;
    counteragent_found: bigint;
    inn_missing: bigint;
    inn_no_match: bigint;
    rules_applied: bigint;
    rule_conflicts: bigint;
    payment_matched: bigint;
    payment_conflicts: bigint;
  }>>(
    `SELECT
      COUNT(*)::bigint as total,
      SUM(CASE WHEN counteragent_found THEN 1 ELSE 0 END)::bigint as counteragent_found,
      SUM(CASE WHEN counteragent_inn_blank THEN 1 ELSE 0 END)::bigint as inn_missing,
      SUM(CASE WHEN counteragent_missing THEN 1 ELSE 0 END)::bigint as inn_no_match,
      SUM(CASE WHEN parsing_rule_applied THEN 1 ELSE 0 END)::bigint as rules_applied,
      SUM(CASE WHEN parsing_rule_conflict THEN 1 ELSE 0 END)::bigint as rule_conflicts,
      SUM(CASE WHEN payment_id_matched THEN 1 ELSE 0 END)::bigint as payment_matched,
      SUM(CASE WHEN payment_id_conflict THEN 1 ELSE 0 END)::bigint as payment_conflicts
    FROM "${tableName}"`
  );

  const summaryRow = summary[0];

  const summarySheet = XLSX.utils.json_to_sheet([
    {
      metric: 'Total records',
      value: Number(summaryRow?.total ?? 0),
    },
    {
      metric: 'Counteragent matched',
      value: Number(summaryRow?.counteragent_found ?? 0),
    },
    {
      metric: 'INN missing',
      value: Number(summaryRow?.inn_missing ?? 0),
    },
    {
      metric: 'INN no match',
      value: Number(summaryRow?.inn_no_match ?? 0),
    },
    {
      metric: 'Rules applied',
      value: Number(summaryRow?.rules_applied ?? 0),
    },
    {
      metric: 'Rule conflicts',
      value: Number(summaryRow?.rule_conflicts ?? 0),
    },
    {
      metric: 'Payment matched',
      value: Number(summaryRow?.payment_matched ?? 0),
    },
    {
      metric: 'Payment conflicts',
      value: Number(summaryRow?.payment_conflicts ?? 0),
    },
  ]);

  const ruleDetails = await prisma.$queryRawUnsafe<Array<{
    applied_rule_id: number;
    applied_count: bigint;
    conflict_count: bigint;
    condition: string | null;
    condition_script: string | null;
    column_name: string | null;
  }>>(
    `SELECT
      d.applied_rule_id,
      COUNT(*)::bigint as applied_count,
      SUM(CASE WHEN d.parsing_rule_conflict THEN 1 ELSE 0 END)::bigint as conflict_count,
      r.condition,
      r.condition_script,
      r.column_name
    FROM "${tableName}" d
    LEFT JOIN parsing_scheme_rules r ON r.id = d.applied_rule_id
    WHERE d.applied_rule_id IS NOT NULL
    GROUP BY d.applied_rule_id, r.condition, r.condition_script, r.column_name
    ORDER BY applied_count DESC`
  );

  const ruleDetailsSheet = XLSX.utils.json_to_sheet(
    ruleDetails.map((row) => ({
      rule_id: row.applied_rule_id,
      applied_count: Number(row.applied_count),
      conflict_count: Number(row.conflict_count),
      column_name: row.column_name,
      condition: row.condition,
      condition_script: row.condition_script,
    }))
  );

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  XLSX.utils.book_append_sheet(workbook, ruleDetailsSheet, 'Rule Details');

  const absPath = path.resolve(process.cwd(), outputPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  XLSX.writeFile(workbook, absPath);

  console.log(`Report written to ${absPath}`);
}

main()
  .catch((error) => {
    console.error('Report failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
