import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { bogApiRequest, getBogConfigStatus, getTokenPreview, getBogAccessToken } from '@/lib/integrations/bog/client';
import { mapBogStatementPayloadToXml } from '@/lib/integrations/bog/statement-mapper';
import { processBOGGELDeconsolidated } from '@/lib/bank-import/import_bank_xml_data_deconsolidated';
import { getSupabaseClient } from '@/lib/bank-import/db-utils';

export const dynamic = 'force-dynamic';

type StatementPreviewResponse = {
  ok: boolean;
  mode: 'preview';
  path: string;
  status: number;
  correlationId: string | null;
  detailsCount: number;
  header: {
    AcctNo: string;
    AcctName?: string;
    BIC?: string;
    IBAN?: string;
    DateFrom?: string;
    DateTo?: string;
  };
  xmlPreview: string;
  config: ReturnType<typeof getBogConfigStatus>;
};

function sanitizePath(value: string | null) {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.includes('://')) return null;
  return value;
}

function parseBoolean(value: string | null) {
  if (!value) return false;
  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
}

function normalizeAccountNumber(accountNoWithCurrency: string) {
  const trimmed = accountNoWithCurrency.trim().toUpperCase();
  if (trimmed.length <= 3) return { accountNumber: trimmed, currencyCode: 'GEL' };
  const currencyCode = trimmed.slice(-3);
  const accountNumber = trimmed.slice(0, -3);
  return { accountNumber, currencyCode };
}

async function resolveAccountContext(accountUuid: string) {
  const supabase = getSupabaseClient();
  const { data: account, error: accountError } = await supabase
    .from('bank_accounts')
    .select('uuid, account_number, currency_uuid, insider_uuid')
    .eq('uuid', accountUuid)
    .single();

  if (accountError || !account) {
    throw new Error(`bank_accounts entry not found for accountUuid=${accountUuid}`);
  }

  const { data: currency, error: currencyError } = await supabase
    .from('currencies')
    .select('code')
    .eq('uuid', account.currency_uuid)
    .single();

  if (currencyError || !currency?.code) {
    throw new Error(`currencies entry not found for currencyUuid=${account.currency_uuid}`);
  }

  return {
    accountUuid: account.uuid,
    accountNumber: String(account.account_number).trim().toUpperCase(),
    currencyCode: String(currency.code).trim().toUpperCase(),
    insiderUuid: account.insider_uuid ? String(account.insider_uuid) : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = sanitizePath(searchParams.get('path'));
    const importToDb = parseBoolean(searchParams.get('import'));
    const accountUuid = searchParams.get('accountUuid');
    const insiderUuid = searchParams.get('insiderUuid') || undefined;
    const accountNoWithCurrency = searchParams.get('accountNoWithCurrency') || undefined;
    const currencyCode = searchParams.get('currency') || undefined;

    const accountContext = importToDb && accountUuid
      ? await resolveAccountContext(accountUuid)
      : null;
    const effectiveInsiderUuid = accountContext?.insiderUuid || insiderUuid;

    if (!path) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Missing or invalid ?path. Expected relative BOG API path like /statements/....',
          config: getBogConfigStatus(),
        },
        { status: 400 }
      );
    }

    const token = await getBogAccessToken({ insiderUuid: effectiveInsiderUuid || undefined });
    const tokenPreview = getTokenPreview(token);

    const bogResponse = await bogApiRequest<unknown>({
      method: 'GET',
      path,
      insiderUuid: effectiveInsiderUuid || undefined,
    });

    if (!bogResponse.ok) {
      return NextResponse.json(
        {
          ok: false,
          path,
          status: bogResponse.status,
          correlationId: bogResponse.correlationId,
          response: bogResponse.data,
          config: getBogConfigStatus(),
          token: tokenPreview,
        },
        { status: 502 }
      );
    }

    const mapped = mapBogStatementPayloadToXml(bogResponse.data, {
      accountNoWithCurrency,
      currencyCode,
    });

    if (!importToDb) {
      const preview: StatementPreviewResponse = {
        ok: true,
        mode: 'preview',
        path,
        status: bogResponse.status,
        correlationId: bogResponse.correlationId,
        detailsCount: mapped.detailsCount,
        header: mapped.header,
        xmlPreview: mapped.xmlContent.slice(0, 3000),
        config: getBogConfigStatus(),
      };

      return NextResponse.json({
        ...preview,
        token: tokenPreview,
      });
    }

    if (!accountUuid) {
      return NextResponse.json(
        {
          ok: false,
          error: 'accountUuid is required when import=1',
        },
        { status: 400 }
      );
    }

    const importAccountContext = accountContext || (await resolveAccountContext(accountUuid));
    if (!importAccountContext) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Failed to resolve account context',
        },
        { status: 500 }
      );
    }
    const headerParts = normalizeAccountNumber(mapped.header.AcctNo);

    // Use account context from DB for write safety; mapped header is used for XML compatibility only.
    await processBOGGELDeconsolidated(
      mapped.xmlContent,
      importAccountContext.accountUuid,
      importAccountContext.accountNumber,
      importAccountContext.currencyCode || headerParts.currencyCode,
      uuidv4()
    );

    return NextResponse.json({
      ok: true,
      mode: 'import',
      path,
      status: bogResponse.status,
      correlationId: bogResponse.correlationId,
      detailsCount: mapped.detailsCount,
      header: mapped.header,
      accountContext: importAccountContext,
      token: tokenPreview,
      message: 'BOG API statement mapped to XML headers/details and imported through deconsolidated pipeline.',
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Failed to process BOG statement endpoint',
        config: getBogConfigStatus(),
      },
      { status: 500 }
    );
  }
}
