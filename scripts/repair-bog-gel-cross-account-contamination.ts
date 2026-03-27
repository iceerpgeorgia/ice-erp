import 'dotenv/config';
import { Client } from 'pg';

type Args = {
  mode: 'dry-run' | 'apply';
  startDate: string;
  endDate: string;
  tableName: string;
};

type WrongRow = {
  uuid: string;
  id: string;
  bank_account_uuid: string;
  transaction_date: string;
  entriesid: string | null;
  dockey: string | null;
  account_currency_amount: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    mode: 'dry-run',
    startDate: '2024-01-01',
    endDate: '2026-03-14',
    tableName: 'GE78BG0000000893486000_BOG_GEL',
  };

  for (let i = 2; i < argv.length; i += 1) {
    const cur = argv[i];
    const next = argv[i + 1];
    if (cur === '--mode' && (next === 'dry-run' || next === 'apply')) {
      args.mode = next;
      i += 1;
      continue;
    }
    if (cur === '--start' && next) {
      args.startDate = next;
      i += 1;
      continue;
    }
    if (cur === '--end' && next) {
      args.endDate = next;
      i += 1;
      continue;
    }
    if (cur === '--table' && next) {
      args.tableName = next;
      i += 1;
      continue;
    }
  }

  return args;
}

function assertDate(value: string, flag: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid ${flag}: ${value}. Expected YYYY-MM-DD.`);
  }
}

function assertSafeTable(value: string) {
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(`Unsafe table name: ${value}`);
  }
}

function deriveAccountAndCurrencyFromTable(tableName: string): { accountNumber: string; currency: string } {
  const m = tableName.match(/^(.*)_BOG_([A-Z]{3})$/);
  if (!m) {
    throw new Error(`Cannot derive account/currency from table name: ${tableName}`);
  }
  return { accountNumber: m[1], currency: m[2] };
}

async function getExpectedAccountUuid(client: Client, accountNumber: string, currency: string): Promise<string> {
  const q = await client.query<{ uuid: string }>(
    `
      SELECT ba.uuid::text AS uuid
      FROM bank_accounts ba
      JOIN banks b ON b.uuid = ba.bank_uuid
      JOIN currencies c ON c.uuid = ba.currency_uuid
      WHERE UPPER(b.bank_name) = 'BOG'
        AND ba.account_number = $1
        AND UPPER(c.code) = $2
      LIMIT 1
    `,
    [accountNumber, currency]
  );

  const uuid = q.rows[0]?.uuid;
  if (!uuid) {
    throw new Error(`Expected bank account not found for ${accountNumber} ${currency}`);
  }

  return uuid;
}

async function fetchWrongRows(
  client: Client,
  tableName: string,
  expectedAccountUuid: string,
  startDate: string,
  endDate: string
): Promise<WrongRow[]> {
  const q = await client.query<WrongRow>(
    `
      SELECT
        uuid::text AS uuid,
        id::text AS id,
        bank_account_uuid::text AS bank_account_uuid,
        transaction_date::text AS transaction_date,
        entriesid,
        dockey,
        account_currency_amount::text AS account_currency_amount
      FROM "${tableName}"
      WHERE bank_account_uuid::text <> $1
        AND transaction_date::date BETWEEN $2::date AND $3::date
      ORDER BY transaction_date, id
    `,
    [expectedAccountUuid, startDate, endDate]
  );
  return q.rows;
}

async function hasMirrorInCorrectTable(client: Client, row: WrongRow): Promise<boolean> {
  // We only auto-delete rows that are guaranteed duplicates by stable key fields.
  const q = await client.query<{ cnt: string }>(
    `
      SELECT COUNT(*)::text AS cnt
      FROM "GE78BG0000000893486000_BOG_EUR"
      WHERE uuid::text = $1
        AND bank_account_uuid::text = $2
        AND transaction_date::date = $3::date
        AND COALESCE(entriesid, '') = COALESCE($4, '')
        AND COALESCE(dockey, '') = COALESCE($5, '')
        AND account_currency_amount::text = $6
    `,
    [
      row.uuid,
      row.bank_account_uuid,
      row.transaction_date,
      row.entriesid,
      row.dockey,
      row.account_currency_amount,
    ]
  );
  return Number(q.rows[0]?.cnt || '0') > 0;
}

async function deleteRows(client: Client, tableName: string, uuids: string[]): Promise<number> {
  if (uuids.length === 0) return 0;
  let deleted = 0;
  for (const uuid of uuids) {
    const q = await client.query(
      `DELETE FROM "${tableName}" WHERE uuid::text = $1`,
      [uuid]
    );
    deleted += q.rowCount || 0;
  }
  return deleted;
}

async function main() {
  const args = parseArgs(process.argv);
  assertDate(args.startDate, '--start');
  assertDate(args.endDate, '--end');
  assertSafeTable(args.tableName);

  const cs = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!cs) throw new Error('Missing DIRECT_DATABASE_URL or DATABASE_URL');

  const client = new Client({ connectionString: cs });
  await client.connect();

  try {
    const { accountNumber, currency } = deriveAccountAndCurrencyFromTable(args.tableName);
    const expectedAccountUuid = await getExpectedAccountUuid(client, accountNumber, currency);

    const wrongRows = await fetchWrongRows(
      client,
      args.tableName,
      expectedAccountUuid,
      args.startDate,
      args.endDate
    );

    const safeToDelete: WrongRow[] = [];
    const blocked: WrongRow[] = [];
    for (const row of wrongRows) {
      // This cleanup is intentionally conservative: delete only if mirrored in correct EUR table.
      if (await hasMirrorInCorrectTable(client, row)) {
        safeToDelete.push(row);
      } else {
        blocked.push(row);
      }
    }

    if (args.mode === 'apply') {
      const deleted = await deleteRows(
        client,
        args.tableName,
        safeToDelete.map((r) => r.uuid)
      );

      console.log(
        JSON.stringify(
          {
            mode: args.mode,
            tableName: args.tableName,
            expectedAccountUuid,
            range: { start: args.startDate, end: args.endDate },
            foundWrongRows: wrongRows.length,
            deletedRows: deleted,
            blockedRows: blocked.length,
            blocked,
          },
          null,
          2
        )
      );
      return;
    }

    console.log(
      JSON.stringify(
        {
          mode: args.mode,
          tableName: args.tableName,
          expectedAccountUuid,
          range: { start: args.startDate, end: args.endDate },
          foundWrongRows: wrongRows.length,
          safeToDelete: safeToDelete.length,
          blockedRows: blocked.length,
          safeToDeletePreview: safeToDelete,
          blocked,
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
