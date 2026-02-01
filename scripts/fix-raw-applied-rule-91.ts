import fs from 'fs';
import path from 'path';
import { getSupabaseClient } from '../lib/bank-import/db-utils';

const tableName = process.argv[2] ?? 'GE78BG0000000893486000_BOG_GEL';
const rawTableName = 'bog_gel_raw_893486000';

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
  const supabase = getSupabaseClient();

  const { data: ruleRows, error: ruleError } = await supabase
    .from(tableName)
    .select('uuid')
    .eq('applied_rule_id', 91);

  if (ruleError) throw ruleError;

  const ruleUuids = (ruleRows ?? []).map(row => row.uuid);
  console.log(`Found ${ruleUuids.length} records with applied_rule_id=91 in ${tableName}.`);

  console.log(`Resetting applied_rule_id=91 in ${rawTableName}...`);
  const { error: resetError } = await supabase
    .from(rawTableName)
    .update({ applied_rule_id: null })
    .eq('applied_rule_id', 91);

  if (resetError) throw resetError;

  if (ruleUuids.length > 0) {
    console.log(`Applying rule 91 to ${ruleUuids.length} raw record(s) by uuid...`);
    const { error: applyError } = await supabase
      .from(rawTableName)
      .update({ applied_rule_id: 91 })
      .in('uuid', ruleUuids);

    if (applyError) throw applyError;
  }

  const { count: rawCount, error: rawCountError } = await supabase
    .from(rawTableName)
    .select('uuid', { count: 'exact', head: true })
    .eq('applied_rule_id', 91);

  if (rawCountError) throw rawCountError;

  console.log(`Applied rule 91 count in ${rawTableName} is now: ${rawCount ?? 0}`);
}

main().catch((error) => {
  console.error('❌ Fix failed:', error);
  process.exit(1);
});
