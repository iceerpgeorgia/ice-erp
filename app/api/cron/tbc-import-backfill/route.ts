import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getTbcBisConfigStatus, tbcBisApiRequest } from '@/lib/integrations/tbc-bis/client';
import { mapTbcStatementPayloadToXml } from '@/lib/integrations/tbc-bis/statement-mapper';
import { processTBC } from '@/lib/bank-import/import_bank_xml_data';
import { getSupabaseClient } from '@/lib/bank-import/db-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 600;

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { startDate, endDate, daysBack } = body as Record<string, unknown>;

    let startYmd: string;
    let endYmd: string;

    if (typeof startDate === 'string' && typeof endDate === 'string') {
      startYmd = startDate;
      endYmd = endDate;
    } else {
      const days = Number(daysBack) || 30;
      const now = new Date(getTbilisiYmd(new Date()) + 'T00:00:00Z');
      const start = new Date(now);
      start.setUTCDate(start.getUTCDate() - days);
      startYmd = start.toISOString().slice(0, 10);
      endYmd = now.toISOString().slice(0, 10);
    }

    const authHeader = req.headers.get('authorization');
    const cronSecret = String(process.env.CRON_SECRET || '').trim();
    const hasValidSecret = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;

    if (!hasValidSecret) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized', message: 'Valid authorization header required' },
        { status: 401 }
      );
    }

    const configStatus = getTbcBisConfigStatus();
    if (
      !configStatus.hasCredentialsMap &&
      !configStatus.hasClientId &&
      !configStatus.hasStaticAccessToken
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'TBC BIS credentials not configured',
          message:
            'Set TBC_BIS_CREDENTIALS_MAP or TBC_BIS_CLIENT_ID/TBC_BIS_CLIENT_SECRET or TBC_BIS_ACCESS_TOKEN',
          config: configStatus,
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();
    const insiderCandidates = parseCredentialsMapInsiders();
    const defaultInsiderUuid = insiderCandidates.length === 1 ? insiderCandidates[0] : null;

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

    const tbcAccounts = ((accounts || []) as TbcAccount[]).filter(
      (acc) => String(acc.account_number || '').trim().length > 0
    );

    if (tbcAccounts.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No TBC accounts configured',
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
      accountNumber: string;
      currencyCode: string;
      date: string;
      detailsCount: number;
      correlationId: string | null;
    }> = [];
    const failures: Array<{
      accountNumber: string;
      reason: string;
    }> = [];

    for (const account of tbcAccounts) {
      const accountNumber = String(account.account_number || '').trim().toUpperCase();
      const currencyCode = currencyMap.get(account.currency_uuid);

      if (!currencyCode) {
        failures.push({
          accountNumber,
          reason: 'Currency code not found',
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
            accountNumber,
            currencyCode,
            date: day,
            detailsCount: mapped.detailsCount,
            correlationId: tbcResponse.correlationId,
          });
        } catch (error: any) {
          failures.push({
            accountNumber,
            reason: `${error?.message || 'Unknown error'} on ${day}`,
          });
        }
      }
    }

    const totalTransactions = successes.reduce((sum, item) => sum + item.detailsCount, 0);

    return NextResponse.json({
      ok: failures.length === 0,
      message: `Imported ${totalTransactions} transactions from ${successes.length} days`,
      period: { startYmd, endYmd },
      totalTransactions,
      successDays: successes.length,
      failedDays: failures.length,
      successes: successes.slice(0, 10),
      failures: failures.slice(0, 10),
      config: configStatus,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'TBC backfill failed',
        config: getTbcBisConfigStatus(),
      },
      { status: 500 }
    );
  }
}

