import 'dotenv/config';
import { Client } from 'pg';

type Args = {
  mode: 'dry-run' | 'apply';
  limit: number;
};

type ConversionRow = {
  id: string;
  uuid: string;
  key_value: string;
  account_out_uuid: string;
  account_in_uuid: string;
  amount_out: string;
  amount_in: string;
  fee: string | null;
  insider_uuid: string;
};

type AccountInfo = {
  uuid: string;
  account_number: string;
  currency_uuid: string;
  currency_code: string;
  insider_uuid: string | null;
};

type RawPairRow = {
  uuid: string;
  entriesid: string | null;
  transaction_date: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { mode: 'dry-run', limit: 1000 };

  for (let i = 2; i < argv.length; i += 1) {
    const cur = argv[i];
    const next = argv[i + 1];
    if (cur === '--mode' && (next === 'dry-run' || next === 'apply')) {
      args.mode = next;
      i += 1;
      continue;
    }
    if (cur === '--limit' && next) {
      const n = Number(next);
      if (!Number.isNaN(n) && n > 0) {
        args.limit = n;
      }
      i += 1;
      continue;
    }
  }

  return args;
}

function schemeByCurrency(code: string): string {
  if (code === 'USD') return 'BOG_USD';
  if (code === 'EUR') return 'BOG_EUR';
  if (code === 'AED') return 'BOG_AED';
  if (code === 'GBP') return 'BOG_GBP';
  if (code === 'KZT') return 'BOG_KZT';
  if (code === 'CNY') return 'BOG_CNY';
  if (code === 'TRY') return 'BOG_TRY';
  return 'BOG_GEL';
}

function tableForAccount(account: AccountInfo): string {
  return `${account.account_number}_${schemeByCurrency(account.currency_code)}`;
}

function safeTableName(value: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(`Unsafe table name: ${value}`);
  }
  return value;
}

async function loadAccounts(client: Client): Promise<Map<string, AccountInfo>> {
  const q = await client.query<AccountInfo>(`
    SELECT
      ba.uuid::text AS uuid,
      ba.account_number,
      ba.currency_uuid::text AS currency_uuid,
      UPPER(COALESCE(c.code, 'GEL')) AS currency_code,
      ba.insider_uuid::text AS insider_uuid
    FROM bank_accounts ba
    LEFT JOIN banks b ON b.uuid = ba.bank_uuid
    LEFT JOIN currencies c ON c.uuid = ba.currency_uuid
    WHERE UPPER(COALESCE(b.bank_name, '')) = 'BOG'
  `);

  return new Map(q.rows.map((r) => [r.uuid, r]));
}

async function findRawPairRow(
  client: Client,
  tableName: string,
  conversionUuid: string,
  accountUuid: string,
  dockey: string
): Promise<RawPairRow | null> {
  const safe = safeTableName(tableName);
  const q = await client.query<RawPairRow>(
    `
      SELECT uuid::text AS uuid, entriesid, transaction_date::text AS transaction_date
      FROM "${safe}"
      WHERE conversion_id::text = $1
        AND bank_account_uuid::text = $2
        AND dockey = $3
      ORDER BY id DESC
      LIMIT 1
    `,
    [conversionUuid, accountUuid, dockey]
  );

  return q.rows[0] ?? null;
}

function conversionDateText(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
}

async function upsertEntry(client: Client, payload: Record<string, unknown>) {
  await client.query(
    `
      INSERT INTO conversion_entries (
        conversion_id,
        conversion_uuid,
        entry_type,
        bank_account_uuid,
        raw_record_uuid,
        dockey,
        entriesid,
        transaction_date,
        comment,
        account_currency_uuid,
        account_currency_amount,
        nominal_currency_uuid,
        nominal_amount,
        parsing_lock,
        batch_id,
        account_number,
        account_currency_code,
        nominal_currency_code,
        insider_uuid
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
      )
      ON CONFLICT (conversion_uuid, entry_type)
      DO UPDATE SET
        conversion_id = EXCLUDED.conversion_id,
        bank_account_uuid = EXCLUDED.bank_account_uuid,
        raw_record_uuid = EXCLUDED.raw_record_uuid,
        dockey = EXCLUDED.dockey,
        entriesid = EXCLUDED.entriesid,
        transaction_date = EXCLUDED.transaction_date,
        comment = EXCLUDED.comment,
        account_currency_uuid = EXCLUDED.account_currency_uuid,
        account_currency_amount = EXCLUDED.account_currency_amount,
        nominal_currency_uuid = EXCLUDED.nominal_currency_uuid,
        nominal_amount = EXCLUDED.nominal_amount,
        parsing_lock = EXCLUDED.parsing_lock,
        batch_id = EXCLUDED.batch_id,
        account_number = EXCLUDED.account_number,
        account_currency_code = EXCLUDED.account_currency_code,
        nominal_currency_code = EXCLUDED.nominal_currency_code,
        insider_uuid = EXCLUDED.insider_uuid
    `,
    [
      payload.conversion_id,
      payload.conversion_uuid,
      payload.entry_type,
      payload.bank_account_uuid,
      payload.raw_record_uuid,
      payload.dockey,
      payload.entriesid,
      payload.transaction_date,
      payload.comment,
      payload.account_currency_uuid,
      payload.account_currency_amount,
      payload.nominal_currency_uuid,
      payload.nominal_amount,
      payload.parsing_lock,
      payload.batch_id,
      payload.account_number,
      payload.account_currency_code,
      payload.nominal_currency_code,
      payload.insider_uuid,
    ]
  );
}

async function main() {
  const args = parseArgs(process.argv);
  const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Missing DIRECT_DATABASE_URL or DATABASE_URL');

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const accounts = await loadAccounts(client);

    const conversions = await client.query<ConversionRow>(
      `
        SELECT c.id::text AS id,
               c.uuid::text AS uuid,
               c.key_value,
               c.account_out_uuid::text AS account_out_uuid,
               c.account_in_uuid::text AS account_in_uuid,
               c.amount_out::text AS amount_out,
               c.amount_in::text AS amount_in,
               c.fee::text AS fee,
               c.insider_uuid::text AS insider_uuid
        FROM conversion c
        WHERE NOT EXISTS (
          SELECT 1 FROM conversion_entries ce WHERE ce.conversion_uuid = c.uuid
        )
        ORDER BY c.id DESC
        LIMIT $1
      `,
      [args.limit]
    );

    const preview: Array<Record<string, unknown>> = [];
    let processed = 0;
    let skipped = 0;

    for (const conv of conversions.rows) {
      const outAccount = accounts.get(conv.account_out_uuid);
      const inAccount = accounts.get(conv.account_in_uuid);
      if (!outAccount || !inAccount) {
        skipped += 1;
        continue;
      }

      const outTable = tableForAccount(outAccount);
      const inTable = tableForAccount(inAccount);
      const outRaw = await findRawPairRow(client, outTable, conv.uuid, outAccount.uuid, conv.key_value);
      const inRaw = await findRawPairRow(client, inTable, conv.uuid, inAccount.uuid, conv.key_value);

      if (!outRaw || !inRaw) {
        skipped += 1;
        continue;
      }

      const amountOut = Number(conv.amount_out);
      const amountIn = Number(conv.amount_in);
      const feeValue = Number(conv.fee || '0');
      const feeRounded = Math.round(feeValue * 100) / 100;
      const amountOutBody = -Math.abs(amountOut - feeRounded);
      const feeAmount = -Math.abs(feeRounded);
      const amountInValue = amountIn;

      const txDate = conversionDateText(outRaw.transaction_date);
      const batchId = `CONV_${conv.id}`;
      const commentText = `კონვერტაცია ${amountOut.toFixed(2)} ${outAccount.currency_code} = ${amountIn.toFixed(2)} ${inAccount.currency_code}`;
      const insiderUuid = conv.insider_uuid || outAccount.insider_uuid || inAccount.insider_uuid;
      if (!insiderUuid) {
        skipped += 1;
        continue;
      }

      const payloads = [
        {
          conversion_id: Number(conv.id),
          conversion_uuid: conv.uuid,
          entry_type: 'OUT',
          bank_account_uuid: outAccount.uuid,
          raw_record_uuid: outRaw.uuid,
          dockey: conv.key_value,
          entriesid: outRaw.entriesid,
          transaction_date: txDate,
          comment: commentText,
          account_currency_uuid: outAccount.currency_uuid,
          account_currency_amount: amountOutBody,
          nominal_currency_uuid: outAccount.currency_uuid,
          nominal_amount: amountOutBody,
          parsing_lock: true,
          batch_id: batchId,
          account_number: outAccount.account_number,
          account_currency_code: outAccount.currency_code,
          nominal_currency_code: outAccount.currency_code,
          insider_uuid: insiderUuid,
        },
        {
          conversion_id: Number(conv.id),
          conversion_uuid: conv.uuid,
          entry_type: 'FEE',
          bank_account_uuid: outAccount.uuid,
          raw_record_uuid: outRaw.uuid,
          dockey: conv.key_value,
          entriesid: outRaw.entriesid,
          transaction_date: txDate,
          comment: commentText,
          account_currency_uuid: outAccount.currency_uuid,
          account_currency_amount: feeAmount,
          nominal_currency_uuid: outAccount.currency_uuid,
          nominal_amount: feeAmount,
          parsing_lock: true,
          batch_id: batchId,
          account_number: outAccount.account_number,
          account_currency_code: outAccount.currency_code,
          nominal_currency_code: outAccount.currency_code,
          insider_uuid: insiderUuid,
        },
        {
          conversion_id: Number(conv.id),
          conversion_uuid: conv.uuid,
          entry_type: 'IN',
          bank_account_uuid: inAccount.uuid,
          raw_record_uuid: inRaw.uuid,
          dockey: conv.key_value,
          entriesid: inRaw.entriesid,
          transaction_date: txDate,
          comment: commentText,
          account_currency_uuid: inAccount.currency_uuid,
          account_currency_amount: amountInValue,
          nominal_currency_uuid: inAccount.currency_uuid,
          nominal_amount: amountInValue,
          parsing_lock: true,
          batch_id: batchId,
          account_number: inAccount.account_number,
          account_currency_code: inAccount.currency_code,
          nominal_currency_code: inAccount.currency_code,
          insider_uuid: insiderUuid,
        },
      ];

      if (args.mode === 'apply') {
        for (const payload of payloads) {
          await upsertEntry(client, payload);
        }
      }

      preview.push({
        conversionId: conv.id,
        conversionUuid: conv.uuid,
        keyValue: conv.key_value,
        outTable,
        inTable,
        txDate,
      });
      processed += 1;
    }

    console.log(
      JSON.stringify(
        {
          mode: args.mode,
          conversionsWithoutEntriesFound: conversions.rows.length,
          processed,
          skipped,
          preview,
        },
        null,
        2
      )
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
