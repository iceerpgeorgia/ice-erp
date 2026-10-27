const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const TABLE_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ROW_BATCH_SIZE = 1000;

function loadEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  const parsed = dotenv.parse(fs.readFileSync(filePath));
  for (const [key, value] of Object.entries(parsed)) {
    const current = process.env[key];
    if (
      current === undefined ||
      current === null ||
      current === '' ||
      current === '""' ||
      current === "''"
    ) {
      process.env[key] = value;
    }
  }
}

function loadEnvironment() {
  const explicitPath = process.env.DOTENV_CONFIG_PATH;
  if (explicitPath) {
    loadEnvFile(path.resolve(explicitPath));
  }
  loadEnvFile(path.resolve('.env.local'));
  loadEnvFile(path.resolve('.env'));
}

function getDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.REMOTE_DATABASE_URL || '';
}

async function getSourceTables(client) {
  const { rows } = await client.query(
    `SELECT DISTINCT raw_table_name
     FROM bank_accounts
     WHERE raw_table_name IS NOT NULL
       AND raw_table_name <> ''
     ORDER BY raw_table_name`
  );

  return rows
    .map((r) => r.raw_table_name)
    .filter((name) => TABLE_NAME_RE.test(name));
}

async function countFixableRows(client, tableName) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::bigint AS cnt
     FROM "${tableName}" t
     JOIN payments p ON p.payment_id = t.payment_id
     WHERE t.payment_id IS NOT NULL
       AND (
         (t.project_uuid IS NULL AND p.project_uuid IS NOT NULL)
         OR
         (t.financial_code_uuid IS NULL AND p.financial_code_uuid IS NOT NULL)
       )`
  );
  return Number(rows?.[0]?.cnt || 0);
}

async function getBalanceTriggers(client, tableName) {
  const { rows } = await client.query(
    `SELECT t.tgname
     FROM pg_trigger t
     JOIN pg_class c ON c.oid = t.tgrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = current_schema()
       AND c.relname = $1
       AND NOT t.tgisinternal
       AND t.tgname = 'trg_recompute_bank_balances'`,
    [tableName]
  );
  return rows.map((r) => String(r.tgname));
}

async function setTriggerEnabled(client, tableName, triggerName, enabled) {
  const action = enabled ? 'ENABLE' : 'DISABLE';
  await client.query(`ALTER TABLE "${tableName}" ${action} TRIGGER "${triggerName}"`);
}

async function runRowBatchUpdate(client, tableName) {
  const { rows } = await client.query(
    `WITH picked AS (
       SELECT
         t.ctid AS ctid,
         p.project_uuid AS p_project_uuid,
         p.financial_code_uuid AS p_financial_code_uuid
       FROM "${tableName}" t
       JOIN payments p ON p.payment_id = t.payment_id
       WHERE t.payment_id IS NOT NULL
         AND (
           (t.project_uuid IS NULL AND p.project_uuid IS NOT NULL)
           OR
           (t.financial_code_uuid IS NULL AND p.financial_code_uuid IS NOT NULL)
         )
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     ),
     updated AS (
       UPDATE "${tableName}" t
       SET project_uuid = COALESCE(t.project_uuid, picked.p_project_uuid),
           financial_code_uuid = COALESCE(t.financial_code_uuid, picked.p_financial_code_uuid),
           updated_at = NOW()
       FROM picked
       WHERE t.ctid = picked.ctid
       RETURNING 1
     )
     SELECT COUNT(*)::bigint AS cnt FROM updated`,
    [ROW_BATCH_SIZE]
  );
  return Number(rows?.[0]?.cnt || 0);
}

async function backfillTable(client, tableName) {
  const before = await countFixableRows(client, tableName);
  if (before === 0) {
    return { tableName, before, updated: 0, after: 0, rowBatches: 0, disabledTriggers: [] };
  }

  const balanceTriggers = await getBalanceTriggers(client, tableName);
  for (const triggerName of balanceTriggers) {
    await setTriggerEnabled(client, tableName, triggerName, false);
  }

  let updated = 0;
  let rowBatches = 0;

  try {
    while (true) {
      const batchUpdated = await runRowBatchUpdate(client, tableName);
      if (batchUpdated === 0) break;

      updated += batchUpdated;
      rowBatches += 1;

      if (rowBatches % 10 === 0) {
        console.log(
          JSON.stringify({
            table: tableName,
            rowBatch: rowBatches,
            batchUpdated,
            updatedSoFar: updated,
          })
        );
      }
    }
  } finally {
    for (const triggerName of balanceTriggers) {
      await setTriggerEnabled(client, tableName, triggerName, true);
    }
  }

  const after = await countFixableRows(client, tableName);

  return {
    tableName,
    before,
    updated,
    after,
    rowBatches,
    disabledTriggers: balanceTriggers,
  };
}

async function main() {
  loadEnvironment();
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL or REMOTE_DATABASE_URL is required');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  // This job is one-time remediation; remove per-statement timeout guard.
  await client.query('SET statement_timeout TO 0');

  const tables = await getSourceTables(client);
  if (tables.length === 0) {
    console.log(JSON.stringify({ message: 'No active source tables found.' }, null, 2));
    await client.end();
    return;
  }

  const results = [];
  for (const tableName of tables) {
    console.log(JSON.stringify({ table: tableName, status: 'start' }));
    const result = await backfillTable(client, tableName);
    results.push(result);
    console.log(JSON.stringify({ table: tableName, status: 'done', ...result }));
  }

  const totals = results.reduce(
    (acc, row) => {
      acc.before += row.before;
      acc.updated += row.updated;
      acc.after += row.after;
      acc.rowBatches += row.rowBatches;
      return acc;
    },
    { before: 0, updated: 0, after: 0, rowBatches: 0 }
  );

  console.log(JSON.stringify({ tables: results, totals }, null, 2));
  await client.end();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
