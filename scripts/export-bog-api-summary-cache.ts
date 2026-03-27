import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import { bogApiRequest } from '../lib/integrations/bog/client';

type Args = {
  start: string;
  end: string;
  out: string;
  resume: boolean;
  seedFromDb: boolean;
  syncToBalances: boolean;
  onlyAccountUuid?: string;
};

type AccountRow = {
  uuid: string;
  account_number: string;
  currency_code: string;
  insider_uuid: string | null;
};

type CacheRow = {
  accountUuid: string;
  accountNumber: string;
  currency: string;
  date: string;
  path: string;
  status: number;
  ok: boolean;
  correlationId: string | null;
  operationsCount: number;
  apiOpeningBalance: number | null;
  apiClosingBalance: number | null;
  derivedOpeningBalance: number | null;
  derivedClosingBalance: number | null;
  netChange: number | null;
  error: string | null;
};

type CacheFile = {
  meta: {
    generatedAt: string;
    range: { start: string; end: string };
    accountsCount: number;
    rowsCount: number;
    okRows: number;
    failedRows: number;
  };
  rows: CacheRow[];
};

type AnyRecord = Record<string, unknown>;

function parseArgs(argv: string[]): Args {
  const args: Args = {
    start: '2024-01-01',
    end: new Date().toISOString().slice(0, 10),
    out: '',
    resume: true,
    seedFromDb: true,
    syncToBalances: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const cur = argv[i];
    const next = argv[i + 1];
    if (cur === '--start' && next) {
      args.start = next;
      i += 1;
      continue;
    }
    if (cur === '--end' && next) {
      args.end = next;
      i += 1;
      continue;
    }
    if (cur === '--out' && next) {
      args.out = next;
      i += 1;
      continue;
    }
    if (cur === '--no-resume') {
      args.resume = false;
      continue;
    }
    if (cur === '--no-seed-from-db') {
      args.seedFromDb = false;
      continue;
    }
    if (cur === '--sync-to-balances') {
      args.syncToBalances = true;
      continue;
    }
    if (cur === '--account-uuid' && next) {
      args.onlyAccountUuid = next;
      i += 1;
      continue;
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.start) || !/^\d{4}-\d{2}-\d{2}$/.test(args.end)) {
    throw new Error('Invalid --start/--end, expected YYYY-MM-DD');
  }

  if (!args.out) {
    args.out = `exports/bog-api-summary-cache-${args.start}-to-${args.end}.json`;
  }

  return args;
}

function dayList(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function dayBefore(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function pickNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function pickFirstNumber(record: AnyRecord, keys: string[]): number | null {
  for (const k of keys) {
    const v = pickNumber(record[k]);
    if (v !== null) return v;
  }
  return null;
}

function detectItems(payload: unknown): AnyRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((x): x is AnyRecord => Boolean(x) && typeof x === 'object');
  }

  if (!payload || typeof payload !== 'object') return [];
  const src = payload as AnyRecord;
  const data = src.data && typeof src.data === 'object' ? (src.data as AnyRecord) : null;
  const result = src.result && typeof src.result === 'object' ? (src.result as AnyRecord) : null;
  const statement = src.statement && typeof src.statement === 'object' ? (src.statement as AnyRecord) : null;

  const candidates = [
    src.Records,
    src.records,
    src.transactions,
    src.items,
    src.statementItems,
    data?.Records,
    data?.records,
    data?.transactions,
    data?.items,
    result?.Records,
    result?.records,
    result?.transactions,
    result?.items,
    statement?.Records,
    statement?.records,
    statement?.transactions,
    statement?.items,
  ];

  for (const c of candidates) {
    if (Array.isArray(c)) {
      return c.filter((x): x is AnyRecord => Boolean(x) && typeof x === 'object');
    }
  }
  return [];
}

function amountDelta(item: AnyRecord): number {
  const debit = pickFirstNumber(item, ['EntryAmountDebit', 'entryAmountDebit', 'EntryDbAmt', 'entryDbAmt', 'debit']);
  const credit = pickFirstNumber(item, ['EntryAmountCredit', 'entryAmountCredit', 'EntryCrAmt', 'entryCrAmt', 'credit']);
  if (debit !== null || credit !== null) {
    return (credit || 0) - (debit || 0);
  }

  const amount = pickFirstNumber(item, ['EntryAmount', 'entryAmount', 'amount', 'txnAmount']);
  return amount || 0;
}

function summarizeStatement(payload: unknown): {
  operationsCount: number;
  apiOpeningBalance: number | null;
  apiClosingBalance: number | null;
  netChange: number | null;
} {
  const items = detectItems(payload);
  const root = payload && typeof payload === 'object' ? (payload as AnyRecord) : {};
  const rootCount = pickNumber(root.Count);
  const operationsCount = rootCount ?? items.length;

  if (operationsCount === 0) {
    return {
      operationsCount,
      apiOpeningBalance: null,
      apiClosingBalance: null,
      netChange: 0,
    };
  }

  let apiClosingBalance = pickFirstNumber(root, [
    'balance',
    'outBalance',
    'OutBalance',
    'closingBalance',
    'ClosingBalance',
    'availableBalance',
    'AvailableBalance',
  ]);

  if (apiClosingBalance === null) {
    for (let i = items.length - 1; i >= 0; i -= 1) {
      apiClosingBalance = pickFirstNumber(items[i], [
        'OutBalance',
        'outBalance',
        'balance',
        'closingBalance',
        'runningBalance',
        'AvailableBalance',
        'availableBalance',
      ]);
      if (apiClosingBalance !== null) break;
    }
  }

  let apiOpeningBalance = pickFirstNumber(root, [
    'openingBalance',
    'OpeningBalance',
    'startBalance',
    'StartBalance',
    'beginBalance',
    'BeginBalance',
  ]);

  if (apiOpeningBalance === null && items.length > 0) {
    apiOpeningBalance = pickFirstNumber(items[0], [
      'OpeningBalance',
      'openingBalance',
      'PrevBalance',
      'prevBalance',
      'previousBalance',
      'balanceBefore',
    ]);
  }

  const netChange = items.reduce((s, item) => s + amountDelta(item), 0);

  if (apiOpeningBalance === null && apiClosingBalance !== null) {
    apiOpeningBalance = apiClosingBalance - netChange;
  }

  return {
    operationsCount,
    apiOpeningBalance: apiOpeningBalance === null ? null : Number(apiOpeningBalance.toFixed(2)),
    apiClosingBalance: apiClosingBalance === null ? null : Number(apiClosingBalance.toFixed(2)),
    netChange: Number(netChange.toFixed(2)),
  };
}

async function loadBogAccounts(pg: Client, onlyAccountUuid?: string): Promise<AccountRow[]> {
  const where = onlyAccountUuid
    ? `WHERE UPPER(COALESCE(b.bank_name, '')) = 'BOG' AND ba.uuid::text = $1`
    : `WHERE UPPER(COALESCE(b.bank_name, '')) = 'BOG'`;

  const params = onlyAccountUuid ? [onlyAccountUuid] : [];
  const q = await pg.query<AccountRow>(
    `
      SELECT
        ba.uuid::text AS uuid,
        UPPER(ba.account_number) AS account_number,
        UPPER(COALESCE(c.code, 'GEL')) AS currency_code,
        ba.insider_uuid::text AS insider_uuid
      FROM bank_accounts ba
      LEFT JOIN banks b ON b.uuid = ba.bank_uuid
      LEFT JOIN currencies c ON c.uuid = ba.currency_uuid
      ${where}
      ORDER BY ba.account_number, c.code
    `,
    params
  );
  return q.rows;
}

async function loadSeedClosings(
  pg: Client,
  accountUuids: string[],
  dateValue: string
): Promise<Map<string, number>> {
  if (accountUuids.length === 0) return new Map();

  const q = await pg.query<{ account_uuid: string; closing_balance: string }>(
    `
      SELECT account_uuid::text AS account_uuid, closing_balance::text AS closing_balance
      FROM bank_account_balances
      WHERE closing_date = $1
        AND account_uuid::text = ANY($2::text[])
    `,
    [dateValue, accountUuids]
  );

  const out = new Map<string, number>();
  for (const r of q.rows) {
    const n = Number(r.closing_balance);
    if (Number.isFinite(n)) out.set(r.account_uuid, n);
  }
  return out;
}

function rowKey(r: Pick<CacheRow, 'accountUuid' | 'date'>): string {
  return `${r.accountUuid}|${r.date}`;
}

function readExisting(outPath: string): CacheFile | null {
  if (!fs.existsSync(outPath)) return null;
  const raw = fs.readFileSync(outPath, 'utf8').replace(/^\uFEFF/, '').trim();
  if (!raw) return null;
  return JSON.parse(raw) as CacheFile;
}

function writeCache(outPath: string, data: CacheFile) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function applyDerivedBalances(rows: CacheRow[], seedClosings: Map<string, number>) {
  const sorted = rows.slice().sort((a, b) => {
    if (a.accountUuid !== b.accountUuid) return a.accountUuid.localeCompare(b.accountUuid);
    return a.date.localeCompare(b.date);
  });

  const rolling = new Map<string, number>();
  for (const r of sorted) {
    if (!rolling.has(r.accountUuid) && seedClosings.has(r.accountUuid)) {
      rolling.set(r.accountUuid, seedClosings.get(r.accountUuid)!);
    }

    if (!r.ok || r.netChange === null) continue;
    const open = rolling.get(r.accountUuid);
    if (open === undefined) continue;

    const close = Number((open + r.netChange).toFixed(2));
    r.derivedOpeningBalance = Number(open.toFixed(2));
    r.derivedClosingBalance = close;
    rolling.set(r.accountUuid, close);
  }
}


function dateInRange(day: string, start: Date, end: Date): boolean {
  const current = new Date(`${day}T00:00:00Z`);
  return current >= start && current < end;
}

function rounded(value: number): number {
  return Number(value.toFixed(2));
}

async function syncApiColumnsToBalances(
  pg: Client,
  rows: CacheRow[],
  accountUuids: string[],
  rangeStart: string,
  rangeEnd: string
): Promise<{ updatedRows: number; touchedAccounts: number }> {
  if (accountUuids.length === 0) {
    return { updatedRows: 0, touchedAccounts: 0 };
  }

  const okRows = rows.filter((r) => r.ok);
  if (okRows.length === 0) {
    return { updatedRows: 0, touchedAccounts: 0 };
  }

  const segments = await pg.query<{
    id: string;
    account_uuid: string;
    opening_date: string;
    closing_date: string;
  }>(
    `
      SELECT
        id::text AS id,
        account_uuid::text AS account_uuid,
        opening_date::text AS opening_date,
        closing_date::text AS closing_date
      FROM bank_account_balances
      WHERE account_uuid::text = ANY($1::text[])
        AND closing_date > $2::date
        AND opening_date <= $3::date
      ORDER BY account_uuid, opening_date
    `,
    [accountUuids, rangeStart, rangeEnd]
  );

  let updatedRows = 0;
  const touchedAccounts = new Set<string>();

  for (const segment of segments.rows) {
    const segStart = new Date(`${segment.opening_date}T00:00:00Z`);
    const segEnd = new Date(`${segment.closing_date}T00:00:00Z`);

    const segmentRows = okRows
      .filter((r) => r.accountUuid === segment.account_uuid && dateInRange(r.date, segStart, segEnd))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (segmentRows.length === 0) continue;

    const first = segmentRows[0];
    const last = segmentRows[segmentRows.length - 1];

    const openingBankApi = first.apiOpeningBalance ?? first.derivedOpeningBalance;
    const closingBankApi = last.apiClosingBalance ?? last.derivedClosingBalance;

    let inflow = 0;
    let outflow = 0;
    for (const row of segmentRows) {
      if (row.netChange === null) continue;
      if (row.netChange >= 0) inflow += row.netChange;
      else outflow += Math.abs(row.netChange);
    }

    await pg.query(
      `
        UPDATE bank_account_balances
        SET
          opening_balance_bank_api = $2,
          inflow_bank_api = $3,
          outflow_bank_api = $4,
          closing_balance_bank_api = $5
        WHERE id::text = $1
      `,
      [
        segment.id,
        openingBankApi === null ? null : rounded(openingBankApi),
        rounded(inflow),
        rounded(outflow),
        closingBankApi === null ? null : rounded(closingBankApi),
      ]
    );

    updatedRows += 1;
    touchedAccounts.add(segment.account_uuid);
  }

  return { updatedRows, touchedAccounts: touchedAccounts.size };
}

async function main() {
  const args = parseArgs(process.argv);
  const direct = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!direct) throw new Error('Missing DIRECT_DATABASE_URL or DATABASE_URL');

  const pg = new Client({ connectionString: direct });
  await pg.connect();

  try {
    const accounts = await loadBogAccounts(pg, args.onlyAccountUuid);
    if (accounts.length === 0) {
      throw new Error('No BOG accounts found for cache export');
    }

    const days = dayList(args.start, args.end);
    const existing = args.resume ? readExisting(args.out) : null;
    const rows: CacheRow[] = existing?.rows || [];
    const known = new Set(rows.map((r) => rowKey(r)));

    let done = 0;
    const total = accounts.length * days.length;

    for (const acc of accounts) {
      for (const day of days) {
        done += 1;
        const k = `${acc.uuid}|${day}`;
        if (known.has(k)) continue;

        const endpointPath = `/statement/${acc.account_number}/${acc.currency_code}/${day}/${day}`;

        const resp = await bogApiRequest<unknown>({
          method: 'GET',
          path: endpointPath,
          insiderUuid: acc.insider_uuid || undefined,
        });

        let row: CacheRow;
        if (!resp.ok) {
          row = {
            accountUuid: acc.uuid,
            accountNumber: acc.account_number,
            currency: acc.currency_code,
            date: day,
            path: endpointPath,
            status: resp.status,
            ok: false,
            correlationId: resp.correlationId,
            operationsCount: 0,
            apiOpeningBalance: null,
            apiClosingBalance: null,
            derivedOpeningBalance: null,
            derivedClosingBalance: null,
            netChange: null,
            error: typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data).slice(0, 800),
          };
        } else {
          const s = summarizeStatement(resp.data);
          row = {
            accountUuid: acc.uuid,
            accountNumber: acc.account_number,
            currency: acc.currency_code,
            date: day,
            path: endpointPath,
            status: resp.status,
            ok: true,
            correlationId: resp.correlationId,
            operationsCount: s.operationsCount,
            apiOpeningBalance: s.apiOpeningBalance,
            apiClosingBalance: s.apiClosingBalance,
            derivedOpeningBalance: null,
            derivedClosingBalance: null,
            netChange: s.netChange,
            error: null,
          };
        }

        rows.push(row);
        known.add(k);

        if (done % 100 === 0) {
          if (args.seedFromDb) {
            const seed = await loadSeedClosings(pg, accounts.map((a) => a.uuid), dayBefore(args.start));
            applyDerivedBalances(rows, seed);
          }

          const okRows = rows.filter((r) => r.ok).length;
          const failedRows = rows.length - okRows;
          writeCache(args.out, {
            meta: {
              generatedAt: new Date().toISOString(),
              range: { start: args.start, end: args.end },
              accountsCount: accounts.length,
              rowsCount: rows.length,
              okRows,
              failedRows,
            },
            rows,
          });
          console.log(`Progress: ${done}/${total} processed, cached rows=${rows.length}, ok=${okRows}, failed=${failedRows}`);
        }
      }
    }

    if (args.seedFromDb) {
      const seed = await loadSeedClosings(pg, accounts.map((a) => a.uuid), dayBefore(args.start));
      applyDerivedBalances(rows, seed);
    }

    const okRows = rows.filter((r) => r.ok).length;
    const failedRows = rows.length - okRows;
    const payload: CacheFile = {
      meta: {
        generatedAt: new Date().toISOString(),
        range: { start: args.start, end: args.end },
        accountsCount: accounts.length,
        rowsCount: rows.length,
        okRows,
        failedRows,
      },
      rows,
    };

    writeCache(args.out, payload);
    let syncSummary: { updatedRows: number; touchedAccounts: number } | null = null;
    if (args.syncToBalances) {
      syncSummary = await syncApiColumnsToBalances(
        pg,
        rows,
        accounts.map((a) => a.uuid),
        args.start,
        args.end
      );
    }

    console.log(
      JSON.stringify(
        {
          out: args.out,
          meta: payload.meta,
          syncToBalances: args.syncToBalances,
          ...(syncSummary ? { syncSummary } : {}),
        },
        null,
        2
      )
    );
  } finally {
    await pg.end();
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});



