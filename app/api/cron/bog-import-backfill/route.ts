import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { bogApiRequest, getBogConfigStatus } from '@/lib/integrations/bog/client';
import { mapBogStatementPayloadToXml } from '@/lib/integrations/bog/statement-mapper';
import { processBOGGELDeconsolidated } from '@/lib/bank-import/import_bank_xml_data_deconsolidated';
import { getSupabaseClient } from '@/lib/bank-import/db-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 600; // 10 minutes for backfill

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

function* iterateDays(startYmd: string, endYmd: string): Generator<string> {
  const start = new Date(`${startYmd}T00:00:00Z`);
  const end = new Date(`${endYmd}T00:00:00Z`);

  for (let day = new Date(start); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    yield day.toISOString().slice(0, 10);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { startDate, endDate, daysBack } = body as Record<string, unknown>;

    // Determine date range
    let startYmd: string;
    let endYmd: string;

    if (typeof startDate === 'string' && typeof endDate === 'string') {
      startYmd = startDate;
      endYmd = endDate;
    } else {
      // Default: last 30 days
      const days = Number(daysBack) || 30;
      const now = new Date(getTbilisiYmd(new Date()) + 'T00:00:00Z');
      const start = new Date(now);
      start.setUTCDate(start.getUTCDate() - days);
      startYmd = start.toISOString().slice(0, 10);
      endYmd = now.toISOString().slice(0, 10);
    }

    console.log(`[BACKFILL] Starting import for ${startYmd} → ${endYmd}`);

    // Authorization check
    const authHeader = req.headers.get('authorization');
    const cronSecret = String(process.env.CRON_SECRET || '').trim();
    const hasValidSecret = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;

    if (!hasValidSecret) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized', message: 'Valid authorization header required' },
        { status: 401 }
      );
    }

    // Check credentials
    const configStatus = getBogConfigStatus();
    if (!configStatus.hasCredentialsMap && !configStatus.hasClientId && !configStatus.hasStaticAccessToken) {
      return NextResponse.json(
        {
          ok: false,
          error: 'BOG credentials not configured',
          message: 'Set BOG_CREDENTIALS_MAP or BOG_CLIENT_ID/BOG_CLIENT_SECRET or BOG_ACCESS_TOKEN',
          config: configStatus,
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();
    const insiderCandidates = parseCredentialsMapInsiders();
    const defaultInsiderUuid = insiderCandidates.length === 1 ? insiderCandidates[0] : null;

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
      .filter((acc) => String(acc.account_number || '').trim().length > 0);

    if (bogAccounts.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No BOG accounts configured',
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

    for (const account of bogAccounts) {
      const accountNumber = String(account.account_number || '').trim().toUpperCase();
      const currencyCode = currencyMap.get(account.currency_uuid);

      if (!currencyCode) {
        failures.push({
          accountNumber,
          reason: `Currency code not found`,
        });
        continue;
      }

      const insiderUuid = account.insider_uuid || defaultInsiderUuid || undefined;
      console.log(`[BACKFILL] 📅 ${accountNumber} ${currencyCode}: importing ${startYmd} → ${endYmd}`);

      for (const day of iterateDays(startYmd, endYmd)) {
        const path = `/statement/${accountNumber}/${currencyCode}/${day}/${day}`;

        try {
          const bogResponse = await bogApiRequest<unknown>({
            method: 'GET',
            path,
            insiderUuid,
          });

          if (!bogResponse.ok) {
            console.log(`[BACKFILL] ⚠️  ${accountNumber} ${day}: BOG API ${bogResponse.status}`);
            failures.push({
              accountNumber,
              reason: `BOG API ${bogResponse.status} on ${day}`,
            });
            continue;
          }

          const mapped = mapBogStatementPayloadToXml(bogResponse.data, {
            accountNoWithCurrency: `${accountNumber}${currencyCode}`,
            currencyCode,
            allowEmptyStatement: true,
          });

          if (mapped.detailsCount === 0) {
            console.log(`[BACKFILL] ⏭️  ${accountNumber} ${day}: 0 transactions`);
            continue;
          }

          console.log(`[BACKFILL] ✅ ${accountNumber} ${day}: ${mapped.detailsCount} transactions`);

          await processBOGGELDeconsolidated(
            mapped.xmlContent,
            account.uuid,
            accountNumber,
            currencyCode,
            uuidv4()
          );

          successes.push({
            accountNumber,
            currencyCode,
            date: day,
            detailsCount: mapped.detailsCount,
            correlationId: bogResponse.correlationId,
          });
        } catch (error: any) {
          failures.push({
            accountNumber,
            reason: `${error?.message || 'Unknown error'} on ${day}`,
          });
        }
      }
    }

    const totalTransactions = successes.reduce((sum, s) => sum + s.detailsCount, 0);

    return NextResponse.json({
      ok: failures.length === 0,
      message: `Imported ${totalTransactions} transactions from ${successes.length} days`,
      period: { startYmd, endYmd },
      totalTransactions,
      successDays: successes.length,
      failedDays: failures.length,
      successes: successes.slice(0, 10), // First 10 for summary
      failures: failures.slice(0, 10),
      config: configStatus,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Backfill failed',
        config: getBogConfigStatus(),
      },
      { status: 500 }
    );
  }
}
