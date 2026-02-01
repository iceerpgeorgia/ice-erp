import fs from 'fs';
import path from 'path';
import { getSupabaseClient } from '../lib/bank-import/db-utils';

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

const tableName = process.argv[2] ?? 'GE78BG0000000893486000_BOG_GEL';

async function main() {
  loadEnv();
  const supabase = getSupabaseClient();

  const { data: rule, error: ruleError } = await supabase
    .from('parsing_scheme_rules')
    .select('id, column_name, condition, condition_script, counteragent_uuid, financial_code_uuid, nominal_currency_uuid, payment_id')
    .eq('id', 91)
    .single();

  if (ruleError) throw ruleError;

  console.log('Rule 91:', rule);

  const { count, error: countError } = await supabase
    .from(tableName)
    .select('id', { count: 'exact', head: true })
    .eq('applied_rule_id', 91);

  if (countError) throw countError;

  console.log(`Applied rule 91 count in ${tableName}:`, count ?? 0);

  const { count: rawCount, error: rawCountError } = await supabase
    .from('bog_gel_raw_893486000')
    .select('uuid', { count: 'exact', head: true })
    .eq('applied_rule_id', 91);

  if (rawCountError) throw rawCountError;

  console.log('Applied rule 91 count in bog_gel_raw_893486000:', rawCount ?? 0);

  const { count: caseCount, error: caseError } = await supabase
    .from(tableName)
    .select('id', { count: 'exact', head: true })
    .ilike('processing_case', '%rule ID 91%');

  if (caseError) throw caseError;

  console.log(`processing_case contains "rule ID 91" in ${tableName}:`, caseCount ?? 0);

  const { data: sample, error: sampleError } = await supabase
    .from(tableName)
    .select('id, dockey, entriesid, docnomination, docinformation, docprodgroup, applied_rule_id, processing_case')
    .eq('applied_rule_id', 91)
    .order('id', { ascending: true })
    .limit(5);

  if (sampleError) throw sampleError;

  console.log('Sample rows with applied_rule_id=91 (first 5):');
  for (const row of sample ?? []) {
    console.log(`- id=${row.id} dockey=${row.dockey} entriesid=${row.entriesid} prodgroup=${row.docprodgroup}`);
  }
}

main().catch((error) => {
  console.error('❌ Inspect failed:', error);
  process.exit(1);
});
