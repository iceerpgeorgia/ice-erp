import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { tbcBisApiRequest, getTbcBisConfigStatus } from '@/lib/integrations/tbc-bis/client';
import { mapTbcStatementPayloadToXml } from '@/lib/integrations/tbc-bis/statement-mapper';
import { processTBC } from '@/lib/bank-import/import_bank_xml_data';
import { getSupabaseClient } from '@/lib/bank-import/db-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type TbcAccount = {
  uuid: string;
  account_number: string;
  currency_uuid: string;
  insider_uuid: string | null;
  raw_table_name: string | null;
};

function getTbilisiYmd(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tbilisi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Failed to derive Tbilisi date parts');
  }

  return `${year}-${month}-${day}`;
}

function getLastThreeDaysRangeInTbilisi() {
  const includeToday = String(process.env.TBC_CRON_INCLUDE_TODAY || '').trim() === '1';
  const rawLookback = Number(process.env.TBC_CRON_LOOKBACK_DAYS || 3);
  const lookbackDays = Number.isFinite(rawLookback) ? Math.max(1, Math.floor(rawLookback)) : 3;

  const todayYmd = getTbilisiYmd(new Date());
  const end = new Date(`${todayYmd}T00:00:00Z`);
  if (!includeToday) {
    end.setUTCDate(end.getUTCDate() - 1);
  }

  const endYmd = end.toISOString().slice(0, 10);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (lookbackDays - 1));
  const startYmd = start.toISOString().slice(0, 10);

  return { startYmd, endYmd };
}

function parseCredentialsMapInsiders(): string[] {
  const raw = process.env.TBC_BIS_CREDENTIALS_MAP;
  if (!raw) return [];

  const normalized = raw.trim().replace(/^['"]|['"]$/g, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    try {
      parsed = JSON.parse(normalized.replace(/\\"/g, '"'));
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return '';
      const row = entry as Record<string, unknown>;
      return String(row.insiderUuid || row.INSIDER_UUID || '').trim();
    })
    .filter((value) => value.length > 0);
}

function parseAllowedAccountUuids(): Set<string> | null {
  const raw = String(process.env.TBC_CRON_ACCOUNT_UUIDS || '').trim();
  if (!raw) return null;

  const values = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return values.length > 0 ? new Set(values) : null;
}

function* iterateDays(startYmd: string, endYmd: string): Generator<string> {
  const start = new Date(`${startYmd}T00:00:00Z`);
  const end = new Date(`${endYmd}T00:00:00Z`);

  for (let day = new Date(start); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    yield day.toISOString().slice(0, 10);
  }
}

function buildTbcStatementPath(
  accountNumber: string,
  currencyCode: string,
  fromDate: string,
  toDate: string
) {
  const template =
    String(process.env.TBC_BIS_STATEMENT_PATH_TEMPLATE || '').trim() ||
    '/bab/v1/accounts/movements?accountNumber={accountNumber}&currency={currencyCode}&from={fromDate}&to={toDate}';

  return template
    .replace(/\{accountNumber\}/g, encodeURIComponent(accountNumber))
    .replace(/\{currencyCode\}/g, encodeURIComponent(currencyCode))
    .replace(/\{fromDate\}/g, encodeURIComponent(fromDate))
    .replace(/\{toDate\}/g, encodeURIComponent(toDate));
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const vercelCronHeader = req.headers.get('x-vercel-cron');
    const vercelInfraHeader = req.headers.get('x-vercel-id');
    const userAgent = req.headers.get('user-agent') || '';
    const cronSecret = String(process.env.CRON_SECRET || '').trim();

    const hasValidSecret = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;
    const hasVercelCronHeader = vercelCronHeader !== null;
    const hasVercelInfraSignals = Boolean(vercelInfraHeader) && /vercel|cron/i.test(userAgent);
    const isAuthorized = hasVercelCronHeader || hasVercelInfraSignals || hasValidSecret;

    if (!isAuthorized) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Unauthorized',
          hints: {
            hasVercelCronHeader,
            hasVercelInfraHeader: Boolean(vercelInfraHeader),
            userAgentSample: userAgent.slice(0, 120),
            hasAuthorizationHeader: Boolean(authHeader),
            hasCronSecretConfigured: Boolean(cronSecret),
          },
        },
        { status: 401 }
      );
    }

    const supabase = getSupabaseClient();
    const insiderCandidates = parseCredentialsMapInsiders();
    const defaultInsiderUuid = insiderCandidates.length === 1 ? insiderCandidates[0] : null;
    const allowedAccounts = parseAllowedAccountUuids();
    const { startYmd, endYmd } = getLastThreeDaysRangeInTbilisi();

    const { data: tbcBank, error: bankError } = await supabase
      .from('banks')
      .select('uuid')
      .eq('bank_name', 'TBC')
      .maybeSingle();

    if (bankError) {
      throw new Error(`Failed to resolve TBC bank UUID: ${bankError.message}`);
    }

    if (!tbcBank?.uuid) {
      return NextResponse.json({ ok: true, message: 'No TBC bank configured', processed: 0 });
    }

    const { data: accounts, error: accountsError } = await supabase
      .from('bank_accounts')
      .select('uuid, account_number, currency_uuid, insider_uuid, raw_table_name')
      .eq('bank_uuid', tbcBank.uuid);

    if (accountsError) {
      throw new Error(`Failed to load TBC bank accounts: ${accountsError.message}`);
    }

    const allTbcAccounts = ((accounts || []) as TbcAccount[]).filter(
      (acc) => String(acc.account_number || '').trim().length > 0
    );

    let filterIgnored = false;
    let tbcAccounts = allTbcAccounts.filter((acc) =>
      allowedAccounts ? allowedAccounts.has(acc.uuid) : true
    );

    if (allowedAccounts && tbcAccounts.length === 0 && allTbcAccounts.length > 0) {
      filterIgnored = true;
      tbcAccounts = allTbcAccounts;
    }

    if (tbcAccounts.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No TBC accounts selected for cron import',
        processed: 0,
      });
    }

    const currencyUuids = Array.from(new Set(tbcAccounts.map((acc) => acc.currency_uuid)));
    const { data: currencies, error: currenciesError } = await supabase
      .from('currencies')
      .select('uuid, code')
      .in('uuid', currencyUuids);

    if (currenciesError) {
      throw new Error(`Failed to load currencies: ${currenciesError.message}`);
    }

    const currencyMap = new Map<string, string>();
    for (const row of currencies || []) {
      currencyMap.set(String(row.uuid), String(row.code).trim().toUpperCase());
    }

    const successes: Array<{
      accountUuid: string;
      accountNumber: string;
      currencyCode: string;
      detailsCount: number;
      correlationId: string | null;
      path: string;
      noTransactions?: boolean;
    }> = [];
    const failures: Array<{
      accountUuid: string;
      accountNumber: string;
      reason: string;
    }> = [];

    for (const account of tbcAccounts) {
      const accountNumber = String(account.account_number || '').trim().toUpperCase();
      const currencyCode = currencyMap.get(account.currency_uuid);

      if (!currencyCode) {
        failures.push({
          accountUuid: account.uuid,
          accountNumber,
          reason: `Currency code not found for currency_uuid=${account.currency_uuid}`,
        });
        continue;
      }

      const insiderUuid = account.insider_uuid || defaultInsiderUuid || undefined;
      const rawTableName =
        String(account.raw_table_name || '').trim() || `${accountNumber}_TBC_${currencyCode}`;

      for (const day of iterateDays(startYmd, endYmd)) {
        const path = buildTbcStatementPath(accountNumber, currencyCode, day, day);

        try {
          const tbcResponse = await tbcBisApiRequest<unknown>({
            method: 'GET',
            path,
            insiderUuid,
          });

          if (!tbcResponse.ok) {
            failures.push({
              accountUuid: account.uuid,
              accountNumber,
              reason: `TBC BIS ${tbcResponse.status} on ${day}`,
            });
            continue;
          }

          const mapped = mapTbcStatementPayloadToXml(tbcResponse.data, {
            accountNumber,
            currencyCode,
            allowEmptyStatement: true,
          });

          if (mapped.detailsCount === 0) {
            successes.push({
              accountUuid: account.uuid,
              accountNumber,
              currencyCode,
              detailsCount: 0,
              correlationId: tbcResponse.correlationId,
              path,
              noTransactions: true,
            });
            continue;
          }

          await processTBC(
            mapped.xmlContent,
            account.uuid,
            accountNumber,
            currencyCode,
            rawTableName,
            uuidv4()
          );

          successes.push({
            accountUuid: account.uuid,
            accountNumber,
            currencyCode,
            detailsCount: mapped.detailsCount,
            correlationId: tbcResponse.correlationId,
            path,
          });
        } catch (error: any) {
          failures.push({
            accountUuid: account.uuid,
            accountNumber,
            reason: `${error?.message || 'Unknown error'} on ${day}`,
          });
        }
      }
    }

    return NextResponse.json({
      ok: failures.length === 0,
      period: { startYmd, endYmd, timeZone: 'Asia/Tbilisi' },
      filterIgnored,
      consideredAccounts: tbcAccounts.length,
      processedAccounts: successes.length,
      failedAccounts: failures.length,
      successes,
      failures,
      config: getTbcBisConfigStatus(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'TBC cron import failed',
        config: getTbcBisConfigStatus(),
      },
      { status: 500 }
    );
  }
}

