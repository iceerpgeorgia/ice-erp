import 'dotenv/config';
import { Client } from 'pg';

type Args = {
  startDate: string;
  endDate: string;
  dryRun: boolean;
  accountUuid: string | null;
};

type BogAccount = {
  uuid: string;
  account_number: string;
  currency_code: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    startDate: '2018-01-01',
    endDate: new Date().toISOString().slice(0, 10),
    dryRun: false,
    accountUuid: null,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const cur = argv[i];
    const next = argv[i + 1];

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

    if (cur === '--account-uuid' && next) {
      args.accountUuid = next;
      i += 1;
      continue;
    }

    if (cur === '--dry-run') {
      args.dryRun = true;
      continue;
    }
  }

  return args;
}

function assertDate(value: string, flagName: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid ${flagName}: ${value}. Expected YYYY-MM-DD.`);
  }
}

async function loadBogAccounts(client: Client, accountUuid: string | null): Promise<BogAccount[]> {
  const params: string[] = [];
  let whereClause = `WHERE UPPER(b.bank_name) = 'BOG'`;

  if (accountUuid) {
    params.push(accountUuid);
    whereClause += ` AND ba.uuid = $1::uuid`;
  }

  const sql = `
    SELECT
      ba.uuid,
      ba.account_number,
      UPPER(COALESCE(c.code, 'GEL')) AS currency_code
    FROM bank_accounts ba
    LEFT JOIN banks b ON ba.bank_uuid = b.uuid
    LEFT JOIN currencies c ON ba.currency_uuid = c.uuid
    ${whereClause}
    ORDER BY ba.account_number, currency_code
  `;

  const result = await client.query<BogAccount>(sql, params);
  return result.rows;
}

async function getSegmentCount(client: Client, accountUuid: string): Promise<number> {
  const result = await client.query(
    `SELECT COUNT(*)::int AS c FROM bank_account_balances WHERE account_uuid = $1::uuid`,
    [accountUuid]
  );
  return Number(result.rows[0]?.c || 0);
}

async function main() {
  const args = parseArgs(process.argv);
  assertDate(args.startDate, '--start');
  assertDate(args.endDate, '--end');

  if (args.startDate > args.endDate) {
    throw new Error(`Invalid range: --start ${args.startDate} is after --end ${args.endDate}`);
  }

  const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing DIRECT_DATABASE_URL or DATABASE_URL environment variable.');
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const accounts = await loadBogAccounts(client, args.accountUuid);
    if (accounts.length === 0) {
      throw new Error('No BOG bank accounts found for period synthesis.');
    }

    console.log(
      JSON.stringify(
        {
          mode: args.dryRun ? 'dry-run' : 'apply',
          range: { start: args.startDate, end: args.endDate },
          accountCount: accounts.length,
          accountFilter: args.accountUuid,
          method: 'db_function_recompute_bank_account_balance_periods',
        },
        null,
        2
      )
    );

    for (const account of accounts) {
      if (args.dryRun) {
        const existingSegments = await getSegmentCount(client, account.uuid);
        console.log(
          JSON.stringify(
            {
              accountUuid: account.uuid,
              accountNumber: account.account_number,
              currency: account.currency_code,
              status: 'dry-run',
              existingSegments,
              wouldRecomputeFrom: args.startDate,
              wouldRecomputeTo: args.endDate,
            },
            null,
            2
          )
        );
        continue;
      }

      await client.query(
        `SELECT recompute_bank_account_balance_periods($1::uuid, $2::date, $3::date)`,
        [account.uuid, args.startDate, args.endDate]
      );

      const segmentCount = await getSegmentCount(client, account.uuid);
      console.log(
        JSON.stringify(
          {
            accountUuid: account.uuid,
            accountNumber: account.account_number,
            currency: account.currency_code,
            status: 'recomputed',
            segmentCount,
          },
          null,
          2
        )
      );
    }

    console.log(
      JSON.stringify(
        {
          finished: true,
          mode: args.dryRun ? 'dry-run' : 'apply',
          accountsProcessed: accounts.length,
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
