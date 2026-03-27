require('dotenv/config');
const { Client } = require('pg');

const TARGET = process.argv[2] || '32485868963';

async function listBogTables(client) {
  const q = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name LIKE 'GE%_BOG_%'
    ORDER BY table_name
  `);
  return q.rows.map((r) => r.table_name);
}

function hasColumn(columns, name) {
  return columns.some((c) => c.column_name.toLowerCase() === name.toLowerCase());
}

async function tableColumns(client, tableName) {
  const q = await client.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
  `,
    [tableName]
  );
  return q.rows;
}

async function findInTable(client, tableName, target) {
  const cols = await tableColumns(client, tableName);
  const probes = [];
  if (hasColumn(cols, 'id1')) probes.push('id1');
  if (hasColumn(cols, 'dockey')) probes.push('dockey');
  if (hasColumn(cols, 'entriesid')) probes.push('entriesid');

  if (probes.length === 0) return [];

  const selectCols = [
    'uuid',
    'id',
    'id1',
    'dockey',
    'entriesid',
    'transaction_date',
    'bank_account_uuid',
    'account_currency_amount',
    'docsrcccy',
    'docdstccy',
    'docamount',
    'docsrcamt',
    'docdstamt',
    'docbuyamount',
    'docsellamount',
    'description',
    'payment_id',
    'conversion_id',
    'counterpart_account',
    'entry_type',
    'docsenderacctno',
    'docbenefacctno'
  ].filter((c) => hasColumn(cols, c));

  const whereSql = probes.map((c, i) => `${c}::text = $${i + 1}`).join(' OR ');
  const params = probes.map(() => target);

  const q = await client.query(
    `SELECT ${selectCols.join(', ')} FROM "${tableName}" WHERE ${whereSql} ORDER BY id::bigint DESC NULLS LAST LIMIT 200`,
    params
  );

  return q.rows.map((r) => ({ table: tableName, ...r }));
}

async function main() {
  const cs = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!cs) throw new Error('Missing DIRECT_DATABASE_URL or DATABASE_URL');

  const client = new Client({ connectionString: cs });
  await client.connect();

  try {
    const tables = await listBogTables(client);
    const matches = [];

    for (const t of tables) {
      const rows = await findInTable(client, t, TARGET);
      matches.push(...rows);
    }

    const convByKey = await client.query(
      `SELECT id, uuid, key_value, amount_out, amount_in, fee, account_out_uuid, account_in_uuid, created_at
       FROM conversion
       WHERE key_value::text = $1
       ORDER BY id DESC`,
      [TARGET]
    );

    const ceByDockey = await client.query(
      `SELECT conversion_id, conversion_uuid, entry_type, dockey, raw_record_uuid, bank_account_uuid, account_currency_amount
       FROM conversion_entries
       WHERE dockey::text = $1
       ORDER BY conversion_id DESC, entry_type`,
      [TARGET]
    );

    const convRefs = [...new Set(matches.map((r) => r.conversion_id).filter(Boolean).map((v) => String(v)))];
    const numericIds = convRefs.filter((v) => /^\d+$/.test(v));
    const uuidIds = convRefs.filter((v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v));
    let convFromRows = [];
    if (numericIds.length || uuidIds.length) {
      const conditions = [];
      const params = [];
      if (numericIds.length) {
        params.push(numericIds);
        conditions.push(`id = ANY($${params.length}::bigint[])`);
      }
      if (uuidIds.length) {
        params.push(uuidIds);
        conditions.push(`uuid = ANY($${params.length}::uuid[])`);
      }
      const q = await client.query(
        `SELECT id, uuid, key_value, amount_out, amount_in, fee, account_out_uuid, account_in_uuid, created_at
         FROM conversion
         WHERE ${conditions.join(' OR ')}
         ORDER BY id DESC`,
        params
      );
      convFromRows = q.rows;
    }

    const conversionHintRegex = /(კონვერტ|conversion|convert|exchange|fx)/i;
    const inferred = (() => {
      if (matches.length < 2) return null;
      const usdLike = matches.find((r) => Number(r.account_currency_amount) < 0) || null;
      const gelLike = matches.find((r) => Number(r.account_currency_amount) > 0) || null;
      if (!usdLike || !gelLike) return null;

      const src = String(usdLike.docsrcccy || '').trim().toUpperCase();
      const dst = String(usdLike.docdstccy || '').trim().toUpperCase();
      const hasCrossCurrencyMetadata = Boolean(src && dst && src !== dst);
      const hasConversionLikeText = conversionHintRegex.test(String(usdLike.description || gelLike.description || ''));

      return {
        hasCrossCurrencyMetadata,
        hasConversionLikeText,
        fallbackAmountOut: Math.abs(Number(usdLike.account_currency_amount)),
        fallbackAmountIn: Math.abs(Number(gelLike.account_currency_amount)),
      };
    })();

    console.log(
      JSON.stringify(
        {
          target: TARGET,
          matchedRows: matches.length,
          rows: matches,
          conversionByKey: convByKey.rows,
          conversionEntriesByDockey: ceByDockey.rows,
          conversionByLinkedIds: convFromRows,
          inferred,
        },
        null,
        2
      )
    );
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
