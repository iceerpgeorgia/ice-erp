import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { bogApiRequest, getBogConfigStatus } from '@/lib/integrations/bog/client';
import { mapBogStatementPayloadToXml } from '@/lib/integrations/bog/statement-mapper';
import { processBOGGELDeconsolidated } from '@/lib/bank-import/import_bank_xml_data_deconsolidated';
import { getSupabaseClient } from '@/lib/bank-import/db-utils';

export const dynamic = 'force-dynamic';

type BogAccount = {
  uuid: string;
  account_number: string;
  currency_uuid: string;
  insider_uuid: string | null;
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
  const endYmd = getTbilisiYmd(new Date());
  const end = new Date(`${endYmd}T00:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 2);
  const startYmd = start.toISOString().slice(0, 10);

  return { startYmd, endYmd };
}

function parseCredentialsMapInsiders(): string[] {
  const raw = process.env.BOG_CREDENTIALS_MAP;
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
  const raw = String(process.env.BOG_CRON_ACCOUNT_UUIDS || '').trim();
  if (!raw) return null;

  const values = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return values.length > 0 ? new Set(values) : null;
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const vercelCronHeader = req.headers.get('x-vercel-cron');
    const userAgent = req.headers.get('user-agent') || '';

    const isAuthorized =
      Boolean(vercelCronHeader) ||
      userAgent.includes('vercel-cron') ||
      authHeader === `Bearer ${process.env.CRON_SECRET}`;

    if (!isAuthorized) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseClient();
    const insiderCandidates = parseCredentialsMapInsiders();
    const defaultInsiderUuid = insiderCandidates.length === 1 ? insiderCandidates[0] : null;
    const allowedAccounts = parseAllowedAccountUuids();
    const { startYmd, endYmd } = getLastThreeDaysRangeInTbilisi();

    const { data: bogBank, error: bankError } = await supabase
      .from('banks')
      .select('uuid')
      .eq('bank_name', 'BOG')
      .maybeSingle();

    if (bankError) {
      throw new Error(`Failed to resolve BOG bank UUID: ${bankError.message}`);
    }

    if (!bogBank?.uuid) {
      return NextResponse.json({ ok: true, message: 'No BOG bank configured', processed: 0 });
    }

    const { data: accounts, error: accountsError } = await supabase
      .from('bank_accounts')
      .select('uuid, account_number, currency_uuid, insider_uuid')
      .eq('bank_uuid', bogBank.uuid);

    if (accountsError) {
      throw new Error(`Failed to load BOG bank accounts: ${accountsError.message}`);
    }

    const bogAccounts = ((accounts || []) as BogAccount[])
      .filter((acc) => String(acc.account_number || '').trim().length > 0)
      .filter((acc) => (allowedAccounts ? allowedAccounts.has(acc.uuid) : true));

    if (bogAccounts.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No BOG accounts selected for cron import',
        processed: 0,
      });
    }

    const currencyUuids = Array.from(new Set(bogAccounts.map((acc) => acc.currency_uuid)));
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

    for (const account of bogAccounts) {
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
      const path = `/statement/${accountNumber}/${currencyCode}/${startYmd}/${endYmd}`;

      try {
        const bogResponse = await bogApiRequest<unknown>({
          method: 'GET',
          path,
          insiderUuid,
        });

        if (!bogResponse.ok) {
          failures.push({
            accountUuid: account.uuid,
            accountNumber,
            reason: `BOG API ${bogResponse.status} (correlationId=${bogResponse.correlationId || 'n/a'})`,
          });
          continue;
        }

        const mapped = mapBogStatementPayloadToXml(bogResponse.data, {
          accountNoWithCurrency: `${accountNumber}${currencyCode}`,
          currencyCode,
          allowEmptyStatement: true,
        });

        if (mapped.detailsCount === 0) {
          successes.push({
            accountUuid: account.uuid,
            accountNumber,
            currencyCode,
            detailsCount: 0,
            correlationId: bogResponse.correlationId,
            path,
            noTransactions: true,
          });
          continue;
        }

        await processBOGGELDeconsolidated(
          mapped.xmlContent,
          account.uuid,
          accountNumber,
          currencyCode,
          uuidv4()
        );

        successes.push({
          accountUuid: account.uuid,
          accountNumber,
          currencyCode,
          detailsCount: mapped.detailsCount,
          correlationId: bogResponse.correlationId,
          path,
        });
      } catch (error: any) {
        failures.push({
          accountUuid: account.uuid,
          accountNumber,
          reason: error?.message || 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      ok: failures.length === 0,
      period: { startYmd, endYmd, timeZone: 'Asia/Tbilisi' },
      consideredAccounts: bogAccounts.length,
      processedAccounts: successes.length,
      failedAccounts: failures.length,
      successes,
      failures,
      config: getBogConfigStatus(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'BOG cron import failed',
        config: getBogConfigStatus(),
      },
      { status: 500 }
    );
  }
}
