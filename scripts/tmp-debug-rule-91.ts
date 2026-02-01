import pg from 'pg';
import { config as loadEnv } from 'dotenv';
import { compileFormulaToJS, evaluateCondition } from '../lib/formula-compiler';

loadEnv({ path: '.env.local' });

const { Client } = pg;

const splitTopLevelArgs = (input: string): string[] => {
  const args: string[] = [];
  let depth = 0;
  let inString: '"' | '\'' | null = null;
  let escape = false;
  let current = '';

  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (inString) {
      current += c;
      if (escape) {
        escape = false;
      } else if (c === '\\') {
        escape = true;
      } else if (c === inString) {
        inString = null;
      }
      continue;
    }

    if (c === '"' || c === "'") {
      inString = c as '"' | '\'';
      current += c;
      continue;
    }

    if (c === '(') {
      depth++;
      current += c;
      continue;
    }

    if (c === ')') {
      depth = Math.max(0, depth - 1);
      current += c;
      continue;
    }

    if (c === ',' && depth === 0) {
      args.push(current);
      current = '';
      continue;
    }

    current += c;
  }

  if (current.length > 0 || input.trim().length === 0) args.push(current);
  return args;
};

const run = async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');

  const client = new Client({ connectionString: url });
  await client.connect();

  const ruleRes = await client.query('select id, condition, condition_script from parsing_scheme_rules where id=$1', [91]);
  const rule = ruleRes.rows[0];
  if (!rule) throw new Error('Rule 91 not found');

  const rowRes = await client.query('select * from "GE78BG0000000893486000_BOG_GEL" where id=$1', [18337]);
  const row = rowRes.rows[0];
  if (!row) throw new Error('Row 18337 not found');

  console.log('Condition:', rule.condition);
  const compiled = rule.condition_script || compileFormulaToJS(rule.condition || '');
  console.log('Compiled:', compiled);
  console.log('Overall match:', evaluateCondition(compiled, row));

  const condition = String(rule.condition || '').trim().replace(/^=/, '');
  const andMatch = condition.match(/^AND\s*\((.*)\)$/i);
  if (andMatch) {
    const args = splitTopLevelArgs(andMatch[1]).map((arg) => arg.trim()).filter(Boolean);
    for (const arg of args) {
      const argScript = compileFormulaToJS(arg);
      const result = evaluateCondition(argScript, row);
      console.log(`Arg: ${arg} => ${result}`);
    }
  }

  await client.end();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
