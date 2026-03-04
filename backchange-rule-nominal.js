const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const RAW_TABLE_NAME_RE = /^[A-Za-z0-9_]+$/;
const RAW_SCAN_BATCH = 5000;

function getArg(name) {
  const index = process.argv.findIndex((arg) => arg === name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function normalizeRecord(record) {
  const normalized = {};
  for (const [key, value] of Object.entries(record)) {
    normalized[key] = value;
    const lower = key.toLowerCase();
    if (!(lower in normalized)) {
      normalized[lower] = value;
    }
  }
  return normalized;
}

function buildDeconsolidatedTableName(accountNumber, schemeName, currencyCode) {
  if (!accountNumber || !schemeName) return null;
  if (schemeName.endsWith('_FX')) {
    if (!currencyCode) return null;
    const prefix = schemeName.replace(/_FX$/, '');
    return `${accountNumber}_${prefix}_${currencyCode}`;
  }
  return `${accountNumber}_${schemeName}`;
}

async function tableExists(tableName) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COALESCE(
       to_regclass($1)::text,
       to_regclass($2)::text,
       to_regclass($3)::text
     ) as table_name`,
    tableName,
    `"${tableName}"`,
    `public."${tableName}"`
  );
  return Boolean(rows?.[0]?.table_name);
}

async function collectRuleMatchedUuids(rule, rawTableRows, verbose) {
  const matched = new Map();
  if (!rule.condition_script) {
    throw new Error('Rule has no condition_script; use --source applied-rule');
  }

  const evalFn = eval(rule.condition_script);

  for (const row of rawTableRows) {
    const table = row.raw_table_name;
    if (!RAW_TABLE_NAME_RE.test(table)) continue;

    const tableRef = `"${table}"`;
    let lastId = 0;
    let scanned = 0;
    while (true) {
      const batch = await prisma.$queryRawUnsafe(
        `SELECT * FROM ${tableRef} WHERE id > $1 ORDER BY id ASC LIMIT $2`,
        lastId,
        RAW_SCAN_BATCH
      );
      if (!batch.length) break;

      for (const record of batch) {
        const input = normalizeRecord(record);
        if (evalFn(input)) {
          const uuid = String(record.uuid || '').trim();
          if (!uuid) continue;
          const arr = matched.get(table) || [];
          arr.push(uuid);
          matched.set(table, arr);
        }
      }

      scanned += batch.length;
      const nextId = Number(batch[batch.length - 1]?.id);
      if (!Number.isFinite(nextId)) break;
      lastId = nextId;
    }

    if (verbose) {
      const count = (matched.get(table) || []).length;
      console.log(`  raw ${table}: scanned=${scanned}, matched=${count}`);
    }
  }

  return matched;
}

async function main() {
  const ruleIdRaw = getArg('--rule-id') || getArg('-r');
  const source = (getArg('--source') || 'applied-rule').toLowerCase();
  const apply = hasFlag('--apply');
  const verbose = hasFlag('--verbose');

  if (!ruleIdRaw || Number.isNaN(Number(ruleIdRaw))) {
    console.error('Usage: node backchange-rule-nominal.js --rule-id 107 [--source applied-rule|rule-match] [--apply] [--verbose]');
    process.exit(1);
  }
  if (!['applied-rule', 'rule-match', 'payment-id'].includes(source)) {
    console.error('Invalid --source. Use applied-rule, rule-match, or payment-id');
    process.exit(1);
  }

  const ruleId = Number(ruleIdRaw);
  console.log(`\n🔧 Backchange nominal amounts for parsing rule ${ruleId}`);
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'} | Source: ${source}\n`);

  const rules = await prisma.$queryRawUnsafe(
    `SELECT id, scheme_uuid, nominal_currency_uuid, payment_id, condition_script
     FROM parsing_scheme_rules
     WHERE id = $1`,
    ruleId
  );
  if (!rules.length) {
    console.error(`❌ Rule ${ruleId} not found`);
    process.exit(1);
  }
  const rule = rules[0];

  const rawTableRows = await prisma.$queryRawUnsafe(
    `SELECT
       ba.raw_table_name,
       ba.account_number,
       ps.scheme as parsing_scheme_name,
       c.code as currency_code
     FROM bank_accounts ba
     LEFT JOIN parsing_schemes ps ON ba.parsing_scheme_uuid = ps.uuid
     LEFT JOIN currencies c ON ba.currency_uuid = c.uuid
     WHERE ba.parsing_scheme_uuid = $1::uuid
       AND ba.raw_table_name IS NOT NULL`,
    rule.scheme_uuid
  );
  if (!rawTableRows.length) {
    console.log('⚠️ No raw tables found for this rule scheme.');
    return;
  }

  const rawToDecon = new Map();
  const deconTables = [];
  for (const row of rawTableRows) {
    const decon = buildDeconsolidatedTableName(
      row.account_number,
      row.parsing_scheme_name,
      row.currency_code
    );
    if (!decon || !RAW_TABLE_NAME_RE.test(decon)) continue;
    rawToDecon.set(row.raw_table_name, decon);
    if (!deconTables.includes(decon)) deconTables.push(decon);
  }
  if (!deconTables.length) {
    console.log('⚠️ No valid deconsolidated tables resolved.');
    return;
  }

  let effectiveNominalCurrencyUuid = rule.nominal_currency_uuid || null;
  if (!effectiveNominalCurrencyUuid && rule.payment_id) {
    const paymentRows = await prisma.$queryRawUnsafe(
      `SELECT currency_uuid FROM payments WHERE payment_id = $1 LIMIT 1`,
      rule.payment_id
    );
    effectiveNominalCurrencyUuid = paymentRows?.[0]?.currency_uuid || null;
  }

  if (!effectiveNominalCurrencyUuid) {
    console.log('⚠️ Effective nominal currency is null (rule and payment currency not found).');
  }

  const targetByDecon = new Map();

  if (source === 'rule-match') {
    const matchedByRaw = await collectRuleMatchedUuids(rule, rawTableRows, verbose);
    for (const [rawTable, uuids] of matchedByRaw.entries()) {
      const decon = rawToDecon.get(rawTable);
      if (!decon) continue;
      const existing = targetByDecon.get(decon) || [];
      targetByDecon.set(decon, existing.concat(uuids));
    }
  } else if (source === 'payment-id') {
    if (!rule.payment_id) {
      console.log('⚠️ Rule has no payment_id, payment-id source has no targets.');
    } else {
      for (const tableName of deconTables) {
        if (!(await tableExists(tableName))) continue;
        const rows = await prisma.$queryRawUnsafe(
          `SELECT raw_record_uuid
           FROM "${tableName}"
           WHERE payment_id = $1
             AND raw_record_uuid IS NOT NULL`,
          rule.payment_id
        );
        targetByDecon.set(
          tableName,
          rows.map((r) => String(r.raw_record_uuid))
        );
      }
    }
  } else {
    for (const tableName of deconTables) {
      if (!(await tableExists(tableName))) continue;
      const rows = await prisma.$queryRawUnsafe(
        `SELECT raw_record_uuid
         FROM "${tableName}"
         WHERE applied_rule_id = $1
           AND raw_record_uuid IS NOT NULL`,
        ruleId
      );
      targetByDecon.set(
        tableName,
        rows.map((r) => String(r.raw_record_uuid))
      );
    }
  }

  let totalMatched = 0;
  let totalWouldChange = 0;
  let totalUpdated = 0;

  for (const tableName of deconTables) {
    const exists = await tableExists(tableName);
    if (!exists) {
      if (verbose) console.log(`- Skip missing table: ${tableName}`);
      continue;
    }

    const uuids = Array.from(new Set(targetByDecon.get(tableName) || []));
    if (!uuids.length) continue;
    totalMatched += uuids.length;

    const wouldChangeRows = await prisma.$queryRawUnsafe(
      `WITH calc AS (
         SELECT
           d.raw_record_uuid,
           d.nominal_amount as current_nominal_amount,
           d.account_currency_amount,
           acc.code as account_code,
           nom.code as nominal_code,
           rates.usd_rate,
           rates.eur_rate,
           rates.cny_rate,
           rates.gbp_rate,
           rates.rub_rate,
           rates.try_rate,
           rates.aed_rate,
           rates.kzt_rate,
           CASE
             WHEN d.account_currency_amount IS NULL THEN d.nominal_amount
             WHEN acc.code IS NULL OR nom.code IS NULL THEN d.account_currency_amount
             WHEN acc.code = nom.code THEN d.account_currency_amount
             WHEN acc.code = 'GEL' THEN
               CASE nom.code
                 WHEN 'USD' THEN CASE WHEN rates.usd_rate IS NOT NULL AND rates.usd_rate <> 0 THEN d.account_currency_amount / rates.usd_rate ELSE d.account_currency_amount END
                 WHEN 'EUR' THEN CASE WHEN rates.eur_rate IS NOT NULL AND rates.eur_rate <> 0 THEN d.account_currency_amount / rates.eur_rate ELSE d.account_currency_amount END
                 WHEN 'CNY' THEN CASE WHEN rates.cny_rate IS NOT NULL AND rates.cny_rate <> 0 THEN d.account_currency_amount / rates.cny_rate ELSE d.account_currency_amount END
                 WHEN 'GBP' THEN CASE WHEN rates.gbp_rate IS NOT NULL AND rates.gbp_rate <> 0 THEN d.account_currency_amount / rates.gbp_rate ELSE d.account_currency_amount END
                 WHEN 'RUB' THEN CASE WHEN rates.rub_rate IS NOT NULL AND rates.rub_rate <> 0 THEN d.account_currency_amount / rates.rub_rate ELSE d.account_currency_amount END
                 WHEN 'TRY' THEN CASE WHEN rates.try_rate IS NOT NULL AND rates.try_rate <> 0 THEN d.account_currency_amount / rates.try_rate ELSE d.account_currency_amount END
                 WHEN 'AED' THEN CASE WHEN rates.aed_rate IS NOT NULL AND rates.aed_rate <> 0 THEN d.account_currency_amount / rates.aed_rate ELSE d.account_currency_amount END
                 WHEN 'KZT' THEN CASE WHEN rates.kzt_rate IS NOT NULL AND rates.kzt_rate <> 0 THEN d.account_currency_amount / rates.kzt_rate ELSE d.account_currency_amount END
                 ELSE d.account_currency_amount
               END
             WHEN nom.code = 'GEL' THEN
               CASE acc.code
                 WHEN 'USD' THEN CASE WHEN rates.usd_rate IS NOT NULL THEN d.account_currency_amount * rates.usd_rate ELSE d.account_currency_amount END
                 WHEN 'EUR' THEN CASE WHEN rates.eur_rate IS NOT NULL THEN d.account_currency_amount * rates.eur_rate ELSE d.account_currency_amount END
                 WHEN 'CNY' THEN CASE WHEN rates.cny_rate IS NOT NULL THEN d.account_currency_amount * rates.cny_rate ELSE d.account_currency_amount END
                 WHEN 'GBP' THEN CASE WHEN rates.gbp_rate IS NOT NULL THEN d.account_currency_amount * rates.gbp_rate ELSE d.account_currency_amount END
                 WHEN 'RUB' THEN CASE WHEN rates.rub_rate IS NOT NULL THEN d.account_currency_amount * rates.rub_rate ELSE d.account_currency_amount END
                 WHEN 'TRY' THEN CASE WHEN rates.try_rate IS NOT NULL THEN d.account_currency_amount * rates.try_rate ELSE d.account_currency_amount END
                 WHEN 'AED' THEN CASE WHEN rates.aed_rate IS NOT NULL THEN d.account_currency_amount * rates.aed_rate ELSE d.account_currency_amount END
                 WHEN 'KZT' THEN CASE WHEN rates.kzt_rate IS NOT NULL THEN d.account_currency_amount * rates.kzt_rate ELSE d.account_currency_amount END
                 ELSE d.account_currency_amount
               END
             ELSE
               (
                 d.account_currency_amount *
                 CASE acc.code
                   WHEN 'USD' THEN COALESCE(rates.usd_rate, 0)
                   WHEN 'EUR' THEN COALESCE(rates.eur_rate, 0)
                   WHEN 'CNY' THEN COALESCE(rates.cny_rate, 0)
                   WHEN 'GBP' THEN COALESCE(rates.gbp_rate, 0)
                   WHEN 'RUB' THEN COALESCE(rates.rub_rate, 0)
                   WHEN 'TRY' THEN COALESCE(rates.try_rate, 0)
                   WHEN 'AED' THEN COALESCE(rates.aed_rate, 0)
                   WHEN 'KZT' THEN COALESCE(rates.kzt_rate, 0)
                   ELSE 0
                 END
               ) /
               NULLIF(
                 CASE nom.code
                   WHEN 'USD' THEN COALESCE(rates.usd_rate, 0)
                   WHEN 'EUR' THEN COALESCE(rates.eur_rate, 0)
                   WHEN 'CNY' THEN COALESCE(rates.cny_rate, 0)
                   WHEN 'GBP' THEN COALESCE(rates.gbp_rate, 0)
                   WHEN 'RUB' THEN COALESCE(rates.rub_rate, 0)
                   WHEN 'TRY' THEN COALESCE(rates.try_rate, 0)
                   WHEN 'AED' THEN COALESCE(rates.aed_rate, 0)
                   WHEN 'KZT' THEN COALESCE(rates.kzt_rate, 0)
                   ELSE 0
                 END,
                 0
               )
           END as next_nominal_amount
         FROM "${tableName}" d
         LEFT JOIN currencies acc ON acc.uuid = d.account_currency_uuid
         LEFT JOIN currencies nom ON nom.uuid = COALESCE($2::uuid, d.nominal_currency_uuid)
         LEFT JOIN nbg_exchange_rates rates ON rates.date = d.transaction_date::date
         WHERE d.raw_record_uuid = ANY($1::uuid[])
       )
       SELECT COUNT(*)::int as cnt
       FROM calc
       WHERE next_nominal_amount IS DISTINCT FROM current_nominal_amount`,
      uuids,
      effectiveNominalCurrencyUuid
    );

    const wouldChange = Number(wouldChangeRows[0]?.cnt || 0);
    totalWouldChange += wouldChange;
    console.log(`- ${tableName}: matched=${uuids.length}, wouldChange=${wouldChange}`);

    if (!apply || !wouldChange) continue;

    const updatedRows = await prisma.$queryRawUnsafe(
      `WITH target_rows AS (
         SELECT
           d.raw_record_uuid,
           d.account_currency_amount,
           COALESCE($2::uuid, d.nominal_currency_uuid) as next_nominal_currency_uuid,
           acc.code as account_code,
           nom.code as nominal_code,
           rates.usd_rate,
           rates.eur_rate,
           rates.cny_rate,
           rates.gbp_rate,
           rates.rub_rate,
           rates.try_rate,
           rates.aed_rate,
           rates.kzt_rate
         FROM "${tableName}" d
         LEFT JOIN currencies acc ON acc.uuid = d.account_currency_uuid
         LEFT JOIN currencies nom ON nom.uuid = COALESCE($2::uuid, d.nominal_currency_uuid)
         LEFT JOIN nbg_exchange_rates rates ON rates.date = d.transaction_date::date
         WHERE d.raw_record_uuid = ANY($1::uuid[])
       ),
       upd AS (
         UPDATE "${tableName}" d
         SET
           nominal_currency_uuid = t.next_nominal_currency_uuid,
           nominal_amount = CASE
             WHEN t.account_currency_amount IS NULL THEN d.nominal_amount
             WHEN t.account_code IS NULL OR t.nominal_code IS NULL THEN t.account_currency_amount
             WHEN t.account_code = t.nominal_code THEN t.account_currency_amount
             WHEN t.account_code = 'GEL' THEN
               CASE t.nominal_code
                 WHEN 'USD' THEN CASE WHEN t.usd_rate IS NOT NULL AND t.usd_rate <> 0 THEN t.account_currency_amount / t.usd_rate ELSE t.account_currency_amount END
                 WHEN 'EUR' THEN CASE WHEN t.eur_rate IS NOT NULL AND t.eur_rate <> 0 THEN t.account_currency_amount / t.eur_rate ELSE t.account_currency_amount END
                 WHEN 'CNY' THEN CASE WHEN t.cny_rate IS NOT NULL AND t.cny_rate <> 0 THEN t.account_currency_amount / t.cny_rate ELSE t.account_currency_amount END
                 WHEN 'GBP' THEN CASE WHEN t.gbp_rate IS NOT NULL AND t.gbp_rate <> 0 THEN t.account_currency_amount / t.gbp_rate ELSE t.account_currency_amount END
                 WHEN 'RUB' THEN CASE WHEN t.rub_rate IS NOT NULL AND t.rub_rate <> 0 THEN t.account_currency_amount / t.rub_rate ELSE t.account_currency_amount END
                 WHEN 'TRY' THEN CASE WHEN t.try_rate IS NOT NULL AND t.try_rate <> 0 THEN t.account_currency_amount / t.try_rate ELSE t.account_currency_amount END
                 WHEN 'AED' THEN CASE WHEN t.aed_rate IS NOT NULL AND t.aed_rate <> 0 THEN t.account_currency_amount / t.aed_rate ELSE t.account_currency_amount END
                 WHEN 'KZT' THEN CASE WHEN t.kzt_rate IS NOT NULL AND t.kzt_rate <> 0 THEN t.account_currency_amount / t.kzt_rate ELSE t.account_currency_amount END
                 ELSE t.account_currency_amount
               END
             WHEN t.nominal_code = 'GEL' THEN
               CASE t.account_code
                 WHEN 'USD' THEN CASE WHEN t.usd_rate IS NOT NULL THEN t.account_currency_amount * t.usd_rate ELSE t.account_currency_amount END
                 WHEN 'EUR' THEN CASE WHEN t.eur_rate IS NOT NULL THEN t.account_currency_amount * t.eur_rate ELSE t.account_currency_amount END
                 WHEN 'CNY' THEN CASE WHEN t.cny_rate IS NOT NULL THEN t.account_currency_amount * t.cny_rate ELSE t.account_currency_amount END
                 WHEN 'GBP' THEN CASE WHEN t.gbp_rate IS NOT NULL THEN t.account_currency_amount * t.gbp_rate ELSE t.account_currency_amount END
                 WHEN 'RUB' THEN CASE WHEN t.rub_rate IS NOT NULL THEN t.account_currency_amount * t.rub_rate ELSE t.account_currency_amount END
                 WHEN 'TRY' THEN CASE WHEN t.try_rate IS NOT NULL THEN t.account_currency_amount * t.try_rate ELSE t.account_currency_amount END
                 WHEN 'AED' THEN CASE WHEN t.aed_rate IS NOT NULL THEN t.account_currency_amount * t.aed_rate ELSE t.account_currency_amount END
                 WHEN 'KZT' THEN CASE WHEN t.kzt_rate IS NOT NULL THEN t.account_currency_amount * t.kzt_rate ELSE t.account_currency_amount END
                 ELSE t.account_currency_amount
               END
             ELSE
               (
                 t.account_currency_amount *
                 CASE t.account_code
                   WHEN 'USD' THEN COALESCE(t.usd_rate, 0)
                   WHEN 'EUR' THEN COALESCE(t.eur_rate, 0)
                   WHEN 'CNY' THEN COALESCE(t.cny_rate, 0)
                   WHEN 'GBP' THEN COALESCE(t.gbp_rate, 0)
                   WHEN 'RUB' THEN COALESCE(t.rub_rate, 0)
                   WHEN 'TRY' THEN COALESCE(t.try_rate, 0)
                   WHEN 'AED' THEN COALESCE(t.aed_rate, 0)
                   WHEN 'KZT' THEN COALESCE(t.kzt_rate, 0)
                   ELSE 0
                 END
               ) /
               NULLIF(
                 CASE t.nominal_code
                   WHEN 'USD' THEN COALESCE(t.usd_rate, 0)
                   WHEN 'EUR' THEN COALESCE(t.eur_rate, 0)
                   WHEN 'CNY' THEN COALESCE(t.cny_rate, 0)
                   WHEN 'GBP' THEN COALESCE(t.gbp_rate, 0)
                   WHEN 'RUB' THEN COALESCE(t.rub_rate, 0)
                   WHEN 'TRY' THEN COALESCE(t.try_rate, 0)
                   WHEN 'AED' THEN COALESCE(t.aed_rate, 0)
                   WHEN 'KZT' THEN COALESCE(t.kzt_rate, 0)
                   ELSE 0
                 END,
                 0
               )
           END,
           applied_rule_id = $3,
           updated_at = NOW()
         FROM target_rows t
         WHERE d.raw_record_uuid = t.raw_record_uuid
         RETURNING d.raw_record_uuid
       )
       SELECT COUNT(*)::int as cnt FROM upd`,
      uuids,
      effectiveNominalCurrencyUuid,
      ruleId
    );

    const updated = Number(updatedRows[0]?.cnt || 0);
    totalUpdated += updated;
    console.log(`  ✅ updated=${updated}`);
  }

  console.log('\n📊 Backchange summary');
  console.log(`- Rule ID: ${ruleId}`);
  console.log(`- Source: ${source}`);
  console.log(`- Effective nominal currency UUID: ${effectiveNominalCurrencyUuid || 'null'}`);
  console.log(`- Matched rows: ${totalMatched}`);
  console.log(`- Would change: ${totalWouldChange}`);
  if (apply) {
    console.log(`- Updated rows: ${totalUpdated}`);
  } else {
    console.log('- Dry-run only (no updates applied)');
    console.log('  Run with --apply to execute updates.');
  }
}

main()
  .catch((error) => {
    console.error('❌ Backchange failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
